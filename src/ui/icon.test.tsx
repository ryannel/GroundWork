// @vitest-environment happy-dom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Icon } from './icon';

describe('Icon', () => {
  it('draws the shapes and leaves stroke and fill to its class', () => {
    const { container } = render(<Icon name="endpoint" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.querySelectorAll('path, rect, circle, ellipse').length).toBeGreaterThan(0);
    expect(svg?.hasAttribute('stroke')).toBe(false);
  });
});
