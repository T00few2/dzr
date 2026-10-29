const test = require("node:test");
const assert = require("node:assert/strict");
const shared = require("../../constants.json");
const {
  upcomingClubEventsSignal,
  newFeaturesSignal,
  unlinkedZwiftIdSignal,
  notInCompanionClubSignal,
  dmUnseenSignal,
  featureSpotlightSignal,
  evergreenSignal,
  pickCandidate,
  computeMemberCounts,
  gatherCandidates,
} = require("./signals");
const { FEATURES } = require("./features");
const { compactCommits, areasOf, fetchCommitLog } = require("./github");
const { isSilent, funnel } = require("./dmStats");
const { DEFAULTS } = require("./settings");

const NOW = new Date("2026-10-29T08:15:00Z");
const DAY = 24 * 60 * 60 * 1000;
const ago = (days) => new Date(NOW.getTime() - days * DAY);
const COMMUNITY = shared.discord.roles.communityMember;

test("member counts: unlinked community members, and linked members outside the Companion club", () => {
  const members = [
    { id: "1", roleIds: [COMMUNITY] },
    { id: "2", roleIds: [COMMUNITY] },
    { id: "3", roleIds: [COMMUNITY] },
    { id: "4", roleIds: [] },
    { id: "5", roleIds: [COMMUNITY], bot: true },
  ];
  const linked = new Map([["2", "200"], ["3", "300"], ["4", "400"]]);
  assert.deepEqual(computeMemberCounts(members, linked, new Set(["200"])), {
    communityCount: 3, unlinkedCount: 1, linkedCount: 3, notInCompanionCount: 2,
  });
  // An empty roster is a failed sync, not an empty club.
  assert.equal(computeMemberCounts(members, linked, new Set()).notInCompanionCount, null);
});

test("the Zwift ID nudge fires on count or share, and not for a handful", () => {
  const fires = (unlinkedCount, communityCount) => unlinkedZwiftIdSignal({ counts: { unlinkedCount, communityCount }, settings: DEFAULTS }).length === 1;
  assert.equal(fires(20, 400), true);
  assert.equal(fires(8, 50), true);
  assert.equal(fires(8, 400), false);
  assert.equal(fires(0, 400), false);
  const [candidate] = unlinkedZwiftIdSignal({ counts: { unlinkedCount: 20, communityCount: 400 }, settings: DEFAULTS });
  assert.match(candidate.facts.howTo, new RegExp(shared.discord.channels.zwiftId));
});

test("the Companion nudge needs a known roster and enough members missing", () => {
  assert.equal(notInCompanionClubSignal({ counts: { notInCompanionCount: null, linkedCount: 100 }, settings: DEFAULTS }).length, 0);
  assert.equal(notInCompanionClubSignal({ counts: { notInCompanionCount: 5, linkedCount: 100 }, settings: DEFAULTS }).length, 0);
  const [candidate] = notInCompanionClubSignal({ counts: { notInCompanionCount: 30, linkedCount: 100 }, settings: DEFAULTS });
  assert.equal(candidate.priority, 2);
  assert.match(candidate.facts.howTo, /Companion/);
});

test("dmUnseen fires above its threshold", () => {
  assert.equal(dmUnseenSignal({ silentCount: 3, settings: DEFAULTS }).length, 0);
  assert.equal(dmUnseenSignal({ silentCount: 40, settings: DEFAULTS })[0].score, 40);
});

test("club events: only the next days, each series name once, not recently promoted", () => {
  const event = (id, name, hours) => ({ id, name, startMs: NOW.getTime() + hours * 60 * 60 * 1000, startLocal: "x", url: `u${id}` });
  const events = [event(1, "DZR After Party", 30), event(2, "DZR After Party", 54), event(3, "Zwifty Fifty", 10), event(4, "Far Away", 24 * 10), event(5, "Past", -2)];
  const [candidate] = upcomingClubEventsSignal({ events, settings: DEFAULTS, state: { promotedEvents: {} }, now: NOW });
  assert.deepEqual(candidate.meta.eventNames, ["Zwifty Fifty", "DZR After Party"]);
  const again = upcomingClubEventsSignal({ events, settings: DEFAULTS, state: { promotedEvents: { "Zwifty Fifty": ago(5), "DZR After Party": ago(5) } }, now: NOW });
  assert.equal(again.length, 0);
});

test("feature news carries the head sha so the log advances", () => {
  assert.equal(newFeaturesSignal({ commitLog: { head: "abc", commits: [] }, settings: DEFAULTS }).length, 0);
  const [candidate] = newFeaturesSignal({ commitLog: { head: "abc", commits: [{ subject: "Draw powerups", body: "" }], areas: ["Discord-botten"] }, settings: DEFAULTS });
  assert.equal(candidate.meta.headSha, "abc");
  assert.deepEqual(candidate.facts.commits, [{ subject: "Draw powerups", details: "" }]);
});

test("spotlight rotates to the longest-unfeatured feature, and shipped features get one turn after a month", () => {
  const perSignal = Object.fromEntries(FEATURES.map((feature, i) => [`featureSpotlight:${feature.key}`, ago(40 + i)]));
  const oldest = FEATURES[FEATURES.length - 1].key;
  assert.equal(featureSpotlightSignal({ state: { perSignal }, settings: DEFAULTS, now: NOW })[0].key, `featureSpotlight:${oldest}`);

  perSignal[`featureSpotlight:${oldest}`] = ago(2);
  assert.notEqual(featureSpotlightSignal({ state: { perSignal }, settings: DEFAULTS, now: NOW })[0].key, `featureSpotlight:${oldest}`);

  const shippedFeatures = [
    { slug: "fresh", title: "Fresh", pitch: "p", at: ago(5) },
    { slug: "ripe", title: "Ripe", pitch: "p", at: ago(35) },
    { slug: "done", title: "Done", pitch: "p", at: ago(60), spotlightedAt: ago(20) },
  ];
  const [shipped] = featureSpotlightSignal({ state: { perSignal, shippedFeatures }, settings: DEFAULTS, now: NOW });
  assert.equal(shipped.key, "featureSpotlight:shipped:ripe");
  assert.equal(shipped.meta.shippedSlug, "ripe");
});

test("evergreen skips articles featured recently", () => {
  const articles = [{ id: "a", title: "A", content: "x" }, { id: "b", title: "B", content: "y" }];
  const [candidate] = evergreenSignal({ articles, state: { perSignal: { "evergreen:a": ago(10) } }, settings: DEFAULTS, now: NOW, random: () => 0 });
  assert.equal(candidate.key, "evergreen:b");
});

test("pickCandidate: priority, then need; cooldowns, open drafts and a repeated kind are skipped", () => {
  const c = (key, kind, priority, score = 0, cooldownDays = 7) => ({ key, kind, priority, score, cooldownDays });
  const candidates = [c("spot", "featureSpotlight", 3), c("unlinked", "unlinkedZwiftId", 2, 20), c("companion", "notInCompanionClub", 2, 40), c("ever", "evergreen", 4)];
  assert.equal(pickCandidate(candidates, { state: {}, now: NOW }).key, "companion");
  assert.equal(pickCandidate(candidates, { state: { perSignal: { companion: ago(2) } }, now: NOW }).key, "unlinked");
  assert.equal(pickCandidate(candidates, { state: {}, now: NOW, openKeys: new Set(["companion", "unlinked"]) }).key, "spot");
  assert.equal(pickCandidate(candidates, { state: { lastKind: "notInCompanionClub" }, now: NOW }).key, "unlinked");
  // Time-bound topics may follow their own kind.
  const events = c("events", "upcomingClubEvents", 1, 2, 0);
  assert.equal(pickCandidate([events, ...candidates], { state: { lastKind: "upcomingClubEvents" }, now: NOW }).key, "events");
});

test("gatherCandidates keeps going when one source fails, and honours disabled signals", async () => {
  const settings = { ...DEFAULTS, signals: { ...DEFAULTS.signals, evergreen: { ...DEFAULTS.signals.evergreen, enabled: false } } };
  const warn = console.warn;
  console.warn = () => {};
  try {
    const candidates = await gatherCandidates({
      deps: {
        memberCounts: async () => ({ communityCount: 100, unlinkedCount: 30, linkedCount: 70, notInCompanionCount: 2 }),
        fetchClubEvents: async () => { throw new Error("feed down"); },
        commitLog: async () => ({ head: "h", commits: [] }),
        silentDmCount: async () => 0,
        listKnowledge: async () => [{ id: "a", content: "x" }],
      },
      settings,
      state: {},
      now: NOW,
    });
    assert.deepEqual(candidates.map((candidate) => candidate.kind).sort(), ["featureSpotlight", "unlinkedZwiftId"]);
  } finally {
    console.warn = warn;
  }
});

test("commits: merges dropped, bodies kept short; areas from changed paths", () => {
  const raw = [
    { sha: "1", commit: { message: "Draw a race's powerups\n\nLonger body" } },
    { sha: "2", commit: { message: "Merge pull request #12 from x/y" } },
  ];
  assert.deepEqual(compactCommits(raw), [{ sha: "1", subject: "Draw a race's powerups", body: "Longer body" }]);
  assert.deepEqual(areasOf([{ filename: "apps/bot/x.js" }, { filename: "app/page.tsx" }, { filename: "components/a.tsx" }, { filename: "README.md" }]), ["Discord-botten", "hjemmesiden"]);
});

test("fetchCommitLog compares from the last sha, or lists since a date the first time", async () => {
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(url);
    if (url.includes("/compare/")) {
      return { ok: true, json: async () => ({ commits: [{ sha: "b", commit: { message: "One" } }, { sha: "c", commit: { message: "Two" } }], files: [{ filename: "apps/api/main.py" }] }) };
    }
    return { ok: true, json: async () => [{ sha: "z", commit: { message: "Newest" } }, { sha: "y", commit: { message: "Older" } }] };
  };
  const compared = await fetchCommitLog({ base: "a", sinceIso: "x", fetchImpl });
  assert.equal(compared.head, "c");
  assert.deepEqual(compared.areas, ["backend (API)"]);
  assert.match(urls[0], /compare\/a\.\.\.main$/);
  const listed = await fetchCommitLog({ base: null, sinceIso: "2026-10-15T00:00:00.000Z", fetchImpl });
  assert.equal(listed.head, "z");
  assert.deepEqual(listed.commits.map((commit) => commit.subject), ["Older", "Newest"]);
});

test("silent DMs: delivered days ago with no reply, click or conversion", () => {
  const sent = { steps: { link_zwift_id_channel: { sentAt: ago(5) } } };
  assert.equal(isSilent(sent, NOW, 3), true);
  assert.equal(isSilent({ steps: { link_zwift_id_channel: { sentAt: ago(1) } } }, NOW, 3), false);
  assert.equal(isSilent({ ...sent, firstReplyAt: ago(4) }, NOW, 3), false);
  assert.equal(isSilent({ ...sent, zwiftLinkedAt: ago(2) }, NOW, 3), false);
  assert.equal(isSilent({ steps: { link_zwift_id_channel: { dmFailedAt: ago(5) } } }, NOW, 3), false);
  assert.equal(isSilent({ reminders: { join_companion: { lastAt: ago(5), count: 1, clickedAt: ago(4) } } }, NOW, 3), false);
  assert.equal(isSilent({ ...sent, test: true }, NOW, 3), false);
});

test("funnel counts per step", () => {
  const rows = funnel([
    { steps: { link_zwift_id_channel: { sentAt: ago(10) } }, zwiftLinkedAt: ago(8) },
    { steps: { link_zwift_id_channel: { sentAt: ago(10) } } },
    { steps: { link_zwift_id_channel: { dmFailedAt: ago(10) } } },
    { reminders: { join_companion: { lastAt: ago(6), count: 2 } }, firstReplyAt: ago(5) },
  ], NOW, 3);
  assert.deepEqual(rows.link_zwift_id_channel, { sent: 2, failed: 1, engaged: 0, converted: 1, silent: 1 });
  assert.deepEqual(rows.join_companion, { sent: 2, failed: 0, engaged: 1, converted: 0, silent: 0 });
});
