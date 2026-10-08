const test = require("node:test");
const assert = require("node:assert/strict");

const {
  discoverActivityFields,
  discoverStreamSummaries,
} = require("./activityDataDiscovery");

test("discovers sparse numeric activity data without forwarding text or identifiers", () => {
  const result = discoverActivityFields({
    id: "i123",
    icu_athlete_id: 99,
    name: "Private ride name",
    description: "Personal note",
    average_watts: 247.4567891,
    indoor: true,
    empty: null,
    power_model: { w_prime: 18432, label: "private" },
    zone_times: [10, 20, null, 30],
    start_latlng: [55.6, 12.5],
  });

  assert.equal(result.values.average_watts, 247.4568);
  assert.equal(result.values.indoor, true);
  assert.equal(result.values["power_model.w_prime"], 18432);
  assert.deepEqual(result.values.zone_times, {
    samples: 3,
    start: 10,
    end: 30,
    average: 20,
    min: 10,
    max: 30,
  });
  assert.ok(!("id" in result.values));
  assert.ok(!("icu_athlete_id" in result.values));
  assert.ok(!("name" in result.values));
  assert.ok(!("description" in result.values));
  assert.ok(!("start_latlng" in result.values));
});

test("bounds discovered activity fields and reports truncation", () => {
  const result = discoverActivityFields({ a: 1, b: 2, c: 3 }, { maxFields: 2 });
  assert.equal(Object.keys(result.values).length, 2);
  assert.equal(result.truncated, true);
});

test("summarizes unfamiliar numeric streams while omitting empty and normalized streams", () => {
  const result = discoverStreamSummaries(
    [
      { type: "time", data: [0, 10, 20, 30] },
      { type: "watts", data: [100, 200, 300, 400], units: "W" },
      { type: "left_right_balance", data: [48, 49, 51, 52], units: "%" },
      { type: "new_sensor", data: [null, "", 1.25, 2.75] },
      { type: "labels", data: ["a", "b"] },
      { type: "latlng", data: [[55, 12], [56, 13]] },
    ],
    {
      time: [0, 10, 20, 30],
      exclude: ["watts"],
      fromSeconds: 10,
      toSeconds: 30,
    }
  );

  assert.deepEqual(result.summaries.left_right_balance, {
    samples: 2,
    start: 49,
    end: 51,
    average: 50,
    min: 49,
    max: 51,
    unit: "%",
  });
  assert.deepEqual(result.summaries.new_sensor, {
    samples: 1,
    start: 1.25,
    end: 1.25,
    average: 1.25,
    min: 1.25,
    max: 1.25,
  });
  assert.ok(!("watts" in result.summaries));
  assert.ok(!("labels" in result.summaries));
  assert.deepEqual(result.redacted, ["latlng"]);
  assert.deepEqual(result.available, [
    "labels",
    "latlng",
    "left_right_balance",
    "new_sensor",
    "time",
    "watts",
  ]);
});
