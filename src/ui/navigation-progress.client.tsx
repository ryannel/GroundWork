'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import styles from './navigation-progress.module.css';

// Every page is drawn on request, so a click on a link can wait on the server. This bar shows at once that the click
// was taken, and keeps the page there until the next one arrives.

/** How long a navigation may run before the bar gives up: a click the router dropped must not spin for ever. */
const GIVE_UP_MS = 60_000;

/** A click that opens a link elsewhere: in a new tab or window, or as a download. */
const opensElsewhere = (event: MouseEvent): boolean =>
  [event.button !== 0, event.metaKey, event.ctrlKey, event.shiftKey, event.altKey].some(Boolean);

/** The anchor a click lands on when it would open in this tab, or null. */
function anchorOf(event: MouseEvent): HTMLAnchorElement | null {
  const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
  if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute('download')) return null;
  return anchor.target === '' || anchor.target === '_self' ? anchor : null;
}

/** The address of the page a plain click on an anchor would open in this tab, or null for any other click. */
export function navigationTarget(event: MouseEvent, here: URL): string | null {
  const anchor = opensElsewhere(event) ? null : anchorOf(event);
  if (anchor === null) return null;
  const to = new URL(anchor.href, here);
  if (to.origin !== here.origin) return null;
  if (to.pathname === here.pathname && to.search === here.search) return null;
  return `${to.pathname}${to.search}`;
}

/** A thin bar across the top while a link's page is on its way. */
export function NavigationProgress() {
  const address = `${usePathname()}?${useSearchParams().toString()}`;
  const [leaving, setLeaving] = useState<string | null>(null);
  const pending = leaving === address;

  useEffect(() => {
    const onClick = (event: MouseEvent): void => {
      const here = new URL(globalThis.location.href);
      if (navigationTarget(event, here) !== null) setLeaving(address);
    };
    // Capture, so the click is seen before the link takes it over for the router.
    document.addEventListener('click', onClick, { capture: true });
    return () => {
      document.removeEventListener('click', onClick, { capture: true });
    };
  }, [address]);

  useEffect(() => {
    const giveUp = (): void => {
      setLeaving(null);
    };
    const timer = pending ? setTimeout(giveUp, GIVE_UP_MS) : undefined;
    return () => {
      clearTimeout(timer);
    };
  }, [pending]);

  return (
    <div
      aria-hidden={!pending}
      aria-label="Loading the page"
      className={styles.bar}
      data-pending={pending ? '' : undefined}
      role="progressbar"
    />
  );
}
