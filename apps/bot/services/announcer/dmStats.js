/**
 * What happened to the bot's DMs, read from onboarding_dms. Discord has no read receipts, so these
 * are proxies:
 *   failed    DMs closed (50007) on some step
 *   engaged   replied to the bot in DM, or clicked a reminder button
 *   converted did the step after the DM (funnel timestamp after the send)
 *   silent    delivered at least silentDays ago, then nothing: no reply, no click, no conversion.
 *             An upper bound on "never saw it": it also holds those who saw it and ignored it.
 */
const { toMs, DAY_MS } = require("./pacing");

/** Which funnel timestamp means a step is done. Steps without one cannot convert. */
const CONVERTED_BY = {
  link_zwift_id_channel: "zwiftLinkedAt",
  link_zwift_id_join: "zwiftLinkedAt",
  become_club_member: "clubJoinedAt",
  join_companion: "companionJoinedAt",
};

/** Every DM send recorded on the doc: [{ step, at, failed }]. */
function sendsOf(doc) {
  const sends = [];
  for (const [step, entry] of Object.entries(doc?.steps || {})) {
    if (entry?.sentAt) sends.push({ step, at: toMs(entry.sentAt), failed: false });
    if (entry?.dmFailedAt) sends.push({ step, at: toMs(entry.dmFailedAt), failed: true });
  }
  for (const [step, entry] of Object.entries(doc?.reminders || {})) {
    if (entry?.lastAt) sends.push({ step, at: toMs(entry.lastAt), failed: !!entry.dmFailedAt, count: entry.count || 1 });
  }
  return sends.filter((send) => send.at != null);
}

function engaged(doc) {
  return !!doc?.firstReplyAt || Object.values(doc?.reminders || {}).some((entry) => entry?.clickedAt || entry?.snoozedAt);
}

function converted(doc, step, sentAt) {
  const field = CONVERTED_BY[step];
  const doneAt = field ? toMs(doc?.[field]) : null;
  return doneAt != null && doneAt >= sentAt;
}

/** True when the member got a DM silentDays or more ago and nothing came of it. */
function isSilent(doc, now, silentDays) {
  if (doc?.test || engaged(doc)) return false;
  const delivered = sendsOf(doc).filter((send) => !send.failed);
  if (!delivered.length) return false;
  const latest = Math.max(...delivered.map((send) => send.at));
  if (now.getTime() - latest < silentDays * DAY_MS) return false;
  return !delivered.some((send) => converted(doc, send.step, send.at));
}

/** Per-step funnel over all docs: { [step]: { sent, failed, engaged, converted, silent } }. */
function funnel(docs, now, silentDays) {
  const out = {};
  for (const doc of docs) {
    if (doc?.test) continue;
    const silent = isSilent(doc, now, silentDays);
    const isEngaged = engaged(doc);
    for (const send of sendsOf(doc)) {
      const row = (out[send.step] ||= { sent: 0, failed: 0, engaged: 0, converted: 0, silent: 0 });
      if (send.failed) {
        row.failed += 1;
        continue;
      }
      row.sent += send.count || 1;
      if (isEngaged) row.engaged += 1;
      if (converted(doc, send.step, send.at)) row.converted += 1;
      if (silent) row.silent += 1;
    }
  }
  return out;
}

module.exports = { sendsOf, engaged, converted, isSilent, funnel, CONVERTED_BY };
