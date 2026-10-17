import { Badge } from '@/ui/badge';
import { List, ListItem } from '@/ui/list';
import { SectionHeading } from '@/ui/section-heading';
import { SplitView } from '@/ui/split-view';
import { Cluster, Stack } from '@/ui/stack';
import { Text } from '@/ui/text';

import { Specimen } from './specimen';

/** How pieces sit together, so a feature lays out its page without CSS of its own. */
export function LayoutSection() {
  return (
    <section>
      <SectionHeading title="Layout">How pieces sit together.</SectionHeading>
      <Specimen name="Stack" use="Things one under another, a step apart.">
        <Stack gap={1}>
          <Text tone="strong">Order</Text>
          <Text tone="muted">Everything a customer buys at one checkout.</Text>
        </Stack>
      </Specimen>
      <Specimen
        name="Cluster"
        use="Things side by side that wrap. Spread puts a title and its button apart."
      >
        <Cluster align="baseline">
          <Text tone="strong">Offer</Text>
          <Badge tone="added">Same in the code</Badge>
        </Cluster>
      </Specimen>
      <Specimen name="SplitView" use="A long list with the picked thing open beside it.">
        <SplitView side={<Text>The picked row, in a panel that stays in view.</Text>}>
          <List dense>
            <ListItem chosen>The picked row</ListItem>
            <ListItem>Another row</ListItem>
          </List>
        </SplitView>
      </Specimen>
    </section>
  );
}
