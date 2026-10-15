'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import type { PlanCard } from '@/application/plan-footprint';
import { Kbd } from '@/ui/kbd';

import styles from './plan-switch.module.css';

export const PLANS_EVENT = 'plan:plans';

interface PlanSwitchProps {
  readonly plans: readonly PlanCard[];
  /** The plan being read. */
  readonly current: string;
}

const matches = (plan: PlanCard, query: string): boolean =>
  `${plan.title} ${plan.stage}`.toLowerCase().includes(query.trim().toLowerCase());

function Choices({ plans, current, done }: PlanSwitchProps & { readonly done: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  const found = plans.filter((p) => matches(p, query));
  return (
    <>
      <input
        aria-label="Find a plan"
        autoComplete="off"
        className={styles.input}
        onChange={(event) => {
          setQuery(event.target.value);
        }}
        onKeyDown={(event) => {
          const first = found[0];
          if (event.key !== 'Enter' || first === undefined) return;
          done();
          router.push(first.href);
        }}
        placeholder="Find a plan…"
        ref={input}
        type="search"
        value={query}
      />
      <ul className={styles.list}>
        {found.map((p) => (
          <li key={p.id}>
            <Link
              aria-current={p.id === current ? 'page' : undefined}
              className={styles.plan}
              href={p.href}
              onClick={done}
            >
              <span className={styles.title}>{p.title}</span>
              <span className={styles.stage}>{p.stage}</span>
            </Link>
          </li>
        ))}
        {found.length === 0 ? <li className={styles.none}>No plan matches.</li> : null}
      </ul>
    </>
  );
}

// Every plan in the workspace, a click or ⌘⇧P away: the caret beside the plan's name opens it.
export function PlanSwitch({ plans, current }: PlanSwitchProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const show = (): void => {
      setShown(true);
    };
    globalThis.addEventListener(PLANS_EVENT, show);
    return () => {
      globalThis.removeEventListener(PLANS_EVENT, show);
    };
  }, []);
  useEffect(() => {
    const node = dialog.current;
    if (node === null) return;
    if (shown && !node.open) node.showModal();
    if (!shown && node.open) node.close();
  }, [shown]);
  const done = (): void => {
    setShown(false);
  };
  return (
    <>
      <button
        aria-label="Switch plan"
        className={styles.trigger}
        onClick={() => {
          setShown(true);
        }}
        title="Switch plan (⌘⇧P)"
        type="button"
      >
        <span aria-hidden="true" className={styles.caret} />
      </button>
      <dialog aria-label="Switch plan" className={styles.dialog} onClose={done} ref={dialog}>
        {shown ? (
          <>
            <p className={styles.head}>
              Plans in this workspace <Kbd keys="⌘⇧P" />
            </p>
            <Choices current={current} done={done} plans={plans} />
          </>
        ) : null}
      </dialog>
    </>
  );
}
