import { kindOf } from '@/domain/ids';
import { readModelEvidence } from '@/infrastructure/model-evidence';

interface Params {
  readonly workspace: string;
}

/** Evidence omitted from the initial browser view remains available through its actual persisted id. */
export async function GET(
  request: Request,
  { params }: { readonly params: Promise<Params> },
): Promise<Response> {
  const { workspace } = await params;
  const id = new URL(request.url).searchParams.get('id');
  if (id === null || kindOf(id) !== 'evidence') {
    return new Response('An evidence id is required', { status: 400 });
  }
  const query = new URL(request.url).searchParams;
  const plan = query.get('plan');
  const version = query.get('version');
  if (version !== null && plan === null) {
    return new Response('A revision requires a plan', { status: 400 });
  }
  const scope = plan === null ? undefined : { plan, ...(version === null ? {} : { version }) };
  const inspection = await readModelEvidence(workspace, id, scope);
  return inspection === null
    ? new Response('No such evidence record', { status: 404 })
    : Response.json({ inspection });
}
