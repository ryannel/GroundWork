import { planParams, type PlanParams } from '@/infrastructure/plan-data';
import { contentTypeOf, listPlanFiles, readPlanFile } from '@/infrastructure/plan-files';
import { NOTHING, orNothing } from '@/shared/static-params';

// A plan's mockups, served from workspaces/<workspace>/plans/<plan>/mockups/ at the same path, so the walking mockups
// find ../assets/ where they expect it.
export const dynamic = 'force-static';
export const dynamicParams = false;

interface Params extends PlanParams {
  readonly file: readonly string[];
}

export async function generateStaticParams(): Promise<Params[]> {
  const plans = await planParams();
  const lists = await Promise.all(
    plans.map(async (at) => {
      const files = await listPlanFiles(at.workspace, at.plan, 'mockups');
      return files.map((file) => ({ ...at, file }));
    }),
  );
  return orNothing(lists.flat(), { workspace: NOTHING, plan: NOTHING, file: [NOTHING] });
}

export async function GET(
  _request: Request,
  { params }: { readonly params: Promise<Params> },
): Promise<Response> {
  const { workspace, plan, file } = await params;
  const body = await readPlanFile({ workspace, slug: plan, kind: 'mockups' }, file);
  if (body === null) return new Response('No such file', { status: 404 });
  return new Response(new Uint8Array(body), {
    headers: { 'content-type': contentTypeOf(file.join('/')) },
  });
}
