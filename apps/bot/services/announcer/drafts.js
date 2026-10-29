/**
 * Announcement drafts: the model writes, a moderator approves, pacing decides when it goes out.
 *
 *   announcer_drafts/{id}  { signalKey, kind, channelId, reason, facts, meta, text, features,
 *                            status, createdAt, expiresAt, messageId, approvedBy, postedMessageId }
 *     status: pending -> publishing -> published
 *             pending -> queued (approved, waiting for a slot) -> publishing -> published
 *             pending | queued -> rejected | expired
 *
 * Publish claims the draft in a transaction (status "publishing"), so two moderators pressing at
 * once post it once. Pacing is checked at that moment, not when the draft was written: a draft
 * approved while the channel is busy is queued and posted by the scheduler when a slot opens, or
 * right away with "Post nu alligevel".
 */
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require("discord.js");
const shared = require("../../constants.json");
const { canPostNow, localParts, toMs, REASON_TEXT, DAY_MS } = require("./pacing");
const { KIND_LABELS } = require("./signals");

const COLLECTION = shared.firestore.announcerDrafts || "announcer_drafts";
const STATE_DOC = "announcer";
const MODERATORS_CHANNEL_ID = shared.discord.channels.moderators;
const PREFIX = "ann:";
const MAX_POST_CHARS = 1900;
const OPEN = ["pending", "queued"];

const INSTRUCTIONS = [
  "Du skriver opslag til Discord-serveren for Danish Zwift Racers (DZR), en dansk Zwift-cykelklub.",
  "Skriv på dansk, venligt og uformelt, som en klubkammerat – ikke som en reklame. Kort: højst 900 tegn.",
  "Brug kun de fakta, du får. Find ikke på datoer, priser, navne, funktioner eller tal.",
  "Discord-markdown er fint (fed, punktopstilling). Højst 2-3 emojis. Ingen @everyone, @here eller rolle-mentions.",
  "Kanal-mentions som <#123> og links skal gengives præcis som givet.",
  "Når opslaget handler om noget medlemmerne mangler at gøre: vær hjælpsom, ikke belærende. Fortæl kort hvorfor det er værd at gøre og præcis hvordan. Skæld ikke ud, og fremhæv ikke hvor mange der mangler, medmindre det er positivt formuleret.",
  "Afslut gerne med, at man kan spørge botten i en DM, hvis man har brug for hjælp.",
  "Svar kun med selve opslaget, uden overskrift som \"Opslag:\" og uden forklaring.",
].join("\n");

const FEATURE_NEWS_INSTRUCTIONS = [
  INSTRUCTIONS,
  "",
  "Denne gang får du en liste over ændringer (commits) i klubbens kode: hjemmesiden, backend og Discord-botten.",
  "Vælg kun ændringer, som et almindeligt medlem kan mærke eller bruge: nye funktioner i botten eller på hjemmesiden, tydelige forbedringer.",
  "Spring over: refaktorering, tests, rettelser af interne fejl, opdatering af data, admin-værktøjer og alt, medlemmer ikke ser.",
  "Hvis intet er relevant for medlemmer, svar præcis NOTHING.",
  "Ellers svar i præcis dette format:",
  "FEATURES:",
  "- <kort titel> | <én sætning om hvad det er> | <hvordan man bruger det>",
  "POST:",
  "<opslaget>",
].join("\n");

let openaiClient = null;
function defaultDeps() {
  // Required lazily: firebase initialises on load, which tests must not trigger.
  const config = require("../../config/config");
  if (!openaiClient && config.openai?.apiKey) {
    const OpenAI = require("openai");
    openaiClient = new OpenAI({ apiKey: config.openai.apiKey });
  }
  const { createStatelessResponse, COACH_MODEL } = require("../coachLlm");
  return {
    db: require("../firebase").db,
    now: () => new Date(),
    generate: async ({ instructions, input }) => {
      if (!openaiClient) throw new Error("OPENAI_API_KEY is not set");
      const response = await createStatelessResponse(openaiClient, {
        instructions,
        input: [{ role: "user", content: input }],
        model: process.env.ANNOUNCER_MODEL || COACH_MODEL,
        reasoningEffort: process.env.ANNOUNCER_REASONING_EFFORT || "low",
        maxOutputTokens: 6000,
        allowTools: false,
        cacheKey: "dzr-announcer",
      });
      return String(response.text || "").trim();
    },
  };
}

function stateRef(db) {
  return db.collection("bot_state").doc(STATE_DOC);
}

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/æ/g, "ae").replace(/ø/g, "oe").replace(/å/g, "aa")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "funktion";
}

/** { features, post } from the feature-news answer, or null for NOTHING or an unreadable answer. */
function parseFeatureNews(answer) {
  const text = String(answer || "").trim();
  if (!text || /^NOTHING\b/.test(text)) return null;
  const post = text.split(/^POST:\s*$/m)[1]?.trim();
  if (!post) return null;
  const featureBlock = text.split(/^POST:\s*$/m)[0].split(/^FEATURES:\s*$/m)[1] || "";
  const features = featureBlock
    .split("\n")
    .map((line) => line.replace(/^\s*-\s*/, "").split("|").map((part) => part.trim()))
    .filter((parts) => parts[0])
    .map(([title, pitch = "", howTo = ""]) => ({ title: title.slice(0, 80), pitch: pitch.slice(0, 300), howTo: howTo.slice(0, 300), slug: slugify(title) }));
  return { features, post };
}

/** { text, features } for a candidate, or null when the model has nothing worth posting. */
async function writeDraft(candidate, generate) {
  const input = [
    `Emne: ${KIND_LABELS[candidate.kind] || candidate.kind}`,
    `Hvorfor nu: ${candidate.reason}`,
    "Fakta (JSON):",
    JSON.stringify(candidate.facts, null, 2),
  ].join("\n");
  if (candidate.kind === "newFeatures") {
    const parsed = parseFeatureNews(await generate({ instructions: FEATURE_NEWS_INSTRUCTIONS, input }));
    if (!parsed) return null;
    return { text: parsed.post.slice(0, MAX_POST_CHARS), features: parsed.features };
  }
  const text = (await generate({ instructions: INSTRUCTIONS, input })).trim();
  return text ? { text: text.slice(0, MAX_POST_CHARS), features: [] } : null;
}

function canModerate(interaction) {
  const perms = interaction.memberPermissions;
  return !!(perms?.has(PermissionFlagsBits.ManageMessages) || perms?.has(PermissionFlagsBits.Administrator));
}

function draftButtons(id, status) {
  if (status === "queued") {
    return [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`${PREFIX}force:${id}`).setStyle(ButtonStyle.Success).setLabel("Post nu alligevel").setEmoji("📣"),
      new ButtonBuilder().setCustomId(`${PREFIX}reject:${id}`).setStyle(ButtonStyle.Danger).setLabel("Afvis").setEmoji("❌"),
    )];
  }
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${PREFIX}publish:${id}`).setStyle(ButtonStyle.Success).setLabel("Publicér").setEmoji("✅"),
    new ButtonBuilder().setCustomId(`${PREFIX}edit:${id}`).setStyle(ButtonStyle.Primary).setLabel("Ret og publicér").setEmoji("✏️"),
    new ButtonBuilder().setCustomId(`${PREFIX}reject:${id}`).setStyle(ButtonStyle.Danger).setLabel("Afvis").setEmoji("❌"),
  )];
}

function draftEmbed(draft) {
  return new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle(`📣 Forslag til opslag: ${KIND_LABELS[draft.kind] || draft.kind}`)
    .setDescription(draft.text.slice(0, 4000))
    .addFields(
      { name: "Kanal", value: `<#${draft.channelId}>`, inline: true },
      { name: "Udløber", value: `<t:${Math.floor(draft.expiresAt.getTime() / 1000)}:R>`, inline: true },
      { name: "Hvorfor", value: String(draft.reason).slice(0, 1000) },
    )
    .setFooter({ text: "Publicér poster når der er plads (ikke lige efter et andet opslag). Ret og publicér for at ændre teksten." });
}

/** Write the candidate and post it for moderators. Returns { id } or null when nothing was written. */
async function createDraft(client, candidate, settings, deps = defaultDeps()) {
  const written = await writeDraft(candidate, deps.generate);
  if (!written) return null;
  const now = deps.now();
  const draft = {
    signalKey: candidate.key,
    kind: candidate.kind,
    channelId: candidate.channelId,
    reason: candidate.reason,
    facts: candidate.facts,
    meta: candidate.meta || {},
    text: written.text,
    features: written.features,
    status: "pending",
    createdAt: now,
    expiresAt: new Date(now.getTime() + settings.draftExpiryDays * DAY_MS),
  };
  const ref = await deps.db.collection(COLLECTION).add(draft);
  const channel = await client.channels.fetch(MODERATORS_CHANNEL_ID);
  const posted = await channel.send({ embeds: [draftEmbed(draft)], components: draftButtons(ref.id, "pending"), allowedMentions: { parse: [] } });
  await ref.set({ messageId: posted.id }, { merge: true });
  return { id: ref.id };
}

/** Pacing facts for a channel: its newest message, and whether a person posted in #announcements today. */
async function readChannelContext(client, channelId, settings, now) {
  const fetchChannel = async (id) => client.channels.cache?.get(id) || client.channels.fetch(id);
  const target = await fetchChannel(channelId);
  const latest = await target.messages.fetch({ limit: 1 });
  const lastChannelMessageAt = latest.first()?.createdTimestamp ?? null;
  const announcements = channelId === shared.discord.channels.announcements ? target : await fetchChannel(shared.discord.channels.announcements);
  const recent = await announcements.messages.fetch({ limit: 20 });
  const today = localParts(now, settings.tz).dateKey;
  const adminPostedToday = [...recent.values()].some((message) =>
    !message.author?.bot && localParts(new Date(message.createdTimestamp), settings.tz).dateKey === today);
  return { lastChannelMessageAt, adminPostedToday };
}

/** Record a final decision in bot_state/announcer: cooldown always; history and topic memory on publish. */
async function recordDecision(db, draft, outcome, now) {
  const ref = stateRef(db);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const state = (snap.exists && snap.data()) || {};
    const patch = { perSignal: { ...(state.perSignal || {}), [draft.signalKey]: now } };
    if (outcome === "published") {
      patch.published = [...(state.published || []), { at: now, key: draft.signalKey, kind: draft.kind, channelId: draft.channelId }].slice(-50);
      patch.lastKind = draft.kind;
      patch.lastPublishedAt = now;
      if (draft.kind === "upcomingClubEvents") {
        const promoted = { ...(state.promotedEvents || {}) };
        for (const name of draft.meta?.eventNames || []) promoted[name] = now;
        patch.promotedEvents = promoted;
      }
      if (draft.kind === "newFeatures" && draft.features?.length) {
        const known = new Set((state.shippedFeatures || []).map((feature) => feature.slug));
        const added = draft.features.filter((feature) => !known.has(feature.slug)).map((feature) => ({ ...feature, at: now }));
        patch.shippedFeatures = [...(state.shippedFeatures || []), ...added].slice(-40);
      }
      if (draft.meta?.shippedSlug) {
        patch.shippedFeatures = (patch.shippedFeatures || state.shippedFeatures || []).map((feature) =>
          feature.slug === draft.meta.shippedSlug ? { ...feature, spotlightedAt: now } : feature);
      }
    }
    tx.set(ref, patch, { merge: true });
  });
}

/**
 * Publish a draft now if pacing allows (or force), else queue it.
 * @returns {Promise<{ ok: boolean, state: string, reason?: string, url?: string, draft?: object }>}
 */
async function publishDraft(client, draftId, { by, text, force = false, settings }, deps = defaultDeps()) {
  const ref = deps.db.collection(COLLECTION).doc(draftId);
  const claim = await deps.db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const draft = snap.exists ? snap.data() : null;
    if (!draft || !OPEN.includes(draft.status)) return { ok: false, state: draft?.status || "missing" };
    const patch = { status: "publishing", previousStatus: draft.status };
    if (text) patch.text = String(text).slice(0, MAX_POST_CHARS);
    if (by && !draft.approvedBy) Object.assign(patch, { approvedBy: by, approvedAt: deps.now() });
    tx.set(ref, patch, { merge: true });
    return { ok: true, draft: { ...draft, ...patch } };
  });
  if (!claim.ok) return claim;
  const draft = claim.draft;
  const now = deps.now();

  let stateData = {};
  try {
    const snap = await stateRef(deps.db).get();
    stateData = (snap.exists && snap.data()) || {};
    if (!force) {
      const context = await readChannelContext(client, draft.channelId, settings, now);
      const verdict = canPostNow({ now, settings, state: stateData, ...context });
      if (!verdict.ok) {
        await ref.set({ status: "queued", queuedReason: verdict.reason }, { merge: true });
        return { ok: false, state: "queued", reason: verdict.reason, draft: { ...draft, status: "queued" } };
      }
    }
    const channel = client.channels.cache?.get(draft.channelId) || await client.channels.fetch(draft.channelId);
    const posted = await channel.send({ content: draft.text, allowedMentions: { parse: [] } });
    await ref.set({ status: "published", publishedAt: now, postedMessageId: posted.id, decidedBy: by || draft.approvedBy || null }, { merge: true });
    await recordDecision(deps.db, draft, "published", now);
    return { ok: true, state: "published", url: posted.url, draft: { ...draft, status: "published" } };
  } catch (error) {
    // Nothing was posted (or we cannot tell): hand it back so it is tried again.
    await ref.set({ status: draft.previousStatus === "queued" || draft.approvedBy ? "queued" : "pending", lastError: String(error?.message || error) }, { merge: true });
    console.error(`Announcer publish failed for ${draftId}:`, error?.message || error);
    return { ok: false, state: "error", reason: String(error?.message || error) };
  }
}

async function closeDraft(draftId, status, { by }, deps = defaultDeps()) {
  const ref = deps.db.collection(COLLECTION).doc(draftId);
  const result = await deps.db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const draft = snap.exists ? snap.data() : null;
    if (!draft || !OPEN.includes(draft.status)) return { ok: false, state: draft?.status || "missing" };
    tx.set(ref, { status, decidedBy: by || null, decidedAt: deps.now() }, { merge: true });
    return { ok: true, draft };
  });
  if (result.ok) await recordDecision(deps.db, result.draft, status, deps.now());
  return result;
}

async function listOpenDrafts(db) {
  const snap = await db.collection(COLLECTION).where("status", "in", OPEN).get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/** Edit a draft's message in the moderators channel. Best effort: the decision is already stored. */
async function updateModeratorMessage(client, draft, note) {
  if (!draft?.messageId) return;
  try {
    const channel = await client.channels.fetch(MODERATORS_CHANNEL_ID);
    const message = await channel.messages.fetch(draft.messageId);
    const embed = EmbedBuilder.from(message.embeds[0]).setFooter({ text: note });
    if (draft.text) embed.setDescription(draft.text.slice(0, 4000));
    await message.edit({ embeds: [embed], components: draft.status === "queued" ? draftButtons(draft.id, "queued") : [] });
  } catch (error) {
    console.warn("Announcer could not update the moderator message:", error?.message || error);
  }
}

/** Expire open drafts past their date. */
async function expireDrafts(client, deps = defaultDeps()) {
  const now = deps.now();
  for (const draft of await listOpenDrafts(deps.db)) {
    if ((toMs(draft.expiresAt) || 0) > now.getTime()) continue;
    const result = await closeDraft(draft.id, "expired", { by: null }, deps);
    if (result.ok) await updateModeratorMessage(client, { ...draft, status: "expired" }, "⌛ Udløbet uden at blive postet");
  }
}

/** Post the longest-waiting queued draft if pacing allows now. */
async function publishQueued(client, settings, deps = defaultDeps()) {
  const queued = (await listOpenDrafts(deps.db))
    .filter((draft) => draft.status === "queued")
    .sort((a, b) => (toMs(a.approvedAt) || 0) - (toMs(b.approvedAt) || 0));
  if (!queued.length) return null;
  const result = await publishDraft(client, queued[0].id, { settings }, deps);
  if (result.ok) await updateModeratorMessage(client, { ...queued[0], ...result.draft, id: queued[0].id }, `✅ Postet fra køen: ${result.url}`);
  return result;
}

const ALREADY = { published: "allerede postet", rejected: "allerede afvist", expired: "udløbet", publishing: "ved at blive postet", missing: "findes ikke længere" };

/** Buttons and the edit modal in the moderators channel. */
async function handleAnnouncerInteraction(interaction, deps = defaultDeps()) {
  const [, action, draftId] = interaction.customId.split(":");
  if (!canModerate(interaction)) {
    await interaction.reply({ content: "Kun moderatorer kan godkende opslag.", ephemeral: true });
    return;
  }
  const by = interaction.user.username;

  if (action === "edit") {
    const snap = await deps.db.collection(COLLECTION).doc(draftId).get();
    const draft = snap.exists ? snap.data() : null;
    if (!draft || !OPEN.includes(draft.status)) {
      await interaction.reply({ content: `Forslaget er ${ALREADY[draft?.status] || "afgjort"}.`, ephemeral: true });
      return;
    }
    const modal = new ModalBuilder().setCustomId(`${PREFIX}modal:${draftId}`).setTitle("Ret opslag").addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("text").setLabel("Opslag").setStyle(TextInputStyle.Paragraph).setMaxLength(MAX_POST_CHARS).setValue(draft.text.slice(0, MAX_POST_CHARS)),
      ),
    );
    await interaction.showModal(modal);
    return;
  }

  if (action === "publish" || action === "modal" || action === "force") {
    await interaction.deferUpdate();
    const settings = await require("./settings").loadSettings(deps.db);
    const text = action === "modal" ? interaction.fields.getTextInputValue("text") : undefined;
    const result = await publishDraft(interaction.client, draftId, { by, text, force: action === "force", settings }, deps);
    const embed = EmbedBuilder.from(interaction.message.embeds[0]);
    if (result.draft?.text) embed.setDescription(result.draft.text.slice(0, 4000));
    if (result.state === "published") {
      await interaction.editReply({ embeds: [embed.setFooter({ text: `✅ Postet af ${by}: ${result.url}` })], components: [] });
    } else if (result.state === "queued") {
      const why = REASON_TEXT[result.reason] || result.reason;
      await interaction.editReply({ embeds: [embed.setFooter({ text: `⏳ Godkendt af ${by} – i kø (${why}). Postes automatisk når der er plads.` })], components: draftButtons(draftId, "queued") });
    } else if (result.state === "error") {
      await interaction.followUp({ content: `⚠️ Kunne ikke poste: ${result.reason}`, ephemeral: true });
    } else {
      await interaction.followUp({ content: `Forslaget er ${ALREADY[result.state] || "afgjort"}.`, ephemeral: true });
    }
    return;
  }

  if (action === "reject") {
    const result = await closeDraft(draftId, "rejected", { by }, deps);
    if (!result.ok) {
      await interaction.reply({ content: `Forslaget er ${ALREADY[result.state] || "afgjort"}.`, ephemeral: true });
      return;
    }
    const embed = EmbedBuilder.from(interaction.message.embeds[0]).setFooter({ text: `❌ Afvist af ${by}` });
    await interaction.update({ embeds: [embed], components: [] });
  }
}

function isAnnouncerInteraction(interaction) {
  return (interaction.isButton() || interaction.isModalSubmit()) && interaction.customId.startsWith(PREFIX);
}

module.exports = {
  COLLECTION,
  STATE_DOC,
  MODERATORS_CHANNEL_ID,
  parseFeatureNews,
  writeDraft,
  createDraft,
  publishDraft,
  publishQueued,
  closeDraft,
  expireDrafts,
  listOpenDrafts,
  readChannelContext,
  recordDecision,
  handleAnnouncerInteraction,
  isAnnouncerInteraction,
  defaultDeps,
  stateRef,
};
