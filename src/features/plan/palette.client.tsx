'use client';

import { useRouter } from 'next/navigation';
import { Suspense, use, useEffect, useRef, useState, type KeyboardEvent } from 'react';

import {
  paletteEntries,
  paletteGroups,
  searchPalette,
  type PaletteEntry,
  type PaletteGroup,
} from '@/application/plan-pages-search';
import { Glyph } from '@/ui/icon';
import { Kbd } from '@/ui/kbd';

import { open as openInspector } from './inspector-history';
import styles from './palette.module.css';
import { pendingModel } from './plan-model';

export const PALETTE_EVENT = 'plan:palette';

const STEPS: Readonly<Record<string, number | undefined>> = { ArrowDown: 1, ArrowUp: -1 };

/** The label with the query's first word marked where it first appears. */
function Marked({ label, query }: { readonly label: string; readonly query: string }) {
  const word = query.trim().split(/\s+/u)[0] ?? '';
  const at = word === '' ? -1 : label.toLowerCase().indexOf(word.toLowerCase());
  if (at < 0) return <span>{label}</span>;
  return (
    <span>
      {label.slice(0, at)}
      <mark className={styles.mark}>{label.slice(at, at + word.length)}</mark>
      {label.slice(at + word.length)}
    </span>
  );
}

interface FiltersProps {
  readonly groups: readonly PaletteGroup[];
  readonly total: number;
  readonly filter: string | null;
  readonly pick: (filter: string | null) => void;
}

function Filters({ groups, total, filter, pick }: FiltersProps) {
  return (
    <div aria-label="Filter by type" className={styles.filters} role="toolbar">
      <button
        aria-pressed={filter === null}
        className={styles.filter}
        onClick={() => {
          pick(null);
        }}
        type="button"
      >
        All <span className={styles.count}>{total}</span>
      </button>
      {groups.map((g) => (
        <button
          aria-pressed={filter === g.key}
          className={styles.filter}
          key={g.key}
          onClick={() => {
            pick(filter === g.key ? null : g.key);
          }}
          type="button"
        >
          <Glyph glyph={g.glyph} />
          {g.label} <span className={styles.count}>{g.count}</span>
        </button>
      ))}
    </div>
  );
}

interface PaletteProps {
  /** Where the model is, relative to the page. */
  readonly src: string;
  /** The pages it can go to, listed before anything is typed. */
  readonly screens: readonly PaletteEntry[];
  /** Today's palette searches the workspace, not a plan. */
  readonly today?: boolean;
  /** Whether it draws its own Search button; without one, `/` and the bar's PaletteButton open it. */
  readonly trigger?: boolean;
}

interface ResultsProps extends Pick<PaletteProps, 'src' | 'screens'> {
  readonly words: Words;
  readonly done: () => void;
}

interface Words {
  readonly what: string;
  readonly loading: string;
  readonly failed: string;
  readonly none: string;
  readonly placeholder: string;
}

const PLAN_WORDS: Words = {
  what: 'Search the plan',
  loading: 'Loading the plan…',
  failed: 'The plan could not be loaded.',
  none: 'Nothing in the plan matches.',
  placeholder: 'Find a screen, component, change, decision…',
};

const TODAY_WORDS: Words = {
  what: 'Search the workspace',
  loading: 'Loading how the systems work…',
  failed: 'How the systems work today could not be loaded.',
  none: 'Nothing in the workspace matches.',
  placeholder: 'Find a page, component, API, event, flow…',
};

function Results({ src, screens, words, done }: ResultsProps) {
  const router = useRouter();
  const model = use(pendingModel(src).model);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [filter, setFilter] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  if (model === null) return <p className={styles.note}>{words.failed}</p>;
  const entries = paletteEntries(model, screens);
  const found = searchPalette(entries, query, filter);
  const choose = (entry: PaletteEntry | undefined): void => {
    if (entry === undefined) return;
    done();
    if (entry.kind === 'screen') router.push(entry.target);
    else openInspector(entry.target);
  };
  const onKey = (event: KeyboardEvent): void => {
    const step = STEPS[event.key] ?? 0;
    if (step !== 0) {
      event.preventDefault();
      setActive(Math.max(0, Math.min(found.length - 1, active + step)));
    } else if (event.key === 'Enter') choose(found[active]);
  };
  return (
    <>
      <input
        aria-controls="palette-results"
        aria-label={words.what}
        className={styles.input}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
        }}
        onKeyDown={onKey}
        placeholder={words.placeholder}
        ref={input}
        type="search"
        value={query}
      />
      <Filters
        filter={filter}
        groups={paletteGroups(entries)}
        pick={(next) => {
          setFilter(next);
          setActive(0);
          input.current?.focus();
        }}
        total={entries.filter((e) => e.kind !== 'part').length}
      />
      <ul className={styles.results} id="palette-results">
        {found.map((entry, index) => (
          <li key={`${entry.kind}-${entry.target}`}>
            <button
              className={styles.result}
              data-active={index === active ? '' : undefined}
              onClick={() => {
                choose(entry);
              }}
              type="button"
            >
              <span aria-hidden="true" className={styles.glyph}>
                <Glyph glyph={entry.glyph} />
              </span>
              <Marked label={entry.label} query={query} />
              <span className={styles.hint}>{entry.hint}</span>
            </button>
          </li>
        ))}
        {found.length === 0 ? <li className={styles.note}>{words.none}</li> : null}
      </ul>
    </>
  );
}

/** The bar's Search button: opens the palette wherever it is mounted. */
export function PaletteButton() {
  return (
    <button
      className={styles.trigger}
      onClick={() => {
        globalThis.dispatchEvent(new Event(PALETTE_EVENT));
      }}
      type="button"
    >
      Search <Kbd keys="/" />
    </button>
  );
}

// Finds screens and things from the same model the inspector reads, then goes there.
export function Palette({ src, screens, today = false, trigger = true }: PaletteProps) {
  const words = today ? TODAY_WORDS : PLAN_WORDS;
  const dialog = useRef<HTMLDialogElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const show = (): void => {
      setShown(true);
    };
    globalThis.addEventListener(PALETTE_EVENT, show);
    return () => {
      globalThis.removeEventListener(PALETTE_EVENT, show);
    };
  }, []);

  useEffect(() => {
    const node = dialog.current;
    if (node === null) return;
    if (shown && !node.open) node.showModal();
    if (!shown && node.open) node.close();
  }, [shown]);

  return (
    <>
      {trigger ? <PaletteButton /> : null}
      <dialog
        aria-label={words.what}
        className={styles.dialog}
        onClose={() => {
          setShown(false);
        }}
        ref={dialog}
      >
        {shown ? (
          <Suspense fallback={<p className={styles.note}>{words.loading}</p>}>
            <Results
              done={() => {
                setShown(false);
              }}
              screens={screens}
              src={src}
              words={words}
            />
          </Suspense>
        ) : null}
      </dialog>
    </>
  );
}
