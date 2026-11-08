'use client';

import { useState } from 'react';

import { entryFlowHref } from '@/application/entry-flow-paths';
import {
  historicalEntryHref,
  type HistoricalEntry,
  type HistoricalScope,
} from '@/application/entry-history';
import { SearchField } from '@/ui/search-field';
import { Cluster, Stack } from '@/ui/stack';
import { Text, TextLink } from '@/ui/text';

export function HistoricalRepositories({
  workspace,
  scopes,
}: {
  readonly workspace: string;
  readonly scopes: readonly HistoricalScope[];
}) {
  const [query, setQuery] = useState('');
  const search = query.trim().toLowerCase();
  const found = scopes.filter((scope) =>
    `${scope.name} ${scope.repo} ${scope.commit}`.toLowerCase().includes(search),
  );
  return (
    <Stack>
      <SearchField label="Find a repository" value={query} onChange={setQuery} />
      {found.length === 0 ? <Text>No archived repository matches.</Text> : null}
      {found.map((scope) => (
        <TextLink href={historicalEntryHref(workspace, { scope: scope.key })} key={scope.key}>
          {scope.name} · {scope.publication} · {scope.commit}
        </TextLink>
      ))}
    </Stack>
  );
}

export function HistoricalEntries({
  workspace,
  scope,
  entries,
}: {
  readonly workspace: string;
  readonly scope: string;
  readonly entries: readonly HistoricalEntry[];
}) {
  const [query, setQuery] = useState('');
  const search = query.trim().toLowerCase();
  const found = entries.filter((entry) => entry.label.toLowerCase().includes(search));
  return (
    <Stack>
      <SearchField label="Find an entry" value={query} onChange={setQuery} />
      {found.length === 0 ? <Text>No archived entry matches.</Text> : null}
      {found.map((entry) => (
        <Cluster key={entry.id}>
          <TextLink href={historicalEntryHref(workspace, { scope, page: entry.file })}>
            {entry.label}
          </TextLink>
          {entry.native === null ? null : (
            <TextLink href={entryFlowHref(workspace, { entry: entry.native })}>
              Current entry
            </TextLink>
          )}
        </Cluster>
      ))}
    </Stack>
  );
}

export function HistoricalIndex({
  items,
}: {
  readonly items: readonly {
    readonly id: string;
    readonly label: string;
    readonly href: string | null;
    readonly detail?: string | undefined;
  }[];
}) {
  const [query, setQuery] = useState('');
  const search = query.trim().toLowerCase();
  const found = items.filter((item) => item.label.toLowerCase().includes(search));
  return (
    <Stack>
      <SearchField label="Find in this index" value={query} onChange={setQuery} />
      {found.map((item) => (
        <Stack key={item.id} gap={1}>
          {item.href === null ? (
            <Text>{item.label}</Text>
          ) : (
            <TextLink href={item.href}>{item.label}</TextLink>
          )}
          {item.detail === undefined ? null : <Text tone="muted">{item.detail}</Text>}
        </Stack>
      ))}
      {found.length === 0 ? <Text>No matching items in this index.</Text> : null}
    </Stack>
  );
}
