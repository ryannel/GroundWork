import fs from "node:fs";
import path from "node:path";

export interface IdMoveFileChange {
  readonly file: string;
  readonly replacements: number;
}

export interface IdMoveResult {
  readonly old_id: string;
  readonly new_id: string;
  readonly dry_run: boolean;
  readonly files_changed: readonly IdMoveFileChange[];
  readonly total_replacements: number;
}

const REWRITE_EXTENSIONS = new Set([".yaml", ".yml", ".json", ".html", ".md"]);
const SKIP_DIRS = new Set([".git", "node_modules", ".groundwork", "evidence"]);

function collectTextFiles(rootDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && REWRITE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        out.push(full);
      }
    }
  };
  walk(rootDir);
  return out.sort();
}

/**
 * Atomic ID rewrite across model YAML, plans, review notes, and HTML prototype data-gw-* bindings.
 * Matches exact canonical IDs (including child addresses like `<oldId>#step`).
 */
export function moveId(
  spaceDir: string,
  oldId: string,
  newId: string,
  options: { readonly dryRun?: boolean } = {},
): IdMoveResult {
  const absDir = path.resolve(spaceDir);
  const files = collectTextFiles(absDir);
  const escaped = oldId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Match oldId when not immediately followed by another slug character (allow #, quotes, whitespace, punctuation)
  const regex = new RegExp(`(?<![a-zA-Z0-9._:/-])${escaped}(?![a-zA-Z0-9._/-])`, "g");

  const files_changed: IdMoveFileChange[] = [];
  let total_replacements = 0;

  for (const absFile of files) {
    const original = fs.readFileSync(absFile, "utf8");
    let count = 0;
    const updated = original.replace(regex, () => {
      count++;
      return newId;
    });
    if (count > 0) {
      total_replacements += count;
      files_changed.push({ file: path.relative(absDir, absFile), replacements: count });
      if (!options.dryRun) {
        fs.writeFileSync(absFile, updated, "utf8");
      }
    }
  }

  return {
    old_id: oldId,
    new_id: newId,
    dry_run: Boolean(options.dryRun),
    files_changed,
    total_replacements,
  };
}
