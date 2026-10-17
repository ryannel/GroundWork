// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { shop } from '@/../test/federation-kit';
import { dispatchDate } from '@/../test/fixtures/acme/plans/work-dispatch';
import { modelOf } from '@/../test/plan-kit';
import { ladderIds } from '@/application/plan-viz-ladder-order';
import { Ladder } from '@/features/plan/viz/ladder/ladder';
import { VersionBadge } from '@/features/plan/viz/ladder/version-badge';

afterEach(cleanup);

const load = () => modelOf(dispatchDate());

describe('ladder', () => {
  it('climbs expand, migrate and remove for a versioned event', () => {
    const model = load();
    const { container } = render(<Ladder id="msg:product-changed" model={model} />);
    const rungs = [...container.querySelectorAll('li')];
    expect(rungs.map((r) => r.dataset.kind)).toEqual([
      'expand',
      'migrate',
      'migrate',
      'deprecate',
      'retire',
    ]);
    expect(container.querySelector('li button[data-inspect="svc:search-indexer"]')).not.toBeNull();
    expect(container.querySelector('li button[data-inspect="svc:order-api"]')).not.toBeNull();
    expect(container.textContent).toContain('Products API starts publishing v2 next to v1');
    expect(container.textContent).toContain('Expand · migrate · remove');
    expect(container.textContent).toContain('Remove: remove the old version once nobody reads it');
  });

  it('draws nothing for an id with no ladder', () => {
    const model = load();
    const { container } = render(<Ladder id="sch:search-doc" model={model} />);
    expect(container.textContent).toBe('');
  });

  it('draws a field that moves between subgraphs', () => {
    const model = modelOf(shop());
    const id = ladderIds(model).find((x) => x.includes('#'));
    expect(id).toBe('sch:gql-product#price');
    const { container } = render(<Ladder id={id ?? ''} model={model} />);
    expect(container.querySelectorAll('li').length).toBeGreaterThan(1);
  });

  it('badges the two ends of a pair and nothing else', () => {
    const model = load();
    const old = render(<VersionBadge id="msg:product-changed" model={model} />);
    expect(old.container.textContent).toContain('Removed v1→ v2');
    expect(old.container.querySelector('[data-side="old"]')).not.toBeNull();
    const next = render(<VersionBadge id="msg:product-changed-v2" model={model} />);
    expect(next.container.textContent).toContain('New v2replaces v1');
    const none = render(<VersionBadge id="sch:search-doc" model={model} />);
    expect(none.container.textContent).toBe('');
  });
});
