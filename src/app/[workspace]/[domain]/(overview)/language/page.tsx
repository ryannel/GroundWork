import { notFound } from 'next/navigation';

import { domainLanguageOf, languagePageOf } from '@/application/language-page';
import { domainViewOf } from '@/application/workspace-domain';
import { domainWordsOf } from '@/application/workspace-language';
import { DomainLanguage, DomainTab } from '@/features/workspace';
import { todayData } from '@/infrastructure/today-data';

interface Params {
  readonly workspace: string;
  readonly domain: string;
}

// The words the domain owns, read like the workspace's Language page but narrowed to the domain: search them,
// and open one to see what it means, where it lives and what each system calls it.
export default async function DomainLanguageRoute({
  params,
}: {
  readonly params: Promise<Params>;
}) {
  const { workspace: id, domain } = await params;
  const data = await todayData(id);
  const words = data === null ? null : domainWordsOf(data.today.languages, domain);
  const view = data === null ? null : domainViewOf(data.workspace, data.today.model, domain);
  if (data === null || view === null) notFound();
  const tab = (
    <DomainTab
      says={`The words ${view.name} uses: what each means, where it lives and what each system calls it.`}
      title="Language"
      view={view}
    />
  );
  if (words === null) {
    return (
      <>
        {tab}
        <p>This domain has not written its words down yet.</p>
      </>
    );
  }
  const { workspace, today } = data;
  const page = languagePageOf(workspace, today.languages, today.keyTerms);
  return (
    <>
      {tab}
      <DomainLanguage page={domainLanguageOf(page, domain, words.summary)} />
    </>
  );
}
