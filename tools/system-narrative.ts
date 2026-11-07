import { readCanonicalModelIndex } from '@/infrastructure/model-index';
import { modelNarrativePacket } from '@/infrastructure/model-narratives';
import { selectedWorkspace } from '@/infrastructure/workspace-folders';

const [command, workspace, systemId] = process.argv.slice(2);
if (
  workspace === undefined ||
  systemId === undefined ||
  !['packet', 'check'].includes(command ?? '')
) {
  throw new Error('Usage: system-narrative.ts packet|check <workspace> <system>');
}
const selected = await selectedWorkspace(workspace);
const native = await readCanonicalModelIndex(selected.id);
if (native === null) throw new Error(`No canonical model for ${selected.id}.`);
const packet = modelNarrativePacket(native, systemId);
if (packet === null) throw new Error('Unknown native system');
if (command === 'packet') {
  console.log(
    JSON.stringify(
      {
        instructions:
          'Use schema/workspace.schema.json NarrativesFile format 2. Interpret only these recorded facts; preserve code cites separately from model backs. Save accepted review output beside the actual system file and run check. This deterministic command never calls an LLM.',
        system: packet.input.system.id,
        ...packet,
      },
      null,
      2,
    ),
  );
} else {
  const narrative = native.model.domains
    .flatMap((domain) => domain.systems)
    .find((system) => system.id === packet.input.system.id)?.narratives;
  if (narrative === null || narrative === undefined) {
    throw new Error('No saved native system narratives');
  }
  for (const problem of packet.problems) {
    console.error(`${problem.reference ?? problem.id}: ${problem.message}`);
  }
  if (narrative.basis !== packet.basis) {
    throw new Error(
      'Story needs review: its native input fingerprint differs; saved content is retained and freshness is not established.',
    );
  }
  if (packet.problems.length > 0) {
    throw new Error(
      'Story needs review: a citation, reference or execution backing is unverified.',
    );
  }
  console.log(
    `${packet.input.system.name}: ${String(narrative.stories.length)} current, citation- and backing-checked stories`,
  );
}
