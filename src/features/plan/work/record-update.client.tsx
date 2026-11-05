'use client';

import { useState } from 'react';

import {
  agentPrompt,
  CONFIDENCES,
  type DraftKind,
  draftEvent,
  eventYaml,
  type ProgressDraft,
  progressCommand,
  SOURCE_KINDS,
  statesFor,
} from '@/application/plan/progress-draft';
import { sourceWord, stateWord } from '@/application/workspace-work/work-card';
import { CopyButton } from '@/features/plan/viz/board/copy-button.client';
import { Button } from '@/ui/button';
import { CodeBlock } from '@/ui/code-block';
import { Select } from '@/ui/select';
import { Text } from '@/ui/text';
import { TextField } from '@/ui/text-field';

import styles from './record-update.module.css';

interface RecordUpdateProps {
  readonly workspace: string;
  readonly plan: string;
  /** What the update may be about: the work item first, then its milestone. */
  readonly subjects: readonly { readonly id: string; readonly label: string }[];
}

const KINDS = [
  { value: 'commitment', label: 'Commitment' },
  { value: 'work', label: 'Progress' },
  { value: 'note', label: 'Note' },
] as const satisfies readonly { readonly value: DraftKind; readonly label: string }[];

const NOT_SAID = { value: '', label: 'Not said' } as const;

const today = (): string => new Date().toISOString().slice(0, 10);

function blank(subject: string): ProgressDraft {
  return {
    at: today(),
    subject,
    kind: 'commitment',
    state: 'proposed',
    promisedFor: '',
    confidence: '',
    saidBy: '',
    sourceKind: 'meeting',
    url: '',
    note: '',
  };
}

function Outputs({
  draft,
  workspace,
  plan,
}: { readonly draft: ProgressDraft } & Omit<RecordUpdateProps, 'subjects'>) {
  const event = draftEvent(draft);
  const command = progressCommand(workspace, plan, event);
  const prompt = agentPrompt(workspace, plan, event);
  return (
    <div className={styles.outputs}>
      <Text size="sm" tone="muted">
        Groundwork only reads. Run the command, or ask an agent, to append the event to plans/{plan}
        /progress.yaml; it is checked as it is written.
      </Text>
      <CodeBlock label="The event">{eventYaml(event)}</CodeBlock>
      <CodeBlock action={<CopyButton text={command}>Copy command</CopyButton>} label="Command">
        {command}
      </CodeBlock>
      <CodeBlock action={<CopyButton text={prompt}>Copy prompt</CopyButton>} label="Agent prompt">
        {prompt}
      </CodeBlock>
    </div>
  );
}

/**
 * Record update: a small form that drafts one progress.yaml event about a partner's work, and gives the command and
 * the agent prompt that append it. Nothing is written from the page.
 */
export function RecordUpdate({ workspace, plan, subjects }: RecordUpdateProps) {
  const first = subjects[0]?.id ?? '';
  const [draft, setDraft] = useState<ProgressDraft | null>(null);
  const handleToggle = () => {
    setDraft(draft === null ? blank(first) : null);
  };
  const set = (patch: Partial<ProgressDraft>) => {
    if (draft !== null) setDraft({ ...draft, ...patch });
  };
  const handleKind = (kind: DraftKind) => {
    set({ kind, state: statesFor(kind)[0] ?? '' });
  };
  return (
    <div className={styles.update}>
      <Button onClick={handleToggle} pressed={draft !== null} size="sm">
        Record update
      </Button>
      {draft === null ? null : (
        <form
          aria-label="Record update"
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <div className={styles.fields}>
            <Select
              shown
              label="Subject"
              onChange={(subject) => {
                set({ subject });
              }}
              options={subjects.map((s) => ({ value: s.id, label: s.label }))}
              value={draft.subject}
            />
            <Select label="Kind" onChange={handleKind} options={KINDS} shown value={draft.kind} />
            {draft.kind === 'note' ? null : (
              <Select
                shown
                label="State"
                onChange={(state) => {
                  set({ state });
                }}
                options={statesFor(draft.kind).map((s) => ({ value: s, label: stateWord(s) }))}
                value={draft.state}
              />
            )}
            {draft.kind === 'commitment' ? (
              <>
                <TextField
                  label="Promised for"
                  onChange={(promisedFor) => {
                    set({ promisedFor });
                  }}
                  type="date"
                  value={draft.promisedFor}
                />
                <Select
                  shown
                  label="Confidence"
                  onChange={(confidence) => {
                    set({ confidence });
                  }}
                  options={[NOT_SAID, ...CONFIDENCES.map((c) => ({ value: c, label: c }))]}
                  value={draft.confidence}
                />
              </>
            ) : null}
            <TextField
              label="Said by"
              onChange={(saidBy) => {
                set({ saidBy });
              }}
              value={draft.saidBy}
            />
            <Select
              shown
              label="Source"
              onChange={(sourceKind) => {
                set({ sourceKind });
              }}
              options={SOURCE_KINDS.map((k) => ({ value: k, label: sourceWord(k) }))}
              value={draft.sourceKind}
            />
            <TextField
              label="Evidence link"
              onChange={(url) => {
                set({ url });
              }}
              type="url"
              value={draft.url}
            />
            <TextField
              label="When"
              onChange={(at) => {
                set({ at });
              }}
              type="date"
              value={draft.at}
            />
          </div>
          <TextField
            label="Note"
            multiline
            onChange={(note) => {
              set({ note });
            }}
            value={draft.note}
          />
          <Outputs draft={draft} plan={plan} workspace={workspace} />
        </form>
      )}
    </div>
  );
}
