import { planParams, type PlanParams } from '@/infrastructure/plan-data';
import { readLoadedPlan } from '@/infrastructure/workspace-plans';

// The checked plan and the state of its work items, for the browser to work the rest out from.
export const dynamic = 'force-static';
export const dynamicParams = false;

export async function generateStaticParams(): Promise<PlanParams[]> {
  return planParams();
}

export async function GET(_request: Request, { params }: { readonly params: Promise<PlanParams> }) {
  const { workspace, plan } = await params;
  const loaded = await readLoadedPlan(workspace, plan);
  if (loaded === null) return new Response('No such plan', { status: 404 });
  return Response.json({ plan: loaded.plan, status: loaded.status });
}
