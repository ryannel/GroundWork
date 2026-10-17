// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Button } from './button';
import { FilterChips } from './filter-chips';
import { List, ListItem } from './list';
import { ProgressBar } from './progress-bar';
import { SearchField } from './search-field';
import { Select } from './select';
import { Text, TextLink } from './text';

afterEach(cleanup);

describe('SearchField', () => {
  it('hands back what is typed', () => {
    const onChange = vi.fn<(value: string) => void>();
    render(<SearchField label="Find a plan" onChange={onChange} placeholder="Find" value="" />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a plan' }), {
      target: { value: 'vat' },
    });
    expect(onChange).toHaveBeenCalledWith('vat');
  });
});

describe('Select', () => {
  it('hands back the option picked, typed', () => {
    const onChange = vi.fn<(value: 'a' | 'b') => void>();
    render(
      <Select
        label="Sort"
        onChange={onChange}
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
        value="a"
      />,
    );
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort' }), { target: { value: 'b' } });
    expect(onChange).toHaveBeenCalledWith('b');
  });
});

describe('FilterChips', () => {
  it('presses the current choice, counts each and hands back the one pressed', () => {
    const onChange = vi.fn<(value: string) => void>();
    render(
      <FilterChips
        choices={[
          { value: '', label: 'All', count: 3 },
          { value: 'draft', label: 'Draft' },
        ]}
        label="Stage"
        onChange={onChange}
        value=""
      />,
    );
    expect(screen.getByRole('button', { name: 'All 3' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Draft' }));
    expect(onChange).toHaveBeenCalledWith('draft');
  });
});

describe('the quiet pieces', () => {
  it('draw progress, a list, words, links and toggles', () => {
    render(
      <List>
        <ListItem chosen>
          <Text caps clamp={2} mono size="sm" tone="accent" weight="strong">
            words
          </Text>
          <TextLink href="/x" tone="title">
            Go
          </TextLink>
          <ProgressBar label="Done" max={4} value={1} />
          <Button pressed variant="bare">
            Pick
          </Button>
        </ListItem>
      </List>,
    );
    expect(screen.getByRole('progressbar', { name: 'Done' }).getAttribute('value')).toBe('1');
    expect(screen.getByRole('listitem').dataset.chosen).toBe('');
    expect(screen.getByText('words').dataset.tone).toBe('accent');
    expect(screen.getByRole('link', { name: 'Go' }).getAttribute('href')).toBe('/x');
    expect(screen.getByRole('button', { name: 'Pick' }).getAttribute('aria-pressed')).toBe('true');
  });
});
