'use client';

import { usePathname } from 'next/navigation';
import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';

import { countOf } from '@/application/plan-viz-text';
import type { FlowEntry } from '@/application/today-flow-list';
import { IntentLink } from '@/ui/intent-link.client';

import styles from './flow-list.module.css';

/** Past this many flows the list gets a search box. */
const SEARCHABLE = 6;

interface FlowListProps {
  readonly flows: readonly FlowEntry[];
  /** The chosen flow, drawn. */
  readonly children: ReactNode;
}

const trimmed = (path: string): string => path.replace(/\/$/u, '');

function groupsOf(
  flows: readonly FlowEntry[],
): { readonly entry: string; readonly flows: readonly FlowEntry[] }[] {
  const groups = new Map<string, FlowEntry[]>();
  for (const flow of flows) groups.set(flow.entry, [...(groups.get(flow.entry) ?? []), flow]);
  return [...groups].map(([entry, each]) => ({ entry, flows: each }));
}

// Up and down move between the flows shown, as in any list.
function step(event: KeyboardEvent): void {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  if (!(event.currentTarget instanceof HTMLElement)) return;
  const links: Element[] = [...event.currentTarget.querySelectorAll('a')];
  const active = document.activeElement;
  const at = active === null ? -1 : links.indexOf(active);
  const next = links[event.key === 'ArrowDown' ? at + 1 : Math.max(0, at - 1)];
  if (!(next instanceof HTMLElement)) return;
  event.preventDefault();
  next.focus();
}

// The chosen flow stays in sight in the list, and the arrow keys walk it.
function useList(list: RefObject<HTMLDivElement | null>, chosen: string): void {
  useEffect(() => {
    const box = list.current;
    const row = box?.querySelector<HTMLElement>('[aria-current="page"]') ?? null;
    if (box === null || row === null) return;
    const top = row.offsetTop - box.offsetTop;
    if (top < box.scrollTop || top + row.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTo({ top: top - box.clientHeight / 2 });
    }
  }, [list, chosen]);
  useEffect(() => {
    const box = list.current;
    box?.addEventListener('keydown', step);
    return () => box?.removeEventListener('keydown', step);
  }, [list]);
}

// Every flow through the system, grouped by where it comes in, beside the one being read. Each flow has its own
// page, so the system holds as many flows as it runs and the browser fetches only the one chosen.
export function FlowList({ flows, children }: FlowListProps) {
  const path = trimmed(usePathname());
  const chosen = flows.find((flow) => trimmed(flow.href) === path)?.id ?? flows[0]?.id ?? '';
  const [query, setQuery] = useState('');
  const list = useRef<HTMLDivElement>(null);
  useList(list, chosen);
  if (flows.length < 2) return <div className={styles.read}>{children}</div>;
  const words = query.toLowerCase().split(/\s+/u).filter(Boolean);
  const shown = flows.filter((flow) => words.every((word) => flow.terms.includes(word)));
  return (
    <div className={styles.flows}>
      <nav aria-label="Flows" className={styles.side}>
        {flows.length > SEARCHABLE ? (
          <input
            aria-label="Find a flow"
            className={styles.find}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder={`Find among ${countOf(flows.length, 'flow')}`}
            type="search"
            value={query}
          />
        ) : null}
        <div className={styles.list} ref={list}>
          {shown.length === 0 ? <p className={styles.none}>No flow touches that.</p> : null}
          {groupsOf(shown).map((group) => (
            <section className={styles.group} key={group.entry}>
              <h3 className={styles.entry}>
                {group.entry} <span className={styles.count}>{group.flows.length}</span>
              </h3>
              <ul className={styles.rows}>
                {group.flows.map((flow) => (
                  <li key={flow.id}>
                    <IntentLink
                      aria-current={flow.id === chosen ? 'page' : undefined}
                      className={styles.row}
                      href={flow.href}

                      scroll={false}
                    >
                      <span className={styles.name}>{flow.name}</span>
                      <span className={styles.says}>
                        {flow.here === flow.steps
                          ? countOf(flow.steps, 'step')
                          : `${String(flow.here)} of ${countOf(flow.steps, 'step')} here`}
                      </span>
                    </IntentLink>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </nav>
      <div className={styles.read}>{children}</div>
    </div>
  );
}
