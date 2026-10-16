/**
 * Display name for a ZwiftRacing phenotype.
 *
 * The public rider payload has changed shape. Current records use `label`
 * (`"puncheur"`). Older snapshots used `value`, and some callers stored the
 * name as a plain string. Scores are only a fallback when no name is present.
 */

const DISPLAY = {
  sprinter: "Sprinter",
  puncheur: "Puncheur",
  pursuiter: "Pursuiter",
  climber: "Climber",
  tt: "TT",
  "time trialist": "Time trialist",
  allrounder: "All-rounder",
  "all-rounder": "All-rounder",
  "all rounder": "All-rounder",
};

function named(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text || null;
}

function fromScores(scores) {
  if (!scores || typeof scores !== "object") return null;
  let bestName = null;
  let bestScore = -Infinity;
  for (const [name, score] of Object.entries(scores)) {
    const numeric = Number(score);
    if (!Number.isFinite(numeric) || numeric <= bestScore) continue;
    bestName = name;
    bestScore = numeric;
  }
  return bestName;
}

function phenotypeLabel(phenotype) {
  let raw = null;
  if (typeof phenotype === "string") raw = named(phenotype);
  else if (phenotype && typeof phenotype === "object") {
    raw = named(phenotype.label) || named(phenotype.value) || named(phenotype.name) || named(phenotype.type) || fromScores(phenotype.scores);
  }
  if (!raw) return null;
  const key = raw.toLowerCase();
  return DISPLAY[key] || raw.charAt(0).toUpperCase() + raw.slice(1);
}

module.exports = { phenotypeLabel };
