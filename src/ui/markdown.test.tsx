// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Glyph, Icon, iconOf } from './icon';
import { LEGENDS, Legend } from './legend';
import { InlineMarkdown, Markdown } from './markdown';

afterEach(cleanup);

describe('Markdown', () => {
  it('renders blocks and runs as elements, never as HTML', () => {
    const { container } = render(
      <Markdown
        text={
          '**Bold** *em* `code` [[svc:a]] <b>raw</b>\n\n- one\n1. two\n> said [x](https://x.org)'
        }
      />,
    );
    expect(container.querySelector('p strong')?.textContent).toBe('Bold');
    expect(container.querySelector('p em')?.textContent).toBe('em');
    expect([...container.querySelectorAll('code')].map((c) => c.textContent)).toEqual([
      'code',
      'svc:a',
    ]);
    expect(container.querySelector('p b')).toBeNull();
    expect(container.querySelector('ul li')?.textContent).toBe('one');
    expect(container.querySelector('ol li')?.textContent).toBe('two');
    expect(container.querySelector('blockquote a')?.getAttribute('href')).toBe('https://x.org');
  });

  it('draws citations with renderRef and titles a shortened URL', () => {
    render(<InlineMarkdown renderRef={(id) => <i>{id}!</i>} text="[[svc:a]] https://e.com/x/y" />);
    expect(screen.getByText('svc:a!')).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('title')).toBe('https://e.com/x/y');
    render(<InlineMarkdown text={null} />);
  });
});

describe('Icon and Glyph', () => {
  it('draws a known glyph as an icon and leaves others as text', () => {
    expect(iconOf('▣')).toBe('service');
    expect(iconOf('x')).toBeNull();
    const { container } = render(
      <>
        <Icon name="team" />
        <Glyph glyph="⛁" />
        <Glyph glyph="x" />
      </>,
    );
    expect(container.querySelectorAll('svg')).toHaveLength(2);
    expect(container.textContent).toBe('x');
    expect(container.textContent).toBe('x');
  });
});

describe('Legend', () => {
  it('explains lines, swatches and glyphs', () => {
    const { container } = render(
      <Legend items={[...LEGENDS.map, ...LEGENDS.status]} title="Key" />,
    );
    expect(screen.getByRole('note').textContent).toContain('Keysync call');
    expect(container.querySelectorAll('[data-line]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-swatch]')).toHaveLength(5);
    render(<Legend items={[{ label: 'bare' }]} />);
    expect(screen.getByText('bare')).toBeTruthy();
  });
});
