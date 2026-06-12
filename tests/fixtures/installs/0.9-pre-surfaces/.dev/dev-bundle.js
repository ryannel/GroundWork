#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/generators/workspace-dev-cli/cli-src/src/util/context.ts
function elapsedSince(startMs) {
  return `${Math.round((Date.now() - startMs) / 1e3)}s`;
}
var CliError, UsageError;
var init_context = __esm({
  "src/generators/workspace-dev-cli/cli-src/src/util/context.ts"() {
    "use strict";
    CliError = class extends Error {
      constructor(message, action) {
        super(message);
        this.action = action;
        this.name = "CliError";
      }
    };
    UsageError = class extends Error {
      constructor(message) {
        super(message);
        this.name = "UsageError";
      }
    };
  }
});

// src/generators/workspace-dev-cli/cli-src/src/util/proc.ts
function run(cmd, args, opts = {}) {
  const r = (0, import_child_process.spawnSync)(cmd, args, { stdio: "inherit", ...opts });
  return r.status ?? 1;
}
function capture(cmd, args, opts = {}) {
  const r = (0, import_child_process.spawnSync)(cmd, args, { encoding: "utf8", ...opts });
  return {
    status: r.status ?? (r.error ? 127 : 1),
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? ""
  };
}
function commandExists(cmd) {
  const safe = cmd.replace(/[^a-zA-Z0-9._-]/g, "");
  const probe = process.platform === "win32" ? `where ${safe}` : `command -v ${safe}`;
  const r = (0, import_child_process.spawnSync)(probe, { shell: true, stdio: "ignore" });
  return (r.status ?? 1) === 0;
}
function dockerComposeCapture(args) {
  return capture("docker", [...COMPOSE, ...args]);
}
function dockerComposeRun(args) {
  return run("docker", [...COMPOSE, ...args]);
}
function spawnBackground(command, logStream) {
  const child = (0, import_child_process.spawn)("bash", ["-c", command], {
    stdio: ["ignore", logStream, logStream],
    detached: true
  });
  child.unref();
  return child.pid ?? -1;
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
var import_child_process, COMPOSE;
var init_proc = __esm({
  "src/generators/workspace-dev-cli/cli-src/src/util/proc.ts"() {
    "use strict";
    import_child_process = require("child_process");
    COMPOSE = ["compose"];
  }
});

// src/generators/workspace-dev-cli/cli-src/src/util/paths.ts
function ensureDirs() {
  fs.mkdirSync(PID_DIR, { recursive: true });
  fs.mkdirSync(LOG_DIR, { recursive: true });
}
function pidFile(svc) {
  return path.join(PID_DIR, `${svc}.pid`);
}
function logFile(svc) {
  return path.join(LOG_DIR, `${svc}.log`);
}
var path, fs, ROOT, DEV_DIR, PID_DIR, LOG_DIR, SERVICES_DIR, TESTS_DIR, DOCS_DIR, CONFIG_PATH, GROUNDWORK_BETS_DIR;
var init_paths = __esm({
  "src/generators/workspace-dev-cli/cli-src/src/util/paths.ts"() {
    "use strict";
    path = __toESM(require("path"));
    fs = __toESM(require("fs"));
    ROOT = (() => {
      if (process.env.DEV_ROOT) return process.env.DEV_ROOT;
      let dir = process.cwd();
      for (let i = 0; i < 12; i += 1) {
        if (fs.existsSync(path.join(dir, "dev")) || fs.existsSync(path.join(dir, "docker-compose.yml")) || fs.existsSync(path.join(dir, ".groundwork"))) {
          return dir;
        }
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
      return process.cwd();
    })();
    DEV_DIR = path.join(ROOT, ".dev");
    PID_DIR = path.join(DEV_DIR, "pids");
    LOG_DIR = path.join(DEV_DIR, "logs");
    SERVICES_DIR = path.join(ROOT, "services");
    TESTS_DIR = path.join(ROOT, "tests");
    DOCS_DIR = path.join(ROOT, "docs");
    CONFIG_PATH = path.join(DEV_DIR, "dev.config.json");
    GROUNDWORK_BETS_DIR = path.join(ROOT, ".groundwork", "bets");
  }
});

// src/generators/workspace-dev-cli/cli-src/src/util/services.ts
function getAppServices() {
  if (!fs2.existsSync(SERVICES_DIR)) return [];
  return fs2.readdirSync(SERVICES_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
}
function getInfraServices() {
  const app = new Set(getAppServices());
  const r = capture("docker", ["compose", "config", "--services"]);
  if (r.status !== 0) return [];
  return r.stdout.split("\n").map((s) => s.trim()).filter(Boolean).filter((s) => !app.has(s));
}
function serviceDir(svc) {
  return path2.join(SERVICES_DIR, svc);
}
function detectType(svc) {
  const dir = serviceDir(svc);
  if (fs2.existsSync(path2.join(dir, ".air.toml"))) return "go";
  if (fs2.existsSync(path2.join(dir, "package.json"))) return "node";
  if (fs2.existsSync(path2.join(dir, "pyproject.toml"))) return "python";
  return "unknown";
}
function bootCommand(svc) {
  const dir = serviceDir(svc);
  switch (detectType(svc)) {
    case "go":
      return `cd ${JSON.stringify(dir)} && air`;
    case "node":
      return `cd ${JSON.stringify(dir)} && ([ -d node_modules ] || npm install --legacy-peer-deps) && npm run dev`;
    case "python":
      return `cd ${JSON.stringify(dir)} && uv run python src/main.py`;
    default:
      return null;
  }
}
function readPid(svc) {
  const f = pidFile(svc);
  if (!fs2.existsSync(f)) return null;
  const n = parseInt(fs2.readFileSync(f, "utf8").trim(), 10);
  return Number.isFinite(n) ? n : null;
}
function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
function isRunning(svc) {
  const pid = readPid(svc);
  if (pid === null) return false;
  if (pidAlive(pid)) return true;
  fs2.rmSync(pidFile(svc), { force: true });
  return false;
}
function isDead(svc) {
  const pid = readPid(svc);
  return pid !== null && !pidAlive(pid);
}
function writePid(svc, pid) {
  fs2.mkdirSync(PID_DIR, { recursive: true });
  fs2.writeFileSync(pidFile(svc), `${pid}
`);
}
function removePid(svc) {
  fs2.rmSync(pidFile(svc), { force: true });
}
async function killTree(pid) {
  const r = capture("pgrep", ["-P", String(pid)]);
  const children = r.stdout.split("\n").map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n));
  for (const child of children) {
    await killTree(child);
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch {
  }
  await sleep(1e3);
  if (pidAlive(pid)) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
    }
  }
}
var fs2, path2;
var init_services = __esm({
  "src/generators/workspace-dev-cli/cli-src/src/util/services.ts"() {
    "use strict";
    fs2 = __toESM(require("fs"));
    path2 = __toESM(require("path"));
    init_paths();
    init_proc();
  }
});

// src/generators/workspace-dev-cli/cli-src/src/commands/lifecycle.ts
async function start(ctx) {
  const { r } = ctx;
  const docker = ctx.args.includes("--docker");
  ensureDirs();
  const startMs = Date.now();
  if (docker) {
    r.startSpinner("Starting ALL services via Docker");
    if (dockerComposeRun(["up", "-d"]) !== 0) {
      r.failSpinner("Failed to start services");
      throw new CliError("docker compose up failed", "Run './dev doctor' to verify Docker is running.");
    }
    r.stopSpinner("All services started via Docker", elapsedSince(startMs));
    return 0;
  }
  const infra = getInfraServices();
  if (infra.length > 0) {
    r.startSpinner("Starting Infrastructure (Docker)");
    if (dockerComposeRun(["up", "-d", ...infra]) !== 0) {
      r.failSpinner("Failed to start infrastructure");
      throw new CliError("docker compose up failed", "Run './dev doctor' to verify Docker is running.");
    }
    r.stopSpinner("Infrastructure started");
  }
  const services = getAppServices();
  for (const svc of services) {
    if (isRunning(svc)) {
      r.substep(`${svc} is already running`);
      continue;
    }
    const cmd = bootCommand(svc);
    if (!cmd) {
      r.warn(`Unknown service type for ${svc}. Skipping.`);
      continue;
    }
    r.startSpinner(`Booting ${svc}`);
    const fd = fs3.openSync(logFile(svc), "a");
    const pid = spawnBackground(cmd, fd);
    fs3.closeSync(fd);
    writePid(svc, pid);
    await sleep(500);
    if (readPid(svc) !== null && !isRunning(svc)) {
      r.failSpinner(`${svc} failed to start`);
      r.errorCard(`${svc} exited immediately`, `Check .dev/logs/${svc}.log for the cause.`);
    } else {
      r.stopSpinner(`${svc} started natively (PID ${pid})`);
    }
  }
  r.success(`Development environment started. (${elapsedSince(startMs)})`);
  r.info("Run './dev logs' to read service output.");
  return 0;
}
async function stop(ctx) {
  const { r } = ctx;
  const startMs = Date.now();
  r.startSpinner("Stopping environment");
  for (const svc of getAppServices()) {
    const pid = readPid(svc);
    if (pid !== null && isRunning(svc)) {
      await killTree(pid);
    }
    removePid(svc);
  }
  if (dockerComposeRun(["down"]) !== 0) {
  }
  r.stopSpinner("Environment stopped", elapsedSince(startMs));
  return 0;
}
async function clean(ctx) {
  const { r } = ctx;
  const hard = ctx.args.includes("--hard");
  const startMs = Date.now();
  r.startSpinner("Stopping services & wiping native state");
  for (const svc of getAppServices()) {
    const pid = readPid(svc);
    if (pid !== null && isRunning(svc)) {
      await killTree(pid);
    }
  }
  fs3.rmSync(PID_DIR, { recursive: true, force: true });
  fs3.rmSync(LOG_DIR, { recursive: true, force: true });
  ensureDirs();
  r.stopSpinner("Wiped native state (.dev/pids, .dev/logs)");
  r.startSpinner("Cleaning Docker environment");
  if (hard) {
    dockerComposeRun(["down", "-v", "--remove-orphans"]);
    r.stopSpinner("Docker environment destroyed (volumes wiped)");
  } else {
    dockerComposeRun(["down", "--remove-orphans"]);
    r.stopSpinner("Docker environment stopped (volumes preserved)");
  }
  r.success(`Workspace clean complete. (${elapsedSince(startMs)})`);
  return 0;
}
async function migrate(ctx) {
  const { r } = ctx;
  const db = `${ctx.projectPrefix}-db`;
  r.startSpinner(`Waiting for database (${db})`);
  let ready = false;
  for (let i = 0; i < 120; i += 1) {
    const res = capture("docker", ["inspect", "--format={{.State.Health.Status}}", db]);
    if (res.status === 0 && res.stdout.trim() === "healthy") {
      ready = true;
      break;
    }
    await sleep(1e3);
  }
  if (!ready) {
    r.failSpinner("Database did not become healthy");
    throw new CliError(`Database ${db} not healthy after 120s`, "Run './dev start' and check 'docker compose ps'.");
  }
  r.stopSpinner("Database ready");
  for (const svc of getAppServices()) {
    const dbName = svc;
    r.step(`Migrating ${svc} (db: ${dbName})`);
    const exists = capture("docker", [
      "exec",
      db,
      "psql",
      "-U",
      "postgres",
      "-tc",
      `SELECT 1 FROM pg_database WHERE datname='${dbName}'`
    ]);
    if (exists.status === 0 && /\b1\b/.test(exists.stdout)) {
      r.substep(`Database '${dbName}' already exists.`);
    } else {
      const created = capture("docker", ["exec", db, "psql", "-U", "postgres", "-c", `CREATE DATABASE "${dbName}";`]);
      if (created.status === 0) {
        r.substep(`Created database '${dbName}'.`);
      } else {
        r.warn(`Could not create database '${dbName}' (continuing).`);
      }
    }
    const schemaScript = path3.join(serviceDir(svc), "scripts", "apply-schema.sh");
    if (fs3.existsSync(schemaScript)) {
      r.startSpinner(`Applying schema for ${svc}`);
      const url = `postgres://postgres:postgres@localhost:5432/${dbName}?sslmode=disable`;
      const applied = run("bash", ["scripts/apply-schema.sh"], {
        cwd: serviceDir(svc),
        env: { ...process.env, DATABASE_URL: url }
      });
      if (applied === 0) {
        r.stopSpinner(`Schema applied for ${svc}`);
      } else {
        r.failSpinner(`Schema failed for ${svc}`);
        throw new CliError(`apply-schema.sh failed for ${svc}`, "Check the schema script and database connectivity.");
      }
    } else {
      r.substep(`No apply-schema.sh for ${svc}; database created only.`);
    }
  }
  r.success("Migrations complete.");
  return 0;
}
async function logs(ctx) {
  const { r } = ctx;
  const follow = ctx.args.includes("--follow") || ctx.args.includes("-f");
  if (!follow) {
    for (const svc of getAppServices()) {
      const f = logFile(svc);
      if (fs3.existsSync(f)) {
        const lines = fs3.readFileSync(f, "utf8").split("\n");
        const tail = lines.slice(-40).join("\n");
        r.step(`${svc} (last 40 lines)`);
        process.stdout.write(tail + "\n");
      }
    }
    dockerComposeRun(["logs", "--tail", "40"]);
    return 0;
  }
  if (!r.painter.caps.isTTY) {
    throw new CliError("logs --follow requires an interactive terminal", "Omit --follow to print recent logs and exit, or read .dev/logs/*.log directly.");
  }
  r.info("Streaming logs (Ctrl+C to stop)...");
  return dockerComposeRun(["logs", "-f"]);
}
function collectStatus() {
  const composePs = dockerComposeCapture(["ps", "--format", "{{.Service}}|{{.Status}}|{{.Ports}}"]);
  const docker = composePs.stdout.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const [service = "", stat = "", ports = ""] = l.split("|");
    return { service, status: stat, ports };
  });
  const native = [];
  for (const svc of getAppServices()) {
    if (isRunning(svc)) native.push({ service: svc, status: "running", pid: readPid(svc) });
  }
  return { docker, native };
}
function renderStatusTables(r, data) {
  r.table(
    "Docker Containers",
    data.docker.map((d) => {
      const ports = d.ports.length > 15 ? d.ports.slice(0, 12) + "..." : d.ports;
      return [d.service, d.status, ports];
    })
  );
  const nativeRows = [];
  const running = new Set(data.native.map((n) => n.service));
  for (const n of data.native) nativeRows.push([n.service, `PID ${n.pid}`, "native"]);
  for (const svc of getAppServices()) {
    if (!running.has(svc) && isDead(svc)) nativeRows.push([svc, "dead", "native"]);
  }
  r.table("Native Processes", nativeRows);
}
async function status(ctx) {
  const { r } = ctx;
  const json = ctx.json || ctx.args.includes("--json");
  const watch = ctx.args.includes("--watch");
  if (json) {
    process.stdout.write(JSON.stringify(collectStatus(), null, 2) + "\n");
    return 0;
  }
  if (watch && r.painter.caps.isTTY) {
    return watchStatus(ctx);
  }
  if (watch && !r.painter.caps.isTTY) {
    r.info("--watch requires an interactive terminal; printing a single snapshot.");
  }
  const ro = r.asStream(process.stdout);
  ro.logo("Local Status");
  renderStatusTables(ro, collectStatus());
  return 0;
}
async function watchStatus(ctx) {
  const { r } = ctx;
  const readline2 = await import("readline");
  const out = process.stderr;
  out.write("\x1B[?1049h");
  out.write("\x1B[?25l");
  readline2.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.resume();
  let stop2 = false;
  const restore = () => {
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    process.stdin.pause();
    out.write("\x1B[?25h");
    out.write("\x1B[?1049l");
  };
  const onKey = (_s, key) => {
    if (key.name === "q" || key.ctrl && key.name === "c") stop2 = true;
  };
  process.stdin.on("keypress", onKey);
  try {
    while (!stop2) {
      out.write("\x1B[2J\x1B[H");
      r.logo("Live Status");
      renderStatusTables(r, collectStatus());
      out.write(`
  ${r.painter.dim("Refreshing every 2s \u2014 press q or Ctrl+C to exit")}
`);
      for (let i = 0; i < 20 && !stop2; i += 1) await sleep(100);
    }
  } finally {
    process.stdin.removeListener("keypress", onKey);
    restore();
  }
  return 0;
}
var fs3, path3;
var init_lifecycle = __esm({
  "src/generators/workspace-dev-cli/cli-src/src/commands/lifecycle.ts"() {
    "use strict";
    fs3 = __toESM(require("fs"));
    init_context();
    init_proc();
    init_services();
    init_paths();
    path3 = __toESM(require("path"));
  }
});

// src/generators/workspace-dev-cli/cli-src/src/util/prompt.ts
function isInteractive() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}
function selectPrompt(painter, message, choices) {
  return new Promise((resolve, reject) => {
    let index = 0;
    const out = process.stderr;
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    out.write("\x1B[?25l");
    const render = (first) => {
      if (!first) out.write(`\x1B[${choices.length + 1}A`);
      out.write(`\x1B[2K  ${painter.bold(message)}
`);
      choices.forEach((c, i) => {
        const active = i === index;
        const marker = active ? painter.primary("\u276F") : " ";
        const label = active ? painter.primary(c.label) : c.label;
        const hint = c.hint ? painter.dim(`  ${c.hint}`) : "";
        out.write(`\x1B[2K  ${marker} ${label}${hint}
`);
      });
    };
    const cleanup = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener("keypress", onKey);
      out.write("\x1B[?25h");
    };
    const onKey = (_str, key) => {
      if (key.ctrl && key.name === "c") {
        cleanup();
        process.exit(130);
      } else if (key.name === "up" || key.name === "k") {
        index = (index - 1 + choices.length) % choices.length;
        render(false);
      } else if (key.name === "down" || key.name === "j") {
        index = (index + 1) % choices.length;
        render(false);
      } else if (key.name === "return" || key.name === "enter") {
        cleanup();
        resolve(choices[index].value);
      }
    };
    render(true);
    process.stdin.on("keypress", onKey);
    process.stdin.on("error", (e) => {
      cleanup();
      reject(e);
    });
  });
}
function textPrompt(painter, message, validate) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  const ask = () => new Promise((resolve) => {
    rl.question(`  ${painter.bold(message)} `, (answer) => resolve(answer.trim()));
  });
  return (async () => {
    try {
      for (; ; ) {
        const value = await ask();
        const err = validate ? validate(value) : null;
        if (!err) {
          rl.close();
          return value;
        }
        process.stderr.write(`  ${painter.paint("error", "\u2716")} ${err}
`);
      }
    } catch (e) {
      rl.close();
      throw e;
    }
  })();
}
var readline;
var init_prompt = __esm({
  "src/generators/workspace-dev-cli/cli-src/src/util/prompt.ts"() {
    "use strict";
    readline = __toESM(require("readline"));
  }
});

// src/generators/workspace-dev-cli/cli-src/src/commands/bet.ts
function validateSlug(slug, label) {
  if (!SLUG_RE.test(slug)) {
    throw new CliError(`Invalid ${label}: "${slug}"`, SLUG_HINT);
  }
}
function existingBetSlugs() {
  const dir = path4.join(TESTS_DIR, "bets");
  if (!fs4.existsSync(dir)) return [];
  return fs4.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== "_archive").map((d) => d.name).sort();
}
async function resolveBetSlug(ctx, given) {
  if (given || !isInteractive()) return given;
  const existing = existingBetSlugs();
  if (existing.length > 0) {
    const choices = [
      ...existing.map((s) => ({ label: s, value: s })),
      { label: "+ new bet\u2026", value: "\0new" }
    ];
    const picked = await selectPrompt(ctx.r.painter, "Which bet?", choices);
    if (picked !== "\0new") return picked;
  }
  return textPrompt(ctx.r.painter, "Bet slug:", slugValidator);
}
function templatePath(name) {
  return path4.join(ROOT, "scripts", "cli", "templates", name);
}
function nextIndex(betDir, prefix) {
  if (!fs4.existsSync(betDir)) return 1;
  const count = fs4.readdirSync(betDir).filter((f) => f.startsWith(prefix) && f.endsWith(".py")).length;
  return count + 1;
}
function substitute(template, tokens) {
  let out = template;
  for (const [k, v] of Object.entries(tokens)) {
    out = out.split(`@@${k}@@`).join(v);
  }
  return out;
}
async function newCmd(ctx) {
  let noun = ctx.args[0];
  if (!noun && isInteractive()) {
    noun = await selectPrompt(ctx.r.painter, "What do you want to scaffold?", [
      { label: "bet", value: "bet", hint: "docs + tests directories for a new bet" },
      { label: "milestone", value: "milestone", hint: "a red milestone test stub" },
      { label: "slice", value: "slice", hint: "a red slice test stub" }
    ]);
  }
  switch (noun) {
    case "bet":
      return newBet(ctx);
    case "milestone":
      return newMilestone(ctx);
    case "slice":
      return newSlice(ctx);
    default:
      throw new CliError("Usage: ./dev new bet|milestone|slice ...");
  }
}
async function newBet(ctx) {
  const { r } = ctx;
  let slug = ctx.args[1];
  if (!slug && isInteractive()) slug = await textPrompt(r.painter, "Bet slug:", slugValidator);
  if (!slug) throw new CliError("Usage: ./dev new bet <slug>");
  validateSlug(slug, "bet slug");
  r.logo("New Bet");
  r.step(`Scaffolding bet: ${slug}`);
  fs4.mkdirSync(path4.join(DOCS_DIR, "bets", slug), { recursive: true });
  fs4.mkdirSync(path4.join(TESTS_DIR, "bets", slug), { recursive: true });
  r.success(`Created docs/bets/${slug}/ and tests/bets/${slug}/`);
  r.info(`Next: ./dev new milestone ${slug} <milestone-slug>`);
  return 0;
}
async function newMilestone(ctx) {
  const { r } = ctx;
  const betSlug = await resolveBetSlug(ctx, ctx.args[1]);
  let milestoneSlug = ctx.args[2];
  if (!milestoneSlug && isInteractive()) milestoneSlug = await textPrompt(r.painter, "Milestone slug:", slugValidator);
  if (!betSlug || !milestoneSlug) throw new CliError("Usage: ./dev new milestone <bet-slug> <milestone-slug>");
  validateSlug(betSlug, "bet slug");
  validateSlug(milestoneSlug, "milestone slug");
  const betDir = path4.join(TESTS_DIR, "bets", betSlug);
  if (!fs4.existsSync(betDir)) throw new CliError(`Bet not found: tests/bets/${betSlug}`, `Run: ./dev new bet ${betSlug}`);
  const n = nextIndex(betDir, "test_milestone_");
  const template = fs4.readFileSync(templatePath("milestone-test.pytmpl"), "utf8");
  const content = substitute(template, { BET: betSlug, MILESTONE: milestoneSlug, N: String(n) });
  const file = path4.join(betDir, `test_milestone_${n}_${milestoneSlug}.py`);
  fs4.writeFileSync(file, content);
  r.logo("New Milestone");
  r.success(`Created tests/bets/${betSlug}/test_milestone_${n}_${milestoneSlug}.py (RED)`);
  r.info("Fill in the target-state assertions before starting Delivery.");
  return 0;
}
async function newSlice(ctx) {
  const { r } = ctx;
  const betSlug = await resolveBetSlug(ctx, ctx.args[1]);
  let milestoneSlug = ctx.args[2];
  if (!milestoneSlug && isInteractive()) milestoneSlug = await textPrompt(r.painter, "Milestone slug:", slugValidator);
  let service = ctx.args[3];
  if (!service && isInteractive()) {
    const svcs = getAppServices();
    service = svcs.length ? await selectPrompt(r.painter, "Which service?", svcs.map((s) => ({ label: s, value: s }))) : await textPrompt(r.painter, "Service name:");
  }
  let sliceSlug = ctx.args[4];
  if (!sliceSlug && isInteractive()) sliceSlug = await textPrompt(r.painter, "Slice slug:", slugValidator);
  if (!betSlug || !milestoneSlug || !service || !sliceSlug)
    throw new CliError("Usage: ./dev new slice <bet-slug> <milestone-slug> <service> <slice-slug>");
  validateSlug(betSlug, "bet slug");
  validateSlug(milestoneSlug, "milestone slug");
  validateSlug(sliceSlug, "slice slug");
  const betDir = path4.join(TESTS_DIR, "bets", betSlug);
  if (!fs4.existsSync(betDir)) throw new CliError(`Bet not found: tests/bets/${betSlug}`, `Run: ./dev new bet ${betSlug}`);
  const n = nextIndex(betDir, "test_slice_");
  const template = fs4.readFileSync(templatePath("slice-test.pytmpl"), "utf8");
  const content = substitute(template, {
    BET: betSlug,
    MILESTONE: milestoneSlug,
    SERVICE: service,
    SLUG: sliceSlug,
    N: String(n)
  });
  const file = path4.join(betDir, `test_slice_${n}_${service}_${sliceSlug}.py`);
  fs4.writeFileSync(file, content);
  r.logo("New Slice");
  r.success(`Created tests/bets/${betSlug}/test_slice_${n}_${service}_${sliceSlug}.py (RED)`);
  r.info("Fill in the falsifiable capability assertions before starting Delivery.");
  return 0;
}
async function archive(ctx) {
  const { r } = ctx;
  if (ctx.args[0] !== "bet") throw new CliError("Usage: ./dev archive bet <slug>");
  const slug = ctx.args[1];
  if (!slug) throw new CliError("Usage: ./dev archive bet <slug>");
  const src = path4.join(TESTS_DIR, "bets", slug);
  const dest = path4.join(TESTS_DIR, "bets", "_archive", slug);
  if (!fs4.existsSync(src)) throw new CliError(`Bet suite not found: tests/bets/${slug}`);
  if (fs4.existsSync(dest)) throw new CliError(`Archive already exists: tests/bets/_archive/${slug}`);
  r.logo("Archive Bet");
  r.step(`Archiving tests/bets/${slug} \u2192 tests/bets/_archive/${slug}`);
  fs4.mkdirSync(path4.join(TESTS_DIR, "bets", "_archive"), { recursive: true });
  const inGit = capture("git", ["-C", ROOT, "rev-parse", "--is-inside-work-tree"]).status === 0;
  if (inGit) {
    const moved = capture("git", ["-C", ROOT, "mv", `tests/bets/${slug}`, `tests/bets/_archive/${slug}`]);
    if (moved.status !== 0) throw new CliError(`git mv failed for ${slug}`, moved.stderr.trim());
  } else {
    fs4.renameSync(src, dest);
  }
  r.success(`Archived to tests/bets/_archive/${slug}`);
  r.info("Permanent best-practice tests remain in place and cover the feature going forward.");
  return 0;
}
function betsConfigDir(slug) {
  return path4.join(GROUNDWORK_BETS_DIR, slug);
}
function manifestPath(slug) {
  return path4.join(betsConfigDir(slug), "test-manifest.json");
}
function decompositionPath(slug) {
  return path4.join(betsConfigDir(slug), "decomposition.json");
}
function readJson(file, label) {
  if (!fs4.existsSync(file)) return null;
  try {
    return JSON.parse(fs4.readFileSync(file, "utf8"));
  } catch {
    throw new CliError(`Could not parse ${label}: ${path4.relative(ROOT, file)}`, "Fix or remove the malformed JSON file.");
  }
}
function listSuiteFiles(betDir) {
  const out = [];
  const walk = (dir, rel) => {
    for (const entry of fs4.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "__pycache__") continue;
      const abs = path4.join(dir, entry.name);
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(abs, relPath);
      else if (!entry.name.endsWith(".pyc")) out.push(relPath);
    }
  };
  walk(betDir, "");
  return out.sort();
}
function hashSuite(slug) {
  const betDir = path4.join(TESTS_DIR, "bets", slug);
  const files = {};
  for (const rel of listSuiteFiles(betDir)) {
    const digest = (0, import_node_crypto.createHash)("sha256").update(fs4.readFileSync(path4.join(betDir, rel))).digest("hex");
    files[`tests/bets/${slug}/${rel}`] = digest;
  }
  return files;
}
function checkSeal(slug) {
  const manifest = readJson(manifestPath(slug), "test-manifest.json");
  if (!manifest || !manifest.files) {
    return { state: "unsigned", modified: [], missing: [], unsigned: [] };
  }
  const betDir = path4.join(TESTS_DIR, "bets", slug);
  const current = fs4.existsSync(betDir) ? hashSuite(slug) : {};
  const modified = [];
  const missing = [];
  const unsigned = [];
  for (const [file, hash] of Object.entries(manifest.files)) {
    if (!(file in current)) missing.push(file);
    else if (current[file] !== hash) modified.push(file);
  }
  for (const file of Object.keys(current)) {
    if (!(file in manifest.files)) unsigned.push(file);
  }
  const tampered = modified.length + missing.length + unsigned.length > 0;
  return { state: tampered ? "tampered" : "intact", signed: manifest.signed, modified, missing, unsigned };
}
function todayStamp() {
  const d = /* @__PURE__ */ new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
async function betCmd(ctx) {
  let noun = ctx.args.filter((a) => !a.startsWith("-"))[0];
  if (!noun && isInteractive()) {
    noun = await selectPrompt(ctx.r.painter, "Bet tooling:", [
      { label: "status", value: "status", hint: "progress board for a bet (or all bets)" },
      { label: "sign", value: "sign", hint: "seal the bet test suite into a manifest" }
    ]);
  }
  switch (noun) {
    case "sign":
      return sign(ctx);
    case "status":
      return status2(ctx);
    default:
      throw new CliError("Usage: ./dev bet sign <slug> [--amend] | ./dev bet status [<slug>] [--json]");
  }
}
async function sign(ctx) {
  const { r } = ctx;
  const positional = ctx.args.filter((a) => !a.startsWith("-"));
  let slug = positional[1];
  if (!slug && isInteractive()) {
    const existing2 = existingBetSlugs();
    if (existing2.length > 0) {
      slug = await selectPrompt(r.painter, "Sign which bet?", existing2.map((s) => ({ label: s, value: s })));
    }
  }
  if (!slug) throw new CliError("Usage: ./dev bet sign <slug> [--amend]");
  validateSlug(slug, "bet slug");
  const betDir = path4.join(TESTS_DIR, "bets", slug);
  if (!fs4.existsSync(betDir)) {
    throw new CliError(`Bet suite not found: tests/bets/${slug}`, `Run: ./dev new bet ${slug}`);
  }
  const files = hashSuite(slug);
  const count = Object.keys(files).length;
  if (count === 0) {
    throw new CliError(`Bet suite is empty: tests/bets/${slug}`, `Scaffold tests first: ./dev new milestone ${slug} <milestone-slug>`);
  }
  const amend = ctx.args.includes("--amend");
  const existing = readJson(manifestPath(slug), "test-manifest.json");
  if (existing && !amend) {
    throw new CliError(
      `A test manifest already exists for ${slug} (signed ${existing.signed})`,
      `The signed suite is the contract. To re-seal after an approved amendment, run: ./dev bet sign ${slug} --amend`
    );
  }
  r.logo("Sign Bet Suite");
  r.step(`Sealing tests/bets/${slug}/ (${count} file${count === 1 ? "" : "s"})`);
  if (existing && amend) {
    const old = existing.files ?? {};
    const added = Object.keys(files).filter((f) => !(f in old)).sort();
    const removed = Object.keys(old).filter((f) => !(f in files)).sort();
    const rehashed = Object.keys(files).filter((f) => f in old && old[f] !== files[f]).sort();
    if (added.length + removed.length + rehashed.length === 0) {
      r.info(`No file changes since ${existing.signed} \u2014 manifest re-signed as of today.`);
    } else {
      for (const f of added) r.substep(`added:     ${f}`);
      for (const f of removed) r.substep(`removed:   ${f}`);
      for (const f of rehashed) r.substep(`re-hashed: ${f}`);
    }
  }
  const manifest = {
    bet: slug,
    signed: todayStamp(),
    review_verdict: "PRESENT",
    files
  };
  fs4.mkdirSync(betsConfigDir(slug), { recursive: true });
  fs4.writeFileSync(manifestPath(slug), JSON.stringify(manifest, null, 2) + "\n");
  r.success(`${amend && existing ? "Amended" : "Signed"} manifest: .groundwork/bets/${slug}/test-manifest.json`);
  r.info(`./dev test bet ${slug} now verifies the suite against this seal before running.`);
  return 0;
}
function sliceGlyph(p, status3) {
  const u = p.caps.unicode;
  if (status3 === "delivered") return p.paint("success", u ? "\u25CF" : "*");
  if (status3 === "in-progress") return p.paint("warning", u ? "\u25D0" : "~");
  return p.dim(u ? "\u25CB" : "o");
}
function progressOf(decomp) {
  const slices = (decomp.milestones ?? []).flatMap((m) => m.slices ?? []);
  const delivered = slices.filter((s) => s.status === "delivered").length;
  const total = slices.length;
  return { delivered, total, percent: total === 0 ? 0 : Math.round(delivered / total * 100) };
}
function sealSummary(seal) {
  if (seal.state === "intact") return `signed ${seal.signed} \xB7 intact`;
  if (seal.state === "tampered") return `signed ${seal.signed} \xB7 TAMPERED`;
  return "unsigned";
}
function renderSealLine(ro, slug, seal) {
  if (seal.state === "intact") {
    ro.success(`Seal: signed ${seal.signed} \u2014 manifest intact`);
    return;
  }
  if (seal.state === "tampered") {
    ro.error(`Seal: signed ${seal.signed} \u2014 TAMPERED`);
    for (const f of seal.modified) ro.error(`  modified: ${f}`);
    for (const f of seal.missing) ro.error(`  missing:  ${f}`);
    for (const f of seal.unsigned) ro.error(`  unsigned: ${f}`);
    return;
  }
  ro.info(`Seal: unsigned \u2014 run ./dev bet sign ${slug} to seal the suite`);
}
function decompositionSlugs() {
  if (!fs4.existsSync(GROUNDWORK_BETS_DIR)) return [];
  return fs4.readdirSync(GROUNDWORK_BETS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
}
async function status2(ctx) {
  const { r } = ctx;
  const json = ctx.json || ctx.args.includes("--json");
  const positional = ctx.args.filter((a) => !a.startsWith("-"));
  const slug = positional[1];
  if (!slug) return statusAll(ctx, json);
  validateSlug(slug, "bet slug");
  const decomp = readJson(decompositionPath(slug), "decomposition.json");
  const betDir = path4.join(TESTS_DIR, "bets", slug);
  const seal = checkSeal(slug);
  if (!decomp && !fs4.existsSync(betDir)) {
    throw new CliError(
      `No bet found: ${slug}`,
      `Expected .groundwork/bets/${slug}/decomposition.json or tests/bets/${slug}/.`
    );
  }
  if (!decomp) {
    const testFiles = listSuiteFiles(betDir).map((f) => `tests/bets/${slug}/${f}`);
    if (json) {
      process.stdout.write(JSON.stringify({ bet: slug, decomposition: null, test_files: testFiles, seal }, null, 2) + "\n");
      return 0;
    }
    const ro2 = r.asStream(process.stdout);
    ro2.logo(`Bet Board \u2014 ${slug}`);
    ro2.warn(`No decomposition manifest at .groundwork/bets/${slug}/decomposition.json \u2014 listing test files only.`);
    ro2.info("The methodology skills write decomposition.json during bet decomposition.");
    renderSealLine(ro2, slug, seal);
    ro2.table("Test Files", testFiles.map((f) => [path4.basename(f), "", ""]));
    return 0;
  }
  const progress = progressOf(decomp);
  if (json) {
    process.stdout.write(JSON.stringify({ ...decomp, progress, seal }, null, 2) + "\n");
    return 0;
  }
  const ro = r.asStream(process.stdout);
  ro.logo(`Bet Board \u2014 ${slug}`);
  renderSealLine(ro, slug, seal);
  for (const m of decomp.milestones ?? []) {
    ro.step(`${m.id} \xB7 ${m.title} \u2014 ${m.status}`);
    const rows = (m.slices ?? []).map(
      (s) => [`${sliceGlyph(ro.painter, s.status)} ${`${s.id} ${s.slug}`.padEnd(26)}`, s.service, s.status]
    );
    ro.table("Slices", rows);
  }
  ro.success(`Progress: ${progress.delivered}/${progress.total} slices delivered (${progress.percent}%)`);
  return 0;
}
async function statusAll(ctx, json) {
  const { r } = ctx;
  const slugs = decompositionSlugs();
  const summaries = slugs.map((slug) => {
    const decomp = readJson(decompositionPath(slug), "decomposition.json");
    const seal = checkSeal(slug);
    return {
      bet: slug,
      created: decomp?.created ?? null,
      decomposition: Boolean(decomp),
      progress: decomp ? progressOf(decomp) : null,
      seal
    };
  });
  if (json) {
    process.stdout.write(JSON.stringify(summaries, null, 2) + "\n");
    return 0;
  }
  const ro = r.asStream(process.stdout);
  ro.logo("Bet Board");
  if (summaries.length === 0) {
    ro.info("No bets found under .groundwork/bets/.");
    ro.info("The methodology skills write decomposition.json there during bet decomposition.");
    return 0;
  }
  for (const s of summaries) {
    const line = s.progress ? `${s.progress.delivered}/${s.progress.total} slices delivered (${s.progress.percent}%) \u2014 ${sealSummary(s.seal)}` : `no decomposition.json \u2014 ${sealSummary(s.seal)}`;
    ro.cmd(s.bet, line);
  }
  ro.info("Run ./dev bet status <slug> for the full board.");
  return 0;
}
var fs4, path4, import_node_crypto, SLUG_RE, SLUG_HINT, slugValidator;
var init_bet = __esm({
  "src/generators/workspace-dev-cli/cli-src/src/commands/bet.ts"() {
    "use strict";
    fs4 = __toESM(require("fs"));
    path4 = __toESM(require("path"));
    import_node_crypto = require("node:crypto");
    init_context();
    init_proc();
    init_paths();
    init_services();
    init_prompt();
    SLUG_RE = /^([a-z][a-z0-9-]*[a-z0-9]|[a-z0-9])$/;
    SLUG_HINT = "Use lowercase kebab-case: letters, digits, and single hyphens, no leading/trailing hyphen.";
    slugValidator = (v) => SLUG_RE.test(v) ? null : SLUG_HINT;
  }
});

// src/generators/workspace-dev-cli/cli-src/src/commands/quality.ts
function hasSystemTests() {
  return fs5.existsSync(path5.join(TESTS_DIR, "system"));
}
async function test(ctx) {
  const { r } = ctx;
  const positional = ctx.args.filter((a) => !a.startsWith("-"));
  const keep = ctx.args.includes("--keep");
  const integrationFlag = ctx.args.includes("--integration");
  const mode = positional[0];
  if (!hasSystemTests()) {
    r.logo("Tests");
    r.info("No system tests found.");
    return 0;
  }
  if (mode === "integration") {
    r.logo("Running Integration Tests");
    await start(ctx);
    await migrate(ctx);
    r.step("Running System Tests (pytest, REQUIRE_* enabled)");
    const code2 = run("uv", ["run", "pytest", "system/"], {
      cwd: TESTS_DIR,
      env: { ...process.env, GROUNDWORK_REQUIRE_SERVICES: "1", GROUNDWORK_REQUIRE_TRACES: "1" }
    });
    if (!keep) await stop(ctx);
    if (code2 !== 0) throw new CliError("Integration tests failed", "Inspect the pytest output above.");
    r.success("Integration tests passed.");
    return 0;
  }
  if (mode === "bet") {
    const slug = positional[1];
    if (!slug) throw new CliError("Usage: ./dev test bet <slug>");
    const betDir = path5.join(TESTS_DIR, "bets", slug);
    if (!fs5.existsSync(betDir)) throw new CliError(`Bet suite not found: tests/bets/${slug}`);
    const seal = checkSeal(slug);
    if (seal.state === "tampered") {
      r.logo(`Bet Tests \u2014 ${slug}`);
      r.error(`The bet suite no longer matches its signed manifest (.groundwork/bets/${slug}/test-manifest.json):`);
      for (const f of seal.modified) r.error(`  modified: ${f}`);
      for (const f of seal.missing) r.error(`  missing:  ${f}`);
      for (const f of seal.unsigned) r.error(`  unsigned: ${f}`);
      throw new CliError(
        `Sealed test manifest verification failed: ${slug}`,
        `The signed suite is the contract \u2014 route changes through the amendment protocol, then \`./dev bet sign ${slug} --amend\`.`
      );
    }
    const unsignedNote = seal.state === "unsigned" ? `Bet suite is unsigned (no test manifest) \u2014 running without seal verification. Seal it with: ./dev bet sign ${slug}` : null;
    if (integrationFlag) {
      r.logo(`Running Bet Integration Tests \u2014 ${slug}`);
      if (unsignedNote) r.info(unsignedNote);
      await start(ctx);
      await migrate(ctx);
      const usesPlaywright = fs5.readdirSync(betDir).filter((f) => f.endsWith(".py")).some((f) => /playwright/.test(fs5.readFileSync(path5.join(betDir, f), "utf8")));
      if (usesPlaywright) {
        r.step("Installing Playwright browser (chromium)");
        run("uv", ["run", "playwright", "install", "chromium"], { cwd: TESTS_DIR });
      }
      r.step(`Running bet-progress suite: bets/${slug}/ (REQUIRE_SERVICES enabled)`);
      const code3 = run("uv", ["run", "pytest", `bets/${slug}/`], {
        cwd: TESTS_DIR,
        env: { ...process.env, GROUNDWORK_REQUIRE_SERVICES: "1" }
      });
      if (!keep) await stop(ctx);
      if (code3 !== 0) throw new CliError(`Bet integration tests failed: ${slug}`);
      r.success(`Bet integration tests passed: ${slug}`);
      return 0;
    }
    r.logo(`Running Bet Tests \u2014 ${slug}`);
    if (unsignedNote) r.info(unsignedNote);
    r.step(`Running bet-progress suite: bets/${slug}/`);
    const code2 = run("uv", ["run", "pytest", `bets/${slug}/`], { cwd: TESTS_DIR });
    if (code2 === 0) r.success(`Bet tests passed: ${slug}`);
    return code2;
  }
  r.logo("Running Tests");
  r.step("Running System Tests (pytest)");
  const code = run("uv", ["run", "pytest", "system/"], { cwd: TESTS_DIR });
  if (code === 0) r.success("Tests passed.");
  return code;
}
async function lint(ctx) {
  const { r } = ctx;
  r.logo("Running Linters");
  let last = 0;
  for (const svc of getAppServices()) {
    if (fs5.existsSync(path5.join(serviceDir(svc), ".golangci.yml"))) {
      r.step(`Linting Go service: ${svc}`);
      last = run("golangci-lint", ["run"], { cwd: serviceDir(svc) });
    }
  }
  r.success("Linting complete.");
  return last;
}
var fs5, path5;
var init_quality = __esm({
  "src/generators/workspace-dev-cli/cli-src/src/commands/quality.ts"() {
    "use strict";
    fs5 = __toESM(require("fs"));
    path5 = __toESM(require("path"));
    init_context();
    init_proc();
    init_services();
    init_paths();
    init_lifecycle();
    init_bet();
  }
});

// src/generators/workspace-dev-cli/cli-src/src/commands/doctor.ts
async function doctor(ctx) {
  const { r } = ctx;
  const json = ctx.json || ctx.args.includes("--json");
  const checks = [];
  checks.push({ name: "docker", ok: commandExists("docker"), hint: "Install Docker Desktop or the docker engine." });
  const compose = capture("docker", ["compose", "version"]);
  checks.push({ name: "docker compose", ok: compose.status === 0, hint: "Install the Docker Compose v2 plugin." });
  let needsNode = false;
  let needsGo = false;
  let needsAir = false;
  let needsPython = false;
  for (const svc of getAppServices()) {
    const dir = serviceDir(svc);
    if (fs6.existsSync(path6.join(dir, "package.json"))) needsNode = true;
    if (fs6.existsSync(path6.join(dir, "go.mod"))) needsGo = true;
    if (fs6.existsSync(path6.join(dir, ".air.toml"))) needsAir = true;
    if (fs6.existsSync(path6.join(dir, "pyproject.toml"))) needsPython = true;
  }
  if (needsNode) checks.push({ name: "npm", ok: commandExists("npm"), hint: "Install Node.js (includes npm)." });
  if (needsGo) checks.push({ name: "go", ok: commandExists("go"), hint: "Install the Go toolchain." });
  if (needsAir) checks.push({ name: "air", ok: commandExists("air"), hint: "go install github.com/air-verse/air@latest" });
  if (needsPython)
    checks.push({
      name: "python",
      ok: commandExists("python3") || commandExists("python"),
      hint: "Install Python 3."
    });
  const missing = checks.filter((c) => !c.ok);
  if (json) {
    process.stdout.write(
      JSON.stringify({ ok: missing.length === 0, checks }, null, 2) + "\n"
    );
    return 0;
  }
  r.logo("Environment Verification (Doctor)");
  r.table(
    "Dependencies",
    checks.map((c) => [c.name, c.ok ? "ok" : "MISSING", c.ok ? "" : c.hint ?? ""])
  );
  if (missing.length === 0) {
    r.success("Your environment is ready!");
  } else {
    r.errorCard(
      `Found ${missing.length} missing ${missing.length === 1 ? "dependency" : "dependencies"}.`,
      missing.map((c) => `${c.name}: ${c.hint ?? ""}`).join("  ")
    );
  }
  return 0;
}
var fs6, path6;
var init_doctor = __esm({
  "src/generators/workspace-dev-cli/cli-src/src/commands/doctor.ts"() {
    "use strict";
    fs6 = __toESM(require("fs"));
    path6 = __toESM(require("path"));
    init_proc();
    init_services();
  }
});

// src/generators/workspace-dev-cli/cli-src/src/commands/completion.ts
async function completion(ctx) {
  const shell = ctx.args[0];
  const { COMMANDS: COMMANDS2 } = await Promise.resolve().then(() => (init_registry(), registry_exports));
  const verbs = COMMANDS2.map((c) => c.name);
  const nounsByVerb = COMMANDS2.filter((c) => c.nouns?.length).map((c) => ({ verb: c.name, nouns: c.nouns }));
  const flagsByVerb = COMMANDS2.filter((c) => c.flags?.length).map((c) => ({
    verb: c.name,
    flags: c.flags.map((f) => f.name)
  }));
  if (shell === "bash") {
    process.stdout.write(bashScript(verbs, nounsByVerb, flagsByVerb) + "\n");
    return 0;
  }
  if (shell === "zsh") {
    process.stdout.write(zshScript(verbs, nounsByVerb, flagsByVerb) + "\n");
    return 0;
  }
  if (shell === "fish") {
    process.stdout.write(fishScript(verbs, nounsByVerb, flagsByVerb) + "\n");
    return 0;
  }
  throw new UsageError("Usage: ./dev completion bash|zsh|fish");
}
function bashScript(verbs, nouns, flags) {
  const nounCases = nouns.map((n) => `      ${n.verb}) COMPREPLY=( $(compgen -W "${n.nouns.join(" ")}" -- "$cur") ); return;;`).join("\n");
  const flagCases = flags.map((f) => `      ${f.verb}) extra="${f.flags.join(" ")}";;`).join("\n");
  return `# bash completion for ./dev \u2014 eval "$(./dev completion bash)"
_dev_complete() {
  local cur prev verb extra
  cur="\${COMP_WORDS[COMP_CWORD]}"
  verb="\${COMP_WORDS[1]}"
  if [ "$COMP_CWORD" -eq 1 ]; then
    COMPREPLY=( $(compgen -W "${verbs.join(" ")}" -- "$cur") ); return
  fi
  case "$verb" in
${nounCases}
  esac
  extra=""
  case "$verb" in
${flagCases}
  esac
  COMPREPLY=( $(compgen -W "$extra" -- "$cur") )
}
complete -F _dev_complete ./dev dev`;
}
function zshScript(verbs, nouns, _flags) {
  const nounCases = nouns.map((n) => `    ${n.verb}) compadd ${n.nouns.join(" ")} ;;`).join("\n");
  return `#compdef dev ./dev
# zsh completion for ./dev \u2014 eval "$(./dev completion zsh)"
_dev() {
  if (( CURRENT == 2 )); then
    compadd ${verbs.join(" ")}
    return
  fi
  case "\${words[2]}" in
${nounCases}
  esac
}
_dev "$@"`;
}
function fishScript(verbs, nouns, flags) {
  const lines = [
    "# fish completion for ./dev \u2014 ./dev completion fish | source",
    `complete -c dev -f`,
    `complete -c dev -n '__fish_use_subcommand' -a '${verbs.join(" ")}'`
  ];
  for (const n of nouns) {
    lines.push(`complete -c dev -n '__fish_seen_subcommand_from ${n.verb}' -a '${n.nouns.join(" ")}'`);
  }
  for (const f of flags) {
    for (const flag of f.flags) {
      lines.push(`complete -c dev -n '__fish_seen_subcommand_from ${f.verb}' -l '${flag.replace(/^--/, "")}'`);
    }
  }
  return lines.join("\n");
}
var init_completion = __esm({
  "src/generators/workspace-dev-cli/cli-src/src/commands/completion.ts"() {
    "use strict";
    init_context();
  }
});

// src/generators/workspace-dev-cli/cli-src/src/registry.ts
var registry_exports = {};
__export(registry_exports, {
  COMMANDS: () => COMMANDS,
  findCommand: () => findCommand
});
function findCommand(name) {
  return COMMANDS.find((c) => c.name === name);
}
var COMMANDS;
var init_registry = __esm({
  "src/generators/workspace-dev-cli/cli-src/src/registry.ts"() {
    "use strict";
    init_lifecycle();
    init_quality();
    init_doctor();
    init_bet();
    init_completion();
    COMMANDS = [
      {
        name: "start",
        group: "LIFECYCLE",
        summary: "Boot infrastructure (Docker) + app services (native)",
        flags: [{ name: "--docker", desc: "Run all services in Docker" }],
        handler: start
      },
      {
        name: "stop",
        group: "LIFECYCLE",
        summary: "Gracefully tear down all services",
        handler: stop
      },
      {
        name: "migrate",
        group: "LIFECYCLE",
        summary: "Create service databases & apply schemas",
        handler: migrate
      },
      {
        name: "status",
        group: "LIFECYCLE",
        summary: "Show running services (--watch for a live dashboard)",
        flags: [
          { name: "--json", desc: "Emit machine-readable JSON" },
          { name: "--watch", desc: "Live-refreshing dashboard (TTY only)" }
        ],
        handler: status
      },
      {
        name: "logs",
        group: "LIFECYCLE",
        summary: "Print recent logs (--follow to stream)",
        flags: [{ name: "--follow", desc: "Stream logs (TTY only)" }],
        handler: logs
      },
      {
        name: "clean",
        group: "LIFECYCLE",
        summary: "Tear down & wipe state (--hard wipes volumes)",
        flags: [{ name: "--hard", desc: "Also wipe Docker volumes" }],
        handler: clean
      },
      {
        name: "doctor",
        group: "QUALITY",
        summary: "Verify the local environment",
        flags: [{ name: "--json", desc: "Emit machine-readable JSON" }],
        handler: doctor
      },
      {
        name: "test",
        group: "QUALITY",
        summary: "Run tests (integration | bet <slug>)",
        nouns: ["integration", "bet"],
        flags: [
          { name: "--integration", desc: "Boot the stack for a bet suite" },
          { name: "--keep", desc: "Leave the stack running after tests" }
        ],
        handler: test
      },
      {
        name: "lint",
        group: "QUALITY",
        summary: "Run static analysis across services",
        handler: lint
      },
      {
        name: "new",
        group: "BET WORKFLOW",
        summary: "Scaffold a bet / milestone / slice (red test stubs)",
        nouns: ["bet", "milestone", "slice"],
        handler: newCmd
      },
      {
        name: "archive",
        group: "BET WORKFLOW",
        summary: "Archive a delivered bet's progress suite",
        nouns: ["bet"],
        handler: archive
      },
      {
        name: "bet",
        group: "BET WORKFLOW",
        summary: "Bet tooling (status [<slug>] | sign <slug>)",
        nouns: ["status", "sign"],
        flags: [
          { name: "--amend", desc: "Overwrite an existing test manifest (sign)" },
          { name: "--json", desc: "Emit machine-readable JSON (status)" }
        ],
        handler: betCmd
      },
      {
        name: "completion",
        group: "META",
        summary: "Print a shell completion script (bash|zsh|fish)",
        nouns: ["bash", "zsh", "fish"],
        handler: completion
      }
    ];
  }
});

// src/generators/workspace-dev-cli/cli-src/src/index.ts
var fs7 = __toESM(require("fs"));
init_registry();
init_context();

// src/generators/workspace-dev-cli/cli-src/src/theme/color.ts
var RESET = "\x1B[0m";
function envFlag(name) {
  const v = process.env[name];
  return v !== void 0 && v !== "" && v !== "0" && v.toLowerCase() !== "false";
}
function detectCaps(stream = process.stdout) {
  const isTTY = Boolean(stream.isTTY);
  const term = process.env.TERM ?? "";
  const unicode = term !== "dumb" && !envFlag("ASCII_ONLY") && /utf-?8/i.test(process.env.LC_ALL || process.env.LC_CTYPE || process.env.LANG || "UTF-8");
  let depth;
  if (envFlag("NO_COLOR")) {
    depth = "none";
  } else if (!isTTY && !envFlag("FORCE_COLOR")) {
    depth = "none";
  } else {
    const colorterm = (process.env.COLORTERM ?? "").toLowerCase();
    if (colorterm === "truecolor" || colorterm === "24bit") {
      depth = "truecolor";
    } else if (/256/.test(term)) {
      depth = "ansi256";
    } else if (term === "dumb" || term === "") {
      depth = "none";
    } else {
      depth = "ansi16";
    }
  }
  return { depth, unicode, isTTY };
}
function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return [255, 255, 255];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}
function treatmentCode(t) {
  switch (t) {
    case "bold":
    case "bold+upper":
      return "\x1B[1m";
    case "dim":
      return "\x1B[2m";
    case "underline":
      return "\x1B[4m";
    default:
      return "";
  }
}
var Painter = class {
  constructor(tokens, caps) {
    this.tokens = tokens;
    this.caps = caps;
  }
  roleColor(role) {
    return this.tokens.terminal?.colorRoles?.[role];
  }
  /** Paint text in a semantic role, degrading by capability. */
  paint(role, text) {
    const r = this.roleColor(role);
    if (!r) return text;
    if (r.noColor === "bold+upper") text = text.toUpperCase();
    if (this.caps.depth === "none") {
      const code2 = treatmentCode(r.noColor);
      return code2 ? `${code2}${text}${RESET}` : text;
    }
    if (this.caps.depth === "truecolor" && r.truecolor) {
      const [rr, gg, bb] = hexToRgb(r.truecolor);
      return `\x1B[38;2;${rr};${gg};${bb}m${text}${RESET}`;
    }
    if ((this.caps.depth === "ansi256" || this.caps.depth === "truecolor") && r.ansi256 !== null) {
      return `\x1B[38;5;${r.ansi256}m${text}${RESET}`;
    }
    const code = treatmentCode(r.noColor);
    return code ? `${code}${text}${RESET}` : text;
  }
  /** Paint with the brand primary accent (truecolor only; degrades to bold). */
  primary(text) {
    if (this.caps.depth === "truecolor") {
      const [r, g, b] = hexToRgb(this.tokens.identity.primary);
      return `\x1B[38;2;${r};${g};${b}m${text}${RESET}`;
    }
    if (this.caps.depth === "none") return text;
    return `\x1B[1m${text}${RESET}`;
  }
  bold(text) {
    return this.caps.depth === "none" ? text : `\x1B[1m${text}${RESET}`;
  }
  dim(text) {
    return this.caps.depth === "none" ? text : `\x1B[2m${text}${RESET}`;
  }
};

// src/generators/workspace-dev-cli/cli-src/src/theme/tokens.ts
var DEFAULT_TOKENS = {
  identity: {
    appName: "Workspace",
    wordmark: "\u25E2\u25E4",
    primary: "#5fafff",
    accent: "#d7afff",
    voice: "clear, modern"
  },
  terminal: {
    colorRoles: {
      success: { truecolor: "#5faf87", ansi256: 72, noColor: "bold" },
      error: { truecolor: "#d75f5f", ansi256: 167, noColor: "bold" },
      warning: { truecolor: "#d7af5f", ansi256: 179, noColor: "bold" },
      info: { truecolor: "#5fafff", ansi256: 75, noColor: "dim" },
      muted: { truecolor: "#8a8a8a", ansi256: 245, noColor: "dim" },
      accent: { truecolor: "#d7afff", ansi256: 183, noColor: "underline" },
      header: { truecolor: null, ansi256: null, noColor: "bold+upper" },
      key: { truecolor: "#5fafff", ansi256: 75, noColor: "plain" },
      value: { truecolor: "#d0d0d0", ansi256: 252, noColor: "plain" }
    },
    symbols: {
      success: { unicode: "\u2714", ascii: "OK" },
      error: { unicode: "\u2716", ascii: "x" },
      warning: { unicode: "\u26A0", ascii: "!" },
      info: { unicode: "\u25CF", ascii: "*" },
      step: { unicode: "\u25B6", ascii: ">" },
      substep: { unicode: "\u21B3", ascii: "-" },
      active: { unicode: "\u276F", ascii: ">" }
    },
    splash: { style: "wordmark-line", tagline: "" },
    typography: {
      header: "bold + UPPERCASE",
      title: "bold + primary",
      body: "plain",
      muted: "dim"
    }
  }
};
function mergeTokens(partial) {
  const p = partial ?? {};
  const identity = { ...DEFAULT_TOKENS.identity, ...p.identity ?? {} };
  const terminal = p.terminal ? {
    colorRoles: { ...DEFAULT_TOKENS.terminal.colorRoles, ...p.terminal.colorRoles },
    symbols: { ...DEFAULT_TOKENS.terminal.symbols, ...p.terminal.symbols },
    splash: { ...DEFAULT_TOKENS.terminal.splash, ...p.terminal.splash },
    typography: { ...DEFAULT_TOKENS.terminal.typography, ...p.terminal.typography }
  } : DEFAULT_TOKENS.terminal;
  return { identity, terminal };
}

// src/generators/workspace-dev-cli/cli-src/src/theme/render.ts
var PAD = "  ";
var Renderer = class _Renderer {
  constructor(tokens, stream = process.stderr) {
    this.spinnerTimer = null;
    this.spinnerText = "";
    this.tokens = tokens;
    this.out = stream;
    this.painter = new Painter(tokens, detectCaps(stream));
  }
  /** A twin renderer bound to a different stream (e.g. stdout for command *results*,
   *  while progress and spinners stay on stderr). */
  asStream(stream) {
    return new _Renderer(this.tokens, stream);
  }
  sym(name) {
    const t = this.tokens.terminal?.symbols?.[name];
    if (!t) return "";
    return this.painter.caps.unicode ? t.unicode : t.ascii;
  }
  write(line) {
    this.out.write(line + "\n");
  }
  logo(subtitle) {
    const { wordmark, appName } = this.tokens.identity;
    const mark = this.painter.primary(`${wordmark} ${appName}`.trim());
    this.write("");
    this.write(subtitle ? `${PAD}${this.painter.bold(mark)} ${this.painter.dim("\u2014 " + subtitle)}` : `${PAD}${this.painter.bold(mark)}`);
    this.write("");
  }
  step(text) {
    this.write(`
${PAD}${this.painter.primary(this.sym("step"))} ${this.painter.bold(text)}`);
  }
  substep(text) {
    this.write(`${PAD}${PAD}${this.painter.dim(`${this.sym("substep")} ${text}`)}`);
  }
  info(text) {
    this.write(`${PAD}${this.painter.dim(this.sym("info"))} ${text}`);
  }
  success(text) {
    this.write(`${PAD}${this.painter.paint("success", this.sym("success"))} ${text}`);
  }
  error(text) {
    this.write(`${PAD}${this.painter.paint("error", this.sym("error"))} ${text}`);
  }
  warn(text) {
    this.write(`${PAD}${this.painter.paint("warning", this.sym("warning"))} ${text}`);
  }
  category(text) {
    this.write(`
${PAD}${this.painter.dim("\u25A0")} ${this.painter.paint("header", text)}`);
  }
  cmd(name, desc) {
    this.write(`    ${this.painter.paint("accent", name.padEnd(15))} ${desc}`);
  }
  /** A boxed error card with an optional action line. */
  errorCard(msg, action) {
    const bar = this.painter.paint("error", "\u2502");
    this.write("");
    this.write(`${PAD}${this.painter.paint("error", "\u256D" + "\u2500".repeat(58) + "\u256E")}`);
    this.write(`${PAD}${bar}  ${this.painter.paint("error", this.sym("error"))} ${this.painter.bold("ERROR:")} ${msg}`);
    if (action) {
      this.write(`${PAD}${bar}`);
      this.write(`${PAD}${bar}  ${this.painter.dim("Action required:")}`);
      this.write(`${PAD}${bar}  ${this.painter.paint("accent", this.sym("active"))} ${action}`);
    }
    this.write(`${PAD}${this.painter.paint("error", "\u2570" + "\u2500".repeat(58) + "\u256F")}`);
    this.write("");
  }
  /** A simple three-column table for status output. */
  table(title, rows) {
    this.write(`${PAD}${this.painter.dim("\u256D\u2500")} ${this.painter.bold(title)}`);
    if (rows.length === 0) {
      this.write(`${PAD}${this.painter.dim("\u2502")}  ${this.painter.dim("(none)")}`);
    }
    for (const [a, b, c] of rows) {
      this.write(`${PAD}${this.painter.dim("\u2502")}  ${a.padEnd(28)} ${b.padEnd(16)} ${this.painter.dim(c)}`);
    }
    this.write(`${PAD}${this.painter.dim("\u2570" + "\u2500".repeat(40))}`);
  }
  // --- Spinner (TTY only; degrades to a static line) -------------------------
  startSpinner(text) {
    this.spinnerText = text;
    if (!this.painter.caps.isTTY) {
      this.write(`${PAD}${this.painter.dim(this.sym("info"))} ${text}...`);
      return;
    }
    const frames = ["\u280B", "\u2819", "\u2839", "\u2838", "\u283C", "\u2834", "\u2826", "\u2827", "\u2807", "\u280F"];
    const asciiFrames = ["|", "/", "-", "\\"];
    const set = this.painter.caps.unicode ? frames : asciiFrames;
    let i = 0;
    this.out.write("\x1B[?25l");
    this.spinnerTimer = setInterval(() => {
      const frame = this.painter.primary(set[i % set.length]);
      this.out.write(`\r${PAD}${frame} ${this.spinnerText}`);
      i += 1;
    }, 90);
  }
  stopSpinner(successMsg, elapsed) {
    if (this.spinnerTimer) {
      clearInterval(this.spinnerTimer);
      this.spinnerTimer = null;
      this.out.write("\r\x1B[K");
      this.out.write("\x1B[?25h");
    }
    const time = elapsed ? ` ${this.painter.dim(`(${elapsed})`)}` : "";
    this.success(`${successMsg}${time}`);
  }
  failSpinner(failMsg) {
    if (this.spinnerTimer) {
      clearInterval(this.spinnerTimer);
      this.spinnerTimer = null;
      this.out.write("\r\x1B[K");
      this.out.write("\x1B[?25h");
    }
    this.error(failMsg);
  }
};
function makeRenderer(partialTokens, stream) {
  return new Renderer(mergeTokens(partialTokens), stream);
}

// src/generators/workspace-dev-cli/cli-src/src/index.ts
init_paths();
function loadConfig() {
  try {
    if (fs7.existsSync(CONFIG_PATH)) {
      const raw = JSON.parse(fs7.readFileSync(CONFIG_PATH, "utf8"));
      return { config: raw, tokens: { identity: raw.identity, terminal: raw.terminal } };
    }
  } catch {
  }
  return { config: {}, tokens: {} };
}
function showHelp(r) {
  r.logo("Local Development CLI");
  const groups = ["LIFECYCLE", "QUALITY", "BET WORKFLOW", "META"];
  for (const g of groups) {
    const cmds = COMMANDS.filter((c) => c.group === g);
    if (cmds.length === 0) continue;
    r.category(g);
    for (const c of cmds) r.cmd(c.name, c.summary);
  }
  process.stderr.write("\n");
}
async function main() {
  const argv = process.argv.slice(2);
  let json = false;
  let help = false;
  const rest = [];
  for (const a of argv) {
    if (a === "--json") json = true;
    else if (a === "-h" || a === "--help") help = true;
    else if (a === "-v" || a === "--verbose") {
    } else rest.push(a);
  }
  const { config, tokens } = loadConfig();
  const r = makeRenderer(tokens);
  const command = rest[0];
  const args = rest.slice(1);
  if (!command || command === "help" || help) {
    showHelp(r);
    return 0;
  }
  const def = findCommand(command);
  if (!def) {
    r.error(`Unknown command: ${command}`);
    showHelp(r);
    return 2;
  }
  const ctx = {
    r,
    json,
    args,
    projectPrefix: config.projectPrefix || "workspace"
  };
  return def.handler(ctx);
}
process.on("SIGINT", () => {
  process.stderr.write("\n");
  process.stderr.write("\x1B[?25h");
  process.exit(130);
});
main().then((code) => process.exit(code)).catch((err) => {
  const r = makeRenderer({});
  if (err instanceof CliError) {
    r.errorCard(err.message, err.action);
    process.exit(1);
  }
  if (err instanceof UsageError) {
    r.error(err.message);
    process.exit(2);
  }
  r.errorCard(err?.message ?? String(err));
  process.exit(1);
});
