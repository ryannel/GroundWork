import 'server-only';

/** Disposable compiler syntax, separate from attributed semantic knowledge. */
export type SyntaxFields = Readonly<Record<string, readonly (readonly [number, number])[]>>;

export interface SyntaxNode {
  readonly modifiers?: readonly string[];
  readonly fields?: SyntaxFields;
  readonly literalValue?: string | number | boolean | null;
  readonly optionalAccess?: boolean;
  readonly operator?: string;
  readonly binding?: number;
  readonly symbol?: string;
  readonly kind: string;
  readonly text: string;
  readonly start: number;
  readonly end: number;
  readonly lines: readonly [number, number];
  readonly parent: number | null;
}

export interface SourceInput {
  readonly path: string;
  readonly content: string;
  readonly language: 'typescript' | 'javascript' | 'java' | 'go' | 'csharp' | 'python' | 'rust';
  readonly adapterDirectory?: string;
  readonly java?: string;
  readonly go?: string;
}

export interface SourceIndex {
  readonly path: string;
  readonly language: SourceInput['language'];
  readonly digest: string;
  readonly content: string;
  readonly parser: string;
  readonly attribution: 'parse_only' | 'local_symbols';
  readonly options: string;
  readonly nodes: readonly SyntaxNode[];
  readonly diagnostics: readonly string[];
}
