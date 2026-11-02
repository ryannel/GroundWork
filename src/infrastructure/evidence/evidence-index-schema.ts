import 'server-only';

// The evidence index: a SQLite file built from <workspace>/evidence/ and the analysis cache, never edited, rebuilt whole. It lives in
// <workspace>/.groundwork/ (git ignores it) and is replaced by rename, so a reader never sees half a build.

export const INDEX_FORMAT = 'groundwork-evidence-index/v1';
export const INDEX_PATH = ['.groundwork', 'evidence.sqlite'] as const;

/** Families too numerous and too alike to search by text; they are reached through links instead. */
export const UNSEARCHED_FAMILIES: ReadonlySet<string> = new Set([
  'sources',
  'gaps',
  'contracts',
  'bindings',
  'summaries',
]);

export const INDEX_TABLES = `
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID;
CREATE TABLE repositories (
  name TEXT PRIMARY KEY, repo TEXT NOT NULL, summary TEXT NOT NULL, discovery TEXT
) WITHOUT ROWID;
CREATE TABLE records (
  rowid INTEGER PRIMARY KEY, repository TEXT NOT NULL, id TEXT NOT NULL, family TEXT NOT NULL,
  kind TEXT NOT NULL, label TEXT NOT NULL, path TEXT, line_start INTEGER, line_end INTEGER, json TEXT NOT NULL,
  UNIQUE (repository, id)
);
CREATE TABLE links (
  source INTEGER NOT NULL, field TEXT NOT NULL, target INTEGER NOT NULL, PRIMARY KEY (source, field, target)
) WITHOUT ROWID;
CREATE VIRTUAL TABLE search USING fts5 (
  label, path, text, tokenize = "unicode61 remove_diacritics 2 tokenchars '_.'"
);
`;

// created after the rows are in, which is several times faster than keeping them up to date row by row
export const INDEX_INDEXES = `
CREATE INDEX records_family ON records (repository, family, kind, label);
CREATE INDEX records_path ON records (repository, path, line_start);
CREATE INDEX links_target ON links (target, field, source);
`;
