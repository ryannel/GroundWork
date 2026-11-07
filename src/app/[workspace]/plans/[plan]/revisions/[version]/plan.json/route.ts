import { modelPlanProgressOf } from '@/application/model-progress';
import { selectedPlanPayload } from '@/application/model-reader';
import {
  readModelPlanProgress,
  readSelectedRevisionContext,
} from '@/infrastructure/model-plan-context';
import type { PlanParams } from '@/infrastructure/plan-data';

interface Params extends PlanParams {
  readonly version: string;
}

export async function GET(
  _request: Request,
  { params }: { readonly params: Promise<Params> },
): Promise<Response> {
  const { workspace, plan: slug, version } = await params;
  const selected = await readSelectedRevisionContext(workspace, slug, version);
  if (selected === null) return new Response('No such revision', { status: 404 });
  const progress = await readModelPlanProgress(workspace, slug);
  return Response.json(
    selectedPlanPayload(
      selected,
      `../../../../evidence.json?plan=${encodeURIComponent(slug)}&version=${encodeURIComponent(version)}`,
      progress === null ? undefined : modelPlanProgressOf(progress),
    ),
  );
}
