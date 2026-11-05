import type { ProgrammeRowVM } from '@/application/workspace-work/programme-page';
import { plural } from '@/shared/text';
import { Callout } from '@/ui/callout';
import { PageHeader } from '@/ui/page-header';

import { ProgrammeRows } from './programme-rows';

// The programmes of a workspace: each gathers the plans that serve one outcome.
export function ProgrammesPage({ rows }: { readonly rows: readonly ProgrammeRowVM[] }) {
  const held = rows.filter((row) => row.blocked > 0).length;
  return (
    <>
      <PageHeader
        description="Each programme gathers the plans that serve one outcome, and lands them in order."
        meta={`${plural(rows.length, 'programme')}, ${String(held)} with a plan held up`}
        title="Programmes"
      />
      {rows.length === 0 ? (
        <Callout title="No programmes yet">
          <p>
            A programme lives in the workspace&apos;s repo as{' '}
            <code>programmes/&lt;programme&gt;/programme.yaml</code>; plans join it with{' '}
            <code>meta.programme</code>.
          </p>
        </Callout>
      ) : (
        <ProgrammeRows rows={rows} />
      )}
    </>
  );
}
