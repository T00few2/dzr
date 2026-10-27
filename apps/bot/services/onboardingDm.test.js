const test = require("node:test");
const assert = require("node:assert/strict");
const { runOnboarding, claimKeys, buildMessage, LEASE_MS, COLLECTION } = require("./onboardingDm");

const USER = "300000000000000000";

function deepMerge(target, patch) {
  const out = { ...(target || {}) };
  for (const [key, value] of Object.entries(patch)) {
    out[key] = value && typeof value === "object" && !(value instanceof Date) && !Array.isArray(value)
      ? deepMerge(out[key], value)
      : value;
  }
  return out;
}

function fakeDb() {
  const docs = new Map();
  const state = { failTransactions: false };
  const ref = (name, id) => ({ key: `${name}/${id}` });
  const db = {
    docs,
    state,
    collection: (name) => ({ doc: (id) => ref(name, id) }),
    runTransaction: async (fn) => {
      if (state.failTransactions) throw new Error("Firestore down");
      const writes = [];
      const tx = {
        get: async (r) => ({ exists: docs.has(r.key), data: () => docs.get(r.key) }),
        set: (r, data, options) => writes.push([r, data, options]),
      };
      const result = await fn(tx);
      for (const [r, data, options] of writes) docs.set(r.key, options?.merge ? deepMerge(docs.get(r.key), data) : data);
      return result;
    },
  };
  return db;
}

function fixture(status, { sendError = null } = {}) {
  const db = fakeDb();
  const sent = [];
  const channelPosts = [];
  const member = {
    id: USER,
    displayName: "Rider",
    user: { username: "rider" },
    guild: { channels: { cache: { get: (id) => ({ send: async (message) => channelPosts.push({ id, message }) }) } } },
    send: async (message) => {
      if (sendError) throw sendError;
      sent.push(message.content);
    },
  };
  const deps = {
    db,
    config: { discord: {} },
    now: () => new Date(1_000_000),
    getOnboardingStatus: async () => {
      if (status instanceof Error) throw status;
      return status;
    },
    getFee: async () => "10–100 kr.",
    getTeamsLookingForRiders: async () => [{ name: "Chonky Chasers" }],
  };
  const run = (trigger) => runOnboarding({ client: null, member, trigger, deps });
  const steps = () => db.docs.get(`${COLLECTION}/${USER}`)?.steps || {};
  return { db, deps, sent, channelPosts, run, steps, member };
}

const unpaidNewcomer = { inServer: true, community: true, verified: false, paidClubMember: false, clubRole: false, nextStep: "link_zwift_id_channel" };

test("community role sends the intro and the step in one message and records both keys", async () => {
  const f = fixture(unpaidNewcomer);
  const result = await f.run("community");
  assert.deepEqual(result.keys, ["intro", "link_zwift_id_channel"]);
  assert.equal(f.sent.length, 1);
  assert.match(f.sent[0], /Kom godt i gang/);
  assert.match(f.sent[0], /link dit Zwift ID/);
  assert.ok(f.steps().intro.sentAt && f.steps().link_zwift_id_channel.sentAt);
  assert.equal(f.steps().intro.claimingAtMs, null);
});

test("the same step is never sent twice", async () => {
  const f = fixture(unpaidNewcomer);
  await f.run("community");
  assert.equal((await f.run("community")).outcome, "already_handled");
  assert.equal((await f.run("role")).outcome, "already_handled");
  assert.equal(f.sent.length, 1);
});

test("intro goes out alone when the step was already sent", async () => {
  const f = fixture({ ...unpaidNewcomer, community: false });
  await f.run("role");
  const result = await f.run("community");
  assert.deepEqual(result.keys, ["intro"]);
  assert.equal(f.sent.length, 2);
  assert.doesNotMatch(f.sent[1], /link dit Zwift ID/);
});

test("/join order: channel link, then the join link, then connect_intervals", async () => {
  const f = fixture(unpaidNewcomer);
  await f.run("community");
  f.deps.getOnboardingStatus = async () => ({ ...unpaidNewcomer, paidClubMember: true, clubRole: true, nextStep: "link_zwift_id_join" });
  assert.deepEqual((await f.run("role")).keys, ["link_zwift_id_join"]);
  f.deps.getOnboardingStatus = async () => ({ ...unpaidNewcomer, verified: true, paidClubMember: true, clubRole: true, nextStep: "connect_intervals" });
  const last = await f.run("role");
  assert.deepEqual(last.keys, ["connect_intervals"]);
  assert.match(f.sent[2], /Chonky Chasers/);
  assert.doesNotMatch(f.sent.join("\n"), /bliv ⭐ \*\*Klub Medlem/);
});

test("the channel link is never sent after the join link", async () => {
  const f = fixture({ ...unpaidNewcomer, paidClubMember: true, nextStep: "link_zwift_id_join" });
  await f.run("role");
  f.deps.getOnboardingStatus = async () => unpaidNewcomer;
  const result = await f.run("community");
  assert.deepEqual(result.keys, ["intro"]);
});

test("closed DMs record dmFailedAt, post the fallback once, and stop", async () => {
  const f = fixture(unpaidNewcomer, { sendError: Object.assign(new Error("Cannot send"), { code: 50007 }) });
  assert.equal((await f.run("community")).outcome, "dm_closed");
  assert.ok(f.steps().link_zwift_id_channel.dmFailedAt);
  assert.equal(f.steps().link_zwift_id_channel.claimingAtMs, null);
  assert.equal(f.channelPosts.length, 1);
  assert.equal((await f.run("role")).outcome, "already_handled");
  assert.equal(f.channelPosts.length, 1);
});

test("other send errors leave the step open and clear the lease", async () => {
  const f = fixture(unpaidNewcomer, { sendError: new Error("Discord 500") });
  assert.equal((await f.run("community")).outcome, "error");
  const entry = f.steps().link_zwift_id_channel;
  assert.equal(entry.sentAt, undefined);
  assert.equal(entry.claimingAtMs, null);
});

test("a status read failure sends nothing and claims nothing", async () => {
  const f = fixture(new Error("memberships down"));
  assert.equal((await f.run("role")).outcome, "status_failed");
  assert.equal(f.sent.length, 0);
  assert.equal(f.db.docs.size, 0);
});

test("a Firestore failure on claim sends nothing", async () => {
  const f = fixture(unpaidNewcomer);
  f.db.state.failTransactions = true;
  assert.equal((await f.run("community")).outcome, "claim_failed");
  assert.equal(f.sent.length, 0);
});

test("a fresh lease on any included key claims nothing", async () => {
  const db = fakeDb();
  const now = 5_000_000;
  db.docs.set(`${COLLECTION}/${USER}`, { steps: { link_zwift_id_channel: { claimingAtMs: now - 1000 } } });
  assert.deepEqual(await claimKeys(db, USER, ["intro", "link_zwift_id_channel"], now), []);
  assert.equal(db.docs.get(`${COLLECTION}/${USER}`).steps.intro, undefined);
  assert.deepEqual(await claimKeys(db, USER, ["intro", "link_zwift_id_channel"], now + LEASE_MS), ["intro", "link_zwift_id_channel"]);
});

test("done and null steps send no DM", async () => {
  for (const nextStep of ["done", null]) {
    const f = fixture({ ...unpaidNewcomer, community: false, nextStep });
    assert.equal((await f.run("role")).outcome, "nothing_due");
    assert.equal(f.sent.length, 0);
  }
});

test("funnel facts are written once, and clubJoinedAt needs role and payment", async () => {
  const f = fixture({ inServer: true, community: true, verified: true, clubRole: true, paidClubMember: false, nextStep: "club_role_pending" });
  await f.run("role");
  const doc = () => f.db.docs.get(`${COLLECTION}/${USER}`);
  assert.ok(doc().communityAt && doc().zwiftLinkedAt);
  assert.equal(doc().clubJoinedAt, undefined);
  f.deps.getOnboardingStatus = async () => ({ inServer: true, community: true, verified: true, clubRole: true, paidClubMember: true, nextStep: "connect_intervals" });
  const firstLinked = doc().zwiftLinkedAt;
  f.deps.now = () => new Date(2_000_000);
  await f.run("role");
  assert.ok(doc().clubJoinedAt);
  assert.equal(doc().zwiftLinkedAt, firstLinked);
});

test("join sends a fixed greeting once", async () => {
  const f = fixture(null);
  assert.equal((await f.run("join")).outcome, "sent");
  assert.equal((await f.run("join")).outcome, "already_handled");
  assert.match(f.sent[0], /Velkommen til \*\*Danish Zwift Racers\*\*/);
});

test("become_club_member includes the live fee", () => {
  const text = buildMessage(["become_club_member"], {}, { fee: "10–100 kr." });
  assert.match(text, /Kontingent: 10–100 kr\./);
  assert.doesNotMatch(buildMessage(["become_club_member"], {}, {}), /Kontingent/);
});
