import { notFound } from 'next/navigation';

import { chipInfo } from '@/application/plan-chips';
import { domainViewOf } from '@/application/workspace-domain';
import { domainWordsOf } from '@/application/workspace-language';
import { DomainOverview } from '@/features/workspace';
import { todayData } from '@/infrastructure/today-data';

interface Params {
  readonly workspace: string;
  readonly domain: string;
}

// The domain at a glance: each system, its edges, its busiest flows and its words.
export default async function DomainRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id, domain } = await params;
  const data = await todayData(id);
  const view = data === null ? null : domainViewOf(data.workspace, data.today.model, domain);
  if (data === null || view === null) notFound();
  const { today } = data;
  const words = domainWordsOf(today.languages, domain);
  return (
    <DomainOverview
      view={view}
      words={
        words === null
          ? null
          : { summary: words.summary, words: words.concepts.map((c) => chipInfo(today.model, c)) }
      }
    />
  );
}
