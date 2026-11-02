import { packAreaMapView } from '@/application/area-map/transport';
import { areaViewOf } from '@/application/workspace-area';
import { readExplorerManifest } from '@/infrastructure/service-explorer-files';
import { todayData } from '@/infrastructure/today-data';
import { readAuthoredLandscape } from '@/infrastructure/workspace-landscape';

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
  const [data, landscape, explorer] = await Promise.all([
    todayData(workspace),
    readAuthoredLandscape(workspace),
    readExplorerManifest(workspace),
  ]);
  if (data === null || landscape === null) return new Response('No such area', { status: 404 });
  const view = areaViewOf({
    workspace: data.workspace,
    model: data.today.model,
    landscape,
    area,
    explorer,
  });
  return view === null
    ? new Response('No such area', { status: 404 })
    : Response.json(packAreaMapView(view));
}
