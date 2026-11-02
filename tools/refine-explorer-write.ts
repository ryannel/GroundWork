import type { ExplorerPage } from '@/domain/service-explorer';

import type { refinementStore } from './refine-explorer-store';

export async function writeRefinementPages(
  store: Awaited<ReturnType<typeof refinementStore>>,
  pages: readonly { readonly file: string; readonly page: ExplorerPage }[],
): Promise<void> {
  for (let offset = 0; offset < pages.length; offset += 32) {
    await Promise.all(
      pages.slice(offset, offset + 32).map(async (page) => {
        await store.write(page.file, page.page);
      }),
    );
  }
}
