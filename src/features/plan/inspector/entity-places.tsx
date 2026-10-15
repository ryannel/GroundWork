import Link from 'next/link';

import type { EntityRef, EntitySource } from '@/application/plan-pages-entity';
import type { EntityPlace } from '@/application/plan-pages-entity-where';
import { Chip, ChipList } from '@/ui/chip';

import styles from './entity-places.module.css';

interface EntityPlacesProps {
  readonly places: readonly EntityPlace[];
  readonly sources: readonly EntitySource[];
  readonly mentionedIn: readonly EntityRef[];
  readonly mentionedParts: readonly string[];
  /** The address of the page being read, so its own place says so. */
  readonly here: string;
}

// The tail of every inspector: where the story tells the thing, the evidence for it, and the prose that cites it.
export function EntityPlaces({
  places,
  sources,
  mentionedIn,
  mentionedParts,
  here,
}: EntityPlacesProps) {
  return (
    <>
      {sources.length === 0 ? null : (
        <details className={styles.fold}>
          <summary>
            Sources <span className={styles.count}>{sources.length}</span>
          </summary>
          <ul className={styles.list}>
            {sources.map((source) => (
              <li key={source.href}>
                <a href={source.href} rel="noreferrer" target="_blank">
                  {source.label} ↗
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
      {places.length === 0 ? null : (
        <details className={styles.fold} open>
          <summary>
            Where this appears <span className={styles.count}>{places.length}</span>
          </summary>
          <ul className={styles.list}>
            {places.map((place) => (
              <li className={styles.place} key={place.href}>
                <span className={styles.where}>{place.label}</span>
                {place.href === here ? (
                  <span aria-current="location">{place.title} (this page)</span>
                ) : (
                  <Link href={place.href}>{place.title}</Link>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
      {mentionedIn.length === 0 && mentionedParts.length === 0 ? null : (
        <section className={styles.mentions}>
          <h4 className={styles.label}>Mentioned in</h4>
          <ChipList>
            {mentionedIn.map((ref) => (
              <Chip
                glyph={ref.glyph}
                id={ref.id}
                key={ref.id}
                label={ref.label}
                status={ref.status}
              />
            ))}
          </ChipList>
          {mentionedParts.length === 0 ? null : (
            <p className={styles.parts}>
              {mentionedIn.length === 0 ? 'The' : 'And the'} plan’s {mentionedParts.join(', ')}
            </p>
          )}
        </section>
      )}
    </>
  );
}
