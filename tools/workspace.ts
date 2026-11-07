// Make and register workspaces. A workspace is its own repo: its system model and its plans, kept anywhere on disk.
//   npm run workspace -- new <folder> --id <id> --name <name> [--description <text>] [--private]
//       make a workspace repo in <folder> (missing or empty), commit it, and register it here
//   npm run workspace -- add <folder | repo URL> [--folder <folder>]
//       register a workspace repo: one already on this machine, or a repo URL, which is cloned into
//       .workspaces/<name> (or --folder) and listed by URL so that pull can fetch it again
//   npm run workspace -- pull
//       clone every listed repo not yet on this machine and fast-forward the rest; the way to set up a fresh
//       Groundwork checkout from a groundwork.local.yaml, and to bring every workspace up to date
//   npm run workspace -- remove <id>
//       stop reading a workspace; its folder or clone is left where it is
//   npm run workspace -- check <folder> [--warnings]
//       read the workspace and its model of today, check every reference in the model resolves, read every
//       programme, and check every plan (with its progress.yaml) against the whole of today; exits 1 on any error.
//       Open plans that change the same thing, neither building on the other, are listed as overlaps.
//       --warnings lists the model's warnings too
//   npm run workspace -- precommit <folder>
//       what a workspace repo's pre-commit hook runs: when YAML is staged, check as above, and refuse a staged plan
//       whose base.lock.json does not hold the check of what it says now. The app trusts these checks rather than
//       repeat them on every page, so nothing that fails them should be committed
//   npm run workspace -- list [--json]
//       the names, ids, locations and registration sources this checkout reads
//   npm run workspace -- open <id> [--origin http://localhost:3000]
//       open a registered workspace in the browser
// Registering writes the folder or repo into groundwork.local.yaml (git-ignored, one per machine), links Groundwork's
// skills into the workspace repo as .agents/skills, .claude/skills and .github/skills, which its .gitignore keeps
// out of git, and installs the repo's pre-commit hook (in .git/hooks, so also out of git) to run precommit; add and
// pull install it again if it is missing. Reload the page after linking; the app reads registration changes without
// restarting.
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import {
  chmod,
  lstat,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { stringify } from 'yaml';

import { indexOf } from '@/application/model-index';
import { workspaceHref } from '@/application/workspace-paths';
import type { WorkspaceModel } from '@/domain/workspace-model';
import { readModelIfCanonical } from '@/infrastructure/canonical-model';
import { readModelFrozenBases } from '@/infrastructure/model-plan-base';
import { readModelPlans } from '@/infrastructure/model-plans';
import { validateModel, validatePlanProjections } from '@/infrastructure/validate-model';
import {
  folderOf,
  type LocalEntry,
  readLocal,
  registeredAt,
  registrationsAt,
} from '@/infrastructure/workspace-folders';

const HOME = process.cwd();
const LOCAL = path.join(HOME, 'groundwork.local.yaml');
const SKILLS = path.join(HOME, '.agents', 'skills');
const LINKS = ['.agents/skills', '.claude/skills', '.github/skills'];
const ID = /^[a-z0-9][a-z0-9-]*$/u;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    id: { type: 'string' },
    name: { type: 'string' },
    description: { type: 'string' },
    folder: { type: 'string' },
    private: { type: 'boolean', default: false },
    warnings: { type: 'boolean', default: false },
    json: { type: 'boolean', default: false },
    origin: { type: 'string', default: 'http://localhost:3000' },
  },
});

/** Resolve a registered folder through the same consolidated reader as the app. */
async function canonicalAt(folder: string): Promise<WorkspaceModel> {
  process.env.GROUNDWORK_WORKSPACES = folder;
  const [registered] = await registrationsAt(HOME, { env: folder, local: true });
  if (registered === undefined) throw new Error(`${folder}: no workspace read`);
  const model = await readModelIfCanonical(registered.id);
  if (model === null) throw new Error(`${folder}: a consolidated model (format: 2) is required.`);
  return model;
}
async function validate(folder: string): Promise<string> {
  const model = await canonicalAt(folder);
  const issues = await validateModel(model);
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => `${issue.at}: ${issue.message}`).join('\n'));
  }
  return model.id;
}

const HEADER =
  '# The workspaces this checkout reads, besides the examples in workspaces/. One per machine; not in git.\n' +
  '# Each is a folder on this machine, or `repo: <url>` (with an optional `folder:`), which\n' +
  '# `npm run workspace -- pull` clones into .workspaces/. `bundled: false` leaves the examples out.\n' +
  '# Written by `npm run workspace`; copy it to another checkout and run pull to read the same workspaces.\n';

async function writeLocal(workspaces: readonly LocalEntry[], bundled: boolean): Promise<void> {
  const temporary = `${LOCAL}.${String(process.pid)}.tmp`;
  try {
    await writeFile(
      temporary,
      HEADER + stringify({ ...(bundled ? {} : { bundled: false }), workspaces }),
    );
    await rename(temporary, LOCAL);
  } finally {
    await rm(temporary, { force: true });
  }
}

const where = (entry: LocalEntry): string => path.resolve(HOME, folderOf(entry));

async function register(entry: LocalEntry, id: string): Promise<void> {
  const { workspaces, bundled } = await readLocal(HOME);
  const found = await registeredAt(HOME, { local: true });
  const existing = found.get(id);
  if (existing !== undefined && existing !== where(entry)) {
    throw new Error(
      `workspace ${id}: found in both ${existing} and ${where(entry)}; link not changed`,
    );
  }
  if (existing === where(entry)) return;
  if (!workspaces.some((each) => where(each) === where(entry))) {
    await writeLocal([...workspaces, entry], bundled);
  }
}

/** Whether `given` names a repo to clone rather than a folder on this machine. */
const isRepo = (given: string): boolean =>
  given.includes('://') || /^[\w.-]+@[\w.-]+:/u.test(given);

function git(args: readonly string[], cwd = HOME): void {
  execFileSync('git', args, { cwd, stdio: 'inherit' });
}

async function linkSkills(folder: string): Promise<void> {
  for (const link of LINKS) {
    const at = path.join(folder, link);
    const there = await lstat(at).catch(() => null);
    if (there === null) {
      await mkdir(path.dirname(at), { recursive: true });
      await symlink(SKILLS, at);
    } else if (!there.isSymbolicLink()) {
      console.warn(
        `${link} is a real folder in ${folder}; left alone, so Groundwork's skills are not linked there`,
      );
    }
  }
}

const HOOK_MARK = '# groundwork: check the workspace before each commit';

/** The pre-commit hook: hands the repo to this checkout's precommit, wherever the repo is committed from. */
function hookScript(): string {
  const quoted = HOME.replaceAll("'", String.raw`'\''`);
  const home = `'${quoted}'`;
  return `#!/bin/sh
${HOOK_MARK}
# Installed by \`npm run workspace -- add\` in the Groundwork checkout at ${HOME}. Groundwork's pages trust the
# check each plan passed when it was written, so a plan that fails it, or has changed since, is not committed.
exec npm --prefix ${home} run --silent workspace -- precommit "$(git rev-parse --show-toplevel)"
`;
}

/** The repo's own hooks folder, or null when the folder is not the top of a git repo (an example in workspaces/). */
function hooksOf(folder: string): string | null {
  const run = (args: readonly string[]): string =>
    execFileSync('git', args, { cwd: folder, encoding: 'utf8', stdio: 'pipe' }).trim();
  try {
    if (realpathSync(run(['rev-parse', '--show-toplevel'])) !== realpathSync(folder)) return null;
    return run(['rev-parse', '--path-format=absolute', '--git-path', 'hooks']);
  } catch {
    return null;
  }
}

/** Install the pre-commit hook, leaving a hook Groundwork did not write alone. */
async function installHook(folder: string): Promise<void> {
  const hooks = hooksOf(folder);
  if (hooks === null) return;
  const file = path.join(hooks, 'pre-commit');
  const there = await readFile(file, 'utf8').catch(() => null);
  if (there !== null && !there.includes(HOOK_MARK)) {
    console.warn(
      `${file} is not Groundwork's; left alone, so commits there are not checked. Have it run: npm --prefix ${HOME} run --silent workspace -- precommit "$(git rev-parse --show-toplevel)"`,
    );
    return;
  }
  await mkdir(hooks, { recursive: true });
  await writeFile(file, hookScript());
  await chmod(file, 0o755);
}

async function add(given: string): Promise<void> {
  let entry: LocalEntry = path.resolve(given);
  if (isRepo(given)) {
    entry = values.folder === undefined ? { repo: given } : { repo: given, folder: values.folder };
    const into = where(entry);
    const there = await readdir(into).catch(() => null);
    if (there === null) git(['clone', '--', given, into]);
    else if (there.length > 0) console.log(`${into} is already there; using it as it is`);
  }
  const folder = where(entry);
  const id = await validate(folder);
  await register(entry, id);
  await linkSkills(folder);
  await installHook(folder);
  console.log(`registered ${id} at ${folder}; reload the page to see it at ${workspaceHref(id)}`);
}

async function pull(): Promise<void> {
  const { workspaces } = await readLocal(HOME);
  for (const entry of workspaces) {
    if (typeof entry === 'string') continue;
    const into = where(entry);
    const there = await lstat(into).catch(() => null);
    console.log(`${entry.repo} → ${path.relative(HOME, into)}`);
    if (there === null) git(['clone', '--', entry.repo, into]);
    else git(['pull', '--ff-only'], into);
  }
  await Promise.all(
    workspaces.map(async (entry) => {
      await linkSkills(where(entry));
      await installHook(where(entry));
    }),
  );
  await list();
}

async function remove(id: string): Promise<void> {
  const found = await registeredAt(HOME, { local: true });
  const folder = found.get(id);
  if (folder === undefined) throw new Error(`no workspace ${id} is registered`);
  const { workspaces, bundled } = await readLocal(HOME);
  const kept = workspaces.filter((entry) => where(entry) !== folder);
  if (kept.length === workspaces.length) {
    throw new Error(`${id} is an example in workspaces/; set bundled: false to leave them out`);
  }
  await writeLocal(kept, bundled);
  console.log(`no longer reading ${id}; its folder is still at ${folder}`);
}

function workspaceYaml(id: string, name: string): string {
  const body = stringify({
    format: 2,
    id,
    name,
    ...(values.description === undefined ? {} : { description: values.description }),
    private: values.private,
    teams: [],
    actors: [],
  });
  return `# The workspace: the teams who build here and the people and systems that use what they build.\n# Domains go in domains/<domain>/domain.yaml, systems in domains/<domain>/systems/<system>/system.yaml.\n${body}`;
}

function readme(name: string, repo: string): string {
  return `# ${name}

The systems ${name} runs today, and the plans that change them, for [Groundwork](https://github.com/ryannel/GroundWork).

- \`workspace.yaml\`: the teams and the actors who use the systems.
- \`domains/<domain>/systems/<system>/\`: each system, its components and its contracts, read from the code.
- \`flows/\`, \`journeys/\`, \`story.yaml\` and each domain's \`language.yaml\`: how the systems work together today, and the words they use.
- \`domains/<domain>/target.yaml\`: where each domain is heading, its target architecture.
- \`scans/<org>/<repo>.yaml\`: the commit each code repo was last read at.
- \`plans/<plan>/\`: the plans, each put onto today's model.

To view it, clone Groundwork and, in that checkout, link this repo by its URL (Groundwork clones it into
\`.workspaces/\`) or by the folder you keep it in:

\`\`\`sh
npm run workspace -- add <this repo's URL>   # or: npm run workspace -- add ../${repo}
npm run dev
\`\`\`
`;
}

function agents(name: string): string {
  return `# Working on the ${name} workspace

This repo is a Groundwork workspace: the systems ${name} runs today, described from the code, and the plans that
change them. Groundwork itself, its app, its tools and its skills, is a separate checkout.

- Groundwork's skills are linked in as \`.agents/skills\`, \`.claude/skills\` and \`.github/skills\` by
  \`npm run workspace -- add <this folder>\`, run in the Groundwork checkout. Run that if they are missing.
- Groundwork's commands (\`npm run map\`, \`npm run plan:base\`, \`node tools/…\`) run in the Groundwork checkout, not
  here. Where a skill says \`<workspace>\`, it means this folder.
- In that checkout, start with \`npm run --silent workspace -- list --json\` to resolve this workspace's id and folder;
  do not look only in Groundwork's \`workspaces/\`, which holds examples. Select \`--workspace <id>\` explicitly
  when several workspaces are registered.
- Every fact about a system cites the code it was read from (repo, path, lines, commit). Do not write facts the code
  does not show; leave them out, or ask.
- The levels are workspace, domain, system and component, and nothing else.
- Write in plain British English. A headline says what is true, not what the page holds.
`;
}

const GITIGNORE = `# Groundwork's skills, linked in by \`npm run workspace -- add\`
.agents/skills
.claude/skills
.github/skills
.DS_Store
`;

function commit(folder: string): void {
  try {
    execFileSync('git', ['init', '--quiet', '--initial-branch', 'main'], { cwd: folder });
    execFileSync('git', ['add', '.'], { cwd: folder });
    execFileSync('git', ['commit', '--quiet', '-m', 'Start the workspace'], { cwd: folder });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `made the workspace but could not commit it (${message.trim()}); commit it by hand`,
    );
  }
}

async function make(given: string): Promise<void> {
  const { id, name } = values;
  if (id === undefined || name === undefined) throw new Error('new needs --id and --name');
  if (!ID.test(id)) throw new Error(`--id ${id}: lower case letters, digits and hyphens`);
  const folder = path.resolve(given);
  const entries = await readdir(folder).catch(() => []);
  if (entries.length > 0) {
    throw new Error(`${folder} is not empty; to register a workspace repo, use add`);
  }
  const taken = await registeredAt(HOME, { local: true });
  if (taken.has(id)) throw new Error(`workspace ${id} is already at ${taken.get(id) ?? ''}`);
  await mkdir(path.join(folder, 'domains'), { recursive: true });
  await Promise.all([
    writeFile(path.join(folder, 'workspace.yaml'), workspaceYaml(id, name)),
    writeFile(path.join(folder, 'README.md'), readme(name, path.basename(folder))),
    writeFile(path.join(folder, 'AGENTS.md'), agents(name)),
    writeFile(path.join(folder, '.gitignore'), GITIGNORE),
    writeFile(path.join(folder, 'domains', '.gitkeep'), ''),
  ]);
  await validate(folder);
  commit(folder);
  await add(folder);
}

const count = (n: number, word: string): string => `${String(n)} ${word}${n === 1 ? '' : 's'}`;

/** Canonical checks use the same strict model and plan projection boundaries as migration validation. */
async function checkCanonical(model: WorkspaceModel): Promise<string> {
  const index = indexOf(model);
  const problems = [
    ...index
      .gaps()
      .filter((gap) => gap.kind === 'unbacked_connection')
      .map((gap) => ({
        at: gap.id,
        message: gap.message,
      })),
  ];
  const plans = await readModelPlans(model.id);
  const frozenBases = await readModelFrozenBases(model.id);
  const batch = await validatePlanProjections(plans, model, { frozenBases });
  const broken = plans.length - batch.plans.filter((plan) => plan.problems.length === 0).length;
  problems.push(...batch.problems);
  for (const problem of problems) console.error(`${problem.at}: ${problem.message}`);
  const gaps = index.gaps();
  if (values.warnings) {
    for (const gap of gaps) console.warn(`${gap.id}: ${gap.message}`);
  }
  const counts = [
    count(model.domains.length, 'domain'),
    count(model.domains.flatMap((domain) => domain.systems).length, 'system'),
    count(model.flows.length, 'flow'),
    count(index.entities.filter((node) => node.kind === 'concept').length, 'concept'),
    count(model.programmes.length, 'programme'),
    `${String(plans.length - broken)} of ${count(plans.length, 'plan')} read`,
    count(gaps.length, 'warning'),
  ];
  console.log(`${model.id}: ${counts.join(', ')}`);
  if (problems.length > 0) process.exitCode = 1;
  return model.id;
}

/** Check the workspace in `given`; exits 1 on any error. Its id, to read its plans by. */
async function check(given: string): Promise<string> {
  return checkCanonical(await canonicalAt(path.resolve(given)));
}

const PLAN_FILE = /^plans\/[^/]+\/plan\.yaml$/u;

function gitLines(folder: string, args: readonly string[]): string[] {
  const out = execFileSync('git', args, { cwd: folder, encoding: 'utf8', stdio: 'pipe' });
  return out.split('\0').filter((line) => line !== '');
}

/** Fresh canonical projection checks replace a legacy lock; staged plans must match the checked text. */
function unstagedCanonicalPlans(folder: string, staged: readonly string[]): readonly string[] {
  const unstaged = new Set(gitLines(folder, ['diff', '--name-only', '-z']));
  return staged
    .filter((file) => PLAN_FILE.test(file) && unstaged.has(file))
    .map(
      (file) => `${file} has changes which were checked but are not staged; stage the checked plan`,
    );
}

/** What a workspace repo's pre-commit hook runs: the check, when YAML is staged, and each staged plan's lock. */
async function precommit(given: string): Promise<void> {
  const folder = path.resolve(given);
  const staged = gitLines(folder, ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']);
  const read = staged.filter(
    (file) => /\.(?:ya?ml|json)$/u.test(file) && !/^(?:explorer|evidence)\//u.test(file),
  );
  if (read.length === 0) return;
  await check(folder);
  const problems = unstagedCanonicalPlans(folder, staged);
  for (const problem of problems) console.error(problem);
  if (problems.length > 0) process.exitCode = 1;
  if (process.exitCode === 1) {
    console.error(
      'Not committed: fix the above, or commit with --no-verify to skip the check once.',
    );
  }
}

async function list(): Promise<void> {
  const found = await registrationsAt(HOME, {
    env: process.env.GROUNDWORK_WORKSPACES,
    local: true,
  });
  const rows = found.map((workspace) => ({
    ...workspace,
    href: workspaceHref(workspace.id),
  }));
  if (values.json) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }
  if (rows.length === 0) {
    console.log('No workspaces linked. Run npm run workspace -- add <folder or repo URL>.');
    return;
  }
  for (const row of rows) {
    console.log(
      `${row.name} (${row.id})\t${row.isExample ? 'example' : 'workspace'}\t${row.source}\t${row.folder}\t${row.href}`,
    );
    if (row.repo !== null) console.log(`  repo: ${row.repo}`);
  }
  if ((process.env.GROUNDWORK_WORKSPACES?.trim() ?? '') !== '') {
    console.log('GROUNDWORK_WORKSPACES overrides local links and bundled examples.');
  }
}

async function openWorkspace(id: string): Promise<void> {
  const found = await registeredAt(HOME, { env: process.env.GROUNDWORK_WORKSPACES, local: true });
  const folder = found.get(id);
  if (folder === undefined) {
    throw new Error(`No workspace ${id}; run npm run workspace -- list to find its id.`);
  }
  const origin = new URL(values.origin);
  const web = origin.protocol === 'http:' || origin.protocol === 'https:';
  const credentials = origin.username !== '' || origin.password !== '';
  const extra = origin.pathname !== '/' || origin.search !== '' || origin.hash !== '';
  if (!web || credentials || extra) {
    throw new Error('--origin must be an HTTP or HTTPS origin, such as http://localhost:3000');
  }
  const url = new URL(workspaceHref(id), origin).href;
  console.log(`Opening ${id} at ${url} (${folder})`);
  if (process.platform === 'darwin') execFileSync('open', [url], { stdio: 'inherit' });
  else if (process.platform === 'win32') {
    execFileSync('rundll32', ['url.dll,FileProtocolHandler', url], { stdio: 'inherit' });
  } else execFileSync('xdg-open', [url], { stdio: 'inherit' });
}

const [command, folder] = positionals;
if (command === 'list') {
  await list();
} else if (command === 'pull') {
  await pull();
} else if (command === 'remove' && folder !== undefined) {
  await remove(folder);
} else if (command === 'open' && folder !== undefined) {
  await openWorkspace(folder);
} else if (command === 'check' && folder !== undefined) {
  await check(folder);
} else if (command === 'precommit' && folder !== undefined) {
  await precommit(folder);
} else if ((command === 'new' || command === 'add') && folder !== undefined) {
  await (command === 'new' ? make(folder) : add(folder));
} else {
  console.error(
    'usage: npm run workspace -- new|add|check|precommit <folder> | remove|open <id> | pull | list [--json]; see tools/workspace.ts',
  );
  process.exitCode = 1;
}
