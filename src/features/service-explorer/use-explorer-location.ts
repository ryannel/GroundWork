import { useSyncExternalStore } from 'react';

import {
  explorerLocation,
  explorerSearch,
  type ExplorerLocation,
} from '@/application/explorer-location';
import type { ExplorerManifest } from '@/domain/service-explorer';
import { historyState } from '@/ui/address-bar';

const CHANGE = 'groundwork:explorer-location';

function subscribe(onChange: () => void): () => void {
  globalThis.addEventListener('popstate', onChange);
  globalThis.addEventListener(CHANGE, onChange);
  return () => {
    globalThis.removeEventListener('popstate', onChange);
    globalThis.removeEventListener(CHANGE, onChange);
  };
}

function currentSearch(): string {
  return globalThis.location.search;
}

function navigate(place: ExplorerLocation): void {
  const url = new URL(globalThis.location.href);
  const changedFrame =
    url.searchParams.get('page') !== place.file ||
    url.searchParams.get('service') !== place.component;
  url.search = explorerSearch(place);
  const previous = historyState();
  const preserved = typeof previous === 'object' && previous !== null ? previous : {};
  globalThis.history.pushState({ ...preserved, groundworkExplorerBack: true }, '', url);
  globalThis.dispatchEvent(new Event(CHANGE));
  if (changedFrame) globalThis.scrollTo({ top: 0 });
}

function handleBack(fallback: ExplorerLocation): void {
  const state = historyState();
  if (typeof state !== 'object' || state === null) {
    navigate(fallback);
    return;
  }
  if ('groundworkExplorerBack' in state && state.groundworkExplorerBack === true) {
    globalThis.history.back();
  } else navigate(fallback);
}

export function useExplorerLocation(manifest: ExplorerManifest): {
  readonly place: ExplorerLocation;
  readonly navigate: (place: ExplorerLocation) => void;
  readonly handleBack: (fallback: ExplorerLocation) => void;
} {
  const search = useSyncExternalStore(subscribe, currentSearch, () => '');
  return { place: explorerLocation(manifest, search), navigate, handleBack };
}
