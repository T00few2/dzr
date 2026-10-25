const test = require("node:test");
const assert = require("node:assert/strict");
const {
  coachSetupPointerText,
  coachSetupNudgeText,
  coachHowItWorksText,
  isCoachSetupOpen,
  coachSetupStep,
} = require("./coachHowItWorks");

const empty = { notesOptIn: false, weekly: [] };

test("setup stays open until notes, days and calendar are done or skipped", () => {
  assert.equal(isCoachSetupOpen(empty, { hasCalendarEntry: false }), true);
  assert.equal(
    isCoachSetupOpen(
      { notesOptIn: true, weekly: [{ sport: "cycling", days: [{ day: "mon" }] }] },
      { hasCalendarEntry: true }
    ),
    false
  );
  assert.equal(
    isCoachSetupOpen(
      {
        ...empty,
        onboardingNotesSkippedAt: "2026-10-25T12:00:00.000Z",
        onboardingWeeklySkippedAt: "2026-10-25T12:00:00.000Z",
        onboardingCalendarSkippedAt: "2026-10-25T12:00:00.000Z",
      },
      { hasCalendarEntry: false }
    ),
    false
  );
  assert.equal(
    isCoachSetupOpen({ ...empty, onboardingFinishedAt: "2026-10-25T12:00:00.000Z" }, { hasCalendarEntry: false }),
    false,
    "a finished setup does not reopen when notes are still off"
  );
  assert.equal(
    isCoachSetupOpen({ notesOptIn: true, weekly: [] }, { hasCalendarEntry: true }),
    true,
    "days are still open"
  );
});

test("setup asks for notes, then days, then the calendar", () => {
  assert.equal(coachSetupStep(empty, { hasCalendarEntry: false }), "notes");
  assert.equal(coachSetupStep({ notesOptIn: true, weekly: [] }, { hasCalendarEntry: false }), "days");
  assert.equal(
    coachSetupStep({ notesOptIn: true, weekly: [{ sport: "cycling" }] }, { hasCalendarEntry: false }),
    "calendar"
  );
  assert.equal(
    coachSetupStep({ notesOptIn: true, weekly: [{ sport: "cycling" }] }, { hasCalendarEntry: true }),
    "done"
  );
});

test("the connect DM points at the setup page and leaves the essay for questions", () => {
  const pointer = coachSetupPointerText();
  const nudge = coachSetupNudgeText();
  assert.match(pointer, /intervals\.icu er forbundet/);
  assert.match(pointer, /\/intervals\/connected/);
  assert.match(pointer, /Hvordan var min uge/);
  assert.equal(pointer.includes("Selve samtalen gemmes ikke"), false);
  assert.match(nudge, /\/intervals\/connected/);
  assert.match(coachHowItWorksText(), /Chat-noter/);
});
