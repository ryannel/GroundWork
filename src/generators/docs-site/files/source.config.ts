import { defineDocs, defineConfig, frontmatterSchema } from 'fumadocs-mdx/config';
import rehypeMermaid from 'rehype-mermaid';
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

// Render fenced ```mermaid blocks to static SVG at BUILD TIME (rehype-mermaid,
// strategy 'inline-svg'). Build-time rendering keeps the site fully static and
// matches GitHub's native rendering of the same fenced block — the content stays
// plain Markdown (dual-render: GitHub + agent cold-read + this site), so a doc
// gets a diagram in all three without MDX components. rehype-mermaid runs after
// the built-in rehype plugins (the `(v) => [...]` form preserves them).
export default defineConfig({
  mdxOptions: {
    rehypePlugins: (v) => [[rehypeMermaid, { strategy: 'inline-svg' }], ...v],
  },
});
