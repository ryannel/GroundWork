const NEVER_MARKED = new Set(['tst', 'wi', 'chg', 'q', 'risk', 'dec', 'ms', 'team']);

/** Tests, work items, changes, questions, risks, decisions, milestones and teams are not system elements: no diff status. */
export const carriesStatus = (id: string): boolean => !NEVER_MARKED.has(id.split(':')[0] ?? '');
