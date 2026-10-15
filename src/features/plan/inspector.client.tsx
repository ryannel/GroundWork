'use client';

import { Suspense, useEffect, useSyncExternalStore } from 'react';

import type { PlanAddress } from '@/application/plan-pages';

import { HoverCard } from './inspector/hover-card.client';
import { Thing } from './inspector/thing.client';
import { usePicked } from './inspector/use-picked';
import { adopt, close, open, openId, serverOpenId, subscribe } from './inspector-history';
import styles from './inspector.module.css';

const onClick = (event: MouseEvent): void => {
  const chip = event.target instanceof Element ? event.target.closest('[data-inspect]') : null;
  const target = chip instanceof HTMLElement ? chip.dataset.inspect : undefined;
  if (target !== undefined) open(target);
};

const onKey = (event: KeyboardEvent): void => {
  const el = event.target;
  if (
    (event.key === 'Enter' || event.key === ' ') &&
    el instanceof HTMLElement &&
    el.getAttribute('role') === 'button' &&
    el.dataset.inspect !== undefined
  ) {
    event.preventDefault();
    open(el.dataset.inspect);
    return;
  }
  if (event.key === 'Escape' && openId() !== null && !document.querySelector('dialog[open]'))
    close();
};

interface InspectorProps {
  /** Where plan.json is, relative to the page. */
  readonly src: string;
  /** Which plan this is, for the addresses of its pages and pictures. */
  readonly plan: PlanAddress;
}

// One host for every chip on the page: a click on [data-inspect] opens that thing, and resting on one shows a
// card. The plan is fetched the first time something asks, and the open id lives in the address hash.
export function Inspector({ src, plan }: InspectorProps) {
  const id = useSyncExternalStore(subscribe, openId, serverOpenId);
  usePicked(id);

  useEffect(() => {
    adopt();
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <>
      <aside
        aria-label="Inspector"
        className={styles.inspector}
        data-inspector=""
        data-open={id === null ? undefined : ''}
      >
        {id === null ? null : (
          <Suspense fallback={<p className={styles.note}>Loading the plan…</p>}>
            <Thing id={id} key={id} plan={plan} src={src} />
          </Suspense>
        )}
      </aside>
      <HoverCard src={src} />
    </>
  );
}
