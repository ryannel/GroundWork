// What has happened to a plan's work, in plans/<plan>/progress.yaml: an append-only record. Sync agents and people
// add to it through here, so every event is checked the same way the site checks the file.
//   npm run progress -- add <workspace id or folder> <plan> --subject wi:x --kind commitment|work|note
//       [--state accepted] [--promised-for 2027-03-01] [--confidence high|medium|low] [--said-by "Name"]
//       [--source-kind meeting|partner-update|github|test|scan|document|note] [--url …] [--repo org/name]
//       [--issue 41] [--source-note "…"] [--note "…"] [--at 2026-11-04]
//     appends one event (creating progress.yaml when the plan has none) and refuses one that does not check. A
//     GitHub work event that says what the latest GitHub event for its subject already says is not appended, so
//     the issue sync can run as often as it likes.
//   npm run progress -- show <workspace id or folder> <plan>
//     where each work item, milestone and team stands, and how far today says what each change said.
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { isMap, isSeq, parseDocument } from 'yaml';

import type { ModelPlanStanding } from '@/application/model-plan-standing';
import { modelProgressRecords, type ModelPlanProgress } from '@/application/model-progress';
import { appendEvent, type ProgressSubjects } from '@/application/plan/progress';
import type {
  BlockReason,
  Commitment,
  LastHeard,
  StandingDates,
  WorkProgress,
} from '@/application/plan/work-standing';
import type { Progress, ProgressEvent } from '@/domain/plan/plan.generated';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';
import { readModelPlanEntry } from '@/infrastructure/model-plans';
import { readModelStanding } from '@/infrastructure/model-standing';
import { planDef, defProblems } from '@/infrastructure/plan-schema';
import { readProgress } from '@/infrastructure/progress-store';
import { selectedWorkspace, workspaceFolder } from '@/infrastructure/workspace-folders';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    subject: { type: 'string' },
    kind: { type: 'string' },
    state: { type: 'string' },
    'promised-for': { type: 'string' },
    confidence: { type: 'string' },
    'said-by': { type: 'string' },
    'source-kind': { type: 'string' },
    url: { type: 'string' },
    repo: { type: 'string' },
    issue: { type: 'string' },
    'source-note': { type: 'string' },
    note: { type: 'string' },
    at: { type: 'string' },
  },
});

/** The workspace a folder holds, or the registered workspace with this id. */
async function workspaceId(given: string): Promise<string> {
  const folder = path.resolve(given);
  if (existsSync(path.join(folder, 'workspace.yaml'))) {
    process.env.GROUNDWORK_WORKSPACES = folder;
    const selected = await selectedWorkspace();
    return selected.id;
  }
  const found = await selectedWorkspace(given);
  process.env.GROUNDWORK_WORKSPACES = found.folder;
  return found.id;
}

const only = <T>(key: string, value: T | undefined): Record<string, T> =>
  value === undefined ? {} : { [key]: value };

/** The event the options describe, unchecked: the schema says what is wrong with it. */
function eventFromOptions(): Record<string, unknown> {
  const issue = values.issue === undefined ? undefined : Number(values.issue);
  const source = {
    ...only('kind', values['source-kind']),
    ...only('url', values.url),
    ...only('repo', values.repo),
    ...only('issue', issue),
    ...only('note', values['source-note']),
  };
  return {
    at: values.at ?? new Date().toISOString().slice(0, 10),
    ...only('subject', values.subject),
    ...only('kind', values.kind),
    ...only('state', values.state),
    ...only('promised_for', values['promised-for']),
    ...only('confidence', values.confidence),
    ...only('said_by', values['said-by']),
    ...(Object.keys(source).length === 0 ? {} : { source }),
    ...only('note', values.note),
  };
}

/** The work items and milestones of the plan as written: what its events may be about. */
async function subjectsOf(workspace: string, slug: string): Promise<ProgressSubjects> {
  if ((await readCanonicalModelIndex(workspace)) === null) {
    throw new Error(`No canonical model for ${workspace}.`);
  }
  const selected = await readModelPlanEntry(workspace, slug);
  if (selected === null) throw new Error(`No native plan ${slug} in ${workspace}.`);
  return selected.plan;
}

/** The file with one more event, keeping what is already written (comments included). */
function withEvent(text: string | null, event: ProgressEvent): string {
  const doc = parseDocument(text ?? 'events: []\n');
  const events = isMap(doc.contents) ? doc.contents.get('events', true) : undefined;
  if (isSeq(events)) events.flow = false;
  doc.addIn(['events'], doc.createNode(event));
  return doc.toString({ lineWidth: 0 });
}

async function readIfAny(file: string): Promise<string | null> {
  return existsSync(file) ? readFile(file, 'utf8') : null;
}

/** The event, checked against the schema in the place it will take. */
async function checkedEvent(progress: Progress): Promise<ProgressEvent> {
  const check = await planDef<Progress>('progress');
  const candidate = { events: [...progress.events, eventFromOptions()] };
  if (!check(candidate)) {
    for (const problem of defProblems(check)) console.error(problem);
    throw new Error('the event does not fit progress.yaml; nothing was written');
  }
  const event = candidate.events.at(-1);
  if (event === undefined) throw new Error('no event');
  return event;
}

async function add(workspace: string, slug: string): Promise<void> {
  const folder = await workspaceFolder(workspace);
  if (folder === null) throw new Error(`no workspace ${workspace}`);
  const read = await readProgress(workspace, slug);
  for (const issue of read.errors) console.error(`progress.yaml: ${issue.path}: ${issue.message}`);
  if (read.errors.length > 0) throw new Error(`fix plans/${slug}/progress.yaml first`);
  const event = await checkedEvent(read.progress);
  const result = appendEvent(await subjectsOf(workspace, slug), read.progress, event);
  if (!result.appended && result.unchanged) {
    console.log(`${event.subject} is already ${event.state ?? ''} on GitHub; nothing to append`);
    return;
  }
  if (!result.appended) {
    for (const problem of result.problems) console.error(`${problem.path}: ${problem.message}`);
    throw new Error('the event does not fit the plan; nothing was written');
  }
  const file = path.join(folder, 'plans', slug, 'progress.yaml');
  await writeFile(file, withEvent(await readIfAny(file), event));
  console.log(`appended a ${event.kind} event for ${event.subject} to plans/${slug}/progress.yaml`);
}

/** The parts that are known, in order, as one line. */
const joined = (parts: readonly (string | null)[]): string =>
  parts.filter((part) => part !== null).join(' ');

const when = (prefix: string, value: string | null): string | null =>
  value === null ? null : `${prefix}${value}`;

const promiseWords = (c: Commitment | null): string =>
  c === null
    ? 'none'
    : joined([
        c.state,
        when('for ', c.promisedFor),
        when('with confidence ', c.confidence),
        when('said by ', c.saidBy),
        `on ${c.at}`,
        when('via ', c.source?.kind ?? null),
      ]);

const progressWords = (p: WorkProgress | null): string =>
  p === null ? 'none' : joined([p.state, `on ${p.at}`, when('via ', p.source?.kind ?? null)]);

const heardWords = (heard: LastHeard | null): string =>
  heard === null
    ? 'not heard from'
    : joined([`last heard ${heard.at}`, when('from ', heard.by), when('via ', heard.sourceKind)]);

function gapWords(gapDays: number | null): string | null {
  if (gapDays === null || gapDays === 0) return null;
  const direction = gapDays > 0 ? 'later' : 'earlier';
  return `(${String(Math.abs(gapDays))} days ${direction} than needed)`;
}

function dateWords(dates: StandingDates): string | null {
  const { neededBy, promisedFor, gapDays } = dates;
  if (neededBy === null && promisedFor === null) return null;
  return joined([
    `needed by ${neededBy ?? 'no date'};`,
    `promised for ${promisedFor ?? 'no date'}`,
    gapWords(gapDays),
  ]);
}

const blockerWord = (b: BlockReason): string => `${b.id} (${b.label}: ${b.state ?? b.kind})`;

const blockerWords = (blockers: readonly BlockReason[]): string | null =>
  blockers.length === 0 ? null : `blocked by ${blockers.map(blockerWord).join(', ')}`;

function printLines(head: string, lines: readonly (string | null)[]): void {
  console.log(head);
  for (const line of lines) {
    if (line !== null) console.log(`  ${line}`);
  }
}

function print(standing: ModelPlanStanding): void {
  for (const w of standing.work) {
    printLines(
      `${w.item.id}  ${w.item.title}  [${joined([w.team.name, w.team.partner ? '(partner)' : null])}]`,
      [
        `commitment: ${promiseWords(w.commitment)}`,
        `progress: ${progressWords(w.progress)}`,
        dateWords(w.dates),
        heardWords(w.lastHeard),
        blockerWords(w.blockers),
      ],
    );
  }
  for (const m of standing.milestones) {
    printLines(`${m.milestone.id}  ${m.milestone.name}`, [
      `commitment: ${m.rollup ?? 'none'}; its own: ${promiseWords(m.commitment)}`,
      dateWords(m.dates),
      heardWords(m.lastHeard),
      blockerWords(m.blockers),
    ]);
  }
  for (const t of standing.teams) {
    const partner = t.team.partner ? ' (partner)' : '';
    console.log(`${t.team.id}  ${t.team.name}${partner}: ${heardWords(t.lastHeard)}`);
  }
  for (const c of standing.changes) {
    printLines(
      `${c.change}  ${c.state}`,
      c.ops.map((op) => `op ${String(op.op)} ${op.target}: ${op.state}, ${op.detail}`),
    );
  }
}

function printEvents(progress: ModelPlanProgress): void {
  for (const record of modelProgressRecords(progress)) {
    printLines(
      `${record.subject}  ${record.kind}  ${record.state ?? 'no state recorded'}  on ${record.at}`,
      [
        when('note: ', record.note),
        when('said by ', record.saidBy),
        when('promised for ', record.promisedFor),
        when('confidence ', record.confidence),
        when('source: ', record.source),
        when('source note: ', record.raw.source?.note ?? null),
      ],
    );
  }
}

async function show(workspace: string, slug: string): Promise<void> {
  const native = await readModelStanding(workspace, slug);
  if (native === null) throw new Error(`No canonical plan ${slug} in ${workspace}.`);
  print(native.standing);
  printEvents(native.progress);
  for (const issue of native.problems) console.error(`${issue.path}: ${issue.message}`);
  if (native.problems.length > 0) process.exitCode = 1;
}

const [command, given, slug] = positionals;
const run = { add, show }[command ?? ''];
if (run === undefined || given === undefined || slug === undefined) {
  console.error(
    'usage: npm run progress -- add|show <workspace id or folder> <plan> [options]; see tools/progress.ts',
  );
  process.exitCode = 1;
} else {
  try {
    await run(await workspaceId(given), slug);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
