import type { HandlerStep } from "@groundwork/schema";
import type { SpaceModel } from "./model.js";

export type EdgeKind = "call" | "unresolved_call" | "publish" | "consume" | "read" | "write" | "causes" | "observed" | "depends";

export interface DerivedEdge {
  readonly from: string; // component ID
  readonly from_system: string;
  readonly to: string; // component, store, topic, external, or stub system ID
  readonly to_system?: string;
  readonly kind: EdgeKind;
  readonly via: string; // endpoint, message, schema, handler#step, or observed_edge id
  readonly label?: string;
}

export interface ModelGap {
  readonly kind:
    | "unmapped_system"
    | "unresolved_call"
    | "unowned_resource"
    | "observed_edge_unpromoted"
    | "missing_handler"
    | "missing_schema";
  readonly entity_id: string;
  readonly detail: string;
}

export interface IndexedEntity {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly system_id?: string;
  readonly component_id?: string;
  readonly data: unknown;
}

export interface SpaceIndex {
  readonly model: SpaceModel;
  readonly byId: ReadonlyMap<string, IndexedEntity>;
  readonly edges: readonly DerivedEdge[];
  readonly gaps: readonly ModelGap[];
  readonly rolesByComponent: ReadonlyMap<string, readonly string[]>;
  get(id: string): IndexedEntity | undefined;
  callsOf(id: string): readonly DerivedEdge[];
  callersOf(id: string): readonly DerivedEdge[];
  find(query: string): readonly IndexedEntity[];
}

function walkSteps(steps: readonly HandlerStep[], visit: (step: HandlerStep) => void): void {
  for (const step of steps) {
    visit(step);
    if (step.then) walkSteps(step.then, visit);
    if (step.else) walkSteps(step.else, visit);
    if (step.steps) walkSteps(step.steps, visit);
    if (step.try) walkSteps(step.try, visit);
    if (step.catch) walkSteps(step.catch, visit);
    if (step.finally) walkSteps(step.finally, visit);
    if (step.retry?.exhausted) walkSteps(step.retry.exhausted, visit);
    if (step.parallel) {
      for (const lane of step.parallel) {
        walkSteps(lane.steps, visit);
      }
    }
  }
}

export function buildIndex(model: SpaceModel): SpaceIndex {
  const byId = new Map<string, IndexedEntity>();
  const ownerOfEndpoint = new Map<string, { componentId: string; systemId?: string }>();
  const topicOfMessage = new Map<string, { topicId: string; systemId?: string }>();
  const systemOfComponent = new Map<string, string>();
  const rolesByComponent = new Map<string, string[]>();
  const edges: DerivedEdge[] = [];
  const gaps: ModelGap[] = [];

  for (const d of model.domains) {
    byId.set(d.id, { id: d.id, kind: "domain", name: d.name, data: d });
  }
  for (const t of model.config.teams ?? []) {
    byId.set(t.id, { id: t.id, kind: "team", name: t.name, data: t });
  }
  for (const a of model.config.actors ?? []) {
    byId.set(a.id, { id: a.id, kind: "actor", name: a.name, data: a });
  }
  for (const o of model.config.organisations ?? []) {
    byId.set(o.id, { id: o.id, kind: "organisation", name: o.name, data: o });
  }

  // Externals
  for (const ext of model.externals) {
    byId.set(ext.id, { id: ext.id, kind: "external", name: ext.external.name, data: ext });
    for (const iface of ext.contracts.interfaces ?? []) {
      byId.set(iface.id, { id: iface.id, kind: "interface", name: iface.id, component_id: ext.id, data: iface });
      for (const ep of iface.entries) {
        const label = ep.method && ep.path ? `${ep.method} ${iface.base_path ?? ""}${ep.path}` : ep.id;
        byId.set(ep.id, { id: ep.id, kind: "endpoint", name: label, component_id: ext.id, data: ep });
        ownerOfEndpoint.set(ep.id, { componentId: ext.id });
      }
    }
    for (const sch of ext.contracts.schemas ?? []) {
      byId.set(sch.id, { id: sch.id, kind: "schema", name: sch.id, component_id: ext.id, data: sch });
    }
  }

  // Unassigned resources
  for (const st of model.unassigned_stores) {
    byId.set(st.id, { id: st.id, kind: "store", name: st.name, data: st });
    if (st.owner === "unknown") {
      gaps.push({ kind: "unowned_resource", entity_id: st.id, detail: `Store ${st.id} has owner: unknown` });
    }
    for (const rec of st.records ?? []) {
      byId.set(rec.id, { id: rec.id, kind: "schema", name: rec.table ?? rec.id, component_id: st.id, data: rec });
    }
  }
  for (const top of model.unassigned_topics) {
    byId.set(top.id, { id: top.id, kind: "topic", name: top.name, data: top });
    if (top.owner === "unknown") {
      gaps.push({ kind: "unowned_resource", entity_id: top.id, detail: `Topic ${top.id} has owner: unknown` });
    }
    for (const msg of top.messages ?? []) {
      byId.set(msg.id, { id: msg.id, kind: "message", name: msg.id, component_id: top.id, data: msg });
      topicOfMessage.set(msg.id, { topicId: top.id });
    }
  }

  // Systems, components, stores, topics (Pass 1: index all declarations)
  for (const sys of model.systems) {
    byId.set(sys.id, { id: sys.id, kind: "system", name: sys.system.name, system_id: sys.id, data: sys });
    if (!sys.system.mapped) {
      gaps.push({ kind: "unmapped_system", entity_id: sys.id, detail: `System ${sys.id} is marked mapped: false` });
    }

    if (sys.stub_contracts) {
      for (const iface of sys.stub_contracts.interfaces ?? []) {
        byId.set(iface.id, { id: iface.id, kind: "interface", name: iface.id, system_id: sys.id, data: iface });
        for (const ep of iface.entries) {
          const label = ep.method && ep.path ? `${ep.method} ${iface.base_path ?? ""}${ep.path}` : ep.id;
          byId.set(ep.id, { id: ep.id, kind: "endpoint", name: label, system_id: sys.id, data: ep });
          ownerOfEndpoint.set(ep.id, { componentId: sys.id, systemId: sys.id });
        }
      }
      for (const sch of sys.stub_contracts.schemas ?? []) {
        byId.set(sch.id, { id: sch.id, kind: "schema", name: sch.id, system_id: sys.id, data: sch });
      }
    }

    for (const st of sys.stores) {
      byId.set(st.id, { id: st.id, kind: "store", name: st.name, system_id: sys.id, data: st });
      systemOfComponent.set(st.id, sys.id);
      if (st.owner === "unknown") {
        gaps.push({ kind: "unowned_resource", entity_id: st.id, detail: `Store ${st.id} has owner: unknown` });
      }
      for (const rec of st.records ?? []) {
        byId.set(rec.id, { id: rec.id, kind: "schema", name: rec.table ?? rec.id, system_id: sys.id, component_id: st.id, data: rec });
      }
    }

    for (const top of sys.topics) {
      byId.set(top.id, { id: top.id, kind: "topic", name: top.name, system_id: sys.id, data: top });
      systemOfComponent.set(top.id, sys.id);
      if (top.owner === "unknown") {
        gaps.push({ kind: "unowned_resource", entity_id: top.id, detail: `Topic ${top.id} has owner: unknown` });
      }
      for (const msg of top.messages ?? []) {
        byId.set(msg.id, { id: msg.id, kind: "message", name: msg.id, system_id: sys.id, component_id: top.id, data: msg });
        topicOfMessage.set(msg.id, { topicId: top.id, systemId: sys.id });
      }
    }

    for (const comp of sys.components) {
      byId.set(comp.id, { id: comp.id, kind: comp.component.kind, name: comp.component.name, system_id: sys.id, component_id: comp.id, data: comp });
      systemOfComponent.set(comp.id, sys.id);

      const roles = new Set<string>();
      if ((comp.contracts.interfaces?.length ?? 0) > 0) roles.add("api");
      if ((comp.contracts.subscriptions?.length ?? 0) > 0) roles.add("worker");
      if ((comp.contracts.jobs?.length ?? 0) > 0) roles.add("scheduler");
      if (comp.component.kind === "app") roles.add("ui");
      rolesByComponent.set(comp.id, [...roles]);

      for (const iface of comp.contracts.interfaces ?? []) {
        byId.set(iface.id, { id: iface.id, kind: "interface", name: iface.id, system_id: sys.id, component_id: comp.id, data: iface });
        for (const ep of iface.entries) {
          const label = ep.method && ep.path ? `${ep.method} ${iface.base_path ?? ""}${ep.path}` : ep.id;
          byId.set(ep.id, { id: ep.id, kind: "endpoint", name: label, system_id: sys.id, component_id: comp.id, data: ep });
          ownerOfEndpoint.set(ep.id, { componentId: comp.id, systemId: sys.id });
          if (iface.kind === "rest" && !ep.response) {
            gaps.push({ kind: "missing_schema", entity_id: ep.id, detail: `Endpoint ${ep.id} has no response schema` });
          }
        }
      }
      for (const sub of comp.contracts.subscriptions ?? []) {
        byId.set(sub.id, { id: sub.id, kind: "subscription", name: sub.id, system_id: sys.id, component_id: comp.id, data: sub });
      }
      for (const job of comp.contracts.jobs ?? []) {
        byId.set(job.id, { id: job.id, kind: "job", name: job.id, system_id: sys.id, component_id: comp.id, data: job });
      }
      for (const inter of comp.contracts.interactions ?? []) {
        byId.set(inter.id, { id: inter.id, kind: "interaction", name: inter.id, system_id: sys.id, component_id: comp.id, data: inter });
      }
      for (const sch of comp.contracts.schemas ?? []) {
        byId.set(sch.id, { id: sch.id, kind: "schema", name: sch.id, system_id: sys.id, component_id: comp.id, data: sch });
      }
      for (const scr of comp.screens.screens ?? []) {
        byId.set(scr.id, { id: scr.id, kind: "screen", name: scr.name ?? scr.id, system_id: sys.id, component_id: comp.id, data: scr });
      }
      for (const proc of comp.handlers.procedures ?? []) {
        byId.set(proc.id, { id: proc.id, kind: "procedure", name: proc.summary, system_id: sys.id, component_id: comp.id, data: proc });
      }
      for (const h of comp.handlers.handlers) {
        byId.set(h.id, { id: h.id, kind: "handler", name: h.summary, system_id: sys.id, component_id: comp.id, data: h });
      }
    }
  }

  for (const flow of model.flows) {
    byId.set(flow.id, { id: flow.id, kind: "flow", name: flow.name, data: flow });
  }

  // Pass 2: derive edges & handler gaps
  for (const sys of model.systems) {
    for (const comp of sys.components) {
      const handledEntries = new Set(comp.handlers.handlers.map((h) => h.on));
      const depth = comp.component.depth ?? "full";

      // Check missing handlers for implementation-backed endpoints when depth === "full"
      if (depth === "full") {
        for (const iface of comp.contracts.interfaces ?? []) {
          if (iface.known_from !== "implementation") continue;
          for (const ep of iface.entries) {
            if (!handledEntries.has(ep.id)) {
              gaps.push({ kind: "missing_handler", entity_id: ep.id, detail: `Endpoint ${ep.id} has no handler (depth: full)` });
            }
          }
        }
      }

      // Subscription consume edges
      for (const sub of comp.contracts.subscriptions ?? []) {
        const topicInfo = topicOfMessage.get(sub.message);
        edges.push({
          from: topicInfo?.topicId ?? sub.message,
          from_system: topicInfo?.systemId ?? sys.id,
          to: comp.id,
          to_system: sys.id,
          kind: "consume",
          via: sub.id,
          label: sub.message,
        });
      }

      // Module / crate in-process dependencies (depends_on)
      for (const depId of comp.component.depends_on ?? []) {
        edges.push({
          from: comp.id,
          from_system: sys.id,
          to: depId,
          to_system: systemOfComponent.get(depId),
          kind: "depends",
          via: `${comp.id}->${depId}`,
          label: "depends on",
        });
      }

      // Observed edges (unpromoted ones emit gaps!)
      for (const obs of comp.component.observed_edges ?? []) {
        if (obs.status !== "unused_registration") {
          gaps.push({
            kind: "observed_edge_unpromoted",
            entity_id: comp.id,
            detail: `Observed edge ${obs.id} -> ${obs.to} (${obs.reason}) is not promoted to a handler`,
          });
          edges.push({
            from: comp.id,
            from_system: sys.id,
            to: obs.to,
            to_system: systemOfComponent.get(obs.to),
            kind: "observed",
            via: obs.id,
            label: obs.says,
          });
        }
      }

      // Handler + Procedure step edges
      const visitFlow = (ownerFlowId: string, steps: readonly HandlerStep[]) => {
        walkSteps(steps, (step) => {
          const stepRef = `${ownerFlowId}#${step.id}`;
          if (step.call) {
            const target = ownerOfEndpoint.get(step.call);
            edges.push({
              from: comp.id,
              from_system: sys.id,
              to: target?.componentId ?? step.call,
              to_system: target?.systemId,
              kind: "call",
              via: step.call,
              label: step.say ?? step.call,
            });
          }
          if (step.unresolved_call) {
            gaps.push({
              kind: "unresolved_call",
              entity_id: stepRef,
              detail: `Unresolved call (${step.unresolved_call.gap_id}): ${step.unresolved_call.target_hint}`,
            });
            edges.push({
              from: comp.id,
              from_system: sys.id,
              to: `unknown:${step.unresolved_call.gap_id}`,
              kind: "unresolved_call",
              via: stepRef,
              label: step.unresolved_call.target_hint,
            });
          }
          if (step.publish) {
            const topicInfo = topicOfMessage.get(step.publish);
            edges.push({
              from: comp.id,
              from_system: sys.id,
              to: topicInfo?.topicId ?? step.publish,
              to_system: topicInfo?.systemId,
              kind: "publish",
              via: step.publish,
              label: step.say ?? step.publish,
            });
          }
          if (step.read && step.from) {
            edges.push({
              from: comp.id,
              from_system: sys.id,
              to: step.from,
              to_system: systemOfComponent.get(step.from),
              kind: "read",
              via: step.read,
              label: step.say ?? step.read,
            });
          }
          if (step.write && step.to) {
            edges.push({
              from: comp.id,
              from_system: sys.id,
              to: step.to,
              to_system: systemOfComponent.get(step.to),
              kind: "write",
              via: step.write,
              label: step.say ?? step.write,
            });
          }
        });
      };

      for (const proc of comp.handlers.procedures ?? []) {
        visitFlow(proc.id, proc.steps);
      }
      for (const h of comp.handlers.handlers) {
        visitFlow(h.id, h.steps);
      }
    }
  }

  return {
    model,
    byId,
    edges,
    gaps,
    rolesByComponent,
    get(id: string) {
      return byId.get(id);
    },
    callsOf(id: string) {
      return edges.filter((e) => e.from === id || e.from_system === id);
    },
    callersOf(id: string) {
      return edges.filter((e) => e.to === id || e.to_system === id || e.via === id);
    },
    find(query: string) {
      const q = query.trim().toLowerCase();
      if (!q) return [...byId.values()];
      return [...byId.values()].filter(
        (ent) =>
          ent.id.toLowerCase().includes(q) ||
          ent.name.toLowerCase().includes(q) ||
          ent.kind.toLowerCase().includes(q),
      );
    },
  };
}
