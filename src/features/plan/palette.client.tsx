'use client';

import { useRouter } from 'next/navigation';
import { Suspense, use, useEffect, useRef, useState, type KeyboardEvent } from 'react';

import type { Outline } from '@/application/plan-pages';
import { paletteEntries, searchPalette, type PaletteEntry } from '@/application/plan-pages-search';
import { Kbd } from '@/ui/kbd';

import { open as openInspector } from './inspector-history';
import styles from './palette.module.css';
import { pendingModel } from './plan-model';

export const PALETTE_EVENT = 'plan:palette';

const STEPS: Readonly<Record<string, number | undefined>> = { ArrowDown: 1, ArrowUp: -1 };

interface ResultsProps {
  readonly src: string;
  readonly outline: Outline;
  readonly done: () => void;
}

function Results({ src, outline, done }: ResultsProps) {
  const router = useRouter();
  const model = use(pendingModel(src).model);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  if (model === null) return <p className={styles.note}>The plan could not be loaded.</p>;
  const found = searchPalette(paletteEntries(model, outline), query);
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
        aria-label="Search the plan"
        className={styles.input}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
        }}
        onKeyDown={onKey}
        placeholder="Find a screen, component, change, decision…"
        ref={input}
        type="search"
        value={query}
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
                {entry.glyph}
              </span>
              <span>{entry.label}</span>
              <span className={styles.hint}>{entry.hint}</span>
            </button>
          </li>
        ))}
        {found.length === 0 ? <li className={styles.note}>Nothing in the plan matches.</li> : null}
      </ul>
    </>
  );
}

// Finds screens and things in the plan from the same model the inspector reads, then goes there.
export function Palette({ src, outline }: { readonly src: string; readonly outline: Outline }) {
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
      <button
        className={styles.trigger}
        onClick={() => {
          setShown(true);
        }}
        type="button"
      >
        Search <Kbd keys="/" />
      </button>
      <dialog
        aria-label="Search the plan"
        className={styles.dialog}
        onClose={() => {
          setShown(false);
        }}
        ref={dialog}
      >
        {shown ? (
          <Suspense fallback={<p className={styles.note}>Loading the plan…</p>}>
            <Results
              done={() => {
                setShown(false);
              }}
              outline={outline}
              src={src}
            />
          </Suspense>
        ) : null}
      </dialog>
    </>
  );
}
