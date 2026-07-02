import * as fs from 'fs';
import * as path from 'path';
import { Ctx, CliError } from '../util/context';
import { run, commandExists } from '../util/proc';
import { getAppServices, serviceDir, detectType } from '../util/services';
import { ROOT, SERVICES_DIR, TESTS_DIR, CONFIG_PATH, DEV_DIR } from '../util/paths';
import { start, migrate, stop } from './lifecycle';

function hasSystemTests(): boolean {
  return fs.existsSync(path.join(TESTS_DIR, 'system'));
}

export async function test(ctx: Ctx): Promise<number> {
  const { r } = ctx;
  const positional = ctx.args.filter((a) => !a.startsWith('-'));
  const keep = ctx.args.includes('--keep');
  const integrationFlag = ctx.args.includes('--integration');
  const mode = positional[0];

  // Early gate: no system tests → nothing to run (applies to every mode).
  if (!hasSystemTests()) {
    r.logo('Tests');
    r.info('No system tests found.');
    return 0;
  }

  if (mode === 'integration') {
    r.logo('Running Integration Tests');
    await start(ctx);
    await migrate(ctx);
    r.step('Running System Tests (pytest, REQUIRE_* enabled)');
    const code = run('uv', ['run', 'pytest', 'system/'], {
      cwd: TESTS_DIR,
      env: { ...process.env, GROUNDWORK_REQUIRE_SERVICES: '1', GROUNDWORK_REQUIRE_TRACES: '1' },
    });
    if (!keep) await stop(ctx);
    if (code !== 0) throw new CliError('Integration tests failed', 'Inspect the pytest output above.');
    r.success('Integration tests passed.');
    return 0;
  }

  if (mode === 'bet') {
    const slug = positional[1];
    if (!slug) throw new CliError('Usage: ./dev test bet <slug>');
    const betDir = path.join(TESTS_DIR, 'bets', slug);
    if (!fs.existsSync(betDir)) throw new CliError(`Bet suite not found: tests/bets/${slug}`);

    if (integrationFlag) {
      r.logo(`Running Bet Integration Tests — ${slug}`);
      await start(ctx);
      await migrate(ctx);
      // Install Playwright browsers on demand if the suite references them.
      const usesPlaywright = fs
        .readdirSync(betDir)
        .filter((f) => f.endsWith('.py'))
        .some((f) => /playwright/.test(fs.readFileSync(path.join(betDir, f), 'utf8')));
      if (usesPlaywright) {
        r.step('Installing Playwright browser (chromium)');
        run('uv', ['run', 'playwright', 'install', 'chromium'], { cwd: TESTS_DIR });
      }
      r.step(`Running bet-progress suite: bets/${slug}/ (REQUIRE_SERVICES enabled)`);
      const code = run('uv', ['run', 'pytest', `bets/${slug}/`], {
        cwd: TESTS_DIR,
        env: { ...process.env, GROUNDWORK_REQUIRE_SERVICES: '1' },
      });
      if (!keep) await stop(ctx);
      if (code !== 0) throw new CliError(`Bet integration tests failed: ${slug}`);
      r.success(`Bet integration tests passed: ${slug}`);
      return 0;
    }

    r.logo(`Running Bet Tests — ${slug}`);
    r.step(`Running bet-progress suite: bets/${slug}/`);
    const code = run('uv', ['run', 'pytest', `bets/${slug}/`], { cwd: TESTS_DIR });
    if (code === 0) r.success(`Bet tests passed: ${slug}`);
    return code;
  }

  // Default: fast inner loop.
  r.logo('Running Tests');
  r.step('Running System Tests (pytest)');
  const code = run('uv', ['run', 'pytest', 'system/'], { cwd: TESTS_DIR });
  if (code === 0) r.success('Tests passed.');
  return code;
}

/** Pinned scanner versions for the detect-and-instruct install story. The CLI
 *  never auto-downloads a scanner — a missing binary is a loud skip with the
 *  install line. A project overrides a pin via an `audit` block in
 *  `.dev/dev.config.json` (e.g. `{ "audit": { "gitleaks": "8.28.0" } }`). */
const AUDIT_PINS: Record<string, string> = {
  gitleaks: '8.28.0',
  'osv-scanner': '2.2.0',
  govulncheck: '1.1.4',
};

function auditPins(): Record<string, string> {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as { audit?: unknown };
      if (raw.audit && typeof raw.audit === 'object' && !Array.isArray(raw.audit)) {
        const overrides: Record<string, string> = {};
        for (const [k, v] of Object.entries(raw.audit as Record<string, unknown>)) {
          if (typeof v === 'string') overrides[k] = v;
        }
        return { ...AUDIT_PINS, ...overrides };
      }
    }
  } catch {
    /* pins stay at defaults */
  }
  return AUDIT_PINS;
}

/** Lockfiles osv-scanner covers where no ecosystem-native audit exists —
 *  Flutter (Dart has no native audit command) and forged stacks. */
const OSV_LOCKFILES = ['pubspec.lock', 'Cargo.lock', 'Package.resolved', 'Gemfile.lock', 'composer.lock'];

/** All directories that can carry dependency manifests: every `services/`
 *  subdirectory (surface apps carry lockfiles too, even though they never join
 *  compose) plus the test harness. */
function auditDirs(): Array<{ name: string; dir: string }> {
  const out: Array<{ name: string; dir: string }> = [];
  if (fs.existsSync(SERVICES_DIR)) {
    for (const d of fs.readdirSync(SERVICES_DIR, { withFileTypes: true })) {
      if (d.isDirectory()) out.push({ name: d.name, dir: path.join(SERVICES_DIR, d.name) });
    }
  }
  if (fs.existsSync(path.join(TESTS_DIR, 'pyproject.toml'))) {
    out.push({ name: 'tests', dir: TESTS_DIR });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Dependency-vulnerability audit + secret scan. Fails on findings; a missing
 *  scanner binary is a loud skip with the pinned install instruction, never an
 *  auto-download. Runs ecosystem natives where they are smarter than lockfile
 *  matching (govulncheck's reachability analysis, npm's registry advisories,
 *  pip-audit), and osv-scanner where no native audit exists. */
export async function audit(ctx: Ctx): Promise<number> {
  const { r } = ctx;
  r.logo('Dependency & Secret Audit');
  const pins = auditPins();
  const failed: string[] = [];
  const skipped: string[] = [];

  const instruct = (tool: string, install: string): void => {
    r.warn(`${tool} not installed — step skipped, not passed. Install v${pins[tool]}: ${install}`);
    skipped.push(tool);
  };

  for (const { name, dir } of auditDirs()) {
    if (fs.existsSync(path.join(dir, 'go.mod'))) {
      r.step(`Auditing Go dependencies: ${name} (govulncheck)`);
      if (commandExists('govulncheck')) {
        if (run('govulncheck', ['./...'], { cwd: dir }) !== 0) failed.push(`${name} (govulncheck)`);
      } else {
        instruct('govulncheck', 'go install golang.org/x/vuln/cmd/govulncheck@latest');
      }
      continue;
    }
    const osvLock = OSV_LOCKFILES.find((f) => fs.existsSync(path.join(dir, f)));
    if (osvLock) {
      r.step(`Auditing ${osvLock}: ${name} (osv-scanner)`);
      if (commandExists('osv-scanner')) {
        if (run('osv-scanner', ['scan', 'source', '-L', path.join(dir, osvLock)]) !== 0) {
          failed.push(`${name} (osv-scanner)`);
        }
      } else {
        instruct('osv-scanner', 'https://google.github.io/osv-scanner/installation (brew install osv-scanner)');
      }
      continue;
    }
    if (fs.existsSync(path.join(dir, 'package-lock.json'))) {
      r.step(`Auditing npm dependencies: ${name} (npm audit, prod, high+)`);
      if (commandExists('npm')) {
        if (run('npm', ['audit', '--omit=dev', '--audit-level=high'], { cwd: dir }) !== 0) {
          failed.push(`${name} (npm audit)`);
        }
      } else {
        r.warn('npm not installed — skipping. Install Node.js (includes npm).');
        skipped.push('npm');
      }
      continue;
    }
    if (fs.existsSync(path.join(dir, 'pyproject.toml'))) {
      r.step(`Auditing Python dependencies: ${name} (pip-audit via uv)`);
      if (commandExists('uv')) {
        if (run('uv', ['run', '--with', 'pip-audit', 'pip-audit'], { cwd: dir }) !== 0) {
          failed.push(`${name} (pip-audit)`);
        }
      } else {
        r.warn('uv not installed — skipping pip-audit. Install: https://docs.astral.sh/uv');
        skipped.push('uv');
      }
    }
  }

  r.step('Scanning for secrets (gitleaks)');
  if (commandExists('gitleaks')) {
    const baseline = path.join(DEV_DIR, 'gitleaks-baseline.json');
    const args = fs.existsSync(path.join(ROOT, '.git')) ? ['git'] : ['dir', '.'];
    args.push('--no-banner', '--redact');
    // A brownfield adopt records known history in the baseline; everything
    // after it is gated.
    if (fs.existsSync(baseline)) args.push('--baseline-path', baseline);
    if (run('gitleaks', args, { cwd: ROOT }) !== 0) failed.push('secrets (gitleaks)');
  } else {
    instruct('gitleaks', 'https://github.com/gitleaks/gitleaks#installing (brew install gitleaks)');
  }

  if (failed.length > 0) {
    throw new CliError(
      `Audit failed: ${failed.join(', ')}`,
      'Fix the findings above. For a vulnerable dependency, bump the pin; for a real secret, rotate it — removing the line does not un-leak it.',
    );
  }
  if (skipped.length > 0) {
    r.warn(`Audit incomplete — ${skipped.join(', ')} missing. Steps above were skipped, not passed.`);
    return 0;
  }
  r.success('Audit clean — dependencies and secrets.');
  return 0;
}

export async function lint(ctx: Ctx): Promise<number> {
  const { r } = ctx;
  r.logo('Running Linters');
  let last = 0;
  // A missing linter binary is a loud warning, not a silent skip — the service
  // still went unlinted and the developer needs to know.
  for (const svc of getAppServices()) {
    const dir = serviceDir(svc);
    const type = detectType(svc);

    if (type === 'go' || fs.existsSync(path.join(dir, '.golangci.yml'))) {
      r.step(`Linting Go service: ${svc}`);
      if (commandExists('golangci-lint')) {
        const code = run('golangci-lint', ['run'], { cwd: dir });
        if (code !== 0) last = code;
      } else {
        r.warn('golangci-lint not installed — skipping. Install: https://golangci-lint.run');
      }
    } else if (type === 'node') {
      r.step(`Linting Next.js service: ${svc}`);
      if (commandExists('npm')) {
        const code = run('npm', ['run', 'lint'], { cwd: dir });
        if (code !== 0) last = code;
      } else {
        r.warn('npm not installed — skipping. Install Node.js (includes npm).');
      }
    } else if (type === 'python') {
      r.step(`Linting Python service: ${svc}`);
      if (commandExists('uv')) {
        const ruff = run('uv', ['run', 'ruff', 'check', '.'], { cwd: dir });
        const black = run('uv', ['run', 'black', '--check', '.'], { cwd: dir });
        if (ruff !== 0) last = ruff;
        if (black !== 0) last = black;
      } else {
        r.warn('uv not installed — skipping ruff/black. Install: https://docs.astral.sh/uv');
      }
    }
  }
  r.success('Linting complete.');
  return last;
}
