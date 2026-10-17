'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import type { LanguagePage, TermRow as Row } from '@/application/language-page';
import { plural } from '@/shared/text';
import { replaceAddress } from '@/ui/address-bar';
import { List } from '@/ui/list';
import { SearchField } from '@/ui/search-field';
import { SectionHeading } from '@/ui/section-heading';
import { Select } from '@/ui/select';
import { SplitView } from '@/ui/split-view';
import { Cluster, Stack } from '@/ui/stack';
import { Text } from '@/ui/text';

import { TermPanel } from './term-panel';
import { TermRow } from './term-row';

// A big workspace scans thousands of words, so only the first few that match are drawn.
const SHOWN = 60;
const ALL = '';

function keep(rows: readonly Row[], words: readonly string[], domain: string): readonly Row[] {
  return rows.filter(
    (r) => (domain === ALL || r.domains.includes(domain)) && words.every((w) => r.text.includes(w)),
  );
}

function rememberTerm(id: string | null): void {
  const url = new URL(globalThis.location.href);
  if (id === null) url.searchParams.delete('term');
  else url.searchParams.set('term', id);
  replaceAddress(url);
}

interface RowsProps {
  readonly rows: readonly Row[];
  readonly chosen: string | null;
  readonly onPick: (id: string | null) => void;
}

function Rows({ rows, chosen, onPick }: RowsProps) {
  return (
    <List>
      {rows.slice(0, SHOWN).map((row) => (
        <TermRow chosen={chosen === row.id} key={row.id} onPick={onPick} row={row} />
      ))}
    </List>
  );
}

/** The key terms in their groups, then every word the scan found, to search, cut by domain and open. */
export function LanguageDirectory({ page }: { readonly page: LanguagePage }) {
  const [query, setQuery] = useState('');
  const [domain, setDomain] = useState(ALL);
  const [term, setTerm] = useState(useSearchParams().get('term'));
  const words = query.toLowerCase().split(/\s+/u).filter(Boolean);
  const detail = term === null ? undefined : page.details[term];
  const pick = (id: string | null) => {
    setTerm(id);
    rememberTerm(id);
  };
  const groups = page.groups.map((g) => ({ ...g, terms: keep(g.terms, words, domain) }));
  const found = keep(page.words, words, domain);
  const options = [
    { value: ALL, label: 'Every domain' },
    ...page.domains.map((d) => ({ value: d.id, label: d.name })),
  ];
  return (
    <SplitView
      side={detail === undefined ? null : <TermPanel detail={detail} onPick={pick} page={page} />}
    >
      <Stack gap={6}>
        <Cluster>
          <SearchField
            label="Find a word"
            onChange={setQuery}
            placeholder="Find a word or what it means"
            value={query}
          />
          <Select label="Domain" onChange={setDomain} options={options} value={domain} />
        </Cluster>
        {groups.map((g) =>
          g.terms.length === 0 ? null : (
            <Stack as="section" gap={3} key={g.id} label={g.name}>
              <SectionHeading title={g.name} />
              <Rows chosen={term} onPick={pick} rows={g.terms} />
            </Stack>
          ),
        )}
        <Stack as="section" gap={3} label="Words in the code">
          <SectionHeading title="Words in the code">
            What each domain&apos;s code calls things, from the scan: {plural(found.length, 'word')}
          </SectionHeading>
          <Rows chosen={term} onPick={pick} rows={found} />
          {found.length > SHOWN ? (
            <Text as="p" tone="faint">
              {String(found.length - SHOWN)} more; narrow by words or domain to see them.
            </Text>
          ) : null}
        </Stack>
      </Stack>
    </SplitView>
  );
}
