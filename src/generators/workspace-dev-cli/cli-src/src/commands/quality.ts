import * as fs from 'fs';
import * as path from 'path';
import { Ctx, CliError } from '../util/context';
import { run } from '../util/proc';
import { getAppServices, serviceDir } from '../util/services';
import { TESTS_DIR } from '../util/paths';
import { start, migrate, stop } from './lifecycle';
import { checkSeal } from './bet';

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

    // Verify the sealed test manifest BEFORE anything runs — the seal is the contract.
    const seal = checkSeal(slug);
    if (seal.state === 'tampered') {
      r.logo(`Bet Tests — ${slug}`);
      r.error(`The bet suite no longer matches its signed manifest (.groundwork/bets/${slug}/test-manifest.json):`);
      for (const f of seal.modified) r.error(`  modified: ${f}`);
      for (const f of seal.missing) r.error(`  missing:  ${f}`);
      for (const f of seal.unsigned) r.error(`  unsigned: ${f}`);
      throw new CliError(
        `Sealed test manifest verification failed: ${slug}`,
        `The signed suite is the contract — route changes through the amendment protocol, then \`./dev bet sign ${slug} --amend\`.`,
      );
    }
    const unsignedNote =
      seal.state === 'unsigned'
        ? `Bet suite is unsigned (no test manifest) — running without seal verification. Seal it with: ./dev bet sign ${slug}`
        : null;

    if (integrationFlag) {
      r.logo(`Running Bet Integration Tests — ${slug}`);
      if (unsignedNote) r.info(unsignedNote);
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
    if (unsignedNote) r.info(unsignedNote);
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

export async function lint(ctx: Ctx): Promise<number> {
  const { r } = ctx;
  r.logo('Running Linters');
  let last = 0;
  for (const svc of getAppServices()) {
    if (fs.existsSync(path.join(serviceDir(svc), '.golangci.yml'))) {
      r.step(`Linting Go service: ${svc}`);
      last = run('golangci-lint', ['run'], { cwd: serviceDir(svc) });
    }
  }
  r.success('Linting complete.');
  return last;
}
