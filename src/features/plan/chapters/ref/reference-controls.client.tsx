'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { SHOWS, SHOW_WORD } from '@/application/reference/model';
import type { ReferencePage } from '@/application/reference/query';
import { Button } from '@/ui/button';
import { SearchField } from '@/ui/search-field';
import { Select } from '@/ui/select';
import { Cluster, Stack } from '@/ui/stack';
import { Text, TextLink } from '@/ui/text';

const pageHref = (query: ReferencePage['query'], page: number): string => {
  const params = new URLSearchParams({ ...query, page: String(page) });
  return `?${params.toString()}`;
};

export function ReferenceControls({
  page,
  teams,
  today,
}: {
  readonly page: Omit<ReferencePage, 'rows'>;
  readonly teams: Readonly<Record<string, string>>;
  readonly today: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(page.query.q);
  const [pending, startTransition] = useTransition();
  const navigate = (name: string, value: string) => {
    const url = new URL(globalThis.location.href);
    url.searchParams.delete('page');
    if (value === '') url.searchParams.delete(name);
    else url.searchParams.set(name, value);
    startTransition(() => {
      router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
    });
  };
  return (
    <Stack>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          navigate('q', query);
        }}
      >
        <Cluster>
          <SearchField label="Search catalogue" value={query} onChange={setQuery} />
          <Button type="submit">Search</Button>
          <Select
            label="Team"
            value={page.query.team}
            options={[
              { value: '', label: 'Everyone' },
              ...Object.entries(teams).map(([value, label]) => ({ value, label })),
            ]}
            onChange={(value) => {
              navigate('team', value);
            }}
          />
          {today ? null : (
            <Select
              label="Show the system"
              value={page.query.show}
              options={SHOWS.map((value) => ({ value, label: SHOW_WORD[value] }))}
              onChange={(value) => {
                navigate('show', value);
              }}
            />
          )}
        </Cluster>
      </form>
      <Cluster>
        <Text as="p" tone="faint">
          {pending
            ? 'Loading…'
            : `${String(page.total)} results · Page ${String(page.query.page)} of ${String(page.pages)}`}
        </Text>
        {page.query.page > 1 ? (
          <TextLink href={pageHref(page.query, page.query.page - 1)}>Previous page</TextLink>
        ) : null}
        {page.query.page < page.pages ? (
          <TextLink href={pageHref(page.query, page.query.page + 1)}>Next page</TextLink>
        ) : null}
      </Cluster>
    </Stack>
  );
}
