// Run inside official Windows/macOS OBS, with a local HTTPS backend and no accounts.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import https from "node:https";
import { spawn, spawnSync, execFile } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const executable = process.env.OBS_EXECUTABLE;
const expectedVersion = process.env.OBS_VERSION || "31.1.2";
const artifacts = path.resolve(process.env.OBS_SMOKE_ARTIFACTS || path.join(os.tmpdir(), "dzr-obs-native-artifacts"));
const require = createRequire(import.meta.url);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const luaString = (value) => {
  assert.ok(!String(value).includes("]====]"), "unsupported Lua fixture string");
  return `[====[${value}]====]`;
};

let smokeDirectory, configDirectory, createdConfig = false;
let child, exited, closeRequested = false, server, token = "";
let stdout = "", stderr = "", nativeEvidence;
const requests = [];
const redact = (value) => token ? String(value).replaceAll(token, "<fixture-token-redacted>") : String(value);

async function readEvidence() {
  try { return JSON.parse(await fs.readFile(path.join(artifacts, "lua-evidence.json"), "utf8")); }
  catch { return null; } // A concurrent native write may be incomplete; poll again.
}

async function waitFor(check, milliseconds, label) {
  const deadline = Date.now() + milliseconds;
  while (Date.now() < deadline) {
    const result = await check();
    if (result) return result;
    if (exited) throw new Error(`OBS exited before ${label}: ${JSON.stringify(exited)}`);
    await delay(200);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function closeOBS() {
  if (!child || exited || closeRequested) return;
  closeRequested = true;
  if (process.platform === "win32") {
    // WM_CLOSE lets OBS save its collection and call the real script_unload.
    await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
      `$obsSmokeProcess = [System.Diagnostics.Process]::GetProcessById(${child.pid}); if (-not $obsSmokeProcess.CloseMainWindow()) { throw 'OBS did not expose a main window to close' }`], { timeout: 10000 });
  } else {
    const app = path.resolve(path.dirname(executable), "../..");
    const appleString = app.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
    await execFileAsync("/usr/bin/osascript", ["-e", `tell application "${appleString}" to quit`], { timeout: 10000 });
  }
}

async function captureOBSLogs() {
  if (!configDirectory) return "";
  let logs = "";
  for (const directory of ["logs", "crashes"]) {
    let entries;
    try { entries = await fs.readdir(path.join(configDirectory, directory)); }
    catch { continue; }
    for (const filename of entries) {
      if (!/\.(txt|log)$/i.test(filename)) continue;
      const content = await fs.readFile(path.join(configDirectory, directory, filename), "utf8");
      await fs.writeFile(path.join(artifacts, `${directory}-${filename}`), redact(content));
      logs += content;
    }
  }
  return logs;
}

async function main() {
  await fs.mkdir(artifacts, { recursive: true });
  for (const filename of ["lua-evidence.json", "result.json", "failure.txt"]) {
    await fs.rm(path.join(artifacts, filename), { force: true });
  }
  assert.ok(["win32", "darwin"].includes(process.platform), "native OBS smoke requires Windows or macOS; it cannot skip");
  assert.ok(executable, "OBS_EXECUTABLE must point to the official OBS application");
  await fs.access(executable);
  smokeDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "dzr-obs-native-"));
  const caFile = path.join(smokeDirectory, "fixture-cert.pem");
  const tlsKey = path.join(smokeDirectory, "fixture-key.pem");
  const opensslConfig = path.join(smokeDirectory, "openssl.cnf");
  await fs.writeFile(opensslConfig, `[req]\nprompt=no\ndistinguished_name=dn\nx509_extensions=extensions\n[dn]\nCN=127.0.0.1\n[extensions]\nsubjectAltName=IP:127.0.0.1\nbasicConstraints=critical,CA:TRUE\nkeyUsage=critical,digitalSignature,keyEncipherment,keyCertSign\nextendedKeyUsage=serverAuth\n`);
  const opensslCandidates = [process.env.OPENSSL_BIN, "openssl",
    "C:\\Program Files\\Git\\usr\\bin\\openssl.exe",
    "/opt/homebrew/opt/openssl@3/bin/openssl", "/usr/local/opt/openssl@3/bin/openssl"].filter(Boolean);
  let certificate;
  for (const binary of opensslCandidates) {
    const result = spawnSync(binary, ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "2",
      "-config", opensslConfig, "-keyout", tlsKey, "-out", caFile], { encoding: "utf8", timeout: 15000 });
    if (result.status === 0) { certificate = binary; break; }
  }
  assert.ok(certificate, "OpenSSL must generate the isolated TLS certificate; native smoke cannot skip");

  const { createNativeBackend } = require("./obs-native-backend.cjs");
  const backend = await createNativeBackend();
  token = backend.token;
  assert.match(token, /^dzrs_\d{17,20}\.[\w-]{43}$/);
  server = https.createServer({ key: await fs.readFile(tlsKey), cert: await fs.readFile(caFile) }, backend.app);
  // Capture the public URL before Express temporarily strips its mounted prefix.
  server.prependListener("request", (request, response) => {
    const item = { method: request.method, path: request.url };
    requests.push(item);
    response.on("finish", () => { item.status = response.statusCode; });
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const endpoint = `https://127.0.0.1:${server.address().port}/streaming/obs`;

  configDirectory = process.platform === "win32"
    ? path.resolve(path.dirname(executable), "../../config/obs-studio")
    : path.join(os.homedir(), "Library", "Application Support", "obs-studio");
  // These paths belong to the freshly extracted application / fresh hosted runner.
  // Refuse to replace a developer's existing OBS settings when used locally.
  await assert.rejects(fs.access(configDirectory), { code: "ENOENT" }, "OBS native smoke needs a fresh configuration directory");
  await fs.mkdir(path.join(configDirectory, "basic", "scenes"), { recursive: true });
  createdConfig = true;
  await fs.mkdir(path.join(configDirectory, "basic", "profiles", "DZRSmoke"), { recursive: true });
  await fs.writeFile(path.join(configDirectory, "global.ini"), "[General]\nMacOSPermissionsDialogLastShown=999\nEnableAutoUpdates=false\n");
  await fs.writeFile(path.join(configDirectory, "user.ini"), "[General]\nFirstRun=true\n[Basic]\nProfile=DZR Smoke\nProfileDir=DZRSmoke\nSceneCollection=DZR Smoke\nSceneCollectionFile=DZRSmoke\n");
  await fs.writeFile(path.join(configDirectory, "basic", "profiles", "DZRSmoke", "basic.ini"), "[General]\nName=DZR Smoke\n[Video]\nBaseCX=320\nBaseCY=180\nOutputCX=320\nOutputCY=180\nFPSType=0\nFPSCommon=10\n");
  const wrapper = path.join(smokeDirectory, "obs-native-smoke.lua");
  await fs.copyFile(path.join(repository, "scripts", "obs-native-smoke.lua"), wrapper);
  const settings = { endpoint, key: token, video_link: "", platform: "auto" };
  await fs.writeFile(path.join(configDirectory, "basic", "scenes", "DZRSmoke.json"), JSON.stringify({
    name: "DZR Smoke", version: 2, sources: [],
    modules: { "scripts-tool": [{ path: wrapper.replaceAll("\\", "/"), settings }] },
  }));
  const luaConfig = path.join(smokeDirectory, "native-config.lua");
  const values = { expectedVersion, caFile, evidenceFile: path.join(artifacts, "lua-evidence.json"),
    productionScript: path.join(repository, "apps", "bot", "assets", "dzr-stream.lua") };
  await fs.writeFile(luaConfig, `return {\n${Object.entries(values).map(([name, value]) => `  ${name} = ${luaString(value)},`).join("\n")}\n}\n`);
  const args = ["--multi", "--disable-shutdown-check", "--disable-updater", "--disable-missing-files-check",
    "--only-bundled-plugins", "--collection", "DZR Smoke", "--profile", "DZR Smoke"];
  if (process.platform === "win32") args.push("--portable");
  await fs.writeFile(path.join(artifacts, "launch.json"), JSON.stringify({ platform: process.platform,
    arch: process.arch, expectedVersion, executable, args, certificateGenerator: certificate }, null, 2));
  child = spawn(executable, args, { cwd: path.dirname(executable),
    env: { ...process.env, DZR_OBS_SMOKE_CONFIG: luaConfig }, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.on("error", (error) => { exited = { error: error.message }; });
  child.on("exit", (code, signal) => { exited = { code, signal }; });

  nativeEvidence = await waitFor(async () => {
    const evidence = await readEvidence();
    if (evidence?.error) throw new Error(evidence.error);
    return evidence?.accepted && evidence.buttonClicked ? evidence : null;
  }, 90000, "the real OBS test button's authenticated HTTPS callback");
  for (const field of ["loaded", "updated", "properties", "buttonClicked", "accepted"]) assert.equal(nativeEvidence[field], true, field);
  assert.equal(nativeEvidence.obsVersion, expectedVersion);
  assert.match(nativeEvidence.luaJIT, /^LuaJIT /);
  assert.match(nativeEvidence.curlVersion, /^libcurl\//);
  assert.equal(nativeEvidence.ffiOS, process.platform === "win32" ? "Windows" : "OSX");
  const backendResult = await (backend.getResult || backend.result)();
  assert.ok(backendResult.lastCallbackAt > 0, "the real backend must persist the authenticated callback");
  assert.ok(backendResult.authenticatedCallbacks >= 1);
  assert.equal(backendResult.announcements, 0, "test callbacks must not announce streams");
  assert.equal(backendResult.providerChecks, 0, "test callbacks must not query real providers");
  assert.deepEqual(requests.map(({ method, path: requestPath, status }) => ({ method, path: requestPath, status })),
    [{ method: "POST", path: "/streaming/obs", status: 202 }]);

  await closeOBS();
  // Poll separately: a successful process exit is expected during this phase.
  const exitDeadline = Date.now() + 20000;
  while (!exited && Date.now() < exitDeadline) await delay(200);
  assert.deepEqual(exited, { code: 0, signal: null }, "OBS must exit cleanly");
  nativeEvidence = await readEvidence();
  assert.equal(nativeEvidence?.unloaded, true, "OBS must call the production script_unload");
  assert.ok(!nativeEvidence.error, nativeEvidence.error);
  const logs = await captureOBSLogs();
  assert.ok(logs.length > 0, "OBS must produce a native application log");
  assert.ok(!/\[(?:Lua|obs-native-smoke\.lua)\].*(?:Error (?:calling|running|loading)|Failed to (?:call|load)|stack traceback)/i.test(logs + stdout + stderr),
    "the native OBS script log contains a runtime error");
  await fs.writeFile(path.join(artifacts, "result.json"), JSON.stringify({ ok: true,
    native: nativeEvidence, backend: backendResult, requests }, null, 2));
  console.log(`OBS ${expectedVersion} native smoke passed on ${process.platform}/${process.arch}: real LuaJIT, UI property callback, libcurl TLS, backend authentication, and clean unload.`);
}

try { await main(); }
catch (error) {
  await fs.mkdir(artifacts, { recursive: true });
  await fs.writeFile(path.join(artifacts, "failure.txt"), redact(error.stack || error));
  console.error(redact(error.stack || error));
  process.exitCode = 1;
} finally {
  if (child && !exited) {
    try { await closeOBS(); } catch { /* Preserve the original failure and logs. */ }
    const deadline = Date.now() + 5000;
    while (!exited && Date.now() < deadline) await delay(200);
    if (!exited) {
      if (process.platform === "win32") spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"]);
      else child.kill("SIGKILL");
    }
  }
  await fs.mkdir(artifacts, { recursive: true });
  await fs.writeFile(path.join(artifacts, "stdout.log"), redact(stdout));
  await fs.writeFile(path.join(artifacts, "stderr.log"), redact(stderr));
  await captureOBSLogs();
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  if (createdConfig) await fs.rm(configDirectory, { recursive: true, force: true });
  if (smokeDirectory) await fs.rm(smokeDirectory, { recursive: true, force: true });
}
