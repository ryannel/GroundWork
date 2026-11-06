import type { PlanParams } from '@/infrastructure/plan-data';
import { readPlacementData } from '@/infrastructure/today-model';
import { readPlanState } from '@/infrastructure/workspace-plans';

// The checked plan, the state of its work items, where its work stands and what the plans it builds on added and changed, for the browser
// to work the rest out from. A plan with errors gives its errors instead, which the browser takes as a plan it
// cannot have.
export async function GET(
  _request: Request,
  { params }: { readonly params: Promise<PlanParams> },
): Promise<Response> {
  const { workspace, plan } = await params;
  const state = await readPlanState(workspace, plan);
  if (state === null) return new Response('No such plan', { status: 404 });
  if (state.loaded === null) return Response.json({ errors: state.broken.errors });
  const { loaded } = state;
  return Response.json({
    plan: loaded.plan,
    placements: loaded.base.mode === 'live' ? await readPlacementData(workspace) : {},
    status: loaded.status,
    inherited: loaded.inherited,
    standing: loaded.standing,
  });
}
