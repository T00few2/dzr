/**
 * Onboarding DMs from the club bot.
 *
 * A role event only says a DM may be due; the body is the member's current next step from
 * onboardingStatus, so the /join order (Discord, payment, Zwift ID) never gets a message meant for
 * another stage. Each step key is sent at most once, recorded in onboarding_dms/{discordId}:
 *
 *   steps.<key> = { sentAt?, dmFailedAt?, claimingAtMs? }
 *
 * 1. Claim (transaction): drop keys already sent or failed. If any remaining key carries a lease
 *    younger than LEASE_MS, another instance is sending: claim nothing. Otherwise write the lease
 *    on every remaining key in the same transaction. A Firestore error sends nothing.
 * 2. Send one Discord message holding all claimed keys.
 * 3. Finish (transaction): sent -> sentAt; DMs closed (50007) -> dmFailedAt, then one channel
 *    fallback; any other error -> nothing, so a later event retries. The lease is always cleared.
 *
 * The one duplicate left is a crash between a successful send and step 3.
 */
const shared = require("../constants.json");
const { LINKS } = require("./onboardingStatus");

const COLLECTION = shared.firestore.onboardingDms || "onboarding_dms";
const CHANNELS = shared.discord.channels;
const LEASE_MS = 60 * 1000;
const DM_CLOSED = 50007;

/** Steps that have a DM. done and null are status only. */
const STEP_KEYS = new Set([
  "link_zwift_id_channel",
  "link_zwift_id_join",
  "meet_verification",
  "become_club_member",
  "club_role_pending",
  "connect_intervals",
]);

/** {dm_hint} in the public join/role lines: filled only when a DM was sent just now, so a line never points to a DM that does not exist. */
const DM_HINTS = {
  join: "Jeg har sendt dig en privat besked (DM), som hjælper dig i gang. Find den under **Direkte beskeder**: Discord-logoet øverst til venstre på computeren, eller 💬 på mobilen.",
  role: "Tjek dine **DMs fra mig** – der står dit næste skridt.",
};

const ASK_ME = "Spørg mig om hvad som helst her i DM – hold, løb, ZRL-kategori, Zwift. Giv gerne mine svar 👍 eller 👎, så jeg bliver bedre. _(You can write to me in English.)_";

function joinGreeting(name) {
  return [
    `Hej ${name} 👋 Velkommen til **Danish Zwift Racers**!`,
    "Jeg er DZR-botten. Når du er kommet helt ind på serveren, guider jeg dig videre herinde.",
    ASK_ME,
  ].join("\n\n");
}

function introText() {
  return [
    "**Kom godt i gang på DZR Discord**",
    `• <#${CHANNELS.selfRoles}> – vælg løbsserier og hold, så du ser de rigtige kanaler`,
    `• <#${CHANNELS.teamsLookingForRiders}> – hold der leder efter ryttere`,
    `• <#${CHANNELS.announcements}> – vigtige opdateringer`,
    `• <#${CHANNELS.raceSchedule}> – hvilke løb vi kører`,
    `• <#${CHANNELS.help}> – få hjælp`,
    "• DZR-kittet i Zwift får du ved at gennemføre et DZR-event med kittet som præmie – spørg mig hvilke.",
  ].join("\n");
}

function teamsLine(teams) {
  if (!teams?.length) return `Leder du efter et hold? Se <#${CHANNELS.teamsLookingForRiders}> eller spørg mig.`;
  const names = teams.slice(0, 6).map((team) => team.name).join(", ");
  return `Leder du efter et hold? Disse søger ryttere lige nu: ${names}. Se <#${CHANNELS.teamsLookingForRiders}> eller spørg mig.`;
}

function stepText(step, status, extras = {}) {
  switch (step) {
    case "link_zwift_id_channel":
      return [
        "**Næste skridt: link dit Zwift ID** → så bliver du ✅ Verificeret Medlem og får adgang til members-zone på hjemmesiden og bot-kommandoerne.",
        `Skriv \`zwiftid 1234567\` (dit eget ID) i <#${CHANNELS.zwiftId}>, brug \`/my_zwiftid\` – eller send det bare til mig her. Jeg viser dig profilen, så du kan bekræfte, at det er dig.`,
        "Kender du ikke dit ID? Skriv dit navn, som det står på Zwift/ZwiftPower, til mig her – så finder jeg dig.",
      ].join("\n");
    case "link_zwift_id_join":
      return [
        "**Tak for din betaling! Sidste skridt: link dit Zwift ID**",
        `Gør det her: ${LINKS.joinZwiftId} – så er du både ⭐ Klub Medlem og ✅ Verificeret Medlem.`,
        "Kender du ikke dit Zwift ID? Skriv dit navn, som det står på Zwift/ZwiftPower, til mig her – så finder jeg dig og viser profilen, så du kan bekræfte.",
      ].join("\n");
    case "meet_verification":
      return [
        "**Næste skridt for at blive ✅ Verificeret Medlem:**",
        ...(status.missingCriteria || []).map((item) => `• ${item}`),
      ].join("\n");
    case "become_club_member": {
      const fee = extras.fee ? `Kontingent: ${extras.fee}.` : null;
      return [
        "**Du er nu ✅ Verificeret Medlem 🎉**",
        "Næste skridt, hvis du vil: bliv ⭐ **Klub Medlem**. Det giver bl.a. adgang til DZR Coach – en træningscoach her på Discord, der kender dine data.",
        fee,
        `Meld dig ind her: ${LINKS.join}`,
      ].filter(Boolean).join("\n");
    }
    case "club_role_pending":
      return [
        "**Din ⭐ Klub Medlem-status er ved at blive opdateret**",
        `Din betaling og din rolle her på Discord passer ikke sammen endnu. Det retter sig som regel selv kort efter – ellers skriv i <#${CHANNELS.help}>, så hjælper en admin.`,
      ].join("\n");
    case "connect_intervals":
      return [
        "**Velkommen som ⭐ Klub Medlem 🥳**",
        "Som klubmedlem kan du bruge **DZR Coach**. Skriv `/coach` på serveren, så får du et link til at forbinde din intervals.icu-konto, og coachen skriver til dig.",
        teamsLine(extras.teams),
      ].join("\n");
    default:
      return null;
  }
}

/** One message for the claimed keys: intro first, then the step, then the ask-me line. */
function buildMessage(keys, status, extras = {}) {
  if (keys.includes("join")) return joinGreeting(extras.name || "der");
  const parts = [];
  if (keys.includes("intro")) parts.push(introText());
  for (const key of keys) {
    if (STEP_KEYS.has(key)) parts.push(stepText(key, status, extras));
  }
  if (!parts.length) return null;
  parts.push(ASK_ME);
  return parts.join("\n\n");
}

/** Keys this event wants to send, before send-once filtering. */
function wantedKeys(trigger, status) {
  if (trigger === "join") return ["join"];
  const step = STEP_KEYS.has(status?.nextStep) ? status.nextStep : null;
  // The intro rides along with the first step DM, whatever role triggered it: members who come
  // through /join are added to the server without the community role, so that event never fires.
  // Claiming drops it once it has been sent.
  const keys = trigger === "community" || step ? ["intro"] : [];
  if (step) keys.push(step);
  return keys;
}

function isOpen(entry) {
  return !entry?.sentAt && !entry?.dmFailedAt;
}

/** Transaction 1. Returns the keys this instance now holds, or [] (nothing to send / someone else is sending). */
async function claimKeys(db, discordId, keys, nowMs) {
  const ref = db.collection(COLLECTION).doc(String(discordId));
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const steps = (snap.exists && snap.data()?.steps) || {};
    let open = keys.filter((key) => isOpen(steps[key]));
    // The channel link never follows the /join link; the reverse order is the normal /join path.
    if (steps.link_zwift_id_join?.sentAt) open = open.filter((key) => key !== "link_zwift_id_channel");
    if (!open.length) return [];
    if (open.some((key) => nowMs - Number(steps[key]?.claimingAtMs || 0) < LEASE_MS)) return [];
    const patch = {};
    for (const key of open) patch[key] = { claimingAtMs: nowMs };
    tx.set(ref, { steps: patch }, { merge: true });
    return open;
  });
}

/** Transaction 3. outcome: "sent" | "dm_closed" | "error". Always clears the lease. */
async function finishKeys(db, discordId, keys, outcome, now) {
  const ref = db.collection(COLLECTION).doc(String(discordId));
  await db.runTransaction(async (tx) => {
    await tx.get(ref);
    const patch = {};
    for (const key of keys) {
      patch[key] = { claimingAtMs: null };
      if (outcome === "sent") patch[key].sentAt = now;
      if (outcome === "dm_closed") patch[key].dmFailedAt = now;
    }
    tx.set(ref, { steps: patch }, { merge: true });
  });
}

/** Funnel timestamps, each written once, when the fact is first seen true. */
async function recordFunnelFacts(db, discordId, status, now) {
  if (!status?.inServer) return;
  const ref = db.collection(COLLECTION).doc(String(discordId));
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = (snap.exists && snap.data()) || {};
    const patch = {};
    if (status.community && !data.communityAt) patch.communityAt = now;
    if (status.verified && !data.zwiftLinkedAt) patch.zwiftLinkedAt = now;
    if (status.clubRole && status.paidClubMember && !data.clubJoinedAt) patch.clubJoinedAt = now;
    if (Object.keys(patch).length) tx.set(ref, patch, { merge: true });
  });
}

function fallbackChannelId(trigger, config) {
  if (trigger === "join") return config?.discord?.welcomeChannelId || CHANNELS.welcome;
  return CHANNELS.zwiftId;
}

async function postFallback(member, channelId) {
  const channel = member.guild.channels.cache.get(channelId);
  if (!channel) return;
  await channel.send({
    content: `<@${member.id}> Jeg kunne ikke sende dig en DM. Åbn for DMs fra servermedlemmer, eller @mention mig her, så hjælper jeg dig i gang.`,
    allowedMentions: { users: [member.id] },
  });
}

function defaultDeps() {
  const { getOnboardingStatus } = require("./onboardingStatus");
  const { getMembershipFacts, feeText, getTeamsLookingForRiders } = require("./clubFacts");
  return {
    db: require("./firebase").db,
    config: require("../config/config"),
    getOnboardingStatus,
    getFee: async () => feeText(await getMembershipFacts()),
    getTeamsLookingForRiders,
  };
}

async function extrasFor(keys, member, d) {
  const extras = { name: member.displayName || member.user?.username };
  if (keys.includes("become_club_member")) extras.fee = await d.getFee();
  if (keys.includes("connect_intervals")) extras.teams = await d.getTeamsLookingForRiders();
  return extras;
}

/**
 * Send the onboarding DM this event calls for, if it has not been sent.
 * @param {"join"|"community"|"role"} trigger join: guildMemberAdd; community: the community role was
 *   added (adds the channel intro); role: verified or club role added.
 * @returns {Promise<{ outcome: string, keys?: string[] }>}
 */
async function runOnboarding({ client, member, trigger, deps } = {}) {
  const d = deps || defaultDeps();
  const id = String(member.id);
  const now = d.now ? d.now() : new Date();

  let status = null;
  if (trigger !== "join") {
    try {
      status = await d.getOnboardingStatus(client, id);
    } catch (error) {
      // Fail closed: no key is claimed, so the next event retries.
      console.warn(`Onboarding status unavailable for ${id}:`, error?.message || error);
      return { outcome: "status_failed" };
    }
    try {
      await recordFunnelFacts(d.db, id, status, now);
    } catch (error) {
      console.warn("Onboarding funnel write failed:", error?.message || error);
    }
  }

  const keys = wantedKeys(trigger, status);
  if (!keys.length) return { outcome: "nothing_due" };

  let claimed;
  try {
    claimed = await claimKeys(d.db, id, keys, now.getTime());
  } catch (error) {
    console.warn("Onboarding claim failed; not sending:", error?.message || error);
    return { outcome: "claim_failed" };
  }
  if (!claimed.length) return { outcome: "already_handled" };

  let outcome = "error";
  try {
    const content = buildMessage(claimed, status, await extrasFor(claimed, member, d));
    if (!content) {
      outcome = "sent";
    } else {
      await member.send({ content });
      outcome = "sent";
    }
  } catch (error) {
    if (error?.code === DM_CLOSED) outcome = "dm_closed";
    else console.warn(`Onboarding DM to ${id} failed:`, error?.message || error);
  }

  try {
    await finishKeys(d.db, id, claimed, outcome, now);
  } catch (error) {
    console.warn("Onboarding finish write failed:", error?.message || error);
  }

  if (outcome === "dm_closed") {
    try {
      await postFallback(member, fallbackChannelId(trigger, d.config));
    } catch (error) {
      console.warn("Onboarding fallback post failed:", error?.message || error);
    }
  }
  return { outcome, keys: claimed };
}

module.exports = {
  runOnboarding,
  buildMessage,
  wantedKeys,
  claimKeys,
  finishKeys,
  recordFunnelFacts,
  STEP_KEYS,
  DM_HINTS,
  LEASE_MS,
  COLLECTION,
};
