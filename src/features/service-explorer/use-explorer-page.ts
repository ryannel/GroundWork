import { useEffect, useState } from 'react';

import type { ExplorerManifest, ExplorerPage } from '@/domain/service-explorer';

import { loadExplorerPage } from './load-page';

interface LoadedPage {
  readonly file: string | null;
  readonly page: ExplorerPage | null;
  readonly error: string | null;
}
export function useExplorerPage(
  manifest: ExplorerManifest,
  base: string,
  file: string | null,
): LoadedPage {
  const [loaded, setLoaded] = useState<LoadedPage>({ file: null, page: null, error: null });
  useEffect(() => {
    const controller = new AbortController();
    if (file !== null) {
      void loadExplorerPage({ manifest, base, file, signal: controller.signal })
        .then((page) => {
          if (!controller.signal.aborted) setLoaded({ file, page, error: null });
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) {
            setLoaded({
              file,
              page: null,
              error: error instanceof Error ? error.message : 'Evidence unavailable',
            });
          }
        });
    }
    return () => {
      controller.abort();
    };
  }, [manifest, base, file]);
  return loaded.file === file ? loaded : { file, page: null, error: null };
}
