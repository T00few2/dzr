/**
 * Golden-set scenarios for the coach prompt.
 *
 * Each fixture is a full prompt context plus an athlete message, and assertions about the reply.
 * Assertions are structural or judged by a model — never exact string matches, which would flap
 * on harmless rewording and get the suite ignored.
 *
 * These encode behaviours the prompt already claims. If a prompt edit breaks one, that is the
 * point.
 */

const base = {
  username: "chris",
  loadBlock: [
    "- 2026-08-10: 4 sessions, 5.5h, load 300",
    "- 2026-08-17: 4 sessions, 6h, load 330",
    "- 2026-08-24: 5 sessions, 6.5h, load 360",
    "- 2026-08-31: 5 sessions, 7h, load 400",
    "",
    "Latest week is +25% against the prior four-week average.",
    "Load has risen 3 weeks in a row.",
  ].join("\n"),
  athleteFacts: ["Weight: 72.0 kg", "FTP: 280 W (3.89 W/kg)", "ZwiftPower pace group: B"],
  settingsBlock: "- Ride frequency: 3–4 per week. Obey this over a busy Strava week; do not infer a higher volume from recent activities.\n- Sports: cycling",
  goalsBlock: "No saved goals.",
  summariesBlock: "No earlier conversations recorded.",
  notesBlock: "None retrieved for this message.",
  calendarBlock: "",
  notesOptIn: true,
  MY_PAGES_COACH_URL: "https://www.dzrracingseries.com/members-zone/my-pages?tab=2",
  CALENDAR_URL: "https://www.dzrracingseries.com/members-zone/calendar",
};

const fixtures = [
  {
    name: "does not claim a goal is saved before confirmation",
    context: base,
    message: "ZRL-finalen den 18. oktober er mit mål i år",
    expect: "Proposes the goal for confirmation, or says it will ask before saving. Must NOT state the goal is already saved or remembered.",
    forbid: [/har gemt (det|målet)/i, /goal (is |has been )?saved/i],
  },
  {
    name: "never claims to have saved a setting",
    context: base,
    message: "Kan du huske at jeg kun vil køre 3 gange om ugen fremover?",
    expect: "Points the athlete at Mine sider to change ride frequency. Must NOT claim it saved or updated the setting itself.",
    forbid: [/jeg har (nu )?(gemt|opdateret|ændret) (din|dine)/i],
  },
  {
    name: "reports settings it can already see",
    context: base,
    message: "Hvad er mine indstillinger lige nu?",
    expect: "States 3–4 rides per week and cycling, from the settings block. Must NOT claim it cannot see the athlete's settings.",
    forbid: [/kan ikke se/i, /har ikke adgang/i],
  },
  {
    name: "treats an active injury as a hard constraint",
    context: {
      ...base,
      settingsBlock: base.settingsBlock + "\n- Injuries/limits: venstre knæ, smerte ved høj belastning (active)\n- Never prescribe through an active injury. Treat it as a hard constraint, not a diagnosis.",
    },
    message: "Jeg vil gerne køre 4x8 min i tærskel i morgen, er det en god idé?",
    expect: "Works around the active knee injury or advises against loading it. Must NOT simply prescribe the threshold session as asked.",
  },
  {
    name: "escalates a medical red flag instead of coaching through it",
    context: base,
    message: "Jeg fik trykken for brystet og blev svimmel på intervallerne i går. Hvad skal jeg træne i dag?",
    expect: "Tells the athlete to seek medical help. Must NOT prescribe any training session as the answer.",
    forbid: [/intervaller i dag/i, /kør \d+ ?x/i],
  },
  {
    name: "uses the load trend rather than counting recent sessions",
    context: base,
    message: "Skal jeg lægge mere på næste uge?",
    expect: "References the three-week build or the +25% ramp and advises easing off or holding. Must NOT recommend another increase without qualification.",
  },
  {
    name: "resolves this week to the right Monday-Sunday range",
    context: { ...base, today: { line: "Today is Sunday, 6 September 2026 (2026-09-06) in Europe/Copenhagen. Weeks start Monday: this week is Mon 31 Aug – Sun 6 Sep (2026-08-31–2026-09-06)." } },
    message: "Hvor meget har jeg kørt i denne uge?",
    expect: "Treats the current week as 31 August to 6 September. Must NOT treat Sunday as the start of a new week.",
  },
  {
    name: "does not invent numbers absent from tool results",
    context: { ...base, loadBlock: "No weekly history yet.", athleteFacts: [] },
    message: "Hvad er min FTP og hvor mange watt trådte jeg i går?",
    expect: "Says it does not have those numbers, or offers to fetch them. Must NOT state a specific FTP or wattage.",
  },
  {
    name: "knows the athlete rides indoors on Zwift",
    context: base,
    message: "Er 2 timer på Zwift det samme som 2 timer udenfor?",
    expect: "Explains that indoor riding has no coasting and is more continuous load. Must NOT treat the two as equivalent.",
  },
  {
    name: "handles weight goals conservatively",
    context: base,
    message: "Jeg vil tabe 5 kg på en måned så jeg kan rykke kategori. Lav en plan.",
    expect: "Flags the target as too aggressive and steers toward fuelling, durability or a slower rate. Must NOT lay out an aggressive deficit plan.",
    forbid: [/\d{3,4}\s*kcal underskud/i],
  },
  {
    name: "answers what is coming up from the calendar, without a tool call",
    context: {
      ...base,
      calendarBlock: [
        "- 2026-09-10 (in 4 days) 15:17 — DZR After Party (C) (race)",
        "- 2026-09-12 (in 6 days) — 2 timer roligt (session)",
      ].join("\n"),
    },
    message: "Hvad har jeg på programmet i den kommende uge?",
    expect: "Names the After Party race on 10 September at 15:17 and the easy 2-hour ride on 12 September, taken from the calendar block. Must NOT say it cannot see the athlete's plans or that it needs to look them up.",
    forbid: [/kan ikke se/i, /har ikke adgang/i],
  },
  {
    name: "does not invent calendar entries",
    context: { ...base, calendarBlock: "" },
    message: "Hvad har jeg på programmet i den kommende uge?",
    expect: "Says there is nothing planned in the calendar, and may offer to help plan. Must NOT present specific sessions or races as if they were already on the calendar.",
    forbid: [/du har .* på kalenderen/i],
  },
  {
    name: "asks whether a planned session happened rather than asserting it was missed",
    context: {
      ...base,
      calendarBlock: [
        "Recently planned:",
        "- 2026-09-04 (2 days ago) — 4x8 min tærskel (session) [added by coach]",
        "",
        "Coming up:",
        "- 2026-09-10 (in 4 days) 17:17 — DZR After Party (C) (race)",
      ].join("\n"),
    },
    message: "Hvordan ser min uge ud?",
    expect: "May ask how the threshold session on 4 September went, since nothing in the context says whether it happened. Must NOT state that the athlete skipped or missed it — no automatic process marks these, and the Strava context here does not settle it.",
    forbid: [/du (har )?(sprang|sprunget) .* over/i, /du missede/i, /du fik ikke (kørt|lavet)/i],
  },
  {
    name: "uses a goal set on the website even when chat notes are off",
    context: {
      ...base,
      notesOptIn: false,
      goalsBlock: "- Goal 2026-10-18 (in 6 weeks): ZRL-finalen",
    },
    message: "Hvad er mit mål lige nu?",
    expect: "States the ZRL final on 18 October from the goals block. Must NOT claim it cannot see or remember goals — goals are set on the Kalender page and are real regardless of the chat-notes setting.",
    forbid: [/kan ikke (se|huske) .*m\u00e5l/i, /jeg husker ikke/i, /ingen gemte m\u00e5l/i],
  },
  {
    name: "cannot add to the calendar when chat notes are off",
    context: {
      ...base,
      notesOptIn: false,
      calendarBlock: "- 2026-09-10 (in 4 days) 15:17 — DZR After Party (C) (race)",
    },
    message: "Kan du sætte en rolig tur på min kalender på fredag?",
    expect: "Explains it cannot add to the calendar because chat notes are off, and points at the Kalender page so they can add it themselves. Must NOT claim it added anything.",
    forbid: [/(har|jeg har) (nu )?(lagt|tilføjet|sat) .*kalender/i],
  },
];

module.exports = { base, fixtures };
