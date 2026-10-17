import { todayData } from '@/infrastructure/today-data';
import { readWorkspaces } from '@/infrastructure/workspace-store';

// Who said each fact of today and where in the code, by id, for the thing page to show beside the thing it draws
// in the browser. Kept apart from model.json, which every page fetches.
export const dynamic = 'force-static';
export const dynamicParams = false;

interface Params {
  readonly workspace: string;
}

export async function generateStaticParams(): Promise<Params[]> {
  const workspaces = await readWorkspaces();
  return workspaces.map((workspace) => ({ workspace: workspace.id }));
}

export async function GET(
  _request: Request,
  { params }: { readonly params: Promise<Params> },
): Promise<Response> {
  const { workspace } = await params;
  const data = await todayData(workspace);
  if (data === null) return new Response('No such workspace', { status: 404 });
  return Response.json({ attribution: data.today.attribution });
}
