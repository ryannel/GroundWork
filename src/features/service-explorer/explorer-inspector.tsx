import { useEffect, useRef } from 'react';

import type { ExplorerNode, ExplorerPage } from '@/domain/service-explorer';
import { Button } from '@/ui/button';
import { Cluster, Stack } from '@/ui/stack';
import { Text, TextLink } from '@/ui/text';

import { ExplorerConnections } from './explorer-connections';
import { ExplorerSchema } from './explorer-schema';

function NodeDetail({ detail }: { readonly detail: string }) {
  const text = (
    <Text as="p" size="sm">
      {detail}
    </Text>
  );
  return detail.length > 320 ? (
    <details>
      <summary>Source detail</summary>
      {text}
    </details>
  ) : (
    text
  );
}

export function ExplorerInspector({
  node,
  page,
  data,
  onClose,
  onSelect,
  onOpen,
}: {
  readonly node: ExplorerNode;
  readonly page: ExplorerPage;
  readonly data: ExplorerPage | null;
  readonly onClose: () => void;
  readonly onSelect: (id: string) => void;
  readonly onOpen: (target: string) => void;
}) {
  const inspectionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (globalThis.matchMedia('(width < 72rem)').matches) {
      inspectionRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }, [node.id]);
  const sources = page.sources.filter((source) => node.sourceIds.includes(source.id));
  return (
    <div ref={inspectionRef}>
      <Stack gap={3}>
        <Cluster spread align="start">
          <Text as="h3" tone="strong" weight="strong">
            {node.label}
          </Text>
          <Button label="Close inspection" onClick={onClose} size="sm" variant="quiet">
            Close
          </Button>
        </Cluster>
        <NodeDetail detail={node.detail} />
        {data === null ? null : (
          <Button
            onClick={() => {
              if (node.target !== null) onOpen(node.target);
            }}
          >
            {data.kind === 'data' ? 'Explore schema' : 'Open implementation'}
          </Button>
        )}
        {data !== null && data.kind === 'data' ? (
          <Stack gap={2}>
            <Text as="h3" weight="strong">
              {data.title}
            </Text>
            <Text as="p" size="sm" tone="muted">
              {data.description}
            </Text>
            <ExplorerSchema onOpen={onOpen} page={data} />
            {data.gaps.map((gap) => (
              <Text as="p" key={gap} size="sm" tone="muted">
                {gap}
              </Text>
            ))}
          </Stack>
        ) : null}
        {sources.map((source) => (
          <TextLink href={source.url} key={source.id}>
            {source.label}
          </TextLink>
        ))}
        <ExplorerConnections onSelect={onSelect} page={page} selected={node.id} />
      </Stack>
    </div>
  );
}
