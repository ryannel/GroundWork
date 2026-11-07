import { currentModelPayload } from '@/application/model-reader';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';

// Inspectors query the supplied current model.
interface Params {
  readonly workspace: string;
}

export async function GET(
  _request: Request,
  { params }: { readonly params: Promise<Params> },
): Promise<Response> {
  const { workspace } = await params;
  const current = await readCanonicalModelIndex(workspace);
  return current === null
    ? new Response('A consolidated model is not available for this workspace', { status: 404 })
    : Response.json(currentModelPayload(current.model));
}
