// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { flowFixture } from '@/../test/fixtures/model-current-flow';
import { modelFlowOf } from '@/application/model-flow';
import { indexOf } from '@/application/model-index';

import { ModelTodayFlow } from './model-today-flow';

afterEach(cleanup);

describe('native narrative walker', () => {
  it('walks the exact authored steps and retains failure, source and implementation distinctions', () => {
    const flow = modelFlowOf(indexOf(flowFixture()), 'flow:story');
    if (flow === null) throw new Error('Missing flow');
    render(<ModelTodayFlow flow={flow} />);
    expect(screen.getByText('A precise trigger')).toBeTruthy();
    expect(screen.getByText('A precise outcome')).toBeTruthy();
    expect(
      screen.getByText('Authored narrative. Entry flows show recorded implementation detail.'),
    ).toBeTruthy();
    expect(screen.getByText('Only when a value is present')).toBeTruthy();
    expect(screen.getByText('Never reports success after failure')).toBeTruthy();
    expect(screen.getByText('Beat: Authored beat')).toBeTruthy();
    expect(screen.getByText('Cache case: miss')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Open the entry flow →' }).getAttribute('href'),
    ).toMatch(/^\/queries\/entries\/?\?id=api-a$/u);
    expect(
      screen.getAllByRole('link', { name: /fixture\/a\/flow.ts @ aaaa/u }).length,
    ).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Read step 2: Second action' }));
    expect(screen.getByText('Transport: Unspecified transport')).toBeTruthy();
    expect(screen.getByText('No handler backing is named on this narrated step.')).toBeTruthy();
    expect(screen.queryByText('Only when a value is present')).toBeNull();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Read step 1: First action' }), {
      key: 'ArrowLeft',
    });
    expect(screen.getByText('Only when a value is present')).toBeTruthy();
  });
});
