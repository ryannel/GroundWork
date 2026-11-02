import type { ScanDocument } from '@/domain/scan/scan.generated';

import type { EventQuestionProof } from './scan-event-review';
import { messageAnalyticsClauses } from './scan-message-review-analytics';
import { messageConfigurationClauses } from './scan-message-review-configuration';
import { messageConsumerClauses } from './scan-message-review-consumer';
import { messageContractClauses } from './scan-message-review-contracts';
import { messagePublishClauses } from './scan-message-review-publish';

function enums(document: ScanDocument): boolean {
  const records = document.bindings?.filter((record) => record.kind === 'enum_binding') ?? [];
  const customer = records.find(
    (record) => record.type === 'com.volvocars.ecom.customerservice.messaging.CustomerEventType',
  );
  const analytics = records.find(
    (record) =>
      record.type === 'com.volvocars.ecom.customerservice.analytics.model.AnalyticsEvent.EventType',
  );
  return (
    customer?.constants.map((entry) => entry.name).join(',') ===
      'CUSTOMER_CREATED,CUSTOMER_UPDATED,CUSTOMER_ARCHIVED' &&
    analytics?.constants
      .map((entry) => `${entry.name}:${entry.declared_json_name ?? ''}`)
      .join(',') === 'CREATED:created,UPDATED:updated,DELETED:deleted' &&
    analytics.constants.every(
      (entry) =>
        entry.json_name_source !== null &&
        entry.annotation_sources.length === 1 &&
        [...entry.annotation_sources, entry.json_name_source, entry.source].every((id) =>
          document.sources.some((source) => source.id === id),
        ),
    )
  );
}

export function messageQuestionProofs(document: ScanDocument): {
  readonly q17: EventQuestionProof;
  readonly q18: EventQuestionProof;
} {
  const q17 = {
    ...messagePublishClauses(document),
    ...messageAnalyticsClauses(document),
    ...messageContractClauses(document),
    ...messageConfigurationClauses(document),
    eventEnumDeclarations: enums(document),
  };
  const q18 = messageConsumerClauses(document);
  return {
    q17: {
      supported: Object.values(q17).every(Boolean),
      clauses: q17,
      details: [
        'No previous customer selects CUSTOMER_CREATED / CREATED; otherwise archival data selects CUSTOMER_ARCHIVED / DELETED; otherwise CUSTOMER_UPDATED / UPDATED. The analytics enum declares JSON values created, deleted and updated respectively; effective codec behaviour remains unobserved.',
        'Customer payload maps current customerId, version and modified to customerId, dataVersion and timestamp. Analytics payload follows the customer and nested individual/corporate mapper declarations. Message keys use the updated customer ID. The source topic defaults are app5541-customer-events and app5541-customer-analytics; the local profile disables both. Spring configuration precedence and effective runtime values remain unobserved.',
        'The source declares guarded publication attempts. External publisher helpers, codec configuration and broker acknowledgement do not establish successful delivery.',
      ],
    },
    q18: {
      supported: Object.values(q18).every(Boolean),
      clauses: q18,
      details: [
        'The listener declares the delete-customer-event topic/group placeholders and deleteCustomerConsumerFactory; the base source defaults are app5541-delete-customer-events and app5541-customer-integration-api. The local profile disables the consumer. Bean/property conditions and factory configuration are declarations; effective activation and environment are unobserved.',
        'The String payload enters the exact source deserialiser targeting Event<DeleteCustomerEventPayload>; its customerId reaches the CustomerService delete formal through a qualified nominal source candidate where generated payload accessors prevent exact type resolution, then reaches the active-customer repository deleteByCustomerId attempt. This local path declares no type discriminator, archive deletion, audit write or publication.',
        'A JacksonException is wrapped in CustomerServiceException with its cause; its message mistakenly names PaymentEventPayload. A synchronous failure prevents later local statements and escapes the consumer. Container acknowledgement, retry, dead-letter, framework codec and broker delivery policy remain unknown at unavailable dependency boundaries; reconnect backoff is not a business retry guarantee.',
      ],
    },
  };
}
