import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { AnchorCheckResult, CiteAnchor, CiteAnchorsFile, SurfaceRecord } from "@groundwork/schema";

export function hashSnippet(text: string): string {
  const normalized = text
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    .trim();
  return crypto.createHash("sha256").update(normalized, "utf8").digest("hex");
}

function readLineSpan(absFile: string, lines: readonly [number, number]): string | undefined {
  if (!fs.existsSync(absFile)) return undefined;
  const all = fs.readFileSync(absFile, "utf8").split("\n");
  const start = Math.max(0, lines[0] - 1);
  const end = Math.min(all.length, lines[1]);
  if (start >= all.length || start >= end) return undefined;
  return all.slice(start, end).join("\n");
}

export function buildCiteAnchors(
  repoDir: string,
  repoName: string,
  commit: string,
  surfaces: readonly SurfaceRecord[],
): CiteAnchorsFile {
  const anchors: Record<string, CiteAnchor> = {};

  for (const s of surfaces) {
    if (!s.lines) continue;
    const key = `${s.file}#L${s.lines[0]}-${s.lines[1]}`;
    if (anchors[key]) continue;
    const snippet = readLineSpan(path.join(repoDir, s.file), s.lines);
    if (!snippet) continue;
    anchors[key] = {
      file: s.file,
      lines: s.lines,
      ...(s.symbol ? { symbol: s.symbol } : {}),
      content_sha256: hashSnippet(snippet),
    };
  }

  return {
    schema_version: 1,
    repo_name: repoName,
    commit,
    anchors,
  };
}

/**
 * Re-anchors previously recorded citations against the current files on disk.
 * Classifies each anchor as:
 *  - unchanged: exact same lines have the exact same normalized SHA-256
 *  - moved: exact same normalized SHA-256 found at a different line window in the same file
 *  - changed: file exists, but content at anchor changed and wasn't found moved intact
 *  - missing_file: cited file no longer exists
 */
export function checkCiteAnchors(
  repoDir: string,
  previous: CiteAnchorsFile,
): AnchorCheckResult[] {
  const results: AnchorCheckResult[] = [];

  for (const [cite_key, anchor] of Object.entries(previous.anchors)) {
    const absFile = path.join(repoDir, anchor.file);
    if (!fs.existsSync(absFile)) {
      results.push({ cite_key, status: "missing_file", old_lines: anchor.lines });
      continue;
    }

    const currentAtOld = readLineSpan(absFile, anchor.lines);
    if (currentAtOld && hashSnippet(currentAtOld) === anchor.content_sha256) {
      results.push({ cite_key, status: "unchanged", old_lines: anchor.lines, new_lines: anchor.lines });
      continue;
    }

    // Slide a window of the same span height across the file to detect pure line shifts
    const allLines = fs.readFileSync(absFile, "utf8").split("\n");
    const spanHeight = anchor.lines[1] - anchor.lines[0] + 1;
    let movedTo: [number, number] | undefined;
    for (let start = 0; start <= allLines.length - spanHeight; start++) {
      const windowText = allLines.slice(start, start + spanHeight).join("\n");
      if (hashSnippet(windowText) === anchor.content_sha256) {
        movedTo = [start + 1, start + spanHeight];
        break;
      }
    }

    if (movedTo) {
      results.push({ cite_key, status: "moved", old_lines: anchor.lines, new_lines: movedTo });
    } else {
      results.push({ cite_key, status: "changed", old_lines: anchor.lines });
    }
  }

  return results;
}
