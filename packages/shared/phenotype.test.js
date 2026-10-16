const test = require("node:test");
const assert = require("node:assert/strict");
const { phenotypeLabel } = require("./phenotype");

test("reads the current ZwiftRacing label", () => {
  assert.equal(phenotypeLabel({
    version: 3,
    label: "puncheur",
    scores: { sprinter: 61, puncheur: 81.8 },
  }), "Puncheur");
});

test("still reads the older value field and a plain string", () => {
  assert.equal(phenotypeLabel({ value: "Climber" }), "Climber");
  assert.equal(phenotypeLabel("sprinter"), "Sprinter");
  assert.equal(phenotypeLabel({ label: "tt" }), "TT");
});

test("uses the strongest score only when no name is present", () => {
  assert.equal(phenotypeLabel({
    scores: { sprinter: 10, climber: 40, tt: 12 },
  }), "Climber");
});

test("returns null when the rider has no phenotype", () => {
  assert.equal(phenotypeLabel(null), null);
  assert.equal(phenotypeLabel({}), null);
  assert.equal(phenotypeLabel({ label: "  " }), null);
});
