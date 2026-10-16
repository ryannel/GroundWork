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
//       read the workspace and its model of today, check every reference in the model resolves, and read every
//       plan onto it, as the app does; exits 1 on any error. --warnings lists the model's warnings too
//   npm run workspace -- list
//       the workspaces this checkout reads, and where each one is
// Registering writes the folder or repo into groundwork.local.yaml (git-ignored, one per machine) and links Groundwork's
// skills into the workspace repo as .agents/skills, .claude/skills and .github/skills, which its .gitignore keeps
// out of git. Restart `npm run dev` after registering: Next does not watch folders outside this checkout.
import { execFileSync } from 'node:child_process';
import { lstat, mkdir, readdir, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { stringify } from 'yaml';

import { systemModelOf } from '@/application/workspace-model';
import { listPlans } from '@/infrastructure/plan-store';
import { checkPlanData } from '@/infrastructure/plan-validator';
import {
  folderOf,
  type LocalEntry,
  readLocal,
  registeredAt,
} from '@/infrastructure/workspace-folders';
import { readWorkspaceModel } from '@/infrastructure/workspace-model';
import { readPlanState } from '@/infrastructure/workspace-plans';
import { readWorkspaces } from '@/infrastructure/workspace-store';

const HOME = process.cwd();
const LOCAL = path.join(HOME, 'groundwork.local.yaml');
const SKILLS = path.join(HOME, '.agents', 'skills');
const LINKS = ['.agents/skills', '.claude/skills', '.github/skills'];
const ID = /^[a-z0-9][a-z0-9-]*$/;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    id: { type: 'string' },
    name: { type: 'string' },
    description: { type: 'string' },
    folder: { type: 'string' },
    private: { type: 'boolean', default: false },
    warnings: { type: 'boolean', default: false },
  },
});

/** Read the workspace in `folder` exactly as the app would, so a bad one fails here and not in the build. */
async function validate(folder: string): Promise<string> {
  process.env.GROUNDWORK_WORKSPACES = folder;
  const [workspace] = await readWorkspaces();
  if (workspace === undefined) throw new Error(`${folder}: no workspace read`);
  return workspace.id;
}

const HEADER =
  '# The workspaces this checkout reads, besides the examples in workspaces/. One per machine; not in git.\n' +
  '# Each is a folder on this machine, or `repo: <url>` (with an optional `folder:`), which\n' +
  '# `npm run workspace -- pull` clones into .workspaces/. `bundled: false` leaves the examples out.\n' +
  '# Written by `npm run workspace`; copy it to another checkout and run pull to read the same workspaces.\n';

async function writeLocal(workspaces: readonly LocalEntry[], bundled: boolean): Promise<void> {
  await writeFile(
    LOCAL,
    HEADER + stringify({ ...(bundled ? {} : { bundled: false }), workspaces }),
  );
}

const where = (entry: LocalEntry): string => path.resolve(HOME, folderOf(entry));

async function register(entry: LocalEntry): Promise<void> {
  const { workspaces, bundled } = await readLocal(HOME);
  if (!workspaces.some((each) => where(each) === where(entry)))
    await writeLocal([...workspaces, entry], bundled);
  await registeredAt(HOME, { local: true });
}

/** Whether `given` names a repo to clone rather than a folder on this machine. */
const isRepo = (given: string): boolean => given.includes('://') || /^[\w.-]+@[\w.-]+:/.test(given);

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
  await register(entry);
  await linkSkills(folder);
  console.log(`registered ${id} at ${folder}; restart npm run dev to see it at /${id}/`);
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
  await Promise.all(workspaces.map(async (entry) => linkSkills(where(entry))));
  await list();
}

async function remove(id: string): Promise<void> {
  const found = await registeredAt(HOME, { local: true });
  const folder = found.get(id);
  if (folder === undefined) throw new Error(`no workspace ${id} is registered`);
  const { workspaces, bundled } = await readLocal(HOME);
  const kept = workspaces.filter((entry) => where(entry) !== folder);
  if (kept.length === workspaces.length)
    throw new Error(`${id} is an example in workspaces/; set bundled: false to leave them out`);
  await writeLocal(kept, bundled);
  console.log(`no longer reading ${id}; its folder is still at ${folder}`);
}

function workspaceYaml(id: string, name: string): string {
  const body = stringify({
    format: 1,
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
- \`flows/\`, \`journeys/\`, \`story.yaml\`: how the systems work together today.
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
  if (entries.length > 0)
    throw new Error(`${folder} is not empty; to register a workspace repo, use add`);
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

async function check(given: string): Promise<void> {
  const folder = path.resolve(given);
  process.env.GROUNDWORK_WORKSPACES = folder;
  const [workspace] = await readWorkspaces();
  if (workspace === undefined) throw new Error(`${folder}: no workspace read`);
  const model = await readWorkspaceModel(workspace);
  const today = await checkPlanData(systemModelOf(workspace, model).plan);
  for (const issue of today.errors) console.error(`today: ${issue.path}: ${issue.message}`);
  if (values.warnings)
    for (const issue of today.warnings) console.warn(`today: ${issue.path}: ${issue.message}`);
  const slugs = await listPlans(workspace.id);
  const states = await Promise.all(slugs.map(async (slug) => readPlanState(workspace.id, slug)));
  const broken = states.flatMap((state) => (state?.broken ? [state.broken] : []));
  for (const plan of broken)
    for (const issue of plan.errors)
      console.error(`plans/${plan.slug}: ${issue.path}: ${issue.message}`);
  const systems = workspace.domains.reduce((sum, domain) => sum + domain.systems.length, 0);
  const read = slugs.length - broken.length;
  const counts = [
    count(workspace.domains.length, 'domain'),
    count(systems, 'system'),
    count(model.flows.length, 'flow'),
    `${String(read)} of ${count(slugs.length, 'plan')} read`,
    count(today.warnings.length, 'warning'),
  ];
  console.log(`${workspace.id}: ${counts.join(', ')}`);
  if (broken.length > 0 || today.errors.length > 0) process.exitCode = 1;
}

async function list(): Promise<void> {
  const found = await registeredAt(HOME, { env: process.env.GROUNDWORK_WORKSPACES, local: true });
  for (const [id, folder] of found) console.log(`${id}\t${folder}`);
}

const [command, folder] = positionals;
if (command === 'list') {
  await list();
} else if (command === 'pull') {
  await pull();
} else if (command === 'remove' && folder !== undefined) {
  await remove(folder);
} else if (command === 'check' && folder !== undefined) {
  await check(folder);
} else if ((command === 'new' || command === 'add') && folder !== undefined) {
  await (command === 'new' ? make(folder) : add(folder));
} else {
  console.error(
    'usage: npm run workspace -- new|add|check <folder> | remove <id> | pull | list; see tools/workspace.ts',
  );
  process.exitCode = 1;
}
