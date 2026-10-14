const test = require("node:test");
const assert = require("node:assert");

const { routeOfTheWeek } = require("./routeOfTheWeek");

const HTML = `
<td class="calendar-month">October 2026</td>
<td class="spiffy-day-19 day-with-date"><span class="day-number">19</span>
  <a href="https://zwiftinsider.com/portal/cote-de-pike/"><span class="spiffy-title">Cote de Pike (15k Drops)</span></a>
  <a href="https://zwiftinsider.com/route/hilly-route/"><span class="spiffy-title">Hilly Route (15k Drops)</span></a>
</td>
<td class="spiffy-day-3 weekend day-with-date"><span class="day-number weekend">3</span>
  <a href="https://zwiftinsider.com/portal/col-du-rosier/"><span class="spiffy-title">Col du Rosier (250 XP)</span></a>
  <a href="https://zwiftinsider.com/route/beach-island-loop/"><span class="spiffy-title">Beach Island Loop (250 XP)</span></a>
</td>
`;

test("uses the route link for that date and drops the reward suffix", () => {
  assert.deepStrictEqual(routeOfTheWeek(HTML, "2026-10-19"), {
    date: "2026-10-19",
    name: "Hilly Route",
    url: "https://zwiftinsider.com/route/hilly-route/",
  });
});

test("reads a weekend cell", () => {
  assert.strictEqual(routeOfTheWeek(HTML, "2026-10-03").name, "Beach Island Loop");
});

test("returns null when that date is not on the calendar", () => {
  assert.strictEqual(routeOfTheWeek(HTML, "2026-11-02"), null);
});
