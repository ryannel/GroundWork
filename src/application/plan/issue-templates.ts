// GitHub issue-form templates (.github/ISSUE_TEMPLATE/*.yml) and filling them from a work item.
// Pure: the caller reads and parses the template file (YAML) and passes the document in.

import { isRecord, prop } from '@/application/plan/ids';
import type { WorkItem } from '@/domain/plan/plan.generated';

export const ISSUE_TYPES = ['task', 'story', 'feature', 'bug'] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];
const DEFAULT_ISSUE_TYPE: IssueType = 'task';

export interface TemplateField {
  readonly id: string;
  readonly label: string;
  readonly required: boolean;
}

export interface IssueTemplate {
  readonly name: string;
  readonly description: string;
  readonly title: string;
  readonly labels: readonly string[];
  readonly fields: readonly TemplateField[];
  readonly source: string;
}

/** The plan sections an issue body is filled from. */
export interface IssueSections {
  readonly summary?: string;
  readonly why?: string;
  readonly how?: string;
  readonly acceptance?: string;
  readonly notes?: string;
}

const field = (id: string, label: string, required = false): TemplateField => ({
  id,
  label,
  required,
});

const PLANNED = [
  field('summary', 'Summary', true),
  field('why', 'Why'),
  field('how', 'How'),
  field('acceptance-criteria', 'Acceptance Criteria', true),
  field('notes-risks', 'Notes/Risks'),
];

type Template = Omit<IssueTemplate, 'source'>;

/** Built-in copies of the issue forms, for the in-app previews and as the last fallback. */
export const BUILTIN_TEMPLATES: Record<IssueType, Template> = {
  task: {
    name: 'Task',
    description: 'Define a single unit of work.',
    title: '[Task] ',
    labels: ['type:task'],
    fields: PLANNED,
  },
  story: {
    name: 'Story',
    description: 'Capture a specific workflow serving user needs.',
    title: '[Story] ',
    labels: ['type:story'],
    fields: PLANNED,
  },
  feature: {
    name: 'Feature',
    description: 'Propose a distinct product capability serving user needs.',
    title: '[Feature] ',
    labels: ['type:feature'],
    fields: PLANNED,
  },
  bug: {
    name: 'Bug',
    description: 'Report a defect requiring correction.',
    title: '[Bug] ',
    labels: ['type:bug'],
    fields: [
      field('summary', 'Summary', true),
      field('repro-steps', 'Repro Steps', true),
      field('expected-vs-actual', 'Expected vs Actual', true),
      field('notes-risks', 'Notes/Risks'),
    ],
  },
};

/** The work item's issue type (`issue_type`, default task). */
export const issueTypeOf = (wi: Pick<WorkItem, 'issue_type'> | null | undefined): IssueType =>
  wi?.issue_type ?? DEFAULT_ISSUE_TYPE;

/** The built-in template for a work item. */
export const builtinTemplate = (
  wi: Pick<WorkItem, 'issue_type'> | null | undefined,
): IssueTemplate => ({
  ...BUILTIN_TEMPLATES[issueTypeOf(wi)],
  source: 'built-in',
});

const norm = (s: string): string =>
  s
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, '-')
    .replaceAll(/^-|-$/gu, '');

const asText = (v: unknown): string =>
  typeof v === 'string' || typeof v === 'number' ? String(v) : '';

function labelsOf(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw.map(asText) : asText(raw).split(',');
  return list.map((l) => l.trim()).filter((l) => l !== '');
}

function fieldOf(block: unknown): TemplateField[] {
  const label = asText(prop(prop(block, 'attributes'), 'label'));
  if (!isRecord(block) || block.type === 'markdown' || label === '') return [];
  const id = asText(block.id);
  return [
    field(
      id === '' ? norm(label) : id,
      label,
      prop(prop(block, 'validations'), 'required') === true,
    ),
  ];
}

/** Read a GitHub issue-form template from its parsed YAML document. */
export function parseIssueTemplate(doc: unknown, source = ''): IssueTemplate {
  const body = prop(doc, 'body');
  if (!Array.isArray(body)) {
    throw new TypeError(
      `${source === '' ? 'template' : source} is not an issue form (no body list)`,
    );
  }
  return {
    name: asText(prop(doc, 'name')),
    description: asText(prop(doc, 'description')),
    title: asText(prop(doc, 'title')),
    labels: labelsOf(prop(doc, 'labels')),
    fields: body.flatMap(fieldOf),
    source,
  };
}

type SectionKey = keyof IssueSections;

// Which plan section fills a template field, by field id or label.
const SECTION_FOR: Record<string, SectionKey> = {
  summary: 'summary',
  description: 'summary',
  why: 'why',
  motivation: 'why',
  how: 'how',
  implementation: 'how',
  'acceptance-criteria': 'acceptance',
  acceptance: 'acceptance',
  'expected-vs-actual': 'acceptance',
  'notes-risks': 'notes',
  notes: 'notes',
  risks: 'notes',
};

const SECTION_TITLES: Record<SectionKey, string> = {
  summary: 'Summary',
  why: 'Why',
  how: 'How',
  acceptance: 'Acceptance',
  notes: 'Notes',
};

const SECTION_KEYS: SectionKey[] = ['summary', 'why', 'how', 'acceptance', 'notes'];

const sectionOf = (f: TemplateField): SectionKey | undefined =>
  SECTION_FOR[norm(f.id)] ?? SECTION_FOR[norm(f.label)];

const sectionText = (sections: IssueSections, key: SectionKey): string =>
  (sections[key] ?? '').trim();

/** An appended section is a heading under the field, so its own headings step down one level. */
const nested = (text: string): string => text.replaceAll(/^(#{4,5}) /gmu, '$1# ');

/**
 * Issue body in the template's layout: `### Label` per field, as GitHub renders a submitted form.
 * Plan sections no field takes are appended to the notes field (or the last field), so nothing is lost.
 */
export function fillIssueTemplate(
  template: Pick<IssueTemplate, 'fields'> | null,
  sections: IssueSections,
): string {
  const fields =
    template !== null && template.fields.length > 0
      ? template.fields
      : BUILTIN_TEMPLATES.task.fields;
  const used = new Set<SectionKey>();
  const content = fields.map((f) => {
    const key = sectionOf(f);
    if (key === undefined || used.has(key)) return '';
    used.add(key);
    return sectionText(sections, key);
  });
  const leftovers = SECTION_KEYS.filter((k) => !used.has(k) && sectionText(sections, k) !== '');
  if (leftovers.length > 0) {
    const notes = fields.findIndex((f) => sectionOf(f) === 'notes');
    const at = notes === -1 ? fields.length - 1 : notes;
    const extra = leftovers
      .map((k) => `#### ${SECTION_TITLES[k]}\n\n${nested(sectionText(sections, k))}`)
      .join('\n\n');
    content[at] = [content[at], extra].filter((x) => x !== '').join('\n\n');
  }
  const out = fields.map((f, i) => {
    const text = content[i] ?? '';
    return `### ${f.label}\n\n${text === '' ? '_No response_' : text}`;
  });
  return `${out.join('\n\n')}\n`;
}

/** Issue title with the template's prefix, e.g. "[Task] Add the terms endpoint". */
export function issueTitle(template: Pick<IssueTemplate, 'title'> | null, title: string): string {
  const prefix = (template?.title ?? '').trim();
  const t = title.trim();
  return prefix !== '' && !t.startsWith(prefix) ? `${prefix} ${t}` : t;
}
