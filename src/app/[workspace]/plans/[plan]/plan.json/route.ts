import { modelPlanProgressOf } from '@/application/model-progress';
import { selectedPlanPayload } from '@/application/model-reader';
import {
  readModelPlanProgress,
  readSelectedPlanContext,
} from '@/infrastructure/model-plan-context';
import type { PlanParams } from '@/infrastructure/plan-data';

// Native browsers receive the server's explicit before/after projection.
export async function GET(
  _request: Request,
  { params }: { readonly params: Promise<PlanParams> },
): Promise<Response> {
  const { workspace, plan } = await params;
  const selected = await readSelectedPlanContext(workspace, plan);
  if (selected === null) return new Response('No such plan', { status: 404 });
  const progress = await readModelPlanProgress(workspace, plan);
  return Response.json(
    selectedPlanPayload(
      selected,
      `../../evidence.json?plan=${encodeURIComponent(plan)}`,
      progress === null ? undefined : modelPlanProgressOf(progress),
    ),
  );
}
