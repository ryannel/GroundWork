import type { Model } from '@/application/plan/derive';
import type { RevisionStep } from '@/application/plan/revision-types';
import { type Outline, type Page, planHref } from '@/application/plan-pages';
import type { VersionsData } from '@/application/plan-story-versions-data';
import { type Section, sectionKey, versionView } from '@/application/plan-story-versions-view';
import { ScreenHead } from '@/features/plan/chapters/screen-head';
import { ModelInline } from '@/features/plan/common/model-text';

import { JourneyBlock } from './journey-block';
import { TeamsBlock } from './teams-block';
import { Block, Checks, Edits, ProseBlock, Said, StatusBadge, TallyList } from './version-parts';
import styles from './version-screen.module.css';

interface Ctx {
  readonly model: Model;
  readonly outline: Outline;
}

function Body({ ctx, section }: { readonly ctx: Ctx; readonly section: Section }) {
  const { model, outline } = ctx;
  switch (section.key) {
    case 'tally': {
      return (
        <Block title={section.title}>
          <TallyList items={section.items} />
        </Block>
      );
    }
    case 'checks': {
      return (
        <Block title={section.title}>
          <Checks checks={section.checks} model={model} />
        </Block>
      );
    }
    case 'journey': {
      return (
        <Block title={section.title}>
          <JourneyBlock base={planHref(outline)} model={model} view={section.journey} />
        </Block>
      );
    }
    case 'teams': {
      return (
        <Block title={section.title}>
          <TeamsBlock model={model} view={section.teams} />
        </Block>
      );
    }
    case 'said': {
      return (
        <Block title={section.title}>
          <Said lines={section.lines} model={model} />
        </Block>
      );
    }
    case 'edits': {
      return <Edits items={section.items} model={model} title={section.title} />;
    }
    case 'missing': {
      return <p className={styles.missing}>{section.text}</p>;
    }
    default: {
      return <ProseBlock model={model} outline={outline} prose={section} />;
    }
  }
}

/** One version of the plan: what it is, then what it does, in the order a reviewer needs it. */
export function VersionScreen({
  model,
  outline,
  page,
  versions,
  step,
}: {
  readonly model: Model;
  readonly outline: Outline;
  readonly page: Page;
  readonly versions: VersionsData;
  readonly step: RevisionStep;
}) {
  const view = versionView(model, versions, step);
  const ctx = { model, outline };
  return (
    <div className={styles.screen}>
      <ScreenHead headline={view.head.headline} outline={outline} page={page}>
        <div className={styles.meta}>
          <StatusBadge look={view.head.look} word={view.head.word} />
          <ModelInline model={model} text={view.head.meta} />
        </div>
        <p className={styles.lede}>
          <ModelInline model={model} text={view.head.lede} />
        </p>
      </ScreenHead>
      {view.sections.map((section) => (
        <Body ctx={ctx} key={sectionKey(section)} section={section} />
      ))}
    </div>
  );
}
