// The notes section of an issue: what the item depends on, which questions it waits on, and links to the
// decisions, questions and risks around it.

import { block, unlink, type IssueModel } from '@/application/plan/issue-parts';
import type { WorkItem } from '@/domain/plan/plan.generated';

const uniq = (xs: string[]): string[] => [...new Set(xs)];

function dependsOn(model: IssueModel, wi: WorkItem): string[] {
  const deps = wi.depends_on ?? [];
  if (deps.length === 0) return [];
  return ['#### Depends on', '', ...deps.map((d) => `- [ ] ${model.label(d)} (\`${d}\`)`), ''];
}

type Today = Date | string | undefined;

/** A string field of an entity, when it has one. */
function fieldOf(model: IssueModel, id: string, key: string): string | undefined {
  const value: unknown = Reflect.get(model.get(id) ?? {}, key);
  return typeof value === 'string' ? value : undefined;
}

function waitLine(model: IssueModel, qid: string, today: Today): string {
  const asked = unlink(model, fieldOf(model, qid, 'question'));
  const by = fieldOf(model, qid, 'decider');
  const decider = by === undefined ? 'no decider' : model.label(by);
  const due = fieldOf(model, qid, 'decide_by');
  const late = due !== undefined && model.overdue(qid, today);
  const lateMark = late ? ' (**overdue**)' : '';
  const when = due === undefined ? 'no decide-by date' : `decide by ${due}${lateMark}`;
  return `- [ ] ${asked === '' ? qid : asked} (\`${qid}\`) — ${decider} · ${when}`;
}

function waitsOn(model: IssueModel, blockers: string[], today: Today): string[] {
  if (blockers.length === 0) return [];
  return ['#### Waits on', '', ...blockers.map((q) => waitLine(model, q, today)), ''];
}

const statusOf = (model: IssueModel, id: string): string => fieldOf(model, id, 'status') ?? '?';

const textOf = (model: IssueModel, id: string, key: 'question' | 'statement'): string =>
  unlink(model, fieldOf(model, id, key));

function links(model: IssueModel, wi: WorkItem, blockers: string[]): string[] {
  const inv = wi.implements.map((c) => model.inverse(c));
  const decisions = uniq(inv.flatMap((i) => i.decisions));
  const questions = uniq([
    ...inv.flatMap((i) => i.questions),
    ...model.inverse(wi.id).questions,
  ]).filter((q) => statusOf(model, q) !== 'resolved' && !blockers.includes(q));
  const risks = uniq(inv.flatMap((i) => i.risks));
  return [
    '#### Links',
    '',
    ...decisions.map((d) => `- Decision: ${model.label(d)} (\`${d}\`, ${statusOf(model, d)})`),
    ...questions.map((q) => `- Open question: ${textOf(model, q, 'question')} (\`${q}\`)`),
    ...risks.map((r) => `- Risk: ${textOf(model, r, 'statement')} (\`${r}\`)`),
    `- Plan: ${model.plan.meta.title} · \`${wi.id}\``,
  ];
}

export function notesOf(model: IssueModel, wi: WorkItem, today: Today): string {
  const blockers = model.blockersOf(wi.id);
  return block([
    ...dependsOn(model, wi),
    ...waitsOn(model, blockers, today),
    ...links(model, wi, blockers),
  ]);
}
