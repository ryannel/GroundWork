import { packAreaMapView } from '@/application/area-map/transport';
import { modelAreaViewOf } from '@/application/model-area';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';

interface Params {
  readonly workspace: string;
  readonly area: string;
}

/** Read the current area contracts when the reader opens a system or its structure. */
export async function GET(
  _request: Request,
  { params }: { readonly params: Promise<Params> },
): Promise<Response> {
  const { workspace, area } = await params;
  const index = await readCanonicalModelIndex(workspace);
  if (index === null) return new Response('No such area', { status: 404 });
  const view = modelAreaViewOf(index, area);
  return view === null
    ? new Response('No such area', { status: 404 })
    : Response.json(packAreaMapView(view));
}
