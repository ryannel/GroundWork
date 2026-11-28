import { useEffect, useMemo, useRef, useState } from "react";
import type { EntityNavOptions } from "../router";
import type { SpacePayload } from "../types";
import { getComponentRichEndpoints, getStoreTables } from "../utils/spaceLookup";

export interface SearchHit {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly subtitle?: string;
  readonly targetNodeId: string;
  readonly navOptions?: EntityNavOptions;
}

interface Props {
  open: boolean;
  space: SpacePayload;
  onClose: () => void;
  onSelect: (hit: SearchHit) => void;
}

export function CommandPalette({ open, space, onClose, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const items = useMemo<SearchHit[]>(() => {
    const out: SearchHit[] = [];
    for (const sys of space.systems) {
      out.push({ id: sys.id, kind: "system", name: sys.system.name, targetNodeId: sys.id });
      for (const comp of sys.components) {
        out.push({
          id: comp.id,
          kind: comp.component.kind,
          name: comp.component.name,
          subtitle: sys.system.name,
          targetNodeId: comp.id,
        });
        const epSummary = getComponentRichEndpoints(space, sys, comp);
        for (const ep of epSummary.all) {
          out.push({
            id: `${comp.id}::${ep.key}`,
            kind: `api · ${ep.method}`,
            name: `${ep.method} ${ep.path}`,
            subtitle: `${comp.component.name} · ${ep.group}${ep.title && ep.title !== `${ep.method} ${ep.path}` ? ` — ${ep.title}` : ""}`,
            targetNodeId: comp.id,
            navOptions: { tab: "api", endpoint: ep.key },
          });
        }
      }
      for (const st of sys.stores) {
        out.push({ id: st.id, kind: "database", name: st.name, subtitle: sys.system.name, targetNodeId: st.id });
        const tables = getStoreTables(space, st);
        for (const tbl of tables) {
          out.push({
            id: `${st.id}::${tbl.name}`,
            kind: "table",
            name: tbl.name,
            subtitle: `${st.name} · ${tbl.columns.length} columns`,
            targetNodeId: st.id,
            navOptions: { table: tbl.name },
          });
        }
      }
      for (const top of sys.topics) {
        out.push({ id: top.id, kind: "queue", name: top.name, subtitle: sys.system.name, targetNodeId: top.id });
      }
    }
    for (const ext of space.externals) {
      out.push({ id: ext.id, kind: "external", name: ext.external.name, targetNodeId: ext.id });
    }
    for (const st of space.unassigned_stores) {
      out.push({ id: st.id, kind: "database (unassigned)", name: st.name, targetNodeId: st.id });
    }
    for (const p of space.plans) {
      out.push({ id: p.id, kind: "plan", name: p.manifest.title, targetNodeId: p.id });
    }
    return out;
  }, [space]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Show top-level entities first when query is empty (systems, services, databases, plans)
      return items
        .filter((i) => !i.kind.startsWith("api ·") && i.kind !== "table")
        .slice(0, 20);
    }
    return items
      .filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.id.toLowerCase().includes(q) ||
          i.kind.toLowerCase().includes(q) ||
          (i.subtitle?.toLowerCase().includes(q) ?? false),
      )
      .slice(0, 24);
  }, [items, query]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="cmd-modal" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="cmd-input"
          placeholder="Jump to service, endpoint (/meetings), table, queue, or plan…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter" && filtered[0]) {
              onSelect(filtered[0]);
              onClose();
            }
          }}
        />
        <div className="cmd-list">
          {filtered.length === 0 && (
            <div style={{ padding: 16, textAlign: "center", color: "var(--text-faint)", fontSize: 13 }}>
              No matching entities, endpoints, or tables
            </div>
          )}
          {filtered.map((hit) => (
            <button
              key={`${hit.kind}:${hit.id}`}
              className="cmd-item"
              onClick={() => {
                onSelect(hit);
                onClose();
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {hit.name}
                </div>
                <div className="mono" style={{ color: "var(--text-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {hit.subtitle ?? hit.id}
                </div>
              </div>
              <span className="badge" style={{ flexShrink: 0 }}>{hit.kind}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
