const NOTE_KINDS = ["feeling", "plan", "preference_transient", "life"];
const MAX_NOTE_TEXT = 280;
const MAX_NOTES_PER_ATHLETE = 200;
const MAX_EXTRACT_NOTES = 2;
const RETRIEVE_LIMIT = 5;
const SEARCH_LIMIT = 8;
const MIN_USER_MESSAGE_LEN = 10;
const MIN_RETRIEVE_SCORE = 1;

const STOPWORDS = new Set([
  "jeg", "du", "vi", "de", "den", "det", "en", "et", "og", "i", "på", "til", "for", "med",
  "som", "at", "er", "var", "har", "hadde", "ikke", "kan", "skal", "vil", "min", "mit", "mine",
  "the", "a", "an", "to", "of", "in", "on", "for", "and", "or", "is", "was", "be", "my", "me",
  "you", "we", "it", "this", "that", "have", "had", "do", "did", "just", "om", "fra", "så",
]);

function clip(value, max) {
  return String(value || "").trim().slice(0, max);
}

function sanitizeKind(value) {
  const kind = String(value || "").trim().toLowerCase();
  return NOTE_KINDS.includes(kind) ? kind : "life";
}

function sanitizeNote(raw, fallbackAt) {
  if (!raw || typeof raw !== "object") return null;
  const text = clip(raw.text, MAX_NOTE_TEXT);
  if (!text) return null;
  return {
    text,
    kind: sanitizeKind(raw.kind),
    at: raw.at || fallbackAt || null,
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
  const scored = (Array.isArray(notes) ? notes : [])
    .map((note) => ({ note, score: scoreNote(note, query, now) }))
    .filter((row) => row.score >= minScore);
  scored.sort((a, b) => b.score - a.score || String(b.note.at || "").localeCompare(String(a.note.at || "")));
  return scored.slice(0, limit).map((row) => row.note);
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

function formatNotesForPrompt(notes) {
  const list = Array.isArray(notes) ? notes.filter((n) => n && n.text) : [];
  if (!list.length) return "";
  return list
    .map((note) => `- ${formatNoteDate(note.at)}: ${note.text}`)
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

function buildExtractMessages({ userMessage, assistantText, durableMemory, recentNotes, timestamp }) {
  const recent = (Array.isArray(recentNotes) ? recentNotes : [])
    .slice(0, 12)
    .map((n) => `- ${formatNoteDate(n.at)}: ${n.text}`)
    .join("\n");

  const system = `You extract dated coaching episode notes from one Discord exchange.
Return JSON only: {"notes":[{"text":"one or two sentences","kind":"feeling|plan|preference_transient|life"}]}
Rules:
- 0–2 notes. Prefer none over noise.
- Capture transient state: illness, fatigue, mood, skipped session, how a ride felt, one-off plans, life schedule that may change tomorrow.
- kind feeling = illness/fatigue/mood/soreness that is not a lasting injury they want obeyed every session.
- Do NOT copy standing constraints already in durable memory (rides/week, weekly slots, lasting injuries, season goals, reply style).
- Do NOT invent facts. Do NOT store Strava numbers unless the athlete stated them in this exchange.
- Do not note that they asked a question or that the coach listed workouts.
- Deduplicate against recent notes; skip if already captured.
- Write notes in the athlete's language.`;

  const user = `Time: ${timestamp || new Date().toISOString()}

## Durable memory (do not repeat)
${durableMemory || "(none)"}

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
  shouldSkipExtract,
  buildExtractMessages,
  parseExtractedNotes,
};
