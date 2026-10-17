'use client';

import { useState } from 'react';

import type { DomainMap, MapPerson } from '@/application/landscape-domains';
import { plural } from '@/shared/text';
import { Button } from '@/ui/button';
import { List, ListItem } from '@/ui/list';
import { SearchField } from '@/ui/search-field';
import { SplitView } from '@/ui/split-view';
import { Stack } from '@/ui/stack';
import { Text, TextLink } from '@/ui/text';

import styles from './people-directory.module.css';
import { PersonJourneys } from './person-journeys.client';

const matches = (person: MapPerson, words: readonly string[]): boolean => {
  const text = `${person.name} ${person.summary ?? ''}`.toLowerCase();
  return words.every((w) => text.includes(w));
};

/** Customers first, then everyone else by name. */
const byCustomer = (a: MapPerson, b: MapPerson): number => {
  if (a.customer !== b.customer) return a.customer ? -1 : 1;
  return a.name.localeCompare(b.name);
};

// Everyone who uses the systems, to search: where each works and how many journeys they start. Pick one to list
// their journeys beside the list.
export function PeopleDirectory({ map }: { readonly map: DomainMap }) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const domains = new Map(map.domains.map((d) => [d.id, d]));
  const nameOf = (id: string): string => domains.get(id)?.name ?? id;
  const words = query.toLowerCase().split(/\s+/u).filter(Boolean);
  const shown = map.people.filter((p) => matches(p, words)).toSorted(byCustomer);
  const journeysOf = (id: string) => map.journeys.filter((j) => j.actor === id);
  const person = map.people.find((p) => p.id === picked);
  return (
    <SplitView
      side={
        person === undefined ? null : (
          <PersonJourneys
            domainName={nameOf}
            journeys={journeysOf(person.id)}
            key={person.id}
            onClose={() => {
              setPicked(null);
            }}
            person={person}
          />
        )
      }
    >
      <Stack gap={3}>
        <SearchField
          label="Find a person"
          onChange={setQuery}
          placeholder={`Find among ${plural(map.people.length, 'person', 'people')}`}
          value={query}
        />
        <List>
          {shown.map((p) => (
            <ListItem chosen={p.id === picked} key={p.id}>
              <Button
                onClick={() => {
                  setPicked(p.id === picked ? null : p.id);
                }}
                pressed={p.id === picked}
                variant="bare"
              >
                <span className={styles.pick}>
                  <span className={styles.name}>
                    <Text size="lg" tone="strong" weight="strong">
                      {p.name}
                    </Text>
                    {p.customer ? (
                      <Text caps mono size="sm" tone="accent">
                        Customer
                      </Text>
                    ) : null}
                  </span>
                  {p.summary === null ? null : <Text>{p.summary}</Text>}
                  <span className={styles.count}>
                    <Text size="sm" tone="faint">
                      {plural(journeysOf(p.id).length, 'journey')}
                    </Text>
                  </span>
                </span>
              </Button>
              {p.domains.length === 0 ? null : (
                <span className={styles.domains}>
                  {p.domains.map((id) => (
                    <TextLink href={domains.get(id)?.href ?? '#'} key={id} tone="quiet">
                      {nameOf(id)}
                    </TextLink>
                  ))}
                </span>
              )}
            </ListItem>
          ))}
        </List>
        {shown.length === 0 ? (
          <Text as="p" tone="faint">
            Nobody matches.
          </Text>
        ) : null}
      </Stack>
    </SplitView>
  );
}
