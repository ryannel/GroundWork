import { diagramFocus } from '@/application/plan-viz-flow-diagram';
import type { FlowDiagramData } from '@/application/plan-viz-flow-drawn';
import { FlowFigure } from '@/features/plan/viz/flow-diagram/flow-figure';
import { RestNote } from '@/features/plan/viz/flow-diagram/flow-rest';
import { ZoomPane } from '@/features/plan/viz/zoompane/zoom-pane.client';

// The flow's drawing as the viewer shows it: steps are picked by number, not opened. It is drawn once, lit for the
// first stop; the viewer lights whichever stop it shows.
export function StopDiagram({ data }: { readonly data: FlowDiagramData }) {
  return (
    <>
      <ZoomPane focus={diagramFocus(data)} h={data.h} w={data.w} what="the flow">
        <FlowFigure action="go" data={data} />
      </ZoomPane>
      <RestNote fold teams={data.rest} />
    </>
  );
}
