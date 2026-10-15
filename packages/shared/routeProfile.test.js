const test = require("node:test")
const assert = require("node:assert")
const { parseFinish, buildRaceProfile, raceDistanceKm, profileImageSrc } = require("./routeProfile")

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

test("the existing profile picture path stays the same", () => {
  assert.strictEqual(
    profileImageSrc("after-party", "Itza Climb Finish"),
    "/dzr-after-party/itza-climb-finish/Itza-Climb-Finish-profile.png"
  )
})
