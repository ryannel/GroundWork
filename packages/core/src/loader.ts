import fs from "node:fs";
import path from "node:path";
import {
  qualifyId,
  validateCiteAnchors,
  validateComponentFile,
  validateContractsFile,
  validateDomainsFile,
  validateExternalFile,
  validateFlowFile,
  validateHandlersFile,
  validateOrientationFile,
  validatePlanChanges,
  validatePlanDesign,
  validatePlanExecution,
  validatePlanManifest,
  validatePlanProof,
  validateRepositoryPin,
  validateReviewNote,
  validateScreensFile,
  validateStoreFile,
  validateStructureEvidence,
  validateSurfaceInventory,
  validateSystemFile,
  validateTopicFile,
  validateWorkspaceFile,
  type CiteAnchorsFile,
  type ComponentFile,
  type ContractsFile,
  type DomainDef,
  type DomainsFile,
  type ExternalFile,
  type FlowFile,
  type HandlersFile,
  type OrientationFile,
  type PlanBaseLockFile,
  type PlanChangesFile,
  type PlanDesignFile,
  type PlanExecutionFile,
  type PlanManifestFile,
  type PlanProgressFile,
  type PlanProofFile,
  type RepositoryPin,
  type ReviewNoteFile,
  type ScreensFile,
  type SpaceConfig,
  type StoreFile,
  type StructureEvidence,
  type SurfaceInventory,
  type SystemFile,
  type TopicFile,
} from "@groundwork/schema";
import { defaultFileCache, type IncrementalFileCache } from "./file-cache.js";
import type {
  LoadedComponent,
  LoadedExternal,
  LoadedPlan,
  LoadedSystem,
  RepoEvidence,
  SpaceModel,
  SpaceProblem,
} from "./model.js";

function listSubdirs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

function listYamlFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((f) => f.isFile() && (f.name.endsWith(".yaml") || f.name.endsWith(".yml")))
    .map((f) => f.name)
    .sort();
}

function qualifyContracts(contracts: ContractsFile, scopeSlug: string): ContractsFile {
  return {
    interfaces: (contracts.interfaces ?? []).map((iface) => ({
      ...iface,
      id: qualifyId("interface", iface.id, scopeSlug),
      entries: iface.entries.map((entry) => ({
        ...entry,
        id: qualifyId("endpoint", entry.id, scopeSlug),
      })),
    })),
    subscriptions: (contracts.subscriptions ?? []).map((sub) => ({
      ...sub,
      id: qualifyId("subscription", sub.id, scopeSlug),
    })),
    jobs: (contracts.jobs ?? []).map((job) => ({
      ...job,
      id: qualifyId("job", job.id, scopeSlug),
    })),
    interactions: (contracts.interactions ?? []).map((inter) => ({
      ...inter,
      id: qualifyId("interaction", inter.id, scopeSlug),
    })),
    schemas: (contracts.schemas ?? []).map((sch) => ({
      ...sch,
      id: qualifyId("schema", sch.id, scopeSlug),
    })),
  };
}

function qualifyStore(store: StoreFile): StoreFile {
  const id = qualifyId("store", store.id);
  const storeSlug = id.replace(/^store:/, "");
  return {
    ...store,
    id,
    records: (store.records ?? []).map((r) => ({
      ...r,
      id: qualifyId("schema", r.id, storeSlug),
    })),
  };
}

function qualifyTopic(topic: TopicFile): TopicFile {
  const id = qualifyId("topic", topic.id);
  const topicSlug = id.replace(/^topic:/, "");
  return {
    ...topic,
    id,
    messages: (topic.messages ?? []).map((m) => ({
      ...m,
      id: qualifyId("message", m.id, topicSlug),
    })),
  };
}

function qualifyHandlers(handlers: HandlersFile, compSlug: string): HandlersFile {
  return {
    procedures: (handlers.procedures ?? []).map((p) => ({
      ...p,
      id: qualifyId("procedure", p.id, compSlug),
    })),
    handlers: (handlers.handlers ?? []).map((h) => ({
      ...h,
      id: qualifyId("handler", h.id, compSlug),
    })),
  };
}

function qualifyScreens(screens: ScreensFile, compSlug: string): ScreensFile {
  return {
    screens: (screens.screens ?? []).map((s) => ({
      ...s,
      id: qualifyId("screen", s.id, compSlug),
    })),
  };
}

function loadSystemsDir(
  systemsDir: string,
  cache: IncrementalFileCache,
  problems: SpaceProblem[],
): LoadedSystem[] {
  const systems: LoadedSystem[] = [];

  for (const sysSlug of listSubdirs(systemsDir)) {
    const sysDir = path.join(systemsDir, sysSlug);
    const sysYamlPath = path.join(sysDir, "system.yaml");
    const rawSys = cache.readYaml<SystemFile>(sysYamlPath);
    if (!rawSys) {
      problems.push({
        severity: "error",
        code: "missing_system_yaml",
        file: sysYamlPath,
        message: `System directory ${sysSlug} is missing system.yaml`,
      });
      continue;
    }
    const sysCheck = validateSystemFile(rawSys);
    if (!sysCheck.valid) {
      problems.push({
        severity: "error",
        code: "invalid_system_yaml",
        file: sysYamlPath,
        message: sysCheck.errors.join("; "),
      });
    }
    const systemId = qualifyId("system", rawSys.id);
    const system: SystemFile = { ...rawSys, id: systemId };

    // Optional stub contracts for mapped: false systems
    let stub_contracts: ContractsFile | undefined;
    const stubContractsPath = path.join(sysDir, "contracts.yaml");
    const rawStubContracts = cache.readYaml<ContractsFile>(stubContractsPath);
    if (rawStubContracts) {
      const cCheck = validateContractsFile(rawStubContracts);
      if (!cCheck.valid) {
        problems.push({
          severity: "error",
          code: "invalid_contracts_yaml",
          file: stubContractsPath,
          message: cCheck.errors.join("; "),
        });
      }
      stub_contracts = qualifyContracts(rawStubContracts, sysSlug);
    }

    // Components
    const components: LoadedComponent[] = [];
    const componentsDir = path.join(sysDir, "components");
    for (const compSlug of listSubdirs(componentsDir)) {
      const compDir = path.join(componentsDir, compSlug);
      const compYamlPath = path.join(compDir, "component.yaml");
      const rawComp = cache.readYaml<ComponentFile>(compYamlPath);
      if (!rawComp) {
        problems.push({
          severity: "error",
          code: "missing_component_yaml",
          file: compYamlPath,
          message: `Component directory ${compSlug} is missing component.yaml`,
        });
        continue;
      }
      const compCheck = validateComponentFile(rawComp);
      if (!compCheck.valid) {
        problems.push({
          severity: "error",
          code: "invalid_component_yaml",
          file: compYamlPath,
          message: compCheck.errors.join("; "),
        });
      }
      const compPrefix = rawComp.kind === "app" ? "app" : rawComp.kind === "module" ? "module" : "service";
      const compId = qualifyId(compPrefix, rawComp.id);
      const canonicalSlug = compId.replace(/^(?:service|app|module):/, "");

      const contractsPath = path.join(compDir, "contracts.yaml");
      const rawContracts = cache.readYaml<ContractsFile>(contractsPath);
      if (rawContracts) {
        const res = validateContractsFile(rawContracts);
        if (!res.valid) {
          problems.push({ severity: "error", code: "invalid_contracts_yaml", file: contractsPath, message: res.errors.join("; ") });
        }
      }
      const contracts = qualifyContracts(rawContracts ?? {}, canonicalSlug);

      const screensPath = path.join(compDir, "screens.yaml");
      const rawScreens = cache.readYaml<ScreensFile>(screensPath);
      if (rawScreens) {
        const res = validateScreensFile(rawScreens);
        if (!res.valid) {
          problems.push({ severity: "error", code: "invalid_screens_yaml", file: screensPath, message: res.errors.join("; ") });
        }
      }
      const screens = qualifyScreens(rawScreens ?? { screens: [] }, canonicalSlug);

      // Load handlers.yaml plus optional handlers/*.yaml (for oversized handlers)
      const handlersPath = path.join(compDir, "handlers.yaml");
      const rawHandlers = cache.readYaml<HandlersFile>(handlersPath);
      if (rawHandlers) {
        const res = validateHandlersFile(rawHandlers);
        if (!res.valid) {
          problems.push({ severity: "error", code: "invalid_handlers_yaml", file: handlersPath, message: res.errors.join("; ") });
        }
      }
      const mergedHandlers: HandlersFile = {
        procedures: [...(rawHandlers?.procedures ?? [])],
        handlers: [...(rawHandlers?.handlers ?? [])],
      };
      const splitHandlersDir = path.join(compDir, "handlers");
      for (const hf of listYamlFiles(splitHandlersDir)) {
        const hPath = path.join(splitHandlersDir, hf);
        const splitRaw = cache.readYaml<HandlersFile>(hPath);
        if (splitRaw) {
          const res = validateHandlersFile(splitRaw);
          if (!res.valid) {
            problems.push({ severity: "error", code: "invalid_handlers_yaml", file: hPath, message: res.errors.join("; ") });
          }
          (mergedHandlers.procedures as unknown[]).push(...(splitRaw.procedures ?? []));
          (mergedHandlers.handlers as unknown[]).push(...(splitRaw.handlers ?? []));
        }
      }
      const handlers = qualifyHandlers(mergedHandlers, canonicalSlug);

      const orientationPath = path.join(compDir, "orientation.yaml");
      const rawOrientation = cache.readYaml<OrientationFile>(orientationPath);
      if (rawOrientation) {
        const res = validateOrientationFile(rawOrientation);
        if (!res.valid) {
          problems.push({
            severity: "error",
            code: "invalid_orientation_yaml",
            file: orientationPath,
            entity_id: compId,
            message: res.errors.join("; "),
          });
        }
      }

      components.push({
        id: compId,
        slug: canonicalSlug,
        system_id: systemId,
        dir: compDir,
        component: { ...rawComp, id: compId },
        contracts,
        screens,
        handlers,
        ...(rawOrientation ? { orientation: rawOrientation } : {}),
      });
    }

    // Stores
    const stores: StoreFile[] = [];
    const storesDir = path.join(sysDir, "stores");
    for (const sf of listYamlFiles(storesDir)) {
      const sPath = path.join(storesDir, sf);
      const rawStore = cache.readYaml<StoreFile>(sPath);
      if (!rawStore) continue;
      const res = validateStoreFile(rawStore);
      if (!res.valid) {
        problems.push({ severity: "error", code: "invalid_store_yaml", file: sPath, message: res.errors.join("; ") });
      }
      stores.push(qualifyStore(rawStore));
    }

    // Topics
    const topics: TopicFile[] = [];
    const topicsDir = path.join(sysDir, "topics");
    for (const tf of listYamlFiles(topicsDir)) {
      const tPath = path.join(topicsDir, tf);
      const rawTopic = cache.readYaml<TopicFile>(tPath);
      if (!rawTopic) continue;
      const res = validateTopicFile(rawTopic);
      if (!res.valid) {
        problems.push({ severity: "error", code: "invalid_topic_yaml", file: tPath, message: res.errors.join("; ") });
      }
      topics.push(qualifyTopic(rawTopic));
    }

    systems.push({
      id: systemId,
      slug: sysSlug,
      dir: sysDir,
      system,
      ...(stub_contracts ? { stub_contracts } : {}),
      components,
      stores,
      topics,
    });
  }

  return systems;
}

function loadExternalsDir(
  externalsDir: string,
  cache: IncrementalFileCache,
  problems: SpaceProblem[],
): LoadedExternal[] {
  const results: LoadedExternal[] = [];
  for (const slug of listSubdirs(externalsDir)) {
    const extDir = path.join(externalsDir, slug);
    const extPath = path.join(extDir, "external.yaml");
    const rawExt = cache.readYaml<ExternalFile>(extPath);
    if (!rawExt) continue;
    const res = validateExternalFile(rawExt);
    if (!res.valid) {
      problems.push({ severity: "error", code: "invalid_external_yaml", file: extPath, message: res.errors.join("; ") });
    }
    const extId = qualifyId("external", rawExt.id);
    const contractsPath = path.join(extDir, "contracts.yaml");
    const rawContracts = cache.readYaml<ContractsFile>(contractsPath);
    if (rawContracts) {
      const cRes = validateContractsFile(rawContracts);
      if (!cRes.valid) {
        problems.push({ severity: "error", code: "invalid_contracts_yaml", file: contractsPath, message: cRes.errors.join("; ") });
      }
    }
    results.push({
      id: extId,
      slug,
      external: { ...rawExt, id: extId },
      contracts: qualifyContracts(rawContracts ?? {}, slug),
    });
  }
  return results;
}

function loadFlowsDir(
  flowsDir: string,
  cache: IncrementalFileCache,
  problems: SpaceProblem[],
): FlowFile[] {
  const flows: FlowFile[] = [];
  for (const ff of listYamlFiles(flowsDir)) {
    const fPath = path.join(flowsDir, ff);
    const raw = cache.readYaml<FlowFile>(fPath);
    if (!raw) continue;
    const res = validateFlowFile(raw);
    if (!res.valid) {
      problems.push({ severity: "error", code: "invalid_flow_yaml", file: fPath, message: res.errors.join("; ") });
    }
    flows.push({ ...raw, id: qualifyId("flow", raw.id) });
  }
  return flows;
}

function loadPlansDir(
  plansDir: string,
  cache: IncrementalFileCache,
  problems: SpaceProblem[],
): LoadedPlan[] {
  const plans: LoadedPlan[] = [];
  for (const slug of listSubdirs(plansDir)) {
    const planDir = path.join(plansDir, slug);
    const manifestPath = path.join(planDir, "plan.yaml");
    const rawManifest = cache.readYaml<PlanManifestFile>(manifestPath);
    if (!rawManifest) {
      problems.push({ severity: "error", code: "missing_plan_yaml", file: manifestPath, message: `Plan ${slug} missing plan.yaml` });
      continue;
    }
    const mRes = validatePlanManifest(rawManifest);
    if (!mRes.valid) {
      problems.push({ severity: "error", code: "invalid_plan_yaml", file: manifestPath, message: mRes.errors.join("; ") });
    }
    const planId = qualifyId("plan", rawManifest.id);

    const changesPath = path.resolve(planDir, rawManifest.pillars.architecture.file);
    const changes = cache.readYaml<PlanChangesFile>(changesPath) ?? { schema_version: 1, changes: [] };
    const chRes = validatePlanChanges(changes);
    if (!chRes.valid) {
      problems.push({ severity: "error", code: "invalid_plan_changes", file: changesPath, message: chRes.errors.join("; ") });
    }

    let additions_systems: LoadedSystem[] = [];
    let additions_flows: FlowFile[] = [];
    if (rawManifest.pillars.architecture.additions) {
      const addDir = path.resolve(planDir, rawManifest.pillars.architecture.additions);
      additions_systems = loadSystemsDir(path.join(addDir, "systems"), cache, problems);
      additions_flows = loadFlowsDir(path.join(addDir, "flows"), cache, problems);
    }

    const baseLockPath = path.join(path.dirname(changesPath), ".base-lock.json");
    const base_lock = cache.readJson<PlanBaseLockFile>(baseLockPath);

    let design: PlanDesignFile | undefined;
    if (rawManifest.pillars.design.applicable) {
      const designPath = path.resolve(planDir, rawManifest.pillars.design.file);
      const rawDesign = cache.readYaml<PlanDesignFile>(designPath);
      if (rawDesign) {
        const dRes = validatePlanDesign(rawDesign);
        if (!dRes.valid) {
          problems.push({ severity: "error", code: "invalid_plan_design", file: designPath, message: dRes.errors.join("; ") });
        }
        design = rawDesign;
      } else {
        problems.push({ severity: "error", code: "missing_plan_design", file: designPath, message: `Design pillar file missing: ${designPath}` });
      }
    }

    const execPath = path.resolve(planDir, rawManifest.pillars.execution.file);
    const execution = cache.readYaml<PlanExecutionFile>(execPath) ?? { schema_version: 1, milestones: [], work_items: [] };
    const eRes = validatePlanExecution(execution);
    if (!eRes.valid) {
      problems.push({ severity: "error", code: "invalid_plan_execution", file: execPath, message: eRes.errors.join("; ") });
    }

    const progressPath = rawManifest.pillars.execution.progress
      ? path.resolve(planDir, rawManifest.pillars.execution.progress)
      : path.join(path.dirname(execPath), "progress.yaml");
    const progress = cache.readYaml<PlanProgressFile>(progressPath);

    const proofPath = path.resolve(planDir, rawManifest.pillars.proof.file);
    const proof = cache.readYaml<PlanProofFile>(proofPath) ?? { schema_version: 1, tests: [] };
    const pRes = validatePlanProof(proof);
    if (!pRes.valid) {
      problems.push({ severity: "error", code: "invalid_plan_proof", file: proofPath, message: pRes.errors.join("; ") });
    }

    const reviews: ReviewNoteFile[] = [];
    const reviewsDir = path.join(planDir, "reviews");
    for (const rf of listYamlFiles(reviewsDir)) {
      const rPath = path.join(reviewsDir, rf);
      const rawRev = cache.readYaml<ReviewNoteFile>(rPath);
      if (!rawRev) continue;
      const rRes = validateReviewNote(rawRev);
      if (!rRes.valid) {
        problems.push({ severity: "error", code: "invalid_review_note", file: rPath, message: rRes.errors.join("; ") });
      }
      reviews.push(rawRev);
    }

    plans.push({
      id: planId,
      slug,
      dir: planDir,
      manifest: { ...rawManifest, id: planId },
      changes,
      additions_systems,
      additions_flows,
      ...(base_lock ? { base_lock } : {}),
      ...(design ? { design } : {}),
      execution,
      ...(progress ? { progress } : {}),
      proof,
      reviews,
    });
  }
  return plans;
}

export function loadSpace(
  spaceDir: string,
  cache: IncrementalFileCache = defaultFileCache,
): SpaceModel {
  const absDir = path.resolve(spaceDir);
  const problems: SpaceProblem[] = [];

  const configPath = fs.existsSync(path.join(absDir, "project.yaml"))
    ? path.join(absDir, "project.yaml")
    : path.join(absDir, "workspace.yaml");
  const rawConfig = cache.readYaml<SpaceConfig>(configPath);
  if (!rawConfig) {
    throw new Error(`No workspace.yaml or project.yaml found in ${absDir}`);
  }
  const cfgRes = validateWorkspaceFile(rawConfig);
  if (!cfgRes.valid) {
    problems.push({ severity: "error", code: "invalid_space_config", file: configPath, message: cfgRes.errors.join("; ") });
  }

  // Domains
  const domainsPath = path.join(absDir, "domains.yaml");
  let domains: DomainDef[] = [];
  const rawDomains = cache.readYaml<DomainsFile>(domainsPath);
  if (rawDomains) {
    const dRes = validateDomainsFile(rawDomains);
    if (!dRes.valid) {
      problems.push({ severity: "error", code: "invalid_domains_yaml", file: domainsPath, message: dRes.errors.join("; ") });
    }
    domains = rawDomains.domains.map((d) => ({ ...d, id: qualifyId("domain", d.id) }));
  }

  // Systems
  const systems = loadSystemsDir(path.join(absDir, "systems"), cache, problems);

  // Externals (space-local + optional parent workspace shared/externals for multi-project spaces)
  const externalsById = new Map<string, LoadedExternal>();
  const parentSharedExternals = path.resolve(absDir, "..", "..", "shared", "externals");
  if (path.basename(path.dirname(absDir)) === "projects" && fs.existsSync(parentSharedExternals)) {
    for (const ext of loadExternalsDir(parentSharedExternals, cache, problems)) {
      externalsById.set(ext.id, ext);
    }
  }
  for (const ext of loadExternalsDir(path.join(absDir, "externals"), cache, problems)) {
    externalsById.set(ext.id, ext);
  }
  const externals = [...externalsById.values()].sort((a, b) => a.id.localeCompare(b.id));

  // Unassigned stores & topics
  const unassigned_stores: StoreFile[] = [];
  const unassignedStoresDir = path.join(absDir, "unassigned", "stores");
  for (const sf of listYamlFiles(unassignedStoresDir)) {
    const sPath = path.join(unassignedStoresDir, sf);
    const rawStore = cache.readYaml<StoreFile>(sPath);
    if (rawStore) {
      const res = validateStoreFile(rawStore);
      if (!res.valid) problems.push({ severity: "error", code: "invalid_store_yaml", file: sPath, message: res.errors.join("; ") });
      unassigned_stores.push(qualifyStore(rawStore));
    }
  }

  const unassigned_topics: TopicFile[] = [];
  const unassignedTopicsDir = path.join(absDir, "unassigned", "topics");
  for (const tf of listYamlFiles(unassignedTopicsDir)) {
    const tPath = path.join(unassignedTopicsDir, tf);
    const rawTopic = cache.readYaml<TopicFile>(tPath);
    if (rawTopic) {
      const res = validateTopicFile(rawTopic);
      if (!res.valid) problems.push({ severity: "error", code: "invalid_topic_yaml", file: tPath, message: res.errors.join("; ") });
      unassigned_topics.push(qualifyTopic(rawTopic));
    }
  }

  // Flows
  const flows = loadFlowsDir(path.join(absDir, "flows"), cache, problems);

  // Evidence
  const evidence: Record<string, RepoEvidence> = {};
  const evidenceDir = path.join(absDir, "evidence");
  for (const repoKey of listSubdirs(evidenceDir)) {
    const rDir = path.join(evidenceDir, repoKey);
    const repoPin = cache.readJson<RepositoryPin>(path.join(rDir, "repository.json"));
    if (!repoPin) continue;
    const rpRes = validateRepositoryPin(repoPin);
    if (!rpRes.valid) {
      problems.push({ severity: "error", code: "invalid_repository_json", file: path.join(rDir, "repository.json"), message: rpRes.errors.join("; ") });
    }
    const inventory = cache.readJson<SurfaceInventory>(path.join(rDir, "inventory.json"));
    if (inventory) {
      const iRes = validateSurfaceInventory(inventory);
      if (!iRes.valid) {
        problems.push({ severity: "error", code: "invalid_inventory_json", file: path.join(rDir, "inventory.json"), message: iRes.errors.join("; ") });
      }
    }
    const anchors = cache.readJson<CiteAnchorsFile>(path.join(rDir, "cite-anchors.json"));
    if (anchors) {
      const aRes = validateCiteAnchors(anchors);
      if (!aRes.valid) {
        problems.push({ severity: "error", code: "invalid_cite_anchors", file: path.join(rDir, "cite-anchors.json"), message: aRes.errors.join("; ") });
      }
    }
    const structure = cache.readJson<StructureEvidence>(path.join(rDir, "structure.json"));
    if (structure) {
      const sRes = validateStructureEvidence(structure);
      if (!sRes.valid) {
        problems.push({ severity: "error", code: "invalid_structure_json", file: path.join(rDir, "structure.json"), message: sRes.errors.join("; ") });
      }
    }
    evidence[repoKey] = {
      repo_key: repoKey,
      repository: repoPin,
      ...(inventory ? { inventory } : {}),
      ...(anchors ? { anchors } : {}),
      ...(structure ? { structure } : {}),
    };
  }

  // Plans
  const plans = loadPlansDir(path.join(absDir, "plans"), cache, problems);

  return {
    root_dir: absDir,
    config: rawConfig,
    domains,
    systems,
    externals,
    unassigned_stores,
    unassigned_topics,
    flows,
    evidence,
    plans,
    problems,
  };
}
