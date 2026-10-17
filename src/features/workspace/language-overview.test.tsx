// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { acme } from '@/../test/workspace-kit';
import { languagePageOf } from '@/application/language-page';

import { LanguageOverview } from './index';

vi.mock(import('next/navigation'), async (original) => {
  const actual = await original();
  return {
    ...actual,
    useSearchParams: () => new actual.ReadonlyURLSearchParams(globalThis.location.search),
  };
});

beforeEach(() => {
  globalThis.history.replaceState(null, '', '/acme/language/');
});
afterEach(cleanup);

function overview() {
  const { workspace, model } = acme();
  return render(
    <LanguageOverview page={languagePageOf(workspace, model.languages, model.keyTerms)} />,
  );
}

const rowNames = (name: string) =>
  within(screen.getByRole('region', { name }))
    .getAllByRole('button')
    .map((b) => b.textContent);

describe('LanguageOverview', () => {
  it('lists the key terms in their groups, then the words in the code', () => {
    overview();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Language');
    expect(rowNames('Selling')).toStrictEqual([
      'OrderSame in the codeEverything a customer buys at one checkout.Also purchase',
    ]);
    expect(rowNames('Words in the code')).toHaveLength(3);
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('opens a term beside the list, remembers it in the address, and walks to a related word', () => {
    overview();
    fireEvent.click(within(screen.getByRole('region', { name: 'Selling' })).getByRole('button'));
    const side = screen.getByRole('complementary');
    expect(within(side).getByRole('heading', { name: 'Order' })).toBeDefined();
    expect(within(side).getByText('Purchase')).toBeDefined();
    expect(globalThis.location.search).toBe('?term=term%3Aorder');
    fireEvent.click(within(side).getAllByRole('button', { name: 'Order' })[0] ?? side);
    expect(globalThis.location.search).toBe('?term=con%3Aorder');
    expect(within(screen.getByRole('complementary')).getByText('is settled by')).toBeDefined();
    fireEvent.click(
      within(screen.getByRole('complementary')).getByRole('button', { name: 'Close' }),
    );
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(globalThis.location.search).toBe('');
  });

  it('opens the term named in the address', () => {
    globalThis.history.replaceState(null, '', '/acme/language/?term=con:payment');
    overview();
    expect(
      within(screen.getByRole('complementary')).getByRole('heading', { name: 'Payment' }),
    ).toBeDefined();
  });

  it('narrows the list by words and by domain', () => {
    overview();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a word' }), {
      target: { value: 'settles' },
    });
    expect(screen.queryByRole('region', { name: 'Selling' })).toBeNull();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a word' }), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Domain' }), {
      target: { value: 'catalogue' },
    });
    expect(screen.queryByRole('region', { name: 'Selling' })).toBeNull();
    expect(screen.getByText(/0 words/u)).toBeDefined();
  });
});
