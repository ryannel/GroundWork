//   npm run plan:base -- check <slug> [--workspace <id>]
//     Checks the selected plan against its before model and records the facts and ancestors it relies on.
//   npm run plan:base -- land <slug> [--workspace <id>]
//     Retains the exact before model, including repository pins, under base/, then writes the base marker.
//     Explicit ancestors land first. A proposal never becomes a current fact through this command.
import { parseArgs } from 'node:util';

import { selectedWorkspace } from '@/infrastructure/workspace-folders';

import { runModelPlanBase } from './model-plan-base';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { workspace: { type: 'string' } },
});

async function workspaceId(): Promise<string> {
  const found = await selectedWorkspace(values.workspace);
  console.error(`Workspace: ${found.name} (${found.id}) at ${found.folder}`);
  process.env.GROUNDWORK_WORKSPACES = found.folder;
  return found.id;
}

const [command, slug] = positionals;
if ((command !== 'check' && command !== 'land') || slug === undefined) {
  console.error('usage: npm run plan:base -- <check|land> <slug> [--workspace <id>]');
  process.exitCode = 1;
} else {
  const workspace = await workspaceId();
  const native = await runModelPlanBase(command, workspace, slug);
  if (native === null) throw new Error(`A consolidated model is not available for ${workspace}.`);
  console.log(native);
}
