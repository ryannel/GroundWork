import { tie } from '@/application/plan/derive-values';
import type { Check } from '@/application/plan/impact-check-types';
import type { Edge } from '@/application/plan/impact-edges';
import { type FieldDelta, rootFields, type Sides } from '@/application/plan/impact-fields';
import type { Journey } from '@/application/plan/impact-journeys';
import { newFieldChecks } from '@/application/plan/impact-new-field';
import { baseId } from '@/application/plan/impact-planned';
import type { ScreenChange } from '@/application/plan/impact-screens';
import type { WorkImpact } from '@/application/plan/impact-work';
import type { PlanDiff } from '@/application/plan/plan-diff-core';
import type { RevisionEntry } from '@/application/plan/revision-ledger';

export interface CheckInput {
  sides: Sides;
  deltas: FieldDelta[];
  flows: Journey[];
  screens: ScreenChange[];
  edges: Edge[];
  work: WorkImpact[];
  diff: PlanDiff | null;
  entry: RevisionEntry | null;
}

/** A contract other services read changes shape. */
function contractChecks({ sides: { B, shape } }: CheckInput): Check[] {
  return [...B.messages.values()].flatMap((m): Check[] => {
    const p = baseId(m.payload);
    if (!shape.has(p)) return [];
    const fields = rootFields(shape, p);
    const breaking = fields.some((f) => f.verdict !== 'safe');
    return [
      {
        kind: 'contract',
        level: breaking ? 'warn' : 'note',
        message: m.id,
        consumers: m.consumers ?? [],
        fields,
        breaking,
      },
    ];
  });
}

function stepChecks({ flows, sides: { B } }: CheckInput): Check[] {
  const walked = new Set((B.plan.tests ?? []).flatMap((t) => t.walks ?? []));
  return flows
    .flatMap((f) => f.steps)
    .filter((s) => (s.mark === 'behaviour' || s.mark === 'added') && !walked.has(s.id))
    .map((s): Check => ({ kind: 'untested-step', level: 'ask', step: s.id }));
}

/** Teams that committed before the change and whose work now moves (the proposer's own vote is not stale). */
function voteChecks({ work, entry, sides: { B } }: CheckInput): Check[] {
  const by = new Set(entry?.by);
  const moving = new Set(['rework', 'changes', 'drop', 'new']);
  const moved = new Set(
    work.filter((x) => moving.has(x.effect) && !by.has(x.team)).map((x) => x.team),
  );
  return (B.plan.commitment ?? [])
    .filter((c) => moved.has(c.team))
    .map((c): Check => ({
      kind: 'stale-vote',
      level: 'note',
      team: c.team,
      confidence: c.confidence ?? null,
      said: c.note ?? '',
    }));
}

function planChecks({ diff }: CheckInput): Check[] {
  if (diff === null) return [];
  return [
    ...diff.questions.opened.map((question): Check => ({
      kind: 'question',
      level: 'note',
      question,
    })),
    ...diff.milestones.moved.map((m): Check => ({
      kind: 'milestone',
      level: 'warn',
      milestone: m.id,
      fromDue: m.fromDue,
      toDue: m.toDue,
    })),
    ...(diff.entities.decisions?.changed ?? []).map((c): Check => ({
      kind: 'decision',
      level: 'note',
      decision: c.id,
    })),
  ];
}

function deltaChecks({ deltas, sides: { B, shape } }: CheckInput): Check[] {
  return [
    ...deltas
      .filter((d) => d.verdict !== 'safe')
      .map((d): Check => ({
        kind: 'breaking',
        level: 'warn',
        schema: d.schema,
        field: d.name,
        change: d.kind,
        verdict: d.verdict,
        stored: B.schemas.get(d.schema)?.store !== undefined,
      })),
    ...deltas.filter((d) => d.kind === 'added').flatMap((d) => newFieldChecks(B, shape, d)),
  ];
}

function edgeChecks({ edges }: CheckInput): Check[] {
  return edges
    .filter((e) => e.crossTeam)
    .map((e): Check => ({
      kind: 'new-edge',
      level: 'warn',
      from: e.from,
      to: e.to,
      call: e.kind,
      before: e.before,
      steps: e.steps,
      message: e.message,
    }));
}

const RANK = { warn: 0, ask: 1, note: 2 };
const KIND = ['new-edge', 'breaking', 'who-sets', 'who-uses', 'rework', 'milestone'];
const kindRank = (c: Check): number => (KIND.includes(c.kind) ? KIND.indexOf(c.kind) : KIND.length);

/** The questions a reviewer should ask, each with its evidence: worst first. */
export function checksOf(input: CheckInput): Check[] {
  const reopened = input.work.filter((x) => x.effect === 'rework');
  return [
    ...edgeChecks(input),
    ...deltaChecks(input),
    ...stepChecks(input),
    ...input.screens
      .filter((sc) => sc.mark === 'behaviour' && !sc.picture && sc.after !== null)
      .map((sc): Check => ({ kind: 'stale-picture', level: 'ask', screen: sc.id })),
    ...contractChecks(input),
    ...(reopened.length > 0
      ? [{ kind: 'rework', level: 'warn', items: reopened.map((x) => x.id) } as const]
      : []),
    ...voteChecks(input),
    ...planChecks(input),
  ].toSorted((a, b) => tie(RANK[a.level] - RANK[b.level], kindRank(a) - kindRank(b)));
}
