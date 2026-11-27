import {
  Check,
  ChevronLeft,
  ChevronRight,
  Code2,
  Copy,
  Database,
  Globe,
  MessageSquare,
  RotateCcw,
  Server,
  Smartphone,
  User,
  Workflow,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { HandlerDef, HandlerStep, LoadedPlanPayload, SpacePayload } from "../types";
import { EntityLink } from "./shared/EntityLink";
import { InteractiveViewport } from "./shared/InteractiveViewport";
import { QuickPeekDrawer } from "./shared/QuickPeekDrawer";

interface Props {
  space: SpacePayload;
  plan: LoadedPlanPayload;
  initialOp?: string;
  initialStep?: number;
  initialMode?: "architecture" | "sequence";
  onStateChange?: (state: { op: string; step: number; mode: "architecture" | "sequence" }) => void;
  onOpenEntity: (entityId: string, tab?: string, fromPlanId?: string) => void;
}

type ParticipantKind = "actor" | "app" | "service" | "store" | "topic" | "external" | "stub";

interface Participant {
  readonly id: string;
  readonly name: string;
  readonly subtitle: string;
  readonly kind: ParticipantKind;
}

interface WalkthroughStep {
  readonly index: number;
  readonly numberLabel: string;
  readonly depth: number;
  readonly id: string;
  readonly title: string;
  readonly detail?: string;
  readonly kind: "entry" | "call" | "read" | "write" | "publish" | "procedure" | "branch" | "return" | "compute";
  readonly fromId: string;
  readonly toId: string;
  readonly targetId?: string;
  readonly targetLabel?: string;
  readonly diffKind: "added" | "modified" | "removed" | "unchanged";
  readonly branchCondition?: string;
}

function ParticipantIcon({ kind, size = 15 }: { kind: ParticipantKind; size?: number }) {
  switch (kind) {
    case "actor":
      return <User size={size} />;
    case "app":
      return <Smartphone size={size} />;
    case "service":
      return <Server size={size} />;
    case "store":
      return <Database size={size} />;
    case "topic":
      return <MessageSquare size={size} />;
    case "external":
      return <Globe size={size} />;
    case "stub":
      return <Server size={size} />;
  }
}

/** Disciplined neutral base palette — shape carries type, color is reserved for Focus & Plan Diff! */
function participantMeta(kind: ParticipantKind): { label: string; iconBg: string; iconColor: string } {
  switch (kind) {
    case "actor":
      return { label: "Caller", iconBg: "var(--surface-muted)", iconColor: "var(--text-muted)" };
    case "app":
      return { label: "Web App", iconBg: "var(--surface-muted)", iconColor: "var(--text)" };
    case "service":
      return { label: "Service", iconBg: "var(--accent-soft)", iconColor: "var(--accent)" };
    case "store":
      return { label: "Database", iconBg: "var(--teal-soft)", iconColor: "var(--teal)" };
    case "topic":
      return { label: "Message Queue", iconBg: "var(--violet-soft)", iconColor: "var(--violet)" };
    case "external":
      return { label: "External API", iconBg: "var(--surface-muted)", iconColor: "var(--text-muted)" };
    case "stub":
      return { label: "Internal API", iconBg: "var(--amber-soft)", iconColor: "var(--amber)" };
  }
}

function toMermaidAlias(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, "_");
}

function buildMermaidSequence(
  handler: HandlerDef,
  ownerId: string,
  participants: readonly Participant[],
  steps: readonly WalkthroughStep[],
): string {
  const lines: string[] = ["sequenceDiagram", `  %% ${handler.id} — ${handler.summary}`];
  for (const p of participants) {
    const alias = toMermaidAlias(p.id);
    const kindKeyword = p.kind === "actor" ? "actor" : "participant";
    const iconTag =
      p.kind === "store" ? " [DB]" : p.kind === "topic" ? " [Queue]" : p.kind === "external" ? " [External]" : "";
    lines.push(`  ${kindKeyword} ${alias} as ${p.name}${iconTag}`);
  }
  lines.push("");

  let inAlt = false;
  for (const st of steps) {
    const tag =
      st.diffKind === "added"
        ? " [ADDED]"
        : st.diffKind === "modified"
          ? " [MODIFIED]"
          : st.diffKind === "removed"
            ? " [REMOVED]"
            : "";

    if (st.kind === "branch") {
      if (inAlt) lines.push("  end");
      lines.push(`  alt ${st.branchCondition ?? st.title}`);
      inAlt = true;
      continue;
    }

    if (st.depth === 0 && inAlt) {
      lines.push("  end");
      inAlt = false;
    }

    const indent = inAlt ? "    " : "  ";
    const fromA = toMermaidAlias(st.fromId);
    const toA = toMermaidAlias(st.toId);
    const arrow = st.kind === "publish" || st.kind === "return" ? "-->>" : "->>";
    lines.push(`${indent}${fromA}${arrow}${toA}: ${st.numberLabel}. ${st.title}${tag}`);
    if (st.diffKind !== "unchanged") {
      lines.push(`${indent}Note over ${toA}: ${st.diffKind.toUpperCase()} in this plan`);
    }
  }
  if (inAlt) lines.push("  end");
  if (steps.length === 0) lines.push(`  Note over ${toMermaidAlias(ownerId)}: No handler steps recorded`);
  return lines.join("\n");
}

function DatabaseCylinder({
  x,
  y,
  w,
  h,
  name,
  subtitle,
  highlighted,
  highlightColor,
  onClick,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  name: string;
  subtitle: string;
  highlighted: boolean;
  highlightColor: string;
  onClick: () => void;
}) {
  const rx = w / 2;
  const ry = 13;
  const stroke = highlighted ? highlightColor : "var(--border-strong)";
  const strokeW = highlighted ? 2.4 : 1.5;
  const fill = highlighted ? "var(--surface-elevated)" : "var(--surface)";
  return (
    <g style={{ cursor: "pointer" }} onClick={onClick}>
      {highlighted && (
        <rect x={x - 7} y={y - 7} width={w + 14} height={h + 14} rx={16} fill={highlightColor} opacity={0.14} />
      )}
      <path
        d={`M ${x} ${y + ry} L ${x} ${y + h - ry} A ${rx} ${ry} 0 0 0 ${x + w} ${y + h - ry} L ${x + w} ${y + ry} Z`}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeW}
      />
      <ellipse cx={x + rx} cy={y + ry} rx={rx} ry={ry} fill="var(--surface-muted)" stroke={stroke} strokeWidth={strokeW} />
      <text x={x + rx} y={y + h / 2 + 5} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--text)">
        {name}
      </text>
      <text x={x + rx} y={y + h / 2 + 22} textAnchor="middle" fontSize={11} fill="var(--text-faint)">
        {subtitle}
      </text>
    </g>
  );
}

function MessageQueuePipe({
  x,
  y,
  w,
  h,
  name,
  subtitle,
  highlighted,
  highlightColor,
  onClick,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  name: string;
  subtitle: string;
  highlighted: boolean;
  highlightColor: string;
  onClick: () => void;
}) {
  const rx = 13;
  const ry = h / 2;
  const stroke = highlighted ? highlightColor : "var(--border-strong)";
  const strokeW = highlighted ? 2.4 : 1.5;
  const fill = highlighted ? "var(--surface-elevated)" : "var(--surface)";
  return (
    <g style={{ cursor: "pointer" }} onClick={onClick}>
      {highlighted && (
        <rect x={x - 7} y={y - 7} width={w + 14} height={h + 14} rx={16} fill={highlightColor} opacity={0.14} />
      )}
      <path
        d={`M ${x + rx} ${y} L ${x + w - rx} ${y} A ${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h} L ${x + rx} ${y + h} Z`}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeW}
      />
      <ellipse cx={x + rx} cy={y + ry} rx={rx} ry={ry} fill="var(--surface-muted)" stroke={stroke} strokeWidth={strokeW} />
      <text x={x + w / 2 + 5} y={y + ry - 2} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--text)">
        {name}
      </text>
      <text x={x + w / 2 + 5} y={y + ry + 15} textAnchor="middle" fontSize={11} fill="var(--text-faint)">
        {subtitle}
      </text>
    </g>
  );
}

export function FlowWalkthrough({
  space,
  plan,
  initialOp,
  initialStep,
  initialMode,
  onStateChange,
  onOpenEntity,
}: Props) {
  const allHandlers = useMemo(() => {
    const list: Array<{ handler: HandlerDef; componentId: string; componentName: string; systemName: string }> = [];
    for (const sys of plan.after_systems) {
      for (const comp of sys.components) {
        for (const h of comp.handlers.handlers) {
          list.push({
            handler: h,
            componentId: comp.id,
            componentName: comp.component.name,
            systemName: sys.system.name,
          });
        }
      }
    }
    return list;
  }, [plan.after_systems]);

  const [selectedHandlerId, setSelectedHandlerId] = useState<string>(() => {
    if (initialOp && allHandlers.some((h) => h.handler.id === initialOp)) return initialOp;
    const touched = plan.diff.find((d) => d.entity_id.startsWith("handler:"))?.entity_id.split("#")[0];
    return touched ?? allHandlers[0]?.handler.id ?? "";
  });

  const [viewMode, setViewMode] = useState<"architecture" | "sequence">(initialMode ?? "architecture");
  const [showMermaidCode, setShowMermaidCode] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(initialStep ?? 0);
  const [peekTargetId, setPeekTargetId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Sync when browser Back/Forward updates URL props
  useEffect(() => {
    if (initialOp && initialOp !== selectedHandlerId && allHandlers.some((h) => h.handler.id === initialOp)) {
      setSelectedHandlerId(initialOp);
    }
  }, [initialOp, allHandlers]);

  useEffect(() => {
    if (initialStep !== undefined && initialStep !== activeIndex) {
      setActiveIndex(initialStep);
    }
  }, [initialStep]);

  useEffect(() => {
    if (initialMode && initialMode !== viewMode) {
      setViewMode(initialMode);
    }
  }, [initialMode]);

  // Push state updates cleanly to URL query params (replaceState)
  useEffect(() => {
    if (!selectedHandlerId) return;
    onStateChange?.({ op: selectedHandlerId, step: activeIndex, mode: viewMode });
  }, [selectedHandlerId, activeIndex, viewMode]);

  const selectedEntry = allHandlers.find((h) => h.handler.id === selectedHandlerId) ?? allHandlers[0];

  const entityLookup = useMemo(() => {
    const participantsById = new Map<string, Participant>();
    const endpointOwner = new Map<string, string>();
    const messageOwner = new Map<string, string>();

    for (const sys of plan.after_systems) {
      if (!sys.system.mapped) {
        participantsById.set(sys.id, {
          id: sys.id,
          name: sys.system.name,
          subtitle: "Internal API (stub)",
          kind: "stub",
        });
        for (const iface of sys.stub_contracts?.interfaces ?? []) {
          for (const ep of iface.entries) endpointOwner.set(ep.id, sys.id);
        }
      }
      for (const comp of sys.components) {
        participantsById.set(comp.id, {
          id: comp.id,
          name: comp.component.name,
          subtitle: comp.component.tech ?? comp.component.kind,
          kind: comp.component.kind === "app" ? "app" : "service",
        });
        for (const iface of comp.contracts.interfaces ?? []) {
          for (const ep of iface.entries) endpointOwner.set(ep.id, comp.id);
        }
      }
      for (const st of sys.stores) {
        participantsById.set(st.id, {
          id: st.id,
          name: st.name,
          subtitle: st.tech ?? st.form,
          kind: "store",
        });
      }
      for (const top of sys.topics) {
        participantsById.set(top.id, {
          id: top.id,
          name: top.name,
          subtitle: top.tech ?? top.form,
          kind: "topic",
        });
        for (const m of top.messages ?? []) messageOwner.set(m.id, top.id);
      }
    }

    for (const ext of space.externals) {
      participantsById.set(ext.id, {
        id: ext.id,
        name: ext.external.name,
        subtitle: "3rd-Party API",
        kind: "external",
      });
      for (const iface of ext.contracts.interfaces ?? []) {
        for (const ep of iface.entries) endpointOwner.set(ep.id, ext.id);
      }
    }

    return { participantsById, endpointOwner, messageOwner };
  }, [plan.after_systems, space.externals]);

  const { participants, steps } = useMemo(() => {
    if (!selectedEntry) return { participants: [] as Participant[], steps: [] as WalkthroughStep[] };
    const { handler, componentId, componentName } = selectedEntry;

    const diffByStepId = new Map<string, "added" | "modified" | "removed">();
    for (const d of plan.diff) {
      if (d.entity_id.startsWith(`${handler.id}#`)) {
        diffByStepId.set(d.entity_id.split("#")[1]!, d.kind);
      }
    }

    const callerParticipant: Participant = {
      id: "actor:caller",
      name: "Caller",
      subtitle: handler.on?.replace(/^endpoint:/, "") ?? "Request",
      kind: "actor",
    };

    const ownerParticipant: Participant = entityLookup.participantsById.get(componentId) ?? {
      id: componentId,
      name: componentName,
      subtitle: "Service",
      kind: "service",
    };

    const orderedParticipants: Participant[] = [callerParticipant, ownerParticipant];
    const addedIds = new Set<string>([callerParticipant.id, ownerParticipant.id]);

    const ensureParticipant = (id: string, fallbackKind: ParticipantKind): string => {
      if (!addedIds.has(id)) {
        const found = entityLookup.participantsById.get(id) ?? {
          id,
          name: id.split(":")[1] ?? id,
          subtitle: fallbackKind,
          kind: fallbackKind,
        };
        orderedParticipants.push(found);
        addedIds.add(id);
      }
      return id;
    };

    const out: WalkthroughStep[] = [
      {
        index: 0,
        numberLabel: "1",
        depth: 0,
        id: "__entry__",
        title: `POST ${handler.on?.replace(/^endpoint:/, "") ?? handler.id}`,
        detail: handler.summary,
        kind: "entry",
        fromId: callerParticipant.id,
        toId: ownerParticipant.id,
        targetId: handler.on,
        targetLabel: handler.on,
        diffKind: "unchanged",
      },
    ];

    let topCounter = 1;
    const visit = (list: readonly HandlerStep[], depth: number, parentNum?: string) => {
      let subIdx = 0;
      for (const st of list) {
        let numLabel: string;
        if (depth === 0) {
          topCounter++;
          numLabel = String(topCounter);
        } else {
          numLabel = `${parentNum}${String.fromCharCode(97 + subIdx++)}`;
        }

        const diffKind = diffByStepId.get(st.id) ?? "unchanged";

        if (st.if) {
          out.push({
            index: out.length,
            numberLabel: numLabel,
            depth,
            id: st.id,
            title: `If ${st.if}`,
            detail: st.does ?? `Evaluates branch condition inside ${ownerParticipant.name}: runs nested steps when ${st.if}.`,
            kind: "branch",
            fromId: ownerParticipant.id,
            toId: ownerParticipant.id,
            targetId: ownerParticipant.id,
            diffKind,
            branchCondition: st.if,
          });
          if (st.then) visit(st.then, depth + 1, numLabel);
          if (st.else) visit(st.else, depth + 1, numLabel);
          continue;
        }

        let kind: WalkthroughStep["kind"] = "compute";
        let fromId = ownerParticipant.id;
        let toId = ownerParticipant.id;
        let targetId: string | undefined;
        let targetLabel: string | undefined;

        if (st.call) {
          kind = "call";
          targetId = st.call;
          targetLabel = st.call;
          toId = ensureParticipant(entityLookup.endpointOwner.get(st.call) ?? st.call, "service");
        } else if (st.write && st.to) {
          kind = "write";
          targetId = st.write;
          targetLabel = st.write;
          toId = ensureParticipant(st.to, "store");
        } else if (st.read && st.from) {
          kind = "read";
          targetId = st.read;
          targetLabel = st.read;
          toId = ensureParticipant(st.from, "store");
        } else if (st.publish) {
          kind = "publish";
          targetId = st.publish;
          targetLabel = st.publish;
          toId = ensureParticipant(entityLookup.messageOwner.get(st.publish) ?? st.publish, "topic");
        } else if (st.run) {
          kind = "procedure";
          targetId = st.run;
          targetLabel = st.run;
        } else if (st.return !== undefined) {
          kind = "return";
          toId = callerParticipant.id;
          targetLabel = `HTTP ${st.return}`;
        }

        out.push({
          index: out.length,
          numberLabel: numLabel,
          depth,
          id: st.id,
          title: st.say ?? (st.return !== undefined ? `Return ${st.return}` : st.id),
          detail: st.does,
          kind,
          fromId,
          toId,
          targetId,
          targetLabel,
          diffKind,
        });

        if (st.steps) visit(st.steps, depth + 1, numLabel);
      }
    };

    visit(handler.steps, 0);
    return { participants: orderedParticipants, steps: out };
  }, [selectedEntry, plan.diff, entityLookup]);

  const prevHandlerRef = useRef(selectedHandlerId);
  useEffect(() => {
    if (prevHandlerRef.current !== selectedHandlerId) {
      prevHandlerRef.current = selectedHandlerId;
      setActiveIndex(0);
      setPeekTargetId(null);
    }
  }, [selectedHandlerId]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((cur) => Math.min(steps.length - 1, cur + 1));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((cur) => Math.max(0, cur - 1));
      } else if (e.key === "Home") {
        e.preventDefault();
        setActiveIndex(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setActiveIndex(Math.max(0, steps.length - 1));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [steps.length]);

  const mermaidCode = useMemo(() => {
    if (!selectedEntry) return "";
    return buildMermaidSequence(selectedEntry.handler, selectedEntry.componentId, participants, steps);
  }, [selectedEntry, participants, steps]);

  if (!selectedEntry) {
    return (
      <div className="studio-content">
        <div className="section-card">No handlers found in this plan yet.</div>
      </div>
    );
  }

  const activeStep = steps[activeIndex] ?? steps[0];

  // Orthogonal visual channels:
  //  - Active selection is ALWAYS crisp Indigo (#4f46e5) so you never confuse "selected" with "added"!
  //  - Plan Diff (+ Added / ~ Modified / - Removed) is shown as an explicit badge & resting accent.
  const SELECTION_COLOR = "#4f46e5";

  // ── Spacious, Collision-Free Architecture Whiteboard Coordinates ──────────
  const spineParticipants = participants.filter((p) => p.kind !== "store" && p.kind !== "topic");
  const bottomParticipants = participants.filter((p) => p.kind === "store" || p.kind === "topic");

  const archBoxW = 196;
  const archBoxH = 108; // Generous height so multi-line titles + subtitles NEVER clip!
  const archGapX = 256; // Wide channel so horizontal arrow labels NEVER touch box borders or arrowheads!
  const archStartX = 48;
  const selfSteps = steps.filter((s) => s.fromId === s.toId);
  const archTopY = 44;
  const spineY = Math.max(146, archTopY + 42 + selfSteps.length * 32);
  const bottomY = spineY + archBoxH + 150;

  const archPos = new Map<string, { x: number; y: number; w: number; h: number; cx: number; cy: number }>();
  spineParticipants.forEach((p, idx) => {
    const x = archStartX + idx * (archBoxW + archGapX);
    archPos.set(p.id, { x, y: spineY, w: archBoxW, h: archBoxH, cx: x + archBoxW / 2, cy: spineY + archBoxH / 2 });
  });

  const ownerPos = archPos.get(selectedEntry.componentId) ?? archPos.get(spineParticipants[1]?.id ?? "");
  const bottomSpacing = 340;
  const bottomAnchorX = ownerPos ? ownerPos.cx : archStartX + archBoxW + archGapX;
  const bottomStartX = Math.max(
    64,
    bottomAnchorX - ((bottomParticipants.length - 1) * bottomSpacing) / 2 - 95,
  );
  bottomParticipants.forEach((p, idx) => {
    const w = p.kind === "topic" ? 220 : 184;
    const h = p.kind === "topic" ? 74 : 96;
    const x = bottomStartX + idx * bottomSpacing;
    archPos.set(p.id, { x, y: bottomY, w, h, cx: x + w / 2, cy: bottomY + h / 2 });
  });

  const archSvgW = Math.max(
    1040,
    archStartX * 2 + spineParticipants.length * archBoxW + Math.max(0, spineParticipants.length - 1) * archGapX,
    bottomStartX + bottomParticipants.length * bottomSpacing + 48,
  );
  const archSvgH = bottomParticipants.length > 0 ? bottomY + 128 : spineY + archBoxH + 60;

  // Offset parallel arrows between the same unordered node pair
  const pairOffsetByStep = new Map<number, number>();
  const pairCounts = new Map<string, number[]>();
  steps.forEach((st, idx) => {
    if (st.fromId === st.toId) return;
    const key = [st.fromId, st.toId].sort().join("|");
    const arr = pairCounts.get(key) ?? [];
    arr.push(idx);
    pairCounts.set(key, arr);
  });
  for (const idxs of pairCounts.values()) {
    const mid = (idxs.length - 1) / 2;
    idxs.forEach((stepIdx, pos) => {
      pairOffsetByStep.set(stepIdx, (pos - mid) * 38);
    });
  }

  // Stagger vertical label positions across ALL downward arrows so labels NEVER collide!
  const downwardIndices = steps
    .map((st, idx) => {
      const src = archPos.get(st.fromId);
      const dst = archPos.get(st.toId);
      if (!src || !dst || st.fromId === st.toId) return -1;
      return Math.abs(src.cy - dst.cy) >= 20 ? idx : -1;
    })
    .filter((i) => i !== -1);
  const downwardRank = new Map<number, number>();
  downwardIndices.forEach((stepIdx, rank) => downwardRank.set(stepIdx, rank));

  // ── Sequence Diagram Layout ───────────────────────────────────────────────
  const seqColW = 196;
  const seqStartX = 36;
  const seqHeaderY = 20;
  const seqHeaderH = 86;
  const seqFirstRowY = seqHeaderY + seqHeaderH + 34;
  const seqRowH = 56;
  const seqColX = new Map<string, number>();
  participants.forEach((p, idx) => seqColX.set(p.id, seqStartX + idx * seqColW + seqColW / 2));
  const seqSvgW = Math.max(860, seqStartX * 2 + participants.length * seqColW);
  const seqSvgH = seqFirstRowY + steps.length * seqRowH + 36;

  const quickPeekNode = (
    <QuickPeekDrawer
      space={space}
      plan={plan}
      targetId={peekTargetId}
      onClose={() => setPeekTargetId(null)}
      onPeek={(id) => setPeekTargetId(id)}
      onOpenFullView={(entityId, tab) => onOpenEntity(entityId, tab, plan.id)}
    />
  );
  const fullscreenStepperBar = activeStep ? (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          className="secondary-btn"
          style={{ padding: "5px 10px", fontSize: 12 }}
          onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
          disabled={activeIndex === 0}
        >
          <ChevronLeft size={14} /> Prev
        </button>
        <button
          className="secondary-btn"
          style={{ padding: "5px 10px", fontSize: 12 }}
          onClick={() => setActiveIndex((i) => Math.min(steps.length - 1, i + 1))}
          disabled={activeIndex >= steps.length - 1}
        >
          Next <ChevronRight size={14} />
        </button>
        <span className="badge indigo">Step {activeStep.numberLabel} of {steps.length}</span>
        {activeStep.diffKind !== "unchanged" && (
          <span className={`badge ${activeStep.diffKind === "added" ? "emerald" : activeStep.diffKind === "modified" ? "amber" : "rose"}`}>
            {activeStep.diffKind === "added" ? "+ Added in Plan" : activeStep.diffKind}
          </span>
        )}
        <strong style={{ fontSize: 14 }}>{activeStep.title}</strong>
      </div>
      {activeStep.targetId && (
        <EntityLink
          id={activeStep.targetId}
          label={`Inspect ${activeStep.targetLabel ?? activeStep.targetId}`}
          onOpen={(id) => setPeekTargetId(id)}
        />
      )}
    </div>
  ) : null;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Top Toolbar */}
      <div
        style={{
          padding: "10px 20px",
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Operation:
          </span>
          <select
            className="select mono"
            value={selectedEntry.handler.id}
            onChange={(e) => setSelectedHandlerId(e.target.value)}
          >
            {allHandlers.map((h) => (
              <option key={h.handler.id} value={h.handler.id}>
                {h.componentName} · {h.handler.id.replace(/^handler:/, "")}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="pill-group">
            <button
              className={`icon-btn ${viewMode === "architecture" ? "active" : ""}`}
              onClick={() => setViewMode("architecture")}
            >
              <Workflow size={14} /> Architecture Flow
            </button>
            <button
              className={`icon-btn ${viewMode === "sequence" ? "active" : ""}`}
              onClick={() => setViewMode("sequence")}
            >
              <Code2 size={14} /> Sequence (Mermaid)
            </button>
          </div>

          <button
            className="secondary-btn"
            onClick={() => {
              navigator.clipboard?.writeText(mermaidCode);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            }}
            title="Copy Mermaid sequenceDiagram text"
          >
            {copied ? <Check size={14} color="#059669" /> : <Copy size={14} />}
            {copied ? "Copied!" : "Copy Mermaid"}
          </button>
        </div>
      </div>

      {/* Main Split: Walkable Steps + Diagram + Contextual Quick Peek */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left: Step List */}
        <aside
          style={{
            width: 316,
            background: "var(--surface)",
            borderRight: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              padding: "10px 12px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "var(--bg)",
            }}
          >
            <div style={{ display: "flex", gap: 6 }}>
              <button
                className="secondary-btn"
                style={{ padding: "5px 10px", fontSize: 12 }}
                onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
                disabled={activeIndex === 0}
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                className="secondary-btn"
                style={{ padding: "5px 10px", fontSize: 12 }}
                onClick={() => setActiveIndex((i) => Math.min(steps.length - 1, i + 1))}
                disabled={activeIndex >= steps.length - 1}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 11, color: "var(--text-faint)" }}>← →</span>
              <button className="icon-btn" onClick={() => setActiveIndex(0)} title="Reset to step 1">
                <RotateCcw size={13} />
              </button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 5 }}>
            {steps.map((st, idx) => {
              const isActive = idx === activeIndex;
              return (
                <button
                  key={`${st.id}-${idx}`}
                  onClick={() => setActiveIndex(idx)}
                  style={{
                    textAlign: "left",
                    padding: "8px 10px",
                    marginLeft: st.depth * 16,
                    borderRadius: 8,
                    // ONLY the selected step gets the Indigo ring & tint! Plan Diff uses a subtle left stripe + badge.
                    border: isActive ? "1.5px solid var(--accent)" : "1px solid var(--border)",
                    borderLeft: isActive
                      ? "3.5px solid var(--accent)"
                      : st.diffKind === "added"
                        ? "3.5px solid var(--emerald)"
                        : st.diffKind === "modified"
                          ? "3.5px solid var(--amber)"
                          : st.diffKind === "removed"
                            ? "3.5px solid var(--rose)"
                            : "1px solid var(--border)",
                    background: isActive ? "var(--accent-soft)" : "var(--surface)",
                    boxShadow: isActive ? "0 1px 4px rgba(99,102,241,0.16)" : "none",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                      <span
                        className="mono"
                        style={{
                          minWidth: 22,
                          height: 20,
                          borderRadius: 5,
                          background: isActive ? "#4f46e5" : "var(--surface-muted)",
                          color: isActive ? "#fff" : "var(--text)",
                          display: "inline-grid",
                          placeItems: "center",
                          fontSize: 11,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {st.numberLabel}
                      </span>
                      <span style={{ fontWeight: isActive ? 700 : 500, fontSize: 12.5, color: isActive ? "var(--accent-ink)" : "var(--text)" }}>
                        {st.title}
                      </span>
                    </div>
                    {st.diffKind !== "unchanged" && (
                      <span
                        className={`badge ${st.diffKind === "added" ? "emerald" : st.diffKind === "modified" ? "amber" : "rose"}`}
                        style={{ fontSize: 10, padding: "1px 6px", flexShrink: 0 }}
                      >
                        {st.diffKind === "added" ? "+ Added" : st.diffKind}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Center: Teaching Callout + Shared Zoomable/Pannable/Full-Screen Diagram */}
        <div
          style={{
            flex: 1,
            overflow: "hidden",
            background: "var(--bg)",
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {/* Active Step Narrative Card with CLICKABLE Target Link! */}
          {activeStep && (
            <div
              className="section-card"
              style={{
                borderLeft: `4px solid ${SELECTION_COLOR}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
                flexShrink: 0,
              }}
            >
              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span className="badge indigo">Step {activeStep.numberLabel} of {steps.length}</span>
                  <span className="badge">{activeStep.kind.toUpperCase()}</span>
                  {activeStep.diffKind !== "unchanged" && (
                    <span className={`badge ${activeStep.diffKind === "added" ? "emerald" : activeStep.diffKind === "modified" ? "amber" : "rose"}`}>
                      {activeStep.diffKind === "added" ? "+ ADDED IN PLAN" : `${activeStep.diffKind.toUpperCase()} IN PLAN`}
                    </span>
                  )}
                </div>
                <div style={{ fontWeight: 700, fontSize: 15.5 }}>{activeStep.title}</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.45 }}>
                  {activeStep.detail ??
                    (activeStep.kind === "procedure"
                      ? `Runs shared procedure inside ${selectedEntry.componentName}. Click the pill on the right to inspect its exact steps.`
                      : activeStep.kind === "call"
                        ? `Calls downstream API synchronously. Click the endpoint pill to inspect its contract.`
                        : activeStep.kind === "write"
                          ? `Writes state to the database. Click the schema pill to inspect the table & columns.`
                          : activeStep.kind === "read"
                            ? `Reads current state from the database. Click the schema pill to inspect the table.`
                            : activeStep.kind === "publish"
                              ? `Publishes an async event onto the message queue. Click the message pill to inspect its contract.`
                              : activeStep.kind === "return"
                                ? `Returns the final response (${activeStep.targetLabel ?? ""}) back to the caller.`
                                : `Executes inside ${selectedEntry.componentName}.`)}
                </div>
              </div>

              {activeStep.targetId && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <EntityLink
                    id={activeStep.targetId}
                    label={`Inspect ${activeStep.targetLabel ?? activeStep.targetId}`}
                    onOpen={(id) => setPeekTargetId(id)}
                  />
                  <span style={{ fontSize: 10.5, color: "var(--text-faint)" }}>Click any box or arrow to inspect in place</span>
                </div>
              )}
            </div>
          )}

          {viewMode === "architecture" ? (
            <InteractiveViewport
              bounds={{ minX: 0, minY: 0, width: archSvgW, height: archSvgH }}
              fitKey={`arch:${selectedEntry.handler.id}:${participants.length}:${Boolean(peekTargetId)}`}
              minZoom={0.35}
              maxFitZoom={1.08}
              fullscreenHeader={fullscreenStepperBar}
              fullscreenSide={quickPeekNode}
              hint="Two-finger pan · Pinch to zoom · Click any box to inspect"
              style={{ flex: 1, minHeight: 380, borderRadius: 12, border: "1px solid var(--border)" }}
              svgDefs={
                <defs>
                  {[
                    ["indigo", "#4f46e5"],
                    ["emerald", "#10b981"],
                    ["amber", "#d97706"],
                    ["rose", "#e11d48"],
                    ["slate", "#64748b"],
                  ].map(([name, fill]) => (
                    <marker key={name} id={`arch-arrow-${name}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                      <path d="M 0 1 L 10 5 L 0 9 z" fill={fill} />
                    </marker>
                  ))}
                </defs>
              }
              legend={
                <>
                  <span className="legend-item">
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: "#4f46e5", display: "inline-block" }} /> Selected Step
                  </span>
                  <span className="legend-item">
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: "#10b981", display: "inline-block" }} /> + Added in Plan
                  </span>
                  <span className="legend-item">
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: "#94a3b8", display: "inline-block" }} /> Existing Flow
                  </span>
                </>
              }
            >
              {/* Stacked self-step chips cleanly above the owning service */}
              {selfSteps.map((st, sIdx) => {
                const pos = archPos.get(st.fromId);
                if (!pos) return null;
                const isActive = st.index === activeIndex;
                const chipY = spineY - 36 - (selfSteps.length - 1 - sIdx) * 30;
                const label = `${st.numberLabel} · ${st.title.length > 34 ? st.title.slice(0, 33) + "…" : st.title}`;
                const chipW = Math.max(176, label.length * 6.7 + 24);
                return (
                  <g key={`self-${st.index}`} data-no-pan style={{ cursor: "pointer" }} onClick={() => setActiveIndex(st.index)}>
                    <rect
                      x={pos.cx - chipW / 2}
                      y={chipY}
                      width={chipW}
                      height={24}
                      rx={12}
                      fill={isActive ? "var(--accent-soft)" : "var(--surface)"}
                      stroke={isActive ? "var(--accent)" : "var(--border-strong)"}
                      strokeWidth={isActive ? 1.8 : 1}
                    />
                    <text
                      x={pos.cx}
                      y={chipY + 16}
                      textAnchor="middle"
                      fontSize={11.5}
                      fontWeight={isActive ? 700 : 600}
                      fill={isActive ? "var(--accent-ink)" : "var(--text-muted)"}
                    >
                      {label}
                    </text>
                  </g>
                );
              })}

              {/* All inter-node step arrows — spacious gaps, zero overlap with borders or arrowheads! */}
              {steps.map((st, idx) => {
                if (st.fromId === st.toId) return null;
                const isActive = idx === activeIndex;
                const src = archPos.get(st.fromId);
                const dst = archPos.get(st.toId);
                if (!src || !dst) return null;

                // Active step is ALWAYS unmistakable Indigo; unselected added steps are crisp Emerald; existing are Slate.
                const stroke = isActive
                  ? SELECTION_COLOR
                  : st.diffKind === "added"
                    ? "#10b981"
                    : st.diffKind === "modified"
                      ? "#f59e0b"
                      : "#64748b";
                const markerName =
                  stroke === "#4f46e5"
                    ? "indigo"
                    : stroke === "#10b981"
                      ? "emerald"
                      : stroke === "#f59e0b"
                        ? "amber"
                        : "slate";

                const offset = pairOffsetByStep.get(idx) ?? 0;
                const isSameRow = Math.abs(src.cy - dst.cy) < 20;

                let pathD: string;
                let lx: number;
                let ly: number;

                if (isSameRow) {
                  const goingRight = dst.cx > src.cx;
                  const span = Math.abs(dst.cx - src.cx);
                  const isAdjacent = span <= archBoxW + archGapX + 20;

                  if (isAdjacent) {
                    const x1 = goingRight ? src.x + src.w + 4 : src.x - 4;
                    const x2 = goingRight ? dst.x - 8 : dst.x + dst.w + 8;
                    const y = src.cy + offset;
                    pathD = `M ${x1} ${y} L ${x2} ${y}`;
                    lx = (x1 + x2) / 2;
                    // Put upper parallel arrow label cleanly ABOVE the line, lower parallel arrow cleanly BELOW!
                    ly = offset > 0 ? y + 20 : y - 19;
                  } else {
                    const topY = archTopY;
                    const x1 = goingRight ? src.x + src.w - 14 : src.x + 14;
                    const x2 = dst.cx + (goingRight ? -24 : 24);
                    pathD = `M ${x1} ${src.y - 2} L ${x1} ${topY} L ${x2} ${topY} L ${x2} ${dst.y - 8}`;
                    lx = (x1 + x2) / 2;
                    ly = topY - 16;
                  }
                } else {
                  // Downward arrow to Database cylinder or Message Queue pipe
                  const x1 = src.cx + offset * 0.85;
                  const y1 = src.y + src.h + 2;
                  const x2 = dst.cx + offset * 0.85;
                  const y2 = dst.y - 8;
                  pathD = `M ${x1} ${y1} L ${x2} ${y2}`;
                  const rank = downwardRank.get(idx) ?? 0;
                  const tSlots = [0.26, 0.55, 0.80];
                  const t = tSlots[rank % tSlots.length]!;
                  lx = x1 + (x2 - x1) * t;
                  ly = y1 + (y2 - y1) * t;
                }

                const diffPrefix = st.diffKind === "added" ? "+ " : "";
                const maxChars = isSameRow ? 30 : 32;
                const rawTitle = st.title.length > maxChars ? st.title.slice(0, maxChars - 1) + "…" : st.title;
                const shortLabel = `${st.numberLabel} · ${diffPrefix}${rawTitle}`;
                const pillW = Math.min(archGapX - 24, Math.max(96, shortLabel.length * 6.5 + 18));

                return (
                  <g
                    key={`arch-step-${idx}`}
                    data-no-pan
                    opacity={isActive ? 1 : 0.86}
                    style={{ cursor: "pointer" }}
                    onClick={() => setActiveIndex(idx)}
                  >
                    <path
                      d={pathD}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={isActive ? 2.6 : st.diffKind !== "unchanged" ? 2 : 1.5}
                      strokeDasharray={st.kind === "publish" || st.kind === "return" ? "6 4" : undefined}
                      markerEnd={`url(#arch-arrow-${markerName})`}
                    />
                    <rect
                      x={lx - pillW / 2}
                      y={ly - 11}
                      width={pillW}
                      height={22}
                      rx={6}
                      fill={isActive ? "var(--accent-soft)" : "var(--surface)"}
                      stroke={isActive ? "var(--accent)" : st.diffKind === "added" ? "var(--emerald)" : "var(--border-strong)"}
                      strokeWidth={isActive ? 1.6 : 1}
                    />
                    <text
                      x={lx}
                      y={ly + 3.5}
                      textAnchor="middle"
                      fontSize={11}
                      fontWeight={isActive || st.diffKind !== "unchanged" ? 700 : 600}
                      fill={isActive ? "var(--accent-ink)" : st.diffKind === "added" ? "var(--emerald)" : "var(--text)"}
                    >
                      {shortLabel}
                    </text>
                  </g>
                );
              })}

              {/* Spine Participants (clean neutral cards; click to Quick Peek!) */}
              {spineParticipants.map((p) => {
                const pos = archPos.get(p.id)!;
                const meta = participantMeta(p.kind);
                const isInvolved = Boolean(activeStep && (activeStep.fromId === p.id || activeStep.toId === p.id));
                return (
                  <foreignObject key={`sp-${p.id}`} x={pos.x} y={pos.y} width={pos.w} height={pos.h}>
                    <div
                      data-no-pan
                      onClick={() => { if (p.id !== "actor:caller") setPeekTargetId(p.id); }}
                      style={{
                        width: "100%",
                        height: "100%",
                        background: "var(--surface)",
                        border: isInvolved ? "2.5px solid var(--accent)" : "1.5px solid var(--border-strong)",
                        borderStyle: p.kind === "external" || p.kind === "stub" ? "dashed" : "solid",
                        borderRadius: 12,
                        padding: "10px 12px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        textAlign: "center",
                        gap: 4,
                        cursor: p.id !== "actor:caller" ? "pointer" : "default",
                        boxShadow: isInvolved ? "0 0 0 4px rgba(99,102,241,0.18)" : "var(--shadow-sm)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 6,
                            background: meta.iconBg,
                            color: meta.iconColor,
                            display: "inline-grid",
                            placeItems: "center",
                          }}
                        >
                          <ParticipantIcon kind={p.kind} size={13} />
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-faint)" }}>
                          {meta.label}
                        </span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", lineHeight: 1.2 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-faint)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                        {p.subtitle}
                      </div>
                    </div>
                  </foreignObject>
                );
              })}

              {/* Bottom Tier: True SVG Database Cylinders & Message Queue Pipes */}
              {bottomParticipants.map((p) => {
                const pos = archPos.get(p.id)!;
                const isInvolved = Boolean(activeStep && (activeStep.fromId === p.id || activeStep.toId === p.id));
                if (p.kind === "store") {
                  return (
                    <g key={`db-${p.id}`} data-no-pan>
                      <DatabaseCylinder
                        x={pos.x}
                        y={pos.y}
                        w={pos.w}
                        h={pos.h}
                        name={p.name}
                        subtitle={p.subtitle}
                        highlighted={isInvolved}
                        highlightColor={SELECTION_COLOR}
                        onClick={() => setPeekTargetId(p.id)}
                      />
                    </g>
                  );
                }
                return (
                  <g key={`mq-${p.id}`} data-no-pan>
                    <MessageQueuePipe
                      x={pos.x}
                      y={pos.y}
                      w={pos.w}
                      h={pos.h}
                      name={p.name}
                      subtitle={p.subtitle}
                      highlighted={isInvolved}
                      highlightColor={SELECTION_COLOR}
                      onClick={() => setPeekTargetId(p.id)}
                    />
                  </g>
                );
              })}
            </InteractiveViewport>
          ) : (
            /* ── SEQUENCE (MERMAID) VIEW inside shared <InteractiveViewport> ── */
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
              {showMermaidCode && (
                <pre
                  className="mono"
                  style={{
                    background: "#0f172a",
                    color: "#e2e8f0",
                    padding: 14,
                    borderRadius: 10,
                    margin: 0,
                    overflowX: "auto",
                    maxHeight: 200,
                    lineHeight: 1.55,
                    fontSize: 12,
                    flexShrink: 0,
                  }}
                >
                  {mermaidCode}
                </pre>
              )}

              <InteractiveViewport
                bounds={{ minX: 0, minY: 0, width: seqSvgW, height: seqSvgH }}
                fitKey={`seq:${selectedEntry.handler.id}:${steps.length}:${Boolean(peekTargetId)}`}
                minZoom={0.35}
                maxFitZoom={1.08}
                fullscreenHeader={fullscreenStepperBar}
                fullscreenSide={quickPeekNode}
                hint="Two-finger pan · Pinch to zoom · Click any step row"
                style={{ flex: 1, minHeight: 380, borderRadius: 12, border: "1px solid var(--border)" }}
                toolbarExtra={
                  <div className="pill-group">
                    <button className={`icon-btn ${showMermaidCode ? "active" : ""}`} onClick={() => setShowMermaidCode((v) => !v)}>
                      <Code2 size={13} /> {showMermaidCode ? "Hide Mermaid" : "Mermaid Source"}
                    </button>
                  </div>
                }
                svgDefs={
                  <defs>
                    {[
                      ["indigo", "#4f46e5"],
                      ["emerald", "#10b981"],
                      ["amber", "#d97706"],
                      ["slate", "#64748b"],
                    ].map(([name, fill]) => (
                      <marker key={name} id={`seq-arrow-${name}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                        <path d="M 0 1 L 10 5 L 0 9 z" fill={fill} />
                      </marker>
                    ))}
                  </defs>
                }
              >
                {participants.map((p) => {
                  const cx = seqColX.get(p.id)!;
                  return (
                    <line key={`line-${p.id}`} x1={cx} y1={seqHeaderY + seqHeaderH} x2={cx} y2={seqSvgH - 16} stroke="var(--border-strong)" strokeWidth={1.5} strokeDasharray="5 5" />
                  );
                })}

                {steps.map((st, idx) => {
                  const y = seqFirstRowY + idx * seqRowH;
                  const isActive = idx === activeIndex;
                  const stroke = isActive ? SELECTION_COLOR : st.diffKind === "added" ? "#10b981" : "#64748b";
                  const marker =
                    stroke === "#4f46e5" ? "url(#seq-arrow-indigo)" : stroke === "#10b981" ? "url(#seq-arrow-emerald)" : "url(#seq-arrow-slate)";
                  const x1 = seqColX.get(st.fromId) ?? seqStartX + seqColW / 2;
                  const x2 = seqColX.get(st.toId) ?? x1;

                  return (
                    <g key={`seq-row-${idx}`} data-no-pan style={{ cursor: "pointer" }} onClick={() => setActiveIndex(idx)}>
                      <rect
                        x={12}
                        y={y - seqRowH / 2 + 4}
                        width={seqSvgW - 24}
                        height={seqRowH - 8}
                        rx={8}
                        fill={isActive ? "var(--accent-soft)" : "transparent"}
                        stroke={isActive ? "var(--accent)" : "transparent"}
                        strokeWidth={1.75}
                      />
                      {st.diffKind === "added" && (
                        <rect x={12} y={y - seqRowH / 2 + 4} width={4} height={seqRowH - 8} rx={2} fill="#10b981" />
                      )}
                      {st.kind === "branch" ? (
                        <g>
                          <rect x={x1 - 74} y={y - 14} width={Math.min(seqSvgW - x1 + 40, 360)} height={28} rx={6} fill="var(--amber-soft)" stroke="var(--amber)" strokeWidth={1.5} />
                          <text x={x1 - 62} y={y + 4} fontSize={12} fontWeight={700} fill="var(--amber-ink)">
                            {st.numberLabel}. {st.title}
                          </text>
                        </g>
                      ) : x1 === x2 ? (
                        <g>
                          <path d={`M ${x1} ${y - 8} L ${x1 + 36} ${y - 8} L ${x1 + 36} ${y + 10} L ${x1 + 4} ${y + 10}`} fill="none" stroke={stroke} strokeWidth={isActive ? 2.4 : 1.75} markerEnd={marker} />
                          <text x={x1 + 44} y={y + 4} fontSize={12} fontWeight={isActive ? 700 : 600} fill="var(--text)">
                            {st.numberLabel}. {st.title}
                          </text>
                        </g>
                      ) : (
                        <g>
                          <line x1={x1} y1={y + 6} x2={x2 > x1 ? x2 - 6 : x2 + 6} y2={y + 6} stroke={stroke} strokeWidth={isActive ? 2.5 : 1.75} strokeDasharray={st.kind === "publish" || st.kind === "return" ? "6 4" : undefined} markerEnd={marker} />
                          <circle cx={x1} cy={y + 6} r={3.5} fill={stroke} />
                          <text x={(x1 + x2) / 2} y={y - 4} textAnchor="middle" fontSize={12} fontWeight={isActive ? 700 : 600} fill={st.diffKind === "added" && !isActive ? "var(--emerald)" : "var(--text)"}>
                            {st.numberLabel}. {st.diffKind === "added" ? "+ " : ""}{st.title}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}

                {participants.map((p) => {
                  const cx = seqColX.get(p.id)!;
                  const meta = participantMeta(p.kind);
                  const isInvolved = Boolean(activeStep && (activeStep.fromId === p.id || activeStep.toId === p.id));
                  return (
                    <foreignObject key={`seq-hdr-${p.id}`} x={cx - 82} y={seqHeaderY} width={164} height={seqHeaderH}>
                      <div
                        data-no-pan
                        onClick={() => { if (p.id !== "actor:caller") setPeekTargetId(p.id); }}
                        style={{
                          width: "100%",
                          height: "100%",
                          background: "var(--surface)",
                          border: isInvolved ? "2px solid var(--accent)" : "1.5px solid var(--border-strong)",
                          borderRadius: 10,
                          padding: "8px 10px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          textAlign: "center",
                          gap: 3,
                          cursor: p.id !== "actor:caller" ? "pointer" : "default",
                        }}
                      >
                        <div style={{ width: 26, height: 26, borderRadius: 7, background: meta.iconBg, color: meta.iconColor, display: "grid", placeItems: "center" }}>
                          <ParticipantIcon kind={p.kind} size={14} />
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 12, lineHeight: 1.15, color: "var(--text)" }}>{p.name}</div>
                        <div style={{ fontSize: 10, color: "var(--text-faint)" }}>{meta.label}</div>
                      </div>
                    </foreignObject>
                  );
                })}
              </InteractiveViewport>
            </div>
          )}
        </div>

        {/* Right: Contextual Quick Peek Drawer (answers "how does this procedure/table/API work?" + Open Full View!) */}
        {quickPeekNode}
      </div>
    </div>
  );
}
