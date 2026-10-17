/**
 * Weekly route rotation for DZR After Party (Thursdays) and The Zwifty Fifty (Sundays).
 *
 * Dates are YYYY-MM-DD. An override replaces one date and leaves the weeks around it
 * on the catalog order. The public site does not read this directly: it shows the route
 * saved with an event id.
 */

function parseIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function addDays(iso, days) {
  const start = parseIsoDate(iso);
  if (!start) throw new Error("Date must be YYYY-MM-DD");
  const [year, month, day] = start.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + Number(days)));
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${mm}-${dd}`;
}

function weeksBetween(anchor, date) {
  const start = parseIsoDate(anchor);
  const end = parseIsoDate(date);
  if (!start || !end) throw new Error("Date must be YYYY-MM-DD");
  const [ay, am, ad] = start.split("-").map(Number);
  const [by, bm, bd] = end.split("-").map(Number);
  const ms = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad);
  return Math.round(ms / (7 * 24 * 60 * 60 * 1000));
}

function routeForDate(routes, anchorDate, anchorIndex, overrides, date) {
  const list = Array.isArray(routes) ? routes : [];
  if (!list.length) throw new Error("Rotation has no routes");
  const iso = parseIsoDate(date);
  if (!iso) throw new Error("Date must be YYYY-MM-DD");
  const override = overrides && overrides[iso];
  if (override) return String(override);
  const index = (Number(anchorIndex) + weeksBetween(anchorDate, iso)) % list.length;
  return list[(index + list.length) % list.length];
}

function listSeriesDates(anchorDate, eventDates, count) {
  const published = (Array.isArray(eventDates) ? eventDates : []).filter((date) => parseIsoDate(date)).sort();
  const start = published.length ? published[published.length - 1] : parseIsoDate(anchorDate);
  if (!start) throw new Error("Date must be YYYY-MM-DD");
  const total = Number(count) > 0 ? Number(count) : 6;
  const dates = [];
  for (let i = 0; i < total; i += 1) dates.push(addDays(start, i * 7));
  return dates;
}

function displayDate(iso) {
  const start = parseIsoDate(iso);
  if (!start) throw new Error("Date must be YYYY-MM-DD");
  const [year, month, day] = start.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  })
    .format(new Date(Date.UTC(year, month - 1, day, 12)))
    .replace(",", "");
}

function copenhagenDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/Copenhagen",
  }).format(date);
}

function parseSheetDate(value) {
  if (value instanceof Date) return copenhagenDate(value);
  const text = String(value ?? "").trim();
  if (!text) return null;
  const isoPrefix = parseIsoDate(text.slice(0, 10));
  if (isoPrefix && text.slice(0, 10) === isoPrefix) return isoPrefix;
  const dmy = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(text);
  if (dmy && Number(dmy[1]) > 12) {
    const day = dmy[1].padStart(2, "0");
    const month = dmy[2].padStart(2, "0");
    return parseIsoDate(`${dmy[3]}-${month}-${day}`);
  }
  const parsed = copenhagenDate(text);
  if (parsed) return parsed;
  if (!dmy) return null;
  const day = dmy[1].padStart(2, "0");
  const month = dmy[2].padStart(2, "0");
  return parseIsoDate(`${dmy[3]}-${month}-${day}`);
}

function usesLapCount(lapsText) {
  return /^\d+$/.test(String(lapsText ?? "").trim());
}

function courseLength(lapsText, kmText) {
  const laps = String(lapsText ?? "").trim();
  if (usesLapCount(laps)) {
    const count = Number(laps);
    if (count <= 0) return null;
    return { laps: count };
  }
  const km = Number(String(kmText ?? "").trim().replace(",", "."));
  if (!(km > 0)) return null;
  return { distanceMeters: Math.round(km * 1000) };
}

module.exports = {
  parseIsoDate,
  addDays,
  weeksBetween,
  routeForDate,
  listSeriesDates,
  displayDate,
  parseSheetDate,
  courseLength,
  usesLapCount,
};
