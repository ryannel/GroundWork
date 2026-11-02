import { readExplorerPage } from '@/infrastructure/service-explorer-files';

interface Params {
  readonly workspace: string;
  readonly file: string;
}
export async function GET(
  _request: Request,
  { params }: { readonly params: Promise<Params> },
): Promise<Response> {
  const { workspace, file } = await params;
  const bytes = await readExplorerPage(workspace, file);
  if (bytes === null) return new Response('No selected explorer page', { status: 404 });
  return new Response(new Uint8Array(bytes), { headers: { 'content-type': 'application/json' } });
}
