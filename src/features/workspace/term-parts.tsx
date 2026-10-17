import type { ReactNode } from 'react';

import type { TermDetail, TermLink, TermName, TermPlace } from '@/application/language-page';
import { Button } from '@/ui/button';
import { List, ListItem } from '@/ui/list';
import { Cluster, Stack } from '@/ui/stack';
import { Text, TextLink } from '@/ui/text';

import { TermFitBadge } from './term-fit';

export type Pick = (id: string | null) => void;

/** One titled part of a word's panel. */
export function Part({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <Stack as="section" gap={1} label={title}>
      <Text as="h3" caps mono size="sm" tone="faint">
        {title}
      </Text>
      {children}
    </Stack>
  );
}

interface WordLinkProps {
  readonly id: string | null;
  readonly name: string;
  readonly onPick: Pick;
}

/** A word that opens its own panel when it is on the page, else plain text. */
export function WordLink({ id, name, onPick }: WordLinkProps) {
  if (id === null) return <Text>{name}</Text>;
  return (
    <Button
      onClick={() => {
        onPick(id);
      }}
      variant="link"
    >
      {name}
    </Button>
  );
}

function Place({ place, onPick }: { readonly place: TermPlace; readonly onPick: Pick }) {
  const { domain, system, component } = place.where;
  return (
    <ListItem>
      <Stack as="span" gap={1}>
        <Cluster align="baseline" as="span">
          {domain === null ? null : <TextLink href={domain.href}>{domain.name}</TextLink>}
          {system === null ? null : <TextLink href={system.href}>{system.name}</TextLink>}
          {component === null ? null : <Text tone="faint">{component}</Text>}
          {domain === null && system === null ? (
            <Text tone="faint">Not found in the systems</Text>
          ) : null}
        </Cluster>
        <Cluster align="baseline" as="span">
          {place.word === null ? null : (
            <WordLink id={place.word.id} name={place.word.name} onPick={onPick} />
          )}
          {place.fit === null ? null : <TermFitBadge fit={place.fit} />}
        </Cluster>
        {place.note === null ? null : (
          <Text size="sm" tone="faint">
            {place.note}
          </Text>
        )}
      </Stack>
    </ListItem>
  );
}

const placeKey = (p: TermPlace) =>
  `${p.word?.id ?? ''} ${p.where.system?.id ?? p.where.domain?.id ?? ''}`;

/** Where a word lives: domain › system › component, the code's word there, and how well it fits. */
export function Places({
  places,
  onPick,
}: {
  readonly places: readonly TermPlace[];
  readonly onPick: Pick;
}) {
  if (places.length === 0) {
    return (
      <Text as="p" tone="faint">
        Not in the code yet. Anchor it to a word, system or domain in language.yaml.
      </Text>
    );
  }
  return (
    <List dense>
      {places.map((place) => (
        <Place key={placeKey(place)} onPick={onPick} place={place} />
      ))}
    </List>
  );
}

/** What each part of the code calls a word, and where. */
export function Names({ names }: { readonly names: readonly TermName[] }) {
  return (
    <List dense>
      {names.map((name) => (
        <ListItem key={`${name.as} ${name.in}`}>
          <Stack as="span" gap={1}>
            <Cluster align="baseline" as="span">
              <Text tone="strong">{name.as}</Text>
              <Text tone="faint">in {name.in}</Text>
              {name.at === null ? null : (
                <Text mono size="sm" tone="faint">
                  {name.at}
                </Text>
              )}
            </Cluster>
            {name.note === null ? null : (
              <Text size="sm" tone="faint">
                {name.note}
              </Text>
            )}
          </Stack>
        </ListItem>
      ))}
    </List>
  );
}

/** Words this one relates to, each saying how. */
export function Links({
  links,
  onPick,
}: {
  readonly links: readonly TermLink[];
  readonly onPick: Pick;
}) {
  return (
    <List dense>
      {links.map((link) => (
        <ListItem key={`${link.as} ${link.name}`}>
          <Cluster align="baseline" as="span">
            <Text tone="faint">{link.as}</Text>
            <WordLink id={link.id} name={link.name} onPick={onPick} />
          </Cluster>
        </ListItem>
      ))}
    </List>
  );
}

/** A word put to work, in everyday life and at the company. */
export function Examples({ examples }: { readonly examples: TermDetail['examples'] }) {
  return examples.map((example) => (
    <Stack gap={1} key={`${example.context} ${example.analogy ?? example.sentence ?? ''}`}>
      <Text caps size="sm" tone="faint">
        {example.context === 'everyday' ? 'Everyday' : 'At the company'}
      </Text>
      {example.analogy === null ? null : <Text as="p">{example.analogy}</Text>}
      {example.sentence === null ? null : (
        <Text as="p" tone="muted">
          “{example.sentence}”
        </Text>
      )}
    </Stack>
  ));
}
