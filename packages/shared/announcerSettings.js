// Source of truth; copied to apps/bot by npm run sync:shared.
//
// The announcer's settings: defaults here, admin changes in system_settings/announcer, merged
// field by field. FIELD_SPECS is the list admins may change on /admin/announcer; the page is built
// from it and the API accepts nothing else.

/** @param {{ announcements: string }} channels */
function announcerDefaults(channels) {
  return {
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
      default: channels.announcements,
      events: channels.announcements,
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
}

const bool = (group, path, label, help) => ({ group, path, label, help, type: "boolean" });
const num = (group, path, label, min, max, help, step = 1) => ({ group, path, label, help, type: "number", min, max, step });
const channel = (group, path, label, help) => ({ group, path, label, help, type: "channel" });

const FIELD_SPECS = [
  bool("Posting", "enabled", "Bot announcements on", "Off stops new drafts and posting. DM reminders have their own switch."),
  channel("Posting", "channels.default", "Channel for posts"),
  channel("Posting", "channels.events", "Channel for club event posts"),
  num("Posting", "runHour", "Daily draft at (hour)", 0, 23, "When the bot picks a topic and posts a draft for moderators."),
  num("Posting", "runMinute", "Daily draft at (minute)", 0, 59),
  num("Posting", "postWindow.startHour", "Post from (hour)", 0, 23),
  num("Posting", "postWindow.endHour", "Post until (hour)", 1, 24, "Approved posts wait in a queue outside these hours."),
  num("Posting", "dailyCap", "Posts per day", 0, 5),
  num("Posting", "weeklyCap", "Posts per week", 0, 21),
  num("Posting", "channelQuietHours", "Channel quiet for (hours)", 0, 168, "No post while the channel has had any message this recently."),
  num("Posting", "draftExpiryDays", "Drafts expire after (days)", 1, 14),
  num("Posting", "maxOpenDrafts", "Open drafts at most", 1, 5, "No new draft while this many wait for a moderator or a slot."),

  bool("Club events", "signals.upcomingClubEvents.enabled", "Post about upcoming DZR events"),
  num("Club events", "signals.upcomingClubEvents.lookaheadDays", "Events in the next (days)", 1, 14),
  num("Club events", "signals.upcomingClubEvents.nameCooldownDays", "Same series again after (days)", 0, 90),
  num("Club events", "signals.upcomingClubEvents.cooldownDays", "Event posts at most every (days)", 0, 30),

  bool("Feature news", "signals.newFeatures.enabled", "Post about new features from the commit log"),
  num("Feature news", "signals.newFeatures.cooldownDays", "At most every (days)", 0, 30),

  bool("Zwift ID", "signals.unlinkedZwiftId.enabled", "Nudge members without a linked Zwift ID"),
  num("Zwift ID", "signals.unlinkedZwiftId.minCount", "When at least (members)", 1, 1000),
  num("Zwift ID", "signals.unlinkedZwiftId.minShare", "…or at least (share, 0–1)", 0, 1, "0.1 = 10 % of community members.", 0.01),
  num("Zwift ID", "signals.unlinkedZwiftId.cooldownDays", "At most every (days)", 0, 90),

  bool("Companion club", "signals.notInCompanionClub.enabled", "Nudge linked members outside the Companion club"),
  num("Companion club", "signals.notInCompanionClub.minCount", "When at least (members)", 1, 1000),
  num("Companion club", "signals.notInCompanionClub.cooldownDays", "At most every (days)", 0, 90),

  bool("Unread DMs", "signals.dmUnseen.enabled", "Remind members to check the bot's DMs"),
  num("Unread DMs", "signals.dmUnseen.minCount", "When at least (members)", 1, 1000),
  num("Unread DMs", "signals.dmUnseen.silentDays", "Silent after (days)", 1, 30, "A delivered DM with no reply, click or follow-through after this long."),
  num("Unread DMs", "signals.dmUnseen.cooldownDays", "At most every (days)", 0, 180),

  bool("Feature spotlight", "signals.featureSpotlight.enabled", "Spotlight existing features"),
  num("Feature spotlight", "signals.featureSpotlight.cooldownDays", "Same feature again after (days)", 1, 365),
  num("Feature spotlight", "signals.featureSpotlight.shippedAfterDays", "New features spotlighted after (days)", 0, 180),

  bool("Knowledge tips", "signals.evergreen.enabled", "Post tips from the knowledge base when nothing else is due"),
  num("Knowledge tips", "signals.evergreen.cooldownDays", "Same article again after (days)", 1, 365),

  bool("DM reminders", "dmReminders.enabled", "Send DM reminders"),
  num("DM reminders", "dmReminders.minDaysSinceLastDm", "Days after any bot DM", 0, 60),
  num("DM reminders", "dmReminders.perMemberDays", "Days between reminders to one member", 1, 90),
  num("DM reminders", "dmReminders.maxPerStep", "Reminders per step at most", 1, 10),
  num("DM reminders", "dmReminders.dailyCap", "Reminders per day at most", 0, 200),
  num("DM reminders", "dmReminders.delayMinMinutes", "Wait after activity, from (minutes)", 0, 240),
  num("DM reminders", "dmReminders.delayMaxMinutes", "Wait after activity, to (minutes)", 0, 240),
  num("DM reminders", "dmReminders.activeWithinMinutes", "Still active if seen within (minutes)", 5, 240),
  num("DM reminders", "dmReminders.recheckHours", "Look at a member at most every (hours)", 1, 168),
];

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date);
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

function getPath(object, path) {
  return path.split(".").reduce((value, key) => (value == null ? undefined : value[key]), object);
}

function setPath(object, path, value) {
  const keys = path.split(".");
  let node = object;
  for (const key of keys.slice(0, -1)) node = node[key] ||= {};
  node[keys[keys.length - 1]] = value;
  return object;
}

/**
 * The admin's values, checked against FIELD_SPECS and nested for a merge write. Unknown fields
 * are dropped; numbers are clamped. Returns { patch, errors }.
 */
function sanitizeSettings(values) {
  const patch = {};
  const errors = [];
  for (const spec of FIELD_SPECS) {
    const value = values?.[spec.path];
    if (value === undefined) continue;
    if (spec.type === "boolean") {
      setPath(patch, spec.path, value === true);
    } else if (spec.type === "number") {
      const number = value === "" || value === null ? NaN : Number(value);
      if (!Number.isFinite(number)) {
        errors.push(`${spec.label}: not a number`);
        continue;
      }
      const rounded = spec.step < 1 ? Math.round(number / spec.step) * spec.step : Math.round(number);
      setPath(patch, spec.path, Math.min(spec.max, Math.max(spec.min, Number(rounded.toFixed(4)))));
    } else if (spec.type === "channel") {
      const id = String(value || "").trim();
      if (!/^\d{5,25}$/.test(id)) {
        errors.push(`${spec.label}: pick a channel`);
        continue;
      }
      setPath(patch, spec.path, id);
    }
  }
  const window = patch.postWindow;
  if (window?.startHour != null && window?.endHour != null && window.startHour >= window.endHour) {
    errors.push("Post from must be before post until");
  }
  const reminders = patch.dmReminders;
  if (reminders?.delayMinMinutes != null && reminders?.delayMaxMinutes != null && reminders.delayMinMinutes > reminders.delayMaxMinutes) {
    errors.push("The DM reminder wait 'from' must not be after 'to'");
  }
  return { patch, errors };
}

/** Flat { path: value } of the effective settings for every field, for the admin form. */
function flattenSettings(settings) {
  return Object.fromEntries(FIELD_SPECS.map((spec) => [spec.path, getPath(settings, spec.path)]));
}

module.exports = { announcerDefaults, FIELD_SPECS, mergeSettings, sanitizeSettings, flattenSettings, getPath };
