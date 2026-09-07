// SOURCE OF TRUTH. Do not edit apps/bot/services/memberCalendar.js directly.
//
// Copied into apps/bot by `npm run sync:shared`; the Next.js site imports this file directly via
// the @/* alias. CI fails on drift. It lives beside the coach modules because the sync flattens
// everything into apps/bot/services/, so a sibling `require("./coachChatNotes")` resolves the same
// way in both trees — a subdirectory of its own would not.
//
// The member calendar is deliberately NOT coach data. It is available to every verified member,
// including those without a coach, it is not gated on notesOptIn, and it survives a coach data
// wipe. The coach reads it and (with notes on) writes to it, but it does not own it.
//
// Dates reuse sanitizeEventDate from coachChatNotes rather than reimplementing them: that helper
// is tested, timezone-correct for Europe/Copenhagen, and already the definition of "a valid future
// date" everywhere else in this codebase. Two definitions would eventually disagree.

const {
  sanitizeEventDate,
  formatDaysUntil,
  calendarDateInTz,
  addIsoDays,
} = require("./coachChatNotes");

// "session" is training the member intends to do; "race" and "event" are things with a start
// time someone else set. The distinction matters to the coach: it may move a session, never a race.
const ENTRY_KINDS = ["session", "race", "event", "other"];
const ENTRY_SOURCES = ["member", "coach"];
const ENTRY_STATUSES = ["planned", "done", "skipped"];

const MAX_ENTRY_TEXT = 280;
const MAX_ENTRIES_PER_MEMBER = 200;

// The coach gets a small weekly allowance because a model handed a calendar it can fill will
// happily write a full training plan into it, and the member's own entries then read as noise in
// their own calendar. A cap keeps coach rows to suggestions rather than a takeover.
const MAX_COACH_ENTRIES_PER_WEEK = 5;

// How far ahead the prompt block looks. Long enough to cover a training block, short enough that
// a goal eight months out does not crowd out this week.
const DEFAULT_HORIZON_DAYS = 60;

function clip(value, max) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max);
}

function sanitizeEntryKind(value) {
  const kind = String(value || "").trim().toLowerCase();
  return ENTRY_KINDS.includes(kind) ? kind : "session";
}

function sanitizeEntrySource(value) {
  const source = String(value || "").trim().toLowerCase();
  return ENTRY_SOURCES.includes(source) ? source : "member";
}

function sanitizeEntryStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  return ENTRY_STATUSES.includes(status) ? status : "planned";
}

/**
 * Local wall-clock start, "HH:MM".
 *
 * Stored as text rather than a timestamp on purpose: a Zwift subgroup start is a time in the
 * club's day, and turning it into an instant here would force a timezone guess on read.
 */
function sanitizeStartTime(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || hours < 0 || hours > 23) return null;
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Opaque id of the upstream event a row was copied from. Never used to re-fetch — see below. */
function sanitizeSourceEventId(value) {
  const raw = clip(value, 64);
  return /^[A-Za-z0-9_:-]+$/.test(raw) ? raw : null;
}

/**
 * Validate one entry on the way in.
 *
 * Returns null for anything unusable so callers can drop it without a second check. `eventDate`
 * runs through sanitizeEventDate, which rejects dates in the past — correct for creating an
 * entry, and the reason reads do not re-validate: yesterday's entry must still come back.
 *
 * @returns {{text, eventDate, kind, startTime, source, status, sourceEventId}|null}
 */
function sanitizeCalendarEntry(raw, now = new Date()) {
  if (!raw || typeof raw !== "object") return null;
  const text = clip(raw.text, MAX_ENTRY_TEXT);
  if (!text) return null;
  const eventDate = sanitizeEventDate(raw.eventDate, now);
  if (!eventDate) return null;
  return {
    text,
    eventDate,
    kind: sanitizeEntryKind(raw.kind),
    startTime: sanitizeStartTime(raw.startTime),
    source: sanitizeEntrySource(raw.source),
    status: sanitizeEntryStatus(raw.status),
    sourceEventId: sanitizeSourceEventId(raw.sourceEventId),
  };
}

function compareEntries(a, b) {
  const byDate = String(a.eventDate || "").localeCompare(String(b.eventDate || ""));
  if (byDate !== 0) return byDate;
  // Entries without a time sort after timed ones on the same day: a race at 19:30 is a fixed
  // point in the day, an untimed session is whenever it fits around it.
  const aTime = a.startTime || "99:99";
  const bTime = b.startTime || "99:99";
  return aTime.localeCompare(bTime);
}

/**
 * Entries from today up to the horizon, soonest first.
 *
 * Past entries are excluded rather than deleted — they are the record the Stage 6d reconciliation
 * reads to ask whether a planned session actually happened.
 */
function upcomingEntries(entries, now = new Date(), horizonDays = DEFAULT_HORIZON_DAYS) {
  // Copenhagen's date, not the server's: at 22:30 UTC it is already tomorrow for the club, and a
  // member looking at their calendar late in the evening must not see today's race as upcoming.
  const today = calendarDateInTz(now);
  if (!today) return [];
  const limit = addIsoDays(today, Math.max(1, horizonDays));
  return (Array.isArray(entries) ? entries : [])
    .filter((entry) => {
      const date = String(entry?.eventDate || "");
      return /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= today && date <= limit;
    })
    .sort(compareEntries);
}

function formatEntryLine(entry, now) {
  const until = formatDaysUntil(entry.eventDate, now);
  const when = until ? `${entry.eventDate} (${until})` : entry.eventDate;
  const time = entry.startTime ? ` ${entry.startTime}` : "";
  // Coach-written rows are labelled so the coach can tell its own suggestion from the athlete's
  // commitment, and does not treat something it proposed as something they decided.
  const who = entry.source === "coach" ? " [added by coach]" : "";
  const status = entry.status && entry.status !== "planned" ? ` [${entry.status}]` : "";
  return `- ${when}${time} — ${entry.text} (${entry.kind})${who}${status}`;
}

/**
 * The `## Upcoming` prompt block: the member's calendar plus their active goals.
 *
 * Goals are listed separately rather than merged in. A goal is a commitment the athlete confirmed
 * and there are at most three; a calendar entry is a plan that may well move. Flattening the two
 * would let the coach treat "maybe ride Thursday" with the weight of "ZRL final on 12 May".
 */
function formatCalendarForPrompt(entries, goals, now = new Date()) {
  const upcoming = upcomingEntries(entries, now);
  const activeGoals = Array.isArray(goals) ? goals : [];
  if (!upcoming.length && !activeGoals.length) return "";

  const lines = [];
  if (activeGoals.length) {
    lines.push("Goals:");
    for (const goal of activeGoals) {
      const until = formatDaysUntil(goal.eventDate, now);
      lines.push(`- ${goal.eventDate}${until ? ` (${until})` : ""} — ${goal.text}`);
    }
  }
  if (upcoming.length) {
    if (lines.length) lines.push("");
    lines.push("Planned:");
    for (const entry of upcoming) lines.push(formatEntryLine(entry, now));
  }
  return lines.join("\n");
}

/** Coach rows written in the last seven days, used to enforce MAX_COACH_ENTRIES_PER_WEEK. */
function countRecentCoachEntries(entries, now = new Date()) {
  const cutoff = now.getTime() - 7 * 86400000;
  return (Array.isArray(entries) ? entries : []).filter((entry) => {
    if (entry?.source !== "coach") return false;
    const created = Date.parse(entry.createdAt || "");
    return Number.isFinite(created) && created >= cutoff;
  }).length;
}

module.exports = {
  ENTRY_KINDS,
  ENTRY_SOURCES,
  ENTRY_STATUSES,
  MAX_ENTRY_TEXT,
  MAX_ENTRIES_PER_MEMBER,
  MAX_COACH_ENTRIES_PER_WEEK,
  DEFAULT_HORIZON_DAYS,
  sanitizeEntryKind,
  sanitizeEntrySource,
  sanitizeEntryStatus,
  sanitizeStartTime,
  sanitizeSourceEventId,
  sanitizeCalendarEntry,
  upcomingEntries,
  formatCalendarForPrompt,
  countRecentCoachEntries,
};
