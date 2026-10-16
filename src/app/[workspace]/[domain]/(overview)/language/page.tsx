import { notFound } from 'next/navigation';

import { domainWordsOf } from '@/application/workspace-language';
import { TodayLanguage } from '@/features/plan';
import { todayData } from '@/infrastructure/today-data';

interface Params {
  readonly workspace: string;
  readonly domain: string;
}

// The words the domain owns: what each means, where it is made, and what each system calls it.
export default async function DomainLanguageRoute({
  params,
}: {
  readonly params: Promise<Params>;
}) {
  const { workspace: id, domain } = await params;
  const data = await todayData(id);
  const words = data === null ? null : domainWordsOf(data.today.languages, domain);
  if (data === null) notFound();
  if (words === null) return <p>This domain has not written its words down yet.</p>;
  return <TodayLanguage model={data.today.model} words={words} />;
}
