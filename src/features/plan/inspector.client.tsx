'use client';

import { Suspense, useEffect, useSyncExternalStore } from 'react';

import type { Reader } from '@/application/today-reader';

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

const isPress = (event: KeyboardEvent): boolean => event.key === 'Enter' || event.key === ' ';

const isChip = (el: EventTarget | null): el is HTMLElement =>
  el instanceof HTMLElement &&
  el.getAttribute('role') === 'button' &&
  el.dataset.inspect !== undefined;

const onKey = (event: KeyboardEvent): void => {
  const el = event.target;
  if (isPress(event) && isChip(el) && el.dataset.inspect !== undefined) {
    event.preventDefault();
    open(el.dataset.inspect);
    return;
  }
  if (event.key === 'Escape' && openId() !== null && !document.querySelector('dialog[open]')) {
    close();
  }
};

const loading = (reader: Reader): string =>
  reader.mode === 'plan' ? 'Loading the plan…' : 'Loading how the systems work…';

interface InspectorProps {
  /** Where the model is, relative to the page, and the addresses of its pages and pictures. */
  readonly reader: Reader;
}

// One host for every chip on the page: a click on [data-inspect] opens that thing, and resting on one shows a
// card. The model (a plan, or a workspace today) is fetched the first time something asks, and the open id lives
// in the address hash.
export function Inspector({ reader }: InspectorProps) {
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
          <Suspense fallback={<p className={styles.note}>{loading(reader)}</p>}>
            <Thing id={id} key={id} reader={reader} />
          </Suspense>
        )}
      </aside>
      <HoverCard src={reader.modelSrc} today={reader.mode === 'today'} />
    </>
  );
}
