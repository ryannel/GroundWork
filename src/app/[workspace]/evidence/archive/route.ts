import { readArchiveArtifact } from '@/infrastructure/interpretation-archive';

export async function GET(
  request: Request,
  { params }: { readonly params: Promise<{ readonly workspace: string }> },
): Promise<Response> {
  const { workspace } = await params;
  const query = new URL(request.url).searchParams;
  const repo = query.get('repo');
  const commit = query.get('commit');
  const artifact = query.get('artifact');
  if (repo === null || commit === null || artifact === null) {
    return new Response('A repository, pin and artefact are required.', { status: 400 });
  }
  const bytes = await readArchiveArtifact(workspace, { repo, commit }, artifact);
  return bytes === null
    ? new Response('No such archived artefact.', { status: 404 })
    : new Response(new Uint8Array(bytes), {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
        },
      });
}
