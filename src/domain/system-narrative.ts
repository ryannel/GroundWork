/** A saved interpretation of a system, separate from its observed calls. */
export interface SystemNarrative {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  readonly confidence: 'low' | 'medium' | 'high';
  readonly reasoning: string;
  readonly limitations: readonly string[];
  readonly connections?: readonly {
    readonly from: string;
    readonly to: string;
    readonly kind: 'api' | 'message' | 'data';
    readonly label: string;
    readonly evidence: readonly string[];
  }[];
  readonly relatedSystems?: readonly string[];
  readonly stages: readonly {
    readonly component: string;
    readonly title: string;
    readonly summary: string;
    readonly supporting: readonly string[];
    readonly evidence: readonly string[];
  }[];
}

export interface SystemNarratives {
  readonly label: 'Inferred';
  readonly authored: string;
  readonly generator: string;
  readonly status: 'current' | 'stale';
  readonly stories: readonly SystemNarrative[];
}
