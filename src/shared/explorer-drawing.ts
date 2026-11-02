export interface ExplorerDrawingNode {
  readonly id: string;
  readonly lines: readonly string[];
  readonly note: string;
  readonly detail?: string;
  readonly shape: 'box' | 'diamond' | 'store' | 'ellipse' | 'row' | 'header';
  readonly tone: 'normal' | 'accent' | 'warning';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
export interface ExplorerDrawing {
  readonly width: number;
  readonly height: number;
  readonly groups?: readonly {
    readonly id: string;
    readonly label: string;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  }[];
  readonly nodes: readonly ExplorerDrawingNode[];
  readonly edges: readonly {
    readonly id: string;
    readonly path: string;
    readonly label: string;
    readonly detail?: string;
    readonly x: number;
    readonly y: number;
    readonly dashed: boolean;
    readonly contained?: boolean;
  }[];
}
