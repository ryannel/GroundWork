import { Badge } from '@/ui/badge';
import { Callout } from '@/ui/callout';
import { Card } from '@/ui/card';
import { Chip, ChipList } from '@/ui/chip';
import { DataTable } from '@/ui/data-table';
import { Facts } from '@/ui/facts';
import { Kbd } from '@/ui/kbd';
import { Legend } from '@/ui/legend';
import { List, ListItem } from '@/ui/list';
import { Panel } from '@/ui/panel';
import { ProgressBar } from '@/ui/progress-bar';
import { SectionHeading } from '@/ui/section-heading';
import { Swatch } from '@/ui/swatch';
import { Text, TextLink } from '@/ui/text';

import { Specimen } from './specimen';

const TONES = ['neutral', 'accent', 'added', 'modified', 'deprecated', 'removed'] as const;
const SLOTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] as const;

export function WordsSection() {
  return (
    <section>
      <SectionHeading title="Words">How bright, how big and how heavy.</SectionHeading>
      <Specimen
        name="Text"
        use="All words outside a heading: tone, size, weight, mono, caps and a line clamp."
      >
        <Text size="xl">Display</Text>
        <Text size="lg" tone="strong" weight="strong">
          Strong
        </Text>
        <Text>Body</Text>
        <Text tone="muted">Muted</Text>
        <Text tone="faint">Faint</Text>
        <Text tone="accent">Accent</Text>
        <Text mono>mono-id</Text>
        <Text caps size="sm" tone="muted">
          Caps label
        </Text>
      </Specimen>
      <Specimen
        name="TextLink"
        use="A link inside words or a row. Title for the thing a row names."
      >
        <TextLink href="/design/" tone="title">
          Title link
        </TextLink>
        <TextLink href="/design/" tone="accent">
          Accent link
        </TextLink>
        <TextLink href="/design/" tone="quiet">
          Quiet link
        </TextLink>
      </Specimen>
      <Specimen name="Kbd" use="A key to press.">
        <Kbd keys="⌘ K" />
      </Specimen>
    </section>
  );
}

export function StatusSection() {
  return (
    <section>
      <SectionHeading title="Status">
        What state a thing is in. Never by colour alone.
      </SectionHeading>
      <Specimen name="Badge" use="A word of state beside a name.">
        {TONES.map((tone) => (
          <Badge key={tone} tone={tone}>
            {tone}
          </Badge>
        ))}
      </Specimen>
      <Specimen name="Chip" use="A thing in the system that opens in the inspector.">
        <ChipList>
          <Chip glyph="⧉" id="design-orders" label="Orders" />
          <Chip glyph="▣" id="design-api" label="Order API" status="added" />
          <Chip id="design-old" label="Old feed" status="removed" />
        </ChipList>
      </Specimen>
      <Specimen name="ProgressBar" use="How far through something is.">
        <ProgressBar label="Work done" max={10} value={6} />
      </Specimen>
      <Specimen name="Swatch" use="A team colour, always beside its name.">
        {SLOTS.map((slot) => (
          <Swatch key={slot} label={`Slot ${String(slot)}`} slot={slot} />
        ))}
      </Specimen>
      <Specimen name="Legend" use="What the marks on a diagram mean.">
        <Legend
          items={[
            { label: 'Added', swatch: 'add' },
            { label: 'Changed', swatch: 'mod' },
            { label: 'Calls', line: 'solid' },
            { label: 'Publishes', line: 'dashed' },
          ]}
          title="Key"
        />
      </Specimen>
      <Specimen name="Callout" use="Something the reader must see before the content.">
        <Callout title="Note">A note sits in the flow of the page.</Callout>
        <Callout title="Warning" tone="warning">
          A warning asks the reader to act.
        </Callout>
      </Specimen>
    </section>
  );
}

export function HoldersSection() {
  return (
    <section>
      <SectionHeading title="Holders">Things that hold other things.</SectionHeading>
      <Specimen name="List" use="Many rows of one kind. Dense for side panels.">
        <List>
          <ListItem>A row</ListItem>
          <ListItem chosen>The chosen row</ListItem>
          <ListItem>Another row</ListItem>
        </List>
      </Specimen>
      <Specimen name="DataTable" use="Rows with columns worth comparing. Folds when narrow.">
        <DataTable
          caption="Systems"
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'team', label: 'Team' },
          ]}
          rows={[
            { key: 'a', cells: { name: 'Orders', team: 'Checkout' } },
            { key: 'b', cells: { name: 'Offers', team: 'Commerce' } },
          ]}
        />
      </Specimen>
      <Specimen name="Panel" use="A side panel or a boxed group.">
        <Panel title="Panel">
          <Text tone="muted">What the panel holds.</Text>
        </Panel>
      </Specimen>
      <Specimen name="Card" use="One thing to open, in a grid of its kind.">
        <Card href="/design/" title="Card">
          <Facts items={['3 domains', '14 systems']} />
        </Card>
      </Specimen>
      <Specimen name="Facts" use="Short facts in a row: sizes, counts and owners.">
        <Facts items={['3 domains', '14 systems', '2 plans']} />
      </Specimen>
    </section>
  );
}
