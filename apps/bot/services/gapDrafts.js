/**
 * Knowledge gaps answered by the bot itself, approved by a moderator.
 *
 * When the club assistant logs a new knowledge gap, DZR Helper researches it (announcements,
 * knowledge base, web) and writes a short Danish article. The draft is posted in the moderators
 * channel with Publish / Edit / Reject buttons. Nothing reaches bot_knowledge until a moderator
 * presses Publish, so a wrong web snippet never becomes the bot's answer on its own.
 *
 *   knowledge_gap_drafts/{id}  { gapId, topic, category, title, content, state, messageId, ... }
 *     state: pending -> published | rejected; not_found when the helper found no answer
 *
 * The draft holds only the gap topic (the model's own summary, never a member's words) and what
 * the helper wrote, so nothing a member typed reaches the moderators channel.
 */
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require("discord.js");
const shared = require("../constants.json");
const { COLLECTIONS: STATS_COLLECTIONS } = require("./assistantDmStats");

const MODERATORS_CHANNEL_ID = shared.discord.channels.moderators;
const DRAFTS = shared.firestore.knowledgeGapDrafts;
const KNOWLEDGE = shared.firestore.botKnowledge;
const PREFIX = "gapdraft:";
const DRAFTS_PER_DAY = Number.parseInt(process.env.GAP_DRAFTS_PER_DAY || "10", 10);
const MAX_ARTICLE_CHARS = 3500;

let openaiClient = null;
function defaultDeps() {
  // Required lazily: firebase initialises on load, which tests must not trigger.
  const firebase = require("./firebase");
  const { runHelper } = require("./helperAgent");
  const config = require("../config/config");
  if (!openaiClient && config.openai?.apiKey) {
    const OpenAI = require("openai");
    openaiClient = new OpenAI({ apiKey: config.openai.apiKey });
  }
  return { db: firebase.db, runHelper, openai: openaiClient, now: () => new Date() };
}

const draftsToday = new Map();
/** In memory, so a restart resets it: a safety net against a loop, not a budget. */
function takeDraftSlot(now = new Date(), limit = DRAFTS_PER_DAY) {
  const key = now.toISOString().slice(0, 10);
  const used = draftsToday.get(key) || 0;
  if (used >= limit) return false;
  draftsToday.clear();
  draftsToday.set(key, used + 1);
  return true;
}

function draftQuestion(gap) {
  return [
    `Members of the DZR Discord asked the club bot about this, and it had no answer: "${gap.topic}" (category: ${gap.category}).`,
    "Write a short knowledge-base article in Danish that answers it, for the club bot to use from now on.",
    "Search DZR's own sources first: search_announcements and search_club_knowledge. Use the web only for general Zwift facts, never for facts about DZR itself.",
    "Do not invent DZR facts, dates, prices or names. If the sources do not answer it, reply with exactly NOT_FOUND and nothing else.",
    "Otherwise reply in exactly this form:",
    "TITLE: <a short title>",
    "ARTICLE:",
    "<the article, at most 1200 characters, plain Discord markdown>",
    "Kilder: <the links you used, one per line; announcement links as given>",
  ].join("\n");
}

/** { title, content } from the helper's answer, or null when it found nothing usable. */
function parseDraft(answer) {
  const text = String(answer || "").trim();
  if (!text || /^NOT_FOUND\b/.test(text)) return null;
  const title = text.match(/^TITLE:\s*(.+)$/m)?.[1]?.trim();
  const body = text.split(/^ARTICLE:\s*$/m)[1]?.trim();
  if (!title || !body) return null;
  return { title: title.slice(0, 100), content: body.slice(0, MAX_ARTICLE_CHARS) };
}

function slugify(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/æ/g, "ae").replace(/ø/g, "oe").replace(/å/g, "aa")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "artikel";
}

function buttons(id, state) {
  if (state === "not_found") {
    return [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Skriv artikel").setURL(`${shared.siteOrigin}/admin/knowledge`),
      new ButtonBuilder().setCustomId(`${PREFIX}reject:${id}`).setStyle(ButtonStyle.Secondary).setLabel("Luk"),
    )];
  }
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${PREFIX}publish:${id}`).setStyle(ButtonStyle.Success).setLabel("Publicér").setEmoji("✅"),
    new ButtonBuilder().setCustomId(`${PREFIX}edit:${id}`).setStyle(ButtonStyle.Primary).setLabel("Ret og publicér").setEmoji("✏️"),
    new ButtonBuilder().setCustomId(`${PREFIX}reject:${id}`).setStyle(ButtonStyle.Danger).setLabel("Afvis").setEmoji("❌"),
  )];
}

function draftEmbed(draft) {
  const embed = new EmbedBuilder()
    .setColor(draft.state === "not_found" ? 0x99aab5 : 0x5865f2)
    .setTitle(draft.state === "not_found" ? "📚 Videnshul uden svar" : `📚 Forslag: ${draft.title}`)
    .addFields(
      { name: "Spørgsmål", value: draft.topic.slice(0, 1000) },
      { name: "Kategori", value: draft.category, inline: true },
      { name: "Spurgt", value: `${draft.count || 1} gang(e)`, inline: true },
    );
  embed.setDescription(draft.state === "not_found"
    ? "Botten fandt ikke svaret i opslag, vidensbasen eller på nettet. Skriv en artikel, eller post svaret i #announcements, så finder botten det fremover."
    : draft.content.slice(0, 4000));
  return embed;
}

/**
 * Research one gap and post the draft for moderators. Called without await after a gap is
 * recorded; never throws.
 */
async function draftGapArticle(client, gapId, deps = defaultDeps()) {
  try {
    if (!takeDraftSlot(deps.now())) {
      console.warn(`Gap draft skipped (daily limit): ${gapId}`);
      // Release the claim so the next report of this gap drafts it.
      await deps.db.collection(STATS_COLLECTIONS.gaps).doc(gapId).set({ draftedAt: null }, { merge: true });
      return null;
    }
    const gapSnap = await deps.db.collection(STATS_COLLECTIONS.gaps).doc(gapId).get();
    if (!gapSnap.exists) return null;
    const gap = gapSnap.data();

    const helped = await deps.runHelper({
      openai: deps.openai,
      question: draftQuestion(gap),
      asker: { source: "gap_draft" },
    });
    const parsed = helped?.success ? parseDraft(helped.answer) : null;
    const draft = {
      gapId,
      topic: gap.topic,
      category: gap.category,
      count: gap.count || 1,
      state: parsed ? "pending" : "not_found",
      title: parsed?.title || gap.topic,
      content: parsed?.content || "",
      createdAt: deps.now(),
    };
    const ref = await deps.db.collection(DRAFTS).add(draft);
    await deps.db.collection(STATS_COLLECTIONS.gaps).doc(gapId).set({ draftId: ref.id }, { merge: true });

    const channel = await client.channels.fetch(MODERATORS_CHANNEL_ID);
    const posted = await channel.send({ embeds: [draftEmbed(draft)], components: buttons(ref.id, draft.state) });
    await ref.set({ messageId: posted.id }, { merge: true });
    return { id: ref.id, state: draft.state };
  } catch (error) {
    console.error(`Gap draft failed for ${gapId}:`, error?.message || error);
    return null;
  }
}

function canModerate(interaction) {
  const perms = interaction.memberPermissions;
  return !!(perms?.has(PermissionFlagsBits.ManageMessages) || perms?.has(PermissionFlagsBits.Administrator));
}

/**
 * Publish a pending draft as a bot_knowledge article and mark the gap solved, in one transaction
 * so two moderators pressing at once publish it once.
 */
async function publishDraft(draftId, { title, content, by }, deps = defaultDeps()) {
  const draftRef = deps.db.collection(DRAFTS).doc(draftId);
  return deps.db.runTransaction(async (tx) => {
    const snap = await tx.get(draftRef);
    const draft = snap.exists ? snap.data() : null;
    if (!draft || draft.state !== "pending") return { ok: false, state: draft?.state || "missing" };

    const finalTitle = String(title || draft.title).trim().slice(0, 100);
    const finalContent = String(content || draft.content).trim().slice(0, MAX_ARTICLE_CHARS);
    const base = slugify(finalTitle);
    let key = base;
    for (let n = 2; n < 20; n++) {
      const existing = await tx.get(deps.db.collection(KNOWLEDGE).doc(key));
      if (!existing.exists) break;
      key = `${base}-${n}`;
    }
    const gapRef = deps.db.collection(STATS_COLLECTIONS.gaps).doc(draft.gapId);
    const now = deps.now();
    tx.set(deps.db.collection(KNOWLEDGE).doc(key), {
      key,
      title: finalTitle,
      content: finalContent,
      tags: [draft.category, "auto"],
      source: "gap_draft",
      approvedBy: by,
      createdAt: now,
    });
    tx.set(gapRef, { status: "solved", articleKey: key, solvedAt: now }, { merge: true });
    tx.set(draftRef, { state: "published", title: finalTitle, content: finalContent, articleKey: key, decidedBy: by, decidedAt: now }, { merge: true });
    return { ok: true, key, title: finalTitle, content: finalContent, draft };
  });
}

async function rejectDraft(draftId, { by }, deps = defaultDeps()) {
  const draftRef = deps.db.collection(DRAFTS).doc(draftId);
  return deps.db.runTransaction(async (tx) => {
    const snap = await tx.get(draftRef);
    const draft = snap.exists ? snap.data() : null;
    if (!draft || !["pending", "not_found"].includes(draft.state)) return { ok: false, state: draft?.state || "missing" };
    tx.set(draftRef, { state: "rejected", decidedBy: by, decidedAt: deps.now() }, { merge: true });
    return { ok: true, draft };
  });
}

function decidedEmbed(message, note) {
  const embed = EmbedBuilder.from(message.embeds[0]);
  return embed.setFooter({ text: note });
}

const ALREADY = { published: "allerede publiceret", rejected: "allerede afvist", missing: "findes ikke længere" };

/** Buttons and the edit modal in the moderators channel. */
async function handleGapDraftInteraction(interaction, deps = defaultDeps()) {
  const [, action, draftId] = interaction.customId.split(":");
  if (!canModerate(interaction)) {
    await interaction.reply({ content: "Kun moderatorer kan godkende artikler.", ephemeral: true });
    return;
  }
  const by = interaction.user.username;

  if (action === "edit") {
    const snap = await deps.db.collection(DRAFTS).doc(draftId).get();
    const draft = snap.exists ? snap.data() : null;
    if (!draft || draft.state !== "pending") {
      await interaction.reply({ content: `Forslaget er ${ALREADY[draft?.state] || "afgjort"}.`, ephemeral: true });
      return;
    }
    const modal = new ModalBuilder().setCustomId(`${PREFIX}modal:${draftId}`).setTitle("Ret artikel").addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("title").setLabel("Titel").setStyle(TextInputStyle.Short).setMaxLength(100).setValue(draft.title.slice(0, 100)),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("content").setLabel("Artikel").setStyle(TextInputStyle.Paragraph).setMaxLength(MAX_ARTICLE_CHARS).setValue(draft.content.slice(0, MAX_ARTICLE_CHARS)),
      ),
    );
    await interaction.showModal(modal);
    return;
  }

  if (action === "publish" || action === "modal") {
    const edited = action === "modal"
      ? { title: interaction.fields.getTextInputValue("title"), content: interaction.fields.getTextInputValue("content") }
      : {};
    const result = await publishDraft(draftId, { ...edited, by }, deps);
    if (!result.ok) {
      await interaction.reply({ content: `Forslaget er ${ALREADY[result.state] || "afgjort"}.`, ephemeral: true });
      return;
    }
    const embed = decidedEmbed(interaction.message, `✅ Publiceret af ${by} som "${result.key}"`)
      .setTitle(`📚 ${result.title}`)
      .setDescription(result.content.slice(0, 4000));
    await interaction.update({ embeds: [embed], components: [] });
    return;
  }

  if (action === "reject") {
    const result = await rejectDraft(draftId, { by }, deps);
    if (!result.ok) {
      await interaction.reply({ content: `Forslaget er ${ALREADY[result.state] || "afgjort"}.`, ephemeral: true });
      return;
    }
    await interaction.update({ embeds: [decidedEmbed(interaction.message, `❌ Lukket af ${by}`)], components: [] });
  }
}

function isGapDraftInteraction(interaction) {
  return (interaction.isButton() || interaction.isModalSubmit()) && interaction.customId.startsWith(PREFIX);
}

module.exports = {
  draftGapArticle,
  handleGapDraftInteraction,
  isGapDraftInteraction,
  publishDraft,
  rejectDraft,
  parseDraft,
  draftQuestion,
  slugify,
  takeDraftSlot,
  MODERATORS_CHANNEL_ID,
};
