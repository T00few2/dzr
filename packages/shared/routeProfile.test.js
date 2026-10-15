const test = require("node:test")
const assert = require("node:assert")
const { parseFinish, buildRaceProfile, raceDistanceKm, profileImageSrc, mergePositionedSegments, prepareLap, shiftProfileSegments } = require("./routeProfile")

test("an After Party finish names the segment and the pass", () => {
  assert.deepStrictEqual(parseFinish("Banner on Petit KOM Reverse"), { pass: 1, name: "Petit KOM Reverse" })
  assert.deepStrictEqual(parseFinish("Banner second time on Governor St. Climb"), {
    pass: 2,
    name: "Governor St. Climb",
  })
  assert.deepStrictEqual(parseFinish("Blue banner fourth time on Libby Hill"), { pass: 4, name: "Libby Hill" })
  assert.deepStrictEqual(parseFinish("Blue banner seventh time on top of Mech Isle Climb"), {
    pass: 7,
    name: "Mech Isle Climb",
  })
  assert.deepStrictEqual(parseFinish("New York KOM Banner"), { pass: 1, name: "New York KOM" })
})

test("a whole-number lap count uses the route length, and 1+ uses the distance", () => {
  assert.strictEqual(raceDistanceKm(9, "2", "50"), 18)
  assert.strictEqual(raceDistanceKm(9, "1+", "36.7"), 36.7)
})

test("the second pass of a climb is on the next lap", () => {
  const profile = buildRaceProfile({
    distanceM: [0, 5000, 9000],
    altitudeM: [10, 40, 12],
    segments: [{ name: "Libby Hill", type: "climb", fromKm: 7, toKm: 8.2, direction: "forward" }],
    raceKm: 18,
    finishText: "Blue banner second time on Libby Hill",
    climbNames: ["Libby Hill"],
  })
  assert.strictEqual(profile.finish.matched, true)
  assert.ok(profile.finish.fromKm > 9)
  assert.strictEqual(profile.climbs[0].matched, true)
  assert.ok(profile.climbs[0].fromKm < 9)
})

test("sprint laps follow each time the segment is crossed", () => {
  const profile = buildRaceProfile({
    distanceM: [0, 10000],
    altitudeM: [0, 10],
    segments: [{ name: "Country Sprint", type: "sprint", fromKm: 2, toKm: 2.3, direction: "forward" }],
    raceKm: 30,
    finishText: "",
    climbNames: [],
  })
  assert.deepStrictEqual(profile.sprints, [{ name: "Country Sprint", laps: "1,2,3" }])
})

test("ZwiftPower names match the segment on the route", () => {
  const profile = buildRaceProfile({
    distanceM: [0, 16200],
    altitudeM: [40, 40],
    segments: [
      { name: "Richmond KOM", type: "climb", fromKm: 12, toKm: 12.6, direction: "forward" },
      { name: "Titans Grove KOM Rev.", type: "climb", fromKm: 4, toKm: 5.2, direction: "reverse" },
    ],
    raceKm: 32.4,
    finishText: "Banner second time on Governor St. Climb",
    climbNames: ["Libby Hill", "Titans Groove KOM Reverse"],
  })
  assert.strictEqual(profile.finish.matched, true)
  assert.ok(profile.finish.fromKm > 16)
  assert.strictEqual(profile.climbs[0].matched, true)
  assert.strictEqual(profile.climbs[1].matched, true)
})

test("Sauce positions fill gaps and leave an existing band in place", () => {
  const merged = mergePositionedSegments(
    [{ name: "Richmond Sprint", type: "sprint", fromKm: 3.7, toKm: 3.9, direction: "forward" }],
    [
      { name: "Richmond Sprint", type: "sprint", fromKm: 3.74, toKm: 3.97, direction: "forward" },
      { name: "Country Sprint", type: "sprint", fromKm: 13.995, toKm: 14.142, direction: "forward" },
    ]
  )
  assert.deepStrictEqual(merged.map((segment) => segment.name), ["Richmond Sprint", "Country Sprint"])
  assert.strictEqual(merged[0].fromKm, 3.7)
})

test("a lead-in in the elevation stream is removed from the segment marks", () => {
  const lap = prepareLap([0, 497, 831, 1731, 46103], [5, 5, 7, 58, 144], 0.497, 45.753)
  assert.ok(lap.leadInKm > 0.4)
  const shifted = shiftProfileSegments(
    [{ name: "Zwift KOM", type: "climb", fromKm: 0.831, toKm: 1.731, direction: "forward" }],
    lap.leadInKm
  )
  assert.ok(Math.abs(shifted[0].fromKm - 0.334) < 0.01)
  assert.ok(shifted[0].toKm < 1.3)
})

test("the existing profile picture path stays the same", () => {
  assert.strictEqual(
    profileImageSrc("after-party", "Itza Climb Finish"),
    "/dzr-after-party/itza-climb-finish/Itza-Climb-Finish-profile.png"
  )
})
