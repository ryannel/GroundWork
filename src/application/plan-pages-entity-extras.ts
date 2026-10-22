import type { Model } from '@/application/plan/derive';
import type { FlowMode } from '@/application/plan/flow-steps';
import { issueMarkdown } from '@/application/plan/issues';
import { flowToMermaid } from '@/application/plan/mermaid';
import { issueNumber, issueUrl } from '@/application/plan-viz-work';

// What a thing shows beyond its facts: a flow drawn as a small diagram, and a work item as the GitHub issue it
// files.

export interface IssuePreview {
  readonly title: string;
  readonly repo: string | null;
  /** "#41", or '' before the issue is filed. */
  readonly number: string;
  /** From status.json; null when GitHub has not been read. */
  readonly state: 'open' | 'closed' | null;
  readonly closedOn: string | null;
  readonly url: string | null;
  /** The issue as markdown, as it is filed. */
  readonly body: string;
}

const stateOf = (state: string): 'open' | 'closed' => (state === 'closed' ? 'closed' : 'open');

export function issuePreviewOf(model: Model, id: string): IssuePreview | null {
  const w = (model.plan.work_items ?? []).find((x) => x.id === id);
  if (w === undefined) return null;
  const status = model.statusOf(id);
  return {
    title: w.title,
    repo: w.repo ?? null,
    number: issueNumber(w),
    state: status === null ? null : stateOf(status.state),
    closedOn: status?.closed_at ?? null,
    url: issueUrl(model, w),
    body: issueMarkdown(model, id),
  };
}

export interface FlowDrawing {
  readonly flowId: string;
  readonly mode: FlowMode;
  readonly mermaid: string;
}

/** A flow drawn as it runs today or with the plan; null for anything else, or a flow with no steps then. */
export function flowDrawingOf(model: Model, id: string, today: boolean): FlowDrawing | null {
  if (!id.startsWith('flow:') || id.includes('#')) return null;
  const inToBe = model.toBe.byId.has(id);
  const mode: FlowMode = today || !inToBe ? 'asIs' : 'toBe';
  const graph = mode === 'asIs' ? model.asIs : model.toBe;
  const flow = graph.flows.find((f) => f.id === id);
  if (flow === undefined || flow.steps.length === 0) return null;
  return { flowId: id, mode, mermaid: flowToMermaid(model, id, { mode }) };
}

export interface OperationDocument {
  readonly mode: 'asIs' | 'toBe';
  /** The query as written, to copy. */
  readonly text: string;
}

/** A GraphQL operation's query, from the plan when it changes it, else as it runs today. */
export function operationDocumentOf(
  model: Model,
  id: string,
  today: boolean,
): OperationDocument | null {
  if (!id.startsWith('gql:')) return null;
  const mode = today || !model.toBe.byId.has(id) ? 'asIs' : 'toBe';
  const op = (mode === 'asIs' ? model.asIs : model.toBe).byId.get(id);
  if (op?.$type !== 'operation' || op.document.trim() === '') return null;
  return { mode, text: op.document };
}
