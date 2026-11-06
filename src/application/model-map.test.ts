import { describe, expect, it } from 'vitest';

import { emptyQueryModel, queryModel } from '@/../test/fixtures/model-queries';

import { indexOf } from './model-index';
import { modelCounts, modelMarkdownOf } from './model-map';

describe('canonical map inventories', () => {
  it('counts every category including an empty workspace', () => {
    expect(modelCounts(indexOf(emptyQueryModel()))).toEqual({
      domains: 0,
      systems: 0,
      components: 0,
      entries: 0,
      handlers: 0,
      steps: 0,
      evidence: 0,
      edges: 0,
      gaps: 0,
    });
    expect(modelMarkdownOf(indexOf(emptyQueryModel()))).toBe(
      '# Query fixture: system map\n\n\n## Recorded exchanges\n\n\n## Gaps\n',
    );
    expect(modelCounts(indexOf(queryModel()))).toEqual({
      domains: 1,
      systems: 3,
      components: 4,
      entries: 4,
      handlers: 1,
      steps: 4,
      evidence: 0,
      edges: 8,
      gaps: 6,
    });
  });
  it('prints recorded components, exact exchanges and gaps, with whole-repo and folder homes', () => {
    const markdown = modelMarkdownOf(indexOf(queryModel()));
    expect(markdown).toContain('### A (`sys:a`)\n\n- `svc:a` A — fixture/a/');
    expect(markdown).toContain('### B (`sys:b`)\n\n- `svc:b` B — fixture/b/worker');
    expect(markdown).toContain('### Unmapped (`sys:unmapped`)\n');
    expect(markdown).toContain('- `svc:a` → `st:remote`: read via `sch:remote#id` at `h:a#read`.');
    expect(markdown).toContain(
      '- `top:remote` → `svc:a`: consume via `top:remote` at `rel:consume`.',
    );
    expect(markdown).toContain('- `job:b`: No schedule or trigger is recorded.');
    expect(markdown).toContain('- `top:remote`: No cited resource owner is recorded.');
    expect(markdown).toBe(
      '# Query fixture: system map\n\n\n## Queries (`dom:queries`)\n\n### A (`sys:a`)\n\n- `svc:a` A — fixture/a/\n\n### B (`sys:b`)\n\n- `svc:b` B — fixture/b/worker\n- `st:remote` Remote — fixture/b/worker\n- `top:remote` Events — fixture/b/worker\n\n### Unmapped (`sys:unmapped`)\n\n\n## Recorded exchanges\n\n- `svc:a` → `st:remote`: read via `sch:remote#id` at `h:a#read`.\n- `svc:a` → `st:remote`: write via `sch:remote#id` at `h:a#write`.\n- `svc:a` → `top:remote`: publish via `msg:remote` at `h:a#publish`.\n- `svc:a` → `ext:supplier`: call via `api:supplier` at `h:a#call`.\n- `top:remote` → `svc:b`: consume via `msg:remote` at `sub:b`.\n- `top:remote` → `svc:a`: consume via `top:remote` at `rel:consume`.\n- `svc:b` → `st:remote`: read via `st:remote` at `rel:read`.\n- `svc:b` → `sys:unmapped`: call via `sys:unmapped` at `rel:boundary`.\n\n## Gaps\n\n- `api:a`: No caller is recorded.\n- `api:supplier`: No handler detail is recorded.\n- `top:remote`: No cited resource owner is recorded.\n- `sub:b`: No handler detail is recorded.\n- `job:b`: No handler detail is recorded.\n- `job:b`: No schedule or trigger is recorded.\n',
    );
    expect(markdown.endsWith('\n')).toBe(true);
  });
});
