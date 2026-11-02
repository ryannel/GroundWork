import type { QuestionMutationScenario } from './scan-profile-question-mutations';

const Q12_RELATIONS = [
  ['CDB invalid/null/partial response conditions', 'CdbClient', 'getConsumer', 'condition'],
  ['CDB null return relationship', 'CdbClient', 'getConsumer', 'returns'],
  ['CDB request receiver chain', 'CdbClient', 'getConsumer', 'receiver'],
  ['Connect claims decode arguments', 'ConnectTokenService', 'decode', 'argument'],
  ['Volvo future token capture', 'FactoryContext', '<init>', 'captures'],
  ['Volvo future conditional selection', 'FactoryContext', '<init>', 'consequent'],
  ['Source fallback helper completion', 'EntityFactory', 'nullable', 'next'],
] as const;
const Q13_RELATIONS = [
  ['Fleet source response return', 'FleetClient', 'getFleetAccount', 'returns'],
  [
    'Partner translated exception value',
    'CommercialPartnerClient',
    'getActivePartnerByPartnerId',
    'value',
  ],
  ['Corporate request variant dispatch', 'ICorporateEntityFactory', 'mapCreate', 'returns'],
  ['Null-filtered corporate list return', 'ICorporateEntityListFactory', 'create', 'returns'],
  [
    'Partner active facility callback join',
    'PartnerCorporateEntityMapper',
    'activeFacility',
    'callback',
  ],
  ['Partner preferred name callback join', 'PartnerCorporateEntityMapper', 'getName', 'callback'],
  [
    'Partner preferred address callback join',
    'PartnerCorporateEntityMapper',
    'getAddresses',
    'callback',
  ],
  [
    'Fleet account loader callback join',
    'FleetCorporateEntityFactory',
    'getFleetAccount',
    'callback',
  ],
  ['Fleet unit loader callback join', 'FleetCorporateEntityFactory', 'getOrgUnits', 'callback'],
] as const;

const Q12_ATOMS = [
  ['Connect empty claims conjunction', 'ConnectTokenService', 'isEmpty', 'operator', '&&', '||'],
  ['Entra app-token exclusion', 'EntraIdTokenService', 'isUserToken', 'value', 'app', 'unrelated'],
] as const;
const Q13_ATOMS = [
  [
    'Fleet account approval inequality',
    'FleetService',
    'getAndValidateFleetAccountForOrdering',
    'operator',
    '!=',
    '==',
  ],
  [
    'Partner permission negation',
    'PartnerCorporateEntityFactory',
    'validatePartnerId',
    'operator',
    '!',
    '',
  ],
] as const;

const Q12_ORDERS = [
  [
    'Individual profile constructor field order',
    'IndividualFactory',
    'mapPatch',
    'Individual',
    1,
    2,
  ],
  [
    'Connect profile constructor field order',
    'ConnectTokenIndividualFactory',
    'createFromConnectToken',
    'Individual',
    1,
    9,
  ],
] as const;
const Q13_ORDERS = [
  [
    'Customer individual/corporate argument order',
    'CustomerFactory',
    'mapCreate',
    'Customer',
    0,
    1,
  ],
  [
    'Fleet corporate constructor field order',
    'FleetCorporateEntityMapper',
    'to',
    'CorporateEntity',
    1,
    2,
  ],
  [
    'Partner corporate constructor field order',
    'PartnerCorporateEntityMapper',
    'to',
    'CorporateEntity',
    9,
    10,
  ],
  ['Fleet source mapper argument order', 'FleetCorporateEntityFactory', 'create', 'to', 0, 1],
] as const;

/** Each mutation locates native semantic roles or typed source contracts; display syntax is untouched. */
export const QUESTION_MUTATIONS: readonly QuestionMutationScenario[] = [
  ...Q12_RELATIONS.map(([name, file, method, relation]) => ({
    question: 'q12' as const,
    name,
    change: { kind: 'relation' as const, scope: { file, method }, relation },
  })),
  ...Q13_RELATIONS.map(([name, file, method, relation]) => ({
    question: 'q13' as const,
    name,
    change: { kind: 'relation' as const, scope: { file, method }, relation },
  })),
  ...Q12_ATOMS.map(([name, file, method, atom, from, to]) => ({
    question: 'q12' as const,
    name,
    change: { kind: 'atom' as const, scope: { file, method }, atom, from, to },
  })),
  ...Q13_ATOMS.map(([name, file, method, atom, from, to]) => ({
    question: 'q13' as const,
    name,
    change: { kind: 'atom' as const, scope: { file, method }, atom, from, to },
  })),
  ...Q12_ORDERS.map(([name, file, method, callee, first, second]) => ({
    question: 'q12' as const,
    name,
    change: {
      kind: 'order' as const,
      scope: { file, method },
      callee,
      positions: [first, second] as const,
    },
  })),
  ...Q13_ORDERS.map(([name, file, method, callee, first, second]) => ({
    question: 'q13' as const,
    name,
    change: {
      kind: 'order' as const,
      scope: { file, method },
      callee,
      positions: [first, second] as const,
    },
  })),
  {
    question: 'q12',
    name: 'Entra oid claim constant',
    change: { kind: 'constant', name: 'OID_CLAIM', value: 'unrelated' },
  },
  {
    question: 'q12',
    name: 'Volvo user response contract',
    change: { kind: 'contract', type: 'VolvoIdUser' },
  },
  {
    question: 'q13',
    name: 'Partner response contract',
    change: { kind: 'contract', type: 'PartnerOrganizationalUnit' },
  },
  {
    question: 'q12',
    name: 'CDB document variable binding',
    change: { kind: 'document', document: 'getConsumer' },
  },
  {
    question: 'q13',
    name: 'Partner document variable binding',
    change: { kind: 'document', document: 'getPartnerById' },
  },
  {
    question: 'q12',
    name: 'CDB logical client boundary',
    change: { kind: 'boundary', file: 'CdbClient', field: 'logical' },
  },
  {
    question: 'q12',
    name: 'Volvo error translation boundary',
    change: { kind: 'boundary', file: 'VolvoIdClient', field: 'failures' },
  },
  {
    question: 'q13',
    name: 'Fleet error translation boundary',
    change: { kind: 'boundary', file: 'FleetClient', field: 'failures' },
  },
  {
    question: 'q13',
    name: 'Fleet HTTP method boundary',
    change: { kind: 'boundary', file: 'FleetClient', field: 'method' },
  },
  {
    question: 'q13',
    name: 'Partner logical client boundary',
    change: { kind: 'boundary', file: 'CommercialPartnerClient', field: 'logical' },
  },
  {
    question: 'q12',
    name: 'Individual request and fallback source references',
    change: { kind: 'reference', scope: { file: 'IndividualFactory', method: 'mapPatch' } },
  },
  {
    question: 'q13',
    name: 'Fleet URI input source references',
    change: { kind: 'reference', scope: { file: 'FleetClient', method: 'getFleetAccount' } },
  },
  {
    question: 'q12',
    name: 'CDB nested person type with target schema retained',
    change: {
      kind: 'contract_type',
      type: 'com.volvocars.ecom.customerservice.consumer.model.CdbConsumer',
      property: 'person',
      value: 'String',
    },
  },
  {
    question: 'q13',
    name: 'Partner nested address container with target schema retained',
    change: {
      kind: 'contract_type',
      type: 'com.volvocars.ecom.customerservice.partner.client.model.PartnerOrganizationalUnit.Facility',
      property: 'addresses',
      value: 'Map<String,Address>',
    },
  },
];
