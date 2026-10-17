import { planParams, type PlanParams } from '@/infrastructure/plan-data';
import { listRevisions, readRevision, readStatus } from '@/infrastructure/plan-store';
import { NOTHING, orNothing } from '@/shared/static-params';

// A kept revision of the plan, with today's state of its work items, so the inspector can show a thing as it stood.
export const dynamic = 'force-static';
export const dynamicParams = false;

interface Params extends PlanParams {
  readonly version: string;
}

export async function generateStaticParams(): Promise<Params[]> {
  const plans = await planParams();
  const lists = await Promise.all(
    plans.map(async (at) => {
      const versions = await listRevisions(at.workspace, at.plan);
      return versions.map((version) => ({ ...at, version }));
    }),
  );
  return orNothing(lists.flat(), { workspace: NOTHING, plan: NOTHING, version: NOTHING });
}

export async function GET(
  _request: Request,
  { params }: { readonly params: Promise<Params> },
): Promise<Response> {
  const { workspace, plan: slug, version } = await params;
  const { plan, errors } = await readRevision({ workspace, slug, version });
  if (plan === null) return Response.json({ errors });
  return Response.json({ plan, status: await readStatus(workspace, slug) });
}
