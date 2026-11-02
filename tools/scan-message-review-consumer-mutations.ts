import type { ScanDocument } from '@/domain/scan/scan.generated';

interface ConsumerMutation {
  readonly name: string;
  readonly question: 'q18';
  readonly change: (document: ScanDocument) => void;
}
export const MESSAGE_CONSUMER_MUTATIONS: readonly ConsumerMutation[] = [
  {
    name: 'consumer outer call membership detached',
    question: 'q18',
    change: (document: ScanDocument): void => {
      for (const record of document.bindings ?? []) {
        if (record.kind === 'consumer_binding') record.calls = [];
      }
    },
  },
];
