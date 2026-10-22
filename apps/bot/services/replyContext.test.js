const test = require("node:test");
const assert = require("node:assert/strict");

const { discordMessageText, addRepliedMessage, REPLIED_MESSAGE_MAX_CHARS } = require("./replyContext");

test("reads the text and embeds of a bot message", () => {
  const text = discordMessageText({
    content: "Her er dine stats:",
    embeds: [{
      title: "Christian Kjær",
      description: "zFTP 4.1 w/kg",
      fields: [{ name: "Kategori", value: "B" }],
      footer: { text: "ZwiftPower" },
    }],
  });
  assert.equal(text, "Her er dine stats:\n\nChristian Kjær\nzFTP 4.1 w/kg\nKategori: B\nZwiftPower");
  assert.equal(discordMessageText({ content: "", embeds: [] }), "");
  assert.equal(discordMessageText({ content: "x".repeat(9000) }).length, REPLIED_MESSAGE_MAX_CHARS);
});

test("a reply from someone with no history gets the bot message", () => {
  const conversation = [{ role: "system", content: "prompt" }];
  addRepliedMessage(conversation, "Det gik stærkt for DZR i aften.");
  assert.deepEqual(conversation.at(-1), { role: "assistant", content: "Det gik stærkt for DZR i aften." });
});

test("the latest bot message is not added twice", () => {
  const conversation = [
    { role: "system", content: "prompt" },
    { role: "user", content: "hvordan gik det?" },
    { role: "assistant", content: "Det gik  stærkt for DZR i aften." },
  ];
  addRepliedMessage(conversation, "Det gik stærkt for DZR i aften.");
  assert.equal(conversation.length, 3);
});

test("a stamped coach DM message counts as the same message", () => {
  const conversation = [{ role: "assistant", content: "[sent Thu 22 Oct, 21:04] Godt pas i dag." }];
  addRepliedMessage(conversation, "Godt pas i dag.");
  assert.equal(conversation.length, 1);
});

test("a reply to an older bot message adds it again as the latest", () => {
  const conversation = [
    { role: "assistant", content: "Første svar." },
    { role: "user", content: "noget andet" },
    { role: "assistant", content: "Andet svar." },
  ];
  addRepliedMessage(conversation, "Første svar.");
  assert.deepEqual(conversation.at(-1), { role: "assistant", content: "Første svar." });
});
