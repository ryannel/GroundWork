import 'server-only';

import { collectJavaBindings } from './java-call-bindings';
import { collectJavaCollectionBindings } from './java-collection-bindings';
import { collectJavaConstantBindings } from './java-constant-bindings';
import type { JavaUnit } from './java-declarations';
import { collectEnumBindings } from './java-enum-bindings';
import type { SourceIndex } from './source-index-types';
import { collectAsyncBindings } from './spring-async-bindings';
import { collectConfigurationBindings } from './spring-configuration-bindings';
import { collectConsumerBindings } from './spring-consumer-bindings';
import { collectEventBindings } from './spring-event-bindings';
import { collectExceptionBindings } from './spring-exception-bindings';
import { collectMongoBindings } from './spring-mongo-bindings';
import { collectClientBoundaryBindings } from './spring-outbound-bindings';
import { collectScheduleBindings } from './spring-schedule-bindings';

type ProgramBinding =
  | ReturnType<typeof collectJavaBindings>['calls'][number]
  | ReturnType<typeof collectJavaBindings>['values'][number]
  | ReturnType<typeof collectJavaConstantBindings>[number]
  | ReturnType<typeof collectExceptionBindings>[number]
  | ReturnType<typeof collectMongoBindings>[number]
  | ReturnType<typeof collectClientBoundaryBindings>[number]
  | ReturnType<typeof collectAsyncBindings>[number]
  | ReturnType<typeof collectEventBindings>[number]
  | ReturnType<typeof collectEnumBindings>[number]
  | ReturnType<typeof collectConfigurationBindings>[number]
  | ReturnType<typeof collectConsumerBindings>[number]
  | ReturnType<typeof collectJavaCollectionBindings>[number]
  | ReturnType<typeof collectScheduleBindings>[number];

/** Framework adapters share one call/value extraction rather than independently reconstructing it. */
export function springProgramBindings(input: {
  readonly indexes: readonly SourceIndex[];
  readonly units: readonly JavaUnit[];
  readonly executionSources?: readonly string[];
}): readonly ProgramBinding[] {
  const java = collectJavaBindings(input.indexes, input.units);
  const async = collectAsyncBindings({
    ...input,
    ...java,
    selected_owner_sources: input.executionSources ?? [],
  });
  return [
    ...java.calls,
    ...java.values,
    ...collectJavaConstantBindings(input.indexes, input.units),
    ...collectEnumBindings(input),
    ...collectJavaCollectionBindings({ ...input, ...java }),
    ...collectConfigurationBindings({ ...input, ...java }),
    ...collectConsumerBindings({ ...input, ...java }),
    ...collectExceptionBindings(input.indexes, input.units),
    ...collectMongoBindings(input.indexes, input.units),
    ...collectClientBoundaryBindings({ ...input, ...java }),
    ...async,
    ...collectScheduleBindings({
      ...input,
      ...java,
      async_bindings: async.filter((binding) => binding.kind === 'async_binding'),
    }),
    ...collectEventBindings({ ...input, ...java }),
  ];
}
