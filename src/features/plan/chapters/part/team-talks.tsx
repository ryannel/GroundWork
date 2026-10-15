import type { Model } from '@/application/plan/derive';
import type { TeamPart } from '@/application/plan-story-part';
import type { Connection } from '@/application/plan-story-part-links';
import { teamName } from '@/application/plan-viz-teams';
import { numWord } from '@/application/plan-viz-text';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { NamedChips } from '@/features/plan/common/named-chip';
import { Badge } from '@/ui/badge';

import { PartSection } from './part-section';
import styles from './team-talks.module.css';

const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

function Row({ model, row }: { readonly model: Model; readonly row: Connection }) {
  const added = row.status === 'added';
  return (
    <li className={styles.row}>
      {row.status === 'existing' ? null : (
        <Badge tone={added ? 'added' : 'removed'}>{added ? 'new' : row.status}</Badge>
      )}
      <EntityChip id={row.other} model={model} />
      <span className={styles.verb}>{row.verb}</span>
      {row.via === '' ? null : <EntityChip id={row.via} model={model} />}
    </li>
  );
}

function sameSummary(same: number, changed: number): string {
  if (changed === 0)
    return `${capital(numWord(same))} ${same === 1 ? 'connection' : 'connections'}, none of them changing`;
  return `${capital(numWord(same))} more that ${same === 1 ? 'does not' : 'do not'} change`;
}

// The services the team's talk to, changed connections first and the unchanged ones folded.
export function TalksTo({
  model,
  team,
  part,
}: {
  readonly model: Model;
  readonly team: string;
  readonly part: TeamPart;
}) {
  if (part.services.length === 0) return null;
  const all = [...part.connections.youDependOn, ...part.connections.dependsOnYou];
  const changed = all.filter((r) => r.status !== 'existing');
  const same = all.filter((r) => r.status === 'existing');
  if (all.length === 0) return null;
  return (
    <PartSection title="Who you talk to">
      <p className={styles.runs}>
        {teamName(model, team)} runs <NamedChips ids={part.services} model={model} team />
      </p>
      {changed.length === 0 ? null : (
        <ul className={styles.list}>
          {changed.map((r) => (
            <Row key={`${r.other}|${r.via}`} model={model} row={r} />
          ))}
        </ul>
      )}
      {same.length === 0 ? null : (
        <details className={styles.fold}>
          <summary>{sameSummary(same.length, changed.length)}</summary>
          <ul className={styles.list}>
            {same.map((r) => (
              <Row key={`${r.other}|${r.via}`} model={model} row={r} />
            ))}
          </ul>
        </details>
      )}
    </PartSection>
  );
}
