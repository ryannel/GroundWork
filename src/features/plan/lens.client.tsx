'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, type ReactNode } from 'react';

import { replaceAddress } from '@/ui/address-bar';

// The team lens and the catalogue mode live in the address as `?team=` and `?show=`, so a cut can be shared and
// the page it applies to stays one static file. The server renders the whole page for everyone; these read the
// search on the client and show the matching cut.

/** The search parameter a team lens travels in. */
export const LENS_PARAM = 'team';

/** The team the page is cut to, or null for everyone. */
export function useLens(): string | null {
  return useSearchParams().get(LENS_PARAM);
}

/** A search parameter's value, or null. */
export function useParam(name: string): string | null {
  return useSearchParams().get(name);
}

/** Sets or clears one search parameter in place, without a navigation. */
export function setParam(name: string, value: string | null): void {
  const url = new URL(globalThis.location.href);
  if (value === null) url.searchParams.delete(name);
  else url.searchParams.set(name, value);
  replaceAddress(url);
}

interface ByLensProps {
  /** What everyone sees. */
  readonly everyone: ReactNode;
  /** What each team sees, by team id. A lens with no entry here shows everyone. */
  readonly teams: Readonly<Record<string, ReactNode>>;
}

function Pick({ everyone, teams }: ByLensProps) {
  const lens = useLens();
  const team = lens === null ? undefined : (teams[lens] ?? teams[`team:${lens}`]);
  return (
    <div data-lens={team === undefined ? undefined : (lens ?? undefined)}>{team ?? everyone}</div>
  );
}

// The page for the team in the address, or for everyone. Static output holds the page for everyone.
export function ByLens({ everyone, ...rest }: ByLensProps) {
  return (
    <Suspense fallback={everyone}>
      <Pick everyone={everyone} {...rest} />
    </Suspense>
  );
}

interface DimProps {
  readonly children: ReactNode;
  /** The colour slot of each team id, as its rows and cards carry it. */
  readonly slots: Readonly<Record<string, number>>;
}

/** Dims the rows of every team but the lens's: by the owner a row names, else by the slot it is coloured in. */
export function dimTo(root: HTMLElement, lens: string | null, slots: DimProps['slots']): void {
  const team = lens === null ? undefined : [lens, `team:${lens}`].find((id) => id in slots);
  for (const el of root.querySelectorAll<HTMLElement>(
    '[data-facts-of^="own:"], article[data-slot]',
  )) {
    const owner = el.dataset.factsOf?.slice('own:'.length);
    const mine =
      owner === undefined ? el.dataset.slot === String(slots[team ?? '']) : owner === team;
    el.toggleAttribute('data-dim', team !== undefined && !mine);
  }
}

function Dimmed({ children, slots }: DimProps) {
  const lens = useLens();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (root.current !== null) dimTo(root.current, lens, slots);
  }, [lens, slots]);
  return <div ref={root}>{children}</div>;
}

// A page that only dims the other teams' rows for a lens: drawn once, dimmed on the client, so the file stays small.
export function DimByLens({ children, slots }: DimProps) {
  return (
    <Suspense fallback={children}>
      <Dimmed slots={slots}>{children}</Dimmed>
    </Suspense>
  );
}

const anyModifier = (event: MouseEvent): boolean =>
  event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

const isModified = (event: MouseEvent): boolean => event.button !== 0 || anyModifier(event);

/** Where a plain click on this link should go with the lens kept, or null when it is not a plan link. */
export function carried(link: HTMLAnchorElement, lens: string): string | null {
  const href = link.getAttribute('href');
  if (href === null || !href.startsWith('/') || link.target !== '') return null;
  const url = new URL(href, globalThis.location.href);
  if (!url.pathname.includes('/plans/') || url.searchParams.has(LENS_PARAM)) return null;
  url.searchParams.set(LENS_PARAM, lens);
  return `${url.pathname}${url.search}${url.hash}`;
}

// While a team lens is on, a click on a link to another screen of a plan keeps it.
export function LensCarry() {
  return (
    <Suspense fallback={null}>
      <Carry />
    </Suspense>
  );
}

function Carry() {
  const lens = useLens();
  const router = useRouter();
  useEffect((): (() => void) | undefined => {
    if (lens === null) return;
    const onClick = (event: MouseEvent): void => {
      const link = event.target instanceof Element ? event.target.closest('a') : null;
      if (link === null || isModified(event) || event.defaultPrevented) return;
      const to = carried(link, lens);
      if (to === null) return;
      event.preventDefault();
      event.stopPropagation();
      router.push(to);
    };
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
    };
  }, [lens, router]);
  return null;
}
