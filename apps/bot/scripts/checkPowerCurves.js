/**
 * Live check of the coach's get_power_curves against intervals.icu, for one connected member.
 *
 *   node --env-file=../../.env.local scripts/checkPowerCurves.js <discordId> [oldest newest]
 *
 * Compares the given window (default January–February this year) with the last 28 days.
 * Read-only: it only GETs that member's curves.
 */
const intervals = require("../services/intervalsService");

(async () => {
  const [discordId, oldest, newest] = process.argv.slice(2);
  if (!discordId) {
    console.error("Usage: node --env-file=../../.env.local scripts/checkPowerCurves.js <discordId> [oldest newest]");
    process.exit(2);
  }
  const year = intervals.copenhagenDate(0).slice(0, 4);
  const result = await intervals.getPowerCurves(discordId, {
    windows: [{ oldest: oldest || `${year}-01-01`, newest: newest || `${year}-02-28` }, { days: 28 }],
  });
  console.log(JSON.stringify(result, null, 2));
  const ok = result.success && result.curves.some((c) => c.points.length);
  console.log(ok ? "\nOK: curves came back." : "\nFAILED: no curve points.");
  process.exit(ok ? 0 : 1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
