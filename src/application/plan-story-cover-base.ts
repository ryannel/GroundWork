import type { BaseInfo } from '@/application/plan/plan-base';
import type { AskLine, AskLink } from '@/application/plan-story-cover-standing';
import { shortDate } from '@/application/plan-viz-state';

const TODAY: AskLink = { chapter: 'today', screen: 'system', label: 'The system today →' };

function names(ids: readonly string[], label: (id: string) => string): string {
  const all = ids.map((id) => label(id));
  return all.length < 2 ? all.join('') : `${all.slice(0, -1).join(', ')} and ${all.at(-1) ?? ''}`;
}

/** What has changed under a stacked plan since it was checked: the plans it builds on, and its programme. */
function staleText(base: BaseInfo, checked: string): string | null {
  if (!base.stale) return null;
  const moved = [
    ...base.builtOn.filter((each) => each.changed).map((each) => each.title),
    ...(base.programme?.changed === true ? [`the programme ${base.programme.id}`] : []),
  ];
  const verb = moved.length === 1 ? 'has' : 'have';
  return `${names(moved, (title) => title)} ${verb} changed since this plan was checked on ${checked}; it reads them as they are now. Check the plan again.`;
}

/** The plan file has been written again since its check, so the check no longer speaks for it. */
function editedText(base: BaseInfo, checked: string): string | null {
  if (!base.edited) return null;
  return `The plan has been edited since it was checked on ${checked}, so what it says now has not been checked. Run the check again.`;
}

function driftText(base: BaseInfo, checked: string, label: (id: string) => string): string | null {
  if (base.drift.length === 0) return null;
  const count = base.drift.length === 1 ? 'one thing' : `${String(base.drift.length)} things`;
  return `Today has changed ${count} this plan changes since ${checked}: ${names(base.drift, label)}. Check the plan still holds.`;
}

/**
 * Where the plan's today comes from. An open plan reads the workspace's today as it is now, with the plans it builds
 * on applied, so a change there reaches it; when today, a plan below it or its programme has moved since it was
 * last checked, that is said loudly.
 */
export function baseLine(
  base: BaseInfo,
  label: (id: string) => string,
  today: Date | undefined,
): AskLine | null {
  if (base.mode === 'none') return null;
  if (base.mode === 'landed') {
    const text =
      base.landedOn === null
        ? 'Reads today as it stood when it was kept with the plan.'
        : `Reads today as it stood on ${shortDate(base.landedOn, today)}, kept with the plan.`;
    return { tone: 'note', text, link: null };
  }
  const stacked = base.builtOn.length > 0;
  const reads = stacked
    ? `Reads today live after ${names(
        base.builtOn.map((each) => each.title),
        (title) => title,
      )}`
    : 'Reads today live';
  if (base.checkedOn === null) {
    const text = `${reads}, but has never been checked against ${stacked ? 'them' : 'it'}.`;
    return { tone: 'warn', text, link: TODAY };
  }
  const checked = shortDate(base.checkedOn, today);
  const moved = [
    editedText(base, checked),
    staleText(base, checked),
    driftText(base, checked, label),
  ].filter((text) => text !== null);
  if (moved.length === 0) {
    return { tone: 'note', text: `${reads}; it last fitted on ${checked}.`, link: TODAY };
  }
  return { tone: 'warn', text: moved.join(' '), link: TODAY };
}
