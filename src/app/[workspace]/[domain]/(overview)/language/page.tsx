import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { domainLanguageOf } from '@/application/language-page';
import { modelDomainOf, modelDomainViewOf } from '@/application/model-domain';
import { modelLanguageOf } from '@/application/model-language';
import { DomainLanguage, DomainTab } from '@/features/workspace';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';

interface Params {
  readonly workspace: string;
  readonly domain: string;
}

// The words the domain owns, read like the workspace's Language page but narrowed to the domain: search them,
// and open one to see what it means, where it lives and what each system calls it.
export const metadata: Metadata = { title: 'Language' };

export default async function DomainLanguageRoute({
  params,
}: {
  readonly params: Promise<Params>;
}) {
  const { workspace: id, domain } = await params;
  const native = await readCanonicalModelIndex(id);
  if (native === null) notFound();
  const current = modelDomainOf(native, domain);
  const view = modelDomainViewOf(native, domain);
  if (current === null || view === null) notFound();
  return (
    <>
      <DomainTab
        says={`The words ${view.name} uses: what each means, where it lives and what each system calls it.`}
        title="Language"
        view={view}
      />
      {current.language === null ? (
        <p>This domain has not written its words down yet.</p>
      ) : (
        <DomainLanguage
          page={domainLanguageOf(
            modelLanguageOf(native),
            current.id,
            current.language.summary ?? null,
          )}
        />
      )}
    </>
  );
}
