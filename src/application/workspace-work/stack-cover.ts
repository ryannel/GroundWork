import type { BaseInfo } from '@/application/plan/plan-base';
import type { OverlapKind } from '@/application/plan/plan-stack';
import { thingHref } from '@/application/thing-paths';
import { programmeHref } from '@/application/workspace-paths';

import type { WorkCardVM } from './work-card';
import { workDone, type WorkspacePlanIndex } from './workspace-plan-index';

// What a plan's cover says about the plans around it: the plans it reads after (each as checked or changed since),
// the work they still have to deliver, the plans it overlaps, the programme it is part of, and how to check it again.

export interface ReadsAfterVM {
  readonly slug: string;
  readonly title: string;
  readonly href: string;
  /** It has changed since this plan was checked against it. */
  readonly changed: boolean;
}

export interface ChangeLinkVM {
  readonly plan: string;
  readonly planTitle: string;
  readonly change: string;
  readonly title: string;
  readonly href: string;
}

export interface OverlapVM {
  readonly target: string;
  readonly kind: OverlapKind;
  /** "Both change", "One removes what the other changes", "Both add". */
  readonly words: string;
  readonly here: ChangeLinkVM;
  readonly there: ChangeLinkVM;
}

export interface StackCoverVM {
  readonly readsAfter: readonly ReadsAfterVM[];
  readonly checkedOn: string | null;
  /** The work of the plans it reads after that is not done yet, plan by plan. */
  readonly inheritedWork: readonly {
    readonly plan: ReadsAfterVM;
    readonly items: readonly WorkCardVM[];
  }[];
  readonly overlaps: readonly OverlapVM[];
  readonly programme: { readonly id: string; readonly title: string; readonly href: string } | null;
  /** The one command that checks the plan again and writes its lock. */
  readonly recheck: string;
}

const WORDS: Readonly<Record<OverlapKind, string>> = {
  'modify-modify': 'Both change',
  'remove-change': 'One removes what the other changes',
  'add-add': 'Both add',
};

function changeLink(index: WorkspacePlanIndex, qualified: string): ChangeLinkVM {
  const [plan = '', change = ''] = qualified.split('/');
  const found = index.changes.get(qualified);
  return {
    plan,
    planTitle: index.plans.get(plan)?.title ?? plan,
    change,
    title: found?.title ?? change,
    href: found?.href ?? thingHref({ workspace: index.workspace, slug: plan }, change),
  };
}

/** What the cover says of the plans around one plan; null when it reads after none, overlaps none and joins none. */
export function stackCoverVM(
  index: WorkspacePlanIndex,
  slug: string,
  base: BaseInfo,
): StackCoverVM | null {
  const readsAfter = base.builtOn.map((each) => ({
    slug: each.slug,
    title: each.title,
    href: index.plans.get(each.slug)?.href ?? `/${index.workspace}/plans/${each.slug}/`,
    changed: each.changed,
  }));
  const overlaps = index.overlaps
    .filter((o) => o.plans.includes(slug))
    .map((o): OverlapVM => {
      const mine = o.changes.find((c) => c.startsWith(`${slug}/`)) ?? o.changes[0];
      const theirs = o.changes.find((c) => c !== mine) ?? o.changes[1];
      return {
        target: o.target,
        kind: o.kind,
        words: WORDS[o.kind],
        here: changeLink(index, mine),
        there: changeLink(index, theirs),
      };
    });
  const id = index.plans.get(slug)?.programme ?? null;
  const joined = id === null ? undefined : index.programmes.get(id);
  const programme =
    id === null
      ? null
      : { id, title: joined?.title ?? id, href: programmeHref(index.workspace, id) };
  if (readsAfter.length === 0 && overlaps.length === 0 && programme === null) return null;
  const inheritedWork = readsAfter.flatMap((plan) => {
    const keys = index.plans.get(plan.slug)?.work ?? [];
    const items = keys
      .flatMap((key) => index.work.get(key) ?? [])
      .filter((w) => !workDone(w))
      .map((w) => w.card);
    return items.length === 0 ? [] : [{ plan, items }];
  });
  return {
    readsAfter,
    checkedOn: base.checkedOn,
    inheritedWork,
    overlaps,
    programme,
    recheck: `npm run plan:base -- check ${slug} --workspace ${index.workspace}`,
  };
}
