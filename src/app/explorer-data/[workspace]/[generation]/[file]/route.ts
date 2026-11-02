import { readExplorerAsset } from '@/infrastructure/explorer-assets';

// A file of a workspace's installed explorer publication, read from <workspace>/explorer/corpus/<generation>/.
// A generation never changes once published, so the browser may keep it.

interface Params {
  readonly workspace: string;
  readonly generation: string;
  readonly file: string;
}

export async function GET(
  _request: Request,
  { params }: { readonly params: Promise<Params> },
): Promise<Response> {
  const { workspace, generation, file } = await params;
  const bytes = await readExplorerAsset(workspace, generation, file);
  if (bytes === null) return new Response('No such explorer file', { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
