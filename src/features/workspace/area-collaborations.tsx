import type { AreaView } from '@/application/workspace-area';
import { FlowCutaways } from '@/ui/flow-cutaways';

/** Small architectural cutaways: one cross-system activity, without pretending it is an end-to-end journey. */
export function AreaCollaborations({ view }: { readonly view: AreaView }) {
  const names = new Map(view.systems.map((system) => [system.id, system.name]));
  return (
    <FlowCutaways
      items={view.collaborations.map((collaboration) => ({
        id: collaboration.id,
        name: collaboration.name,
        summary: collaboration.summary,
        stops: collaboration.systems.map((system) => names.get(system) ?? system),
      }))}
    />
  );
}
