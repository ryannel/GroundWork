// Make and register workspaces. A workspace is its own repo: its system model and its plans, kept anywhere on disk.
//   npm run workspace -- new <folder> --id <id> --name <name> [--description <text>] [--private]
//       make a workspace repo in <folder> (missing or empty), commit it, and register it here
//   npm run workspace -- add <folder>
//       register a workspace repo that is already on this machine, such as a fresh clone
//   npm run workspace -- check <folder> [--warnings]
//       read the workspace and its model of today, check every reference in the model resolves, and read every
//       plan onto it, as the app does; exits 1 on any error. --warnings lists the model's warnings too
//   npm run workspace -- list
//       the workspaces this checkout reads, and where each one is
// Registering writes the folder into groundwork.local.yaml (git-ignored, one per machine) and links Groundwork's
// skills into the workspace repo as .agents/skills, .claude/skills and .github/skills, which its .gitignore keeps
// out of git. Restart `npm run dev` after registering: Next does not watch folders outside this checkout.
import { execFileSync } from 'node:child_process';
import { lstat, mkdir, readdir, readFile, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { parse, stringify } from 'yaml';

import { systemModelOf } from '@/application/workspace-model';
import { listPlans } from '@/infrastructure/plan-store';
import { checkPlanData } from '@/infrastructure/plan-validator';
import { registeredAt } from '@/infrastructure/workspace-folders';
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

async function localFile(): Promise<Record<string, unknown>> {
  const text = await readFile(LOCAL, 'utf8').catch(() => null);
  const data: unknown = text === null ? {} : parse(text);
  return typeof data === 'object' && data !== null ? { ...data } : {};
}

async function register(folder: string): Promise<void> {
  const local = await localFile();
  const listed = Array.isArray(local.workspaces) ? local.workspaces.map(String) : [];
  const known = listed.map((each) => path.resolve(HOME, each));
  if (!known.includes(folder)) {
    const header =
      '# The workspace repos this checkout reads, besides the examples in workspaces/. One per machine; not in git.\n' +
      '# Written by `npm run workspace`; `bundled: false` leaves the examples out.\n';
    const next = { ...local, workspaces: [...listed, folder] };
    await writeFile(LOCAL, header + stringify(next));
  }
  await registeredAt(HOME, { local: true });
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
  const folder = path.resolve(given);
  const id = await validate(folder);
  await register(folder);
  await linkSkills(folder);
  console.log(`registered ${id} at ${folder}; restart npm run dev to see it at /${id}/`);
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

To view it, clone Groundwork beside this repo and register it:

\`\`\`sh
npm run workspace -- add ../${repo}
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
} else if (command === 'check' && folder !== undefined) {
  await check(folder);
} else if ((command === 'new' || command === 'add') && folder !== undefined) {
  await (command === 'new' ? make(folder) : add(folder));
} else {
  console.error(
    'usage: npm run workspace -- <new|add|check> <folder> | list; see the head of tools/workspace.ts',
  );
  process.exitCode = 1;
}
