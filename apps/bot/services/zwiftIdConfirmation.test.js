const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { loadCommonJs } = require("./test-support/verification");

const handler = loadCommonJs(readFileSync(path.resolve(__dirname, "../handlers/zwiftIdMessageHandler.js"), "utf8"), {
  "discord.js": require("discord.js"),
  "../services/firebase": { linkUserZwiftId: async () => {}, getUserZwiftId: async () => null },
  "../services/riderIdentity": { lookupRiderIdentity: async () => ({ error: true }) },
  "./memberHandler": { checkVerificationAfterZwiftLink: async () => {} },
  "../constants.json": require("../constants.json"),
});

const card = { zwift: { name: "Anna Hansen", country: "DNK", avatar: "https://cdn.zwift.com/a.jpg", racingScore: 512, category: "B" }, zp: null, zpUrl: "https://zwiftpower.com/profile.php?z=1" };
const labels = (payload) => payload.components[0].components.map((button) => button.data.label);
const customIds = (payload) => payload.components[0].components.map((button) => button.data.custom_id);

test("a found rider shows the card with the avatar and a confirm button", () => {
  const payload = handler.buildZwiftIdConfirmation("u1", "123456", card);
  const embed = payload.embeds[0].data;
  assert.equal(embed.title, "🔗 Er det dig?");
  assert.match(embed.fields[0].value, /Anna Hansen/);
  assert.equal(embed.thumbnail.url, card.zwift.avatar);
  assert.deepEqual(customIds(payload), ["confirm_zwiftid_u1_123456", "cancel_zwiftid_u1"]);
});

test("not found offers Link alligevel on the routed confirm prefix", () => {
  const payload = handler.buildZwiftIdConfirmation("u1", "123456", { notFound: true });
  assert.match(payload.embeds[0].data.description, /kan ikke finde/);
  assert.equal(labels(payload)[0], "Link alligevel");
  assert.ok(customIds(payload)[0].startsWith("confirm_zwiftid_"));
});

test("a lookup error keeps the number-only confirm", () => {
  const payload = handler.buildZwiftIdConfirmation("u1", "123456", { error: true });
  assert.equal(payload.embeds[0].data.title, "🔗 Zwift ID Confirmation");
  assert.equal(labels(payload)[0], "✅ Ja, det er mig");
});

test("a rejected avatar is sent again without the thumbnail", async () => {
  const payload = handler.buildZwiftIdConfirmation("u1", "123456", card);
  const sent = [];
  await handler.sendConfirmation(async (p) => {
    if (p.embeds[0].data.thumbnail) throw Object.assign(new Error("Invalid Form Body"), { code: 50035 });
    sent.push(p);
  }, payload);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].embeds[0].data.thumbnail, undefined);
});
