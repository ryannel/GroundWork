import type { Model } from '@/application/plan/derive';
import type { FlowMode } from '@/application/plan/flow-steps';
import { diagramFocus, flowDiagram } from '@/application/plan-viz-flow-diagram';
import { FlowFigure } from '@/features/plan/viz/flow-diagram/flow-figure';
import { RestNote } from '@/features/plan/viz/flow-diagram/flow-rest';
import { ZoomPane } from '@/features/plan/viz/zoompane/zoom-pane.client';

interface StopDiagramProps {
  readonly model: Model;
  readonly flowId: string;
  readonly mode: FlowMode;
  /** The step indices to light; the others read as walked or ahead. */
  readonly indices: readonly number[];
  readonly markers?: Readonly<Record<string, string>> | undefined;
}

// The flow's drawing as the viewer shows it at one stop: steps are picked by number, not opened.
export function StopDiagram({ model, flowId, mode, indices, markers }: StopDiagramProps) {
  const data = flowDiagram(model, flowId, {
    mode,
    step: indices,
    ...(markers === undefined ? {} : { markers }),
  });
  if (data === null) return null;
  return (
    <>
      <ZoomPane focus={diagramFocus(data)} h={data.h} w={data.w} what="the flow">
        <FlowFigure action="go" data={data} />
      </ZoomPane>
      <RestNote fold teams={data.rest} />
    </>
  );
}
