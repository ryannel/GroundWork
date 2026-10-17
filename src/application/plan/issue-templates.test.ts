import { describe, expect, it } from 'vitest';

import {
  BUILTIN_TEMPLATES,
  builtinTemplate,
  fillIssueTemplate,
  issueTitle,
  issueTypeOf,
  parseIssueTemplate,
} from '@/application/plan/issue-templates';

const SECTIONS = { summary: 'S', why: 'W', how: 'H', acceptance: 'A', notes: 'N' };

describe('issue templates', () => {
  it('picks the template from issue_type, defaulting to task', () => {
    expect(issueTypeOf({})).toBe('task');
    expect(issueTypeOf({ issue_type: 'bug' })).toBe('bug');
    expect(issueTypeOf(null)).toBe('task');
    expect(builtinTemplate({ issue_type: 'bug' }).source).toBe('built-in');
  });

  it('prefixes titles once', () => {
    expect(issueTitle(BUILTIN_TEMPLATES.task, 'Add terms')).toBe('[Task] Add terms');
    expect(issueTitle(BUILTIN_TEMPLATES.task, '[Task] Add terms')).toBe('[Task] Add terms');
    expect(issueTitle({ title: '' }, 'Add terms')).toBe('Add terms');
    expect(issueTitle(null, ' Add terms ')).toBe('Add terms');
  });

  it('fills one section per field; unmatched sections go to the last field; empty fields say so', () => {
    expect(fillIssueTemplate(BUILTIN_TEMPLATES.task, SECTIONS)).toBe(
      '### Summary\n\nS\n\n### Why\n\nW\n\n### How\n\nH\n\n### Acceptance Criteria\n\nA\n\n### Notes/Risks\n\nN\n',
    );
    const bug = fillIssueTemplate(BUILTIN_TEMPLATES.bug, SECTIONS);
    expect(bug).toContain('### Repro Steps\n\n_No response_');
    expect(bug).toContain('### Expected vs Actual\n\nA');
    expect(bug.endsWith('### Notes/Risks\n\nN\n\n#### Why\n\nW\n\n#### How\n\nH\n')).toBe(true);
  });

  it('fills a repository form that has no notes field', () => {
    const theirs = parseIssueTemplate({
      name: 'Work',
      body: [
        { type: 'markdown', attributes: { value: 'hi' } },
        { type: 'textarea', id: 'desc', attributes: { label: 'Description' } },
        { type: 'textarea', id: 'ac', attributes: { label: 'Acceptance criteria' } },
      ],
    });
    expect(fillIssueTemplate(theirs, SECTIONS)).toBe(
      '### Description\n\nS\n\n### Acceptance criteria\n\nA\n\n#### Why\n\nW\n\n#### How\n\nH\n\n#### Notes\n\nN\n',
    );
  });

  it('refuses a markdown-style template', () => {
    expect(() => parseIssueTemplate({ name: 'x', about: 'markdown-style' }, 'x.yml')).toThrow(
      /not an issue form/u,
    );
  });
});
