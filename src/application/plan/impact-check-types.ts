import type { Verdict } from '@/application/plan/compat-rules';
import type { FieldDelta } from '@/application/plan/impact-fields';

/** A question a reviewer should ask of a revision, with its evidence. */
export type Check =
  | {
      kind: 'new-edge';
      level: 'warn';
      from: string;
      to: string;
      call: 'call' | 'event';
      before: 'event' | null;
      steps: string[];
      message: string | null;
    }
  | {
      kind: 'breaking';
      level: 'warn';
      schema: string;
      field: string;
      change: FieldDelta['kind'];
      verdict: Verdict;
      stored: boolean;
    }
  | {
      kind: 'who-sets';
      level: 'warn';
      schema: string;
      field: string;
      note: string | null;
      candidates: string[];
      writes: { step: string; schema: string }[];
    }
  | { kind: 'who-uses'; level: 'warn'; schema: string; field: string; candidates: string[] }
  | { kind: 'untested-field'; level: 'ask'; schema: string; field: string; tests: string[] }
  | { kind: 'untested-step'; level: 'ask'; step: string }
  | { kind: 'stale-picture'; level: 'ask'; screen: string }
  | {
      kind: 'contract';
      level: 'warn' | 'note';
      message: string;
      consumers: string[];
      fields: FieldDelta[];
      breaking: boolean;
    }
  | { kind: 'rework'; level: 'warn'; items: string[] }
  | { kind: 'stale-vote'; level: 'note'; team: string; confidence: number | null; said: string }
  | { kind: 'question'; level: 'note'; question: string }
  | {
      kind: 'milestone';
      level: 'warn';
      milestone: string;
      fromDue: string | null;
      toDue: string | null;
    }
  | { kind: 'decision'; level: 'note'; decision: string };
