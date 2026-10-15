import type { Check } from '@/application/plan/impact-check-types';
import { dataOf, type FieldDelta, rootFields, type Shape } from '@/application/plan/impact-fields';
import { baseId, mentions, type Planned } from '@/application/plan/impact-planned';
import type { Step, Test } from '@/domain/plan/plan.generated';

const LEVEL: Record<string, number> = { unit: 0, contract: 1, integration: 2, e2e: 3 };

interface Trace {
  holders: Set<string>;
  writers: Step[];
  readers: Step[];
  /** Where the value is born: a writer with nothing carrying it earlier in its flow (later writers pass it on). */
  sources: Step[];
}

const touches = (holders: Set<string>, s: Step, key: 'reads' | 'writes'): boolean =>
  (s[key] ?? []).some((r) => holders.has(baseId(r)));

function trace(B: Planned, shape: Shape, d: FieldDelta): Trace {
  const holders = new Set(
    [...shape.keys()].filter((id) =>
      rootFields(shape, id).some((f) => f.schema === d.schema && f.name === d.name),
    ),
  );
  holders.add(d.schema);
  const live = [...B.steps.values()].map((x) => x.step).filter((s) => !B.deprecated.has(s.id));
  const writers = live.filter((s) => touches(holders, s, 'writes'));
  const readers = live.filter(
    (s) => dataOf(B, s).some((r) => holders.has(r)) && !touches(holders, s, 'writes'),
  );
  const sources = writers.filter((s) => {
    const placed = B.steps.get(s.id);
    const before = placed === undefined ? [] : placed.flow.steps.slice(0, placed.index);
    return !before.some((x) => touches(holders, x, 'reads') || touches(holders, x, 'writes'));
  });
  return { holders, writers, readers, sources };
}

/** The nearest test: one that walks where the value is born, the smallest level first. */
function nearest(tests: Test[], sources: Step[]): string[] {
  return tests
    .filter((t) => (t.walks ?? []).some((w) => sources.some((s) => s.id === w)))
    .toSorted((a, b) => (LEVEL[a.level] ?? 9) - (LEVEL[b.level] ?? 9))
    .slice(0, 1)
    .map((t) => t.id);
}

const textOfTest = (t: Test): string =>
  [t.name, t.given, t.when, t.then].filter((x) => x !== undefined).join(' ');

/** A new field: who sets it, who uses it, what proves it. */
export function newFieldChecks(B: Planned, shape: Shape, d: FieldDelta): Check[] {
  const { holders, writers, readers, sources } = trace(B, shape, d);
  const tests = B.plan.tests ?? [];
  const said = (s: Step): boolean => mentions(s.logic, d.name) || mentions(s.action, d.name);
  const uses = [...readers.filter(said), ...writers.filter(said)];
  const shown = [...B.regions.values()].some(({ region }) => mentions(region.shows, d.name));
  const out: Check[] = [];
  if (!sources.some(said)) {
    out.push({
      kind: 'who-sets',
      level: 'warn',
      schema: d.schema,
      field: d.name,
      note: d.after?.note ?? null,
      candidates: sources.map((s) => s.id),
      writes: sources.map((s) => ({
        step: s.id,
        schema: (s.writes ?? []).map(baseId).find((h) => holders.has(h)) ?? d.schema,
      })),
    });
  }
  if (uses.length === 0 && !shown) {
    out.push({
      kind: 'who-uses',
      level: 'warn',
      schema: d.schema,
      field: d.name,
      candidates: readers.map((s) => s.id),
    });
  }
  if (!tests.some((t) => mentions(textOfTest(t), d.name))) {
    out.push({
      kind: 'untested-field',
      level: 'ask',
      schema: d.schema,
      field: d.name,
      tests: nearest(tests, sources),
    });
  }
  return out;
}
