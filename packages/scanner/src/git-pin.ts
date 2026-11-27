import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { SubmodulePin } from "@groundwork/schema";

export interface GitPinInfo {
  readonly repo_name: string;
  readonly remote?: string;
  readonly commit: string;
  readonly branch: string;
  readonly dirty: boolean;
  readonly submodules: readonly SubmodulePin[];
}

function runGit(repoDir: string, args: readonly string[]): string | undefined {
  try {
    return execFileSync("git", args, {
      cwd: repoDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
}

function parseGitmodules(repoDir: string): Array<{ name: string; path: string; url?: string }> {
  const file = path.join(repoDir, ".gitmodules");
  if (!fs.existsSync(file)) return [];
  const raw = fs.readFileSync(file, "utf8");
  const results: Array<{ name: string; path: string; url?: string }> = [];
  let current: { name: string; path?: string; url?: string } | null = null;

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    const header = trimmed.match(/^\[submodule\s+"([^"]+)"\]$/);
    if (header) {
      if (current?.path) results.push({ name: current.name, path: current.path, url: current.url });
      current = { name: header[1]! };
      continue;
    }
    if (!current) continue;
    const kv = trimmed.match(/^(path|url)\s*=\s*(.+)$/);
    if (kv) {
      if (kv[1] === "path") current.path = kv[2]!.trim();
      if (kv[1] === "url") current.url = kv[2]!.trim();
    }
  }
  if (current?.path) results.push({ name: current.name, path: current.path, url: current.url });
  return results;
}

export function resolveSubmodule(
  relPath: string,
  submodules: readonly SubmodulePin[],
): SubmodulePin | undefined {
  let best: SubmodulePin | undefined;
  for (const sm of submodules) {
    if (relPath === sm.path || relPath.startsWith(sm.path + "/")) {
      if (!best || sm.path.length > best.path.length) best = sm;
    }
  }
  return best;
}

export function readGitPin(repoDir: string): GitPinInfo {
  const absDir = path.resolve(repoDir);
  const repo_name = path.basename(absDir);
  const commit = runGit(absDir, ["rev-parse", "HEAD"]) ?? "0000000000000000000000000000000000000000";
  const branch = runGit(absDir, ["rev-parse", "--abbrev-ref", "HEAD"]) ?? "unknown";
  const remote = runGit(absDir, ["remote", "get-url", "origin"]);
  const status = runGit(absDir, ["status", "--porcelain"]) ?? "";

  const submodules: SubmodulePin[] = [];
  for (const sm of parseGitmodules(absDir)) {
    const smDir = path.join(absDir, sm.path);
    if (!fs.existsSync(smDir)) continue;
    const smCommit = runGit(smDir, ["rev-parse", "HEAD"]) ?? "0000000000000000000000000000000000000000";
    const smBranch = runGit(smDir, ["rev-parse", "--abbrev-ref", "HEAD"]) ?? "unknown";
    const smRemote = runGit(smDir, ["remote", "get-url", "origin"]) ?? sm.url;
    const smStatus = runGit(smDir, ["status", "--porcelain"]) ?? "";
    submodules.push({
      path: sm.path,
      name: path.basename(sm.path),
      ...(smRemote ? { remote: smRemote } : {}),
      commit: smCommit,
      branch: smBranch,
      dirty: smStatus.length > 0,
    });
  }

  return {
    repo_name,
    ...(remote ? { remote } : {}),
    commit,
    branch,
    dirty: status.length > 0,
    submodules: submodules.sort((a, b) => a.path.localeCompare(b.path)),
  };
}
