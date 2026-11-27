import { Box, Database, GitBranch, Globe, Layers, MessageSquare, Server, Smartphone, Table2, Zap } from "lucide-react";
import { useEntityHref } from "../../LinkContext";
import { isModifiedClick } from "../../router";

interface Props {
  id: string;
  label?: string;
  variant?: "accent" | "neutral";
  href?: string;
  onOpen: (id: string) => void;
}

export function EntityKindIcon({ id, size = 12 }: { id: string; size?: number }) {
  if (id.startsWith("store:")) return <Database size={size} />;
  if (id.startsWith("topic:") || id.startsWith("message:")) return <MessageSquare size={size} />;
  if (id.startsWith("external:")) return <Globe size={size} />;
  if (id.startsWith("system:")) return <Layers size={size} />;
  if (id.startsWith("app:") || id.startsWith("screen:")) return <Smartphone size={size} />;
  if (id.startsWith("module:")) return <Box size={size} />;
  if (id.startsWith("schema:")) return <Table2 size={size} />;
  if (id.startsWith("procedure:") || id.startsWith("handler:")) return <GitBranch size={size} />;
  if (id.startsWith("endpoint:") || id.startsWith("interface:")) return <Zap size={size} />;
  return <Server size={size} />;
}

export function EntityLink({ id, label, variant = "accent", href, onOpen }: Props) {
  const autoHref = useEntityHref(id);
  const resolvedHref = href ?? autoHref;

  if (resolvedHref) {
    return (
      <a
        href={resolvedHref}
        className={`entity-link ${variant === "neutral" ? "neutral" : ""}`}
        onClick={(e) => {
          if (isModifiedClick(e)) return;
          e.preventDefault();
          onOpen(id);
        }}
        title={`Open ${id}`}
      >
        <EntityKindIcon id={id} size={12} />
        <span>{label ?? id}</span>
      </a>
    );
  }

  return (
    <button
      type="button"
      className={`entity-link ${variant === "neutral" ? "neutral" : ""}`}
      onClick={() => onOpen(id)}
      title={`Inspect ${id}`}
    >
      <EntityKindIcon id={id} size={12} />
      <span>{label ?? id}</span>
    </button>
  );
}
