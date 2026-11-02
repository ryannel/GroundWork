import { todayData } from '@/infrastructure/today-data';

// How the workspace's systems work today, as a plan-shaped document with no work and so no status, for the
// inspector, palette and hover cards on its pages to derive in the browser.
interface Params {
  readonly workspace: string;
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
