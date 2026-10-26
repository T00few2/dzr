const test = require("node:test");
const assert = require("node:assert/strict");
const shared = require("../constants.json");
const { DEFAULT_VERIFICATION_CRITERIA, evaluateVerificationCriteria } = require("./verificationCriteria");
const { getOnboardingStatus, computeNextStep, PREVIEW_PRESETS, ZWIFT_ID_CRITERION } = require("./onboardingStatus");

const ROLES = shared.discord.roles;
const CLUB = "club-role";
const USER = "200000000000000000";

function fixture({ roles = [], zwiftId = null, paid = false, intervals = false, settings, docs = {} } = {}) {
  const state = { roles: new Set(roles), fail: null, memberMissing: false, reads: [] };
  const store = new Map(Object.entries({ "system_settings/global": { membership: { clubMemberRoleId: CLUB } }, ...docs }));
  const db = {
    collection: (name) => ({
      doc: (id) => ({
        get: async () => {
          if (state.fail === name) throw new Error(`${name} down`);
          const data = store.get(`${name}/${id}`);
          return { exists: data !== undefined, data: () => data };
        },
      }),
    }),
  };
  const member = () => ({
    guild: { id: shared.discord.guildId },
    user: { createdTimestamp: 0 },
    premiumSince: null,
    roles: { cache: new Map([...state.roles].map((r) => [r, {}])) },
  });
  const client = {
    guilds: {
      cache: new Map([[shared.discord.guildId, {
        members: {
          fetch: async () => {
            if (state.fail === "discord") throw Object.assign(new Error("Discord down"), { code: 0 });
            if (state.memberMissing) throw Object.assign(new Error("Unknown Member"), { code: 10007 });
            return member();
          },
        },
      }]]),
    },
  };
  const deps = {
    db,
    getUserZwiftId: async () => {
      if (state.fail === "users") throw new Error("users down");
      return zwiftId;
    },
    getVerificationSettings: async () =>
      state.fail === "verificationSettings" ? null : settings || { enabled: true, verifiedRoleId: ROLES.verifiedMember, criteria: { requiresZwiftId: true } },
    defaultCriteria: DEFAULT_VERIFICATION_CRITERIA,
    evaluateVerificationCriteria,
    readPaidClubMember: async () => {
      if (state.fail === "memberships") throw new Error("memberships down");
      return paid;
    },
    isIntervalsConnected: async () => {
      if (state.fail === "intervals") throw new Error("intervals down");
      return intervals;
    },
  };
  return { state, client, deps, read: () => getOnboardingStatus(client, USER, { deps }) };
}

test("unpaid newcomer links the Zwift ID in the Discord channel", async () => {
  const f = fixture({ roles: [ROLES.communityMember] });
  const status = await f.read();
  assert.equal(status.nextStep, "link_zwift_id_channel");
  assert.deepEqual(status.missingCriteria, [ZWIFT_ID_CRITERION]);
});

test("paid but unverified (the /join gap, no club role yet) links via /join/zwift-id, not club_role_pending", async () => {
  assert.equal((await fixture({ roles: [ROLES.communityMember], paid: true }).read()).nextStep, "link_zwift_id_join");
  assert.equal((await fixture({ roles: [ROLES.communityMember, CLUB], paid: true }).read()).nextStep, "link_zwift_id_join");
});

test("criteria met but verified role not added yet sends no step", async () => {
  const status = await fixture({ roles: [ROLES.communityMember], zwiftId: "123456" }).read();
  assert.equal(status.verified, false);
  assert.equal(status.nextStep, null);
});

test("other missing criteria give meet_verification with the list", async () => {
  const settings = { enabled: true, verifiedRoleId: ROLES.verifiedMember, criteria: { requiresZwiftId: true, requiresServerBoost: true } };
  const status = await fixture({ roles: [ROLES.communityMember], zwiftId: "123456", settings }).read();
  assert.equal(status.nextStep, "meet_verification");
  assert.deepEqual(status.missingCriteria, ["Server boost"]);
});

test("verified steps: role/payment mismatch, then pay, then intervals, then done", async () => {
  const verified = [ROLES.communityMember, ROLES.verifiedMember];
  assert.equal((await fixture({ roles: [...verified, CLUB], zwiftId: "1" }).read()).nextStep, "club_role_pending");
  assert.equal((await fixture({ roles: verified, zwiftId: "1", paid: true }).read()).nextStep, "club_role_pending");
  assert.equal((await fixture({ roles: verified, zwiftId: "1" }).read()).nextStep, "become_club_member");
  assert.equal((await fixture({ roles: [...verified, CLUB], zwiftId: "1", paid: true }).read()).nextStep, "connect_intervals");
  assert.equal((await fixture({ roles: [...verified, CLUB], zwiftId: "1", paid: true, intervals: true }).read()).nextStep, "done");
});

test("a missing verification settings document is the default, not a failure", async () => {
  const f = fixture({ roles: [ROLES.communityMember], settings: { enabled: false, verifiedRoleId: null, criteria: DEFAULT_VERIFICATION_CRITERIA } });
  assert.equal((await f.read()).nextStep, "link_zwift_id_channel");
});

for (const failure of ["discord", "verificationSettings", "users", "memberships", "system_settings", "intervals"]) {
  test(`${failure} read failure throws instead of guessing`, async () => {
    const f = fixture({ roles: [ROLES.communityMember, ROLES.verifiedMember, CLUB], zwiftId: "1", paid: true });
    f.state.fail = failure;
    await assert.rejects(f.read());
  });
}

test("someone not in the server has no step", async () => {
  const f = fixture();
  f.state.memberMissing = true;
  const status = await f.read();
  assert.equal(status.inServer, false);
  assert.equal(status.nextStep, null);
});

test("no club role configured skips the mismatch check", () => {
  assert.equal(computeNextStep({ inServer: true, verified: true, paidClubMember: false, clubRole: null }), "become_club_member");
});

test("every preview preset renders without reads and yields its step", async () => {
  const expected = {
    fresh_unpaid: "link_zwift_id_channel",
    paid_no_zwift: "link_zwift_id_join",
    verified_not_paid: "become_club_member",
    paid_role_pending: "club_role_pending",
    club_no_intervals: "connect_intervals",
    done: "done",
  };
  assert.deepEqual(Object.keys(expected).sort(), Object.keys(PREVIEW_PRESETS).sort());
  for (const [preset, step] of Object.entries(expected)) {
    assert.equal((await getOnboardingStatus(null, USER, { preset })).nextStep, step, preset);
  }
});
