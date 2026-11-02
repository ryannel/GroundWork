import type { ScanDocument } from '@/domain/scan/scan.generated';
import type { ConsumerBinding } from '@/infrastructure/scan/spring-consumer-types';

import { messageConfigurationValue } from './scan-message-review-configuration';

const CONFIG = 'com.volvocars.ecom.customerservice.config.event.DeleteCustomerEventSettings';
const PREFIX = 'kafka.delete-customer-event';

function activation(binding: ConsumerBinding | undefined): boolean {
  return (
    binding?.conditions.some(
      (condition) =>
        condition.annotation_type ===
          'org.springframework.boot.autoconfigure.condition.ConditionalOnBean' &&
        condition.arguments.some(
          (argument) =>
            argument.name === 'value' && argument.expression === 'DeleteCustomerEventConfig.class',
        ),
    ) === true &&
    binding.conditions.some(
      (condition) =>
        condition.annotation_type ===
          'org.springframework.boot.autoconfigure.condition.ConditionalOnProperty' &&
        condition.arguments.some(
          (argument) => argument.name === 'name' && argument.expression === `"${PREFIX}.enabled"`,
        ) &&
        condition.arguments.some(
          (argument) => argument.name === 'havingValue' && argument.expression === '"true"',
        ),
    )
  );
}

export function messageConsumerConfiguration(
  document: ScanDocument,
  binding: ConsumerBinding | undefined,
): Readonly<Record<string, boolean>> {
  const records =
    document.bindings?.filter((record) => record.kind === 'configuration_binding') ?? [];
  const settings = records.find((record) => record.declared_type === CONFIG);
  return {
    activationConditions: activation(binding),
    settingsDeclaration:
      settings?.prefix === PREFIX &&
      settings.properties.map((property) => `${property.key}:${property.type ?? ''}`).join(',') ===
        `${PREFIX}.enabled:boolean,${PREFIX}.topic-name:String,${PREFIX}.group-id:String,${PREFIX}.reconnect-backoff:int,${PREFIX}.reconnect-backoff-max:int`,
    reconnectSettingsDeclarations:
      messageConfigurationValue(document, [
        `${PREFIX}.reconnect-backoff`,
        1000,
        'application.yml',
      ]) &&
      messageConfigurationValue(document, [
        `${PREFIX}.reconnect-backoffMax`,
        30_000,
        'application.yml',
      ]),
    localGroupOverride: messageConfigurationValue(document, [
      `${PREFIX}.group-id`,
      'app5541-customer-integration-api-local',
      'application-local.yml',
    ]),
  };
}
