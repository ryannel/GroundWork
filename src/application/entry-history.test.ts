import { expect, it } from 'vitest';

import { explorerFixture } from '@/../test/service-explorer-kit';
import type { ExplorerPage, ExplorerSource } from '@/domain/service-explorer';

import { historicalDataPin, historicalEntryHref } from './entry-history';

const pin = 'a'.repeat(40);
const root = `https://github.com/acme/orders/blob/${pin}`;
const source = (url: string): ExplorerSource => ({ id: url, label: 'Original source', url });
const dataPage = (...sources: readonly ExplorerSource[]): ExplorerPage => ({
  ...explorerFixture(),
  kind: 'data',
  sources,
});

it('keeps the full historical selection in a shareable address', () => {
  expect(historicalEntryHref('acme')).toBe('/acme/explorer/');
  expect(
    historicalEntryHref('acme', {
      service: 'svc:orders',
      scope: 'older',
      page: 'flow.json',
      node: 'order#place',
    }),
  ).toBe('/acme/explorer/?scope=older&service=svc%3Aorders&page=flow.json&node=order%23place');
});

it('identifies the single pinned source of a shared historical data page', () => {
  const page = dataPage(
    source(`${root}/source.graphql#L1-L3`),
    source(`${root}/types.graphql#L5-L8`),
  );
  expect(historicalDataPin(page)).toEqual({ repo: 'acme/orders', commit: pin });
  expect(historicalDataPin({ ...page, kind: 'overview' })).toBeNull();
  expect(historicalDataPin({ ...page, sources: [] })).toBeNull();
});

it.each([
  'unparseable',
  'https://gitlab.com/acme/orders',
  `https://github.com/acme/orders/tree/${pin}/source.graphql`,
  'https://github.com/acme/orders/blob/main/source.graphql',
])('keeps the historical data pin unknown when its first source is %s', (url) => {
  expect(historicalDataPin(dataPage(source(url)))).toBeNull();
});

it.each([
  'unparseable',
  `https://gitlab.com/acme/orders/-/blob/${pin}/source.graphql`,
  `https://github.com/acme/orders/tree/${pin}/source.graphql`,
  `https://github.com/acme/payments/blob/${pin}/source.graphql`,
  `https://github.com/acme/orders/blob/${'b'.repeat(40)}/source.graphql`,
])('keeps the historical data pin unknown when another source is %s', (url) => {
  const page = dataPage(source(`${root}/types.graphql`), source(url));
  expect(historicalDataPin(page)).toBeNull();
});
