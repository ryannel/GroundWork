'use client';

import Link from 'next/link';
import { type ComponentProps, useState } from 'react';

type IntentLinkProps = Readonly<Omit<ComponentProps<typeof Link>, 'prefetch'>>;

/**
 * An internal link that fetches its page when a pointer, focus or finger reaches it, so the click lands at once.
 * Use it where a page shows many links (lists, prose): plain `Link` would fetch every one as it scrolls into view.
 */
export function IntentLink(props: IntentLinkProps) {
  const [wanted, setWanted] = useState(false);
  const warm = () => {
    setWanted(true);
  };
  return (
    <Link {...props} onFocus={warm} onPointerEnter={warm} onTouchStart={warm} prefetch={wanted} />
  );
}
