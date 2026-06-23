import { defineDocs, defineConfig, frontmatterSchema } from 'fumadocs-mdx/config';
import { z } from 'zod';

// GroundWork docs ship WITHOUT frontmatter — they are plain Markdown that always
// opens with a single `# H1`. Fumadocs requires every page to have a `title`, and
// the default schema hard-errors when one is missing. So relax `title` to optional
// and derive it from the document's first H1 when frontmatter omits it. This lets
// the site serve the live root docs/ tree (bets included) untouched, with real
// titles in the sidebar and on every page.
//
// Note: the schema function runs before remark, so we read the raw `source`. The
// first `# ` line of a GroundWork doc is always its title; a `#` inside an opening
// code fence is not a case GroundWork docs hit.
export const { docs, meta } = defineDocs({
  // Direct compile-time access to the pristine root docs directory.
  dir: '../../docs',
  docs: {
    schema: (ctx) =>
      frontmatterSchema
        .extend({ title: z.string().optional() })
        .transform(
          (data): { title: string; description?: string; icon?: string; full?: boolean } => {
            const fm = data as {
              title?: string;
              description?: string;
              icon?: string;
              full?: boolean;
            };
            const match = ctx.source.match(/^\s{0,3}#\s+(.+?)\s*#*\s*$/m);
            return {
              title: fm.title ?? (match ? match[1].trim() : 'Untitled'),
              description: fm.description,
              icon: fm.icon,
              full: fm.full,
            };
          }
        ),
  },
});

// Render fenced ```mermaid blocks CLIENT-SIDE, with zero build-time dependency on a
// headless browser. A small remark transform rewrites each `code` node with lang `mermaid`
// into a `<Mermaid chart="…" />` MDX element (resolved from the components map in the docs
// page); the `Mermaid` client component renders it in the browser. We deliberately avoid
// `rehype-mermaid` — it transitively imports `mermaid-isomorphic` → `playwright`, so merely
// importing it makes `next build`/codegen require Playwright even when no diagram renders at
// build. The content stays plain Markdown: GitHub renders the same fenced block natively,
// agents cold-read it, and this site renders it client-side — one source, three readers, no
// MDX components in the content itself.
function remarkMermaid() {
  return (tree: { children?: unknown[] }) => {
    const walk = (node: { children?: unknown[] }) => {
      if (!node || !Array.isArray(node.children)) return;
      node.children = node.children.map((child) => {
        const c = child as { type?: string; lang?: string; value?: string };
        if (c.type === 'code' && c.lang === 'mermaid') {
          return {
            type: 'mdxJsxFlowElement',
            name: 'Mermaid',
            attributes: [
              { type: 'mdxJsxAttribute', name: 'chart', value: c.value ?? '' },
            ],
            children: [],
          };
        }
        return child;
      });
      for (const child of node.children) walk(child as { children?: unknown[] });
    };
    walk(tree);
  };
}

export default defineConfig({
  mdxOptions: {
    remarkPlugins: (v) => [remarkMermaid, ...v],
  },
});
