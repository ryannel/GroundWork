'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { STAGE_WORDS, type PlanRow, type PlanStage } from '@/application/plan-index';
import { plural } from '@/shared/text';
import { replaceAddress } from '@/ui/address-bar';
import { Button } from '@/ui/button';
import { FilterChips } from '@/ui/filter-chips';
import { List } from '@/ui/list';
import { SearchField } from '@/ui/search-field';
import { Select } from '@/ui/select';
import { Text } from '@/ui/text';

import { PlanLine } from './plan-line';
import styles from './plans-index.module.css';

export interface IndexDomain {
  readonly id: string;
  readonly name: string;
}

type Sort = 'newest' | 'oldest' | 'title' | 'progress';

interface Filters {
  readonly query: string;
  readonly domain: string;
  readonly stage: PlanStage | '';
  readonly sort: Sort;
}

const STAGES: readonly PlanStage[] = ['draft', 'review', 'approved', 'delivery', 'done'];
const SORTS: Readonly<Record<Sort, string>> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  title: 'By title',
  progress: 'Furthest along',
};
const PAGE = 50;
const NONE: Filters = { query: '', domain: '', stage: '', sort: 'newest' };

const STAGE_SET: ReadonlySet<string> = new Set(STAGES);
const isStage = (value: string): value is PlanStage => STAGE_SET.has(value);
const isSort = (value: string): value is Sort => Object.hasOwn(SORTS, value);
const SORT_OPTIONS = Object.entries(SORTS)
  .filter((entry): entry is [Sort, string] => isSort(entry[0]))
  .map(([value, label]) => ({ value, label }));
const isClear = (f: Filters): boolean =>
  f.query === '' && f.domain === '' && f.stage === '' && f.sort === 'newest';
const share = (row: PlanRow): number => (row.workItems === 0 ? 0 : row.done / row.workItems);

const SORTERS: Readonly<Record<Sort, (a: PlanRow, b: PlanRow) => number>> = {
  newest: (a, b) => (b.date ?? '').localeCompare(a.date ?? ''),
  oldest: (a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'),
  title: (a, b) => a.title.localeCompare(b.title),
  progress: (a, b) => {
    const byShare = share(b) - share(a);
    return byShare === 0 ? STAGES.indexOf(b.stage) - STAGES.indexOf(a.stage) : byShare;
  },
};

/** The filters a link carries, so a cut of the plans can be shared. */
function fromAddress(params: URLSearchParams): Filters {
  const stage = params.get('stage') ?? '';
  const sort = params.get('sort') ?? '';
  return {
    query: params.get('q') ?? '',
    domain: params.get('domain') ?? '',
    stage: isStage(stage) ? stage : '',
    sort: isSort(sort) ? sort : 'newest',
  };
}

function toAddress(filters: Filters): void {
  const url = new URL(globalThis.location.href);
  const pairs: [string, string][] = [
    ['q', filters.query],
    ['domain', filters.domain],
    ['stage', filters.stage],
    ['sort', filters.sort === 'newest' ? '' : filters.sort],
  ];
  for (const [key, value] of pairs) {
    if (value === '') url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  replaceAddress(url);
}

function matches(row: PlanRow, filters: Filters, words: readonly string[]): boolean {
  if (filters.domain !== '' && !row.domains.includes(filters.domain)) return false;
  const text = `${row.title} ${row.summary} ${row.id}`.toLowerCase();
  return words.every((w) => text.includes(w));
}

function countBy(rows: readonly PlanRow[], key: (row: PlanRow) => readonly string[]) {
  const counts = new Map<string, number>();
  for (const row of rows) for (const k of key(row)) counts.set(k, (counts.get(k) ?? 0) + 1);
  return counts;
}

interface ToolsProps {
  readonly filters: Filters;
  readonly change: (next: Partial<Filters>) => void;
  readonly domains: readonly IndexDomain[];
  readonly byDomain: ReadonlyMap<string, number>;
  readonly total: number;
}

function Tools({ filters, change, domains, byDomain, total }: ToolsProps) {
  return (
    <div className={styles.tools}>
      <SearchField
        label="Find a plan"
        onChange={(query) => {
          change({ query });
        }}
        placeholder={`Find among ${plural(total, 'plan')}`}
        value={filters.query}
      />
      <Select
        label="Domain"
        onChange={(domain) => {
          change({ domain });
        }}
        options={[
          { value: '', label: 'Every domain' },
          ...domains.map((d) => ({
            value: d.id,
            label: `${d.name} (${String(byDomain.get(d.id) ?? 0)})`,
          })),
        ]}
        value={filters.domain}
      />
      <Select
        label="Sort"
        onChange={(sort) => {
          change({ sort });
        }}
        options={SORT_OPTIONS}
        value={filters.sort}
      />
    </div>
  );
}

interface IndexProps {
  readonly rows: readonly PlanRow[];
  readonly domains: readonly IndexDomain[];
}

// Every plan, to find one among hundreds: search their words, cut them to a domain or a stage, sort, and read
// fifty at a time. The cut travels in the address, so a link to a domain's plans can be shared.
export function PlansIndex(props: IndexProps) {
  return (
    <Suspense fallback={<Index {...props} start={NONE} />}>
      <FromAddress {...props} />
    </Suspense>
  );
}

function FromAddress(props: IndexProps) {
  const params = new URLSearchParams(useSearchParams().toString());
  return <Index {...props} start={fromAddress(params)} />;
}

function Index({ rows, domains, start }: IndexProps & { readonly start: Filters }) {
  const [filters, setFilters] = useState<Filters>(start);
  const [limit, setLimit] = useState(PAGE);
  const change = (next: Partial<Filters>): void => {
    const merged = { ...filters, ...next };
    setFilters(merged);
    setLimit(PAGE);
    toAddress(merged);
  };
  const names = new Map(domains.map((d) => [d.id, d.name]));
  const nameOf = (id: string): string => names.get(id) ?? id;
  const words = filters.query.toLowerCase().split(/\s+/u).filter(Boolean);
  const found = rows.filter((row) => matches(row, filters, words));
  const byStage = countBy(found, (row) => [row.stage]);
  const byDomain = countBy(
    rows.filter((row) => matches(row, { ...filters, domain: '' }, words)),
    (row) => row.domains,
  );
  const shown = found
    .filter((row) => filters.stage === '' || row.stage === filters.stage)
    .toSorted(SORTERS[filters.sort]);
  return (
    <div className={styles.index}>
      <Tools
        byDomain={byDomain}
        change={change}
        domains={domains}
        filters={filters}
        total={rows.length}
      />
      <FilterChips
        choices={[
          { value: '', label: 'All', count: found.length },
          ...STAGES.map((stage) => ({
            value: stage,
            label: STAGE_WORDS[stage],
            count: byStage.get(stage) ?? 0,
          })),
        ]}
        label="Stage"
        onChange={(stage) => {
          change({ stage });
        }}
        value={filters.stage}
      />
      <p className={styles.tally}>
        <Text tone="muted">
          {shown.length === rows.length
            ? plural(rows.length, 'plan')
            : `${String(shown.length)} of ${plural(rows.length, 'plan')}`}
        </Text>
        {isClear(filters) ? null : (
          <Button
            onClick={() => {
              change(NONE);
            }}
            variant="link"
          >
            Clear
          </Button>
        )}
      </p>
      {shown.length === 0 ? (
        <Text as="p" tone="muted">
          No plan matches.
        </Text>
      ) : (
        <List>
          {shown.slice(0, limit).map((row) => (
            <PlanLine
              key={row.id}
              nameOf={nameOf}
              onDomain={(id) => {
                change({ domain: id });
              }}
              row={row}
            />
          ))}
        </List>
      )}
      {shown.length > limit ? (
        <span>
          <Button
            onClick={() => {
              setLimit(limit + PAGE);
            }}
            variant="link"
          >
            Show {Math.min(PAGE, shown.length - limit)} more of {shown.length - limit}
          </Button>
        </span>
      ) : null}
    </div>
  );
}
