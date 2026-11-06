import { FlowCard, FlowCardRow } from '@/ui/flow-card';
import { SectionHeading } from '@/ui/section-heading';

import { EntryCanvasSpecimen } from './entry-canvas-specimen';
import {
  ComponentOverviewSpecimen,
  ExplorerSpecimen,
  SystemOverviewSpecimen,
} from './explorer-specimen.client';
import { Specimen } from './specimen';

export function DiagramsSection() {
  return (
    <section>
      <SectionHeading title="Diagrams">Pieces a diagram places for itself.</SectionHeading>
      <EntryCanvasSpecimen />
      <Specimen
        name="FlowCard"
        use="One stage of a flow diagram and what owns it, sized in advance by a layout."
      >
        <FlowCard href="#flowcard" hub title={['Offer']}>
          <FlowCardRow glyph="sys" inspect="sys:offers" lines={['Offers']} />
          <FlowCardRow
            glyph="sys"
            inspect="sys:site"
            lines={['Website']}
            place="Lives in Shopping"
          />
        </FlowCard>
        <FlowCard href="#flowcard" note="Outside the company" title={['Merchandise']}>
          <FlowCardRow glyph="ext" inspect="ext:cpam" lines={['CPAM']} />
        </FlowCard>
      </Specimen>
      <Specimen
        name="ComponentCard"
        use="Named components in landscape and plan maps. Dense headers retain kind, name and purpose in narrow plan columns. CanvasSystemScope shares one identity tint between a system boundary and its components; icons retain their component-kind colours."
      >
        <ComponentOverviewSpecimen />
      </Specimen>
      <Specimen
        name="SystemCard"
        use="The shared system identity in plan and landscape maps. Select the name or Expand to reveal a boundary with a Collapse control; Details remains a separate action."
      >
        <SystemOverviewSpecimen />
      </Specimen>
      <Specimen
        name="ExplorerCanvas"
        use="Source-backed service boundaries and control flow, with selectable nodes and distinct asynchronous or failure paths."
      >
        <ExplorerSpecimen />
      </Specimen>
    </section>
  );
}
