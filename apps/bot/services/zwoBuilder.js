/**
 * Build Zwift workout (.zwo) files.
 *
 * Power targets are FTP-relative fractions, which is the format's own convention and a genuinely
 * useful property here: Zwift scales them against whatever FTP the rider has set, so a generated
 * workout is correct even when our FTP estimate is not.
 *
 * Pure string building, no I/O, so it is unit tested. Names and descriptions originate from the
 * model, so everything interpolated into the XML is escaped — an unescaped ampersand in a workout
 * name produces a file Zwift silently refuses to load.
 */

const MAX_STEPS = 40;
const MAX_TOTAL_SECONDS = 6 * 3600;

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Clamp to a sane training range: 20% of FTP to 250%, i.e. easy spinning to a full sprint. */
function clampPower(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Number(Math.min(2.5, Math.max(0.2, n)).toFixed(3));
}

function clampDuration(value, fallback = 60) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(MAX_TOTAL_SECONDS, Math.max(5, n));
}

function stepXml(step) {
  const type = String(step?.type || "steady").toLowerCase();

  if (type === "warmup" || type === "cooldown") {
    const duration = clampDuration(step.duration, 600);
    const from = clampPower(step.powerFrom, type === "warmup" ? 0.45 : 0.65);
    const to = clampPower(step.powerTo, type === "warmup" ? 0.75 : 0.45);
    const tag = type === "warmup" ? "Warmup" : "Cooldown";
    return `    <${tag} Duration="${duration}" PowerLow="${from}" PowerHigh="${to}"/>`;
  }

  if (type === "intervals") {
    const repeat = Math.min(50, Math.max(1, Math.round(Number(step.repeat) || 1)));
    const onDuration = clampDuration(step.onDuration, 240);
    const offDuration = clampDuration(step.offDuration, 240);
    const onPower = clampPower(step.onPower, 1.05);
    const offPower = clampPower(step.offPower, 0.55);
    return `    <IntervalsT Repeat="${repeat}" OnDuration="${onDuration}" OffDuration="${offDuration}" OnPower="${onPower}" OffPower="${offPower}"/>`;
  }

  if (type === "freeride") {
    return `    <FreeRide Duration="${clampDuration(step.duration, 600)}" FlatRoad="1"/>`;
  }

  return `    <SteadyState Duration="${clampDuration(step.duration, 600)}" Power="${clampPower(step.power, 0.65)}"/>`;
}

/** Total seconds a workout will take, used for the filename and the DM summary. */
function workoutDuration(steps) {
  return (Array.isArray(steps) ? steps : []).reduce((total, step) => {
    const type = String(step?.type || "steady").toLowerCase();
    if (type === "intervals") {
      const repeat = Math.max(1, Math.round(Number(step.repeat) || 1));
      return total + repeat * (clampDuration(step.onDuration, 240) + clampDuration(step.offDuration, 240));
    }
    return total + clampDuration(step.duration, 600);
  }, 0);
}

/**
 * @param {{name: string, description?: string, steps: object[]}} spec
 * @returns {{xml: string, filename: string, durationSeconds: number}}
 */
function buildZwo(spec) {
  const steps = (Array.isArray(spec?.steps) ? spec.steps : []).slice(0, MAX_STEPS);
  if (!steps.length) throw new Error("A workout needs at least one step.");

  const name = String(spec?.name || "DZR Coach workout").trim().slice(0, 80);
  const description = String(spec?.description || "").trim().slice(0, 800);

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<workout_file>",
    "  <author>DZR Coach</author>",
    `  <name>${escapeXml(name)}</name>`,
    `  <description>${escapeXml(description)}</description>`,
    "  <sportType>bike</sportType>",
    "  <workout>",
    ...steps.map(stepXml),
    "  </workout>",
    "</workout_file>",
    "",
  ].join("\n");

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "workout";
  return { xml, filename: `${slug.slice(0, 48)}.zwo`, durationSeconds: workoutDuration(steps) };
}

/** Human-readable outline for the DM, so the session is legible without opening the file. */
function describeWorkout(steps) {
  return (Array.isArray(steps) ? steps : [])
    .map((step) => {
      const type = String(step?.type || "steady").toLowerCase();
      const pct = (p, fallback) => `${Math.round(clampPower(p, fallback) * 100)}%`;
      const mins = (s, fallback) => `${Math.round(clampDuration(s, fallback) / 60)} min`;
      if (type === "warmup") return `• Opvarmning ${mins(step.duration, 600)}`;
      if (type === "cooldown") return `• Nedkøling ${mins(step.duration, 600)}`;
      if (type === "intervals") {
        const repeat = Math.max(1, Math.round(Number(step.repeat) || 1));
        return `• ${repeat} × ${mins(step.onDuration, 240)} @ ${pct(step.onPower, 1.05)} FTP, ${mins(step.offDuration, 240)} pause`;
      }
      if (type === "freeride") return `• Frit tempo ${mins(step.duration, 600)}`;
      return `• ${mins(step.duration, 600)} @ ${pct(step.power, 0.65)} FTP`;
    })
    .join("\n");
}

module.exports = { buildZwo, describeWorkout, workoutDuration, escapeXml, MAX_STEPS };
