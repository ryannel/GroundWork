// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';

import { ModelInline, ModelText } from './model-text';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const model = derive(await loadFixture('mini.yaml'));

afterEach(cleanup);

describe('ModelText', () => {
  it('draws citations as chips', () => {
    render(<ModelText model={model} text={'Moves [[svc:subs]].\n\n- and [[svc:web]]'} />);
    expect(screen.getAllByRole('button').map((b) => b.dataset.inspect)).toEqual([
      'svc:subs',
      'svc:web',
    ]);
    cleanup();
    render(<ModelInline model={model} text="Only [[svc:web]]" />);
    expect(screen.getByRole('button').dataset.inspect).toBe('svc:web');
  });
});
