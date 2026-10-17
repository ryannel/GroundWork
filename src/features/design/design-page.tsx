import { AppBar } from '@/ui/app-bar';
import { AppShell } from '@/ui/app-shell';
import { Callout } from '@/ui/callout';
import { PageHeader } from '@/ui/page-header';
import { SectionHeading } from '@/ui/section-heading';

import { DesignControls } from './design-controls.client';
import { LayoutSection } from './design-layout';
import styles from './design-page.module.css';
import { HoldersSection, StatusSection, WordsSection } from './design-sections';

// Every piece in src/ui, so a feature can find the one it needs instead of styling its own.
export function DesignPage() {
  return (
    <AppShell bar={<AppBar title="Design" />}>
      <PageHeader
        description="Every page is built from these pieces. Features lay them out; they do not restyle them."
        title="Design system"
      />
      <Callout title="Need something that is not here?">
        Add it to src/ui, with a specimen on this page, rather than styling it inside a feature.
      </Callout>
      <div className={styles.groups}>
        <WordsSection />
        <section>
          <SectionHeading title="Controls">Each one works here.</SectionHeading>
          <DesignControls />
        </section>
        <StatusSection />
        <HoldersSection />
        <LayoutSection />
      </div>
    </AppShell>
  );
}
