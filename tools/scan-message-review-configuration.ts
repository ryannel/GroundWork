import type { ScanDocument } from '@/domain/scan/scan.generated';

import { messageBoundary, messageCall, messageMethod } from './scan-message-review-graph';
import { profileGraph, type ProfileGraph } from './scan-profile-review-graph';
import { individualRecipe } from './scan-profile-review-individual-atoms';
import { methodRecipe } from './scan-profile-review-method';
import { targets } from './scan-semantic-query';

const SERIALIZER = 'ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG';
const DELIVERY = ['ProducerConfig', 'DELIVERY_TIMEOUT_MS_CONFIG'].join('.');
const BASE = 'com.volvocars.ecom.customerservice.config.event.';
const CHANNELS = [
  [
    'CustomerEventService',
    'publishCustomerEvent',
    'CustomerEventSettings',
    'kafka.customer-event',
    'app5541-customer-events',
  ],
  [
    'AnalyticsEventService',
    'publishAnalyticsEvent',
    'AnalyticsEventSettings',
    'kafka.customer-analytics-event',
    'app5541-customer-analytics',
  ],
] as const;

export function messageConfigurationValue(
  document: ScanDocument,
  expected: readonly [string, string | number | boolean, string],
): boolean {
  const [key, value, filename] = expected;
  return (document.bindings ?? [])
    .filter((record) => record.kind === 'configuration_binding')
    .filter((record) => record.format === 'yaml')
    .some((record) => {
      const source = document.sources.find((entry) => entry.id === record.source);
      return (
        source?.path.endsWith(`/${filename}`) === true &&
        record.properties.some(
          (property) =>
            property.key === key &&
            property.value === value &&
            property.value_kind === 'literal' &&
            document.sources.some(
              (entry) => entry.id === property.source && entry.path === source.path,
            ),
        )
      );
    });
}

function templateFactory(graph: ProfileGraph, expected: readonly string[]): boolean {
  const [file = '', method = '', type, factory = ''] = expected;
  const owner = messageMethod(graph, [file, method]);
  const statements = targets(graph, targets(graph, owner, 'body')[0], 'statement');
  const construct = targets(graph, statements[0], 'returns')[0];
  const callee = targets(graph, construct, 'callee')[0];
  const argument = targets(graph, construct, 'argument')[0];
  return [
    individualRecipe(graph, targets(graph, owner, 'declared_type')[0]).replaceAll(/\s+/gu, '') ===
      type,
    statements.length === 1,
    statements[0]?.nodeKind === 'return',
    construct?.nodeKind === 'construct',
    targets(graph, callee, 'ast_child').some(
      (node) => node.nodeKind === 'type' && node.name === 'KafkaTemplate',
    ),
    individualRecipe(graph, argument) === `${factory}()`,
    messageBoundary(graph, argument, messageMethod(graph, [file, factory])),
  ].every(Boolean);
}

function producerDeclarations(graph: ProfileGraph): Readonly<Record<string, boolean>> {
  return {
    producerTemplateDeclarations: [
      [
        'CustomerEventProducerConfig',
        'kafkaTemplate',
        'KafkaTemplate<String,Event<CustomerEventPayload>>',
        'customerEventProducerFactory',
      ],
      [
        'AnalyticsCustomerEventProducerConfig',
        'kafkaAnalyticsTemplate',
        'KafkaTemplate<String,AnalyticsEvent>',
        'customerAnalyticsEventProducerFactory',
      ],
    ].every((expected) => templateFactory(graph, expected)),
    producerSerializerDeclarations: [
      ['CustomerEventProducerConfig', 'customerEventProducerFactory'],
      ['AnalyticsCustomerEventProducerConfig', 'customerAnalyticsEventProducerFactory'],
    ].every(([file = '', method = '']) =>
      methodRecipe(graph, [file, method], {
        initializers: { configProps: 'buildBaseProducerSettings(kafkaSettings)' },
        calls: [
          `configProps.put(${SERIALIZER},JacksonJsonSerializer.class)`,
          'configProps.put(ProducerConfig.MAX_BLOCK_MS_CONFIG,producerSettings.maxBlockMs())',
          `configProps.put(${DELIVERY},producerSettings.deliveryTimeoutMs())`,
        ],
        returns: ['buildProducerFactory(configProps)'],
      }),
    ),
  };
}

function producerActivation(document: ScanDocument): Readonly<Record<string, boolean>> {
  const records =
    document.bindings?.filter((record) => record.kind === 'configuration_binding') ?? [];
  return {
    producerActivationDeclarations: CHANNELS.every((channel) => {
      const declaration = records.find((record) => record.declared_type === BASE + channel[2]);
      return (
        declaration?.conditions.some(
          (condition) =>
            condition.annotation_type ===
              'org.springframework.boot.autoconfigure.condition.ConditionalOnProperty' &&
            condition.arguments.some(
              (argument) =>
                argument.name === 'name' && argument.expression === `"${channel[3]}.enabled"`,
            ) &&
            condition.arguments.some(
              (argument) => argument.name === 'havingValue' && argument.expression === '"true"',
            ),
        ) === true
      );
    }),
  };
}

export function messageConfigurationClauses(
  document: ScanDocument,
): Readonly<Record<string, boolean>> {
  const graph = profileGraph(document);
  const records =
    document.bindings?.filter((record) => record.kind === 'configuration_binding') ?? [];
  return {
    ...producerDeclarations(graph),
    ...producerActivation(document),
    topicSettingsSelectors: CHANNELS.every(([file, method, settings, prefix]) => {
      const owner = messageMethod(graph, [file, method]);
      const selector = messageCall(graph, owner, 'settings.topicName()');
      const declaration = records.find((record) => record.declared_type === BASE + settings);
      const property = declaration?.properties.find(
        (entry) => entry.key === `${prefix}.topic-name`,
      );
      return (
        declaration?.prefix === prefix &&
        property?.type === 'String' &&
        declaration.selectors.some((entry) =>
          [
            entry.source === selector?.source,
            entry.receiver_type === BASE + settings,
            entry.operation === 'topicName',
            entry.property_key === property.key,
            entry.property_source === property.source,
          ].every(Boolean),
        )
      );
    }),
    declaredTopicDefaults: CHANNELS.every(
      (channel) =>
        messageConfigurationValue(document, [
          `${channel[3]}.topic-name`,
          channel[4],
          'application.yml',
        ]) &&
        messageConfigurationValue(document, [`${channel[3]}.enabled`, true, 'application.yml']),
    ),
    localProfileDisablesPublishers: CHANNELS.every((channel) =>
      messageConfigurationValue(document, [
        `${channel[3]}.enabled`,
        false,
        'application-local.yml',
      ]),
    ),
    declaredEnvironmentBoundary: records
      .filter((record) => record.format === 'yaml')
      .some((record) => record.profile === 'local' && record.gaps.length > 0),
  };
}
