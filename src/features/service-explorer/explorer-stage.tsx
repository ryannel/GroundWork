import { useState } from 'react';

import { focusExplorerPage } from '@/application/explorer-focus';
import type { ExplorerPage } from '@/domain/service-explorer';
import { Button } from '@/ui/button';
import { Callout } from '@/ui/callout';
import { SectionHeading } from '@/ui/section-heading';
import { SplitView } from '@/ui/split-view';
import { Stack } from '@/ui/stack';
import { Text } from '@/ui/text';

import { ExplorerContent } from './explorer-content';
import { ExplorerInspector } from './explorer-inspector';

export function ExplorerStage({
  page,
  data,
  selected,
  onClose,
  onSelect,
  onOpen,
}: {
  readonly page: ExplorerPage | null;
  readonly data: ExplorerPage | null;
  readonly selected: string | null;
  readonly onClose: () => void;
  readonly onSelect: (id: string) => void;
  readonly onOpen: (target: string) => void;
}) {
  const [allOperations, setAllOperations] = useState(false);
  if (page === null) {
    return (
      <Text as="p" tone="muted">
        Loading the selected evidence…
      </Text>
    );
  }
  const drawingPage = allOperations ? page : focusExplorerPage(page, selected);
  const node = page.nodes.find((item) => item.id === selected);
  const overview = page.kind === 'overview' && page.nodes.some((item) => item.kind === 'component');
  return (
    <Stack gap={3}>
      <SectionHeading title={overview ? 'Interfaces and resources' : page.title}>
        {overview
          ? 'Open an entry for its logic, or explore the captured schemas and resources.'
          : page.description}
      </SectionHeading>
      {page.kind === 'flow' ? (
        <Button
          pressed={allOperations}
          onClick={() => {
            setAllOperations(!allOperations);
          }}
        >
          All source operations
        </Button>
      ) : null}
      <SplitView
        side={
          node ? (
            <ExplorerInspector
              data={data}
              node={node}
              onClose={onClose}
              onSelect={onSelect}
              onOpen={onOpen}
              page={page}
            />
          ) : null
        }
      >
        <ExplorerContent
          page={drawingPage}
          selected={selected}
          onSelect={onSelect}
          onOpen={onOpen}
        />
        {page.nodes.length === 0 && page.kind !== 'data' ? (
          <Text as="p" tone="muted">
            No relationships were delivered for this selection. This does not establish that there
            are no callers or dependencies.
          </Text>
        ) : null}
      </SplitView>
      <Text as="p" size="sm" tone="faint">
        {page.completeSelection ? 'Selected evidence delivered' : 'Partial selected evidence'} ·
        source behaviour; runtime and deployment unverified
      </Text>
      {drawingPage.gaps.length > 0 ? (
        <details>
          <summary>
            <Text size="sm" tone="muted">
              Coverage and open boundaries · {drawingPage.gaps.length}
            </Text>
          </summary>
          <Callout title="Selected source evidence">
            {drawingPage.gaps.map((gap) => (
              <Text as="p" key={gap} size="sm">
                {gap}
              </Text>
            ))}
          </Callout>
        </details>
      ) : null}
    </Stack>
  );
}
