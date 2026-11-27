import { useEffect, useMemo, useRef, useState } from "react";
import type { SpacePayload } from "../types";

export interface SearchHit {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly targetNodeId: string;
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
        out.push({ id: comp.id, kind: comp.component.kind, name: comp.component.name, targetNodeId: comp.id });
        for (const iface of comp.contracts.interfaces ?? []) {
          for (const ep of iface.entries) {
            out.push({
              id: ep.id,
              kind: "endpoint",
              name: `${ep.method ?? ""} ${iface.base_path ?? ""}${ep.path ?? ""}`.trim() || ep.id,
              targetNodeId: comp.id,
            });
          }
        }
      }
      for (const st of sys.stores) out.push({ id: st.id, kind: "store", name: st.name, targetNodeId: st.id });
      for (const top of sys.topics) out.push({ id: top.id, kind: "topic", name: top.name, targetNodeId: top.id });
    }
    for (const ext of space.externals) {
      out.push({ id: ext.id, kind: "external", name: ext.external.name, targetNodeId: ext.id });
    }
    for (const st of space.unassigned_stores) {
      out.push({ id: st.id, kind: "store (unassigned)", name: st.name, targetNodeId: st.id });
    }
    for (const p of space.plans) {
      out.push({ id: p.id, kind: "plan", name: p.manifest.title, targetNodeId: p.id });
    }
    return out;
  }, [space]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 20);
    return items
      .filter((i) => i.id.toLowerCase().includes(q) || i.name.toLowerCase().includes(q) || i.kind.toLowerCase().includes(q))
      .slice(0, 20);
  }, [items, query]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="cmd-modal" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="cmd-input"
          placeholder="Jump to system, service, endpoint, store, topic, external, or plan…"
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
              No matching entities
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
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{hit.name}</div>
                <div className="mono" style={{ color: "var(--text-faint)" }}>{hit.id}</div>
              </div>
              <span className="badge">{hit.kind}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
