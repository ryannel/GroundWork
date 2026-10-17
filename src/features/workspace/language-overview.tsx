import { Suspense } from 'react';

import type { LanguagePage } from '@/application/language-page';
import { plural } from '@/shared/text';
import { Callout } from '@/ui/callout';
import { Markdown } from '@/ui/markdown';
import { PageHeader } from '@/ui/page-header';
import { TextLink } from '@/ui/text';

import { LanguageDirectory } from './language-directory.client';

function Source({ source }: { readonly source: LanguagePage['source'] }) {
  if (source === null) return null;
  const status = source.status === null ? '' : ` (${source.status})`;
  return (
    <p>
      From{' '}
      {source.url === null ? source.title : <TextLink href={source.url}>{source.title}</TextLink>}
      {status}.
    </p>
  );
}

/** The words the business has agreed on, anchored to where they live in the systems, and the scan's own words. */
export function LanguageOverview({ page }: { readonly page: LanguagePage }) {
  const keyTerms = page.groups.reduce((n, g) => n + g.terms.length, 0);
  return (
    <>
      <PageHeader
        description="The words the business has agreed on, what the code calls them, and where they live."
        meta={`${plural(keyTerms, 'key term')}, ${plural(page.words.length, 'word')} in the code`}
        title="Language"
      />
      {page.summary === null ? null : <Markdown text={page.summary} />}
      <Source source={page.source} />
      {keyTerms === 0 ? (
        <Callout title="No key terms yet">
          <p>
            Write the words the business has agreed on in <code>language.yaml</code> at the root of
            the workspace, under <code>terms:</code>, and anchor each to the word, system or domain
            it lives in.
          </p>
        </Callout>
      ) : null}
      <Suspense fallback={null}>
        <LanguageDirectory page={page} />
      </Suspense>
    </>
  );
}
