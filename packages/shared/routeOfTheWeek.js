/**
 * The route of the week from a Zwift Insider weekly-challenges calendar page.
 *
 * Each day lists a climb (/portal/) and a route (/route/). Only the route is used.
 * The reward suffix, such as "(250 XP)", is not part of the Zwift route name.
 */

const MONTHS = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

function pad(value) {
  return String(value).padStart(2, "0");
}

function routeTitle(raw) {
  return String(raw || "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();
}

function routeOfTheWeek(html, isoDate) {
  const page = String(html || "");
  const wanted = String(isoDate || "");
  const month = page.match(/<td class="calendar-month">\s*([A-Za-z]+)\s+(\d{4})\s*<\/td>/i);
  if (!month) return null;
  const monthNumber = MONTHS[month[1].toLowerCase()];
  const year = Number(month[2]);
  if (!monthNumber || !wanted) return null;

  for (const cell of page.split(/<td\b/i)) {
    const dayMatch = cell.match(/class="day-number[^"]*">\s*(\d+)\s*</);
    if (!dayMatch) continue;
    const date = `${year}-${pad(monthNumber)}-${pad(Number(dayMatch[1]))}`;
    if (date !== wanted) continue;
    const route = cell.match(
      /href="(https:\/\/zwiftinsider\.com\/route\/[^"]+)"[\s\S]*?<span class="spiffy-title">([^<]+)<\/span>/i
    );
    if (!route) return null;
    const name = routeTitle(route[2]);
    if (!name) return null;
    return { date, name, url: route[1] };
  }
  return null;
}

module.exports = { routeOfTheWeek };
