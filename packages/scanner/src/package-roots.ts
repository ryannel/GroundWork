import fs from "node:fs";
import path from "node:path";
import type { ExtractorSupport, FacetName, FrameworkDetection, PackageRoot, SubmodulePin } from "@groundwork/schema";
import { resolveSubmodule } from "./git-pin.js";

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".venv",
  "venv",
  "__pycache__",
  "vendor",
  ".dev",
  ".groundwork",
  ".orchestrate",
  "tmp",
  ".claude",
  ".codex",
  ".agents",
  ".air",
  ".junie",
  "coverage",
  "target",
  "bin",
  "obj",
]);

export function walkFiles(rootDir: string, maxDepth = 8): string[] {
  const results: string[] = [];

  function walk(currentDir: string, depth: number): void {
    if (depth > maxDepth) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, depth + 1);
      } else if (entry.isFile()) {
        results.push(fullPath);
      }
    }
  }

  walk(rootDir, 0);
  return results;
}

function emptyCapabilities(): Record<FacetName, ExtractorSupport> {
  return {
    interfaces: "unsupported",
    stores: "unsupported",
    messages_published: "unsupported",
    messages_consumed: "unsupported",
    jobs: "unsupported",
    screens: "unsupported",
    outbound_calls: "unsupported",
  };
}

function upgradeSupport(current: ExtractorSupport, next: ExtractorSupport): ExtractorSupport {
  const rank: Record<ExtractorSupport, number> = { unsupported: 0, partial: 1, supported: 2 };
  return rank[next] > rank[current] ? next : current;
}

function dedupeFrameworks(frameworks: readonly FrameworkDetection[]): FrameworkDetection[] {
  const seen = new Map<string, FrameworkDetection>();
  for (const fw of frameworks) {
    const key = `${fw.name}::${fw.facet}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, fw);
    } else if (fw.support !== existing.support && upgradeSupport(existing.support, fw.support) === fw.support) {
      seen.set(key, fw);
    }
  }
  return [...seen.values()];
}

function parseGoMod(filePath: string, relManifest: string): {
  name: string;
  frameworks: FrameworkDetection[];
  keyDeps: string[];
} {
  const content = fs.readFileSync(filePath, "utf8");
  const modMatch = content.match(/^module\s+(\S+)/m);
  const name = modMatch?.[1] ?? path.basename(path.dirname(filePath));
  const frameworks: FrameworkDetection[] = [];
  const keyDeps: string[] = [];

  const depRegex = /^\s*(?:require\s+)?([a-zA-Z0-9._\-/]+)\s+(v[0-9][^\s]*)/gm;
  let match: RegExpExecArray | null;
  while ((match = depRegex.exec(content)) !== null) {
    const dep = match[1]!;
    const ver = match[2]!;
    if (dep.includes("danielgtaylor/huma")) {
      frameworks.push({ name: "go-huma", version: ver, facet: "interfaces", support: "supported", source: relManifest });
      keyDeps.push(`${dep}@${ver}`);
    } else if (dep.includes("go-chi/chi")) {
      frameworks.push({ name: "go-chi", version: ver, facet: "interfaces", support: "supported", source: relManifest });
      keyDeps.push(`${dep}@${ver}`);
    } else if (dep.includes("gin-gonic/gin")) {
      frameworks.push({ name: "gin", version: ver, facet: "interfaces", support: "supported", source: relManifest });
      keyDeps.push(`${dep}@${ver}`);
    } else if (dep.includes("labstack/echo")) {
      frameworks.push({ name: "echo", version: ver, facet: "interfaces", support: "supported", source: relManifest });
      keyDeps.push(`${dep}@${ver}`);
    } else if (dep.includes("gorilla/websocket") || dep.includes("coder/websocket") || dep.includes("nhooyr.io/websocket")) {
      frameworks.push({ name: "go-websocket", version: ver, facet: "interfaces", support: "partial", source: relManifest });
      keyDeps.push(`${dep}@${ver}`);
    } else if (dep.includes("jackc/pgx") || dep.includes("lib/pq") || dep.includes("gorm.io/gorm") || dep.includes("sqlx")) {
      frameworks.push({ name: path.basename(dep), version: ver, facet: "stores", support: "supported", source: relManifest });
      keyDeps.push(`${dep}@${ver}`);
    } else if (dep.includes("cloud.google.com/go/pubsub") || dep.includes("segmentio/kafka-go") || dep.includes("IBM/sarama")) {
      frameworks.push({ name: path.basename(dep), version: ver, facet: "messages_published", support: "partial", source: relManifest });
      frameworks.push({ name: path.basename(dep), version: ver, facet: "messages_consumed", support: "partial", source: relManifest });
      keyDeps.push(`${dep}@${ver}`);
    } else if (dep.includes("cloud.google.com/go/storage") || dep.includes("aws-sdk-go")) {
      frameworks.push({ name: path.basename(dep), version: ver, facet: "stores", support: "partial", source: relManifest });
      keyDeps.push(`${dep}@${ver}`);
    } else if (dep.includes("robfig/cron")) {
      frameworks.push({ name: "robfig/cron", version: ver, facet: "jobs", support: "partial", source: relManifest });
      keyDeps.push(`${dep}@${ver}`);
    }
  }

  // Go stdlib net/http is always available
  frameworks.push({ name: "net/http", facet: "interfaces", support: "partial", source: relManifest });
  frameworks.push({ name: "net/http-client", facet: "outbound_calls", support: "partial", source: relManifest });

  return { name, frameworks, keyDeps: [...new Set(keyDeps)].sort() };
}

function parsePyproject(filePath: string, relManifest: string): {
  name: string;
  frameworks: FrameworkDetection[];
  keyDeps: string[];
} {
  const content = fs.readFileSync(filePath, "utf8");
  const nameMatch = content.match(/^name\s*=\s*["']([^"']+)["']/m);
  const name = nameMatch?.[1] ?? path.basename(path.dirname(filePath));
  const frameworks: FrameworkDetection[] = [];
  const keyDeps: string[] = [];

  const lower = content.toLowerCase();
  const checkDep = (pkg: string, facet: FacetName, support: ExtractorSupport) => {
    const rx = new RegExp(`["']?${pkg}(?:\\[[^\\]]+\\])?\\s*(?:[><=~!^]+\\s*([0-9][^"',\\s]*))?`, "i");
    const m = content.match(rx);
    if (m) {
      frameworks.push({ name: pkg, version: m[1], facet, support, source: relManifest });
      keyDeps.push(m[1] ? `${pkg}@${m[1]}` : pkg);
    }
  };

  if (lower.includes("fastapi")) checkDep("fastapi", "interfaces", "supported");
  if (lower.includes("flask")) checkDep("flask", "interfaces", "supported");
  if (lower.includes("httpx")) checkDep("httpx", "outbound_calls", "partial");
  if (lower.includes("requests")) checkDep("requests", "outbound_calls", "partial");
  if (lower.includes("sqlalchemy") || lower.includes("psycopg")) checkDep("sqlalchemy", "stores", "partial");
  if (lower.includes("google-cloud-pubsub")) {
    checkDep("google-cloud-pubsub", "messages_published", "partial");
    checkDep("google-cloud-pubsub", "messages_consumed", "partial");
  }
  if (lower.includes("google-cloud-storage")) checkDep("google-cloud-storage", "stores", "partial");
  if (lower.includes("celery") || lower.includes("apscheduler")) checkDep("celery", "jobs", "partial");

  return { name, frameworks, keyDeps: [...new Set(keyDeps)].sort() };
}

function parsePackageJson(filePath: string, relManifest: string): {
  name: string;
  language: "typescript" | "javascript";
  frameworks: FrameworkDetection[];
  keyDeps: string[];
} {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
    name?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const allDeps: Record<string, string> = {
    ...(raw.dependencies ?? {}),
    ...(raw.devDependencies ?? {}),
  };
  const name = raw.name ?? path.basename(path.dirname(filePath));
  const language: "typescript" | "javascript" = "typescript" in allDeps ? "typescript" : "javascript";
  const frameworks: FrameworkDetection[] = [];
  const keyDeps: string[] = [];

  const check = (pkg: string, facet: FacetName, support: ExtractorSupport) => {
    if (pkg in allDeps) {
      const ver = allDeps[pkg];
      frameworks.push({ name: pkg, version: ver, facet, support, source: relManifest });
      keyDeps.push(`${pkg}@${ver}`);
    }
  };

  check("express", "interfaces", "supported");
  check("fastify", "interfaces", "supported");
  check("hono", "interfaces", "supported");
  check("next", "screens", "partial");
  check("react", "screens", "partial");
  check("react-router-dom", "screens", "partial");
  check("vite", "screens", "partial");
  check("prisma", "stores", "supported");
  check("@prisma/client", "stores", "supported");
  check("drizzle-orm", "stores", "partial");
  check("pg", "stores", "partial");
  check("kafkajs", "messages_published", "partial");
  check("kafkajs", "messages_consumed", "partial");
  check("axios", "outbound_calls", "partial");

  if ("react" in allDeps || "next" in allDeps || "vite" in allDeps) {
    frameworks.push({ name: "browser-fetch-ws", facet: "outbound_calls", support: "partial", source: relManifest });
  }

  return { name, language, frameworks, keyDeps: [...new Set(keyDeps)].sort() };
}

function parseCargoToml(filePath: string, relManifest: string): {
  name?: string;
  isVirtualWorkspace: boolean;
  workspaceDeps: string[];
  frameworks: FrameworkDetection[];
  keyDeps: string[];
} {
  const content = fs.readFileSync(filePath, "utf8");
  const hasPackageSection = /^\[package\]/m.test(content);
  if (!hasPackageSection) {
    return { isVirtualWorkspace: true, workspaceDeps: [], frameworks: [], keyDeps: [] };
  }

  const nameMatch = content.match(/^\[package\][\s\S]*?^name\s*=\s*"([^"]+)"/m);
  const name = nameMatch?.[1] ?? path.basename(path.dirname(filePath));
  const workspaceDeps: string[] = [];
  const keyDeps: string[] = [];
  const frameworks: FrameworkDetection[] = [
    { name: "cargo-crate", facet: "interfaces", support: "supported", source: relManifest },
    { name: "cargo-deps", facet: "outbound_calls", support: "supported", source: relManifest },
  ];

  // Parse [dependencies] and [target.*.dependencies] sections line-by-line
  let inDeps = false;
  for (const rawLine of content.split("\n")) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("[")) {
      inDeps = trimmed === "[dependencies]" || /^\[target\.[^\]]+\.dependencies\]$/.test(trimmed);
      continue;
    }
    if (!inDeps) continue;
    const m = trimmed.match(/^([a-zA-Z0-9_-]+)\s*=\s*(.+)$/);
    if (!m) continue;
    const depName = m[1]!;
    const rhs = m[2]!;
    if (rhs.includes("path =") || rhs.includes("path=") || rhs.includes("workspace = true")) {
      workspaceDeps.push(depName);
    } else {
      keyDeps.push(depName);
      if (depName === "wgpu") {
        frameworks.push({ name: "wgpu", facet: "screens", support: "partial", source: relManifest });
      } else if (depName === "quinn" || depName === "web-transport-quinn") {
        frameworks.push({ name: depName, facet: "messages_published", support: "partial", source: relManifest });
      }
    }
  }

  return {
    name,
    isVirtualWorkspace: false,
    workspaceDeps: [...new Set(workspaceDeps)].sort(),
    frameworks,
    keyDeps: [...new Set(keyDeps)].sort(),
  };
}

export function detectPackageRoots(
  repoDir: string,
  allFiles: readonly string[],
  repoName: string,
  submodules: readonly SubmodulePin[] = [],
): PackageRoot[] {
  const roots: PackageRoot[] = [];
  const seenDirs = new Set<string>();

  for (const absFile of allFiles) {
    const base = path.basename(absFile);
    if (base !== "go.mod" && base !== "pyproject.toml" && base !== "package.json" && base !== "Cargo.toml") continue;

    const dir = path.dirname(absFile);
    const relDir = path.relative(repoDir, dir) || ".";
    const relManifest = path.relative(repoDir, absFile);

    // Avoid duplicate root entry if a directory somehow has multiple manifests
    if (seenDirs.has(relDir)) continue;

    const sm = resolveSubmodule(relDir, submodules);
    const owningRepo = sm ? sm.name : repoName;
    const caps = emptyCapabilities();
    let pkg: PackageRoot;

    if (base === "Cargo.toml") {
      const parsed = parseCargoToml(absFile, relManifest);
      if (parsed.isVirtualWorkspace) continue;
      seenDirs.add(relDir);
      for (const fw of parsed.frameworks) {
        caps[fw.facet] = upgradeSupport(caps[fw.facet], fw.support);
      }
      pkg = {
        path: relDir,
        name: parsed.name!,
        language: "rust",
        manifest: relManifest,
        ...(sm ? { submodule_path: sm.path } : {}),
        repo_name: owningRepo,
        workspace_dependencies: parsed.workspaceDeps,
        frameworks: parsed.frameworks,
        capabilities: caps,
        key_dependencies: parsed.keyDeps,
      };
    } else if (base === "go.mod") {
      seenDirs.add(relDir);
      const parsed = parseGoMod(absFile, relManifest);
      for (const fw of parsed.frameworks) {
        caps[fw.facet] = upgradeSupport(caps[fw.facet], fw.support);
      }
      pkg = {
        path: relDir,
        name: parsed.name,
        language: "go",
        manifest: relManifest,
        ...(sm ? { submodule_path: sm.path } : {}),
        repo_name: owningRepo,
        frameworks: parsed.frameworks,
        capabilities: caps,
        key_dependencies: parsed.keyDeps,
      };
    } else if (base === "pyproject.toml") {
      seenDirs.add(relDir);
      const parsed = parsePyproject(absFile, relManifest);
      for (const fw of parsed.frameworks) {
        caps[fw.facet] = upgradeSupport(caps[fw.facet], fw.support);
      }
      pkg = {
        path: relDir,
        name: parsed.name,
        language: "python",
        manifest: relManifest,
        ...(sm ? { submodule_path: sm.path } : {}),
        repo_name: owningRepo,
        frameworks: parsed.frameworks,
        capabilities: caps,
        key_dependencies: parsed.keyDeps,
      };
    } else {
      seenDirs.add(relDir);
      const parsed = parsePackageJson(absFile, relManifest);
      for (const fw of parsed.frameworks) {
        caps[fw.facet] = upgradeSupport(caps[fw.facet], fw.support);
      }
      pkg = {
        path: relDir,
        name: parsed.name,
        language: parsed.language,
        manifest: relManifest,
        ...(sm ? { submodule_path: sm.path } : {}),
        repo_name: owningRepo,
        frameworks: parsed.frameworks,
        capabilities: caps,
        key_dependencies: parsed.keyDeps,
      };
    }

    roots.push({
      ...pkg,
      frameworks: dedupeFrameworks(pkg.frameworks),
      key_dependencies: [...new Set(pkg.key_dependencies)].sort(),
    });
  }

  return roots.sort((a, b) => a.path.localeCompare(b.path));
}

export function resolvePackageRoot(relFile: string, packageRoots: readonly PackageRoot[]): string {
  // Longest matching prefix wins (excluding "." unless nothing else matches)
  let best = ".";
  for (const root of packageRoots) {
    if (root.path === ".") continue;
    if (relFile === root.path || relFile.startsWith(root.path + "/") || relFile.startsWith(root.path + path.sep)) {
      if (root.path.length > best.length || best === ".") {
        best = root.path;
      }
    }
  }
  return best;
}
