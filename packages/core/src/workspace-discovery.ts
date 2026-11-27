import fs from "node:fs";
import path from "node:path";
import {
  validateWorkspaceFile,
  validateWorkspacePointer,
  type WorkspaceFile,
  type WorkspacePointerFile,
} from "@groundwork/schema";
import { defaultFileCache, type IncrementalFileCache } from "./file-cache.js";

export interface DiscoveredWorkspace {
  readonly id: string;
  readonly name: string;
  readonly root_dir: string;
  readonly source: "pointer" | "example" | "env";
  readonly mode: "single-space" | "multi-project";
  readonly projects: readonly string[];
}

function inspectWorkspaceDir(
  dir: string,
  source: DiscoveredWorkspace["source"],
  cache: IncrementalFileCache,
): DiscoveredWorkspace | undefined {
  const wsYaml = path.join(dir, "workspace.yaml");
  if (!fs.existsSync(wsYaml)) return undefined;
  const data = cache.readYaml<WorkspaceFile>(wsYaml);
  if (!data || !validateWorkspaceFile(data).valid) return undefined;
  const projects = data.projects ?? [];
  return {
    id: data.id,
    name: data.name,
    root_dir: path.resolve(dir),
    source,
    mode: projects.length > 0 ? "multi-project" : "single-space",
    projects,
  };
}

export function discoverWorkspaces(
  groundworkRoot: string,
  cache: IncrementalFileCache = defaultFileCache,
): DiscoveredWorkspace[] {
  const results: DiscoveredWorkspace[] = [];
  const seenIds = new Set<string>();

  const addIfUnique = (ws: DiscoveredWorkspace | undefined) => {
    if (!ws || seenIds.has(ws.id)) return;
    seenIds.add(ws.id);
    results.push(ws);
  };

  // 1. Optional GROUNDWORK_WORKSPACES env override
  const envPaths = process.env.GROUNDWORK_WORKSPACES;
  if (envPaths) {
    for (const p of envPaths.split(path.delimiter).filter(Boolean)) {
      addIfUnique(inspectWorkspaceDir(path.resolve(p), "env", cache));
    }
    return results;
  }

  // 2. Pointer manifests in <groundworkRoot>/workspaces/*.yaml
  const pointersDir = path.join(groundworkRoot, "workspaces");
  if (fs.existsSync(pointersDir)) {
    for (const entry of fs.readdirSync(pointersDir, { withFileTypes: true })) {
      if (entry.isFile() && (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml"))) {
        const ptr = cache.readYaml<WorkspacePointerFile>(path.join(pointersDir, entry.name));
        if (ptr && validateWorkspacePointer(ptr).valid) {
          const resolvedRoot = path.resolve(pointersDir, ptr.root);
          addIfUnique(inspectWorkspaceDir(resolvedRoot, "pointer", cache));
        }
      } else if (entry.isDirectory()) {
        addIfUnique(inspectWorkspaceDir(path.join(pointersDir, entry.name), "pointer", cache));
      }
    }
  }

  // 3. Bundled examples in <groundworkRoot>/examples/*
  const examplesDir = path.join(groundworkRoot, "examples");
  if (fs.existsSync(examplesDir)) {
    for (const entry of fs.readdirSync(examplesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      addIfUnique(inspectWorkspaceDir(path.join(examplesDir, entry.name), "example", cache));
    }
  }

  return results.sort((a, b) => a.id.localeCompare(b.id));
}

export function resolveSpaceDir(
  workspace: DiscoveredWorkspace,
  projectId?: string,
): string {
  if (workspace.mode === "single-space") {
    if (projectId) {
      throw new Error(`Workspace ${workspace.id} is a single-space workspace and does not have project ${projectId}`);
    }
    return workspace.root_dir;
  }
  if (!projectId) {
    throw new Error(
      `Workspace ${workspace.id} is a multi-project workspace; pass --project <id>. Available: ${workspace.projects.join(", ")}`,
    );
  }
  const slug = projectId.replace(/^project:/, "");
  const dir = path.join(workspace.root_dir, "projects", slug);
  if (!fs.existsSync(path.join(dir, "project.yaml"))) {
    throw new Error(`Project ${projectId} not found at ${dir}`);
  }
  return dir;
}
