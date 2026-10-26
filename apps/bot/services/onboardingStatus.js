/**
 * Where a member is in DZR onboarding, and the one step they should take next.
 *
 * The onboarding DMs and the club assistant's my_onboarding_status tool both read this, so they
 * cannot disagree. Every read fails closed: a lookup error throws instead of turning into "not
 * paid" or "no Zwift ID", because onboarding records what it sent and a blip must not become a
 * permanent wrong message. A missing document is a normal answer (not connected, not paid).
 */
const shared = require("../constants.json");

const ROLES = shared.discord.roles;
const COLLECTIONS = shared.firestore;
const SITE = String(shared.siteOrigin || "").replace(/\/+$/, "");
const ZWIFT_ID_CHANNEL_ID = shared.discord.channels.zwiftId;
const UNKNOWN_MEMBER = 10007;
const UNKNOWN_USER = 10013;

const LINKS = {
  join: `${SITE}/join`,
  joinZwiftId: `${SITE}/join/zwift-id`,
  membersZone: `${SITE}/members-zone`,
};

const ZWIFT_ID_CRITERION = "Linked ZwiftID";

/**
 * The next step, in this order (see docs/architecture/bot-automation.md):
 * 1. Not verified, even when club role and payment disagree: that gap is normal mid-/join.
 * 2. Verified, and club role and payment disagree: wait for the sync, never send them to /join again.
 * 3. Verified, not paid: become a club member.
 * 4. Paid with the club role, intervals.icu not connected: connect it for DZR Coach.
 * 5. done. Status only; connecting intervals fires no Discord event, so no DM ever says "done".
 *
 * Returns null when criteria are met but the verified role has not been added yet: the
 * verified-role event that follows has the real step.
 */
function computeNextStep(facts) {
  if (!facts.inServer) return null;
  if (!facts.verified) {
    const missing = facts.missingCriteria || [];
    if (missing.length === 0) return null;
    if (missing.length === 1 && missing[0] === ZWIFT_ID_CRITERION) {
      return facts.paidClubMember ? "link_zwift_id_join" : "link_zwift_id_channel";
    }
    return "meet_verification";
  }
  if (facts.clubRole != null && facts.clubRole !== facts.paidClubMember) return "club_role_pending";
  if (!facts.paidClubMember) return "become_club_member";
  if (!facts.intervalsConnected) return "connect_intervals";
  return "done";
}

/** Simulated statuses for /onboarding_preview. Each yields the step its name says. */
const PREVIEW_PRESETS = {
  fresh_unpaid: { verified: false, missingCriteria: [ZWIFT_ID_CRITERION], paidClubMember: false, clubRole: false },
  paid_no_zwift: { verified: false, missingCriteria: [ZWIFT_ID_CRITERION], paidClubMember: true, clubRole: true },
  verified_not_paid: { verified: true, paidClubMember: false, clubRole: false, zwiftId: "1234567" },
  paid_role_pending: { verified: true, paidClubMember: true, clubRole: false, zwiftId: "1234567" },
  club_no_intervals: { verified: true, paidClubMember: true, clubRole: true, intervalsConnected: false, zwiftId: "1234567" },
  done: { verified: true, paidClubMember: true, clubRole: true, intervalsConnected: true, zwiftId: "1234567" },
};

function presetStatus(discordId, preset) {
  const base = PREVIEW_PRESETS[preset];
  if (!base) throw new Error(`Unknown onboarding preset: ${preset}`);
  const facts = {
    discordId: String(discordId),
    inServer: true,
    community: true,
    zwiftId: null,
    missingCriteria: [],
    intervalsConnected: false,
    ...base,
  };
  return { ...facts, nextStep: computeNextStep(facts), preview: preset };
}

function defaultDeps() {
  const { db, getUserZwiftId } = require("./firebase");
  const verificationService = require("./verificationService");
  const { DEFAULT_VERIFICATION_CRITERIA, evaluateVerificationCriteria } = require("./verificationCriteria");
  const { readPaidClubMember } = require("./membership");
  return {
    db,
    getUserZwiftId,
    getVerificationSettings: (guildId) => verificationService.getVerificationSettings(guildId),
    defaultCriteria: DEFAULT_VERIFICATION_CRITERIA,
    evaluateVerificationCriteria,
    readPaidClubMember: (id) => readPaidClubMember(db, COLLECTIONS, id),
    // Lazy: intervalsService pulls in config and crypto, and only paid members need it.
    isIntervalsConnected: (id) => require("./intervalsService").isConnected(id),
  };
}

async function fetchGuildMember(client, discordId) {
  const guild = client.guilds.cache.get(shared.discord.guildId) || (await client.guilds.fetch(shared.discord.guildId));
  try {
    return await guild.members.fetch({ user: String(discordId), force: true });
  } catch (error) {
    if (error?.code === UNKNOWN_MEMBER || error?.code === UNKNOWN_USER) return null;
    throw error;
  }
}

async function readClubRoleId(db) {
  const snap = await db.collection(COLLECTIONS.systemSettings).doc("global").get();
  return (snap.exists && snap.data()?.membership?.clubMemberRoleId) || null;
}

let clubRoleIdCache = { at: 0, id: null };

/** The club member role id for deciding which role events are onboarding events. Cached; null on failure. */
async function getClubRoleId(db = require("./firebase").db) {
  if (clubRoleIdCache.id && Date.now() - clubRoleIdCache.at < 10 * 60 * 1000) return clubRoleIdCache.id;
  try {
    clubRoleIdCache = { at: Date.now(), id: await readClubRoleId(db) };
  } catch (error) {
    console.warn("Club role id lookup failed:", error?.message || error);
  }
  return clubRoleIdCache.id;
}

/**
 * Read a member's onboarding facts and next step.
 * @param {import("discord.js").Client} client The club bot client (guild comes from constants, so DMs work).
 * @param {string} discordId
 * @param {{ preset?: string, deps?: object }} [options] preset: simulate without any reads.
 */
async function getOnboardingStatus(client, discordId, { preset, deps } = {}) {
  if (preset) return presetStatus(discordId, preset);
  const d = deps || defaultDeps();
  const id = String(discordId);

  const member = await fetchGuildMember(client, id);
  if (!member) {
    const facts = { discordId: id, inServer: false };
    return { ...facts, nextStep: null };
  }

  const settings = await d.getVerificationSettings(member.guild.id);
  // getVerificationSettings returns a default object for a missing document and null on a failed read.
  if (!settings) throw new Error("Verification settings lookup failed");
  const verifiedRoleId = settings.verifiedRoleId || ROLES.verifiedMember;
  const criteria = { ...d.defaultCriteria, ...(settings.criteria || {}) };

  const [zwiftId, paidClubMember, clubRoleId] = await Promise.all([
    d.getUserZwiftId(id),
    d.readPaidClubMember(id),
    readClubRoleId(d.db),
  ]);

  const roleIds = [...member.roles.cache.keys()];
  const verified = roleIds.includes(verifiedRoleId);
  const { missingCriteria } = d.evaluateVerificationCriteria(criteria, {
    zwiftId,
    accountCreatedAt: member.user.createdTimestamp,
    roleIds,
    isServerBooster: member.premiumSince != null,
  });
  const clubRole = clubRoleId ? roleIds.includes(clubRoleId) : null;
  const intervalsConnected = paidClubMember ? Boolean(await d.isIntervalsConnected(id)) : false;

  const facts = {
    discordId: id,
    inServer: true,
    community: roleIds.includes(ROLES.communityMember),
    verified,
    zwiftId: zwiftId || null,
    missingCriteria: verified ? [] : missingCriteria,
    paidClubMember,
    clubRole,
    intervalsConnected,
  };
  return { ...facts, nextStep: computeNextStep(facts) };
}

module.exports = {
  getOnboardingStatus,
  getClubRoleId,
  computeNextStep,
  PREVIEW_PRESETS,
  LINKS,
  ZWIFT_ID_CHANNEL_ID,
  ZWIFT_ID_CRITERION,
};
