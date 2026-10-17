import { prop } from '@/application/plan/ids';

/** What registryEvidence reads of a model: the as-is nodes, any node by id, and the plan's questions. */
export interface EvidenceModel {
  readonly asIs: { readonly byId: ReadonlyMap<string, unknown> };
  readonly get?: (id: string) => unknown;
  readonly plan?: {
    readonly questions?:
      | readonly { readonly id: string; readonly question: string; readonly status?: string }[]
      | undefined;
  };
}

export interface Operation {
  readonly name?: string;
  readonly plan_check?: unknown;
}

const isWordChar = (c: string | undefined): boolean => c !== undefined && /^\w$/u.test(c);

/** A word boundary (as `\b`) at `i`: a word character on one side only. */
const boundary = (text: string, i: number): boolean =>
  isWordChar(text[i - 1]) !== isWordChar(text[i]);

/** Whether `word` sits in `text` between word boundaries (as `/\bword\b/`). */
function hasWord(text: string, word: string): boolean {
  for (let i = text.indexOf(word); i !== -1; i = text.indexOf(word, i + 1)) {
    if (boundary(text, i) && boundary(text, i + word.length)) return true;
  }
  return false;
}

/** Whether a question names the operation, by `[[id]]` or by its name as a word. */
const names = (question: string, id: string, name: string): boolean =>
  question.includes(`[[${id}]]`) || (name !== '' && hasWord(question, name));

/** An open question about the operation's query plan, naming it by id or by name. */
const asksAbout = (
  q: { readonly question: string; readonly status?: string },
  id: string,
  name: string,
): boolean =>
  q.status !== 'resolved' &&
  names(q.question, id, name) &&
  /plan_check|registry|query plan/iu.test(q.question);

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
): { readonly evidence: boolean; readonly question: string | null } {
  const recorded = prop(model.asIs.byId.get(id), 'plan_check');
  const same =
    recorded !== undefined && JSON.stringify(recorded) === JSON.stringify(operation.plan_check);
  const name = nameOf(model, id, operation);
  const question = (model.plan?.questions ?? []).find((q) => asksAbout(q, id, name));
  return { evidence: same && question === undefined, question: question?.id ?? null };
}
