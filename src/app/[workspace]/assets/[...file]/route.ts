import {
  contentTypeOf,
  listWorkspaceAssets,
  readWorkspaceAsset,
} from '@/infrastructure/plan-files';
import { readWorkspaces } from '@/infrastructure/workspace-store';

// A workspace's images, served from workspaces/<workspace>/assets/ at the same path, so a screen's
// `assets/cart.svg` resolves against /<workspace>/.
export const dynamic = 'force-static';
export const dynamicParams = false;

interface Params {
  readonly workspace: string;
  readonly file: string[];
}

export async function generateStaticParams(): Promise<Params[]> {
  const workspaces = await readWorkspaces();
  const lists = await Promise.all(
    workspaces.map(async ({ id }) => {
      const files = await listWorkspaceAssets(id);
      return files.map((file) => ({ workspace: id, file }));
    }),
  );
  return lists.flat();
}

export async function GET(_request: Request, { params }: { readonly params: Promise<Params> }) {
  const { workspace, file } = await params;
  const body = await readWorkspaceAsset(workspace, file);
  if (body === null) return new Response('No such file', { status: 404 });
  return new Response(new Uint8Array(body), {
    headers: { 'content-type': contentTypeOf(file.join('/')) },
  });
}
