import { describe, expect, it, vi } from 'vitest';

import { derive, type Model } from '@/application/plan/derive';
import { flowSteps } from '@/application/plan/flow-steps';
import { flowToMermaid, mmText } from '@/application/plan/mermaid';

vi.mock('server-only', () => ({}));

const { readPlan, listPlans } = await import('@/infrastructure/plan-store');

const WORKSPACE = 'alder-finch';
const MODES = ['toBe', 'asIs', 'diff'] as const;
const ENTITY = /#(35|59|lt|gt);/g;

const modelOf = async (slug: string): Promise<Model> => {
  const { plan } = await readPlan(WORKSPACE, slug);
  if (plan === null) throw new Error(`no plan ${slug}`);
  return derive(plan);
};

const slugs = await listPlans(WORKSPACE);
const all = await Promise.all(slugs.map(async (slug) => ({ slug, m: await modelOf(slug) })));
const dp = await modelOf('delivery-promise');
const invoice = await modelOf('invoice-vat-number');

const word = (line: string): string => line.trim().split(' ')[0] ?? '';

/** What is wrong with the alt/rect blocks of a drawing: an else outside an alt, an end with nothing to close, a block left open. */
function blockProblems(text: string): string[] {
  const stack: string[] = [];
  const problems: string[] = [];
  for (const line of text.split('\n')) {
    const kw = word(line);
    if (kw === 'alt' || kw === 'rect') stack.push(kw);
    else if (kw === 'else' && stack.at(-1) !== 'alt') problems.push('else outside an alt');
    else if (kw === 'end' && stack.pop() === undefined) problems.push('end closes nothing');
  }
  return [...problems, ...stack.map((k) => `${k} left open`)];
}

const hasLine = (text: string, start: string): boolean =>
  text.split('\n').some((l) => l.trim().startsWith(start));

/** Every flow of every plan, drawn in every mode it exists in. */
const drawings = all.flatMap(({ slug, m }) =>
  m.toBe.flows.flatMap((f) =>
    MODES.filter((mode) => mode !== 'asIs' || m.asIs.flows.some((a) => a.id === f.id)).map(
      (mode) => ({
        where: `${slug} ${f.id} ${mode}`,
        m,
        id: f.id,
        mode,
        text: flowToMermaid(m, f.id, { mode }),
      }),
    ),
  ),
);

describe('flowToMermaid', () => {
  it('draws something for every plan', () => {
    expect(drawings.length).toBeGreaterThan(10);
  });

  it('starts as a numbered sequence diagram', () => {
    for (const d of drawings) {
      const lines = d.text.split('\n');
      expect(lines[0], d.where).toBe('sequenceDiagram');
      expect(lines[1]?.trim(), d.where).toBe('autonumber');
    }
  });

  it('gives participants short ids, with the person first in a flow someone starts', () => {
    const out = flowToMermaid(dp, 'flow:checkout');
    expect(out).toMatch(/^ {2}actor P as Shopper$/m);
    expect(out.indexOf('actor P')).toBeLessThan(out.indexOf('participant S1'));
    for (const d of drawings) {
      for (const line of d.text.split('\n')) {
        const p = /^\s*participant (\S+) as /.exec(line);
        if (p !== null) expect(p[1], `${d.where}: ${line}`).toMatch(/^[A-Z]\d*$/);
      }
    }
  });

  it('shows every step once, in order', () => {
    for (const d of drawings) {
      let from = 0;
      for (const s of flowSteps(d.m, d.id, d.mode)) {
        if (s.action === '') continue;
        const k = d.text.indexOf(mmText(s.action), from);
        expect(k, `${d.where}: "${s.action}" in order`).toBeGreaterThanOrEqual(from);
        from = k + 1;
      }
    }
  });

  it('keeps authored conditions and recovery as notes, never inferred branches', () => {
    const out = flowToMermaid(dp, 'flow:checkout', { mode: 'asIs' });
    expect(out).toMatch(/Note over S\d+,S\d+: Only when the shopper chose financing\./);
    expect(out).toMatch(/Note over S\d+: The shopper presses Checkout\./);
    expect(out).not.toMatch(/\b(?:alt|opt) Only when the shopper chose financing/);
    expect(flowToMermaid(invoice, 'flow:issue-invoice', { mode: 'asIs' })).toMatch(
      /Note over S\d+: A Billing agent runs a script/,
    );
  });

  it('groups a shared event source or a beat neutrally, never as parallel execution', () => {
    const out = flowToMermaid(dp, 'flow:create-product');
    expect(hasLine(out, 'rect rgba')).toBe(true);
    expect(out).toContain('from the same event source');
    for (const d of drawings) {
      expect(hasLine(d.text, 'par ') || hasLine(d.text, 'and '), d.where).toBe(false);
      expect(d.text, d.where).not.toContain('at the same time');
    }
  });

  it('balances alt and rect blocks, and puts every else in an alt', () => {
    for (const d of drawings) expect(blockProblems(d.text), d.where).toEqual([]);
  });

  it('carries no markup Mermaid would misread', () => {
    for (const d of drawings) {
      expect(d.text, d.where).not.toContain('<');
      expect(d.text, d.where).not.toMatch(/\*\*|`|\]\(/);
      const bare = d.text.replaceAll(ENTITY, '');
      expect(bare.includes(';') || bare.includes('#'), d.where).toBe(false);
    }
    expect(mmText('Pay **now**; see [the page](x) <b> #1')).toBe(
      'Pay now#59; see the page #lt;b#gt; #35;1',
    );
    expect(mmText('see [[svc:orders]] and [[fld:order#total]]')).toBe('see orders and total');
    expect(mmText()).toBe('');
  });

  it('draws a failure as alt … else if it fails … end, and each removed step as a removed note', () => {
    expect(hasLine(flowToMermaid(dp, 'flow:checkout'), 'else if it fails')).toBe(true);
    const removed = drawings
      .filter((d) => d.mode === 'diff')
      .map((d) => ({
        drawn: (d.text.match(/: removed · /g) ?? []).length,
        steps: flowSteps(d.m, d.id, 'diff').filter((s) => s.$removed === true).length,
      }));
    expect(removed.reduce((n, r) => n + r.drawn, 0)).toBe(removed.reduce((n, r) => n + r.steps, 0));
  });

  it('is pure: the same flow gives the same text', () => {
    expect(flowToMermaid(dp, 'flow:checkout')).toBe(flowToMermaid(dp, 'flow:checkout'));
  });
});
