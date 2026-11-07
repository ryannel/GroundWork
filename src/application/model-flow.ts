import { entryFlowHref } from '@/application/entry-flow-paths';
import { modelChipOf, type ModelChip } from '@/application/model-chip';
import type { ModelIndex } from '@/application/model-index';
import { mmText } from '@/application/plan/mermaid-text';
import { permalinkOf } from '@/domain/code-links';
import { appendChild } from '@/domain/ids';
import { codeCitationResolver } from '@/domain/model-cite-resolution';
import type { ModelCite, ModelData, ModelGap } from '@/domain/workspace-model';

export interface ModelFlowSources {
  readonly cites: readonly ModelCite[];
  readonly code: readonly { readonly label: string; readonly href: string }[];
  readonly evidence: readonly ModelChip[];
}
export interface ModelFlowStep {
  readonly id: string;
  readonly number: number;
  readonly source: ModelData<'FlowStep'>;
  readonly from: ModelChip;
  readonly to: ModelChip;
  readonly via: ModelChip | null;
  readonly reads: readonly ModelChip[];
  readonly writes: readonly ModelChip[];
  readonly purges: readonly ModelChip[];
  readonly screen: ModelChip | null;
  readonly backing: ModelChip | null;
  readonly entryHref: string | null;
  readonly sources: ModelFlowSources;
}
export interface ModelFlowView {
  readonly id: string;
  readonly name: string;
  readonly source: ModelData<'FlowFile'>;
  readonly actor: string;
  readonly steps: readonly ModelFlowStep[];
  readonly gaps: readonly ModelGap[];
  readonly sources: ModelFlowSources;
}
function codeLabel(cite: Extract<ModelCite, { readonly kind: 'code' }>): string {
  const span = cite.lines === undefined ? '' : `:${cite.lines.join('–')}`;
  return `${cite.repo}/${cite.path} @ ${cite.commit}${span}`;
}
const sourceResolvers = new WeakMap<ModelIndex, ReturnType<typeof codeCitationResolver>>();
/** Retain original citation identities as well as any code pins the canonical resolver can prove. */
function modelFlowSources(index: ModelIndex, cites: readonly ModelCite[]): ModelFlowSources {
  let resolver = sourceResolvers.get(index);
  if (resolver === undefined) {
    resolver = codeCitationResolver(index.model.evidence);
    sourceResolvers.set(index, resolver);
  }
  return {
    cites,
    code: resolver(cites).map((cite) => ({
      label: codeLabel(cite),
      href: permalinkOf(cite),
    })),
    evidence: cites.flatMap((cite) =>
      cite.kind === 'evidence' ? [{ ...modelChipOf(index, cite.id), label: cite.id }] : [],
    ),
  };
}
function stepOf(
  index: ModelIndex,
  flow: ModelData<'FlowFile'>,
  step: ModelData<'FlowStep'>,
  at: number,
): ModelFlowStep {
  const id = appendChild(flow.id, step.id);
  const via = step.via === undefined ? null : index.get(step.via);
  const inspect = (target: string | undefined): ModelChip | null =>
    target === undefined ? null : modelChipOf(index, target);
  return {
    id,
    number: at + 1,
    source: step,
    from: modelChipOf(index, step.from),
    to: modelChipOf(index, step.to),
    via: inspect(step.via),
    reads: (step.reads ?? []).map((target) => modelChipOf(index, target)),
    writes: (step.writes ?? []).map((target) => modelChipOf(index, target)),
    purges: (step.purges ?? []).map((target) => modelChipOf(index, target)),
    screen: inspect(step.screen),
    backing: inspect(step.handler_step),
    entryHref:
      via === null || !['endpoint', 'subscription', 'job', 'interaction'].includes(via.kind)
        ? null
        : entryFlowHref(index.model.id, { entry: via.id }),
    sources: modelFlowSources(index, index.cites(id)),
  };
}
/** An authored narrative keeps its declared order; it does not establish a runtime execution graph. */
export function modelFlowOf(index: ModelIndex, id: string): ModelFlowView | null {
  const flow = index.model.flows.find((candidate) => candidate.id === index.get(id)?.id);
  if (flow === undefined) return null;
  return {
    id: flow.id,
    name: flow.name,
    source: flow,
    actor: flow.actor === undefined ? '' : index.label(flow.actor),
    steps: flow.steps.map((step, at) => stepOf(index, flow, step, at)),
    gaps: index.gaps(flow.id),
    sources: modelFlowSources(index, index.cites(flow.id)),
  };
}

/** Export only the authored order and participants. This does not assert a runtime trace. */
export function modelFlowMermaidOf(flow: ModelFlowView): string {
  const participants = new Map(
    flow.steps.flatMap((step) => [step.from, step.to]).map((chip) => [chip.id, chip.label]),
  );
  const keys = new Map([...participants].map(([id], position) => [id, `P${String(position + 1)}`]));
  const lines = [...participants].map(
    ([id, label]) => `  participant ${keys.get(id) ?? id} as ${mmText(label)}`,
  );
  const steps = flow.steps.map(
    ({ from, to, source }) =>
      `  ${keys.get(from.id) ?? from.id}->>${keys.get(to.id) ?? to.id}: ${mmText(source.action)}`,
  );
  return [
    'sequenceDiagram',
    '  %% Authored narrative; not a runtime trace',
    '  autonumber',
    ...lines,
    ...steps,
  ].join('\n');
}
