/**
 * Announcer settings: the defaults in ../announcerSettings.js (shared with the admin site),
 * overridden field by field by system_settings/announcer, which admins edit on /admin/announcer.
 * The same document holds the feature spotlight changes (features.<key>) and the DM reminder
 * texts (dmReminders.texts.<step>).
 */
const shared = require("../../constants.json");
const { announcerDefaults, mergeSettings } = require("../announcerSettings");

const SETTINGS_DOC = "announcer";
const CACHE_MS = 5 * 60 * 1000;

const DEFAULTS = announcerDefaults(shared.discord.channels);

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
