/**
 * Announcer settings: code defaults, overridden field by field by system_settings/announcer.
 *
 * Everything works without that document. Admins can switch a signal or the DM reminders off there
 * without a redeploy, e.g. { signals: { evergreen: { enabled: false } } }.
 */
const shared = require("../../constants.json");

const CHANNELS = shared.discord.channels;
const SETTINGS_DOC = "announcer";
const CACHE_MS = 5 * 60 * 1000;

const DEFAULTS = {
  enabled: true,
  tz: "Europe/Copenhagen",
  // The daily run that picks a topic and posts a draft for moderators.
  runHour: 9,
  runMinute: 15,
  // Approved posts go out only inside this window (local hours, end exclusive).
  postWindow: { startHour: 10, endHour: 20 },
  weeklyCap: 3,
  dailyCap: 1,
  // No post while the target channel has had any message this recently.
  channelQuietHours: 24,
  draftExpiryDays: 3,
  // No new draft while this many are waiting for a moderator or a slot.
  maxOpenDrafts: 2,
  channels: {
    default: CHANNELS.announcements,
    events: CHANNELS.announcements,
  },
  signals: {
    upcomingClubEvents: { enabled: true, cooldownDays: 4, lookaheadDays: 3, nameCooldownDays: 21 },
    newFeatures: { enabled: true, cooldownDays: 3, firstRunDays: 14 },
    unlinkedZwiftId: { enabled: true, cooldownDays: 14, minCount: 15, minShare: 0.1 },
    notInCompanionClub: { enabled: true, cooldownDays: 14, minCount: 15 },
    dmUnseen: { enabled: true, cooldownDays: 30, minCount: 15, silentDays: 3 },
    featureSpotlight: { enabled: true, cooldownDays: 30, shippedAfterDays: 30 },
    evergreen: { enabled: true, cooldownDays: 90 },
  },
  dmReminders: {
    enabled: true,
    minDaysSinceLastDm: 7,
    perMemberDays: 14,
    maxPerStep: 3,
    dailyCap: 20,
    delayMinMinutes: 10,
    delayMaxMinutes: 60,
    // The member counts as still online when active this recently at send time.
    activeWithinMinutes: 30,
    // A member is looked at no more often than this, so chatty members cost no extra reads.
    recheckHours: 12,
  },
};

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/** Defaults with the stored overrides merged in, recursively. */
function mergeSettings(base, override) {
  if (!isPlainObject(override)) return base;
  const out = { ...base };
  for (const [key, value] of Object.entries(override)) {
    out[key] = isPlainObject(base[key]) && isPlainObject(value) ? mergeSettings(base[key], value) : value;
  }
  return out;
}

let cache = { at: 0, value: null };

async function loadSettings(db, nowMs = Date.now()) {
  if (cache.value && nowMs - cache.at < CACHE_MS) return cache.value;
  let stored = null;
  try {
    const snap = await db.collection(shared.firestore.systemSettings).doc(SETTINGS_DOC).get();
    stored = snap.exists ? snap.data() : null;
  } catch (error) {
    console.warn("Announcer settings unavailable, using defaults:", error?.message || error);
  }
  cache = { at: nowMs, value: mergeSettings(DEFAULTS, stored) };
  return cache.value;
}

module.exports = { DEFAULTS, mergeSettings, loadSettings };
