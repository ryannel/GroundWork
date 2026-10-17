import Link from 'next/link';
import type { ReactNode } from 'react';

import type { Model } from '@/application/plan/derive';
import { type Outline, pageHref } from '@/application/plan-pages';
import { versionKey } from '@/application/plan-pages-screens-versions';
import type { CheckView } from '@/application/plan-story-versions-checks';
import type { EditItem } from '@/application/plan-story-versions-edit-item';
import type { Prose } from '@/application/plan-story-versions-page';
import type { TallyItem } from '@/application/plan-story-versions-tally';
import type { RevisionLook } from '@/application/plan-story-versions-words';
import { EntityChips } from '@/features/plan/common/entity-chip';
import { ModelInline } from '@/features/plan/common/model-text';
import { Badge, type BadgeTone } from '@/ui/badge';

import styles from './version-parts.module.css';

const TONE: Readonly<Record<RevisionLook, BadgeTone>> = {
  proposed: 'modified',
  rejected: 'removed',
  'in-force': 'added',
  superseded: 'neutral',
};

/** A version's status, as a badge that matches how the history screen shows it. */
export function StatusBadge({
  look,
  word,
}: {
  readonly look: RevisionLook;
  readonly word: string;
}) {
  return <Badge tone={TONE[look]}>{word}</Badge>;
}

/** One titled block of a version's page. */
export function Block({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <section className={styles.block}>
      <h3 className={styles.title}>{title}</h3>
      {children}
    </section>
  );
}

type Written = Exclude<Prose, { readonly key: 'missing' }>;

function Goals({
  model,
  prose,
}: {
  readonly model: Model;
  readonly prose: Extract<Written, { readonly key: 'goals' }>;
}) {
  return (
    <>
      <p className={styles.text}>
        <ModelInline model={model} text={prose.summary} />
      </p>
      <ul className={styles.list}>
        {prose.goals.map((g) => (
          <li key={g}>
            <ModelInline model={model} text={g} />
          </li>
        ))}
      </ul>
      <p className={styles.faint}>{prose.counts}</p>
    </>
  );
}

function Since({
  outline,
  model,
  prose,
}: {
  readonly outline: Outline;
  readonly model: Model;
  readonly prose: Extract<Written, { readonly key: 'since' }>;
}) {
  if (prose.lines.length === 0) {
    return <p className={styles.faint}>Nothing has been proposed on it.</p>;
  }
  return (
    <ul className={styles.list}>
      {prose.lines.map((line) => (
        <li key={line.version}>
          <Link href={pageHref(outline, 'versions', versionKey(line.version))}>{line.version}</Link>{' '}
          <ModelInline model={model} text={line.text} />
        </li>
      ))}
    </ul>
  );
}

/** The sections that are prose: a paragraph, the goals, or what was proposed since. */
export function ProseBlock({
  outline,
  model,
  prose,
}: {
  readonly outline: Outline;
  readonly model: Model;
  readonly prose: Written;
}) {
  switch (prose.key) {
    case 'text': {
      return (
        <Block title={prose.title}>
          <p className={prose.faint ? styles.faint : styles.text}>
            <ModelInline model={model} text={prose.text} />
          </p>
        </Block>
      );
    }
    case 'goals': {
      return (
        <Block title={prose.title}>
          <Goals model={model} prose={prose} />
        </Block>
      );
    }
    case 'since': {
      return (
        <Block title={prose.title}>
          <Since model={model} outline={outline} prose={prose} />
        </Block>
      );
    }
  }
}

/** What a revision changes, counted: each item reads on its own, toned by how much it needs a look. */
export function TallyList({ items }: { readonly items: readonly TallyItem[] }) {
  return (
    <ul className={styles.tally}>
      {items.map((item) => (
        <li className={styles.item} data-tone={item.tone} key={item.text}>
          {item.text}
        </li>
      ))}
    </ul>
  );
}

function Check({ model, check }: { readonly model: Model; readonly check: CheckView }) {
  const at =
    check.at.length === 0 ? null : (
      <span className={styles.at}>
        {check.atLabel} <EntityChips ids={check.at} model={model} />
      </span>
    );
  return (
    <li className={styles.check} data-level={check.level}>
      <span aria-hidden="true" className={styles.icon}>
        {check.icon}
      </span>
      <div>
        <b>{check.word}</b>{' '}
        <span>
          <ModelInline model={model} text={check.text} />
        </span>
        {check.inline ? ' ' : null}
        {at}
      </div>
    </li>
  );
}

/** What to ask before deciding, or a plain "nothing". */
export function Checks({
  model,
  checks,
}: {
  readonly model: Model;
  readonly checks: readonly CheckView[];
}) {
  if (checks.length === 0) return <p className={styles.faint}>Nothing to check.</p>;
  return (
    <ul className={styles.checks}>
      {checks.map((check) => (
        <Check check={check} key={`${check.word}${check.text}`} model={model} />
      ))}
    </ul>
  );
}

/** What reviewers said about an earlier try at the same thing. */
export function Said({
  model,
  lines,
}: {
  readonly model: Model;
  readonly lines: readonly string[];
}) {
  return (
    <ul className={styles.list}>
      {lines.map((line) => (
        <li key={line}>
          <ModelInline model={model} text={line} />
        </li>
      ))}
    </ul>
  );
}

function Edit({ model, item }: { readonly model: Model; readonly item: EditItem }) {
  return (
    <li className={styles.edit}>
      <ModelInline model={model} text={item.what} />
      {item.detail === '' ? null : <span className={styles.faint}> {item.detail}</span>}
      {item.was === null && item.now === null ? null : (
        <div className={styles.moves}>
          <del>{item.was}</del> → <ins>{item.now}</ins>
        </div>
      )}
      {item.via === null ? null : (
        <div className={styles.faint}>
          In the change <ModelInline model={model} text={item.via} />
        </div>
      )}
    </li>
  );
}

/** Every edit to the plan itself, folded away until asked for. */
export function Edits({
  model,
  title,
  items,
}: {
  readonly model: Model;
  readonly title: string;
  readonly items: readonly EditItem[];
}) {
  return (
    <details className={styles.edits}>
      <summary>{title}</summary>
      {items.length === 0 ? (
        <p className={styles.faint}>Nothing in the plan itself.</p>
      ) : (
        <ul className={styles.editList}>
          {items.map((item) => (
            <Edit item={item} key={`${item.what}${item.detail}${item.via ?? ''}`} model={model} />
          ))}
        </ul>
      )}
    </details>
  );
}
