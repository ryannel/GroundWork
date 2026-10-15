import type { PlanCard } from '@/application/plan-footprint';
import type { Landscape } from '@/application/workspace-landscape';
import { AppBar } from '@/ui/app-bar';
import { Badge } from '@/ui/badge';
import { Callout } from '@/ui/callout';
import { Card } from '@/ui/card';
import { Facts } from '@/ui/facts';
import { PageHeader } from '@/ui/page-header';
import { SectionHeading } from '@/ui/section-heading';

import { Diagram } from './diagram';
import styles from './landscape-page.module.css';

interface LandscapePageProps {
  readonly landscape: Landscape;
  readonly folder: string;
  /** The workspace's plans; leave out and the section is not drawn. */
  readonly plans?: readonly PlanCard[];
}

export function LandscapePage({ landscape, folder, plans }: LandscapePageProps) {
  return (
    <>
      <AppBar />
      <main className={styles.page}>
        <PageHeader
          description={landscape.description}
          meta={<Facts items={landscape.facts} />}
          title={landscape.name}
          trail={[{ label: 'Workspaces', href: '/' }]}
        />
        {landscape.domains.length === 0 ? (
          <Callout title="No domains yet">
            <p>
              Add a domain as a folder with a <code>domain.yaml</code> under{' '}
              <code>workspaces/{folder}/domains/</code>, then its systems under{' '}
              <code>systems/</code>.
            </p>
          </Callout>
        ) : (
          <>
            <section className={styles.section}>
              <SectionHeading title="Landscape">
                <p>
                  Each box is a domain and each arrow is one system calling or messaging another.
                  Open a domain by its name, or a system by its box.
                </p>
              </SectionHeading>
              <Diagram
                diagram={landscape.diagram}
                label="The systems in each domain and what they talk to"
              />
            </section>
            <section className={styles.section}>
              <SectionHeading title="Domains" />
              <ul className={styles.domains}>
                {landscape.domains.map((domain) => (
                  <li key={domain.id}>
                    <Card href={domain.href} title={domain.name}>
                      {domain.purpose === null ? null : (
                        <p className={styles.purpose}>{domain.purpose}</p>
                      )}
                      <p className={styles.size}>{domain.size}</p>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
        {plans === undefined ? null : <Plans plans={plans} />}
      </main>
    </>
  );
}

function Plans({ plans }: { readonly plans: readonly PlanCard[] }) {
  return (
    <section className={styles.section}>
      <SectionHeading title="Plans" />
      {plans.length === 0 ? (
        <p className={styles.empty}>No plans yet.</p>
      ) : (
        <ul className={styles.domains}>
          {plans.map((plan) => (
            <li key={plan.id}>
              <Card href={plan.href} title={plan.title}>
                <Badge tone="accent">{plan.stage}</Badge>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
