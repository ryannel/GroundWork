import type { Verdict } from '@/application/plan/compat-rules';
import type { FieldDelta } from '@/application/plan/impact-fields';

/** A question a reviewer should ask of a revision, with its evidence. */
export type Check =
  | {
      readonly kind: 'new-edge';
      readonly level: 'warn';
      readonly from: string;
      readonly to: string;
      readonly call: 'call' | 'event';
      readonly before: 'event' | null;
      readonly steps: readonly string[];
      readonly message: string | null;
    }
  | {
      readonly kind: 'breaking';
      readonly level: 'warn';
      readonly schema: string;
      readonly field: string;
      readonly change: FieldDelta['kind'];
      readonly verdict: Verdict;
      readonly stored: boolean;
    }
  | {
      readonly kind: 'who-sets';
      readonly level: 'warn';
      readonly schema: string;
      readonly field: string;
      readonly note: string | null;
      readonly candidates: readonly string[];
      readonly writes: readonly { readonly step: string; readonly schema: string }[];
    }
  | {
      readonly kind: 'who-uses';
      readonly level: 'warn';
      readonly schema: string;
      readonly field: string;
      readonly candidates: readonly string[];
    }
  | {
      readonly kind: 'untested-field';
      readonly level: 'ask';
      readonly schema: string;
      readonly field: string;
      readonly tests: readonly string[];
    }
  | { readonly kind: 'untested-step'; readonly level: 'ask'; readonly step: string }
  | { readonly kind: 'stale-picture'; readonly level: 'ask'; readonly screen: string }
  | {
      readonly kind: 'contract';
      readonly level: 'warn' | 'note';
      readonly message: string;
      readonly consumers: readonly string[];
      readonly fields: readonly FieldDelta[];
      readonly breaking: boolean;
    }
  | { readonly kind: 'rework'; readonly level: 'warn'; readonly items: readonly string[] }
  | {
      readonly kind: 'stale-vote';
      readonly level: 'note';
      readonly team: string;
      readonly confidence: number | null;
      readonly said: string;
    }
  | { readonly kind: 'question'; readonly level: 'note'; readonly question: string }
  | {
      readonly kind: 'milestone';
      readonly level: 'warn';
      readonly milestone: string;
      readonly fromDue: string | null;
      readonly toDue: string | null;
    }
  | { readonly kind: 'decision'; readonly level: 'note'; readonly decision: string };
