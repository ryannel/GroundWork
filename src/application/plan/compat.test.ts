import { describe, expect, it, vi } from 'vitest';

import { shop } from '@/../test/federation-kit';
import { fieldRule, type Roles } from '@/application/plan/compat-rules';
import { derive } from '@/application/plan/derive';

vi.mock('server-only', () => ({}));

const { readPlan } = await import('@/infrastructure/plan-store');

const open = async (slug: string) => {
  const { plan } = await readPlan('alder-finch', slug);
  return derive(plan!);
};

const roles = (o: Partial<Roles>): Roles => ({
  record: false,
  request: [],
  response: [],
  payload: [],
  graph: false,
  ...o,
});
const REC = roles({ record: true });
const REQ = roles({ request: ['api:x'] });
const RES = roles({ response: ['api:x'] });
const MSG = roles({ payload: ['msg:x'] });
const GRAPH = roles({ graph: true });

type Shape = Parameters<typeof fieldRule>[1];
const f = (o: Record<string, unknown> = {}): Shape => ({
  name: 'a',
  type: 'string',
  required: false,
  ...o,
});
const verdict = (r: Roles, was: Shape, now?: Shape) => fieldRule(r, was, now).verdict;

describe('the field rule: who is broken by what', () => {
  it('a new required field breaks callers, informs readers, and needs a backfill in a store', () => {
    expect(verdict(REQ, undefined, f({ required: true }))).toBe('breaking');
    expect(verdict(RES, undefined, f({ required: true }))).toBe('safe');
    expect(verdict(MSG, undefined, f({ required: true }))).toBe('safe');
    expect(verdict(REC, undefined, f({ required: true }))).toBe('migration');
    expect(verdict(REC, undefined, f({ required: true, default: 0 }))).toBe('safe');
  });

  it('removals, type changes and narrowing break readers', () => {
    expect(verdict(RES, f())).toBe('breaking');
    expect(verdict(RES, f(), f({ type: 'int' }))).toBe('breaking');
    expect(verdict(RES, f({ required: true }), f({ required: false }))).toBe('breaking');
    expect(verdict(RES, f({ type: 'enum(a,b)' }), f({ type: 'enum(a)' }))).toBe('breaking');
  });

  it('gaining an enum value needs a migration; a note changes nobody', () => {
    expect(verdict(RES, f({ type: 'enum(a)' }), f({ type: 'enum(a,b)' }))).toBe('migration');
    expect(verdict(RES, f(), f({ note: 'just words' }))).toBe('safe');
  });

  it('a graph field changes no stored or sent shape by itself', () => {
    expect(fieldRule(GRAPH, f(), f({ note: 'words' })).rules.every((r) => r.role === 'graph')).toBe(
      true,
    );
  });
});

describe('compat on a plan', () => {
  it('breaking means a reader this plan does not move; otherwise needs migration', async () => {
    const m = await open('delivery-promise');
    const lead = m.compat('sch:product#lead_time_text')!;
    expect(lead.verdict).toBe('breaking');
    expect(lead.who.some((w) => w.movedBy === null)).toBe(true);
    const weight = m.compat('sch:product#weight_g')!;
    expect(weight.verdict).toBe('migration');
    expect(weight.who.length > 0 && weight.who.every((w) => w.movedBy !== null)).toBe(true);
    const v2 = m.compat('msg:product-published');
    expect(v2 !== null && v2.verdict !== 'safe').toBe(true);
    expect(m.compat('sch:shipment')).toBeNull();
  });

  it('netDiff compares today with the plan, not the op log', async () => {
    const m = await open('delivery-promise');
    const rows = m.netDiff('sch:product').flatMap((r) => ('field' in r ? [r] : []));
    const by = Object.fromEntries(rows.map((r) => [r.field, r]));
    expect(by.weight_g?.status).toBe('modified');
    expect(by.weight_g?.props.some((p) => p.prop === 'required')).toBe(true);
    expect(by.delivery_promise?.status).toBe('added');
    expect(['removed', 'deprecated']).toContain(by.lead_time_text?.status);
    expect(m.netDiff('sch:shipment')).toHaveLength(0);
  });
});

describe('compat across every plan', () => {
  it('judges every thing a plan touches without throwing, and only unsafe verdicts name who', async () => {
    for (const slug of [
      'delivery-promise',
      'invoice-vat-number',
      'stock-reservation',
      'storefront-graph',
    ]) {
      const m = await open(slug);
      for (const id of m.toBe.byId.keys()) {
        const c = m.compat(id);
        if (c !== null && c.verdict === 'safe') expect(c.who, `${slug} ${id}`).toEqual([]);
        m.netDiff(id);
      }
    }
  });

  it('the shop graph: a field moved between subgraphs changes no sent or stored shape', () => {
    const m = derive(shop());
    expect(m.compat('sch:gql-product#price')).toEqual({ verdict: 'safe', reasons: [], who: [] });
    expect(m.compat('sch:gql-product#leadTimeDays')).toBeNull();
  });
});
