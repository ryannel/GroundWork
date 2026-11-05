import { permalinkOf } from '@/domain/code-links';
import type { ExplorerPage, ExplorerSource } from '@/domain/service-explorer';

import type { VisualContext } from './visual-types';

function sources(context: VisualContext, page: ExplorerPage): ExplorerSource[] {
  const ids = new Set(
    [...page.nodes, ...page.links, ...page.fields].flatMap((item) => item.sourceIds),
  );
  const known =
    context.sources ??
    new Map(
      [...context.input.sources, ...context.input.binding.declarations].map((source) => [
        source.id,
        source,
      ]),
    );
  return [...ids].map((id) => {
    const source = known.get(id);
    if (source === undefined) {
      const external = context.externalSources?.find((item) => item.id === id);
      if (external === undefined) throw new Error(`Visual source missing ${id}`);
      return external;
    }
    return {
      id,
      label: `${source.path}:${String(source.lines[0])}`,
      url: permalinkOf(source, { encoding: 'segments', range: 'always' }),
    };
  });
}

function bounded(page: ExplorerPage): ExplorerPage {
  const nodes = page.nodes.slice(0, 100);
  const ids = new Set(nodes.map((node) => node.id));
  const links = page.links.filter((link) => ids.has(link.from) && ids.has(link.to)).slice(0, 200);
  const fields = page.fields.slice(0, 200);
  const omitted =
    page.nodes.length -
    nodes.length +
    page.links.length -
    links.length +
    page.fields.length -
    fields.length;
  return {
    ...page,
    nodes,
    links,
    fields,
    completeSelection: page.completeSelection && omitted === 0,
    gaps:
      omitted === 0
        ? page.gaps
        : [
            ...page.gaps,
            `${String(omitted)} visual records omitted by the page bound; use separate source frames for detail`,
          ],
  };
}

/** UI and AI share exactly these source-backed pages and bounds. */
export function visualPage(
  context: VisualContext,
  input: Omit<ExplorerPage, 'format' | 'snapshot' | 'sources'>,
): ExplorerPage {
  let page: ExplorerPage = bounded({
    ...input,
    format: 'service-explorer-page/v1',
    snapshot: context.snapshot,
    sources: [],
  });
  page = { ...page, sources: sources(context, page) };
  while (
    new TextEncoder().encode(JSON.stringify(page)).byteLength > 64_000 ||
    page.sources.length > 300
  ) {
    if (page.nodes.length === 0 && page.fields.length === 0) {
      throw new Error('Visual metadata exceeds byte bound');
    }
    const nodes = page.nodes.slice(0, Math.max(0, page.nodes.length - 1));
    const ids = new Set(nodes.map((node) => node.id));
    page = {
      ...page,
      nodes,
      links: page.links.filter((link) => ids.has(link.from) && ids.has(link.to)),
      fields: page.fields.slice(0, Math.max(0, page.fields.length - 1)),
      completeSelection: false,
      gaps: page.gaps.includes('Page byte or source-link bound reached; use a smaller frame')
        ? page.gaps
        : [...page.gaps, 'Page byte or source-link bound reached; use a smaller frame'],
    };
    page = { ...page, sources: sources(context, page) };
  }
  return page;
}
