// @vitest-environment happy-dom
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';

import { entryFlowOf, type EntryFlowView } from '@/application/entry-flow';
import { indexOf } from '@/application/model-index';
import { readModel } from '@/infrastructure/read-model';

import { EntryFlowPage } from './entry-flow-page';
import { EntryFlow } from './entry-flow.client';

vi.mock(import('server-only'), () => ({}));
let root: string;
let flow: EntryFlowView;
beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'groundwork-canvas-'));
  await cp(path.resolve('test/fixtures/model'), path.join(root, 'model'), { recursive: true });
  const model = await readModel('model-fixture', root);
  if (model === null) throw new Error('Missing fixture');
  const projected = entryFlowOf(indexOf(model), 'api:confirm');
  if (projected === null) throw new Error('Missing entry');
  flow = projected;
});
afterEach(cleanup);
afterAll(async () => rm(root, { recursive: true, force: true }));
it('selects the backed store-write node from the top strip and reveals its exact source and field', () => {
  render(<EntryFlow flow={flow} />);
  fireEvent.click(screen.getByRole('button', { name: 'write · Orders database' }));
  const inspector = within(screen.getByRole('complementary', { name: 'Flow inspector' }));
  expect(inspector.getByText('h:confirm#tx/save')).toBeTruthy();
  expect(inspector.getByRole('link').getAttribute('href')).toContain('#L12-L16');
  expect(inspector.getByText(/"name": "status"/u)).toBeTruthy();
  expect(
    screen.getByRole('button', { name: 'write write · status' }).getAttribute('aria-pressed'),
  ).toBe('true');
});
it('follows an explicit causes link to the receiving entry rather than inferring an event relay', () => {
  render(<EntryFlow flow={flow} />);
  fireEvent.click(
    screen.getByRole('button', { name: 'publish publish · msg:confirmed Asynchronous' }),
  );
  const inspector = within(screen.getByRole('complementary', { name: 'Flow inspector' }));
  expect(
    inspector.getByRole('link', { name: 'Follow sub:on-confirmed →' }).getAttribute('href'),
  ).toBe('/model-fixture/entries?id=sub-on-confirmed');
  expect(screen.getByText('Order facts')).toBeTruthy();
  expect(screen.getByText('Payment facts')).toBeTruthy();
  expect(screen.getByText('Recorded failures')).toBeTruthy();
});
it('keeps missing detail and gaps visible in a flow without a handler', () => {
  render(
    <EntryFlow
      flow={{
        ...flow,
        handlers: [],
        callers: [],
        effects: [],
        gaps: ['No schedule or trigger is recorded.'],
      }}
    />,
  );
  expect(screen.getByText('No caller recorded')).toBeTruthy();
  expect(screen.getByText('No effect recorded')).toBeTruthy();
  expect(screen.getByText('No handler detail is recorded.')).toBeTruthy();
  expect(screen.getByText('No schedule or trigger is recorded.')).toBeTruthy();
});

it('renders the bounded entry page with a link to the remaining records', () => {
  render(
    <EntryFlowPage
      workspace={{ name: 'Listing fixture', href: '/fixture/entries/', description: null }}
      flow={null}
      entries={Array.from({ length: 30 }, (_, number) => ({
        id: `api:entry-${String(number)}`,
        kind: 'endpoint',
        title: `Entry ${String(number)}`,
        href: `/fixture/entries/?id=api-entry-${String(number)}`,
      }))}
      pagination={{
        total: 65,
        page: 1,
        pages: 3,
        previous: null,
        next: '/fixture/entries/?page=2',
      }}
      plans={[]}
      comparison={null}
    />,
  );
  expect(screen.getByText('65 entries · Page 1 of 3')).toBeTruthy();
  expect(screen.getAllByRole('link', { name: /^Entry \d+$/u })).toHaveLength(30);
  expect(screen.getByRole('link', { name: 'Next page' }).getAttribute('href')).toMatch(
    /^\/fixture\/entries\/?\?page=2$/u,
  );
  expect(screen.queryByRole('link', { name: 'Previous page' })).toBeNull();
});
