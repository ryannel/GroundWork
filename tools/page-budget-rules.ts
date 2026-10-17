// What the page budget judges, apart from reading the files: which pages are over and which weigh most.

export interface PageSize {
  /** The page's address in the export: `volvo-cars/reference/apis/`. */
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

/** The page an exported `index.html` serves: its folder, ending in a slash. */
export function pageOf(file: string): string {
  const page = file.replace(/index\.html$/u, '');
  return page === '' ? '/' : page;
}

export const kilobytes = (bytes: number): string =>
  `${Math.round(bytes / 1024).toLocaleString('en-GB')} KB`;
