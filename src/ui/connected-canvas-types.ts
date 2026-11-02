export interface ConnectedCanvasEdge {
  readonly id: string;
  readonly path: string;
  readonly label: string;
  readonly detail: string;
  readonly x: number;
  readonly y: number;
  readonly kind: 'api' | 'message' | 'data' | 'membership';
  /** False for recorded membership, which has no request or dependency direction. */
  readonly directed?: boolean;
  readonly pattern?: 'solid' | 'dashed' | 'dotted';
  readonly from?: string;
  readonly to?: string;
  readonly endpointId?: string | null;
  readonly usageFrom?: string;
  readonly usageTo?: string;
  readonly surfaceId?: string;
  /** The line lands on a named row, so its label only shows while the line is highlighted. */
  readonly quiet?: boolean;
  /** A call to a shared platform service (feature flags, sign-in): hidden unless asked for or focused. */
  readonly platform?: boolean;
  /** A contextual line outside the current system or flow: drawn faint until focused. */
  readonly context?: boolean;
  /** A supporting exchange: less prominent than the key flow, but still labelled. */
  readonly supporting?: boolean;
  /** Part of the chosen value flow, distinct from transient pointer or component focus. */
  readonly highlighted?: boolean;
  readonly relations?: readonly {
    readonly from: string;
    readonly to: string;
    readonly endpointId?: string | null;
    readonly usageFrom?: string;
    readonly usageTo?: string;
  }[];
}

export interface ConnectedCanvasFocus {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Reveal the complete boundary, zooming out only when needed. */
  readonly fit?: boolean;
  readonly readable?: boolean;
  readonly minimumZoom?: number;
  /** Fit this frame independently of the previous zoom, up to this reading scale. */
  readonly maximumZoom?: number;
  /** Bring the canvas into the page's visible area before fitting this frame. */
  readonly revealViewport?: boolean;
}
