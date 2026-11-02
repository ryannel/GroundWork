import { contentTypeOf, readWorkspaceAsset } from '@/infrastructure/plan-files';

// A workspace's images, served from workspaces/<workspace>/assets/ at the same path, so a screen's
// `assets/cart.svg` resolves against /<workspace>/.
interface Params {
  readonly workspace: string;
  readonly file: readonly string[];
}

export async function GET(
  _request: Request,
  { params }: { readonly params: Promise<Params> },
): Promise<Response> {
  const { workspace, file } = await params;
  const body = await readWorkspaceAsset(workspace, file);
  if (body === null) return new Response('No such file', { status: 404 });
  return new Response(new Uint8Array(body), {
    headers: { 'content-type': contentTypeOf(file.join('/')) },
  });
}
