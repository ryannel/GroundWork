import { source } from '@/app/source';
import { DocsPage, DocsBody, DocsDescription, DocsTitle } from 'fumadocs-ui/page';
import { notFound } from 'next/navigation';
import type { ComponentProps, FC } from 'react';

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

export default async function Page(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const data = page.data as typeof page.data & DocData;
  const MDX = data.body;

  return (
    <DocsPage toc={data.toc} full={data.full}>
      <DocsTitle>{data.title}</DocsTitle>
      <DocsDescription>{data.description}</DocsDescription>
      <DocsBody>
        <MDX />
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
