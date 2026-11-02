import type { ScanDocument } from '@/domain/scan/scan.generated';

import { messageCall, messageMethod } from './scan-message-review-graph';
import { profileGraph } from './scan-profile-review-graph';

interface ConstructorMutation {
  readonly name: string;
  readonly question: 'q17';
  readonly change: (document: ScanDocument) => void;
}
function constructorSource(document: ScanDocument): string | undefined {
  const graph = profileGraph(document);
  const owner = messageMethod(graph, ['AnalyticsEventService', 'publishAnalyticsEvent']);
  return messageCall(graph, owner, 'AnalyticsEvent(analyticsCustomer,eventType)')?.source;
}
export const MESSAGE_CONSTRUCTOR_MUTATIONS: readonly ConstructorMutation[] = [
  {
    name: 'analytics constructor target detached',
    question: 'q17',
    change: (document: ScanDocument): void => {
      const source = constructorSource(document);
      if (source === undefined) return;
      for (const record of document.bindings ?? []) {
        if (record.kind === 'java_call_binding' && record.call === source) record.target = null;
      }
    },
  },
  {
    name: 'analytics constructor formal detached',
    question: 'q17',
    change: (document: ScanDocument): void => {
      const source = constructorSource(document);
      if (source === undefined) return;
      const current = document;
      current.bindings = (current.bindings ?? []).filter(
        (record) =>
          record.kind !== 'java_value_binding' ||
          record.relation !== 'argument_parameter' ||
          record.call !== source,
      );
    },
  },
];
