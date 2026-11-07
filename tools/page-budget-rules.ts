// What the page budget judges, apart from fetching the pages: which links lead to pages, which pages are over and
// which weigh most.

/** The unchanged maximum uncompressed HTML size of a page. */
export const PAGE_BYTE_LIMIT = 1024 * 1024;

export interface PageSize {
  /** The page's address: `/volvo-cars/reference/apis/`. */
  readonly page: string;
  readonly bytes: number;
}

export interface Verdict {
  /** The pages over the limit, heaviest first. */
  readonly over: readonly PageSize[];
  /** The heaviest pages, over or not, heaviest first. */
  readonly heaviest: readonly PageSize[];
}

const heaviestFirst = (a: PageSize, b: PageSize): number =>
  a.bytes === b.bytes ? a.page.localeCompare(b.page) : b.bytes - a.bytes;

export function judge(pages: readonly PageSize[], limit: number, top: number): Verdict {
  const sorted = pages.toSorted(heaviestFirst);
  return { over: sorted.filter((p) => p.bytes > limit), heaviest: sorted.slice(0, top) };
}

// Files the site serves beside its pages: plan and today models, pictures, mockups and explorer data.
const FILE = /\.[a-z\d]+$/iu;

/** The pages a page links to on the same site, by path, without their search or hash. Files are left out. */
export function pageLinks(html: string, at: URL): string[] {
  const found = new Set<string>();
  for (const match of html.matchAll(/\bhref="([^"]+)"/gu)) {
    const raw = match[1]?.replaceAll('&amp;', '&') ?? '';
    const url = URL.canParse(raw, at) ? new URL(raw, at) : null;
    if (url !== null && url.origin === at.origin && !FILE.test(url.pathname)) {
      found.add(url.pathname);
    }
  }
  return [...found];
}

export const kilobytes = (bytes: number): string =>
  `${Math.round(bytes / 1024).toLocaleString('en-GB')} KB`;
