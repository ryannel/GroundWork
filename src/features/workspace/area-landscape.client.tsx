'use client';

import type { AreaLandscapeView } from '@/application/workspace-landscape-areas';
import { NetworkMap } from '@/ui/network-map.client';

/** The whole company landscape, before the reader has to know a system name. */
export function AreaLandscape({ view }: { readonly view: AreaLandscapeView }) {
  return (
    <NetworkMap label="Areas of activity and the major relationships between them" view={view} />
  );
}
