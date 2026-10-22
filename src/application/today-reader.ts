// The workspace read as it runs today, outside any plan. Its pages sit under /<workspace>/ beside the
// domains: journeys/, reference/ and things/. The model the browser needs (inspector, palette, hover cards)
// is /<workspace>/model.json, fetched by a relative address so the site works under any base path.

/** How a page reads the model: today only, or a plan beside today. */
export type ReaderMode = 'today' | 'plan';

/** What a drawing needs to know about the page it sits on, as plain data a client component can take. */
export interface Reader {
  readonly mode: ReaderMode;
  /** The model's address relative to the page, for fetch. */
  readonly modelSrc: string;
  /** Where thing pages live, ending in a slash: append a token and a slash. */
  readonly thingBase: string;
  /** What images are cited relative to, ending in a slash: a screen's `assets/cart.svg` resolves against it. */
  readonly assetBase: string;
  /** The plan being read, in plan mode: its screens are where a thing appears. */
  readonly plan?: { readonly workspace: string; readonly slug: string };
  /** Pages of their own beside the thing pages, by id: a system's page under its domain. */
  readonly pages?: Readonly<Record<string, string>>;
}

// A page's depth is how far it sits below /<workspace>/: the landscape is 0, a domain 1, its map 2, a system's
// flow 4.
const todayModelSrc = (depth: number): string => `${'../'.repeat(depth)}model.json`;

/** How deep a pathname is below /<workspace>/, for a layout that wraps pages at several depths. */
export function depthIn(workspace: string, pathname: string): number {
  const parts = pathname.split('/').filter((part) => part !== '');
  const at = parts.indexOf(workspace);
  return at === -1 ? 0 : parts.length - at - 1;
}

export function todayReaderOf(
  workspace: string,
  depth: number,
  pages: Readonly<Record<string, string>> = {},
): Reader {
  return {
    mode: 'today',
    modelSrc: todayModelSrc(depth),
    thingBase: `/${workspace}/things/`,
    assetBase: `/${workspace}/`,
    pages,
  };
}

export const journeysHref = (workspace: string): string => `/${workspace}/journeys/`;

export const journeyHref = (workspace: string, key: string): string =>
  `/${workspace}/journeys/${key}/`;

export const referenceHref = (workspace: string): string => `/${workspace}/reference/`;

export const referenceKindHref = (workspace: string, kind: string): string =>
  `/${workspace}/reference/${kind}/`;
