// The weekly update: a PlanDiff as Markdown, naming ids from whichever revision has them.

import { objects } from '@/application/plan/derive-values';
import { prop, type Rec } from '@/application/plan/ids';
import {
  type ChangeOps,
  type EntityDiff,
  type PlanDiff,
  type PlanMeta,
  collections,
  text,
} from '@/application/plan/plan-diff-core';

/** The two revisions a diff compares, for naming ids. */
export interface DiffPlans {
  from: unknown;
  to: unknown;
}

type Namer = (id: string) => string;

const oneLine = (v: unknown): string => (text(v) ?? '').replaceAll(/\s+/g, ' ').trim();

const NAME_KEYS = ['title', 'name', 'question', 'statement'];

function namer(plans: DiffPlans): Namer {
  const index = new Map<string, Rec>();
  for (const p of [plans.from, plans.to])
    for (const items of Object.values(collections(p)))
      for (const [id, e] of items) index.set(id, e);
  return (id) => {
    const e = index.get(id);
    const name = NAME_KEYS.map((k) => oneLine(e?.[k])).find((x) => x !== '') ?? '';
    return name === '' ? `\`${id}\`` : `${name} (\`${id}\`)`;
  };
}

const version = (m: PlanMeta): string => {
  const parts = [m.version === null ? '' : `v${m.version}`, m.date ?? '', m.status ?? ''];
  const line = parts.filter((x) => x !== '').join(' · ');
  return line === '' ? 'unversioned' : line;
};

function milestoneLines(d: PlanDiff, name: Namer): string[] {
  if (d.milestones.moved.length === 0) return [];
  const lines = d.milestones.moved.map((m) => {
    const parts: string[] = [];
    if (m.fromDue !== m.toDue) parts.push(`due ${m.fromDue ?? 'unset'} → ${m.toDue ?? 'unset'}`);
    if (m.fromIndex !== m.toIndex)
      parts.push(`position ${String(m.fromIndex + 1)} → ${String(m.toIndex + 1)}`);
    return `- ${name(m.id)}: ${parts.join(', ')}`;
  });
  return ['## Milestones moved', '', ...lines, ''];
}

const question = (plans: DiffPlans, id: string): Rec | undefined =>
  [plans.to, plans.from].flatMap((p) => objects(prop(p, 'questions'))).find((q) => q.id === id);

function openedLine(plans: DiffPlans, name: Namer, id: string): string {
  const x = question(plans, id);
  const decider = text(x?.decider);
  const by = text(x?.decide_by);
  const parts = [
    `- **Opened:** ${name(id)}`,
    decider === null ? '' : ` — decider \`${decider}\``,
    by === null ? '' : `, by ${by}`,
  ];
  return parts.join('');
}

function resolvedLine(plans: DiffPlans, name: Namer, id: string): string {
  const raw = text(question(plans, id)?.answer) ?? '';
  const answer = oneLine(raw.replaceAll(/\[\[([^\]\s]{1,200})\]\]/g, '`$1`'));
  const tail = answer === '' ? '' : ` — ${answer}`;
  return `- **Resolved:** ${name(id)}${tail}`;
}

function questionLines(d: PlanDiff, plans: DiffPlans, name: Namer): string[] {
  const q = d.questions;
  if (q.opened.length + q.resolved.length + q.reopened.length === 0) return [];
  return [
    '## Questions',
    '',
    ...q.opened.map((id) => openedLine(plans, name, id)),
    ...q.resolved.map((id) => resolvedLine(plans, name, id)),
    ...q.reopened.map((id) => `- **Reopened:** ${name(id)}`),
    '',
  ];
}

function workItemLines(d: PlanDiff, name: Namer): string[] {
  const w = d.workItems;
  if (w.added.length + w.removed.length + w.remilestoned.length === 0) return [];
  return [
    '## Work items',
    '',
    ...w.added.map((id) => `- **Added:** ${name(id)}`),
    ...w.removed.map((id) => `- **Removed:** ${name(id)}`),
    ...w.remilestoned.map(
      (r) => `- **Moved:** ${name(r.id)}: \`${r.from ?? 'none'}\` → \`${r.to ?? 'none'}\``,
    ),
    '',
  ];
}

const CHANGE_TAGS: Record<ChangeOps['status'], string> = {
  added: ' (new change)',
  removed: ' (change dropped)',
  changed: '',
};

function changeLines(c: ChangeOps): string[] {
  return [
    `### ${c.title} (\`${c.change}\`)${CHANGE_TAGS[c.status]}`,
    '',
    ...c.added.map((o) => `- added: ${o.summary}`),
    ...c.removed.map((o) => `- removed: ${o.summary}`),
    ...c.edited.map((o) => `- edited: ${o.summary}${fieldsNote(o.fields)}`),
    '',
  ];
}

const fieldsNote = (fields: string[]): string =>
  fields.length > 0 ? ` (${fields.join(', ')})` : '';

function entityLines(key: string, e: EntityDiff, name: Namer): string[] {
  return [
    `**${key}**`,
    '',
    ...e.added.map((id) => `- added ${name(id)}`),
    ...e.removed.map((id) => `- removed ${name(id)}`),
    ...e.changed.map((c) => `- changed ${name(c.id)}: ${c.keys.join(', ')}`),
    '',
  ];
}

/** Markdown for a weekly update: milestones, questions, work items, the change ledger, then entities. */
export function diffMarkdown(d: PlanDiff, plans: DiffPlans): string {
  const name = namer(plans);
  const head = [
    `# What changed in the plan: ${d.title}`,
    '',
    `_${version(d.from)} → ${version(d.to)}_`,
    '',
  ];
  if (d.empty) return [...head, 'No semantic changes.', ''].join('\n');
  const entities = Object.entries(d.entities).flatMap(([k, e]) => entityLines(k, e, name));
  const out = [
    ...head,
    ...milestoneLines(d, name),
    ...questionLines(d, plans, name),
    ...workItemLines(d, name),
    ...(d.ops.length > 0 ? ['## Change ledger', '', ...d.ops.flatMap(changeLines)] : []),
    ...(entities.length > 0 ? ['## Entities', '', ...entities] : []),
  ];
  return `${out
    .join('\n')
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim()}\n`;
}
