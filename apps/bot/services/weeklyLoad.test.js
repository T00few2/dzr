const test = require("node:test");
const assert = require("node:assert/strict");

const { weekStart, sessionLoad, rollupWeeks, loadTrend, formatWeeklyLoadForPrompt } = require("./weeklyLoad");

const ride = (date, seconds, watts, extra = {}) => ({
  start_date: `${date}T10:00:00Z`,
  moving_time: seconds,
  average_watts: watts,
  distance_m: 30000,
  elevation_gain_m: 200,
  ...extra,
});

test("weeks start on Monday, and Sunday belongs to the week that just ended", () => {
  assert.equal(weekStart(new Date("2026-09-07T12:00:00Z")), "2026-09-07", "Monday");
  assert.equal(weekStart(new Date("2026-09-06T12:00:00Z")), "2026-08-31", "Sunday closes the prior week");
  assert.equal(weekStart(new Date("2026-09-09T12:00:00Z")), "2026-09-07", "midweek");
});

test("session load is TSS-shaped when power and FTP are known", () => {
  // One hour exactly at threshold is 100 by definition.
  const atThreshold = sessionLoad({ moving_time: 3600, average_watts: 250 }, 250);
  assert.equal(atThreshold.load, 100);
  assert.equal(atThreshold.estimated, false);

  // Half the power is a quarter of the load: intensity is squared.
  assert.equal(sessionLoad({ moving_time: 3600, average_watts: 125 }, 250).load, 25);
});

test("load falls back to duration when there is no power, and says so", () => {
  const noPower = sessionLoad({ moving_time: 3600 }, 250);
  assert.ok(noPower.load > 0);
  assert.equal(noPower.estimated, true, "must be flagged so the coach does not present it as measured");

  const noFtp = sessionLoad({ moving_time: 3600, average_watts: 200 }, null);
  assert.equal(noFtp.estimated, true);
});

test("activities group into the right weeks", () => {
  const weeks = rollupWeeks(
    [ride("2026-09-07", 3600, 250), ride("2026-09-09", 3600, 250), ride("2026-09-06", 3600, 250)],
    { ftp: 250, now: new Date("2026-09-10T12:00:00Z") }
  );
  assert.equal(weeks.length, 2);
  assert.equal(weeks[0].week, "2026-08-31");
  assert.equal(weeks[0].sessions, 1);
  assert.equal(weeks[1].week, "2026-09-07");
  assert.equal(weeks[1].sessions, 2);
  assert.equal(weeks[1].load, 200);
  assert.equal(weeks[1].hours, 2);
});

test("indoor sessions are counted separately", () => {
  const weeks = rollupWeeks(
    [
      ride("2026-09-07", 3600, 250, { sport_type: "VirtualRide" }),
      ride("2026-09-08", 3600, 250, { trainer: true }),
      ride("2026-09-09", 3600, 250, { sport_type: "Ride" }),
    ],
    { ftp: 250, now: new Date("2026-09-10T12:00:00Z") }
  );
  assert.equal(weeks[0].sessions, 3);
  assert.equal(weeks[0].indoorSessions, 2);
});

test("weeks outside the window are dropped", () => {
  const weeks = rollupWeeks([ride("2025-01-06", 3600, 250), ride("2026-09-07", 3600, 250)], {
    ftp: 250,
    weeks: 4,
    now: new Date("2026-09-10T12:00:00Z"),
  });
  assert.equal(weeks.length, 1);
  assert.equal(weeks[0].week, "2026-09-07");
});

test("ramp compares the latest week against the prior four", () => {
  const weekly = [
    { week: "2026-08-03", load: 100 },
    { week: "2026-08-10", load: 100 },
    { week: "2026-08-17", load: 100 },
    { week: "2026-08-24", load: 100 },
    { week: "2026-08-31", load: 150 },
  ];
  assert.equal(loadTrend(weekly).rampPercent, 50);
});

test("consecutive build weeks are counted, and a rest week resets them", () => {
  const building = [
    { week: "1", load: 100 },
    { week: "2", load: 120 },
    { week: "3", load: 140 },
    { week: "4", load: 160 },
  ];
  assert.equal(loadTrend(building).consecutiveBuildWeeks, 3);

  const withRest = [...building, { week: "5", load: 60 }];
  assert.equal(loadTrend(withRest).consecutiveBuildWeeks, 0, "an easy week breaks the streak");
});

test("weeks without a rest week is the number a coach acts on", () => {
  const noRest = [
    { week: "1", load: 100 },
    { week: "2", load: 105 },
    { week: "3", load: 110 },
    { week: "4", load: 108 },
    { week: "5", load: 112 },
  ];
  assert.ok(loadTrend(noRest).weeksWithoutRest >= 4);

  const rested = [
    { week: "1", load: 100 },
    { week: "2", load: 40 },
    { week: "3", load: 110 },
  ];
  assert.ok(rested.length && loadTrend(rested).weeksWithoutRest < 4);
});

test("trend is silent rather than wrong when there is too little history", () => {
  assert.deepEqual(loadTrend([]), { rampPercent: null, consecutiveBuildWeeks: 0, weeksWithoutRest: 0 });
  assert.equal(loadTrend([{ week: "1", load: 100 }]).rampPercent, null);
});

test("the prompt block states the trend, and flags estimated load", () => {
  const weekly = [
    { week: "2026-08-31", sessions: 4, hours: 5, load: 300, estimated: false, indoorSessions: 4 },
    { week: "2026-09-07", sessions: 5, hours: 6, load: 400, estimated: true, indoorSessions: 3 },
  ];
  const text = formatWeeklyLoadForPrompt(weekly, loadTrend(weekly));
  assert.match(text, /2026-09-07: 5 sessions, 6h, load 400/);
  assert.match(text, /indoor/);
  assert.match(text, /estimated from duration/, "the coach must know which numbers are approximate");
});

test("no history reads as a clear statement, not an empty block", () => {
  assert.equal(formatWeeklyLoadForPrompt([], null), "No weekly history yet.");
});
