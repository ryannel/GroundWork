import {
  type PlanCheckState,
  STAGE_WORDS,
  type PlanRow,
  type PlanStage,
} from '@/application/plan-list';
import { plural } from '@/shared/text';
import { Badge, type BadgeTone } from '@/ui/badge';
import { Button } from '@/ui/button';
import { ListItem } from '@/ui/list';
import { ProgressBar } from '@/ui/progress-bar';
import { Text, TextLink } from '@/ui/text';

import styles from './plan-line.module.css';

const TONES: Readonly<Record<PlanStage, BadgeTone>> = {
  draft: 'neutral',
  review: 'accent',
  approved: 'modified',
  delivery: 'modified',
  done: 'added',
};

const CHECK_WORDS: Readonly<Record<Exclude<PlanCheckState, null>, string>> = {
  never: 'Never checked',
  edited: 'Edited since its check',
  recheck: 'Recheck after migration',
};

const CHECK_TITLES: Readonly<Record<Exclude<PlanCheckState, null>, string>> = {
  never: 'This plan has never been checked against today; run npm run plan:base -- check',
  edited: 'This plan has changed since it was last checked; run npm run plan:base -- check',
  recheck: 'The previous check used the earlier model; run npm run plan:base -- check',
};

function CheckBadge({ row }: { readonly row: PlanRow }) {
  if (row.check === null) return null;
  const detail = CHECK_TITLES[row.check];
  const title =
    row.previousCheckedOn === undefined
      ? detail
      : `Previously checked on ${row.previousCheckedOn}. ${detail}`;
  return (
    <span title={title}>
      <Badge tone="deprecated">{CHECK_WORDS[row.check]}</Badge>
    </span>
  );
}

interface RowProps {
  readonly row: PlanRow;
  readonly nameOf: (id: string) => string;
  readonly onDomain: (id: string) => void;
  /** The domain being read, when the list is one domain's plans: the line names only the others. */
  readonly here?: string | undefined;
}

/** One plan as a row: its title and problem, the domains it lands in, its stage, how far its work has got. */
export function PlanLine({ row, nameOf, onDomain, here }: RowProps) {
  const elsewhere = row.domains.filter((id) => id !== here);
  return (
    <ListItem>
      <div className={styles.row}>
        <div className={styles.main}>
          <TextLink href={row.href} tone="title">
            {row.title}
          </TextLink>
          {row.summary === '' ? null : (
            <Text as="p" clamp={2}>
              {row.summary}
            </Text>
          )}
          {here === undefined || elsewhere.length === 0 ? null : (
            <Text size="sm" tone="faint">
              Also lands in {elsewhere.map(nameOf).join(', ')}
            </Text>
          )}
          {here !== undefined || row.domains.length === 0 ? null : (
            <span className={styles.domains}>
              {row.domains.map((id) => (
                <Button
                  key={id}
                  onClick={() => {
                    onDomain(id);
                  }}
                  title={`Only plans in ${nameOf(id)}`}
                  variant="quiet"
                >
                  {nameOf(id)}
                </Button>
              ))}
            </span>
          )}
        </div>
        <div className={styles.side}>
          <span className={styles.top}>
            <Badge tone={TONES[row.stage]}>{STAGE_WORDS[row.stage]}</Badge>
            <Text mono size="sm" tone="faint">
              {row.date ?? '—'}
            </Text>
          </span>
          <CheckBadge row={row} />
          {row.progressUnknown === undefined || row.progressUnknown === 0 ? null : (
            <Text size="sm" tone="muted">
              {plural(row.progressUnknown, 'work item')} with unknown GitHub state
            </Text>
          )}
          {row.workItems === 0 ? (
            <Text size="sm" tone="faint">
              No work yet
            </Text>
          ) : (
            <span className={styles.progress}>
              <ProgressBar label={`${row.title}: work done`} max={row.workItems} value={row.done} />
              <Text size="sm">
                {row.done} of {plural(row.workItems, 'work item')}
                {row.progressUnknown === undefined ? '' : ' recorded closed'}
              </Text>
            </span>
          )}
        </div>
      </div>
    </ListItem>
  );
}
