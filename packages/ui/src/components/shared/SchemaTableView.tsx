import type { SchemaDef } from "../../types";

export interface TableColumnRow {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly required?: boolean;
  readonly notes?: string;
  readonly diffKind?: "added" | "modified" | "removed";
}

interface Props {
  title: string;
  subtitle?: string;
  schemaId?: string;
  columns: readonly TableColumnRow[];
  badge?: string;
}

export function SchemaTableView({ title, subtitle, schemaId, columns, badge }: Props) {
  return (
    <div className="section-card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>{title}</div>
          {(schemaId || subtitle) && (
            <div className="mono" style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>
              {schemaId ?? subtitle}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {badge && <span className="badge">{badge}</span>}
          <span className="badge">{columns.length} cols</span>
        </div>
      </div>

      {columns.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-faint)" }}>No columns extracted for this table.</div>
      ) : (
        <table className="gw-table">
          <thead>
            <tr>
              <th>Column / Field</th>
              <th>Type</th>
              <th>Required</th>
              {columns.some((c) => c.notes) && <th>Constraints / Notes</th>}
              {columns.some((c) => c.diffKind) && <th>Plan Change</th>}
            </tr>
          </thead>
          <tbody>
            {columns.map((col) => (
              <tr
                key={col.id}
                style={
                  col.diffKind === "added"
                    ? { background: "var(--emerald-soft)" }
                    : col.diffKind === "modified"
                      ? { background: "var(--amber-soft)" }
                      : undefined
                }
              >
                <td className="mono" style={{ fontWeight: col.diffKind ? 700 : 500 }}>
                  {col.name}
                </td>
                <td className="mono" style={{ color: "var(--text-muted)" }}>
                  {col.type}
                </td>
                <td style={{ color: "var(--text-muted)" }}>{col.required === undefined ? "—" : col.required ? "required" : "optional"}</td>
                {columns.some((c) => c.notes) && (
                  <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{col.notes ?? "—"}</td>
                )}
                {columns.some((c) => c.diffKind) && (
                  <td>
                    {col.diffKind && (
                      <span className={`badge ${col.diffKind === "added" ? "emerald" : col.diffKind === "modified" ? "amber" : "rose"}`}>
                        {col.diffKind}
                      </span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function schemaDefToRows(
  schema: SchemaDef,
  diffByEntity?: ReadonlyMap<string, "added" | "modified" | "removed">,
): TableColumnRow[] {
  return schema.fields.map((f) => ({
    id: f.id,
    name: f.name,
    type: typeof f.type === "string" ? f.type : JSON.stringify(f.type),
    required: f.required,
    diffKind: diffByEntity?.get(`${schema.id}#${f.id}`),
  }));
}
