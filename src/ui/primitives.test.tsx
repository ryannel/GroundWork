// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Badge } from './badge';
import { Button } from './button';
import { Callout } from './callout';
import { Chip, ChipList } from './chip';
import { DataTable } from './data-table';
import { Kbd } from './kbd';
import { Panel } from './panel';
import { SectionHeading } from './section-heading';
import { Tabs } from './tabs';

afterEach(cleanup);

describe('Chip', () => {
  it('is a button the inspector can find by id, with its status and glyph', () => {
    render(
      <ChipList>
        <Chip glyph="▣" id="orders" label="Orders" status="added" />
      </ChipList>,
    );
    const chip = screen.getByRole('button', { name: /Orders/u });
    expect(chip.dataset.inspect).toBe('orders');
    expect(chip.dataset.status).toBe('added');
    expect(chip.textContent).toBe('Orders');
    expect(chip.querySelector('svg')).not.toBeNull();
  });

  it('defaults to an existing thing in body type', () => {
    render(<Chip id="a" label="A" mono />);
    const chip = screen.getByRole('button');
    expect(chip.dataset.status).toBe('existing');
    expect(chip.dataset.mono).toBe('');
  });
});

describe('Button', () => {
  it('calls back when pressed', () => {
    const onClick = vi.fn<() => void>();
    render(
      <Button label="Next step" onClick={onClick} size="sm" variant="primary">
        Next
      </Button>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('Tabs', () => {
  it('marks the current tab as the page', () => {
    render(
      <Tabs
        current="/b"
        label="Chapters"
        tabs={[
          { href: '/a', label: 'A' },
          { href: '/b', label: 'B' },
        ]}
      />,
    );
    expect(screen.getByRole('link', { name: 'B' }).getAttribute('aria-current')).toBe('page');
    const other = screen.getByRole('link', { name: 'A' });
    expect(other.getAttribute('aria-current')).toBeNull();
  });
});

describe('DataTable', () => {
  it('labels each cell with its column so narrow tables can fold', () => {
    render(
      <DataTable
        caption="Fields"
        columns={[
          { key: 'name', label: 'Field' },
          { key: 'type', label: 'Type' },
        ]}
        rows={[{ key: 'vat', cells: { name: 'vatNumber', type: 'string' } }]}
      />,
    );
    expect(screen.getByRole('cell', { name: 'string' }).dataset.label).toBe('Type');
    expect(screen.getByRole('table', { name: 'Fields' })).toBeTruthy();
  });
});

describe('static primitives', () => {
  it('render their content', () => {
    render(
      <Panel title="What to remember">
        <SectionHeading title="Changes">Lede</SectionHeading>
        <Callout title="Note" tone="warning">
          Body
        </Callout>
        <Badge tone="added">+ New</Badge>
        <Kbd keys="⌘K" />
      </Panel>,
    );
    expect(screen.getByRole('heading', { name: 'What to remember' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Changes' })).toBeTruthy();
    expect(screen.getByText('+ New').dataset.tone).toBe('added');
    expect(screen.getByText('⌘K').tagName).toBe('KBD');
    expect(screen.getByRole('complementary').dataset.tone).toBe('warning');
  });
});
