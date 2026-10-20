const test = require("node:test");
const assert = require("node:assert/strict");

const {
  gradeColor,
  altitudeAt,
  gradeBins,
  stretchStats,
  niceTicks,
  profileBands,
  zoomWindows,
  zoomSegment,
} = require("./routeProfileGeometry");

// 0-1 km flat at 100 m, 1-2 km climbing 8% to 180 m, then a teleport back down to 100 m.
const profile = {
  raceKm: 2.2,
  distanceKm: [0, 1, 1.5, 2, 2.1, 2.2],
  altitudeM: [100, 100, 140, 180, 100, 100],
  segments: [
    { name: "The Wall", type: "climb", fromKm: 1, toKm: 2 },
    { name: "Banner", type: "sprint", fromKm: 0.4, toKm: 0.6 },
    { name: "Flat bit", type: "segment", fromKm: 0, toKm: 0.5 },
  ],
  climbs: [],
};

test("grade colours follow the site's bands", () => {
  assert.equal(gradeColor(2), "#3CB44A");
  assert.equal(gradeColor(5), "#2E6BFF");
  assert.equal(gradeColor(8), "#E10600");
  assert.equal(gradeColor(12), "#111111");
});

test("altitude is interpolated between samples and clamped at the ends", () => {
  assert.equal(altitudeAt(profile.distanceKm, profile.altitudeM, 1.25), 120);
  assert.equal(altitudeAt(profile.distanceKm, profile.altitudeM, -1), 100);
  assert.equal(altitudeAt(profile.distanceKm, profile.altitudeM, 9), 100);
});

test("bins over a steady climb all carry its gradient", () => {
  const bins = gradeBins(profile.distanceKm, profile.altitudeM, 1, 2);
  assert.ok(bins.length >= 5);
  for (const bin of bins) assert.ok(Math.abs(bin.grade - 8) < 1e-9);
  const stats = stretchStats(bins);
  assert.ok(Math.abs(stats.avgGrade - 8) < 1e-9);
  assert.ok(Math.abs(stats.gainM - 80) < 1e-9);
});

test("bins stay coarse on long climbs", () => {
  assert.ok(gradeBins([0, 20], [0, 1000], 0, 20, { maxBins: 40 }).length <= 40);
});

test("ticks are round and cover the range", () => {
  assert.deepEqual(niceTicks(0, 17.6, 10), [0, 2, 4, 6, 8, 10, 12, 14, 16]);
  assert.deepEqual(niceTicks(0, 1000, 5), [0, 200, 400, 600, 800, 1000]);
});

test("only climbs and sprints are banded", () => {
  assert.deepEqual(profileBands(profile.segments).map((b) => b.name), ["The Wall", "Banner"]);
});

test("without named climbs, each climb gets a padded close-up", () => {
  const [zoom] = zoomWindows(profile);
  assert.equal(zoom.title, "The Wall");
  assert.ok(Math.abs(zoom.fromKm - 0.85) < 1e-9);
  assert.ok(Math.abs(zoom.toKm - 2.08) < 1e-9);
});

test("climbs the site matched by name win over the automatic ones", () => {
  const named = { ...profile, climbs: [{ title: "Custom", fromKm: 0.2, toKm: 0.9, matched: true }, { title: "Missing", fromKm: 0, toKm: 0, matched: false }] };
  assert.deepEqual(zoomWindows(named).map((z) => z.title), ["Custom"]);
});

test("close-up stats use the climb itself, not the teleport after the banner", () => {
  const zoom = zoomWindows(profile)[0];
  const climb = zoomSegment(profile, zoom);
  assert.deepEqual([climb.fromKm, climb.toKm], [1, 2]);
  const stats = stretchStats(gradeBins(profile.distanceKm, profile.altitudeM, climb.fromKm, climb.toKm));
  assert.ok(Math.abs(stats.avgGrade - 8) < 1e-9);
});
