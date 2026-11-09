const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { resolve } = require("node:path");

function deployment(value) {
  const env = { ...process.env };
  if (value === undefined) delete env.STREAMING_SETUP_ENABLED;
  else env.STREAMING_SETUP_ENABLED = value;
  // Fresh modules for each startup: exercise the same config/command load order
  // as bot.js without loading its Firebase client or registering with Discord.
  return JSON.parse(execFileSync(process.execPath, ["-e", `
    require('./config/config');
    const commands = require('./commands/slashCommands');
    process.stdout.write(JSON.stringify(commands));
  `], { cwd: resolve(__dirname, "../.."), env, encoding: "utf8" }));
}

test("startup always registers browser onboarding alongside unchanged legacy commands, ignoring the obsolete flag", () => {
  const commands = deployment(undefined);
  const command = commands.find(c => c.name === "streaming_add_new");
  assert.ok(command);
  assert.equal(command.dm_permission, false);
  assert.equal(command.default_member_permissions, undefined);
  for (const name of ["streaming_add", "streaming_remove", "streaming_overview"]) {
    assert.ok(commands.some(c => c.name === name));
  }
  for (const value of ["false", "true", "", "1", "TRUE", " true ", "yes"]) {
    assert.deepEqual(deployment(value), commands, "obsolete deployment values cannot alter any command definition");
  }
});
