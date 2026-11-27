import fs from "node:fs";
import path from "node:path";
import type {
  ModuleVisibility,
  OrientationTier,
  PackageRoot,
  PackageStructure,
  RepositoryPin,
  StructureEntrypoint,
  StructureEvidence,
  StructureModuleEntry,
  SubmodulePin,
  TechStackGroup,
} from "@groundwork/schema";

const SOURCE_EXTS = new Set([
  ".rs",
  ".go",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".java",
  ".kt",
  ".cs",
  ".cpp",
  ".cc",
  ".c",
  ".h",
  ".hpp",
  ".swift",
]);

const ASSET_EXTS = new Set([".wgsl", ".glsl", ".hlsl", ".sql", ".proto", ".graphql", ".gql"]);

const SKIP_TOP_NAMES = new Set([
  "node_modules",
  "target",
  "dist",
  "build",
  ".next",
  "vendor",
  "__pycache__",
  "coverage",
  "tmp",
  "bin",
  "obj",
]);

/** Normalize SSH or HTTPS git remote URLs into clean HTTPS web URLs. */
export function normalizeGitWebUrl(remote?: string): string | undefined {
  if (!remote) return undefined;
  const trimmed = remote.trim();
  if (!trimmed) return undefined;
  // git@github.com:org/repo.git -> https://github.com/org/repo
  const scpMatch = trimmed.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
  if (scpMatch) {
    return `https://${scpMatch[1]}/${scpMatch[2]}`;
  }
  // ssh://git@github.com/org/repo.git -> https://github.com/org/repo
  const sshMatch = trimmed.match(/^ssh:\/\/(?:[^@]+@)?([^/]+)\/(.+?)(?:\.git)?$/);
  if (sshMatch) {
    return `https://${sshMatch[1]}/${sshMatch[2]}`;
  }
  // https://github.com/org/repo.git -> https://github.com/org/repo
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed.replace(/\.git$/, "");
  }
  return undefined;
}

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

function countLinesFast(filePath: string): number {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > 2_000_000) return Math.round(stat.size / 40);
    const content = fs.readFileSync(filePath, "utf8");
    if (!content) return 0;
    let lines = 1;
    for (let i = 0; i < content.length; i++) {
      if (content.charCodeAt(i) === 10) lines++;
    }
    return lines;
  } catch {
    return 0;
  }
}

function readHead(filePath: string, maxBytes = 4096): string {
  try {
    const fd = fs.openSync(filePath, "r");
    try {
      const buf = Buffer.alloc(maxBytes);
      const bytesRead = fs.readSync(fd, buf, 0, maxBytes, 0);
      return buf.toString("utf8", 0, bytesRead);
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return "";
  }
}

function cleanDocText(raw: string, maxLen = 240): string | undefined {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  if (!collapsed) return undefined;
  if (collapsed.length <= maxLen) return collapsed;
  return collapsed.slice(0, maxLen - 1).trimEnd() + "…";
}

function extractRustDocHeader(filePath: string): string | undefined {
  if (!fs.existsSync(filePath)) return undefined;
  const head = readHead(filePath, 4096);
  const lines = head.split("\n");
  const docLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//!")) {
      const text = trimmed.slice(3).trim();
      if (!text && docLines.length > 0) break;
      if (text) docLines.push(text);
    } else if (trimmed === "" && docLines.length === 0) {
      continue;
    } else if (docLines.length > 0) {
      break;
    } else if (trimmed.startsWith("#![")) {
      continue;
    } else {
      break;
    }
  }
  return cleanDocText(docLines.join(" "));
}

function extractGoDocHeader(filePath: string): string | undefined {
  if (!fs.existsSync(filePath)) return undefined;
  const head = readHead(filePath, 4096);
  const lines = head.split("\n");
  const docLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") && !trimmed.startsWith("//go:")) {
      docLines.push(trimmed.slice(2).trim());
    } else if (trimmed.startsWith("package ")) {
      break;
    } else if (trimmed === "") {
      if (docLines.length > 0) docLines.length = 0;
    } else {
      break;
    }
  }
  return cleanDocText(docLines.join(" "));
}

function extractPythonDocHeader(filePath: string): string | undefined {
  if (!fs.existsSync(filePath)) return undefined;
  const head = readHead(filePath, 4096).trimStart();
  const match = head.match(/^(?:"""([\s\S]*?)"""|'''([\s\S]*?)''')/);
  if (!match) return undefined;
  return cleanDocText((match[1] ?? match[2] ?? "").split("\n\n")[0] ?? "");
}

function extractReadmeIntro(pkgDir: string): string | undefined {
  for (const candidate of ["README.md", "readme.md"]) {
    const p = path.join(pkgDir, candidate);
    if (!fs.existsSync(p)) continue;
    const head = readHead(p, 4096);
    const lines = head.split("\n");
    const para: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (para.length > 0) break;
        continue;
      }
      if (
        trimmed.startsWith("#") ||
        trimmed.startsWith("![") ||
        trimmed.startsWith("[![") ||
        trimmed.startsWith("- ") ||
        trimmed.startsWith("* ") ||
        trimmed.startsWith("```")
      ) {
        if (para.length > 0) break;
        continue;
      }
      para.push(trimmed);
    }
    const text = cleanDocText(para.join(" "));
    if (text) return text;
  }
  return undefined;
}

function extractPackageDocSummary(pkgDir: string, language: PackageRoot["language"]): string | undefined {
  if (language === "rust") {
    return (
      extractRustDocHeader(path.join(pkgDir, "src/lib.rs")) ??
      extractRustDocHeader(path.join(pkgDir, "src/main.rs")) ??
      extractReadmeIntro(pkgDir)
    );
  }
  if (language === "go") {
    return (
      extractGoDocHeader(path.join(pkgDir, "doc.go")) ??
      extractGoDocHeader(path.join(pkgDir, "main.go")) ??
      extractReadmeIntro(pkgDir)
    );
  }
  if (language === "python") {
    return (
      extractPythonDocHeader(path.join(pkgDir, "src/__init__.py")) ??
      extractPythonDocHeader(path.join(pkgDir, "main.py")) ??
      extractReadmeIntro(pkgDir)
    );
  }
  return extractReadmeIntro(pkgDir);
}

interface RustModVisibilityMap {
  readonly byName: Map<string, ModuleVisibility>;
}

function parseRustLibVisibility(libPath: string): RustModVisibilityMap {
  const byName = new Map<string, ModuleVisibility>();
  if (!fs.existsSync(libPath)) return { byName };
  let content: string;
  try {
    content = fs.readFileSync(libPath, "utf8");
  } catch {
    return { byName };
  }
  const lines = content.split("\n");
  let pendingHidden = false;
  let pendingTest = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("//")) continue;
    if (line.includes("#[doc(hidden)]")) {
      pendingHidden = true;
      continue;
    }
    if (line.includes("#[cfg(test)]")) {
      pendingTest = true;
      continue;
    }
    if (line.startsWith("#[")) continue;

    const pubMatch = line.match(/^pub(?:\([^)]*\))?\s+mod\s+([A-Za-z0-9_]+)\s*;/);
    if (pubMatch) {
      const modName = pubMatch[1]!;
      const isCrateOnly = line.startsWith("pub(crate)") || line.startsWith("pub(super)");
      const vis: ModuleVisibility = pendingTest
        ? "test"
        : pendingHidden
          ? "hidden"
          : isCrateOnly
            ? "internal"
            : "public";
      byName.set(modName, vis);
      pendingHidden = false;
      pendingTest = false;
      continue;
    }

    const privMatch = line.match(/^mod\s+([A-Za-z0-9_]+)\s*;/);
    if (privMatch) {
      const modName = privMatch[1]!;
      byName.set(modName, pendingTest ? "test" : "internal");
      pendingHidden = false;
      pendingTest = false;
      continue;
    }

    pendingHidden = false;
    pendingTest = false;
  }
  return { byName };
}

function detectEntrypoints(pkgDir: string, pkg: PackageRoot, pkgFiles: readonly string[]): StructureEntrypoint[] {
  const entrypoints: StructureEntrypoint[] = [];
  const seen = new Set<string>();
  const add = (ep: StructureEntrypoint) => {
    const key = `${ep.kind}:${ep.path}:${ep.name}`;
    if (!seen.has(key)) {
      seen.add(key);
      entrypoints.push(ep);
    }
  };

  if (pkg.language === "go") {
    for (const rel of pkgFiles) {
      if (/^cmd\/[^/]+\/main\.go$/.test(rel)) {
        const binName = rel.split("/")[1]!;
        add({
          path: rel,
          name: binName,
          kind: "binary",
          command: `go run ./cmd/${binName}`,
          summary: extractGoDocHeader(path.join(pkgDir, rel)),
        });
      } else if (rel === "main.go") {
        add({
          path: rel,
          name: pkg.name,
          kind: "binary",
          command: "go run .",
          summary: extractGoDocHeader(path.join(pkgDir, rel)),
        });
      }
    }
  } else if (pkg.language === "rust") {
    const cargoPath = path.join(pkgDir, "Cargo.toml");
    if (fs.existsSync(cargoPath)) {
      try {
        const content = fs.readFileSync(cargoPath, "utf8");
        const binBlocks = content.split("[[bin]]").slice(1);
        for (const block of binBlocks) {
          const section = block.split(/\n\[/)[0] ?? block;
          const nameM = section.match(/^\s*name\s*=\s*"([^"]+)"/m);
          const pathM = section.match(/^\s*path\s*=\s*"([^"]+)"/m);
          if (nameM) {
            add({
              path: pathM?.[1] ?? `src/bin/${nameM[1]}.rs`,
              name: nameM[1]!,
              kind: "binary",
              command: `cargo run -p ${pkg.name} --bin ${nameM[1]}`,
            });
          }
        }
      } catch {
        // ignore unreadable Cargo.toml
      }
    }
    if (pkgFiles.includes("src/main.rs")) {
      add({
        path: "src/main.rs",
        name: pkg.name,
        kind: "binary",
        command: `cargo run -p ${pkg.name}`,
        summary: extractRustDocHeader(path.join(pkgDir, "src/main.rs")),
      });
    }
    for (const rel of pkgFiles) {
      const m = rel.match(/^src\/bin\/([^/]+)\.rs$/);
      if (m) {
        add({
          path: rel,
          name: m[1]!,
          kind: "binary",
          command: `cargo run -p ${pkg.name} --bin ${m[1]}`,
        });
      }
    }
    if (pkgFiles.includes("src/lib.rs")) {
      add({
        path: "src/lib.rs",
        name: `${pkg.name} (lib)`,
        kind: "library",
        command: `cargo test -p ${pkg.name}`,
      });
    }
  } else if (pkg.language === "typescript" || pkg.language === "javascript") {
    const pjPath = path.join(pkgDir, "package.json");
    if (fs.existsSync(pjPath)) {
      try {
        const pj = JSON.parse(fs.readFileSync(pjPath, "utf8")) as {
          main?: string;
          bin?: string | Record<string, string>;
          scripts?: Record<string, string>;
        };
        if (typeof pj.bin === "string") {
          add({ path: pj.bin.replace(/^\.\//, ""), name: pkg.name, kind: "binary" });
        } else if (pj.bin && typeof pj.bin === "object") {
          for (const [k, v] of Object.entries(pj.bin)) {
            add({ path: v.replace(/^\.\//, ""), name: k, kind: "binary" });
          }
        }
        const interestingScripts = ["dev", "start", "build", "test"];
        for (const s of interestingScripts) {
          if (pj.scripts?.[s]) {
            add({
              path: "package.json",
              name: `npm run ${s}`,
              kind: "script",
              command: `npm run ${s}`,
              summary: pj.scripts[s],
            });
          }
        }
      } catch {
        // ignore invalid package.json
      }
    }
  } else if (pkg.language === "python") {
    for (const candidate of ["main.py", "app/main.py", "src/main.py"]) {
      if (pkgFiles.includes(candidate)) {
        add({ path: candidate, name: pkg.name, kind: "binary", command: `python ${candidate}` });
      }
    }
  }

  if (pkgFiles.includes("Dockerfile")) {
    add({ path: "Dockerfile", name: "Dockerfile", kind: "container" });
  }

  return entrypoints;
}

const TECH_RULES: ReadonlyArray<{ pattern: RegExp; category: string; label?: string }> = [
  // API & Routing
  { pattern: /go-huma|danielgtaylor\/huma/i, category: "API & Routing", label: "Huma v2" },
  { pattern: /go-chi|chi\/v\d/i, category: "API & Routing", label: "Chi" },
  { pattern: /\bgin\b|gin-gonic/i, category: "API & Routing", label: "Gin" },
  { pattern: /\becho\b|labstack\/echo/i, category: "API & Routing", label: "Echo" },
  { pattern: /\bfastapi\b/i, category: "API & Routing", label: "FastAPI" },
  { pattern: /\bexpress\b/i, category: "API & Routing", label: "Express" },
  { pattern: /\bfastify\b/i, category: "API & Routing", label: "Fastify" },
  { pattern: /\bhono\b/i, category: "API & Routing", label: "Hono" },
  { pattern: /\baxum\b/i, category: "API & Routing", label: "Axum" },
  { pattern: /\bactix-web\b/i, category: "API & Routing", label: "Actix Web" },
  // Realtime & Networking
  { pattern: /gorilla\/websocket|websocket/i, category: "Realtime & Networking", label: "WebSocket" },
  { pattern: /\bquinn\b|web-transport-quinn/i, category: "Realtime & Networking", label: "QUIC (quinn)" },
  { pattern: /\btokio\b/i, category: "Runtime & Async", label: "Tokio" },
  { pattern: /\brayon\b/i, category: "Runtime & Async", label: "Rayon" },
  // Database
  { pattern: /jackc\/pgx|\bpgx\b/i, category: "Database", label: "PostgreSQL (pgx)" },
  { pattern: /lib\/pq/i, category: "Database", label: "PostgreSQL (lib/pq)" },
  { pattern: /\bprisma\b/i, category: "Database", label: "Prisma" },
  { pattern: /\bdrizzle\b/i, category: "Database", label: "Drizzle ORM" },
  { pattern: /\bsqlalchemy\b/i, category: "Database", label: "SQLAlchemy" },
  { pattern: /\bsqlx\b/i, category: "Database", label: "SQLx" },
  { pattern: /\bredis\b|ioredis/i, category: "Database", label: "Redis" },
  // Messaging & Cloud
  { pattern: /go\/pubsub|google-cloud-pubsub|pubsub/i, category: "Cloud & Messaging", label: "Google Cloud Pub/Sub" },
  { pattern: /go\/storage|google-cloud-storage/i, category: "Cloud & Messaging", label: "Google Cloud Storage" },
  { pattern: /\bkafka\b|kafkajs/i, category: "Cloud & Messaging", label: "Kafka" },
  { pattern: /\bnats\b/i, category: "Cloud & Messaging", label: "NATS" },
  // GPU & Graphics
  { pattern: /\bwgpu\b/i, category: "GPU & Graphics", label: "wgpu" },
  { pattern: /\bwinit\b/i, category: "GPU & Graphics", label: "winit" },
  { pattern: /\bnaga\b/i, category: "GPU & Graphics", label: "Naga (WGSL)" },
  { pattern: /\bglam\b/i, category: "Math & Geometry", label: "glam" },
  { pattern: /\bbytemuck\b/i, category: "GPU & Graphics", label: "bytemuck" },
  // UI & Frontend
  { pattern: /\bnext\b|next\.js/i, category: "UI & Frontend", label: "Next.js" },
  { pattern: /\breact\b/i, category: "UI & Frontend", label: "React" },
  { pattern: /\bvite\b/i, category: "UI & Frontend", label: "Vite" },
  { pattern: /\begui\b/i, category: "UI & Frontend", label: "egui" },
  { pattern: /\btailwind/i, category: "UI & Frontend", label: "Tailwind CSS" },
  // AI & ML
  { pattern: /\btorch\b|pytorch/i, category: "AI & ML", label: "PyTorch" },
  { pattern: /\bfaster-whisper\b|whisper/i, category: "AI & ML", label: "Whisper" },
  { pattern: /\bpyannote\b/i, category: "AI & ML", label: "pyannote" },
  { pattern: /\bonnx/i, category: "AI & ML", label: "ONNX Runtime" },
  { pattern: /\bopenai\b|\banthropic\b|google-genai/i, category: "AI & ML", label: "LLM SDK" },
  // Serialization & Schema
  { pattern: /\bserde\b/i, category: "Serialization & Validation", label: "serde" },
  { pattern: /\bzod\b|\bajv\b|\bpydantic\b/i, category: "Serialization & Validation" },
];

export function groupTechStack(pkg: PackageRoot): TechStackGroup[] {
  const buckets = new Map<string, Set<string>>();
  const addItem = (cat: string, item: string) => {
    let s = buckets.get(cat);
    if (!s) {
      s = new Set();
      buckets.set(cat, s);
    }
    s.add(item);
  };

  const candidates = [
    ...pkg.frameworks.map((f) => f.name),
    ...pkg.key_dependencies,
  ];

  const ignoredFrameworks = new Set(["cargo-crate", "cargo-deps", "go-http"]);
  for (const raw of candidates) {
    if (ignoredFrameworks.has(raw)) continue;
    let matched = false;
    for (const rule of TECH_RULES) {
      if (rule.pattern.test(raw)) {
        addItem(rule.category, rule.label ?? raw.split("@")[0]!);
        matched = true;
        break;
      }
    }
    if (!matched && pkg.key_dependencies.includes(raw)) {
      // Keep notable uncategorized deps only if the package has few categorized ones
      const cleanName = raw.replace(/^github\.com\/[^/]+\//, "").split("@")[0]!;
      if (cleanName && !/^(thiserror|anyhow|tracing|log|rand|once_cell|cfg-if)$/i.test(cleanName)) {
        addItem("Libraries", cleanName);
      }
    }
  }

  const order = [
    "API & Routing",
    "UI & Frontend",
    "GPU & Graphics",
    "Math & Geometry",
    "Realtime & Networking",
    "Database",
    "Cloud & Messaging",
    "AI & ML",
    "Runtime & Async",
    "Serialization & Validation",
    "Libraries",
  ];

  return [...buckets.entries()]
    .map(([category, items]) => ({ category, items: [...items].sort() }))
    .sort((a, b) => {
      const ia = order.indexOf(a.category);
      const ib = order.indexOf(b.category);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.category.localeCompare(b.category);
    });
}

function detectFlags(pkgDir: string, pkgFiles: readonly string[]): string[] {
  const found = new Set<string>();
  const sourceFiles = pkgFiles
    .filter((f) => SOURCE_EXTS.has(path.extname(f).toLowerCase()) && !f.endsWith("_test.go") && !f.includes(".test."))
    .slice(0, 80);

  for (const rel of sourceFiles) {
    if (found.size >= 15) break;
    const content = readHead(path.join(pkgDir, rel), 8192);
    if (!content) continue;

    for (const m of content.matchAll(/#\[cfg\(feature\s*=\s*"([^"]+)"\)\]/g)) {
      found.add(`feature:${m[1]}`);
    }
    for (const m of content.matchAll(/os\.Getenv\("([A-Z][A-Z0-9_]{2,})"\)/g)) {
      found.add(`env:${m[1]}`);
    }
    for (const m of content.matchAll(/process\.env\.([A-Z][A-Z0-9_]{2,})/g)) {
      found.add(`env:${m[1]}`);
    }
    for (const m of content.matchAll(/os\.environ(?:\.get)?\(\s*["']([A-Z][A-Z0-9_]{2,})["']/g)) {
      found.add(`env:${m[1]}`);
    }
  }
  return [...found].sort().slice(0, 15);
}

interface ModuleAccum {
  path: string;
  name: string;
  kind: "dir" | "file";
  visibility: ModuleVisibility;
  file_count: number;
  source_files: number;
  loc: number;
  asset_counts: Record<string, number>;
  doc_summary?: string;
}

function buildModulesForPackage(
  pkgDir: string,
  pkg: PackageRoot,
  pkgFiles: readonly string[],
): StructureModuleEntry[] {
  const acc = new Map<string, ModuleAccum>();
  const rustVis = pkg.language === "rust" ? parseRustLibVisibility(path.join(pkgDir, "src/lib.rs")).byName : new Map();

  // Determine grouping strategy per language
  const hasSrcDir = pkgFiles.some((f) => f.startsWith("src/"));

  for (const rel of pkgFiles) {
    const parts = rel.split("/");
    const top = parts[0]!;
    if (SKIP_TOP_NAMES.has(top) || top.startsWith(".")) continue;
    // Skip root manifest / lock / docker / dot files from module gravity
    if (
      parts.length === 1 &&
      (/\.(toml|json|yaml|yml|lock|md|txt|sum|mod)$/i.test(top) || /^(Dockerfile|Makefile|LICENSE|Procfile|Justfile)/i.test(top))
    ) {
      continue;
    }

    let groupPath: string;
    let groupName: string;
    let groupKind: "dir" | "file";
    let visibility: ModuleVisibility = "internal";

    if (pkg.language === "rust" && top === "src" && parts.length >= 2) {
      const second = parts[1]!;
      if (second === "lib.rs" || second === "main.rs") continue;
      // Merge src/foo.rs and src/foo/* into a single module entry "src/foo"
      const stem = second.replace(/\.rs$/, "");
      const hasSubdir = pkgFiles.some((f) => f.startsWith(`src/${stem}/`));
      const isWgslAsset = second.endsWith(".wgsl");
      if (isWgslAsset) {
        groupPath = "src";
        groupName = "shaders (root)";
        groupKind = "dir";
        visibility = "asset";
      } else {
        groupPath = hasSubdir ? `src/${stem}` : `src/${second}`;
        groupName = stem;
        groupKind = hasSubdir ? "dir" : "file";
        visibility = rustVis.get(stem) ?? (stem.includes("test") ? "test" : "internal");
      }
    } else if (pkg.language === "go" && (top === "internal" || top === "pkg" || top === "cmd") && parts.length >= 2) {
      const second = parts[1]!;
      groupPath = `${top}/${second}`;
      groupName = second;
      groupKind = parts.length > 2 ? "dir" : "file";
      visibility = top === "internal" ? "internal" : "public";
    } else if ((pkg.language === "typescript" || pkg.language === "javascript") && hasSrcDir && top === "src" && parts.length >= 2) {
      const second = parts[1]!;
      groupPath = `src/${second}`;
      groupName = second.replace(/\.(ts|tsx|js|jsx)$/, "");
      groupKind = parts.length > 2 ? "dir" : "file";
      visibility = second.includes("test") || second === "__tests__" ? "test" : "internal";
    } else {
      groupPath = top;
      groupName = top.replace(/\.[^.]+$/, "");
      groupKind = parts.length > 1 ? "dir" : "file";
      visibility = top === "tests" || top === "test" || top === "__tests__"
        ? "test"
        : top === "db" || top === "migrations" || top === "assets" || top === "shaders"
          ? "asset"
          : "public";
    }

    let entry = acc.get(groupPath);
    if (!entry) {
      entry = {
        path: groupPath,
        name: groupName,
        kind: groupKind,
        visibility,
        file_count: 0,
        source_files: 0,
        loc: 0,
        asset_counts: {},
      };
      acc.set(groupPath, entry);
    }

    const ext = path.extname(rel).toLowerCase();
    const absFile = path.join(pkgDir, rel);
    entry.file_count += 1;
    if (SOURCE_EXTS.has(ext)) {
      entry.source_files += 1;
      entry.loc += countLinesFast(absFile);
    } else if (ASSET_EXTS.has(ext)) {
      const key = ext.slice(1);
      entry.asset_counts[key] = (entry.asset_counts[key] ?? 0) + 1;
    }

    // Extract doc summary from the primary file of the module
    if (!entry.doc_summary) {
      if (pkg.language === "rust" && (rel === `${groupPath}.rs` || rel === `${groupPath}/mod.rs` || rel === groupPath)) {
        entry.doc_summary = extractRustDocHeader(absFile);
      } else if (pkg.language === "go" && (rel.endsWith("/doc.go") || rel.endsWith("/main.go"))) {
        entry.doc_summary = extractGoDocHeader(absFile);
      } else if (pkg.language === "python" && rel.endsWith("/__init__.py")) {
        entry.doc_summary = extractPythonDocHeader(absFile);
      }
    }
  }

  return [...acc.values()]
    .map((m): StructureModuleEntry => ({
      path: m.path,
      name: m.name,
      kind: m.kind,
      visibility: m.visibility,
      file_count: m.file_count,
      source_files: m.source_files,
      loc: m.loc,
      ...(Object.keys(m.asset_counts).length > 0 ? { asset_counts: m.asset_counts } : {}),
      ...(m.doc_summary ? { doc_summary: m.doc_summary } : {}),
    }))
    .sort((a, b) => b.loc - a.loc || b.file_count - a.file_count || a.path.localeCompare(b.path));
}

function computeTier(sourceFiles: number, totalLoc: number, modules: readonly StructureModuleEntry[]): OrientationTier {
  const significantModules = modules.filter((m) => m.visibility !== "test" && (m.source_files >= 1 || m.file_count >= 2)).length;
  if (sourceFiles <= 5 && significantModules < 3 && totalLoc < 800) {
    return "compact";
  }
  if (sourceFiles >= 30 || significantModules >= 8 || totalLoc >= 5000) {
    return "deep";
  }
  return "standard";
}

function detectWorkspaceHarnesses(repoDir: string, packageRoots: readonly PackageRoot[]): StructureEntrypoint[] {
  const harnesses: StructureEntrypoint[] = [];
  for (const pkg of packageRoots) {
    if (pkg.path.startsWith("examples/") || pkg.path.startsWith("tools/")) {
      const cmd =
        pkg.language === "rust"
          ? pkg.name === "xtask"
            ? "cargo xtask"
            : `cargo run -p ${pkg.name}`
          : pkg.language === "go"
            ? `go run ./${pkg.path}`
            : undefined;
      harnesses.push({
        path: pkg.path,
        name: pkg.name,
        kind: "harness",
        ...(cmd ? { command: cmd } : {}),
        summary: extractPackageDocSummary(path.join(repoDir, pkg.path), pkg.language),
      });
    }
  }
  return harnesses.sort((a, b) => a.path.localeCompare(b.path));
}

export function buildStructureEvidence(
  repoDir: string,
  allFiles: readonly string[],
  repository: RepositoryPin,
): StructureEvidence {
  const submodules: readonly SubmodulePin[] = repository.submodules ?? [];
  const subByPath = new Map<string, SubmodulePin>();
  for (const sm of submodules) {
    subByPath.set(toPosix(sm.path), sm);
  }

  // Group all repo files by their owning package root (longest prefix match)
  const filesByPkg = new Map<string, string[]>();
  for (const pkg of repository.package_roots) {
    filesByPkg.set(pkg.path, []);
  }

  const sortedNonRoot = repository.package_roots
    .filter((p) => p.path !== ".")
    .sort((a, b) => b.path.length - a.path.length);

  for (const absFile of allFiles) {
    const relRepo = toPosix(path.relative(repoDir, absFile));
    let matchedPkg = ".";
    for (const pkg of sortedNonRoot) {
      const prefix = toPosix(pkg.path);
      if (relRepo === prefix || relRepo.startsWith(prefix + "/")) {
        matchedPkg = pkg.path;
        break;
      }
    }
    const list = filesByPkg.get(matchedPkg);
    if (list) {
      const relToPkg = matchedPkg === "." ? relRepo : relRepo.slice(toPosix(matchedPkg).length + 1);
      if (relToPkg) list.push(relToPkg);
    }
  }

  const packages: PackageStructure[] = repository.package_roots.map((pkg) => {
    const pkgDir = pkg.path === "." ? repoDir : path.join(repoDir, pkg.path);
    const pkgFiles = (filesByPkg.get(pkg.path) ?? []).sort();

    let sourceFiles = 0;
    let totalLoc = 0;
    for (const rel of pkgFiles) {
      if (SOURCE_EXTS.has(path.extname(rel).toLowerCase())) {
        sourceFiles += 1;
        totalLoc += countLinesFast(path.join(pkgDir, rel));
      }
    }

    const sm = pkg.submodule_path ? subByPath.get(toPosix(pkg.submodule_path)) : undefined;
    const rawRemote = sm?.remote ?? repository.remote;
    const webUrl = normalizeGitWebUrl(rawRemote);
    const gitRef = sm?.commit ?? repository.commit;
    let repoSubpath: string | undefined;
    if (sm) {
      const smPosix = toPosix(sm.path);
      const pkgPosix = toPosix(pkg.path);
      if (pkgPosix.startsWith(smPosix + "/")) {
        repoSubpath = pkgPosix.slice(smPosix.length + 1);
      }
    } else if (pkg.path !== ".") {
      repoSubpath = toPosix(pkg.path);
    }

    const docSummary = extractPackageDocSummary(pkgDir, pkg.language);
    const entrypoints = detectEntrypoints(pkgDir, pkg, pkgFiles);
    const modules = buildModulesForPackage(pkgDir, pkg, pkgFiles);
    const flags = detectFlags(pkgDir, pkgFiles);
    const techStack = groupTechStack(pkg);
    const tier = computeTier(sourceFiles, totalLoc, modules);

    return {
      package_root: pkg.path,
      name: pkg.name,
      language: pkg.language,
      ...(pkg.repo_name ? { repo_name: pkg.repo_name } : {}),
      ...(webUrl ? { web_url: webUrl } : {}),
      ...(gitRef ? { git_ref: gitRef } : {}),
      ...(repoSubpath ? { repo_subpath: repoSubpath } : {}),
      ...(docSummary ? { doc_summary: docSummary } : {}),
      total_files: pkgFiles.length,
      source_files: sourceFiles,
      total_loc: totalLoc,
      tier,
      entrypoints,
      modules,
      ...(flags.length > 0 ? { flags } : {}),
      tech_stack: techStack,
    };
  });

  const workspaceHarnesses = detectWorkspaceHarnesses(repoDir, repository.package_roots);

  return {
    schema_version: 1,
    repo_name: repository.repo_name,
    commit: repository.commit,
    scanned_at: repository.scanned_at,
    ...(workspaceHarnesses.length > 0 ? { workspace_harnesses: workspaceHarnesses } : {}),
    packages,
  };
}
