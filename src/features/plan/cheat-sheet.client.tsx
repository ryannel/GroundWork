'use client';

import { useEffect, useRef, useState } from 'react';

import { Badge, type BadgeTone } from '@/ui/badge';
import { Kbd } from '@/ui/kbd';
import { Legend, LEGENDS, type LegendItem } from '@/ui/legend';

import styles from './cheat-sheet.module.css';
import { SHORTCUTS } from './keys';

export const CHEAT_EVENT = 'plan:cheat';

/** Opens or closes the cheat sheet from anywhere: the help button and the ? key. */
export const toggleCheatSheet = (): void => {
  globalThis.dispatchEvent(new Event(CHEAT_EVENT));
};

const THINGS: readonly LegendItem[] = [
  ...LEGENDS.types,
  { glyph: '⇶', label: 'topic' },
  { glyph: '➜', label: 'flow' },
  { glyph: '↳', label: 'step' },
  { glyph: '▭', label: 'field' },
  { glyph: '◫', label: 'screen' },
  { glyph: 'Δ', label: 'change' },
  { glyph: '#', label: 'work item' },
  { glyph: '◆', label: 'milestone' },
  { glyph: '⚖', label: 'decision' },
  { glyph: '⚠', label: 'risk' },
  { glyph: '?', label: 'question' },
  { glyph: '●', label: 'team' },
];

const SYMBOLS: readonly { readonly title: string; readonly items: readonly LegendItem[] }[] = [
  { title: 'Things', items: THINGS },
  { title: 'Lines', items: LEGENDS.map.filter((item) => 'line' in item) },
  { title: 'In the graph', items: LEGENDS.graph },
  { title: 'In this plan', items: LEGENDS.status },
  { title: 'Walking a journey', items: LEGENDS.walk },
];

const STAGES: readonly {
  readonly word: string;
  readonly tone: BadgeTone;
  readonly says: string;
}[] = [
  { word: 'Draft', tone: 'neutral', says: 'still being written' },
  { word: 'In review', tone: 'modified', says: 'being read and discussed' },
  { word: 'Approved', tone: 'added', says: 'the plan’s owner approved it' },
  { word: 'In delivery', tone: 'accent', says: 'work items are filed and under way' },
  { word: 'Delivered', tone: 'added', says: 'every work item is done' },
];

function Sheet() {
  return (
    <>
      <h2 className={styles.heading}>Keyboard shortcuts</h2>
      <dl className={styles.keys}>
        {SHORTCUTS.map((s) => (
          <div className={styles.row} key={s.label}>
            <dt className={styles.combo}>
              {s.keys.map((k) => (
                <Kbd key={k} keys={k} />
              ))}
            </dt>
            <dd className={styles.label}>{s.label}</dd>
          </div>
        ))}
      </dl>
      <h2 className={styles.heading}>Symbols</h2>
      <div className={styles.symbols}>
        {SYMBOLS.map((block) => (
          <Legend items={block.items} key={block.title} title={block.title} />
        ))}
        <ul aria-label="Where a plan stands" className={styles.stages}>
          {STAGES.map((s) => (
            <li className={styles.stage} key={s.word}>
              <Badge tone={s.tone}>{s.word}</Badge> {s.says}
            </li>
          ))}
        </ul>
      </div>
      <p className={styles.note}>
        Click a name to inspect it; rest the pointer on it for its kind and status.
      </p>
    </>
  );
}

// Every key and every symbol the plan viewer uses, in one dialog. ? opens and closes it; Esc closes it.
export function CheatSheet() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const toggle = (): void => {
      setShown((was) => !was);
    };
    globalThis.addEventListener(CHEAT_EVENT, toggle);
    return () => {
      globalThis.removeEventListener(CHEAT_EVENT, toggle);
    };
  }, []);
  useEffect(() => {
    const node = dialog.current;
    if (node === null) return;
    if (shown && !node.open) node.showModal();
    if (!shown && node.open) node.close();
  }, [shown]);
  return (
    <dialog
      aria-label="Keyboard shortcuts and symbols"
      className={styles.dialog}
      onClose={() => {
        setShown(false);
      }}
      ref={dialog}
    >
      <form className={styles.close} method="dialog">
        <button aria-label="Close" className={styles.x} type="submit">
          ✕
        </button>
      </form>
      {shown ? <Sheet /> : null}
    </dialog>
  );
}

const HELP = 'M6.4 6.3a1.7 1.7 0 0 1 3.2.6c0 1.1-1.6 1.4-1.6 2.4M8 11.2v.1';

/** The bar's help button: opens the cheat sheet. */
export function HelpButton() {
  return (
    <button
      aria-label="Keyboard shortcuts and symbols"
      className={styles.help}
      onClick={toggleCheatSheet}
      title="Keyboard shortcuts and symbols (?)"
      type="button"
    >
      <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 16 16" width="15">
        <circle cx="8" cy="8" r="6" />
        <path d={HELP} />
      </svg>
      <span className={styles.helpWord}>Shortcuts</span>
    </button>
  );
}
