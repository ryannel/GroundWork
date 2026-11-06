import type { Provenance } from '@/application/plan/stack-base';
import { rootId } from '@/domain/ids';

// What a stacked plan reads that the plans below it added or changed and that is not live yet, labelled once per group:
// "Added by Sales tool · not live yet". A landed plan is part of today, so what it did carries no label.

export interface InheritedGroup {
  readonly plan: string;
  readonly title: string;
  readonly kind: Provenance['kind'];
  /** "Added by Sales tool · not live yet". */
  readonly text: string;
  readonly ids: readonly string[];
}

/** The label for what one plan below added or changed. */
export const inheritedText = (provenance: Provenance): string =>
  `${provenance.kind === 'added' ? 'Added' : 'Changed'} by ${provenance.title} · not live yet`;

/** The inherited ids among these, grouped by the plan that did it and what it did, in the order first met. */
export function inheritedGroups(
  inheritedFrom: (id: string) => Provenance | null,
  ids: readonly string[],
): InheritedGroup[] {
  const groups = new Map<string, InheritedGroup>();
  for (const id of new Set(ids)) {
    const provenance = inheritedFrom(id);
    if (provenance === null) continue;
    const key = `${provenance.plan}\n${provenance.kind}`;
    const known = groups.get(key);
    groups.set(key, {
      plan: provenance.plan,
      title: provenance.title,
      kind: provenance.kind,
      text: inheritedText(provenance),
      ids: [...(known?.ids ?? []), id],
    });
  }
  return [...groups.values()];
}

/** What reads a model's inherited things: who did each, and every id it draws. */
export interface InheritedReader {
  readonly inheritedFrom: (id: string) => Provenance | null;
  readonly asIs: { readonly byId: ReadonlyMap<string, unknown> };
  readonly toBe: { readonly byId: ReadonlyMap<string, unknown> };
}

/** The inherited groups among some things and their parts (`<id>#…`): what a screen or page about them shows. */
export function inheritedNotesOf(model: InheritedReader, ids: readonly string[]): InheritedGroup[] {
  const wanted = new Set(ids);
  const parts = [...model.asIs.byId.keys(), ...model.toBe.byId.keys()].filter((key) =>
    wanted.has(rootId(key)),
  );
  return inheritedGroups(model.inheritedFrom, [...ids, ...parts]);
}
