'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { searchValueFlows, type ValueFlowArea } from '@/application/workspace-value-flows';
import { plural } from '@/shared/text';
import { Button } from '@/ui/button';
import { Callout } from '@/ui/callout';
import { List, ListItem } from '@/ui/list';
import { PageHeader } from '@/ui/page-header';
import { SearchField } from '@/ui/search-field';
import { SectionHeading } from '@/ui/section-heading';
import { Select } from '@/ui/select';
import { Cluster, Stack } from '@/ui/stack';
import { Text, TextLink } from '@/ui/text';

interface Filters {
  readonly query: string;
  readonly area: string;
}

function remember(filters: Filters): void {
  const url = new URL(globalThis.location.href);
  const pairs: readonly (readonly [string, string])[] = [
    ['q', filters.query],
    ['area', filters.area],
  ];
  for (const [key, value] of pairs) {
    if (value === '') url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  // Fresh state lets Next's native-history integration notify useSearchParams.
  globalThis.history.replaceState(null, '', url);
}

function Directory({
  areas,
  start,
}: {
  readonly areas: readonly ValueFlowArea[];
  readonly start: Filters;
}) {
  const filters = start;
  const change = (next: Partial<Filters>): void => {
    const merged = { ...filters, ...next };
    remember(merged);
  };
  const found = searchValueFlows(areas, filters.query, filters.area);
  const count = found.reduce((total, area) => total + area.flows.length, 0);
  return (
    <Stack gap={6}>
      <Stack gap={3}>
        <Cluster>
          <SearchField
            label="Find a value flow"
            placeholder="e.g. Make offers available"
            value={filters.query}
            onChange={(query) => {
              change({ query });
            }}
          />
          <Select
            label="Area"
            value={filters.area}
            options={[
              { value: '', label: 'Every area' },
              ...areas.map((area) => ({ value: area.id, label: area.name })),
            ]}
            onChange={(area) => {
              change({ area });
            }}
          />
          {filters.query === '' && filters.area === '' ? null : (
            <Button
              variant="quiet"
              onClick={() => {
                change({ query: '', area: '' });
              }}
            >
              Clear filters
            </Button>
          )}
        </Cluster>
        <div role="status">
          <Text size="sm" tone="muted">
            {plural(count, 'value flow')} in {plural(found.length, 'area')}
          </Text>
        </div>
      </Stack>
      {found.length === 0 ? (
        <Callout title="No matching value flows">
          Try a shorter phrase, a system name or another area.
        </Callout>
      ) : (
        found.map((area) => (
          <Stack as="section" gap={3} key={area.id} label={area.name}>
            <SectionHeading title={area.name}>
              <Text size="sm" tone="muted">
                {area.purpose}
              </Text>
            </SectionHeading>
            <List>
              {area.flows.map((flow) => (
                <ListItem key={flow.id}>
                  <TextLink href={flow.href} tone="bare">
                    <Stack gap={2}>
                      <Cluster spread>
                        <Text weight="strong" tone="strong">
                          {flow.title}
                        </Text>
                        <Text size="sm" tone="accent">
                          Open map →
                        </Text>
                      </Cluster>
                      <Text as="p" tone="muted">
                        {flow.summary}
                      </Text>
                      <Text size="sm" tone="faint">
                        {flow.systems.join(' · ')}
                      </Text>
                    </Stack>
                  </TextLink>
                </ListItem>
              ))}
            </List>
          </Stack>
        ))
      )}
    </Stack>
  );
}

function FromAddress({ areas }: { readonly areas: readonly ValueFlowArea[] }) {
  const params = useSearchParams();
  const requested = params.get('area') ?? '';
  return (
    <Directory
      areas={areas}
      start={{
        query: params.get('q') ?? '',
        area: areas.some((area) => area.id === requested) ? requested : '',
      }}
    />
  );
}

/** Browse the authored work without knowing which part of the landscape contains it. */
export function ValueFlowsPage({ areas }: { readonly areas: readonly ValueFlowArea[] }) {
  const total = areas.reduce((count, area) => count + area.flows.length, 0);
  return (
    <Stack gap={6}>
      <PageHeader
        title="Value Flows"
        description="Find activities by what they achieve, then open their systems and connections in the map."
        meta={`${plural(total, 'value flow')} across ${plural(areas.length, 'area')} · Inferred from scanned evidence`}
      />
      {total === 0 ? (
        <Callout title="No value flows yet">
          This workspace’s area value flows have not been mapped yet.
        </Callout>
      ) : (
        <Suspense fallback={<Directory areas={areas} start={{ query: '', area: '' }} />}>
          <FromAddress areas={areas} />
        </Suspense>
      )}
    </Stack>
  );
}
