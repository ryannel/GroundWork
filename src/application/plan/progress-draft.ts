import type { Confidence, SourceKind } from '@/application/plan/work-standing';
import type { ProgressEvent } from '@/domain/model/plan.generated';

// The "Record update" form drafts one progress.yaml event. The site writes nothing: it shows the event as YAML, the
// command that appends it (checked, as every event is) and a prompt that asks an agent to run that command.

export type DraftKind = ProgressEvent['kind'];

const COMMITMENT_STATES = ['proposed', 'accepted', 'declined', 'withdrawn'] as const;
const WORK_STATES = ['not_started', 'in_progress', 'blocked', 'done'] as const;
export const CONFIDENCES: readonly Confidence[] = ['high', 'medium', 'low'];
export const SOURCE_KINDS: readonly SourceKind[] = [
  'meeting',
  'partner-update',
  'document',
  'note',
  'test',
  'scan',
  'github',
];

/** What the form holds; an empty string is a field left blank. */
export interface ProgressDraft {
  readonly at: string;
  readonly subject: string;
  readonly kind: DraftKind;
  readonly state: string;
  readonly promisedFor: string;
  readonly confidence: string;
  readonly saidBy: string;
  readonly sourceKind: string;
  readonly url: string;
  readonly note: string;
}

type EventState = NonNullable<ProgressEvent['state']>;

const EVENT_STATES: readonly EventState[] = [...COMMITMENT_STATES, ...WORK_STATES];

/** The states a kind of event can say: none for a note. */
export function statesFor(kind: DraftKind): readonly string[] {
  if (kind === 'commitment') return COMMITMENT_STATES;
  return kind === 'work' ? WORK_STATES : [];
}

const filled = (text: string): string | null => (text.trim() === '' ? null : text.trim());

function stateOf(draft: ProgressDraft): EventState | null {
  const state = EVENT_STATES.find((each) => each === filled(draft.state));
  return state !== undefined && statesFor(draft.kind).includes(state) ? state : null;
}

function confidenceOf(draft: ProgressDraft): Confidence | null {
  const found = CONFIDENCES.find((c) => c === filled(draft.confidence));
  return draft.kind === 'commitment' && found !== undefined ? found : null;
}

function sourceOf(draft: ProgressDraft): NonNullable<ProgressEvent['source']> | null {
  const kind = SOURCE_KINDS.find((k) => k === filled(draft.sourceKind));
  if (kind === undefined) return null;
  const url = filled(draft.url);
  return url === null ? { kind } : { kind, url };
}

/** The event the form describes, with what does not apply to its kind left out. */
export function draftEvent(draft: ProgressDraft): ProgressEvent {
  const promised = draft.kind === 'commitment' ? filled(draft.promisedFor) : null;
  const state = stateOf(draft);
  const confidence = confidenceOf(draft);
  const saidBy = filled(draft.saidBy);
  const source = sourceOf(draft);
  const note = filled(draft.note);
  return {
    at: filled(draft.at) ?? '',
    subject: draft.subject,
    kind: draft.kind,
    ...(state === null ? {} : { state }),
    ...(promised === null ? {} : { promised_for: promised }),
    ...(confidence === null ? {} : { confidence }),
    ...(saidBy === null ? {} : { said_by: saidBy }),
    ...(source === null ? {} : { source }),
    ...(note === null ? {} : { note }),
  };
}

const PLAIN = /^[A-Za-z_](?:[\w .,@()/+-]|:(?=[^ ]))*$/u;
const RESERVED = new Set(['true', 'false', 'null', 'yes', 'no', 'on', 'off', '~']);

/** A YAML scalar: plain when it reads back as the same string, else single-quoted. */
export function yamlScalar(text: string): string {
  const plain = PLAIN.test(text) && !text.endsWith(' ') && !RESERVED.has(text.toLowerCase());
  return plain ? text : `'${text.replaceAll("'", "''")}'`;
}

/** The event as the list item it becomes under `events:` in progress.yaml. */
export function eventYaml(event: ProgressEvent): string {
  const line = (key: string, value: string | null | undefined, indent = '  '): string[] =>
    value === null || value === undefined ? [] : [`${indent}${key}: ${yamlScalar(value)}`];
  const source =
    event.source === undefined
      ? []
      : [
          '  source:',
          ...line('kind', event.source.kind, '    '),
          ...line('url', event.source.url, '    '),
        ];
  const lines = [
    `- at: ${yamlScalar(event.at)}`,
    ...line('subject', event.subject),
    ...line('kind', event.kind),
    ...line('state', event.state),
    ...line('promised_for', event.promised_for),
    ...line('confidence', event.confidence),
    ...line('said_by', event.said_by),
    ...source,
    ...line('note', event.note),
  ];
  return `${lines.join('\n')}\n`;
}

const SHELL_PLAIN = /^[\w.,:@/+=-]+$/u;

/** One shell word: as it is when nothing in it is special, else single-quoted. */
export function shellWord(text: string): string {
  if (SHELL_PLAIN.test(text)) return text;
  const escaped = text.replaceAll("'", String.raw`'\''`);
  return `'${escaped}'`;
}

/** The command that appends the event, checked, to the plan's progress.yaml. */
export function progressCommand(workspace: string, plan: string, event: ProgressEvent): string {
  const flag = (name: string, value: string | null | undefined): string[] =>
    value === null || value === undefined || value === '' ? [] : [`--${name}`, shellWord(value)];
  return [
    'npm run progress -- add',
    shellWord(workspace),
    shellWord(plan),
    ...flag('subject', event.subject),
    ...flag('kind', event.kind),
    ...flag('state', event.state),
    ...flag('promised-for', event.promised_for),
    ...flag('confidence', event.confidence),
    ...flag('said-by', event.said_by),
    ...flag('source-kind', event.source?.kind),
    ...flag('url', event.source?.url),
    ...flag('note', event.note),
    ...flag('at', event.at),
  ].join(' ');
}

/** What to ask an agent, so it appends the event the same checked way. */
export function agentPrompt(workspace: string, plan: string, event: ProgressEvent): string {
  return [
    `Append this event to plans/${plan}/progress.yaml in workspace ${workspace} using npm run progress, so it is checked as it is written:`,
    '',
    progressCommand(workspace, plan, event),
    '',
    'The event:',
    '',
    eventYaml(event).trimEnd(),
    '',
    'If the command refuses the event, say why and change nothing.',
  ].join('\n');
}
