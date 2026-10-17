// The plans the story chapter tests draw every screen of: a draft with a low vote and one without, an approved plan
// before and after its issues are filed, one in delivery, one delivered, and the plan that changes the shop's graph.
import { shop } from '@/../test/federation-kit';
import type { IssueStatus } from '@/domain/plan/plan-status';
import type { Plan } from '@/domain/plan/plan.generated';

import {
  ORDER_NOTES_DONE,
  ORDER_NOTES_UNDER_WAY,
  orderNotes,
  orderNotesUnfiled,
} from './chapters-order-notes';
import { sameDay, sameDayConfident } from './chapters-same-day';

/** A plan for the chapter tests: its name in the test title, the plan, and the state of its issues. */
export type ChapterPlan = readonly [name: string, plan: Plan, status: IssueStatus];

export const CHAPTER_PLANS: readonly ChapterPlan[] = [
  ['a draft with a low vote', sameDay(), {}],
  ['a confident draft', sameDayConfident(), {}],
  ['an approved plan', orderNotesUnfiled(), {}],
  ['a plan in delivery', orderNotes(), ORDER_NOTES_UNDER_WAY],
  ['a delivered plan', orderNotes(), ORDER_NOTES_DONE],
  ['a plan that changes a graph', shop(), {}],
];
