import type { Level3 } from '@/domain/plan/plan.generated';

// The words a risk is read in, kept apart so the entity reader can use them without the risk view.

export const LEVEL_WORD: Readonly<Record<Level3, string>> = {
  low: 'low',
  med: 'medium',
  high: 'high',
};

/** What each handling word means, for a hover on the status. */
export const ROAM_GLOSS: Readonly<Record<string, string>> = {
  resolved: 'no longer a risk',
  owned: 'someone is on it',
  accepted: 'we live with it',
  mitigated: 'reduced, not gone',
};

export const levelWord = (level: Level3): string => LEVEL_WORD[level];
