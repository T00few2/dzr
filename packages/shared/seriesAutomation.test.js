const test = require("node:test");
const assert = require("node:assert");

const { routePhase, routeLine, sprintLine, categoryLine } = require("./seriesAutomation");

const previousStart = "2026-10-22T15:15:00.000Z";
const nextDate = "2026-10-29";

test("route checks start 24 hours after the previous race and stop on race day", () => {
  const before = routePhase(new Date("2026-10-23T08:00:00.000Z"), previousStart, nextDate);
  assert.strictEqual(before.phase, "before");
  assert.strictEqual(before.checksFrom.toISOString(), "2026-10-23T15:15:00.000Z");

  const open = routePhase(new Date("2026-10-23T16:00:00.000Z"), previousStart, nextDate);
  assert.strictEqual(open.phase, "open");

  const closed = routePhase(new Date("2026-10-29T06:00:00.000Z"), previousStart, nextDate);
  assert.strictEqual(closed.phase, "closed");
});

test("route line follows applied, waiting, and the check time", () => {
  const now = new Date("2026-10-23T16:00:00.000Z");
  assert.match(routeLine({ label: "Thursday October 29", route: "Queens Highway", saved: true, now, previousStart, nextDate }), /Applied\.$/);
  assert.match(
    routeLine({ label: "Thursday October 29", route: "Queens Highway", saved: false, now, previousStart, nextDate }),
    /Waiting for the Zwift event\.$/
  );
  assert.match(
    routeLine({
      label: "Thursday October 29",
      route: "Queens Highway",
      saved: false,
      now: new Date("2026-10-23T08:00:00.000Z"),
      previousStart,
      nextDate,
    }),
    /Checks from /
  );
});

test("sprints stay quiet until 24 hours after Apply", () => {
  const publishedAt = "2026-10-23T16:00:00.000Z";
  assert.strictEqual(sprintLine({ set: true, publishedAt, now: new Date("2026-10-24T16:00:00.000Z") }), "Sprints: set.");
  assert.match(sprintLine({ set: false, publishedAt, now: new Date("2026-10-24T15:00:00.000Z") }), /^Sprints: not due yet\. From /);
  assert.strictEqual(sprintLine({ set: false, publishedAt, now: new Date("2026-10-24T16:30:00.000Z") }), "Sprints: waiting.");
});

test("categories run from 1.5 hours after the start until 4 hours", () => {
  const start = "2026-10-25T12:45:00.000Z";
  assert.match(categoryLine({ checked: false, start, now: new Date("2026-10-25T13:00:00.000Z") }), /^Categories: not due yet\. From /);
  assert.strictEqual(categoryLine({ checked: false, start, now: new Date("2026-10-25T14:30:00.000Z") }), "Categories: waiting.");
  assert.strictEqual(categoryLine({ checked: false, start, now: new Date("2026-10-25T17:00:00.000Z") }), "Categories: not checked.");
  assert.strictEqual(categoryLine({ checked: true, start, now: new Date("2026-10-25T17:00:00.000Z") }), "Categories: checked.");
});
