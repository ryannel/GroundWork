'use client';

import { useSyncExternalStore } from 'react';

import type { EntryFlowView, FlowNode } from '@/application/entry-flow';
import { Button } from '@/ui/button';
import { CodeBlock } from '@/ui/code-block';
import {
  EntryBranch,
  EntryCanvas,
  EntryFork,
  EntryGlance,
  EntryGroup,
  EntryNode,
  EntrySequence,
} from '@/ui/entry-canvas';
import { Stack } from '@/ui/stack';
import { Text, TextLink } from '@/ui/text';

const SELECTION_CHANGED = 'groundwork:entry-selection';

function subscribeSelection(change: () => void): () => void {
  globalThis.addEventListener('popstate', change);
  globalThis.addEventListener(SELECTION_CHANGED, change);
  return () => {
    globalThis.removeEventListener('popstate', change);
    globalThis.removeEventListener(SELECTION_CHANGED, change);
  };
}

function selectedInAddress(): string | null {
  return new URLSearchParams(globalThis.location.search).get('step');
}

function selectInAddress(id: string | null): void {
  if (selectedInAddress() === id) return;
  const address = new URL(globalThis.location.href);
  if (id === null) address.searchParams.delete('step');
  else address.searchParams.set('step', id);
  globalThis.history.pushState(null, '', address);
  globalThis.dispatchEvent(new Event(SELECTION_CHANGED));
}

function allNodes(nodes: readonly FlowNode[]): readonly FlowNode[] {
  return nodes.flatMap((node) => [
    node,
    ...node.branches.flatMap((branch) => allNodes(branch.nodes)),
  ]);
}
interface SequenceProps {
  readonly nodes: readonly FlowNode[];
  readonly selected: string | null;
  readonly select: (id: string) => void;
}
function Nodes({ nodes, selected, select }: SequenceProps) {
  return (
    <EntrySequence>
      {nodes.map((node) => (
        <div key={node.id}>
          <EntryNode
            kind={node.kind}
            note={[node.condition, node.async ? 'Asynchronous' : null].filter(Boolean).join(' · ')}
            onSelect={() => {
              select(node.id);
            }}
            selected={selected === node.id}
            title={node.title}
          />
          {node.branches.length === 0 ? null : (
            <EntryGroup
              title={`${node.title} · ${String(node.branches.length)} ${node.branches.length === 1 ? 'branch' : 'branches'}`}
            >
              <EntryFork>
                {node.branches.map((branch) => (
                  <EntryBranch key={branch.label} label={branch.label}>
                    {branch.nodes.length === 0 ? (
                      <Text tone="muted">Carries on below</Text>
                    ) : (
                      <Nodes nodes={branch.nodes} select={select} selected={selected} />
                    )}
                  </EntryBranch>
                ))}
              </EntryFork>
            </EntryGroup>
          )}
        </div>
      ))}
    </EntrySequence>
  );
}
function NodeInspector({ node }: { readonly node: FlowNode | undefined }) {
  if (node === undefined) {
    return (
      <Text as="p" tone="muted">
        Select a node to read its recorded detail, contracts and citations.
      </Text>
    );
  }
  return (
    <Stack gap={4}>
      <Text as="h3" size="lg" weight="strong">
        {node.title}
      </Text>
      <Text mono size="sm">
        {node.id}
      </Text>
      {node.drills.map((drill) => (
        <TextLink href={drill.href} key={drill.href}>
          Follow {drill.label} →
        </TextLink>
      ))}
      <Text as="h3" weight="strong">
        Citations
      </Text>
      {node.citations.length === 0 ? (
        <Text as="p" tone="muted">
          No citation is recorded.
        </Text>
      ) : (
        node.citations.map((cite) =>
          cite.href === null ? (
            <Text key={cite.label} mono size="sm">
              Evidence record: {cite.label}
            </Text>
          ) : (
            <TextLink href={cite.href} key={cite.label}>
              {cite.label}
            </TextLink>
          ),
        )
      )}
      <CodeBlock label="Recorded step">{node.detail}</CodeBlock>
      {node.contract === null ? null : (
        <CodeBlock label="Referenced contract">{node.contract}</CodeBlock>
      )}
    </Stack>
  );
}
export function EntryFlow({ flow }: { readonly flow: EntryFlowView }) {
  const selected = useSyncExternalStore(subscribeSelection, selectedInAddress, () => null);
  const nodes = flow.handlers.flatMap((handler) => [
    ...allNodes(handler.nodes),
    ...handler.failures,
  ]);
  const node = nodes.find((candidate) => candidate.id === selected);
  return (
    <>
      <EntryGlance
        callers={
          flow.callers.length === 0 ? (
            <Text tone="muted">No caller recorded</Text>
          ) : (
            <Stack gap={2}>
              {flow.callers.map((caller) => (
                <Text key={caller.site}>{caller.label}</Text>
              ))}
            </Stack>
          )
        }
        component={<Text weight="strong">{flow.component}</Text>}
        effects={
          flow.effects.length === 0 ? (
            <Text tone="muted">No effect recorded</Text>
          ) : (
            <Stack gap={2}>
              {flow.effects.map((effect) => (
                <Button
                  key={`${effect.site}-${effect.label}`}
                  onClick={() => {
                    selectInAddress(effect.site);
                  }}
                  variant="quiet"
                >
                  {effect.label}
                </Button>
              ))}
            </Stack>
          )
        }
      />
      <EntryCanvas
        active={node !== undefined}
        inspector={
          <Stack>
            <Button
              onClick={() => {
                selectInAddress(null);
              }}
              variant="quiet"
            >
              Close details
            </Button>
            <NodeInspector node={node} />
          </Stack>
        }
      >
        {flow.handlers.length === 0 ? (
          <Text>No handler detail is recorded.</Text>
        ) : (
          <Stack gap={6}>
            {flow.handlers.map((handler) => (
              <EntryGroup key={handler.id} title={handler.summary ?? handler.id}>
                <Nodes nodes={handler.nodes} select={selectInAddress} selected={selected} />
                {handler.failures.length === 0 ? null : (
                  <EntryGroup title="Recorded failures">
                    <Nodes nodes={handler.failures} select={selectInAddress} selected={selected} />
                  </EntryGroup>
                )}
              </EntryGroup>
            ))}
          </Stack>
        )}
      </EntryCanvas>
      {flow.gaps.length === 0 ? null : (
        <Stack gap={2}>
          <Text as="h3" weight="strong">
            Recorded gaps
          </Text>
          {flow.gaps.map((gap) => (
            <Text as="p" key={gap} tone="muted">
              {gap}
            </Text>
          ))}
        </Stack>
      )}
    </>
  );
}
