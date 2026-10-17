import { todayData } from '@/infrastructure/today-data';
import { readWorkspaces } from '@/infrastructure/workspace-store';

// How the workspace's systems work today, as a plan-shaped document with no work and so no status, for the
// inspector, palette and hover cards on its pages to derive in the browser.
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
  return Response.json({ plan: data.today.plan });
}
