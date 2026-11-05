// Calls the current production queries rather than reimplementing their meanings for the proof.
import { derive, type Model } from '@/application/plan/derive';
import { outlineOf } from '@/application/plan-pages';
import { systemMapOf } from '@/application/system-map';
import { reposOf } from '@/application/today-repos';
import { areaViewOf } from '@/application/workspace-area';
import type { Workspace } from '@/domain/workspace';
import { systemLinks } from '@/domain/workspace-links';
import { listPlans } from '@/infrastructure/plan-store';
import { readExplorerCatalogue } from '@/infrastructure/service-explorer-catalogue';
import { readExplorerManifest } from '@/infrastructure/service-explorer-files';
import { readToday } from '@/infrastructure/today-model';
import { readAuthoredLandscape } from '@/infrastructure/workspace-landscape';
import { readPlanState } from '@/infrastructure/workspace-plans';

function graphFacts(model: Model, mode: string, workspace: Workspace): object {
  const graph = model.graphOf(mode);
  const grid = model.storeGrid(mode);
  const placements = new Map(
    workspace.domains.flatMap((domain) =>
      domain.systems.flatMap((system) =>
        system.components.map((component) => [component.id, system.id] as const),
      ),
    ),
  );
  const edges = model.edges(mode);
  return {
    nodes: Object.fromEntries(
      [...graph.byId].map(([id, node]) => [
        id,
        {
          node,
          label: model.label(id),
          ownerService: model.ownerService(id),
          ownerTeam: model.ownerTeam(id),
        },
      ]),
    ),
    componentEdges: edges,
    systemEdges: edges.map((edge) => ({
      ...edge,
      fromSystem: placements.get(edge.from) ?? null,
      toSystem: placements.get(edge.to) ?? null,
    })),
    callers: Object.fromEntries(
      graph.endpoints.map((entry) => [
        entry.id,
        {
          walked: model.callers(entry.id, mode),
          handlers: model.handlersOf(entry.id, mode),
          effects: model.handlerEdges(mode).filter((edge) => edge.target === entry.id),
        },
      ]),
    ),
    handlerEdges: model.handlerEdges(mode),
    storeAccess: {
      services: grid.services,
      stores: grid.stores,
      cells: grid.cells,
      shared: grid.shared,
    },
    messages: Object.fromEntries(
      graph.messages.map((message) => [
        message.id,
        {
          declaredProducer: message.producer ?? null,
          consumers: model.consumersEffective(message.id, mode),
          publishPoints: model.publishPoints(message.id, mode),
          consumePoints: model.consumePoints(message.id, mode),
          effects: model.handlerEdges(mode).filter((edge) => edge.target === message.id),
        },
      ]),
    ),
  };
}

export async function captureFacts(workspaceId: string, asOf: string): Promise<object> {
  const current = await readToday(workspaceId);
  if (current === null) throw new Error(`Cannot read ${workspaceId}.`);
  const { workspace, today } = current;
  const map = systemMapOf(workspace, today);
  const landscape = await readAuthoredLandscape(workspaceId);
  const manifest = await readExplorerManifest(workspaceId);
  const plans: object[] = [];
  for (const slug of await listPlans(workspaceId)) {
    const state = await readPlanState(workspaceId, slug);
    const loaded = state?.loaded;
    if (loaded === null || loaded === undefined) {
      plans.push({ slug, broken: state?.broken ?? null });
      continue;
    }
    const model = derive(loaded.plan, {
      today: new Date(asOf),
      status: loaded.status,
      inherited: loaded.inherited,
      standing: loaded.standing,
    });
    plans.push({
      slug,
      loaded,
      before: graphFacts(model, 'asIs', workspace),
      after: graphFacts(model, 'toBe', workspace),
      outline: outlineOf(model, { workspace: workspaceId, slug }),
    });
  }
  return {
    workspace,
    plan: today.plan,
    attribution: today.attribution,
    scans: today.scans,
    languages: today.languages,
    targets: today.targets,
    keyTerms: today.keyTerms,
    derived: graphFacts(today.model, 'asIs', workspace),
    lookupFacts: map.facts,
    repositoryStates: map.repos,
    areaViews:
      landscape?.areas.map((area) =>
        areaViewOf({
          workspace,
          landscape,
          area: area.id,
          explorer: manifest,
          model: today.model,
          attribution: today.attribution,
        }),
      ) ?? [],
    authoredSystemEdges: systemLinks(workspace.domains),
    codeHomes: Object.fromEntries(
      workspace.domains.flatMap((domain) =>
        domain.systems.map((system) => [system.id, reposOf(workspace, today, system.id)]),
      ),
    ),
    landscape,
    explorer: {
      manifest,
      catalogue: await readExplorerCatalogue(workspaceId),
    },
    plans,
  };
}
