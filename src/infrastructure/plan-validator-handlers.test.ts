import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';

import type { Handler, Plan } from '@/domain/plan/plan.generated';

vi.mock(import('server-only'), () => ({}));

const { checkPlanData } = await import('./plan-validator');

const prices = (): Plan =>
  parse(
    readFileSync(path.join(process.cwd(), 'test', 'fixtures', 'handlers.yaml'), 'utf8'),
  ) as Plan;

function handler(p: Plan, id: string): Handler {
  const found = p.handlers?.find((h) => h.id === id);
  if (found === undefined) throw new Error(`no ${id} in the fixture`);
  return found;
}

const lines = (list: readonly { readonly path: string; readonly message: string }[]) =>
  list.map((e) => `${e.path}: ${e.message}`);

async function findings(mutate?: (p: Plan) => void) {
  const p = prices();
  mutate?.(p);
  const r = await checkPlanData(p);
  return { errors: lines(r.errors), warnings: lines(r.warnings) };
}

describe('handler schema', () => {
  it('the fixture passes the schema and the checks', async () => {
    await expect(findings()).resolves.toEqual({ errors: [], warnings: [] });
  });

  it('a step must be one kind of step', async () => {
    const { errors } = await findings((p) => {
      handler(p, 'h:fx-get-rate').steps.push({
        call: 'api:fx-get-rate',
        publish: 'msg:x',
      });
    });
    expect(errors.some((e) => e.startsWith('handlers[1].steps[2]'))).toBe(true);
  });

  it('a read names its store', async () => {
    const { errors } = await findings((p) => {
      handler(p, 'h:fx-get-rate').steps.push({ read: 'sch:price' } as never);
    });
    expect(errors.some((e) => e.startsWith('handlers[1].steps[2]'))).toBe(true);
  });

  it('a handler id starts h: and what starts it is an endpoint, message, interaction or job', async () => {
    const { errors } = await findings((p) => {
      handler(p, 'h:fx-get-rate').id = 'fx-get-rate';
      handler(p, 'h:nightly').on = 'cron:nightly';
    });
    expect(errors.some((e) => e.startsWith('handlers[1].id'))).toBe(true);
    expect(errors.some((e) => e.startsWith('handlers[3].on'))).toBe(true);
  });

  it('a code source names its repo, path, lines and commit', async () => {
    const { errors } = await findings((p) => {
      handler(p, 'h:fx-get-rate').sources = [{ repo: 'x', path: 'y' } as never];
    });
    expect(errors.some((e) => e.startsWith('handlers[1].sources[0]'))).toBe(true);
  });
});

describe('handler checks', () => {
  it('every id a step names must exist', async () => {
    const { errors } = await findings((p) => {
      handler(p, 'h:search-reindex').steps.push({ publish: 'msg:nothing' }, { return: 'sch:gone' });
    });
    expect(errors).toEqual([
      'handlers[2].steps[1].publish: msg:nothing does not exist; fix the id, or define it (in the base arrays if it runs today, as an add op if the plan introduces it)',
      'handlers[2].steps[2].return: sch:gone does not exist; fix the id, or define it (in the base arrays if it runs today, as an add op if the plan introduces it)',
    ]);
  });

  it('finds ids deep inside forks and loops', async () => {
    const { errors } = await findings((p) => {
      const fork = handler(p, 'h:pricing-get-price').steps[1];
      if (fork !== undefined && 'else' in fork) fork.else.push({ call: 'api:missing' });
    });
    expect(errors[0]).toMatch(/^handlers\[0\]\.steps\[1\]\.else\[2\]\.call: api:missing/u);
  });

  it('what starts a handler must reach its component', async () => {
    const { errors } = await findings((p) => {
      handler(p, 'h:fx-get-rate').on = 'api:pricing-get-price';
      handler(p, 'h:search-reindex').component = 'svc:fx';
    });
    expect(errors).toContain(
      "handlers[1].on: api:pricing-get-price is served by svc:pricing, not svc:fx; move the handler to that component or point it at one of svc:fx's endpoints",
    );
    expect(errors).toContain(
      'handlers[2].on: msg:price-changed does not list svc:fx among its consumers; add it there, or point the handler at a message it consumes',
    );
  });

  it('an extracted handler or step without sources is an error; a seeded one is not', async () => {
    const { errors } = await findings((p) => {
      delete handler(p, 'h:fx-get-rate').sources;
      handler(p, 'h:pricing-get-price').steps.push({ does: 'x', origin: 'extracted' });
    });
    expect(errors).toEqual([
      'handlers[0].steps[5].origin: an extracted step must say where it was read: add sources ({repo, path, lines, commit})',
      'handlers[1].origin: h:fx-get-rate was extracted from code but has no sources; add where it was read ({repo, path, lines, commit})',
    ]);
  });

  it('warns when a flow has a component call an endpoint none of its handlers calls', async () => {
    const { warnings } = await findings((p) => {
      const fork = handler(p, 'h:pricing-get-price').steps[1];
      if (fork !== undefined && 'else' in fork) fork.else.pop();
    });
    expect(warnings).toEqual([
      "flows[0].steps[1].via: flow:price#rate has svc:pricing call api:fx-get-rate, but none of svc:pricing's handlers calls it; add the call to the handler that makes it, or fix the flow",
    ]);
  });

  it('a plan may add a handler and change one with ordinary ops', async () => {
    const { errors } = await findings((p) => {
      Object.assign(p, {
        changes: [
          {
            id: 'chg:logic',
            title: 'Cache the rate',
            ops: [
              {
                modify: 'h:fx-get-rate',
                append: { steps: [{ write: 'sch:price', to: 'st:nowhere' }] },
              },
              {
                add: 'handler',
                value: { id: 'h:shop-load', on: 'api:nothing', component: 'svc:shop', steps: [] },
              },
            ],
          },
        ],
      });
    });
    expect(errors.some((e) => e.includes('st:nowhere does not exist'))).toBe(true);
    expect(errors.some((e) => e.includes('api:nothing does not exist'))).toBe(true);
  });
});
