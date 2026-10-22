import type { ReactNode } from 'react';

import type { Model } from '@/application/plan/derive';
import {
  type ColumnView,
  storeContentsOf,
  type TableView,
  type TopicMessageView,
} from '@/application/today-store';
import { plural } from '@/shared/text';
import { Badge } from '@/ui/badge';
import { DataTable } from '@/ui/data-table';
import { Cluster, Stack } from '@/ui/stack';
import { Text } from '@/ui/text';

import { RefChip, RefChips } from './ref-chips';
import styles from './store-contents.module.css';
import { Section } from './today-section';

const COLUMNS = [
  { key: 'name', label: 'Column' },
  { key: 'type', label: 'Type' },
  { key: 'notes', label: 'Notes' },
];

function Notes({ column }: { readonly column: ColumnView }) {
  return (
    <Cluster gap={1}>
      {column.marks.map((m) => (
        <Badge key={m}>{m}</Badge>
      ))}
      {column.ref === null ? null : (
        <>
          <Text tone="muted">points at</Text>
          <RefChip chip={column.ref} />
        </>
      )}
    </Cluster>
  );
}

function Table({ table }: { readonly table: TableView }) {
  return (
    <details className={styles.item}>
      <summary className={styles.head}>
        <RefChip chip={table.chip} />
        <Text tone="muted">{plural(table.columns.length, 'column')}</Text>
      </summary>
      <Stack gap={2}>
        {table.summary === null ? null : <Text tone="muted">{table.summary}</Text>}
        {table.columns.length === 0 ? (
          <Text tone="faint">The model does not list its columns yet.</Text>
        ) : (
          <DataTable
            caption={`The columns of ${table.chip.label}`}
            captionHidden
            columns={COLUMNS}
            rows={table.columns.map((c) => ({
              key: c.name,
              cells: {
                name: <Text mono>{c.name}</Text>,
                type: <Text mono>{c.type}</Text>,
                notes: <Notes column={c} />,
              },
            }))}
          />
        )}
      </Stack>
    </details>
  );
}

function Who({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <Cluster gap={2}>
      <Text size="sm" tone="faint">
        {label}
      </Text>
      {children}
    </Cluster>
  );
}

function Message({ message }: { readonly message: TopicMessageView }) {
  return (
    <div className={styles.item}>
      <Cluster gap={2}>
        <RefChip chip={message.chip} />
        {message.payload === null ? null : (
          <>
            <Text tone="muted">carries</Text>
            <RefChip chip={message.payload} />
          </>
        )}
      </Cluster>
      {message.summary === null ? null : <Text tone="muted">{message.summary}</Text>}
      <Who label="Announced by">
        {message.producer === null ? (
          <Text tone="faint">not known</Text>
        ) : (
          <RefChip chip={message.producer} />
        )}
      </Who>
      <Who label="Heard by">
        {message.consumers.length === 0 ? (
          <Text tone="faint">no one the model knows of</Text>
        ) : (
          <RefChips chips={message.consumers} />
        )}
      </Who>
    </div>
  );
}

/** A store's tables, or the messages on a topic, on the store's page. Nothing for anything else. */
export function StoreContents({ model, id }: { readonly model: Model; readonly id: string }) {
  const contents = storeContentsOf(model, id);
  if (contents === null) return null;
  const { tables, messages } = contents;
  return (
    <>
      {tables.length === 0 ? null : (
        <Section count={tables.length} title="Tables">
          {tables.map((t) => (
            <Table key={t.chip.id} table={t} />
          ))}
        </Section>
      )}
      {messages.length === 0 ? null : (
        <Section count={messages.length} title="Messages on it">
          {messages.map((m) => (
            <Message key={m.chip.id} message={m} />
          ))}
        </Section>
      )}
    </>
  );
}
