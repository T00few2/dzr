/**
 * The announcer: once a day it picks the most relevant topic and posts a draft for moderators;
 * through the day it posts approved drafts when pacing allows. Called from the scheduler's minute
 * tick. The flow and the rules are described in docs/architecture/bot-automation.md.
 *
 *   bot_state/announcer  { lastRunDate, paused, published: [{ at, key, kind, channelId }],
 *                          perSignal: { [key]: at }, lastKind, lastPublishedAt,
 *                          github: { lastSha }, promotedEvents: { [name]: at }, shippedFeatures }
 */
const { loadSettings } = require("./settings");
const { localParts } = require("./pacing");
const { gatherCandidates, pickCandidate } = require("./signals");
const drafts = require("./drafts");
const { defaultSources } = require("./sources");
const dmReminders = require("./dmReminders");

const QUEUE_CHECK_MS = 15 * 60 * 1000;
let lastQueueCheck = 0;
let running = false;

async function readState(db) {
  const snap = await drafts.stateRef(db).get();
  return (snap.exists && snap.data()) || {};
}

/**
 * Pick today's topic and draft it.
 * @param {{ dryRun?: boolean }} options dryRun: report candidates and the pick, write nothing.
 * @returns {Promise<{ candidates: object[], picked: object|null, draftId?: string, skipped?: string }>}
 */
async function runDaily(client, { dryRun = false, deps = drafts.defaultDeps(), sources } = {}) {
  const settings = await loadSettings(deps.db);
  const now = deps.now();
  const state = await readState(deps.db);
  const open = await drafts.listOpenDrafts(deps.db);
  const candidates = await gatherCandidates({ deps: sources || defaultSources(client, settings), settings, state, now });
  const openKeys = new Set(open.map((draft) => draft.signalKey));
  const ranked = [];
  let rest = candidates;
  for (let pick = pickCandidate(rest, { state, now, openKeys }); pick; pick = pickCandidate(rest, { state, now, openKeys })) {
    ranked.push(pick);
    rest = rest.filter((candidate) => candidate !== pick);
  }
  const report = { candidates, ranked, picked: ranked[0] || null, open: open.length };
  if (dryRun) return report;

  if (!settings.enabled || state.paused) return { ...report, skipped: "paused" };
  if (open.length >= settings.maxOpenDrafts) return { ...report, skipped: "open_drafts" };

  // The model may find nothing worth saying (feature news with only internal commits); then the
  // next topic gets its turn.
  for (const candidate of ranked.slice(0, 2)) {
    const created = await drafts.createDraft(client, candidate, settings, deps);
    if (candidate.meta?.headSha) {
      await drafts.stateRef(deps.db).set({ github: { lastSha: candidate.meta.headSha } }, { merge: true });
    }
    if (created) return { ...report, picked: candidate, draftId: created.id };
  }
  return { ...report, skipped: ranked.length ? "nothing_written" : "no_candidates" };
}

/** Minute tick: the daily draft at runHour:runMinute, the queue every 15 minutes, due DM reminders. */
async function maybeRunAnnouncer(client) {
  if (running) return;
  running = true;
  try {
    const deps = drafts.defaultDeps();
    const settings = await loadSettings(deps.db);
    const now = deps.now();
    const local = localParts(now, settings.tz);

    if (local.hour === settings.runHour && local.minute === settings.runMinute) {
      const state = await readState(deps.db);
      if (state.lastRunDate !== local.dateKey) {
        await drafts.stateRef(deps.db).set({ lastRunDate: local.dateKey }, { merge: true });
        const result = await runDaily(client, { deps });
        console.log(`📣 Announcer: ${result.draftId ? `drafted ${result.picked.key}` : `no draft (${result.skipped})`}; ${result.candidates.length} candidate(s)`);
      }
    }

    if (now.getTime() - lastQueueCheck >= QUEUE_CHECK_MS) {
      lastQueueCheck = now.getTime();
      await drafts.expireDrafts(client, deps);
      const published = await drafts.publishQueued(client, settings, deps);
      if (published?.ok) console.log(`📣 Announcer: posted a queued draft (${published.url})`);
    }

    await dmReminders.processDue(client);
  } catch (error) {
    console.error("❌ Announcer tick failed:", error?.message || error);
  } finally {
    running = false;
  }
}

async function setPaused(paused, deps = drafts.defaultDeps()) {
  await drafts.stateRef(deps.db).set({ paused: !!paused }, { merge: true });
}

module.exports = { maybeRunAnnouncer, runDaily, setPaused, readState };
