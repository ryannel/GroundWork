import type { ScanDocument } from '@/domain/scan/scan.generated';

import { profileCorporateComposition } from './scan-profile-review-composition';
import { profileContracts } from './scan-profile-review-contracts';
import { profileCorporateSources } from './scan-profile-review-corporate';
import { profileFailures } from './scan-profile-review-failures';
import { profileGraphqlBoundaries } from './scan-profile-review-graphql';
import { profileIndividualComposition } from './scan-profile-review-individual';
import { profileFleetBoundaries } from './scan-profile-review-rest';
import { profileSourceClauses } from './scan-profile-review-source';
import { profileTokenSources } from './scan-profile-review-tokens';
import { profileVolvoBoundary } from './scan-profile-review-volvo';

function conjunction(clauses: Readonly<Record<string, boolean>>): boolean {
  return Object.values(clauses).length > 0 && Object.values(clauses).every(Boolean);
}

interface ProfileQuestion {
  readonly supported: boolean;
  readonly clauses: Readonly<Record<string, boolean>>;
}

/** Whole frozen source questions, with their narrower boundary/helper checks retained separately. */
export function profileQuestionProofs(document: ScanDocument): {
  readonly q12: ProfileQuestion;
  readonly q13: ProfileQuestion;
  readonly boundaries: {
    readonly fleet: ReturnType<typeof profileFleetBoundaries>;
    readonly graphql: ReturnType<typeof profileGraphqlBoundaries>;
    readonly volvo: ReturnType<typeof profileVolvoBoundary>;
  };
  readonly local: {
    readonly source: ReturnType<typeof profileSourceClauses>;
    readonly tokens: ReturnType<typeof profileTokenSources>;
    readonly individual: ReturnType<typeof profileIndividualComposition>;
    readonly corporate: ReturnType<typeof profileCorporateSources>;
    readonly composition: ReturnType<typeof profileCorporateComposition>;
    readonly failures: ReturnType<typeof profileFailures>;
  };
} {
  const boundaries = {
    fleet: profileFleetBoundaries(document),
    graphql: profileGraphqlBoundaries(document),
    volvo: profileVolvoBoundary(document),
  };
  const local = {
    source: profileSourceClauses(document),
    tokens: profileTokenSources(document),
    individual: profileIndividualComposition(document),
    corporate: profileCorporateSources(document),
    composition: profileCorporateComposition(document),
    failures: profileFailures(document),
  };
  const contracts = profileContracts(document);
  const individual = {
    responseContracts: contracts.individual,
    sourcePolicies: conjunction(local.source),
    volvoBoundary: boundaries.volvo.supported === true,
    volvoCaller: conjunction(local.failures.volvo),
    tokenSources: local.tokens.supported === true,
    cdbBoundary: boundaries.graphql.cdb?.supported === true,
    cdbFailures: conjunction(local.failures.cdb),
    contextAndMerge: local.individual.supported === true,
  };
  const corporate = {
    responseContracts: contracts.corporate,
    fleetAccountBoundary: boundaries.fleet.getFleetAccount?.supported === true,
    fleetUnitsBoundary: boundaries.fleet.getOrganizationalUnits?.supported === true,
    partnerBoundary: boundaries.graphql['commercial-partner']?.supported === true,
    partnerFailures: conjunction(local.failures.partner),
    factoriesAndMappers: local.corporate.supported === true,
    customerComposition: local.composition.supported === true,
  };
  return {
    q12: { supported: conjunction(individual), clauses: individual },
    q13: { supported: conjunction(corporate), clauses: corporate },
    boundaries,
    local,
  };
}
