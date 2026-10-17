import { planParams, type PlanParams } from '@/infrastructure/plan-data';
import { readPlanState } from '@/infrastructure/workspace-plans';
import { NOTHING, orNothing } from '@/shared/static-params';

// The checked plan and the state of its work items, for the browser to work the rest out from. A plan with errors
// gives its errors instead, which the browser takes as a plan it cannot have.
export const dynamic = 'force-static';
export const dynamicParams = false;

export async function generateStaticParams(): Promise<PlanParams[]> {
  return orNothing(await planParams(), { workspace: NOTHING, plan: NOTHING });
}

export async function GET(
  _request: Request,
  { params }: { readonly params: Promise<PlanParams> },
): Promise<Response> {
  const { workspace, plan } = await params;
  const state = await readPlanState(workspace, plan);
  if (state === null) return new Response('No such plan', { status: 404 });
  if (state.loaded === null) return Response.json({ errors: state.broken.errors });
  return Response.json({ plan: state.loaded.plan, status: state.loaded.status });
}
