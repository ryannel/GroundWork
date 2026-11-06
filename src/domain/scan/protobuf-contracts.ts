import { permalinkOf } from '@/domain/code-links';

import type { Anchor, CanonicalProtobufContracts } from './protobuf-contracts.generated';

export interface ProtobufSource {
  readonly path: string;
  readonly bytes: string;
}

export function protobufSourceUrl(
  document: Pick<CanonicalProtobufContracts, 'repo' | 'commit'>,
  anchor: Anchor,
): string {
  return permalinkOf({ ...document, ...anchor }, { encoding: 'raw', range: 'always' });
}

export function safeProtobufPath(path: string): boolean {
  return (
    !path.startsWith('/') &&
    !path.includes('\\') &&
    path.split('/').every((part) => !['', '.', '..'].includes(part))
  );
}
