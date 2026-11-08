import type { ModelPlanParams } from '@/infrastructure/model-plan-data';
import { contentTypeOf, readPlanFile } from '@/infrastructure/plan-files';

// A plan's assets, served from workspaces/<workspace>/plans/<plan>/assets/ at the same path, so the walking mockups
// find ../assets/ where they expect it.
interface Params extends ModelPlanParams {
  readonly file: readonly string[];
}

export async function GET(
  _request: Request,
  { params }: { readonly params: Promise<Params> },
): Promise<Response> {
  const { workspace, plan, file } = await params;
  const body = await readPlanFile({ workspace, slug: plan, kind: 'assets' }, file);
  if (body === null) return new Response('No such file', { status: 404 });
  return new Response(new Uint8Array(body), {
    headers: { 'content-type': contentTypeOf(file.join('/')) },
  });
}
