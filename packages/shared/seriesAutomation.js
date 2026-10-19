/**
 * When the weekly series jobs are allowed to run, and the lines shown on /admin/events.
 * Dates are YYYY-MM-DD. Instants are real timestamps. The clock on the page is Copenhagen.
 */

function copenhagenDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/Copenhagen",
  }).format(date);
}

function hoursAfter(value, hours) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() + Number(hours) * 60 * 60 * 1000);
}

function formatWhen(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Copenhagen",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function routePhase(now, previousStart, nextDate) {
  const checksFrom = hoursAfter(previousStart, 24);
  if (!checksFrom) return { phase: "unknown", checksFrom: null };
  const today = copenhagenDay(now);
  if (today && nextDate && today >= nextDate) return { phase: "closed", checksFrom };
  if (now < checksFrom) return { phase: "before", checksFrom };
  return { phase: "open", checksFrom };
}

function routeLine({ label, route, saved, now, previousStart, nextDate }) {
  const title = `Route: ${label}, ${route}.`;
  if (saved) return `${title} Applied.`;
  const phase = routePhase(now, previousStart, nextDate);
  if (phase.phase === "before" && phase.checksFrom) return `${title} Checks from ${formatWhen(phase.checksFrom)}.`;
  if (phase.phase === "open") return `${title} Waiting for the Zwift event.`;
  if (phase.phase === "closed") return `${title} Not applied.`;
  return `${title} Checks once the previous start time is known.`;
}

function sprintLine({ set, publishedAt, now }) {
  if (set) return "Sprints: set.";
  const due = publishedAt ? hoursAfter(publishedAt, 24) : null;
  if (due && now < due) return `Sprints: not due yet. From ${formatWhen(due)}.`;
  if (due) return "Sprints: waiting.";
  return "Sprints: not due yet.";
}

function categoryLine({ checked, start, now }) {
  if (checked) return "Categories: checked.";
  const from = start ? hoursAfter(start, 1.5) : null;
  const to = start ? hoursAfter(start, 4) : null;
  if (!from || !to) return "Categories: not due yet.";
  if (now < from) return `Categories: not due yet. From ${formatWhen(from)} to ${formatWhen(to)}.`;
  if (now < to) return "Categories: waiting.";
  return "Categories: not checked.";
}

module.exports = {
  copenhagenDay,
  hoursAfter,
  formatWhen,
  routePhase,
  routeLine,
  sprintLine,
  categoryLine,
};
