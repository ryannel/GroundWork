import { source } from '@/app/source';
import { DocsPage, DocsBody, DocsDescription, DocsTitle } from 'fumadocs-ui/page';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { ComponentProps, FC } from 'react';
import { Mermaid } from '@/components/mermaid';

// MDX components injected into every rendered doc. `Mermaid` resolves the
// `<Mermaid chart="…" />` nodes the remark transform (source.config.ts) emits for fenced
// ```mermaid blocks.
const mdxComponents = { Mermaid };

// The custom title-from-H1 schema (source.config.ts) is a transform, which stops
// createMDXSource from threading the full page-data type through — the inferred
// type degrades to the base PageData (title only). The other fields (description,
// full, and the compiled-MDX runtime fields body + toc) are present at runtime;
// this view restores their types. toc's type is borrowed from DocsPage's own prop.
type DocData = {
  title: string;
  description?: string;
  full?: boolean;
  body: FC;
  toc: ComponentProps<typeof DocsPage>['toc'];
};

// The pristine root docs/ tree ships without an index.md (source.config.ts reads
// it untouched), so the `/docs` root — the empty slug — has no backing page. The
// home route redirects here, so 404ing it would make the whole site look broken
// on first load. Instead, render a generated overview that links into every
// section, derived live from the page list and grouped by the first folder
// segment under /docs (top-level docs fall under "Overview").
function DocsIndex() {
  const groups = new Map<string, { title: string; url: string }[]>();
  for (const page of source.getPages()) {
    const segments = page.url.replace(/^\/docs\/?/, '').split('/');
    const section = segments.length > 1 ? segments[0] : 'Overview';
    const list = groups.get(section) ?? [];
    list.push({ title: page.data.title, url: page.url });
    groups.set(section, list);
  }

  return (
    <DocsPage>
      <DocsTitle><%= navTitle %></DocsTitle>
      <DocsDescription>Project documentation, organized by section.</DocsDescription>
      <DocsBody>
        {[...groups.entries()].map(([section, pages]) => (
          <section key={section}>
            <h2 style={{ textTransform: 'capitalize' }}>{section.replace(/-/g, ' ')}</h2>
            <ul>
              {pages.map((p) => (
                <li key={p.url}>
                  <Link href={p.url}>{p.title}</Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </DocsBody>
    </DocsPage>
  );
}

export default async function Page(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) {
    // Empty slug is the `/docs` root — render the generated overview, not a 404.
    if (!params.slug || params.slug.length === 0) return <DocsIndex />;
    notFound();
  }

  const data = page.data as typeof page.data & DocData;
  const MDX = data.body;

  return (
    <DocsPage toc={data.toc} full={data.full}>
      <DocsTitle>{data.title}</DocsTitle>
      <DocsDescription>{data.description}</DocsDescription>
      <DocsBody>
        <MDX components={mdxComponents} />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) return {};

  const data = page.data as typeof page.data & DocData;
  return {
    title: data.title,
    description: data.description,
  };
}
