import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { modelDomainNavOf, modelDomainOf, modelDomainViewOf } from '@/application/model-domain';
import { modelPlanDomainsOf } from '@/application/model-plan-footprint';
import { ModelTodayOverlays, TodaySearch } from '@/features/plan';
import { DomainPage } from '@/features/workspace';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';
import { readModelPlans } from '@/infrastructure/model-plans';
import { plural } from '@/shared/text';
import { Callout } from '@/ui/callout';

interface Params {
  readonly workspace: string;
  readonly domain: string;
}

interface Props {
  readonly params: Promise<Params>;
  readonly children: ReactNode;
}

// Every page of the domain names the domain after its own title.
export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { workspace: id, domain } = await params;
  const index = await readCanonicalModelIndex(id);
  const name = index === null ? undefined : modelDomainOf(index, domain)?.name;
  return name === undefined ? {} : { title: { default: name, template: `%s · ${name}` } };
}

export default async function DomainLayout({ params, children }: Props) {
  const { workspace: id, domain } = await params;
  const native = await readCanonicalModelIndex(id);
  if (native === null) notFound();
  const view = modelDomainViewOf(native, domain);
  if (view === null) notFound();
  const plans = await readModelPlans(id);
  const footprints = plans.map((plan) => modelPlanDomainsOf(plan, plans, native));
  const count = footprints.filter((footprint) => footprint.domains.includes(view.domainId)).length;
  const unknown = footprints.reduce((total, footprint) => total + footprint.gaps.length, 0);
  return (
    <DomainPage
      nav={modelDomainNavOf(native, view, count)}
      view={view}
      actions={<TodaySearch />}
      overlays={<ModelTodayOverlays index={native} />}
    >
      {children}
      {unknown === 0 ? null : (
        <Callout title="Plan locations still unknown">
          {plural(unknown, 'plan location')} {unknown === 1 ? 'is' : 'are'} not mapped. The plan
          count includes confirmed locations.
        </Callout>
      )}
    </DomainPage>
  );
}
