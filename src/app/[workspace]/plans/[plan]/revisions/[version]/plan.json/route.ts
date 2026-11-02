import type { PlanParams } from '@/infrastructure/plan-data';
import { readRevision, readStatus } from '@/infrastructure/plan-store';

// A kept revision of the plan, with today's state of its work items, so the inspector can show a thing as it stood.
interface Params extends PlanParams {
  readonly version: string;
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
