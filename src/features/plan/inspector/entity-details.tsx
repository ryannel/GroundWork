import type { Model } from '@/application/plan/derive';
import type {
  EntityFact,
  EntityGroup,
  EntityRef,
  EntityView,
} from '@/application/plan-pages-entity';
import { ModelText } from '@/features/plan/common/model-text';
import { PlanImage } from '@/features/plan/viz/screens/plan-image';
import { Chip, ChipList } from '@/ui/chip';

import styles from './entity-details.module.css';

function Group({ label, refs }: { readonly label: string; readonly refs: readonly EntityRef[] }) {
  if (refs.length === 0) return null;
  return (
    <section className={styles.group}>
      <h4 className={styles.label}>{label}</h4>
      <ChipList>
        {refs.map((ref) => (
          <Chip glyph={ref.glyph} id={ref.id} key={ref.id} label={ref.label} status={ref.status} />
        ))}
      </ChipList>
    </section>
  );
}

function Fact({ fact }: { readonly fact: EntityFact }) {
  return (
    <div className={styles.fact}>
      <dt>{fact.label}</dt>
      <dd>
        {fact.href === null ? (
          fact.value
        ) : (
          <a href={fact.href} rel="noreferrer" target="_blank">
            {fact.value} ↗
          </a>
        )}
      </dd>
    </div>
  );
}

interface EntityDetailsProps {
  readonly model: Model;
  readonly view: EntityView;
  /** Today's view leaves out what the plan adds. */
  readonly today: boolean;
  /** Where its picture is, resolved against the plan. */
  readonly image: string | null;
}

const visible = (refs: readonly EntityRef[], today: boolean): readonly EntityRef[] =>
  today ? refs.filter((ref) => ref.status !== 'added') : refs;

const groupsIn = (groups: readonly EntityGroup[], today: boolean) =>
  groups.map((group) => (
    <Group key={group.label} label={group.label} refs={visible(group.refs, today)} />
  ));

/** What a thing points at or is pointed at by, as chips under each label. */
export function EntityGroups({ groups }: { readonly groups: readonly EntityGroup[] }) {
  return <div className={styles.details}>{groupsIn(groups, true)}</div>;
}

// Everything the plan says about one thing. Its chips carry data-inspect, so the open inspector hops to them.
export function EntityDetails({ model, view, today, image }: EntityDetailsProps) {
  return (
    <div className={styles.details}>
      {image === null ? null : (
        <a className={styles.picture} href={image} rel="noreferrer" target="_blank">
          <PlanImage alt={`${view.name}, as drawn in the plan`} src={image} />
        </a>
      )}
      {view.text === null ? null : (
        <div className={styles.text}>
          <ModelText model={model} text={view.text} />
        </div>
      )}
      {view.facts.length === 0 ? null : (
        <dl className={styles.facts}>
          {view.facts.map((fact) => (
            <Fact fact={fact} key={fact.label} />
          ))}
        </dl>
      )}
      {view.sections.map((section) => (
        <section className={styles.group} key={section.label}>
          <h4 className={styles.label}>{section.label}</h4>
          <div className={styles.text}>
            <ModelText model={model} text={section.text} />
          </div>
        </section>
      ))}
      {groupsIn(view.uses, today)}
      {groupsIn(view.usedBy, today)}
    </div>
  );
}
