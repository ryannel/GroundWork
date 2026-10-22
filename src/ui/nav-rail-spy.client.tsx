'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

interface Pair {
  readonly link: HTMLAnchorElement;
  readonly section: HTMLElement;
}

function pairsOf(): Pair[] {
  return [...document.querySelectorAll<HTMLAnchorElement>('a[data-spy]')].flatMap((link) => {
    const id = decodeURIComponent(new URL(link.href).hash.slice(1));
    const section = id === '' ? null : document.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    return section === null ? [] : [{ link, section }];
  });
}

// The rail's links to sections of the page say which section is being read: the last one whose top has
// scrolled above the upper third of the window.
export function RailSpy() {
  const path = usePathname();
  useEffect(() => {
    const pairs = pairsOf();
    const mark = () => {
      const line = window.innerHeight / 3;
      const at = pairs.findLast((pair) => pair.section.getBoundingClientRect().top <= line);
      for (const pair of pairs) {
        if (pair === at) pair.link.setAttribute('aria-current', 'location');
        else pair.link.removeAttribute('aria-current');
      }
    };
    mark();
    window.addEventListener('scroll', mark, { passive: true });
    return () => {
      window.removeEventListener('scroll', mark);
    };
  }, [path]);
  return null;
}
