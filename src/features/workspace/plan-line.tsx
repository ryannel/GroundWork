import { STAGE_WORDS, type PlanRow, type PlanStage } from '@/application/plan-index';
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

interface RowProps {
  readonly row: PlanRow;
  readonly nameOf: (id: string) => string;
  readonly onDomain: (id: string) => void;
}

/** One plan as a row: its title and problem, the domains it lands in, its stage, how far its work has got. */
export function PlanLine({ row, nameOf, onDomain }: RowProps) {
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
          {row.domains.length === 0 ? null : (
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
          {row.workItems === 0 ? (
            <Text size="sm" tone="faint">
              No work yet
            </Text>
          ) : (
            <span className={styles.progress}>
              <ProgressBar label={`${row.title}: work done`} max={row.workItems} value={row.done} />
              <Text size="sm">
                {row.done} of {plural(row.workItems, 'work item')}
              </Text>
            </span>
          )}
        </div>
      </div>
    </ListItem>
  );
}
