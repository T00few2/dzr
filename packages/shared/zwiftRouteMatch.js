/**
 * Pick one game-dictionary route for a name from Zwift Insider or a catalog.
 *
 * Apostrophes and a trailing + are ignored, so "Sukis Playground" matches
 * "Suki's Playground". An exact name wins. Otherwise a single world prefix
 * is accepted, so "Hilly Route" matches "Watopia Hilly Route" and not
 * "Hilly Route Reverse".
 */

function foldRouteName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/['’‘`]/g, "")
    .replace(/\+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function chooseZwiftRoute(hits, query) {
  const list = Array.isArray(hits) ? hits : [];
  const wanted = foldRouteName(query);
  if (!wanted) return null;
  const exact = list.filter((hit) => foldRouteName(hit?.name) === wanted);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;
  const prefixed = list.filter((hit) => {
    const name = foldRouteName(hit?.name);
    if (!name.endsWith(` ${wanted}`)) return false;
    const prefix = name.slice(0, name.length - wanted.length).trim();
    return prefix.length > 0 && !prefix.includes(" ");
  });
  return prefixed.length === 1 ? prefixed[0] : null;
}

module.exports = { chooseZwiftRoute, foldRouteName };
