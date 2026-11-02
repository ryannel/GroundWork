import type { Evidence } from './knowledge.generated';

function validHost(host: string): boolean {
  return (
    host.length <= 253 &&
    host.split('.').every((label) => /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/u.test(label))
  );
}

function validRepo(repo: string): boolean {
  const parts = repo.split('/');
  return (
    parts.length === 2 &&
    parts.every((part) => /^[\w.-]+$/u.test(part) && part !== '.' && part !== '..')
  );
}

function validPath(path: string): boolean {
  return (
    !/[\\\p{Cc}]/u.test(path) &&
    path.split('/').every((part) => part.length > 0 && part !== '.' && part !== '..')
  );
}

export function evidenceAnchorProblems(record: Evidence): string[] {
  const errors: string[] = [];
  if (record.host === undefined) {
    errors.push(`${record.id}: v3 evidence requires a GitHub host for its pinned anchor`);
  } else if (!validHost(record.host)) {
    errors.push(`${record.id}: evidence host must be a valid hostname`);
  }
  if (!validRepo(record.repo)) errors.push(`${record.id}: evidence repository must be owner/repo`);
  if (!validPath(record.path)) {
    errors.push(`${record.id}: evidence path must be a relative POSIX file path without traversal`);
  }
  return errors;
}
