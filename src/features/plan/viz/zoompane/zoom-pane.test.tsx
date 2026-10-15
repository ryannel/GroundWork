// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ScrollCue } from './scroll-cue.client';
import { ZoomPane } from './zoom-pane.client';

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 800 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 500 });
});

afterEach(cleanup);

const drawing = <svg data-testid="drawing" />;

describe('ZoomPane', () => {
  it('draws the diagram inline with only an Expand button', () => {
    render(
      <ZoomPane more="7 stages" w={1600} h={400}>
        {drawing}
      </ZoomPane>,
    );
    expect(screen.getByTestId('drawing')).toBeTruthy();
    expect(screen.getByRole('button', { name: /expand the diagram/i }).textContent).toContain(
      '7 stages',
    );
    expect(screen.queryByRole('group', { name: 'Zoom' })).toBeNull();
  });

  it('keeps a wide drawing at its own size in a box that scrolls, with its inline strip', () => {
    render(
      <ZoomPane inline={<p>Stages</p>} w={1600} h={400} wide>
        {drawing}
      </ZoomPane>,
    );
    expect(screen.getByTestId('drawing').closest('[data-scrolls]')).not.toBeNull();
    expect(screen.getByText('Stages')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /expand/i }));
    expect(screen.getByTestId('drawing').closest('[data-scrolls]')).toBeNull();
    expect(screen.queryByText('Stages')).toBeNull();
  });

  it('expands to zoom controls and closes on Esc', () => {
    render(
      <ZoomPane w={1600} h={400}>
        {drawing}
      </ZoomPane>,
    );
    fireEvent.click(screen.getByRole('button', { name: /expand/i }));
    expect(screen.getByRole('region', { name: 'Diagram, full screen' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Zoom' })).toBeTruthy();
    fireEvent.keyDown(globalThis as unknown as Window, { key: 'Escape' });
    expect(screen.queryByRole('group', { name: 'Zoom' })).toBeNull();
  });

  it('zooms with the buttons and keys, and offers Focus only with a selection', () => {
    const { rerender } = render(
      <ZoomPane w={600} h={300}>
        {drawing}
      </ZoomPane>,
    );
    fireEvent.click(screen.getByRole('button', { name: /expand/i }));
    const percent = (): string => screen.getByRole('button', { name: 'Actual size' }).textContent;
    const before = percent();
    fireEvent.click(screen.getByTitle('Zoom in (+)'));
    expect(percent()).not.toBe(before);
    fireEvent.click(screen.getByTitle('Actual size (1)'));
    expect(percent()).toBe('100%');
    act(() => {
      globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: '-', bubbles: true }));
    });
    expect(percent()).toBe('80%');
    expect(screen.queryByText('Focus selected step')).toBeNull();
    rerender(
      <ZoomPane focus={{ x: 10, y: 10, w: 100, h: 50 }} w={600} h={300}>
        {drawing}
      </ZoomPane>,
    );
    expect(screen.getByText('Focus selected step')).toBeTruthy();
  });

  it('shows a legend and, for a scrolled drawing, no zoom controls', () => {
    render(
      <ZoomPane legend={<span>Lines</span>} scroll w={600} h={300}>
        {drawing}
      </ZoomPane>,
    );
    fireEvent.click(screen.getByRole('button', { name: /expand/i }));
    expect(screen.getByText('Lines')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Zoom' })).toBeNull();
  });
});

describe('ScrollCue', () => {
  it('wraps its children', () => {
    render(
      <ScrollCue note>
        <p>wide</p>
      </ScrollCue>,
    );
    expect(screen.getByText('wide')).toBeTruthy();
  });
});
