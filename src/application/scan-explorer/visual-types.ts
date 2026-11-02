import type { SemanticEdge, SemanticNode, Source } from '@/domain/scan/scan.generated';
import type { CurrentScanInput, CurrentRecord } from '@/domain/scan-explorer/current-contracts';
import type { ExplorerPage, ExplorerService, ExplorerSource } from '@/domain/service-explorer';

export interface VisualEntry {
  readonly kind: 'http' | 'consumer' | 'job' | 'plugin';
  readonly id: string;
  readonly label: string;
  readonly source: string;
  readonly sourceIds: readonly string[];
  readonly schemas: readonly string[];
}
export interface VisualContext {
  readonly snapshot: string;
  readonly input: VisualInput;
  readonly functions?: ReadonlyMap<string, SemanticNode>;
  readonly nodeOrder?: ReadonlyMap<string, number>;
  readonly sources?: ReadonlyMap<string, Source>;
  readonly fileFor?: (id: string) => string;
  readonly files: ReadonlyMap<string, string>;
  readonly recordsAt: ReadonlyMap<string, readonly CurrentRecord[]>;
  readonly nodes: ReadonlyMap<string, SemanticNode>;
  readonly edges: ReadonlyMap<string, readonly SemanticEdge[]>;
  readonly entries: readonly VisualEntry[];
  readonly externalSources?: readonly ExplorerSource[];
  readonly purpose: ExplorerService['purpose'];
}

/** Rendering accepts a captured source scope without claiming a runtime component binding. */
export interface VisualInput extends Omit<CurrentScanInput, 'binding'> {
  readonly binding: {
    readonly component:
      | CurrentScanInput['binding']['component']
      | { readonly id: string; readonly logicalId: string; readonly label: string };
    readonly repo: string;
    readonly commit: string;
    readonly declarations: readonly Source[];
    readonly modulePaths: readonly string[];
    readonly limitations: readonly string[];
    readonly verification?: 'pinned_runtime_declaration';
  };
}
export interface VisualArtifact {
  readonly file: string;
  readonly page: ExplorerPage;
}
