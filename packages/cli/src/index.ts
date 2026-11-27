import fs from "node:fs";
import path from "node:path";
import {
  applyPlan,
  buildIndex,
  buildOrientBrief,
  checkPlanDrift,
  computeBaseLock,
  computeCompleteness,
  discoverWorkspaces,
  evaluatePlanGates,
  loadSpace,
  moveId,
  reconcilePlanAgainstSpace,
  resolveSpaceDir,
} from "@groundwork/core";
import type { PlanGate } from "@groundwork/schema";
import { scanRepository } from "@groundwork/scanner";
import { startServer } from "./server.js";

function printHelp(): void {
  console.log(`Groundwork CLI

Usage:
  groundwork serve [--port 3456]

  groundwork workspace list [--json]
  groundwork workspace init <dir> [--id <id>] [--name <name>] [--mode org|projects]
  groundwork workspace check <ws> [--project <id>] [--json]

  groundwork scan <repo-path> [--out <dir>] [--json]

  groundwork map find <query> --workspace <ws> [--project <id>] [--json]
  groundwork map show <id> --workspace <ws> [--project <id>] [--json]
  groundwork map calls <id> --workspace <ws> [--project <id>] [--json]
  groundwork map callers <id> --workspace <ws> [--project <id>] [--json]
  groundwork map gaps --workspace <ws> [--project <id>] [--json]
  groundwork map completeness --workspace <ws> [--project <id>] [--json]

  groundwork orient list --workspace <ws> [--project <id>] [--missing] [--json]
  groundwork orient brief <component-id> --workspace <ws> [--project <id>] [--json]

  groundwork plan check <plan-id> --workspace <ws> [--project <id>] [--gate draft|ready] [--json]
  groundwork plan diff <plan-id> --workspace <ws> [--project <id>] [--json]
  groundwork plan lock-base <plan-id> --workspace <ws> [--project <id>]
  groundwork plan land <plan-id> --workspace <ws> [--project <id>] [--json]

  groundwork id move <old-id> <new-id> --workspace <ws> [--project <id>] [--dry-run] [--json]
`);
}

function getFlag(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx !== -1 && args[idx + 1] && !args[idx + 1]!.startsWith("--")) {
    return args[idx + 1];
  }
  return undefined;
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function findGroundworkRoot(): string {
  return process.cwd();
}

function resolveSpaceFromArgs(args: string[], positionalWs?: string) {
  const root = findGroundworkRoot();
  const wsArg = positionalWs ?? getFlag(args, "--workspace");
  const projectArg = getFlag(args, "--project");
  const all = discoverWorkspaces(root);
  if (!wsArg) {
    throw new Error(`Missing --workspace <id>. Registered workspaces: ${all.map((w) => w.id).join(", ") || "(none)"}`);
  }
  const found = all.find((w) => w.id === wsArg || w.id === `workspace:${wsArg}`);
  if (!found) {
    throw new Error(`Workspace '${wsArg}' not found. Available: ${all.map((w) => w.id).join(", ")}`);
  }
  const spaceDir = resolveSpaceDir(found, projectArg);
  return { workspace: found, spaceDir, space: loadSpace(spaceDir) };
}

function main(): void {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const asJson = hasFlag(args, "--json");

  if (!cmd || cmd === "--help" || cmd === "-h") {
    printHelp();
    process.exit(0);
  }

  try {
    if (cmd === "serve") {
      const port = Number(getFlag(args, "--port") ?? "3456");
      const root = findGroundworkRoot();
      const uiDistDir = path.join(root, "packages", "ui", "dist");
      startServer({ groundworkRoot: root, port, uiDistDir });
      return;
    }

    if (cmd === "scan") {
      const repoPath = args[1];
      if (!repoPath) throw new Error("Missing <repo-path>");
      const outDir = getFlag(args, "--out");
      const result = scanRepository(repoPath, { outDir });
      if (asJson) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      const { repository, inventory, anchors } = result;
      console.log(`=== Groundwork Scan: ${repository.repo_name} ===`);
      console.log(`Commit:   ${repository.commit.slice(0, 12)} (${repository.branch}${repository.dirty ? ", dirty" : ""})`);
      console.log(`Packages: ${repository.package_roots.length}`);
      console.log(`Surfaces: ${inventory.summary.total_surfaces} total (${Object.keys(anchors.anchors).length} cite anchors)`);
      for (const cc of inventory.cross_checks) {
        console.log(`Cross-check [${cc.facet}]: spec=${cc.spec_count}, code=${cc.code_count}, matched=${cc.matched}, spec_only=${cc.spec_only.length}, code_only=${cc.code_only.length}`);
      }
      if (outDir) console.log(`Wrote repository.json, inventory.json, cite-anchors.json, structure.json -> ${outDir}`);
      return;
    }

    if (cmd === "workspace") {
      const sub = args[1];
      const root = findGroundworkRoot();
      if (sub === "list") {
        const list = discoverWorkspaces(root);
        if (asJson) {
          console.log(JSON.stringify(list, null, 2));
          return;
        }
        for (const ws of list) {
          console.log(`${ws.id}  (${ws.mode}, ${ws.source})  ${ws.root_dir}${ws.projects.length ? `  projects: ${ws.projects.join(", ")}` : ""}`);
        }
        return;
      }

      if (sub === "init") {
        const targetDir = args[2];
        if (!targetDir) throw new Error("Missing <dir>");
        const absDir = path.resolve(targetDir);
        const slug = path.basename(absDir);
        const id = getFlag(args, "--id") ?? `workspace:${slug}`;
        const name = getFlag(args, "--name") ?? slug;
        const mode = getFlag(args, "--mode") ?? "org";

        fs.mkdirSync(absDir, { recursive: true });
        if (mode === "projects") {
          fs.mkdirSync(path.join(absDir, "projects"), { recursive: true });
          fs.mkdirSync(path.join(absDir, "shared", "externals"), { recursive: true });
          fs.writeFileSync(
            path.join(absDir, "workspace.yaml"),
            `schema_version: 1\nid: ${id}\nname: ${name}\nprojects: []\n`,
          );
        } else {
          for (const d of ["systems", "externals", "flows", "plans", "evidence", "unassigned/stores", "unassigned/topics"]) {
            fs.mkdirSync(path.join(absDir, d), { recursive: true });
          }
          fs.writeFileSync(
            path.join(absDir, "workspace.yaml"),
            `schema_version: 1\nid: ${id}\nname: ${name}\nrepos: {}\n`,
          );
        }
        const ptrFile = path.join(root, "workspaces", `${slug}.yaml`);
        fs.mkdirSync(path.dirname(ptrFile), { recursive: true });
        fs.writeFileSync(
          ptrFile,
          `schema_version: 1\nid: ${id}\nname: ${name}\nroot: ${path.relative(path.dirname(ptrFile), absDir)}\n`,
        );
        console.log(`Initialized ${mode} workspace ${id} at ${absDir} and registered pointer ${ptrFile}`);
        return;
      }

      if (sub === "check") {
        const wsArg = args[2];
        const { space } = resolveSpaceFromArgs(args, wsArg);
        const index = buildIndex(space);
        const completeness = computeCompleteness(space);
        const orientationProblems = completeness.components.flatMap((c) => c.orientation?.problems ?? []);
        const allProblems = [...space.problems, ...orientationProblems];
        const planReports = space.plans.map((p) => evaluatePlanGates(space, p, p.manifest.status));
        const output = {
          space_id: space.config.id,
          problems: allProblems,
          gaps_count: index.gaps.length,
          completeness: completeness.summary,
          plans: planReports.map((r) => ({ plan_id: r.plan_id, gate: r.target_gate, passed: r.passed, violations: r.violations.length })),
        };
        if (asJson) {
          console.log(JSON.stringify(output, null, 2));
        } else {
          console.log(`Workspace check: ${space.config.id}`);
          console.log(`  Problems: ${allProblems.length} (${allProblems.filter((p) => p.severity === "error").length} errors, ${allProblems.filter((p) => p.severity === "warning").length} warnings)`);
          for (const p of allProblems) console.log(`    [${p.severity}] ${p.code}: ${p.message}`);
          console.log(`  Systems: ${space.systems.length}, Components: ${completeness.summary.total_components}, Edges: ${index.edges.length}, Gaps: ${index.gaps.length}`);
          for (const pr of planReports) {
            console.log(`  Plan ${pr.plan_id} (gate: ${pr.target_gate}): ${pr.passed ? "PASS" : "FAIL"} (${pr.violations.length} findings)`);
          }
        }
        const hasErrors = allProblems.some((p) => p.severity === "error") || planReports.some((r) => !r.passed);
        if (hasErrors) process.exit(1);
        return;
      }
    }

    if (cmd === "orient") {
      const sub = args[1];
      const { space } = resolveSpaceFromArgs(args);
      const index = buildIndex(space);

      if (sub === "list") {
        const onlyMissing = hasFlag(args, "--missing");
        const report = computeCompleteness(space);
        const rows = report.components
          .map((c) => c.orientation)
          .filter((o): o is NonNullable<typeof o> => Boolean(o))
          .filter((o) => (!onlyMissing ? true : o.orientation_required && (!o.has_orientation || o.coverage_pct < 80 || o.broken_paths.length > 0)));
        if (asJson) {
          console.log(JSON.stringify(rows, null, 2));
          return;
        }
        console.log(`Orientation status for ${space.config.id} (${rows.length} components):`);
        for (const r of rows) {
          const status = !r.orientation_required
            ? "compact (optional)"
            : !r.has_orientation
              ? "MISSING"
              : r.broken_paths.length > 0
                ? `BROKEN (${r.broken_paths.length} paths)`
                : `${r.zone_count} zones · ${r.coverage_pct}% modules`;
          console.log(`  - ${r.component_id} [${r.tier}] ${status}${r.mechanical_does ? " (mechanical does)" : ""}`);
        }
        return;
      }

      if (sub === "brief") {
        const compId = args[2];
        if (!compId) throw new Error("Missing <component-id>");
        const brief = buildOrientBrief(space, index, compId);
        if (!brief) throw new Error(`Component not found: ${compId}`);
        if (asJson) {
          console.log(JSON.stringify(brief, null, 2));
          return;
        }
        console.log(`=== Orient Brief: ${brief.component_id} (${brief.tier}) ===`);
        console.log(`Footprint: ${brief.footprint.source_files} source files, ${brief.footprint.total_loc} LOC`);
        if (brief.doc_summary) console.log(`Doc: ${brief.doc_summary}`);
        console.log(`Entrypoints (${brief.entrypoints.length}): ${brief.entrypoints.map((e) => e.path).join(", ") || "none"}`);
        console.log(`Top Modules (${brief.modules.length}):`);
        for (const m of brief.modules.slice(0, 12)) {
          console.log(`  - ${m.path} [${m.visibility}] ${m.source_files} files, ${m.loc} LOC${m.assigned_zone ? ` -> zone:${m.assigned_zone}` : " (unassigned)"}`);
        }
        if (brief.flags.length > 0) console.log(`Flags: ${brief.flags.join(", ")}`);
        return;
      }
    }

    if (cmd === "map") {
      const sub = args[1];
      const { space } = resolveSpaceFromArgs(args);
      const index = buildIndex(space);

      if (sub === "find") {
        const query = args[2] ?? "";
        const hits = index.find(query);
        if (asJson) {
          console.log(JSON.stringify(hits.map((h) => ({ id: h.id, kind: h.kind, name: h.name, system_id: h.system_id })), null, 2));
          return;
        }
        for (const h of hits) console.log(`${h.id}  [${h.kind}]  ${h.name}`);
        return;
      }

      if (sub === "show") {
        const id = args[2];
        if (!id) throw new Error("Missing <id>");
        const ent = index.get(id);
        if (!ent) throw new Error(`Entity not found: ${id}`);
        console.log(JSON.stringify(ent, null, 2));
        return;
      }

      if (sub === "calls" || sub === "callers") {
        const id = args[2];
        if (!id) throw new Error("Missing <id>");
        const edges = sub === "calls" ? index.callsOf(id) : index.callersOf(id);
        if (asJson) {
          console.log(JSON.stringify(edges, null, 2));
          return;
        }
        for (const e of edges) console.log(`${e.from} --[${e.kind}: ${e.via}]--> ${e.to}`);
        return;
      }

      if (sub === "gaps") {
        if (asJson) {
          console.log(JSON.stringify(index.gaps, null, 2));
          return;
        }
        for (const g of index.gaps) console.log(`[${g.kind}] ${g.entity_id}: ${g.detail}`);
        return;
      }

      if (sub === "completeness") {
        const report = computeCompleteness(space);
        if (asJson) {
          console.log(JSON.stringify(report, null, 2));
          return;
        }
        console.log(`Completeness for ${report.space_id}:`);
        console.log(`  Unclaimed repos: ${report.unclaimed_repos.join(", ") || "none"}`);
        console.log(`  Unclaimed packages: ${report.unclaimed_package_roots.join(", ") || "none"}`);
        for (const c of report.components) {
          console.log(`  - ${c.component_id} [depth=${c.depth}] accounted=${c.accounted_pct}% deferred=${c.has_deferred} unpromoted_edges=${c.unpromoted_observed_edges}`);
        }
        return;
      }
    }

    if (cmd === "plan") {
      const sub = args[1];
      const planIdArg = args[2];
      if (!planIdArg) throw new Error("Missing <plan-id>");
      const planId = planIdArg.startsWith("plan:") ? planIdArg : `plan:${planIdArg}`;
      const { space } = resolveSpaceFromArgs(args);
      const plan = space.plans.find((p) => p.id === planId);
      if (!plan) throw new Error(`Plan not found: ${planId}`);

      if (sub === "check") {
        const gate = (getFlag(args, "--gate") ?? plan.manifest.status) as PlanGate;
        const report = evaluatePlanGates(space, plan, gate);
        if (asJson) {
          console.log(JSON.stringify(report, null, 2));
        } else {
          console.log(`Plan ${plan.id} gate=${gate}: ${report.passed ? "PASS" : "FAIL"}`);
          for (const v of report.violations) console.log(`  [${v.severity}] (${v.gate}) ${v.message}`);
        }
        if (!report.passed) process.exit(1);
        return;
      }

      if (sub === "diff") {
        const res = applyPlan(space, plan.id);
        const drift = checkPlanDrift(plan, res.before);
        const out = { plan_id: plan.id, drift, diff: res.diff, errors: res.errors };
        if (asJson) {
          console.log(JSON.stringify(out, null, 2));
          return;
        }
        console.log(`Plan diff for ${plan.id} (drift: ${drift.status}):`);
        for (const d of res.diff) console.log(`  [${d.kind}] ${d.entity_id} (${d.change_id})${d.detail ? ` — ${d.detail}` : ""}`);
        for (const e of res.errors) console.log(`  [error] ${e}`);
        return;
      }

      if (sub === "lock-base") {
        const res = applyPlan(space, plan.id);
        const lock = computeBaseLock(plan, res.before);
        const lockPath = path.join(path.dirname(path.resolve(plan.dir, plan.manifest.pillars.architecture.file)), ".base-lock.json");
        fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");
        console.log(`Wrote ${lockPath} (${Object.keys(lock.targets).length} targets, ${Object.keys(lock.relies_on).length} relies_on)`);
        return;
      }

      if (sub === "land") {
        const recon = reconcilePlanAgainstSpace(space, plan);
        if (asJson) {
          console.log(JSON.stringify(recon, null, 2));
          return;
        }
        console.log(`Reconciliation for ${plan.id}:`);
        for (const c of recon.changes) {
          console.log(`  [${c.status}] ${c.change_id}`);
          for (const d of c.details) console.log(`    - ${d}`);
        }
        return;
      }
    }

    if (cmd === "id" && args[1] === "move") {
      const oldId = args[2];
      const newId = args[3];
      if (!oldId || !newId) throw new Error("Usage: groundwork id move <old-id> <new-id> --workspace <ws>");
      const { spaceDir } = resolveSpaceFromArgs(args);
      const res = moveId(spaceDir, oldId, newId, { dryRun: hasFlag(args, "--dry-run") });
      if (asJson) {
        console.log(JSON.stringify(res, null, 2));
      } else {
        console.log(`${res.dry_run ? "[DRY RUN] " : ""}Moved ${oldId} -> ${newId}: ${res.total_replacements} replacements across ${res.files_changed.length} files`);
        for (const f of res.files_changed) console.log(`  - ${f.file} (${f.replacements})`);
      }
      return;
    }

    console.error(`Unknown command: ${args.join(" ")}`);
    printHelp();
    process.exit(1);
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main();
