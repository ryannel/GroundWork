import * as fs from 'fs';
import * as path from 'path';
import { Ctx, CliError } from '../util/context';
import { capture } from '../util/proc';
import { ROOT, TESTS_DIR, DOCS_DIR } from '../util/paths';
import { getAppServices } from '../util/services';
import { isInteractive, selectPrompt, textPrompt } from '../util/prompt';

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
