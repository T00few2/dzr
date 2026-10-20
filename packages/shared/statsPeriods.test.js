const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, readFileSync, writeFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const ts = require("typescript");

// Exercise the production TypeScript helpers with the existing Node test runner.
const outputDir = mkdtempSync(path.join(tmpdir(), "dzr-stats-tests-"));
test.after(() => rmSync(outputDir, { recursive: true, force: true }));
for (const name of ["statsPeriods", "statsSeries"]) {
  const source = readFileSync(path.join(__dirname, "../../app/lib", `${name}.ts`), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  });
  writeFileSync(path.join(outputDir, `${name}.js`), outputText);
}

const { StatsPeriod, STATS_PERIODS, parseStatsPeriod, getPeriodWindow } = require(path.join(outputDir, "statsPeriods.js"));
const { buildSnapshotSeries, buildActivitySeries } = require(path.join(outputDir, "statsSeries.js"));

function activity(date, amount) {
  return {
    date,
    messages: amount,
    reactions: amount * 2,
    voice: amount * 3,
    interactions: amount * 4,
    total: amount * 10,
  };
}

test("period selections use semantic values and invalid or legacy day counts default to 30d", () => {
  assert.deepEqual(STATS_PERIODS, ["30d", "90d", "1y", "3y", "all"]);
  for (const period of STATS_PERIODS) assert.equal(parseStatsPeriod(period), period);
  for (const value of [null, "", "unknown", "30", "90", "365", "1095", "0", 365]) {
    assert.equal(parseStatsPeriod(value), StatsPeriod.Last30Days);
  }
});

for (const [period, count, start] of [
  [StatsPeriod.Last30Days, 30, "2024-02-01"],
  [StatsPeriod.Last90Days, 90, "2023-12-03"],
]) {
  test(`${period} includes exactly ${count} UTC dates through today, across leap day and year boundaries`, () => {
    const window = getPeriodWindow(period, new Date("2024-03-01T23:59:59Z"));
    assert.deepEqual(window, { selection: period, granularity: "day", start, end: "2024-03-01" });
    assert.equal((Date.parse(window.end) - Date.parse(window.start)) / 86400000 + 1, count);
    const rows = [
      activity("2023-12-02", 1),
      activity(start, 2),
      activity("2024-02-29", 3),
      activity("2024-03-01", 4),
      activity("2024-03-02", 5),
    ];
    assert.deepEqual(buildSnapshotSeries(rows, window), rows.slice(1, 4));
    assert.deepEqual(buildActivitySeries(rows, window), rows.slice(1, 4));
  });
}

for (const [period, weeks, start] of [
  [StatsPeriod.LastYear, 53, "2024-01-01"],
  [StatsPeriod.LastThreeYears, 157, "2022-01-03"],
]) {
  test(`${period} covers exactly ${weeks} complete Monday–Sunday weeks across leap and calendar years`, () => {
    const window = getPeriodWindow(period, new Date("2025-01-06T00:00:00Z"));
    assert.deepEqual(window, { selection: period, granularity: "week", start, end: "2025-01-05" });
    assert.equal((Date.parse(window.end) - Date.parse(window.start)) / 86400000 + 1, weeks * 7);
    const series = buildSnapshotSeries([{ date: "2020-01-01", count: 100 }], window);
    assert.equal(series.length, weeks);
    assert.equal(series[0].weekStart, start);
    assert.equal(series.at(-1).date, "2025-01-05");
    assert.ok(series.every(row => row.count === 100 && row.date === row.weekEnd));
  });
}

test("a week becomes eligible at Monday midnight UTC, including when now has another offset", () => {
  const sunday = getPeriodWindow(StatsPeriod.LastYear, new Date("2026-10-18T23:59:59.999Z"));
  const monday = getPeriodWindow(StatsPeriod.LastYear, new Date("2026-10-19T02:00:00+02:00"));
  assert.equal(sunday.start, "2025-10-06");
  assert.equal(sunday.end, "2026-10-11");
  assert.equal(monday.start, "2025-10-13");
  assert.equal(monday.end, "2026-10-18");
});

test("all has no lower bound and still excludes the current week", () => {
  assert.deepEqual(getPeriodWindow(StatsPeriod.All, new Date("2026-10-21T12:00:00Z")), {
    selection: StatsPeriod.All,
    granularity: "week",
    start: null,
    end: "2026-10-18",
  });
});

test("weekly snapshots carry the latest count across sparse data without summing or mutating history", () => {
  const rows = Object.freeze([
    Object.freeze({ date: "2026-10-19", count: 999, active: 99 }),
    Object.freeze({ date: "2026-10-09", count: 112, active: 12 }),
    Object.freeze({ date: "2026-09-23", count: 100, active: 10 }),
    Object.freeze({ date: "2026-10-18", count: 130, active: 13 }),
  ]);
  const original = JSON.stringify(rows);
  const window = getPeriodWindow(StatsPeriod.All, new Date("2026-10-21T12:00:00Z"));
  assert.deepEqual(buildSnapshotSeries(rows, window), [
    { date: "2026-09-27", count: 100, active: 10, weekStart: "2026-09-21", weekEnd: "2026-09-27" },
    { date: "2026-10-04", count: 100, active: 10, weekStart: "2026-09-28", weekEnd: "2026-10-04" },
    { date: "2026-10-11", count: 112, active: 12, weekStart: "2026-10-05", weekEnd: "2026-10-11" },
    { date: "2026-10-18", count: 130, active: 13, weekStart: "2026-10-12", weekEnd: "2026-10-18" },
  ]);
  assert.equal(JSON.stringify(rows), original);
});

test("weekly snapshots plot the finished week of the first count and skip the current week", () => {
  const window = getPeriodWindow(StatsPeriod.LastYear, new Date("2026-10-19T12:00:00Z"));
  const week = { date: "2026-10-18", count: 5, weekStart: "2026-10-12", weekEnd: "2026-10-18" };
  assert.deepEqual(buildSnapshotSeries([{ date: "2026-10-12", count: 5 }], window), [week]);
  assert.deepEqual(buildSnapshotSeries([{ date: "2026-10-14", count: 5 }], window), [week]);
  assert.deepEqual(buildSnapshotSeries([{ date: "2026-10-18", count: 5 }], window), [week]);
  assert.deepEqual(buildSnapshotSeries([{ date: "2026-10-19", count: 5 }], window), []);
});

test("daily snapshots preserve observed values and sort dates without modifying the input", () => {
  const rows = Object.freeze([
    Object.freeze({ date: "2026-10-19", count: 15 }),
    Object.freeze({ date: "2026-10-01", count: 10 }),
  ]);
  const window = getPeriodWindow(StatsPeriod.Last30Days, new Date("2026-10-19T12:00:00Z"));
  assert.deepEqual(buildSnapshotSeries(rows, window), [rows[1], rows[0]]);
  assert.equal(rows[0].date, "2026-10-19");
});

test("weekly activity omits a partial opening week while snapshots keep that finished Sunday", () => {
  const rows = Object.freeze([
    activity("2026-10-19", 100),
    activity("2026-10-11", 4),
    activity("2026-09-23", 100),
    activity("2026-09-28", 1),
    activity("2026-10-04", 2),
    activity("2026-10-05", 3),
    activity("2026-10-18", 5),
  ].map(Object.freeze));
  const window = getPeriodWindow(StatsPeriod.All, new Date("2026-10-21T12:00:00Z"));
  const original = JSON.stringify(rows);
  const series = buildActivitySeries(rows, window);
  assert.deepEqual(series, [
    { ...activity("2026-10-04", 3), weekStart: "2026-09-28", weekEnd: "2026-10-04" },
    { ...activity("2026-10-11", 7), weekStart: "2026-10-05", weekEnd: "2026-10-11" },
    { ...activity("2026-10-18", 5), weekStart: "2026-10-12", weekEnd: "2026-10-18" },
  ]);
  const snapshotDates = buildSnapshotSeries(rows.map(row => ({ date: row.date, count: 5 })), window).map(row => row.date);
  assert.deepEqual(snapshotDates, ["2026-09-27", "2026-10-04", "2026-10-11", "2026-10-18"]);
  assert.deepEqual(series.map(row => row.date), snapshotDates.slice(1));
  assert.equal(JSON.stringify(rows), original);
});

test("weekly activity respects both selected boundaries and retains observed zero-activity weeks", () => {
  const window = getPeriodWindow(StatsPeriod.LastYear, new Date("2026-10-19T12:00:00Z"));
  const rows = [
    activity("2025-10-12", 100),
    activity("2025-10-13", 0),
    activity("2026-10-18", 2),
    activity("2026-10-19", 100),
  ];
  assert.deepEqual(buildActivitySeries(rows, window), [
    { ...activity("2025-10-19", 0), weekStart: "2025-10-13", weekEnd: "2025-10-19" },
    { ...activity("2026-10-18", 2), weekStart: "2026-10-12", weekEnd: "2026-10-18" },
  ]);
});

test("daily activity passes through values and order without weekly aggregation or mutation", () => {
  const rows = Object.freeze([
    Object.freeze(activity("2026-10-19", 2)),
    Object.freeze(activity("2026-10-18", 3)),
  ]);
  const window = getPeriodWindow(StatsPeriod.Last30Days, new Date("2026-10-19T12:00:00Z"));
  assert.deepEqual(buildActivitySeries(rows, window), rows);
});

test("empty histories produce no chart points for any selection", () => {
  for (const period of STATS_PERIODS) {
    const window = getPeriodWindow(period, new Date("2026-10-19T12:00:00Z"));
    assert.deepEqual(buildSnapshotSeries([], window), []);
    assert.deepEqual(buildActivitySeries([], window), []);
  }
});
