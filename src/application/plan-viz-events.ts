import type { Model } from '@/application/plan/derive';
import type { ElementStatus } from '@/application/plan/derive-core';
import { prop, strings } from '@/application/plan/ids';
import { keyNames } from '@/application/plan-viz-field-cells';
import { ladderSummary } from '@/application/plan-viz-ladder';
import { firstSentence, plainLine } from '@/application/plan-viz-text';

// One event as a line: who sends it, which topic, who hears it, and what is worth knowing before opening it.

export type EventMode = 'asIs' | 'toBe' | 'diff';

const text = (x: unknown): string => (typeof x === 'string' ? x : '');
const graphOf = (mode: EventMode): 'asIs' | 'toBe' => (mode === 'asIs' ? 'asIs' : 'toBe');

export interface Consumers {
  readonly now: readonly string[];
  /** Services the plan moves off this event; only a diff has them. */
  readonly leaving: readonly string[];
}

function heard(model: Model, msgId: string, g: 'asIs' | 'toBe'): string[] {
  return model.consumersEffective(msgId, g).map((c) => c.svc);
}

/** Who hears it in a mode: services, and in a diff the ones the plan moves off it. */
function consumersIn(model: Model, msgId: string, mode: EventMode): Consumers {
  const existed = model.asIs.has(msgId);
  if (mode === 'asIs') return { now: existed ? heard(model, msgId, 'asIs') : [], leaving: [] };
  const now = heard(model, msgId, 'toBe');
  if (mode !== 'diff') return { now, leaving: [] };
  const was = existed ? heard(model, msgId, 'asIs') : [];
  return { now, leaving: was.filter((c) => !now.includes(c)) };
}

export interface Point {
  readonly key: string;
  readonly step: string;
  /** The service on the other side of the step. */
  readonly by: string | undefined;
}

export interface EventLines {
  readonly points: readonly Point[];
  readonly more: number;
  readonly first: string | null;
}

const SHOWN_POINTS = 3;

function pointsOf(
  list: readonly { readonly step: string; readonly from?: string; readonly to?: string }[],
  end: 'from' | 'to',
): EventLines {
  return {
    points: list
      .slice(0, SHOWN_POINTS)
      .map((p) => ({ key: `${p.step}|${p[end] ?? ''}`, step: p.step, by: p[end] })),
    more: Math.max(0, list.length - SHOWN_POINTS),
    first: list[0]?.step ?? null,
  };
}

export interface EventData {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly topic: string | null;
  readonly producer: string | null;
  readonly payload: string | null;
  readonly now: readonly string[];
  readonly leaving: readonly string[];
  readonly key: string;
  readonly delivery: string;
  readonly status: ElementStatus | null;
  readonly removed: boolean;
  readonly replacedBy: string | null;
  readonly published: EventLines;
  readonly consumed: EventLines;
  readonly migration: string | null;
  readonly search: string;
}

const orNull = (x: unknown): string | null => (typeof x === 'string' && x !== '' ? x : null);

function deliveryOf(semantics: unknown): string {
  return firstSentence(plainLine(text(semantics))).replace(/\.$/u, '');
}

function migrationOf(model: Model, id: string, mode: EventMode): string | null {
  const v = model.versions(id);
  if (mode === 'asIs' || (v.supersedes === null && v.replacedBy === null)) return null;
  return ladderSummary(model, id)?.headline ?? null;
}

function statusIn(
  model: Model,
  id: string,
  o: { readonly mode: EventMode; readonly removed: boolean },
): ElementStatus | null {
  if (o.mode !== 'diff') return null;
  return o.removed ? 'removed' : model.status(id);
}

/** What an event line shows, read in a mode; null when the plan has no such event. */
export function eventData(model: Model, msgId: string, mode: EventMode): EventData | null {
  const m =
    (mode === 'asIs' ? model.asIs.get(msgId) : undefined) ??
    model.get(msgId) ??
    model.asIs.get(msgId);
  if (m?.$type !== 'message') return null;
  const removed = mode === 'diff' && !model.toBe.has(msgId);
  const { now, leaving } = consumersIn(model, msgId, mode);
  const g = graphOf(mode);
  const key = keyNames(text(prop(m, 'key'))).join(', ');
  const topic = orNull(prop(m, 'topic'));
  const producer = orNull(prop(m, 'producer'));
  const delivery = deliveryOf(prop(m, 'semantics'));
  const name = text(prop(m, 'name')) === '' ? msgId : text(prop(m, 'name'));
  const version = text(prop(m, 'version'));
  const replacedBy = mode === 'asIs' ? null : model.versions(msgId).replacedBy;
  const labels = [topic, producer, ...now].map((x) => (x === null ? '' : model.label(x)));
  const status = statusIn(model, msgId, { mode, removed });
  return {
    id: msgId,
    name,
    version,
    topic,
    producer,
    payload: orNull(prop(m, 'payload')),
    now,
    leaving,
    key,
    delivery,
    status,
    removed,
    replacedBy,
    published: pointsOf(model.publishPoints(msgId, g), 'from'),
    consumed: pointsOf(model.consumePoints(msgId, g), 'to'),
    migration: migrationOf(model, msgId, mode),
    search: [
      name,
      msgId,
      version,
      ...labels,
      text(prop(m, 'semantics')),
      key,
      ...strings(prop(m, 'consumers')),
    ]
      .filter((x) => x !== '')
      .join(' ')
      .toLowerCase(),
  };
}

/** Events in catalogue order: by topic, then name, then version, so v1 and v2 of one event sit together. */
export function sortEvents(model: Model, ids: readonly string[]): string[] {
  const key = (id: string): string[] => {
    const topic = text(prop(model.get(id), 'topic'));
    const m = model.get(id);
    const name = text(prop(m, 'name'));
    return [
      topic === '' ? '\uFFFF' : model.label(topic),
      name === '' ? id : name,
      text(prop(m, 'version')),
    ];
  };
  return ids.toSorted((a, b) => {
    const [ka, kb] = [key(a), key(b)];
    for (const [i, x] of ka.entries()) {
      const c = x.localeCompare(kb[i] ?? '', undefined, { numeric: true });
      if (c !== 0) return c;
    }
    return 0;
  });
}
