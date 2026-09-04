const NOTE_KINDS = ["feeling", "plan", "preference_transient", "life", "race"];
const MAX_NOTE_TEXT = 280;
const MAX_NOTES_PER_ATHLETE = 200;
const MAX_EXTRACT_NOTES = 2;
const RETRIEVE_LIMIT = 5;
const SEARCH_LIMIT = 8;
const MIN_USER_MESSAGE_LEN = 10;
const MIN_RETRIEVE_SCORE = 1;
const COACH_TZ = "Europe/Copenhagen";

const STOPWORDS = new Set([
  "jeg", "du", "vi", "de", "den", "det", "en", "et", "og", "i", "på", "til", "for", "med",
  "som", "at", "er", "var", "har", "hadde", "ikke", "kan", "skal", "vil", "min", "mit", "mine",
  "the", "a", "an", "to", "of", "in", "on", "for", "and", "or", "is", "was", "be", "my", "me",
  "you", "we", "it", "this", "that", "have", "had", "do", "did", "just", "om", "fra", "så",
]);

function clip(value, max) {
  return String(value || "").trim().slice(0, max);
}

function calendarDateInTz(value, tz = COACH_TZ) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: tz,
  }).format(date);
}

function formatCoachToday(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: COACH_TZ }).format(date);
  const longDate = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: COACH_TZ,
  }).format(date);
  const iso = calendarDateInTz(date);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: COACH_TZ,
  }).format(date);
  return {
    iso,
    weekday,
    longDate,
    time,
    tz: COACH_TZ,
    line: `Today is ${weekday}, ${longDate} (${iso}) in ${COACH_TZ}. Local time ${time}.`,
  };
}

function calendarDaysAgo(at, now = new Date()) {
  const from = calendarDateInTz(at);
  const to = calendarDateInTz(now);
  if (!from || !to) return null;
  const fromMs = Date.parse(`${from}T00:00:00Z`);
  const toMs = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return null;
  return Math.round((toMs - fromMs) / 86400000);
}

function formatNoteAge(at, now = new Date()) {
  const days = calendarDaysAgo(at, now);
  if (days == null) return "";
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) {
    const weeks = Math.round(days / 7);
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  }
  const months = Math.round(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

function sanitizeEventDate(value, now = new Date()) {
  const iso = String(value || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  if (!Number.isFinite(Date.parse(`${iso}T00:00:00Z`))) return null;
  const today = calendarDateInTz(now);
  if (!today || iso < today) return null;
  const maxYear = Number(today.slice(0, 4)) + 2;
  if (iso.slice(0, 4) > String(maxYear)) return null;
  return iso;
}

function eventDateFromNote(note) {
  return note ? sanitizeEventDate(note.eventDate) : null;
}

function formatDaysUntil(eventDate, now = new Date()) {
  const iso = sanitizeEventDate(eventDate, now) || String(eventDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const days = calendarDaysAgo(iso, now);
  if (days == null) return "";
  if (days > 0) return `${days} days ago`;
  if (days === 0) return "today";
  const n = Math.abs(days);
  if (n === 1) return "tomorrow";
  if (n < 14) return `in ${n} days`;
  if (n < 60) {
    const weeks = Math.round(n / 7);
    return weeks === 1 ? "in 1 week" : `in ${weeks} weeks`;
  }
  const months = Math.round(n / 30);
  return months === 1 ? "in 1 month" : `in ${months} months`;
}

function upcomingRaceNotes(notes, now = new Date()) {
  const today = calendarDateInTz(now);
  const seen = new Set();
  const out = [];
  for (const note of Array.isArray(notes) ? notes : []) {
    const eventDate = eventDateFromNote(note);
    if (!eventDate || eventDate < today) continue;
    if (seen.has(eventDate)) continue;
    seen.add(eventDate);
    out.push({ ...note, eventDate });
  }
  out.sort((a, b) => String(a.eventDate).localeCompare(String(b.eventDate)));
  return out.slice(0, 3);
}

function sanitizeKind(value) {
  const kind = String(value || "").trim().toLowerCase();
  return NOTE_KINDS.includes(kind) ? kind : "life";
}

function sanitizeNote(raw, fallbackAt, now = new Date()) {
  if (!raw || typeof raw !== "object") return null;
  const text = clip(raw.text, MAX_NOTE_TEXT);
  if (!text) return null;
  let kind = sanitizeKind(raw.kind);
  const eventDate = sanitizeEventDate(raw.eventDate, now);
  if (eventDate && kind !== "race") kind = "race";
  if (kind === "race" && !eventDate) kind = "plan";
  return {
    text,
    kind,
    at: raw.at || fallbackAt || null,
    eventDate,
  };
}

function normalizeNoteText(text) {
  return clip(text, MAX_NOTE_TEXT).toLowerCase().replace(/\s+/g, " ");
}

function isNearDuplicate(text, notes) {
  const n = normalizeNoteText(text);
  if (!n) return true;
  return (notes || []).some((item) => {
    const o = normalizeNoteText(item?.text);
    if (!o) return false;
    if (o === n) return true;
    if (n.length >= 24 && (o.includes(n) || n.includes(o))) return true;
    return false;
  });
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9æøå]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

function ageDays(at, now) {
  const ms = Date.parse(at || "");
  if (!Number.isFinite(ms)) return 999;
  return Math.max(0, (now.getTime() - ms) / 86400000);
}

function recencyBoost(days) {
  if (days <= 1) return 3;
  if (days <= 3) return 1.5;
  if (days <= 7) return 0.5;
  if (days <= 14) return 0.2;
  return 0;
}

function keywordScore(noteText, query) {
  const hay = String(noteText || "").toLowerCase();
  const tokens = tokenize(query);
  if (!tokens.length) return 0;
  let score = 0;
  for (const token of tokens) {
    if (hay.includes(token)) score += 1;
  }
  return score;
}

function scoreNote(note, query, now) {
  const days = ageDays(note?.at, now);
  const keyword = keywordScore(note?.text, query);
  const recency = recencyBoost(days);
  if (keyword <= 0) {
    if (days > 2) return 0;
    const recent = recency * (note?.kind === "feeling" ? 1.2 : 0.6);
    return recent >= MIN_RETRIEVE_SCORE ? recent : 0;
  }
  return keyword * 2 + recency;
}

function retrieveRelevantNotes(notes, query, { limit = RETRIEVE_LIMIT, now = new Date(), minScore = MIN_RETRIEVE_SCORE } = {}) {
  const upcoming = upcomingRaceNotes(notes, now);
  const upcomingKeys = new Set(upcoming.map((note) => note.id || `${note.eventDate}:${note.text}`));
  const scored = (Array.isArray(notes) ? notes : [])
    .map((note) => ({ note, score: scoreNote(note, query, now) }))
    .filter((row) => {
      const key = row.note.id || `${row.note.eventDate || ""}:${row.note.text}`;
      return row.score >= minScore && !upcomingKeys.has(key);
    });
  scored.sort((a, b) => b.score - a.score || String(b.note.at || "").localeCompare(String(a.note.at || "")));
  const rest = scored.slice(0, limit).map((row) => row.note);
  return [...upcoming, ...rest];
}

function searchNotes(notes, query, { sinceDays, limit = SEARCH_LIMIT, now = new Date() } = {}) {
  const maxAge = Number.isFinite(Number(sinceDays)) ? Math.max(1, Number(sinceDays)) : null;
  const filtered = (Array.isArray(notes) ? notes : []).filter((note) => {
    if (maxAge == null) return true;
    return ageDays(note?.at, now) <= maxAge;
  });
  const scored = filtered
    .map((note) => {
      const keyword = keywordScore(note?.text, query);
      const days = ageDays(note?.at, now);
      const score = keyword > 0 ? keyword * 2 + recencyBoost(days) : recencyBoost(days) * 0.25;
      return { note, score, keyword };
    })
    .filter((row) => (maxAge != null ? row.score > 0 : row.keyword > 0));
  scored.sort((a, b) => b.score - a.score || String(b.note.at || "").localeCompare(String(a.note.at || "")));
  return scored.slice(0, limit).map((row) => row.note);
}

function formatNoteDate(at) {
  const iso = String(at || "");
  return iso.length >= 10 ? iso.slice(0, 10) : iso || "unknown date";
}

function formatNotesForPrompt(notes, now = new Date()) {
  const list = Array.isArray(notes) ? notes.filter((n) => n && n.text) : [];
  if (!list.length) return "";
  return list
    .map((note) => {
      const eventDate = eventDateFromNote(note);
      if (eventDate) {
        const until = formatDaysUntil(eventDate, now);
        const when = until ? `${eventDate} (${until})` : eventDate;
        return `- Race ${when}: ${note.text}`;
      }
      const age = formatNoteAge(note.at, now);
      const when = age ? `${formatNoteDate(note.at)} (${age})` : formatNoteDate(note.at);
      return `- ${when}: ${note.text}`;
    })
    .join("\n");
}

function shouldSkipExtract(userMessage) {
  const text = clip(userMessage, 4000);
  if (text.length < MIN_USER_MESSAGE_LEN) return true;
  const compact = text
    .toLowerCase()
    .replace(/[.!?]+$/g, "")
    .trim();
  return /^(ja|nej|no|yes|ok|okay|tak|thanks|thx|det stemmer|forkert|cool|nice)$/i.test(compact);
}

function buildExtractMessages({ userMessage, assistantText, coachSettings, recentNotes, timestamp }) {
  const recent = (Array.isArray(recentNotes) ? recentNotes : [])
    .slice(0, 12)
    .map((n) => {
      const event = n.eventDate ? ` eventDate=${n.eventDate}` : "";
      return `- ${formatNoteDate(n.at)}${event}: ${n.text}`;
    })
    .join("\n");

  const system = `You extract dated coaching episode notes from one Discord exchange.
Return JSON only: {"notes":[{"text":"one or two sentences","kind":"feeling|plan|preference_transient|life|race","eventDate":"YYYY-MM-DD or omit"}]}
Rules:
- 0–2 notes. Prefer none over noise, except upcoming races.
- Capture transient state: illness, fatigue, mood, skipped session, how a ride felt, one-off plans, life schedule that may change tomorrow.
- If the athlete names a race, event, or target date (a calendar date, "next Sunday", "om 2 uger", Zwift race, ZRL, klubmesterskab, etc.), add a kind "race" note. Resolve the date from Today into eventDate as YYYY-MM-DD. Text is the event name only. Do not invent dates. Skip if that eventDate is already in recent notes.
- Do not store standing goals (lose weight, stay in shape, win races, "get fitter") as notes. The coach cannot write Coach settings; skip those.
- kind feeling = illness/fatigue/mood/soreness that is not a lasting injury they want obeyed every session.
- Do NOT copy standing constraints already in Coach settings (rides/week, weekly slots, lasting injuries, standing goals, reply style).
- Do NOT invent facts. Do NOT store Strava numbers unless the athlete stated them in this exchange.
- Do not note that they asked a question or that the coach listed workouts.
- Deduplicate against recent notes; skip if already captured.
- Write notes in the athlete's language.`;

  const today = formatCoachToday(timestamp || new Date());
  const user = `${today.line}

## Coach settings (do not repeat)
${coachSettings || "(none)"}

## Recent notes (skip duplicates)
${recent || "(none)"}

## Athlete
${userMessage || ""}

## Coach reply
${assistantText || ""}`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

function parseExtractedNotes(rawText, fallbackAt) {
  const text = String(rawText || "").trim();
  if (!text) return [];
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        parsed = JSON.parse(text.slice(start, end + 1));
      } catch {
        parsed = null;
      }
    }
  }
  const rows = Array.isArray(parsed?.notes) ? parsed.notes : [];
  const out = [];
  for (const raw of rows) {
    const note = sanitizeNote(raw, fallbackAt);
    if (!note) continue;
    if (isNearDuplicate(note.text, out)) continue;
    if (note.eventDate && out.some((item) => item.eventDate === note.eventDate)) continue;
    out.push(note);
    if (out.length >= MAX_EXTRACT_NOTES) break;
  }
  return out;
}

module.exports = {
  NOTE_KINDS,
  MAX_NOTE_TEXT,
  MAX_NOTES_PER_ATHLETE,
  MAX_EXTRACT_NOTES,
  RETRIEVE_LIMIT,
  SEARCH_LIMIT,
  sanitizeNote,
  isNearDuplicate,
  retrieveRelevantNotes,
  searchNotes,
  formatNotesForPrompt,
  formatNoteDate,
  formatCoachToday,
  formatNoteAge,
  shouldSkipExtract,
  buildExtractMessages,
  parseExtractedNotes,
};
