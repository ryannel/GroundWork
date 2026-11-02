import type { Anchor, CanonicalProtobufContracts } from './protobuf-contracts.generated';

export interface ProtobufSource {
  readonly path: string;
  readonly bytes: string;
}

export function protobufSourceUrl(
  document: Pick<CanonicalProtobufContracts, 'repo' | 'commit'>,
  anchor: Anchor,
): string {
  return `https://github.com/${document.repo}/blob/${document.commit}/${anchor.path}#L${String(anchor.lines[0])}-L${String(anchor.lines[1])}`;
}

export function safeProtobufPath(path: string): boolean {
  return (
    !path.startsWith('/') &&
    !path.includes('\\') &&
    path.split('/').every((part) => !['', '.', '..'].includes(part))
  );
}
