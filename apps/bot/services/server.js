const express = require("express");
const axios = require("axios");
const config = require("../config/config");
const { createStreamingRouter } = require("./streaming/router");

function setupKeepAliveServer({ streaming } = {}) {
  const app = express();
  app.get("/", (req, res) => res.send("Bot is running!"));
  if (streaming) app.use("/streaming", createStreamingRouter(streaming));
  app.listen(config.server.port, "0.0.0.0", () =>
    console.log(`Bot HTTP server running on port ${config.server.port}`)
  );

  // Keep-Alive Ping
  setInterval(async () => {
    try {
      await axios.get(config.server.keepAliveUrl);
      console.log("✅ Keep-alive ping sent to prevent sleeping.");
    } catch (error) {
      console.error("❌ Keep-alive ping failed:", error);
    }
  }, config.server.keepAliveInterval);
}

module.exports = {
  setupKeepAliveServer,
};
