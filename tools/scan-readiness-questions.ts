import type {
  RepositoryReadiness,
  RepositoryReadinessInput,
} from '@/domain/scan/repository-readiness-types';
import { repositoryPassJson } from '@/infrastructure/scan/repository-pass-files';

import {
  readinessArray,
  readinessNumber,
  readinessObject,
  readinessString,
} from './scan-readiness-value';

type QuestionStatus = 'supported' | 'partial' | 'unsupported';
interface QuestionRow {
  readonly id: string;
  readonly question: string;
  readonly requiredEvidence: string;
  readonly status: QuestionStatus;
}
interface QuestionReview {
  readonly repo: string;
  readonly commit: string;
  readonly supported: number;
  readonly partial: number;
  readonly unsupported: number;
  readonly questions: readonly QuestionRow[];
}
const SUPPORTED_QUESTIONS = new Set([
  'Q01',
  'Q05',
  'Q07',
  'Q08',
  'Q12',
  'Q13',
  'Q14',
  'Q15',
  'Q16',
  'Q17',
  'Q18',
  'Q19',
  'Q20',
]);
function acceptedQuestionStatus(id: string): QuestionStatus {
  if (id === 'Q21') return 'unsupported';
  return SUPPORTED_QUESTIONS.has(id) ? 'supported' : 'partial';
}
interface ReadinessQuestions {
  readonly repo: string;
  readonly commit: string;
  readonly questionIds: readonly string[];
  readonly questions: RepositoryReadinessInput['questions'];
  readonly counts: RepositoryReadiness['counts'];
}
function text(value: unknown): string {
  const parsed = readinessString(value);
  if (parsed.trim().length === 0) throw new Error('Question review needs nonempty text.');
  return parsed;
}
function status(value: unknown): QuestionStatus {
  if (value !== 'supported' && value !== 'partial' && value !== 'unsupported') {
    throw new Error('Question status must be supported, partial or unsupported.');
  }
  return value;
}
function question(value: unknown): QuestionRow {
  const row = readinessObject(value);
  return {
    id: text(row.id),
    question: text(row.question),
    requiredEvidence: text(row.requiredEvidence),
    status: status(row.status),
  };
}
function verifiedReview(input: unknown): QuestionReview {
  const row = readinessObject(input);
  if (row.format !== 'answerability-review/v1' || row.questionCount !== 22) {
    throw new Error('Expected the frozen 22-question review format.');
  }
  const parsed = {
    repo: text(row.repo),
    commit: text(row.commit),
    supported: readinessNumber(row.supported),
    partial: readinessNumber(row.partial),
    unsupported: readinessNumber(row.unsupported),
    questions: readinessArray(row.questions).map(question),
  };
  if (!/^[a-f\d]{40}(?:[a-f\d]{24})?$/u.test(parsed.commit)) {
    throw new Error('Question review needs a full source pin.');
  }
  if (parsed.questions.length !== 22) throw new Error('Expected exactly 22 frozen questions.');
  if (new Set(parsed.questions.map((entry) => entry.id)).size !== 22) {
    throw new Error('Question review has duplicate frozen identities.');
  }
  for (const state of ['supported', 'partial', 'unsupported'] as const) {
    if (parsed.questions.filter((entry) => entry.status === state).length !== parsed[state]) {
      throw new Error('Question review counts disagree with its actual statuses.');
    }
  }
  return parsed;
}

/** Read actual statuses only; entry discovery or narrower probes cannot promote a partial source answer. */
export async function readReadinessQuestions(input: {
  readonly review: string;
  readonly frozen: string;
}): Promise<ReadinessQuestions> {
  const [actual, frozen] = await Promise.all([
    repositoryPassJson(input.review),
    repositoryPassJson(input.frozen),
  ]);
  const current = verifiedReview(actual);
  const reference = verifiedReview(frozen);
  if (current.repo !== reference.repo || current.commit !== reference.commit) {
    throw new Error('Question review repository or source pin changed.');
  }
  for (const entry of current.questions) {
    const accepted = acceptedQuestionStatus(entry.id);
    if (entry.status !== accepted) {
      throw new Error(
        `${entry.id}: source status is not backed by the current accepted proof roster.`,
      );
    }
  }
  const byId = new Map(current.questions.map((entry) => [entry.id, entry]));
  const questions = reference.questions.map((expected) => {
    const observed = byId.get(expected.id);
    if (
      observed?.question !== expected.question ||
      observed.requiredEvidence !== expected.requiredEvidence
    ) {
      throw new Error(`${expected.id}: frozen question text or required evidence changed.`);
    }
    return {
      id: observed.id,
      status: observed.status === 'supported' ? ('source-supported' as const) : observed.status,
    };
  });
  return {
    repo: current.repo,
    commit: current.commit,
    questionIds: reference.questions.map((entry) => entry.id),
    questions,
    counts: {
      supported: current.supported,
      partial: current.partial,
      unsupported: current.unsupported,
    },
  };
}
