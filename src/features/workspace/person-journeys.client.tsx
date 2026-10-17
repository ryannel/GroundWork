'use client';

import { useState } from 'react';

import type { MapJourney, MapPerson } from '@/application/landscape-domains';
import { plural } from '@/shared/text';
import { Button } from '@/ui/button';
import { List, ListItem } from '@/ui/list';
import { SearchField } from '@/ui/search-field';
import { Text, TextLink } from '@/ui/text';

import styles from './person-journeys.module.css';

// A workspace can run thousands of journeys, so a person's are a list to search, and only the first few are drawn.
const SHOWN = 40;

interface PersonJourneysProps {
  readonly person: MapPerson;
  /** Their journeys and flows. */
  readonly journeys: readonly MapJourney[];
  readonly domainName: (id: string) => string;
  /** The journey lit on the map, and how to light another; leave out and each journey is a plain link. */
  readonly lighting?: {
    readonly chosen: string | null;
    readonly onChoose: (key: string | null) => void;
  };
  readonly onClose?: () => void;
}

interface RowProps {
  readonly journey: MapJourney;
  readonly where: string;
  readonly lighting: PersonJourneysProps['lighting'];
}

function Words({ journey, where }: Omit<RowProps, 'lighting'>) {
  return (
    <span className={styles.words}>
      <Text tone="strong">{journey.title}</Text>
      <Text size="sm" tone="faint">
        {journey.kind === 'journey' ? 'User journey' : 'Flow'}
        {where === '' ? '' : ` · ${where}`}
      </Text>
    </span>
  );
}

function Row({ journey, where, lighting }: RowProps) {
  if (lighting === undefined) {
    return (
      <ListItem>
        <TextLink href={journey.href} tone="bare">
          <Words journey={journey} where={where} />
        </TextLink>
      </ListItem>
    );
  }
  const chosen = lighting.chosen === journey.key;
  return (
    <ListItem chosen={chosen}>
      <Button
        onClick={() => {
          lighting.onChoose(chosen ? null : journey.key);
        }}
        pressed={chosen}
        variant="bare"
      >
        <Words journey={journey} where={where} />
      </Button>
      {chosen ? <TextLink href={journey.href}>Explore this journey →</TextLink> : null}
    </ListItem>
  );
}

/** Who a person is, where they work, and the journeys they start, to search and open. */
export function PersonJourneys({
  person,
  journeys,
  domainName,
  lighting,
  onClose,
}: PersonJourneysProps) {
  const [query, setQuery] = useState('');
  const words = query.toLowerCase().split(/\s+/u).filter(Boolean);
  const found = journeys.filter((j) => words.every((w) => j.title.toLowerCase().includes(w)));
  const shown = found.slice(0, SHOWN);
  const where = person.domains.map(domainName);
  return (
    <section aria-label={`${person.name}'s journeys`} className={styles.panel}>
      <header className={styles.head}>
        <span className={styles.who}>
          <Text caps mono size="sm" tone="faint">
            {person.customer ? 'Customer' : 'Person'}
          </Text>
          <Text as="h3" size="xl" tone="strong">
            {person.name}
          </Text>
        </span>
        {onClose === undefined ? null : (
          <Button onClick={onClose} size="sm">
            Close
          </Button>
        )}
      </header>
      {person.summary === null ? null : <Text as="p">{person.summary}</Text>}
      {where.length === 0 ? null : (
        <Text as="p" tone="faint">
          {person.customer ? 'Uses' : 'Works in'} {where.join(', ')}
        </Text>
      )}
      {journeys.length === 0 ? (
        <Text as="p">
          No journey names {person.name} yet. A flow says who starts it with{' '}
          <code>actor: {person.id}</code>.
        </Text>
      ) : (
        <>
          <SearchField
            label={`Find among ${person.name}'s journeys`}
            onChange={setQuery}
            placeholder={`Find among ${plural(journeys.length, 'journey')}`}
            value={query}
          />
          <List dense>
            {shown.map((journey) => (
              <Row
                journey={journey}
                key={journey.key}
                lighting={lighting}
                where={journey.domains.map(domainName).join(', ')}
              />
            ))}
          </List>
          {found.length > shown.length ? (
            <Text as="p" tone="faint">
              {String(found.length - shown.length)} more; narrow by words to see them.
            </Text>
          ) : null}
          {found.length === 0 ? <Text as="p">Nothing matches.</Text> : null}
        </>
      )}
    </section>
  );
}
