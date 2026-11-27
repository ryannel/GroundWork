import { Expand, Maximize2, Minimize2, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export interface ContentBounds {
  readonly minX: number;
  readonly minY: number;
  readonly width: number;
  readonly height: number;
}

interface Props {
  /** Logical SVG coordinate bounds of the content, used by auto-fit & Fit button. */
  bounds: ContentBounds;
  /** Changing this key triggers an automatic re-fit (e.g. layout changed or graph changed). */
  fitKey?: string | number;
  /** Minimum zoom scale (default 0.25) */
  minZoom?: number;
  /** Maximum zoom scale (default 2.6) */
  maxZoom?: number;
  /** Cap initial auto-fit zoom so small diagrams stay crisp (default 1.05) */
  maxFitZoom?: number;
  /** Show Full-Screen toggle button (default true) */
  allowFullscreen?: boolean;
  /** Optional header rendered at the top of the viewport when in Full-Screen mode */
  fullscreenHeader?: ReactNode;
  /** Optional right-side drawer (e.g. QuickPeekDrawer) rendered inside Full-Screen mode */
  fullscreenSide?: ReactNode;
  /** Extra toolbar pills rendered next to the Zoom/Fit/Full-Screen group */
  toolbarExtra?: ReactNode;
  /** Optional legend rendered at bottom-left */
  legend?: ReactNode;
  /** Optional inline hint at top-right */
  hint?: string;
  /** Inline style overrides for the non-fullscreen container */
  style?: React.CSSProperties;
  /** Optional className for container */
  className?: string;
  /** Content rendered inside the transformed `<g>` of the SVG, OR render prop receiving transform */
  children: ReactNode | ((transform: { x: number; y: number; zoom: number }) => ReactNode);
  /** Optional SVG `<defs>` placed in the root SVG */
  svgDefs?: ReactNode;
}

/**
 * Shared Interactive Viewport for System Map, Flow Walkthrough, and Database ER Diagram.
 * Optimized for:
 *  - MacBook Trackpad (2-finger pan, 2-finger pinch-to-zoom anchored at cursor)
 *  - Mouse (drag background to pan, Cmd/Ctrl+scroll zoom-to-cursor, double-click Fit)
 *  - Touch / iPad / Mobile (1-finger drag pan, 2-finger pinch-zoom around midpoint)
 *  - Full-Screen exploration mode (with Esc to exit)
 */
export function InteractiveViewport({
  bounds,
  fitKey,
  minZoom = 0.25,
  maxZoom = 2.6,
  maxFitZoom = 1.05,
  allowFullscreen = true,
  fullscreenHeader,
  fullscreenSide,
  toolbarExtra,
  legend,
  hint,
  style,
  className = "",
  children,
  svgDefs,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 32, y: 32 });
  const [isPanning, setIsPanning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Refs for gesture handlers so native non-passive wheel listeners always read fresh values
  const transformRef = useRef({ x: 32, y: 32, zoom: 1 });
  transformRef.current = { x: pan.x, y: pan.y, zoom };

  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartRef = useRef<{ dist: number; zoom: number; midX: number; midY: number; panX: number; panY: number } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const clampZoom = useCallback((z: number) => Math.max(minZoom, Math.min(maxZoom, z)), [minZoom, maxZoom]);

  const zoomAroundPoint = useCallback(
    (clientX: number, clientY: number, targetZoom: number) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const cur = transformRef.current;
      const nextZoom = clampZoom(targetZoom);
      const ratio = nextZoom / cur.zoom;
      const nextX = px - (px - cur.x) * ratio;
      const nextY = py - (py - cur.y) * ratio;
      setZoom(nextZoom);
      setPan({ x: nextX, y: nextY });
    },
    [clampZoom],
  );

  const fitToView = useCallback(() => {
    const el = containerRef.current;
    if (!el || bounds.width <= 0 || bounds.height <= 0) return;
    const rect = el.getBoundingClientRect();
    const viewW = rect.width || 960;
    const viewH = rect.height || 540;
    const padX = 40;
    const padTop = 64;
    const padBottom = legend ? 56 : 36;
    const availW = Math.max(160, viewW - padX * 2);
    const availH = Math.max(160, viewH - padTop - padBottom);
    const scale = Math.max(minZoom, Math.min(maxFitZoom, Math.min(availW / bounds.width, availH / bounds.height)));
    const nextZoom = +scale.toFixed(3);
    const nextX = Math.round((viewW - bounds.width * nextZoom) / 2 - bounds.minX * nextZoom);
    const nextY = Math.round(padTop + (availH - bounds.height * nextZoom) / 2 - bounds.minY * nextZoom);
    setZoom(nextZoom);
    setPan({ x: nextX, y: nextY });
  }, [bounds.minX, bounds.minY, bounds.width, bounds.height, legend, maxFitZoom, minZoom]);

  // Fit on bounds/fitKey or fullscreen change
  useEffect(() => {
    const raf = requestAnimationFrame(() => fitToView());
    return () => cancelAnimationFrame(raf);
  }, [fitToView, fitKey, isFullscreen]);

  // Esc exits fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen]);

  // Native non-passive wheel & Safari gesture listeners for rock-solid MacBook trackpad ergonomics!
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // macOS trackpad pinch sends wheel events with ctrlKey === true!
      // Cmd/Ctrl + mouse wheel also zooms around cursor.
      if (e.ctrlKey || e.metaKey) {
        const cur = transformRef.current;
        const factor = Math.exp(-e.deltaY * 0.0085);
        zoomAroundPoint(e.clientX, e.clientY, cur.zoom * factor);
      } else {
        // Two-finger trackpad scroll pans smoothly in 2D!
        setPan((prev) => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }));
      }
    };

    const preventGesture = (e: Event) => {
      e.preventDefault();
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("gesturestart", preventGesture, { passive: false });
    el.addEventListener("gesturechange", preventGesture, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", preventGesture);
      el.removeEventListener("gesturechange", preventGesture);
    };
  }, [zoomAroundPoint]);

  // Pointer events: unified Mouse drag + Touch 1-finger pan + Touch 2-finger pinch!
  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-no-pan], .node-card, .canvas-toolbar, .canvas-legend, button, a, input, select")) {
      return;
    }
    if (e.pointerType === "mouse" && e.button !== 0) return;

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 1) {
      setIsPanning(true);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX: transformRef.current.x,
        panY: transformRef.current.y,
      };
      pinchStartRef.current = null;
    } else if (pointersRef.current.size === 2) {
      const [p1, p2] = [...pointersRef.current.values()];
      if (p1 && p2) {
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
        pinchStartRef.current = {
          dist,
          zoom: transformRef.current.zoom,
          midX: (p1.x + p2.x) / 2,
          midY: (p1.y + p2.y) / 2,
          panX: transformRef.current.x,
          panY: transformRef.current.y,
        };
        dragStartRef.current = null;
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2 && pinchStartRef.current) {
      const [p1, p2] = [...pointersRef.current.values()];
      if (!p1 || !p2) return;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
      const start = pinchStartRef.current;
      const nextZoom = clampZoom(start.zoom * (dist / start.dist));
      const curMidX = (p1.x + p2.x) / 2 - rect.left;
      const curMidY = (p1.y + p2.y) / 2 - rect.top;
      const startMidX = start.midX - rect.left;
      const startMidY = start.midY - rect.top;
      const ratio = nextZoom / start.zoom;
      setZoom(nextZoom);
      setPan({
        x: curMidX - (startMidX - start.panX) * ratio,
        y: curMidY - (startMidY - start.panY) * ratio,
      });
    } else if (pointersRef.current.size === 1 && dragStartRef.current) {
      const start = dragStartRef.current;
      setPan({
        x: start.panX + (e.clientX - start.x),
        y: start.panY + (e.clientY - start.y),
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchStartRef.current = null;
    if (pointersRef.current.size === 0) {
      setIsPanning(false);
      dragStartRef.current = null;
    } else if (pointersRef.current.size === 1) {
      const [rem] = [...pointersRef.current.values()];
      if (rem) {
        dragStartRef.current = {
          x: rem.x,
          y: rem.y,
          panX: transformRef.current.x,
          panY: transformRef.current.y,
        };
      }
    }
  };

  const zoomByStep = (delta: number) => {
    const el = containerRef.current;
    if (!el) {
      setZoom((z) => clampZoom(+(z + delta).toFixed(2)));
      return;
    }
    const rect = el.getBoundingClientRect();
    zoomAroundPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, zoom + delta);
  };

  const viewportBody = (
    <div
      ref={containerRef}
      className={`canvas-shell ${isPanning ? "panning" : ""} ${className}`}
      style={{
        touchAction: "none",
        ...(!isFullscreen ? style : { flex: 1, borderRadius: 0, border: "none" }),
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-no-pan], .node-card, .canvas-toolbar, .canvas-legend, button")) return;
        fitToView();
      }}
    >
      <div className="canvas-toolbar">
        <div className="pill-group">
          <button className="icon-btn" onClick={() => zoomByStep(0.18)} title="Zoom in">
            <Plus size={14} />
          </button>
          <span className="mono" style={{ padding: "0 6px", color: "var(--text-muted)", minWidth: 44, textAlign: "center" }}>
            {Math.round(zoom * 100)}%
          </span>
          <button className="icon-btn" onClick={() => zoomByStep(-0.18)} title="Zoom out">
            <Minus size={14} />
          </button>
          <button className="icon-btn" onClick={fitToView} title="Fit diagram to screen (or double-click background)">
            <Maximize2 size={13} /> Fit
          </button>
        </div>

        {toolbarExtra}

        {allowFullscreen && (
          <div className="pill-group">
            <button
              className={`icon-btn ${isFullscreen ? "active" : ""}`}
              onClick={() => setIsFullscreen((v) => !v)}
              title={isFullscreen ? "Exit Full Screen (Esc)" : "Explore Full Screen"}
            >
              {isFullscreen ? <Minimize2 size={13} /> : <Expand size={13} />}
              {isFullscreen ? "Exit Full Screen" : "Full Screen"}
            </button>
          </div>
        )}
      </div>

      {hint && (
        <div
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            zIndex: 9,
            fontSize: 11,
            color: "var(--text-faint)",
            background: "var(--glass)",
            backdropFilter: "blur(6px)",
            padding: "4px 10px",
            borderRadius: 999,
            border: "1px solid var(--border)",
            pointerEvents: "none",
          }}
        >
          {hint}
        </div>
      )}

      <svg width="100%" height="100%" style={{ display: "block" }}>
        {svgDefs}
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {typeof children === "function" ? children({ x: pan.x, y: pan.y, zoom }) : children}
        </g>
      </svg>

      {legend && <div className="canvas-legend">{legend}</div>}
    </div>
  );

  if (isFullscreen) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 90,
          background: "var(--bg)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {fullscreenHeader && (
          <div style={{ flexShrink: 0, background: "var(--surface)", borderBottom: "1px solid var(--border)", padding: "10px 18px" }}>
            {fullscreenHeader}
          </div>
        )}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {viewportBody}
          {fullscreenSide}
        </div>
      </div>
    );
  }

  return viewportBody;
}
