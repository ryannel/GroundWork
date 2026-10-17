import type { DomainMap } from '@/application/landscape-domains';
import { plural } from '@/shared/text';
import { Callout } from '@/ui/callout';
import { PageHeader } from '@/ui/page-header';

import { PeopleDirectory } from './people-directory.client';

// The people who use the systems, outside them: the customer, and the staff who keep each domain running.
export function PeoplePage({ map }: { readonly map: DomainMap }) {
  const customers = map.people.filter((p) => p.customer).length;
  return (
    <>
      <PageHeader
        description="Who uses the systems, the domains they work in, and the journeys they start."
        meta={`${plural(map.people.length, 'person', 'people')}, ${plural(customers, 'customer')}`}
        title="People"
      />
      {map.people.length === 0 ? (
        <Callout title="Nobody yet">
          <p>
            List the people who use the systems under <code>actors:</code> in workspace.yaml, with
            the components each uses. Mark the customer with <code>customer: true</code>.
          </p>
        </Callout>
      ) : (
        <PeopleDirectory map={map} />
      )}
    </>
  );
}
