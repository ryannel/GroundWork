import Link from 'next/link';

import type { MapDomain, MapPerson } from '@/application/landscape-domains';
import type { MapBox } from '@/application/landscape-domains-layout';
import { plural } from '@/shared/text';

import styles from './landscape-box.module.css';

export type Lit = 'hot' | 'dim' | undefined;

interface Picking {
  /** The person whose journeys are open, if any. */
  readonly picked: string | null;
  readonly onPick: (person: string) => void;
}

/** Puts a box where the drawing says; it is moved with the DOM because a style prop is not allowed. */
function placed(box: MapBox) {
  return (el: HTMLElement | null): void => {
    if (el === null) return;
    el.style.setProperty('left', `${String(box.x)}px`);
    el.style.setProperty('top', `${String(box.y)}px`);
    el.style.setProperty('width', `${String(box.w)}px`);
    el.style.setProperty('height', `${String(box.h)}px`);
  };
}

function PersonChip({ person, picked, onPick }: Picking & { readonly person: MapPerson }) {
  return (
    <li>
      <button
        aria-pressed={picked === person.id}
        className={styles.chip}
        data-shared={person.domains.length > 1 ? '' : undefined}
        onClick={() => {
          onPick(person.id);
        }}
        title={person.summary ?? person.name}
        type="button"
      >
        {person.name}
      </button>
    </li>
  );
}

interface DomainBoxProps extends Picking {
  readonly box: MapBox;
  readonly domain: MapDomain;
  readonly people: readonly MapPerson[];
  readonly lit: Lit;
}

// A domain on the map: its name and purpose, how many systems it runs, and the people who work in it as chips that
// open their journeys. Drawn as HTML over the lines so its text wraps and its links and buttons work.
export function DomainBox({ box, domain, people, lit, picked, onPick }: DomainBoxProps) {
  return (
    <div
      className={styles.box}
      data-box={box.id}
      data-kind="domain"
      data-lit={lit}
      ref={placed(box)}
    >
      <span className={styles.eyebrow}>Domain · {plural(domain.systems, 'system')}</span>
      <Link className={styles.name} href={domain.href}>
        {domain.name}
      </Link>
      {domain.purpose === null ? null : <span className={styles.text}>{domain.purpose}</span>}
      {people.length === 0 ? null : (
        <ul aria-label={`People in ${domain.name}`} className={styles.chips}>
          {people.map((person) => (
            <PersonChip key={person.id} onPick={onPick} person={person} picked={picked} />
          ))}
        </ul>
      )}
    </div>
  );
}

interface CustomerBoxProps extends Picking {
  readonly box: MapBox;
  readonly person: MapPerson;
  readonly lit: Lit;
}

/** The customer, apart from every domain: the one the whole workspace serves. */
export function CustomerBox({ box, person, lit, picked, onPick }: CustomerBoxProps) {
  return (
    <button
      aria-pressed={picked === person.id}
      className={styles.box}
      data-box={box.id}
      data-kind="customer"
      data-lit={lit}
      onClick={() => {
        onPick(person.id);
      }}
      ref={placed(box)}
      type="button"
    >
      <span className={styles.eyebrow}>Customer</span>
      <span className={styles.name}>{person.name}</span>
      {person.summary === null ? null : <span className={styles.text}>{person.summary}</span>}
    </button>
  );
}
