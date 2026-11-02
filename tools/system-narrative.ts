import { areaNarratives } from '@/application/area-map/narratives';
import { pathIn } from '@/infrastructure/disk';
import { systemNarrativeInputs } from '@/infrastructure/system-narratives';
import { readToday } from '@/infrastructure/today-model';
import { workspaceFolder } from '@/infrastructure/workspace-folders';

const [command, workspace, systemId] = process.argv.slice(2);
if (
  workspace === undefined ||
  systemId === undefined ||
  !['packet', 'check'].includes(command ?? '')
) {
  throw new Error('Usage: system-narrative.ts packet|check <workspace> <system>');
}
const data = await readToday(workspace);
const root = await workspaceFolder(workspace);
const domain = data?.workspace.domains.find((item) =>
  item.systems.some((system) => system.id === systemId),
);
const system = domain?.systems.find((item) => item.id === systemId);
if (root === null || data === null || domain === undefined || system === undefined) {
  throw new Error('Unknown workspace or system');
}
if (command === 'check') {
  const result = areaNarratives(system, data.today.model);
  if (result.notice !== null) throw new Error(result.notice);
  if (result.stories.length === 0) throw new Error('No saved system narratives');
  console.log(
    `${system.name}: ${String(result.stories.length)} current, reference-checked stories`,
  );
} else {
  const inputs = await systemNarrativeInputs(
    pathIn(root, 'domains', domain.id, 'systems', system.id),
    root,
  );
  console.log(
    JSON.stringify(
      {
        instructions:
          'Read docs/system-narratives.md. Interpret the supplied evidence; do not invent execution links. Save narratives.yaml beside system.yaml and run check.',
        system: system.id,
        ...inputs,
      },
      null,
      2,
    ),
  );
}
