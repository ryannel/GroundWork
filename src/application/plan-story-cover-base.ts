import type { BaseInfo } from '@/application/plan/plan-base';
import type { AskLine, AskLink } from '@/application/plan-story-cover-standing';
import { shortDate } from '@/application/plan-viz-state';

const TODAY: AskLink = { chapter: 'today', screen: 'system', label: 'The system today →' };

function names(ids: readonly string[], label: (id: string) => string): string {
  const all = ids.map((id) => label(id));
  return all.length < 2 ? all.join('') : `${all.slice(0, -1).join(', ')} and ${all.at(-1) ?? ''}`;
}

/**
 * Where the plan's today comes from. An open plan reads the workspace's today as it is now, so a change there reaches
 * it; when today has moved something the plan changes since it was last checked, that is said loudly.
 */
export function baseLine(base: BaseInfo, label: (id: string) => string): AskLine | null {
  if (base.mode === 'none') return null;
  if (base.mode === 'landed') {
    const text =
      base.landedOn === null
        ? 'Reads today as it stood when it was kept with the plan.'
        : `Reads today as it stood on ${shortDate(base.landedOn)}, kept with the plan.`;
    return { tone: 'note', text, link: null };
  }
  if (base.checkedOn === null) {
    const text = 'Reads today live, but has never been checked against it.';
    return { tone: 'warn', text, link: TODAY };
  }
  const checked = shortDate(base.checkedOn);
  if (base.drift.length === 0) {
    return { tone: 'note', text: `Reads today live; it last fitted on ${checked}.`, link: TODAY };
  }
  const count = base.drift.length === 1 ? 'one thing' : `${String(base.drift.length)} things`;
  const text = `Today has changed ${count} this plan changes since ${checked}: ${names(base.drift, label)}. Check the plan still holds.`;
  return { tone: 'warn', text, link: TODAY };
}
