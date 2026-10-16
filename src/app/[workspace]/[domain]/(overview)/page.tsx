import { notFound } from 'next/navigation';

import { domainDiagramOf } from '@/application/domain-diagram';
import { chipInfo } from '@/application/plan-chips';
import { partsFor, type PlanPart } from '@/application/plan-footprint';
import { domainViewOf } from '@/application/workspace-domain';
import { domainWordsOf } from '@/application/workspace-language';
import { DomainOverview } from '@/features/workspace';
import { todayData } from '@/infrastructure/today-data';
import { readLoadedPlans } from '@/infrastructure/workspace-plans';

interface Params {
  readonly workspace: string;
  readonly domain: string;
}

// A plan lands on a domain when it lands on any of its systems; each plan is listed once, its work summed.
function merged(parts: readonly PlanPart[]): PlanPart[] {
  const by = new Map<string, PlanPart>();
  for (const part of parts) {
    const seen = by.get(part.id);
    by.set(
      part.id,
      seen === undefined
        ? part
        : { ...seen, workItems: seen.workItems + part.workItems, done: seen.done + part.done },
    );
  }
  return [...by.values()];
}

// The domain at a glance: its plans, how its systems fit together, each system, its busiest flows and its words.
export default async function DomainRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id, domain } = await params;
  const data = await todayData(id);
  const view = data === null ? null : domainViewOf(data.workspace, data.today.model, domain);
  if (data === null || view === null) notFound();
  const { workspace, today } = data;
  const loaded = await readLoadedPlans(workspace.id);
  const systems = workspace.domains.find((d) => d.id === domain)?.systems ?? [];
  const parts = merged(
    systems.flatMap((s) => partsFor(workspace, { domain, system: s.id }, loaded)),
  );
  const words = domainWordsOf(today.languages, domain);
  return (
    <DomainOverview
      diagram={domainDiagramOf(workspace, today.model, domain)}
      parts={parts}
      view={view}
      words={
        words === null
          ? null
          : { summary: words.summary, words: words.concepts.map((c) => chipInfo(today.model, c)) }
      }
    />
  );
}
