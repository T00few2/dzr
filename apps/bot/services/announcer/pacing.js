/**
 * When the announcer may post. Pure: callers read the channel and state, these functions decide.
 *
 * The rules, in the order a post is refused:
 * 1. Paused or disabled.
 * 2. Outside the posting window (local time).
 * 3. Daily or weekly cap reached (counting the announcer's own published posts).
 * 4. An admin already posted in #announcements today: admins come first.
 * 5. The target channel had any message within channelQuietHours, so a post never lands right
 *    after another one.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

/** Local date key (YYYY-MM-DD), hour and minute in tz. */
function localParts(now, tz) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now).map((part) => [part.type, part.value])
  );
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    // Intl writes midnight as "24" in some runtimes.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
  };
}

function toMs(value) {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (typeof value.toMillis === "function") return value.toMillis();
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function daysSince(value, now) {
  const ms = toMs(value);
  return ms == null ? Infinity : (now.getTime() - ms) / DAY_MS;
}

function isCoolingDown(lastAt, cooldownDays, now) {
  return daysSince(lastAt, now) < Number(cooldownDays || 0);
}

/**
 * @param {object} input
 * @param {Date} input.now
 * @param {object} input.settings Merged announcer settings.
 * @param {object} input.state bot_state/announcer ({ paused, published: [{ at }] }).
 * @param {number|null} input.lastChannelMessageAt Newest message in the target channel (ms), any author.
 * @param {boolean} input.adminPostedToday A person posted in #announcements today (local date).
 * @returns {{ ok: boolean, reason?: string }}
 */
function canPostNow({ now, settings, state, lastChannelMessageAt, adminPostedToday }) {
  if (!settings.enabled || state?.paused) return { ok: false, reason: "paused" };
  const local = localParts(now, settings.tz);
  const { startHour, endHour } = settings.postWindow;
  if (local.hour < startHour || local.hour >= endHour) return { ok: false, reason: "outside_window" };

  const published = (state?.published || []).map((row) => toMs(row.at)).filter((ms) => ms != null);
  const today = published.filter((ms) => localParts(new Date(ms), settings.tz).dateKey === local.dateKey).length;
  if (today >= settings.dailyCap) return { ok: false, reason: "daily_cap" };
  const week = published.filter((ms) => now.getTime() - ms < 7 * DAY_MS).length;
  if (week >= settings.weeklyCap) return { ok: false, reason: "weekly_cap" };

  if (adminPostedToday) return { ok: false, reason: "admin_posted_today" };
  if (lastChannelMessageAt != null && now.getTime() - lastChannelMessageAt < settings.channelQuietHours * 60 * 60 * 1000) {
    return { ok: false, reason: "channel_busy" };
  }
  return { ok: true };
}

/** Danish text for a refusal, for moderators. */
const REASON_TEXT = {
  paused: "annonceringer er sat på pause",
  outside_window: "uden for tidsrummet for opslag",
  daily_cap: "der er allerede postet i dag",
  weekly_cap: "ugens kvote er brugt",
  admin_posted_today: "en admin har postet i #announcements i dag",
  channel_busy: "kanalen har haft et opslag for nylig",
};

module.exports = { localParts, toMs, daysSince, isCoolingDown, canPostNow, REASON_TEXT, DAY_MS };
