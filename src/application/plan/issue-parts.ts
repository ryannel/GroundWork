// The plan's content for a GitHub issue, one Markdown section at a time: summary, why, how (the ops checklist)
// and acceptance (the tests). The notes section is in issue-notes.ts; issues.ts puts them together.

import type { Model } from '@/application/plan/derive';
import type { Change, Milestone, Team, Test, WorkItem } from '@/domain/plan/plan.generated';

/** What the issue body reads from a model. */
export type IssueModel = Pick<
  Model,
  'plan' | 'label' | 'diff' | 'get' | 'blockersOf' | 'overdue' | 'inverse'
>;

/** Replace [[id]] citations with "label (`id`)" for plain Markdown readers. */
export const unlink = (model: IssueModel, text: string | undefined): string =>
  (text ?? '')
    .replaceAll(/\[\[([^\]\s]{1,200})\]\]/gu, (_, id: string) => `${model.label(id)} (\`${id}\`)`)
    .trim();

/** Join lines, squeezing runs of blank lines. */
export const block = (lines: readonly string[]): string =>
  lines
    .join('\n')
    .replaceAll(/\n{3,}/gu, '\n\n')
    .trim();

/** A team channel, or '' for a placeholder such as "tbd". */
function realChannel(team: Team | undefined): string {
  const c = (team?.channel ?? '').trim();
  return /^(?:todo|tbd|tbc|\?+|-|n\/a)?$/iu.test(c) ? '' : c;
}

export function summaryOf(model: IssueModel, wi: WorkItem, ms: Milestone | undefined): string {
  const team = model.plan.teams.find((t) => t.id === wi.team);
  const channel = realChannel(team);
  const suffix = channel === '' ? '' : ` (${channel})`;
  const meta = [
    team === undefined ? '' : `**Team:** ${team.name}${suffix}`,
    wi.size === undefined ? '' : `**Size:** ${wi.size}`,
    ms === undefined ? '' : `**Milestone:** ${ms.name}`,
    wi.repo === undefined ? '' : `**Repo:** ${wi.repo}`,
  ].filter((x) => x !== '');
  const body = unlink(model, wi.body);
  return block([body === '' ? wi.title : body, '', meta.join(' · ')]);
}

/** The reason for each change, and what the milestone makes work. */
export function whyOf(
  model: IssueModel,
  changes: readonly (readonly [string, Change | undefined])[],
  ms: Milestone | undefined,
): string {
  const lines = changes.flatMap(([, c]) =>
    c?.why === undefined || c.why === '' ? [] : [`- **${c.title}:** ${unlink(model, c.why)}`],
  );
  if (ms?.exit !== undefined && ms.exit !== '') {
    lines.push('', `> Milestone exit: ${unlink(model, ms.exit)}`);
  }
  return block(lines);
}

/** The ops checklist, one block per implemented change. */
export function howOf(
  model: IssueModel,
  changes: readonly (readonly [string, Change | undefined])[],
): string {
  const lines = changes.flatMap(([id, c]) => {
    const byOp = new Map<number, string[]>();
    for (const e of model.diff(id)) {
      byOp.set(e.opIndex, [...(byOp.get(e.opIndex) ?? []), e.summary]);
    }
    const checks = [...byOp.values()].map((s) => `- [ ] ${s.join('; ')}`);
    const rollout =
      c?.rollout === undefined || c.rollout === ''
        ? []
        : ['', `**Rollout:** ${unlink(model, c.rollout)}`];
    return [
      `#### ${c?.title ?? id} (\`${id}\`)`,
      '',
      ...(checks.length > 0 ? checks : ['- [ ] (no ops)']),
      ...rollout,
      '',
    ];
  });
  return block(lines);
}

const capital = (s: string): string => `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`;

function testLines(model: IssueModel, t: Test): string[] {
  const env = t.env === undefined ? '' : ` · ${t.env}`;
  const steps = (['given', 'when', 'then'] as const).flatMap((k) => {
    const text = t[k];
    return text === undefined || text === '' ? [] : [`  - ${capital(k)} ${unlink(model, text)}`];
  });
  return [`- [ ] **${t.name}** (\`${t.id}\` · ${t.level}${env})`, ...steps];
}

/** The tests that verify this item. */
export function acceptanceOf(model: IssueModel, wi: WorkItem): string {
  const tests = (wi.verified_by ?? []).flatMap(
    (id) => model.plan.tests?.find((t) => t.id === id) ?? [],
  );
  if (tests.length === 0) return '- [ ] _No tests listed in verified_by_';
  return block(tests.flatMap((t) => testLines(model, t)));
}
