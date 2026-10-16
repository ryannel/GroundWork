import Link from 'next/link';

import type { FlowEntry } from '@/application/today-flow-list';
import { plural } from '@/shared/text';
import { Chip, ChipList } from '@/ui/chip';
import { Markdown } from '@/ui/markdown';

import styles from './domain-previews.module.css';

/** The words a domain owns, as names the inspector opens. */
export interface WordsPreview {
  readonly summary: string;
  readonly words: readonly {
    readonly id: string;
    readonly label: string;
    readonly glyph: string;
  }[];
}

const FLOWS = 6;
const WORDS = 14;

/** The flows with the most steps here, a few of them, and the way to all the rest. */
export function FlowsPreview({
  flows,
  href,
}: {
  readonly flows: readonly FlowEntry[];
  readonly href: string;
}) {
  const busiest = flows
    .toSorted((a, b) => (b.here === a.here ? b.steps - a.steps : b.here - a.here))
    .slice(0, FLOWS);
  return (
    <div className={styles.preview}>
      <ol className={styles.flows}>
        {busiest.map((flow) => (
          <li key={flow.id}>
            <Link className={styles.flow} href={flow.href}>
              <span className={styles.flowName}>{flow.name}</span>
              <span className={styles.quiet}>
                {plural(flow.here, 'step')} here · comes in through {flow.entry}
              </span>
            </Link>
          </li>
        ))}
      </ol>
      {flows.length <= FLOWS ? null : (
        <Link className={styles.more} href={href}>
          All {String(flows.length)} flows →
        </Link>
      )}
    </div>
  );
}

/** What the domain is about in its own words, and the words it owns. */
export function LanguagePreview({
  preview,
  href,
}: {
  readonly preview: WordsPreview;
  readonly href: string;
}) {
  const { summary, words } = preview;
  return (
    <div className={styles.preview}>
      {summary === '' ? null : (
        <div className={styles.summary}>
          <Markdown text={summary} />
        </div>
      )}
      <ChipList>
        {words.slice(0, WORDS).map((word) => (
          <Chip glyph={word.glyph} id={word.id} key={word.id} label={word.label} />
        ))}
      </ChipList>
      <Link className={styles.more} href={href}>
        {words.length <= WORDS
          ? 'What each word means →'
          : `All ${String(words.length)} words, and what each means →`}
      </Link>
    </div>
  );
}
