import { endpointExplorerOf } from '@/application/endpoint-explorer';
import { kindOf } from '@/domain/ids';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';

interface Params {
  readonly workspace: string;
}

/** One endpoint's contract, logic and data, so the inspector need not load the whole model. */
export async function GET(
  request: Request,
  { params }: { readonly params: Promise<Params> },
): Promise<Response> {
  const { workspace } = await params;
  const id = new URL(request.url).searchParams.get('id');
  if (id === null || kindOf(id) !== 'endpoint') {
    return new Response('An endpoint id is required', { status: 400 });
  }
  const index = await readCanonicalModelIndex(workspace);
  const view = index === null ? null : endpointExplorerOf(index, id);
  return view === null
    ? new Response('No such endpoint', { status: 404 })
    : Response.json({ endpoint: view });
}
