import { planParams, type PlanParams } from '@/infrastructure/plan-data';
import { contentTypeOf, listPlanFiles, readPlanFile } from '@/infrastructure/plan-files';

// A plan's assets, served from workspaces/<workspace>/plans/<plan>/assets/ at the same path, so the walking mockups
// find ../assets/ where they expect it.
export const dynamic = 'force-static';
export const dynamicParams = false;

interface Params extends PlanParams {
  readonly file: string[];
}

export async function generateStaticParams(): Promise<Params[]> {
  const plans = await planParams();
  const lists = await Promise.all(
    plans.map(async (at) => {
      const files = await listPlanFiles(at.workspace, at.plan, 'assets');
      return files.map((file) => ({ ...at, file }));
    }),
  );
  return lists.flat();
}

export async function GET(_request: Request, { params }: { readonly params: Promise<Params> }) {
  const { workspace, plan, file } = await params;
  const body = await readPlanFile({ workspace, slug: plan, kind: 'assets' }, file);
  if (body === null) return new Response('No such file', { status: 404 });
  return new Response(new Uint8Array(body), {
    headers: { 'content-type': contentTypeOf(file.join('/')) },
  });
}
