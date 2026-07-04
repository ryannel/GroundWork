import * as fs from 'fs';
import * as path from 'path';
import { Ctx, CliError } from '../util/context';
import { capture, commandExists } from '../util/proc';
import { ROOT, TESTS_DIR, DOCS_DIR } from '../util/paths';
import { getAppServices } from '../util/services';
import { isInteractive, selectPrompt, textPrompt } from '../util/prompt';
import { Painter } from '../theme/color';

const SLUG_RE = /^([a-z][a-z0-9-]*[a-z0-9]|[a-z0-9])$/;
const SLUG_HINT = 'Use lowercase kebab-case: letters, digits, and single hyphens, no leading/trailing hyphen.';

function validateSlug(slug: string, label: string): void {
  if (!SLUG_RE.test(slug)) {
    throw new CliError(`Invalid ${label}: "${slug}"`, SLUG_HINT);
  }
}

const slugValidator = (v: string): string | null => (SLUG_RE.test(v) ? null : SLUG_HINT);

function existingBetSlugs(): string[] {
  const dir = path.join(TESTS_DIR, 'bets');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== '_archive')
    .map((d) => d.name)
    .sort();
}

/** Resolve a bet slug: prompt (select an existing one or type a new) when interactive. */
async function resolveBetSlug(ctx: Ctx, given: string | undefined): Promise<string | undefined> {
  if (given || !isInteractive()) return given;
  const existing = existingBetSlugs();
  if (existing.length > 0) {
    const choices = [
      ...existing.map((s) => ({ label: s, value: s })),
      { label: '+ new bet…', value: '\0new' },
    ];
    const picked = await selectPrompt(ctx.r.painter, 'Which bet?', choices);
    if (picked !== '\0new') return picked;
  }
  return textPrompt(ctx.r.painter, 'Bet slug:', slugValidator);
}

function templatePath(name: string): string {
  return path.join(ROOT, 'scripts', 'cli', 'templates', name);
}

/** Discover a test-stub's template and extension from whichever template file
 *  actually ships (`<name>.pytmpl`, or a future `<name>.gotmpl`/`.tstmpl`),
 *  instead of hardcoding one. Bet-progress tests are a system-level black-box
 *  suite run by the project's scaffolded test-runner, not by each service's own
 *  language — `newSlice`'s `service` argument names who is exercised, not what
 *  the stub is written in — so the stub's language follows the template the
 *  runner shipped. Today only `system-test-runner`'s pytest harness ships one
 *  (`.pytmpl`), so this always resolves to `.py`; it degrades to the same
 *  `.pytmpl`/`.py` pair, documented rather than silently assumed, when no
 *  template is found at all. See `groundwork-bet/references/bet-progress-tests.md`
 *  for the `<ext>` convention this mirrors. */
function testTemplate(name: string): { file: string; ext: string } {
  const dir = path.join(ROOT, 'scripts', 'cli', 'templates');
  const found = fs.existsSync(dir)
    ? fs.readdirSync(dir).find((f) => f.startsWith(`${name}.`) && f.endsWith('tmpl'))
    : undefined;
  if (!found) return { file: `${name}.pytmpl`, ext: '.py' };
  const lang = found.slice(name.length + 1, -'tmpl'.length);
  return { file: found, ext: lang ? `.${lang}` : '.py' };
}

/** Count existing test stubs for `prefix` regardless of extension — the
 *  language the stub is written in (see `testTemplate`) is orthogonal to the
 *  bet-global ordinal counted here. */
function nextIndex(betDir: string, prefix: string): number {
  if (!fs.existsSync(betDir)) return 1;
  const count = fs.readdirSync(betDir).filter((f) => f.startsWith(prefix)).length;
  return count + 1;
}

function substitute(template: string, tokens: Record<string, string>): string {
  let out = template;
  for (const [k, v] of Object.entries(tokens)) {
    out = out.split(`@@${k}@@`).join(v);
  }
  return out;
}

export async function newCmd(ctx: Ctx): Promise<number> {
  let noun = ctx.args[0];
  if (!noun && isInteractive()) {
    noun = await selectPrompt(ctx.r.painter, 'What do you want to scaffold?', [
      { label: 'bet', value: 'bet', hint: 'docs + tests directories for a new bet' },
      { label: 'milestone', value: 'milestone', hint: 'a red milestone test stub' },
      { label: 'slice', value: 'slice', hint: 'a red slice test stub' },
    ]);
  }
  switch (noun) {
    case 'bet':
      return newBet(ctx);
    case 'milestone':
      return newMilestone(ctx);
    case 'slice':
      return newSlice(ctx);
    default:
      throw new CliError('Usage: ./dev new bet|milestone|slice ...');
  }
}

async function newBet(ctx: Ctx): Promise<number> {
  const { r } = ctx;
  let slug = ctx.args[1];
  if (!slug && isInteractive()) slug = await textPrompt(r.painter, 'Bet slug:', slugValidator);
  if (!slug) throw new CliError('Usage: ./dev new bet <slug>');
  validateSlug(slug, 'bet slug');
  r.logo('New Bet');
  r.step(`Scaffolding bet: ${slug}`);
  fs.mkdirSync(path.join(DOCS_DIR, 'bets', slug), { recursive: true });
  fs.mkdirSync(path.join(TESTS_DIR, 'bets', slug), { recursive: true });
  r.success(`Created docs/bets/${slug}/ and tests/bets/${slug}/`);
  r.info(`Next: ./dev new milestone ${slug} <milestone-slug>`);
  return 0;
}

async function newMilestone(ctx: Ctx): Promise<number> {
  const { r } = ctx;
  const betSlug = await resolveBetSlug(ctx, ctx.args[1]);
  let milestoneSlug = ctx.args[2];
  if (!milestoneSlug && isInteractive()) milestoneSlug = await textPrompt(r.painter, 'Milestone slug:', slugValidator);
  if (!betSlug || !milestoneSlug) throw new CliError('Usage: ./dev new milestone <bet-slug> <milestone-slug>');
  validateSlug(betSlug, 'bet slug');
  validateSlug(milestoneSlug, 'milestone slug');
  const betDir = path.join(TESTS_DIR, 'bets', betSlug);
  if (!fs.existsSync(betDir)) throw new CliError(`Bet not found: tests/bets/${betSlug}`, `Run: ./dev new bet ${betSlug}`);

  const n = nextIndex(betDir, 'test_milestone_');
  const { file: templateFile, ext } = testTemplate('milestone-test');
  const template = fs.readFileSync(templatePath(templateFile), 'utf8');
  const content = substitute(template, {
    BET: betSlug,
    MILESTONE: milestoneSlug,
    // Slugs are kebab-case; identifiers derived from them must be snake_case
    // or the generated def line is a Python SyntaxError.
    MILESTONE_IDENT: milestoneSlug.replace(/-/g, '_'),
    N: String(n),
  });
  const file = path.join(betDir, `test_milestone_${n}_${milestoneSlug}${ext}`);
  fs.writeFileSync(file, content);
  r.logo('New Milestone');
  r.success(`Created tests/bets/${betSlug}/test_milestone_${n}_${milestoneSlug}${ext} (RED)`);
  r.info('Fill in the target-state assertions before starting Delivery.');
  return 0;
}

async function newSlice(ctx: Ctx): Promise<number> {
  const { r } = ctx;
  const betSlug = await resolveBetSlug(ctx, ctx.args[1]);
  let milestoneSlug = ctx.args[2];
  if (!milestoneSlug && isInteractive()) milestoneSlug = await textPrompt(r.painter, 'Milestone slug:', slugValidator);
  let service = ctx.args[3];
  if (!service && isInteractive()) {
    const svcs = getAppServices();
    service = svcs.length
      ? await selectPrompt(r.painter, 'Which service?', svcs.map((s) => ({ label: s, value: s })))
      : await textPrompt(r.painter, 'Service name:');
  }
  let sliceSlug = ctx.args[4];
  if (!sliceSlug && isInteractive()) sliceSlug = await textPrompt(r.painter, 'Slice slug:', slugValidator);
  if (!betSlug || !milestoneSlug || !service || !sliceSlug)
    throw new CliError('Usage: ./dev new slice <bet-slug> <milestone-slug> <service> <slice-slug>');
  validateSlug(betSlug, 'bet slug');
  validateSlug(milestoneSlug, 'milestone slug');
  validateSlug(sliceSlug, 'slice slug');
  // service is intentionally not validated — it can be any identifier.
  const betDir = path.join(TESTS_DIR, 'bets', betSlug);
  if (!fs.existsSync(betDir)) throw new CliError(`Bet not found: tests/bets/${betSlug}`, `Run: ./dev new bet ${betSlug}`);

  const n = nextIndex(betDir, 'test_slice_');
  const { file: templateFile, ext } = testTemplate('slice-test');
  const template = fs.readFileSync(templatePath(templateFile), 'utf8');
  const content = substitute(template, {
    BET: betSlug,
    MILESTONE: milestoneSlug,
    SERVICE: service,
    SLUG: sliceSlug,
    // Kebab slug → snake identifier, or the generated def line is a SyntaxError.
    SLUG_IDENT: sliceSlug.replace(/-/g, '_'),
    N: String(n),
  });
  const file = path.join(betDir, `test_slice_${n}_${service}_${sliceSlug}${ext}`);
  fs.writeFileSync(file, content);
  r.logo('New Slice');
  r.success(`Created tests/bets/${betSlug}/test_slice_${n}_${service}_${sliceSlug}${ext} (RED)`);
  r.info('Fill in the falsifiable capability assertions before starting Delivery.');
  return 0;
}

/** Move one bet subtree to its sibling `_archive/<slug>/`, preferring `git mv` so
 *  history follows the move. `rel` is the path relative to ROOT (so git sees a
 *  tracked rename); `src`/`dest` are the absolute twins for the non-git fallback. */
function archiveMove(rel: string, src: string, dest: string, inGit: boolean): void {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const destRel = path.relative(ROOT, dest);
  if (inGit) {
    const moved = capture('git', ['-C', ROOT, 'mv', rel, destRel]);
    if (moved.status !== 0) throw new CliError(`git mv failed: ${rel} → ${destRel}`, moved.stderr.trim());
  } else {
    fs.renameSync(src, dest);
  }
}

/** Seed docs/bets/_archive/meta.json so the docs-site sidebar collapses the archive.
 *  Never clobbers an existing one — the project may have hand-tuned it. */
function ensureArchiveMeta(archiveDir: string): void {
  const metaPath = path.join(archiveDir, 'meta.json');
  if (fs.existsSync(metaPath)) return;
  fs.mkdirSync(archiveDir, { recursive: true });
  fs.writeFileSync(metaPath, JSON.stringify({ defaultOpen: false, pages: ['...'] }, null, 2) + '\n');
}

export async function archive(ctx: Ctx): Promise<number> {
  const { r } = ctx;
  if (ctx.args[0] !== 'bet') throw new CliError('Usage: ./dev archive bet <slug>');
  const slug = ctx.args[1];
  if (!slug) throw new CliError('Usage: ./dev archive bet <slug>');
  validateSlug(slug, 'bet slug');

  const testsSrc = path.join(TESTS_DIR, 'bets', slug);
  const testsDest = path.join(TESTS_DIR, 'bets', '_archive', slug);
  const docsSrc = path.join(DOCS_DIR, 'bets', slug);
  const docsDest = path.join(DOCS_DIR, 'bets', '_archive', slug);

  if (!fs.existsSync(testsSrc) && !fs.existsSync(docsSrc)) {
    throw new CliError(`Bet not found: ${slug}`, `Expected tests/bets/${slug}/ or docs/bets/${slug}/.`);
  }
  if (fs.existsSync(testsDest)) throw new CliError(`Archive already exists: tests/bets/_archive/${slug}`);
  if (fs.existsSync(docsDest)) throw new CliError(`Archive already exists: docs/bets/_archive/${slug}`);

  r.logo('Archive Bet');
  const inGit = capture('git', ['-C', ROOT, 'rev-parse', '--is-inside-work-tree']).status === 0;

  if (fs.existsSync(testsSrc)) {
    r.step(`Archiving tests/bets/${slug} → tests/bets/_archive/${slug}`);
    archiveMove(`tests/bets/${slug}`, testsSrc, testsDest, inGit);
    r.success(`Archived suite to tests/bets/_archive/${slug}`);
  } else {
    r.warn(`No suite at tests/bets/${slug} — skipping.`);
  }

  if (fs.existsSync(docsSrc)) {
    // The per-bet status page (`groundwork status --write`, user-legibility C2) is
    // regenerated whole at every checkpoint and superseded by the retrospective the
    // moment the bet archives — drop it here, before the move, so the archived copy
    // never carries a stale, un-regenerable snapshot.
    const statusMdPath = path.join(docsSrc, 'status.md');
    if (fs.existsSync(statusMdPath)) fs.rmSync(statusMdPath);
    r.step(`Archiving docs/bets/${slug} → docs/bets/_archive/${slug}`);
    archiveMove(`docs/bets/${slug}`, docsSrc, docsDest, inGit);
    ensureArchiveMeta(path.join(DOCS_DIR, 'bets', '_archive'));
    r.success(`Archived docs to docs/bets/_archive/${slug}`);
  } else {
    r.warn(`No docs at docs/bets/${slug} — skipping.`);
  }

  // The bet's working-state cache (board.yaml, memlog, packs, reviews, reports) is
  // disposable — its record lives in git and the archived prose. Remove it on archive.
  const cacheDir = betCacheDir(slug);
  if (fs.existsSync(cacheDir)) {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    r.success(`Removed working-state cache .groundwork/cache/bets/${slug}`);
  }

  r.info('Permanent best-practice tests remain in place and cover the feature going forward.');
  return 0;
}

// ---------------------------------------------------------------------------
// Bet progress board (`./dev bet status`)
//
// There is no tracking manifest. The board is DERIVED by running the bet suite
// (tests/bets/<slug>/) and reading per-test pass/fail keyed by the
// test_milestone_<N>_… and test_slice_<N>_<service>_… file names. Tests are
// materialized RED at Delivery start; a green row means the suite proves that
// milestone/slice. Git is the record — see groundwork-bet/workflows/04-delivery.md.
// ---------------------------------------------------------------------------

type BoardState = 'green' | 'red' | 'unknown';

interface BoardRow {
  kind: 'milestone' | 'slice';
  file: string;
  n: number;
  /** Service column — slices only. */
  service: string | null;
  slug: string;
  state: BoardState;
}

const MILESTONE_RE = /^test_milestone_(\d+)_(.+)\.[^.]+$/;
// Slice slug is kebab-case (no underscores); the service segment may itself
// contain underscores, so anchor the slug to the trailing kebab token.
const SLICE_RE = /^test_slice_(\d+)_(.+)_([a-z0-9][a-z0-9-]*)\.[^.]+$/;

/** Top-level test files in a bet suite dir, sorted, excluding caches. */
function suiteTestFiles(betDir: string): string[] {
  if (!fs.existsSync(betDir)) return [];
  return fs
    .readdirSync(betDir, { withFileTypes: true })
    .filter((d) => d.isFile() && (MILESTONE_RE.test(d.name) || SLICE_RE.test(d.name)))
    .map((d) => d.name)
    .sort();
}

/** Run the bet suite and map each test file to a green/red verdict. When the
 *  suite cannot be run (no `uv`), every file reports `unknown`. A file that the
 *  suite never produced a passing result for (collection error, unimplemented
 *  stub, outright failure) is `red` — exactly the materialized-RED starting state. */
function runSuiteVerdicts(slug: string): { ran: boolean; byFile: Map<string, BoardState> } {
  const byFile = new Map<string, BoardState>();
  if (!commandExists('uv')) return { ran: false, byFile };

  const res = capture('uv', ['run', 'pytest', `bets/${slug}/`, '-v', '--tb=no', '--color=no', '-p', 'no:cacheprovider'], {
    cwd: TESTS_DIR,
  });

  // pytest -v emits one line per test: `bets/<slug>/<file>::<test> PASSED [ 12%]`.
  const tally = new Map<string, { passed: number; failed: number }>();
  const line = /(?:^|\/)(test_(?:milestone|slice)_\d+_[^/:]+\.[A-Za-z0-9]+)::\S+\s+(PASSED|FAILED|ERROR|XFAIL|XPASS|SKIPPED)/g;
  for (const m of res.stdout.matchAll(line)) {
    const file = m[1];
    const outcome = m[2];
    const t = tally.get(file) ?? { passed: 0, failed: 0 };
    if (outcome === 'PASSED' || outcome === 'XFAIL') t.passed += 1;
    else if (outcome === 'FAILED' || outcome === 'ERROR' || outcome === 'XPASS') t.failed += 1;
    // SKIPPED contributes to neither — a skipped test proves nothing.
    tally.set(file, t);
  }
  for (const [file, t] of tally) {
    byFile.set(file, t.failed > 0 ? 'red' : t.passed > 0 ? 'green' : 'red');
  }
  return { ran: true, byFile };
}

/** Build the full board: every materialized milestone/slice file, with its
 *  derived verdict. Files with no recorded result default to red when the suite
 *  ran, unknown when it could not. */
function deriveBoard(slug: string): { ran: boolean; rows: BoardRow[] } {
  const betDir = path.join(TESTS_DIR, 'bets', slug);
  const files = suiteTestFiles(betDir);
  const { ran, byFile } = files.length > 0 ? runSuiteVerdicts(slug) : { ran: false, byFile: new Map() };

  const rows: BoardRow[] = files.map((file) => {
    const verdict = byFile.get(file) ?? (ran ? 'red' : 'unknown');
    const mm = MILESTONE_RE.exec(file);
    if (mm) {
      return { kind: 'milestone', file, n: Number(mm[1]), service: null, slug: mm[2], state: verdict };
    }
    const sm = SLICE_RE.exec(file);
    return { kind: 'slice', file, n: Number(sm![1]), service: sm![2], slug: sm![3], state: verdict };
  });

  const order = { milestone: 0, slice: 1 } as const;
  rows.sort((a, b) => order[a.kind] - order[b.kind] || a.n - b.n);
  return { ran, rows };
}

/** The per-bet working-state cache dir (`.groundwork/cache/bets/<slug>/`): board.yaml,
 *  memlog.md, milestone packs, reviews/, reports/. Gitignored, driver-written, never a
 *  gate — git + the suite remain the record. */
function betCacheDir(slug: string): string {
  return path.join(ROOT, '.groundwork', 'cache', 'bets', slug);
}

// Append one timestamped line to the bet's memlog (`./dev bet log <slug> -- "<line>"`).
// The memlog is an append-only resume index — the git commit and re-pointed tag stay
// canonical; a line here is a pointer to them, never a source of truth. Documented
// fallback when the CLI is unavailable: `printf '%s\n' "- <ts> — <line>" >> <memlog>`.
async function logCmd(ctx: Ctx): Promise<number> {
  const rest = ctx.args.slice(1); // drop the 'log' noun
  const dash = rest.indexOf('--');
  const slug = (dash === -1 ? rest : rest.slice(0, dash)).find((a) => !a.startsWith('-'));
  const message = (dash === -1 ? rest.slice(1) : rest.slice(dash + 1)).join(' ').trim();
  if (!slug || !message) {
    throw new CliError('Usage: ./dev bet log <slug> -- "<line>"');
  }
  validateSlug(slug, 'bet');
  const dir = betCacheDir(slug);
  fs.mkdirSync(dir, { recursive: true });
  const memlog = path.join(dir, 'memlog.md');
  const ts = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  fs.appendFileSync(memlog, `- ${ts} — ${message}\n`);
  return 0;
}

export async function betCmd(ctx: Ctx): Promise<number> {
  const noun = ctx.args.filter((a) => !a.startsWith('-'))[0];
  switch (noun ?? 'status') {
    case 'status':
      return status(ctx);
    case 'log':
      return logCmd(ctx);
    default:
      throw new CliError('Usage: ./dev bet status [<slug>] [--json]  |  ./dev bet log <slug> -- "<line>"');
  }
}

function boardGlyph(p: Painter, state: BoardState): string {
  const u = p.caps.unicode;
  if (state === 'green') return p.paint('success', u ? '●' : '*');
  if (state === 'red') return p.paint('error', u ? '✗' : 'x');
  return p.dim(u ? '○' : 'o');
}

function stateLabel(state: BoardState): string {
  return state === 'green' ? 'passing' : state === 'red' ? 'failing' : 'not run';
}

async function status(ctx: Ctx): Promise<number> {
  const { r } = ctx;
  const json = ctx.json || ctx.args.includes('--json');
  const positional = ctx.args.filter((a) => !a.startsWith('-'));
  const slug = positional[1];

  if (!slug) return statusAll(ctx, json);

  validateSlug(slug, 'bet slug');
  const betDir = path.join(TESTS_DIR, 'bets', slug);
  const files = suiteTestFiles(betDir);

  // Pre-Delivery: the bet exists on paper but no suite has been materialized yet.
  if (files.length === 0) {
    if (json) {
      process.stdout.write(JSON.stringify({ bet: slug, materialized: false, milestones: [], slices: [] }, null, 2) + '\n');
      return 0;
    }
    const ro = r.asStream(process.stdout);
    ro.logo(`Bet Board — ${slug}`);
    ro.info('No board yet — the bet suite is materialized RED at Delivery start.');
    ro.info(`Once Delivery begins, ./dev bet status ${slug} renders red/green from the suite.`);
    return 0;
  }

  const { ran, rows } = deriveBoard(slug);
  const milestones = rows.filter((x) => x.kind === 'milestone');
  const slices = rows.filter((x) => x.kind === 'slice');
  const green = rows.filter((x) => x.state === 'green').length;

  if (json) {
    process.stdout.write(
      JSON.stringify(
        {
          bet: slug,
          materialized: true,
          ran,
          milestones: milestones.map((m) => ({ n: m.n, slug: m.slug, file: m.file, state: m.state })),
          slices: slices.map((s) => ({ n: s.n, service: s.service, slug: s.slug, file: s.file, state: s.state })),
          summary: { green, total: rows.length },
        },
        null,
        2,
      ) + '\n',
    );
    return 0;
  }

  const ro = r.asStream(process.stdout);
  ro.logo(`Bet Board — ${slug}`);
  if (!ran) {
    ro.warn('uv not found — cannot run the suite. Listing the materialized tests without a verdict.');
  }
  // Pre-pad the visible text: the painted glyph carries ANSI escapes that would
  // defeat the table's own padEnd and misalign the columns.
  const mRows = milestones.map(
    (m) => [`${boardGlyph(ro.painter, m.state)} ${`M${m.n} ${m.slug}`.padEnd(26)}`, '', stateLabel(m.state)] as [string, string, string],
  );
  const sRows = slices.map(
    (s) =>
      [`${boardGlyph(ro.painter, s.state)} ${`S${s.n} ${s.slug}`.padEnd(26)}`, s.service ?? '', stateLabel(s.state)] as [
        string,
        string,
        string,
      ],
  );
  ro.table('Milestones', mRows);
  ro.table('Slices', sRows);
  ro.success(`Board: ${green}/${rows.length} green (run ./dev test bet ${slug} for full output).`);
  return 0;
}

async function statusAll(ctx: Ctx, json: boolean): Promise<number> {
  const { r } = ctx;
  const slugs = existingBetSlugs();
  const summaries = slugs.map((slug) => {
    const files = suiteTestFiles(path.join(TESTS_DIR, 'bets', slug));
    if (files.length === 0) return { bet: slug, materialized: false, green: 0, total: 0 };
    const { rows } = deriveBoard(slug);
    return { bet: slug, materialized: true, green: rows.filter((x) => x.state === 'green').length, total: rows.length };
  });

  if (json) {
    process.stdout.write(JSON.stringify(summaries, null, 2) + '\n');
    return 0;
  }

  const ro = r.asStream(process.stdout);
  ro.logo('Bet Board');
  if (summaries.length === 0) {
    ro.info('No bets found under tests/bets/.');
    ro.info('Start one with ./dev new bet <slug>.');
    return 0;
  }
  for (const s of summaries) {
    const line = s.materialized
      ? `${s.green}/${s.total} green`
      : 'no suite yet — materialized at Delivery start';
    ro.cmd(s.bet, line);
  }
  ro.info('Run ./dev bet status <slug> for the full board.');
  return 0;
}
