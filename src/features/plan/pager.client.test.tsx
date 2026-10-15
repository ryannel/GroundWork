// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Chapter, Neighbours, Page } from '@/application/plan-pages';

import { ChapterBoundary } from './chapter-boundary.client';
import { Pager } from './pager.client';

afterEach(cleanup);

const page = (chapter: Page['chapter'], key: string, title: string): Page => ({
  chapter,
  screen: key,
  title,
  href: `/w/plans/p/${chapter}/${key}/`,
});

const WHY: Chapter = {
  key: 'why',
  number: '1',
  title: 'Why',
  subtitle: '',
  side: false,
  pages: [page('why', 'problem', 'The problem')],
};

const AROUND: Neighbours = {
  previous: null,
  next: page('why', 'problem', 'The problem'),
  previousChapter: null,
  nextChapter: null,
  opens: null,
  end: null,
};

describe('Pager', () => {
  it('names the chapter the next screen opens', () => {
    render(<Pager neighbours={{ ...AROUND, opens: WHY }} />);
    const next = screen.getByRole('link', { name: /chapter 1/i });
    expect(next.textContent).toContain('Next · Chapter 1');
    expect(next.textContent).toContain('Why');
  });

  it('closes the plan on the story’s last screen', () => {
    render(
      <Pager neighbours={{ ...AROUND, next: page('ref', 'services', 'Services'), end: '/w/' }} />,
    );
    expect(screen.getByText('That is the whole plan.')).toBeTruthy();
    const back = screen.getByRole('link', { name: 'Back to the workspace' });
    expect(back.getAttribute('href')).toMatch(/^\/w\/?$/);
    expect(screen.getByRole('link', { name: /browse the reference/i })).toBeTruthy();
  });
});

function Broken(): never {
  throw new Error('No such team.');
}

describe('ChapterBoundary', () => {
  it('says the screen could not be drawn, and why', () => {
    const quiet = vi.spyOn(globalThis.console, 'error').mockReturnValue();
    render(
      <ChapterBoundary>
        <Broken />
      </ChapterBoundary>,
    );
    quiet.mockRestore();
    expect(screen.getByText('This screen could not be drawn.')).toBeTruthy();
    expect(screen.getByText(/stopped it: No such team\. The other/)).toBeTruthy();
  });
});
