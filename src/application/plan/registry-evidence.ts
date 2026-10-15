import { prop } from '@/application/plan/ids';

/** What registryEvidence reads of a model: the as-is nodes, any node by id, and the plan's questions. */
export interface EvidenceModel {
  asIs: { byId: ReadonlyMap<string, unknown> };
  get?: (id: string) => unknown;
  plan?: { questions?: readonly { id: string; question: string; status?: string }[] | undefined };
}

export interface Operation {
  name?: string;
  plan_check?: unknown;
}

const escapeRegExp = (text: string): string =>
  text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

function nameOf(model: EvidenceModel, id: string, operation: Operation): string {
  const name = operation.name ?? prop(model.get?.(id), 'name');
  return typeof name === 'string' ? name : '';
}

/**
 * Whether an operation's recorded query-plan check supports the selected design.
 * A new or changed check is an estimate until the registry confirms it; an open
 * question about that operation's plan also prevents an evidence claim.
 */
export function registryEvidence(
  model: EvidenceModel,
  id: string,
  operation: Operation = {},
): { evidence: boolean; question: string | null } {
  const recorded = prop(model.asIs.byId.get(id), 'plan_check');
  const same =
    recorded !== undefined && JSON.stringify(recorded) === JSON.stringify(operation.plan_check);
  const name = nameOf(model, id, operation);
  const named = name === '' ? null : new RegExp(String.raw`\b${escapeRegExp(name)}\b`);
  const question = (model.plan?.questions ?? []).find(
    (q) =>
      q.status !== 'resolved' &&
      (q.question.includes(`[[${id}]]`) || (named?.test(q.question) ?? false)) &&
      /plan_check|registry|query plan/i.test(q.question),
  );
  return { evidence: same && question === undefined, question: question?.id ?? null };
}
