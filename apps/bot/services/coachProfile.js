const DAY_ALIASES = {
  mon: "mon",
  monday: "mon",
  mandag: "mon",
  tue: "tue",
  tuesday: "tue",
  tirsdag: "tue",
  wed: "wed",
  wednesday: "wed",
  onsdag: "wed",
  thu: "thu",
  thursday: "thu",
  torsdag: "thu",
  fri: "fri",
  friday: "fri",
  fredag: "fri",
  sat: "sat",
  saturday: "sat",
  lordag: "sat",
  lørdag: "sat",
  sun: "sun",
  sunday: "sun",
  sondag: "sun",
  søndag: "sun",
};

const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABELS = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

function clip(value, max) {
  return String(value || "").trim().slice(0, max);
}

function uniqueStrings(list, maxItems = 12, maxLen = 40) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(list) ? list : []) {
    const value = clip(raw, maxLen).toLowerCase();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
    if (out.length >= maxItems) break;
  }
  return out;
}

function sanitizeRidesPerWeek(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "object") return null;
  const minRaw = value.min;
  const maxRaw = value.max;
  const min = minRaw == null || minRaw === "" ? null : Number(minRaw);
  const max = maxRaw == null || maxRaw === "" ? null : Number(maxRaw);
  const cleanMin = Number.isFinite(min) ? Math.max(0, Math.min(14, Math.round(min))) : null;
  const cleanMax = Number.isFinite(max) ? Math.max(0, Math.min(14, Math.round(max))) : null;
  if (cleanMin == null && cleanMax == null) return null;
  if (cleanMin != null && cleanMax != null && cleanMin > cleanMax) {
    return { min: cleanMax, max: cleanMin };
  }
  const out = {};
  if (cleanMin != null) out.min = cleanMin;
  if (cleanMax != null) out.max = cleanMax;
  return out;
}

function sanitizeSports(value) {
  return uniqueStrings(value, 12, 40);
}

function sanitizeDays(value) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(value) ? value : []) {
    const key = String(raw || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const day = DAY_ALIASES[key];
    if (!day || seen.has(day)) continue;
    seen.add(day);
    out.push(day);
  }
  return DAY_ORDER.filter((d) => out.includes(d));
}

function sanitizeWeekly(value) {
  const rows = [];
  const seen = new Set();
  for (const raw of Array.isArray(value) ? value : []) {
    if (!raw || typeof raw !== "object") continue;
    const sport = clip(raw.sport, 40).toLowerCase();
    const days = sanitizeDays(raw.days);
    if (!sport || !days.length) continue;
    const key = `${sport}:${days.join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ sport, days });
    if (rows.length >= 14) break;
  }
  return rows;
}

function newInjuryId() {
  return `inj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeInjury(raw) {
  if (!raw || typeof raw !== "object") return null;
  const text = clip(raw.text, 240);
  if (!text) return null;
  const status = String(raw.status || "active").toLowerCase() === "recovered" ? "recovered" : "active";
  const started = clip(raw.started, 40) || null;
  const id = clip(raw.id, 64) || newInjuryId();
  return { id, text, started, status };
}

function sanitizeInjuries(value) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(value) ? value : []) {
    const injury = sanitizeInjury(raw);
    if (!injury) continue;
    const key = injury.id || injury.text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(injury);
    if (out.length >= 12) break;
  }
  return out;
}

function sanitizeGoals(value) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(value) ? value : []) {
    const goal = clip(raw, 200);
    if (!goal) continue;
    const key = goal.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(goal);
    if (out.length >= 8) break;
  }
  return out;
}

const LENGTH_MAP = {
  short: "short",
  kort: "short",
  kortfattet: "short",
  brief: "short",
  concise: "short",
  normal: "normal",
  medium: "normal",
  standard: "normal",
  detailed: "detailed",
  lang: "detailed",
  long: "detailed",
  udforlig: "detailed",
  udførlig: "detailed",
};
const LANGUAGE_MAP = {
  da: "da",
  dk: "da",
  danish: "da",
  dansk: "da",
  en: "en",
  english: "en",
  engelsk: "en",
};
const TONE_MAP = {
  direct: "direct",
  direkte: "direct",
  encouraging: "encouraging",
  opmuntrende: "encouraging",
  casual: "casual",
  afslappet: "casual",
};

function emptyStyle() {
  return { length: null, language: null, tone: null, notes: "" };
}

function sanitizeStyle(value) {
  if (!value || typeof value !== "object") return emptyStyle();
  const lengthKey = String(value.length || "").trim().toLowerCase();
  const languageKey = String(value.language || "").trim().toLowerCase();
  const toneKey = String(value.tone || "").trim().toLowerCase();
  return {
    length: LENGTH_MAP[lengthKey] || null,
    language: LANGUAGE_MAP[languageKey] || null,
    tone: TONE_MAP[toneKey] || null,
    notes: clip(value.notes, 400),
  };
}

function formatStyle(style) {
  const parts = [];
  if (style?.length === "short") parts.push("keep replies SHORT (a few sentences or tight bullets; no long essays)");
  if (style?.length === "normal") parts.push("normal Discord length");
  if (style?.length === "detailed") parts.push("more detailed explanations are OK");
  if (style?.language === "da") parts.push("always reply in Danish");
  if (style?.language === "en") parts.push("always reply in English");
  if (style?.tone === "direct") parts.push("direct and to the point");
  if (style?.tone === "encouraging") parts.push("encouraging tone");
  if (style?.tone === "casual") parts.push("casual tone");
  if (style?.notes) parts.push(style.notes);
  return parts.join("; ");
}

function publicFields(data) {
  const src = data && typeof data === "object" ? data : {};
  return {
    ridesPerWeek: sanitizeRidesPerWeek(src.ridesPerWeek),
    sports: sanitizeSports(src.sports),
    weekly: sanitizeWeekly(src.weekly),
    injuries: sanitizeInjuries(src.injuries),
    goals: sanitizeGoals(src.goals),
    style: sanitizeStyle(src.style),
    notesOptIn: src.notesOptIn === true,
  };
}

function emptyProfile() {
  return {
    ridesPerWeek: null,
    sports: [],
    weekly: [],
    injuries: [],
    goals: [],
    style: emptyStyle(),
    notesOptIn: false,
  };
}

function defaultProfile() {
  return {
    ridesPerWeek: { min: 3, max: 4 },
    sports: ["cycling"],
    weekly: [],
    injuries: [],
    goals: [],
    style: { length: null, language: "da", tone: null, notes: "" },
    notesOptIn: false,
  };
}

function formatRidesPerWeek(rides) {
  if (!rides) return null;
  if (rides.min != null && rides.max != null) {
    return rides.min === rides.max ? `${rides.min} per week` : `${rides.min}–${rides.max} per week`;
  }
  if (rides.min != null) return `at least ${rides.min} per week`;
  if (rides.max != null) return `at most ${rides.max} per week`;
  return null;
}

function formatCoachProfileForPrompt(profile) {
  const data = publicFields(profile);
  const lines = [];
  const rides = formatRidesPerWeek(data.ridesPerWeek);
  if (rides) lines.push(`- Ride frequency: ${rides}. Obey this over a busy Strava week; do not infer a higher volume from recent activities.`);
  if (data.sports.length) lines.push(`- Sports: ${data.sports.join(", ")}`);
  if (data.weekly.length) {
    const weekly = data.weekly
      .map((row) => `${row.sport} on ${row.days.map((d) => DAY_LABELS[d] || d).join(", ")}`)
      .join("; ");
    lines.push(`- Fixed weekly slots: ${weekly}`);
  }
  if (data.injuries.length) {
    const injuries = data.injuries
      .map((inj) => {
        const when = inj.started ? `, started ${inj.started}` : "";
        return `${inj.text} (${inj.status}${when})`;
      })
      .join("; ");
    lines.push(`- Injuries/limits: ${injuries}`);
    if (data.injuries.some((inj) => inj.status === "active")) {
      lines.push("- Never prescribe through an active injury. Treat it as a hard constraint, not a diagnosis.");
    }
  }
  if (data.goals.length) {
    lines.push(`- Standing goals (slow-changing aims, not a calendar date): ${data.goals.join("; ")}`);
  }
  const styleText = formatStyle(data.style);
  if (styleText) lines.push(`- Coaching style (obey every reply): ${styleText}`);

  if (!lines.length) {
    return "No Coach settings stored yet.";
  }
  return lines.join("\n");
}

module.exports = {
  emptyProfile,
  defaultProfile,
  publicFields,
  formatCoachProfileForPrompt,
};
