import type { ScanDocument } from '@/domain/scan/scan.generated';

import { exceptionUpdateProof } from './scan-exception-review-native';
import { mongoCollectionsProof } from './scan-mongo-review-native';
import { outboundFleetProof } from './scan-outbound-review';
import { CUSTOMER_SPRING_ROUTES, reviewSpringRoutes } from './scan-spring-review-routes';

export function bindingReviewProofs(document: ScanDocument): {
  readonly q01: ReturnType<typeof reviewSpringRoutes>;
  readonly q05: ReturnType<typeof exceptionUpdateProof>;
  readonly q14: ReturnType<typeof mongoCollectionsProof>;
  readonly outbound: ReturnType<typeof outboundFleetProof>;
} {
  const bindings = document.bindings ?? [];
  const calls = bindings.filter((record) => record.kind === 'java_call_binding');
  const values = bindings.filter((record) => record.kind === 'java_value_binding');
  return {
    q01: reviewSpringRoutes(document, CUSTOMER_SPRING_ROUTES),
    q05: exceptionUpdateProof({
      document,
      calls,
      values,
      exceptions: bindings.filter((record) => record.kind === 'exception_binding'),
    }),
    q14: mongoCollectionsProof(
      bindings.filter(
        (record) =>
          record.kind === 'mongo_collection_binding' ||
          record.kind === 'mongo_repository_binding' ||
          record.kind === 'mongo_operation_binding',
      ),
      document.sources,
    ),
    outbound: outboundFleetProof({
      document,
      calls,
      values,
      outbound: bindings.filter((record) => record.kind === 'outbound_binding'),
    }),
  };
}
