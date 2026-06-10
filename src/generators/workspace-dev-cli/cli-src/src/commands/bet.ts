import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'node:crypto';
import { Ctx, CliError } from '../util/context';
import { capture } from '../util/proc';
import { ROOT, TESTS_DIR, DOCS_DIR, GROUNDWORK_BETS_DIR } from '../util/paths';
import { getAppServices } from '../util/services';
import { isInteractive, selectPrompt, textPrompt } from '../util/prompt';
import { Painter } from '../theme/color';
import { Renderer } from '../theme/render';

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

function nextIndex(betDir: string, prefix: string): number {
  if (!fs.existsSync(betDir)) return 1;
  const count = fs
    .readdirSync(betDir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.py')).length;
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
  const template = fs.readFileSync(templatePath('milestone-test.pytmpl'), 'utf8');
  const content = substitute(template, { BET: betSlug, MILESTONE: milestoneSlug, N: String(n) });
  const file = path.join(betDir, `test_milestone_${n}_${milestoneSlug}.py`);
  fs.writeFileSync(file, content);
  r.logo('New Milestone');
  r.success(`Created tests/bets/${betSlug}/test_milestone_${n}_${milestoneSlug}.py (RED)`);
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
  const template = fs.readFileSync(templatePath('slice-test.pytmpl'), 'utf8');
  const content = substitute(template, {
    BET: betSlug,
    MILESTONE: milestoneSlug,
    SERVICE: service,
    SLUG: sliceSlug,
    N: String(n),
  });
  const file = path.join(betDir, `test_slice_${n}_${service}_${sliceSlug}.py`);
  fs.writeFileSync(file, content);
  r.logo('New Slice');
  r.success(`Created tests/bets/${betSlug}/test_slice_${n}_${service}_${sliceSlug}.py (RED)`);
  r.info('Fill in the falsifiable capability assertions before starting Delivery.');
  return 0;
}

export async function archive(ctx: Ctx): Promise<number> {
  const { r } = ctx;
  if (ctx.args[0] !== 'bet') throw new CliError('Usage: ./dev archive bet <slug>');
  const slug = ctx.args[1];
  if (!slug) throw new CliError('Usage: ./dev archive bet <slug>');
  const src = path.join(TESTS_DIR, 'bets', slug);
  const dest = path.join(TESTS_DIR, 'bets', '_archive', slug);
  if (!fs.existsSync(src)) throw new CliError(`Bet suite not found: tests/bets/${slug}`);
  if (fs.existsSync(dest)) throw new CliError(`Archive already exists: tests/bets/_archive/${slug}`);

  r.logo('Archive Bet');
  r.step(`Archiving tests/bets/${slug} → tests/bets/_archive/${slug}`);
  fs.mkdirSync(path.join(TESTS_DIR, 'bets', '_archive'), { recursive: true });

  const inGit = capture('git', ['-C', ROOT, 'rev-parse', '--is-inside-work-tree']).status === 0;
  if (inGit) {
    const moved = capture('git', ['-C', ROOT, 'mv', `tests/bets/${slug}`, `tests/bets/_archive/${slug}`]);
    if (moved.status !== 0) throw new CliError(`git mv failed for ${slug}`, moved.stderr.trim());
  } else {
    fs.renameSync(src, dest);
  }
  r.success(`Archived to tests/bets/_archive/${slug}`);
  r.info('Permanent best-practice tests remain in place and cover the feature going forward.');
  return 0;
}

// ---------------------------------------------------------------------------
// Sealed test manifest + progress board (`./dev bet sign|status`)
//
// Two durable, committed artifacts live in .groundwork/bets/<slug>/ (NOT cache):
//   decomposition.json — milestone/slice plan, written by the methodology skills
//   test-manifest.json — the seal: sha256 of every file in tests/bets/<slug>/
// ---------------------------------------------------------------------------

interface TestManifest {
  bet: string;
  signed: string;
  review_verdict: string;
  files: Record<string, string>;
}

interface Slice {
  id: string;
  slug: string;
  service: string;
  test_file: string;
  status: 'pending' | 'in-progress' | 'delivered';
  baseline_commit: string | null;
  delivered_commit: string | null;
  files: string[];
  notes: string | null;
}

interface Milestone {
  id: string;
  slug: string;
  title: string;
  test_file: string;
  status: 'pending' | 'delivered';
  slices: Slice[];
}

interface Decomposition {
  bet: string;
  created: string;
  milestones: Milestone[];
}

export interface SealCheck {
  state: 'unsigned' | 'intact' | 'tampered';
  signed?: string;
  /** Signed files whose content hash no longer matches. */
  modified: string[];
  /** Signed files no longer present on disk. */
  missing: string[];
  /** Files on disk that are not in the manifest. */
  unsigned: string[];
}

function betsConfigDir(slug: string): string {
  return path.join(GROUNDWORK_BETS_DIR, slug);
}

function manifestPath(slug: string): string {
  return path.join(betsConfigDir(slug), 'test-manifest.json');
}

function decompositionPath(slug: string): string {
  return path.join(betsConfigDir(slug), 'decomposition.json');
}

function readJson<T>(file: string, label: string): T | null {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    throw new CliError(`Could not parse ${label}: ${path.relative(ROOT, file)}`, 'Fix or remove the malformed JSON file.');
  }
}

/** Recursive, sorted relative paths under tests/bets/<slug>/, excluding
 *  __pycache__ directories and compiled .pyc files. */
function listSuiteFiles(betDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, rel: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '__pycache__') continue;
      const abs = path.join(dir, entry.name);
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(abs, relPath);
      else if (!entry.name.endsWith('.pyc')) out.push(relPath);
    }
  };
  walk(betDir, '');
  return out.sort();
}

/** sha256 every file in tests/bets/<slug>/ keyed by project-relative path. */
function hashSuite(slug: string): Record<string, string> {
  const betDir = path.join(TESTS_DIR, 'bets', slug);
  const files: Record<string, string> = {};
  for (const rel of listSuiteFiles(betDir)) {
    const digest = createHash('sha256')
      .update(fs.readFileSync(path.join(betDir, rel)))
      .digest('hex');
    files[`tests/bets/${slug}/${rel}`] = digest;
  }
  return files;
}

/** Verify tests/bets/<slug>/ against its sealed manifest. Shared by
 *  `./dev bet status` and the pre-pytest gate in `./dev test bet`. */
export function checkSeal(slug: string): SealCheck {
  const manifest = readJson<TestManifest>(manifestPath(slug), 'test-manifest.json');
  if (!manifest || !manifest.files) {
    return { state: 'unsigned', modified: [], missing: [], unsigned: [] };
  }
  const betDir = path.join(TESTS_DIR, 'bets', slug);
  const current = fs.existsSync(betDir) ? hashSuite(slug) : {};
  const modified: string[] = [];
  const missing: string[] = [];
  const unsigned: string[] = [];
  for (const [file, hash] of Object.entries(manifest.files)) {
    if (!(file in current)) missing.push(file);
    else if (current[file] !== hash) modified.push(file);
  }
  for (const file of Object.keys(current)) {
    if (!(file in manifest.files)) unsigned.push(file);
  }
  const tampered = modified.length + missing.length + unsigned.length > 0;
  return { state: tampered ? 'tampered' : 'intact', signed: manifest.signed, modified, missing, unsigned };
}

function todayStamp(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export async function betCmd(ctx: Ctx): Promise<number> {
  let noun = ctx.args.filter((a) => !a.startsWith('-'))[0];
  if (!noun && isInteractive()) {
    noun = await selectPrompt(ctx.r.painter, 'Bet tooling:', [
      { label: 'status', value: 'status', hint: 'progress board for a bet (or all bets)' },
      { label: 'sign', value: 'sign', hint: 'seal the bet test suite into a manifest' },
    ]);
  }
  switch (noun) {
    case 'sign':
      return sign(ctx);
    case 'status':
      return status(ctx);
    default:
      throw new CliError('Usage: ./dev bet sign <slug> [--amend] | ./dev bet status [<slug>] [--json]');
  }
}

async function sign(ctx: Ctx): Promise<number> {
  const { r } = ctx;
  const positional = ctx.args.filter((a) => !a.startsWith('-'));
  let slug = positional[1];
  if (!slug && isInteractive()) {
    const existing = existingBetSlugs();
    if (existing.length > 0) {
      slug = await selectPrompt(r.painter, 'Sign which bet?', existing.map((s) => ({ label: s, value: s })));
    }
  }
  if (!slug) throw new CliError('Usage: ./dev bet sign <slug> [--amend]');
  validateSlug(slug, 'bet slug');

  const betDir = path.join(TESTS_DIR, 'bets', slug);
  if (!fs.existsSync(betDir)) {
    throw new CliError(`Bet suite not found: tests/bets/${slug}`, `Run: ./dev new bet ${slug}`);
  }
  const files = hashSuite(slug);
  const count = Object.keys(files).length;
  if (count === 0) {
    throw new CliError(`Bet suite is empty: tests/bets/${slug}`, `Scaffold tests first: ./dev new milestone ${slug} <milestone-slug>`);
  }

  const amend = ctx.args.includes('--amend');
  const existing = readJson<TestManifest>(manifestPath(slug), 'test-manifest.json');
  if (existing && !amend) {
    throw new CliError(
      `A test manifest already exists for ${slug} (signed ${existing.signed})`,
      `The signed suite is the contract. To re-seal after an approved amendment, run: ./dev bet sign ${slug} --amend`,
    );
  }

  r.logo('Sign Bet Suite');
  r.step(`Sealing tests/bets/${slug}/ (${count} file${count === 1 ? '' : 's'})`);

  if (existing && amend) {
    const old = existing.files ?? {};
    const added = Object.keys(files).filter((f) => !(f in old)).sort();
    const removed = Object.keys(old).filter((f) => !(f in files)).sort();
    const rehashed = Object.keys(files)
      .filter((f) => f in old && old[f] !== files[f])
      .sort();
    if (added.length + removed.length + rehashed.length === 0) {
      r.info(`No file changes since ${existing.signed} — manifest re-signed as of today.`);
    } else {
      for (const f of added) r.substep(`added:     ${f}`);
      for (const f of removed) r.substep(`removed:   ${f}`);
      for (const f of rehashed) r.substep(`re-hashed: ${f}`);
    }
  }

  const manifest: TestManifest = {
    bet: slug,
    signed: todayStamp(),
    review_verdict: 'PRESENT',
    files,
  };
  fs.mkdirSync(betsConfigDir(slug), { recursive: true });
  fs.writeFileSync(manifestPath(slug), JSON.stringify(manifest, null, 2) + '\n');

  r.success(`${amend && existing ? 'Amended' : 'Signed'} manifest: .groundwork/bets/${slug}/test-manifest.json`);
  r.info(`./dev test bet ${slug} now verifies the suite against this seal before running.`);
  return 0;
}

function sliceGlyph(p: Painter, status: string): string {
  const u = p.caps.unicode;
  if (status === 'delivered') return p.paint('success', u ? '●' : '*');
  if (status === 'in-progress') return p.paint('warning', u ? '◐' : '~');
  return p.dim(u ? '○' : 'o');
}

function progressOf(decomp: Decomposition): { delivered: number; total: number; percent: number } {
  const slices = (decomp.milestones ?? []).flatMap((m) => m.slices ?? []);
  const delivered = slices.filter((s) => s.status === 'delivered').length;
  const total = slices.length;
  return { delivered, total, percent: total === 0 ? 0 : Math.round((delivered / total) * 100) };
}

function sealSummary(seal: SealCheck): string {
  if (seal.state === 'intact') return `signed ${seal.signed} · intact`;
  if (seal.state === 'tampered') return `signed ${seal.signed} · TAMPERED`;
  return 'unsigned';
}

function renderSealLine(ro: Renderer, slug: string, seal: SealCheck): void {
  if (seal.state === 'intact') {
    ro.success(`Seal: signed ${seal.signed} — manifest intact`);
    return;
  }
  if (seal.state === 'tampered') {
    ro.error(`Seal: signed ${seal.signed} — TAMPERED`);
    for (const f of seal.modified) ro.error(`  modified: ${f}`);
    for (const f of seal.missing) ro.error(`  missing:  ${f}`);
    for (const f of seal.unsigned) ro.error(`  unsigned: ${f}`);
    return;
  }
  ro.info(`Seal: unsigned — run ./dev bet sign ${slug} to seal the suite`);
}

function decompositionSlugs(): string[] {
  if (!fs.existsSync(GROUNDWORK_BETS_DIR)) return [];
  return fs
    .readdirSync(GROUNDWORK_BETS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

async function status(ctx: Ctx): Promise<number> {
  const { r } = ctx;
  const json = ctx.json || ctx.args.includes('--json');
  const positional = ctx.args.filter((a) => !a.startsWith('-'));
  const slug = positional[1];

  if (!slug) return statusAll(ctx, json);

  validateSlug(slug, 'bet slug');
  const decomp = readJson<Decomposition>(decompositionPath(slug), 'decomposition.json');
  const betDir = path.join(TESTS_DIR, 'bets', slug);
  const seal = checkSeal(slug);

  if (!decomp && !fs.existsSync(betDir)) {
    throw new CliError(
      `No bet found: ${slug}`,
      `Expected .groundwork/bets/${slug}/decomposition.json or tests/bets/${slug}/.`,
    );
  }

  // Fallback: tests exist but the decomposition manifest is absent.
  if (!decomp) {
    const testFiles = listSuiteFiles(betDir).map((f) => `tests/bets/${slug}/${f}`);
    if (json) {
      process.stdout.write(JSON.stringify({ bet: slug, decomposition: null, test_files: testFiles, seal }, null, 2) + '\n');
      return 0;
    }
    const ro = r.asStream(process.stdout);
    ro.logo(`Bet Board — ${slug}`);
    ro.warn(`No decomposition manifest at .groundwork/bets/${slug}/decomposition.json — listing test files only.`);
    ro.info('The methodology skills write decomposition.json during bet decomposition.');
    renderSealLine(ro, slug, seal);
    ro.table('Test Files', testFiles.map((f) => [path.basename(f), '', ''] as [string, string, string]));
    return 0;
  }

  const progress = progressOf(decomp);
  if (json) {
    process.stdout.write(JSON.stringify({ ...decomp, progress, seal }, null, 2) + '\n');
    return 0;
  }

  const ro = r.asStream(process.stdout);
  ro.logo(`Bet Board — ${slug}`);
  renderSealLine(ro, slug, seal);
  for (const m of decomp.milestones ?? []) {
    ro.step(`${m.id} · ${m.title} — ${m.status}`);
    // Pre-pad the visible text: the painted glyph carries ANSI escapes that would
    // defeat the table's own padEnd and misalign the columns.
    const rows = (m.slices ?? []).map(
      (s) =>
        [`${sliceGlyph(ro.painter, s.status)} ${`${s.id} ${s.slug}`.padEnd(26)}`, s.service, s.status] as [
          string,
          string,
          string,
        ],
    );
    ro.table('Slices', rows);
  }
  ro.success(`Progress: ${progress.delivered}/${progress.total} slices delivered (${progress.percent}%)`);
  return 0;
}

async function statusAll(ctx: Ctx, json: boolean): Promise<number> {
  const { r } = ctx;
  const slugs = decompositionSlugs();
  const summaries = slugs.map((slug) => {
    const decomp = readJson<Decomposition>(decompositionPath(slug), 'decomposition.json');
    const seal = checkSeal(slug);
    return {
      bet: slug,
      created: decomp?.created ?? null,
      decomposition: Boolean(decomp),
      progress: decomp ? progressOf(decomp) : null,
      seal,
    };
  });

  if (json) {
    process.stdout.write(JSON.stringify(summaries, null, 2) + '\n');
    return 0;
  }

  const ro = r.asStream(process.stdout);
  ro.logo('Bet Board');
  if (summaries.length === 0) {
    ro.info('No bets found under .groundwork/bets/.');
    ro.info('The methodology skills write decomposition.json there during bet decomposition.');
    return 0;
  }
  for (const s of summaries) {
    const line = s.progress
      ? `${s.progress.delivered}/${s.progress.total} slices delivered (${s.progress.percent}%) — ${sealSummary(s.seal)}`
      : `no decomposition.json — ${sealSummary(s.seal)}`;
    ro.cmd(s.bet, line);
  }
  ro.info('Run ./dev bet status <slug> for the full board.');
  return 0;
}
