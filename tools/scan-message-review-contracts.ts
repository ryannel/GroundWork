import type { ScanDocument } from '@/domain/scan/scan.generated';

import {
  messageBoundary,
  messageCall,
  messageLocal,
  messageMethod,
} from './scan-message-review-graph';
import { profileGraph, profileMethod, type ProfileGraph } from './scan-profile-review-graph';
import { individualRecipe, individualReturn } from './scan-profile-review-individual-atoms';
import { methodRecipe } from './scan-profile-review-method';
import { descendants, targets } from './scan-semantic-query';

const BASE = 'com.volvocars.ecom.customerservice.';
const SCHEMAS = {
  'messaging.CustomerEventPayload': 'customerId:String,dataVersion:Integer,timestamp:Instant',
  'messaging.CustomerEventType': '',
  'analytics.model.AnalyticsEvent':
    'id:String,type:EventType,createdAt:Instant,payload:AnalyticsCustomer',
  'analytics.model.AnalyticsCustomer':
    'customerId:String,version:Integer,created:Instant,modified:Instant,customerType:AnalyticsCustomerType,market:Market,individuals:List<AnalyticsIndividual>,corporateEntities:List<AnalyticsCorporateEntity>',
  'analytics.model.AnalyticsIndividual':
    'id:String,emailRoles:Set<EmailRole>,phoneRoles:Set<PhoneRole>,addressRoles:Set<AddressRole>,roles:Set<Role>,cdbId:String,cdbTcId:String,volvoId:String,entraId:String,useOrgAddress:boolean,contactPreferences:Set<ContactPreference>,dateOfConsent:Instant,consentInfo:ConsentInfo',
  'analytics.model.AnalyticsCorporateEntity':
    'id:String,cdbId:String,cdbTcId:String,emailRoles:Set<EmailRole>,phoneRoles:Set<PhoneRole>,addressRoles:Set<AddressRole>,roles:Set<Role>,fleetAccountId:String,fleetOrgUnitId:String,corporateType:CorporateType,legalEntityType:LegalEntityType',
};

function schemaFields(document: ScanDocument, identity: readonly [string, string]): boolean {
  const [name, fields] = identity;
  const schemas =
    document.framework
      ?.filter((record) => record.kind === 'schema_binding')
      .filter((record) => record.typeName === BASE + name) ?? [];
  const schema = schemas[0];
  if (schemas.length !== 1 || !schema) return false;
  const source = document.sources.find((entry) => entry.id === schema.source);
  return (
    schema.properties.map((property) => `${property.name}:${property.type}`).join(',') === fields &&
    schema.properties.every((property) =>
      document.sources.some((entry) => entry.id === property.source && entry.path === source?.path),
    )
  );
}

function mapperConstruction(graph: ProfileGraph, expected: readonly [string, string]): boolean {
  const [file, recipe] = expected;
  const owners = graph.nodes.filter(
    (node) =>
      node.nodeKind === 'function' &&
      graph.document.sources.some(
        (source) => source.id === node.source && source.path.endsWith(`/${file}.java`),
      ),
  );
  return owners.some((owner) => {
    if (!messageLocal(graph, owner)) return false;
    return descendants(graph, owner)
      .filter((node) => node.nodeKind === 'return')
      .some((node) =>
        targets(graph, node, 'returns').some((value) => individualRecipe(graph, value) === recipe),
      );
  });
}

const INDIVIDUAL =
  'AnalyticsIndividual(individual.id(),individual.emails()!=null?individual.emails().stream().flatMap().collect(Collectors.toSet())?Set.of(),individual.phoneNumbers()!=null?individual.phoneNumbers().stream().flatMap().collect(Collectors.toSet())?Set.of(),individual.addresses()!=null?individual.addresses().stream().flatMap().collect(Collectors.toSet())?Set.of(),individual.roles(),individual.cdbId(),individual.cdbTcId(),individual.volvoId(),individual.entraId(),individual.useOrgAddress(),individual.contactPreferences(),individual.dateOfConsent(),individual.consentInfo())';
const CORPORATE =
  'AnalyticsCorporateEntity(corporateEntity.id(),corporateEntity.cdbId(),corporateEntity.cdbTcId(),corporateEntity.emails()!=null?corporateEntity.emails().stream().flatMap().collect(Collectors.toSet())?Set.of(),corporateEntity.phoneNumbers()!=null?corporateEntity.phoneNumbers().stream().flatMap().collect(Collectors.toSet())?Set.of(),corporateEntity.addresses()!=null?corporateEntity.addresses().stream().flatMap().collect(Collectors.toSet())?Set.of(),corporateEntity.roles(),corporateEntity.fleetAccountId(),corporateEntity.fleetOrgUnitId(),corporateEntity.corporateType(),corporateEntity.legalEntityType())';

function flattenCallbacks(graph: ProfileGraph, file: string): boolean {
  const sources = new Set(
    graph.document.sources
      .filter((source) => source.path.endsWith(`/${file}.java`))
      .map((source) => source.id),
  );
  const owners = graph.nodes.filter(
    (node) => node.nodeKind === 'function' && sources.has(node.source),
  );
  const nodes = owners.flatMap((owner) => descendants(graph, owner));
  const prefix = file === 'AnalyticsIndividualMapper' ? 'individual' : 'corporateEntity';
  return [
    ['emails', 'email', 'emailRoles'],
    ['phoneNumbers', 'phone', 'phoneRoles'],
    ['addresses', 'address', 'addressRoles'],
  ].every(([field, variable, roles]) => {
    const calls = nodes.filter(
      (node) =>
        node.nodeKind === 'call' &&
        individualRecipe(graph, node) === `${prefix}.${field ?? ''}().stream().flatMap()`,
    );
    const bodies = calls
      .flatMap((call) => targets(graph, call, 'callback'))
      .flatMap((callback) => descendants(graph, callback));
    return (
      calls.length === 1 &&
      bodies.some(
        (node) => individualRecipe(graph, node) === `${variable ?? ''}.${roles ?? ''}().stream()`,
      )
    );
  });
}

function collectionMapping(
  graph: ProfileGraph,
  identity: readonly [string, string, string],
): boolean {
  const [file, parameterName, inputType] = identity;
  const owners = profileMethod(graph, file, 'to').filter((owner) => {
    const parameters = targets(graph, owner, 'parameter');
    return (
      parameters.length === 1 &&
      targets(graph, parameters[0], 'declared_type')[0]?.name === inputType
    );
  });
  const owner = owners.length === 1 ? owners[0] : undefined;
  const statements = targets(graph, targets(graph, owner, 'body')[0], 'statement');
  const guard = statements[0];
  return [
    messageLocal(graph, owner),
    statements.length === 2,
    guard?.nodeKind === 'if',
    individualRecipe(graph, targets(graph, guard, 'condition')[0]) === `${parameterName}==null`,
    targets(graph, guard, 'consequent').some((body) => individualReturn(graph, body, 'List.of()')),
    statements[1]?.nodeKind === 'return',
    individualRecipe(graph, targets(graph, statements[1], 'returns')[0]) ===
      `${parameterName}.stream().map(this::to).toList()`,
  ].every(Boolean);
}

function constructorApplied(graph: ProfileGraph): boolean {
  const owner = messageMethod(graph, ['AnalyticsEventService', 'publishAnalyticsEvent']);
  const construct = messageCall(graph, owner, 'AnalyticsEvent(analyticsCustomer,eventType)');
  const declaration = descendants(graph, owner).find(
    (node) => node.nodeKind === 'declaration' && node.name === 'event',
  );
  return (
    targets(graph, declaration, 'value')[0]?.id === construct?.id &&
    construct !== undefined &&
    messageBoundary(graph, construct, messageMethod(graph, ['AnalyticsEvent', '<init>', 2]))
  );
}

export function messageContractClauses(document: ScanDocument): Readonly<Record<string, boolean>> {
  const graph = profileGraph(document);
  return {
    payloadSchemas: Object.entries(SCHEMAS).every((entry) => schemaFields(document, entry)),
    customerPayloadMapping:
      mapperConstruction(graph, [
        'CustomerEventService',
        'CustomerEventPayload(updated.customerId(),updated.version(),updated.modified())',
      ]) ||
      messageCall(
        graph,
        messageMethod(graph, ['CustomerEventService', 'publishCustomerEvent']),
        'CustomerEventPayload(updated.customerId(),updated.version(),updated.modified())',
      ) !== undefined,
    analyticsCustomerMapping:
      methodRecipe(graph, ['AnalyticsCustomerMapper', 'to'], {
        initializers: {
          type: 'customerTypeMapper.to(customer,fleetAccount)',
          individuals: 'individualMapper.to(customer.individuals())',
          corporateEntities: 'corporateEntityMapper.to(customer.corporateEntities())',
        },
      }) &&
      mapperConstruction(graph, [
        'AnalyticsCustomerMapper',
        'AnalyticsCustomer(customer.customerId(),customer.version(),customer.created(),customer.modified(),type,customer.market(),individuals,corporateEntities)',
      ]),
    analyticsIndividualMapping:
      mapperConstruction(graph, ['AnalyticsIndividualMapper', INDIVIDUAL]) &&
      flattenCallbacks(graph, 'AnalyticsIndividualMapper'),
    analyticsCorporateMapping:
      mapperConstruction(graph, ['AnalyticsCorporateEntityMapper', CORPORATE]) &&
      flattenCallbacks(graph, 'AnalyticsCorporateEntityMapper'),
    analyticsCollectionMapping:
      collectionMapping(graph, ['AnalyticsIndividualMapper', 'individuals', 'List<Individual>']) &&
      collectionMapping(graph, [
        'AnalyticsCorporateEntityMapper',
        'corporateEntities',
        'List<CorporateEntity>',
      ]),
    analyticsConstructorApplied: constructorApplied(graph),
  };
}
