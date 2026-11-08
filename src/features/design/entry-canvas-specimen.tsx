import {
  EntryBranch,
  EntryCanvas,
  EntryFork,
  EntryGlance,
  EntryGroup,
  EntryNode,
  EntrySequence,
} from '@/ui/entry-canvas.client';
import { Text } from '@/ui/text';

import { Specimen } from './specimen';

export function EntryCanvasSpecimen() {
  return (
    <Specimen
      name="EntryCanvas"
      use="EntryGlance summarises recorded participants. EntrySequence connects selectable EntryNodes; EntryFork and EntryBranch stack as width narrows. EntryGroup folds detail. The inspector sits beside the canvas and becomes a details sheet on narrow screens."
    >
      <EntryGlance callers="Shop" component="Ordering" effects="Store an order" />
      <EntryCanvas inspector={<Text>Select a node to read its evidence.</Text>}>
        <EntrySequence>
          <EntryNode kind="guard" selected={false} title="Is the order confirmed?" />
          <EntryGroup title="Recorded branches">
            <EntryFork>
              <EntryBranch label="then">
                <EntryNode kind="return" selected={false} title="Return unchanged" />
              </EntryBranch>
              <EntryBranch label="else">
                <EntryNode kind="write" selected title="Store the order" />
              </EntryBranch>
            </EntryFork>
          </EntryGroup>
        </EntrySequence>
      </EntryCanvas>
    </Specimen>
  );
}
