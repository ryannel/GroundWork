// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useCanvasFullscreen } from './use-canvas-fullscreen';

describe('canvas full screen', () => {
  it('stays expanded in an embedded browser and closes with Escape or the control', () => {
    const { result } = renderHook(useCanvasFullscreen);
    act(() => {
      result.current.toggle();
    });
    expect(result.current.fullscreen).toBe(true);
    act(() => {
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    expect(result.current.fullscreen).toBe(true);
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.fullscreen).toBe(false);
    act(() => {
      result.current.toggle();
    });
    act(() => {
      result.current.toggle();
    });
    expect(result.current.fullscreen).toBe(false);
  });
});
