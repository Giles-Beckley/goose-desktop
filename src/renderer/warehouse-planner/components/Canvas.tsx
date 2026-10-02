/**
 * The floor plan: an SVG drawn in centimetres. The viewBox does the pan and
 * zoom, so element geometry is used exactly as stored; strokes and text are
 * sized in screen pixels (non-scaling strokes, font size / scale).
 *
 * Pointer gestures:
 *   element body -> select + move      handle -> resize
 *   empty floor  -> deselect + pan     wheel  -> zoom about the cursor
 * Moves and resizes snap to SNAP_CM; hold Alt for 1 cm steps.
 */

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from 'react';
import type { Dispatch, PointerEvent as ReactPointerEvent } from 'react';
import type { GeneratedLocation, Layout, LayoutElement, Point } from '../model/types';
import type { EditorAction } from '../state/editorReducer';
import { SNAP_CM, snap } from '../state/elements';

export interface CanvasHandle {
  /** Centre of what is on screen, in cm (where new elements are placed). */
  viewCentre(): Point;
  fit(): void;
}

interface Props {
  layout: Layout;
  selectedId: string | null;
  locations: GeneratedLocation[];
  /** slot_keys of saved locations that have products assigned. */
  assignedSlots: Set<string>;
  showLocations: boolean;
  readOnly: boolean;
  dispatch: Dispatch<EditorAction>;
}

interface View {
  x: number;
  y: number;
  scale: number; // screen px per cm
}

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const MIN_SIZE_CM = 10;
const MIN_SCALE = 0.02;
const MAX_SCALE = 6;

type Drag =
  | { mode: 'move'; id: string; start: Point; orig: LayoutElement; moved: boolean }
  | { mode: 'resize'; id: string; handle: Handle; start: Point; orig: LayoutElement }
  | { mode: 'pan'; startClient: Point; origView: View };

export const Canvas = forwardRef<CanvasHandle, Props>(function Canvas(
  { layout, selectedId, locations, assignedSlots, showLocations, readOnly, dispatch },
  ref,
) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600, measured: false });
  const [view, setView] = useState<View>({ x: -100, y: -100, scale: 0.5 });
  const drag = useRef<Drag | null>(null);
  const fitted = useRef(false);

  // Track the container size.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const update = () => {
      const rect = svg.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) setSize({ w: rect.width, h: rect.height, measured: true });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  const fit = useCallback(() => {
    const margin = 60; // px
    const scale = Math.max(
      MIN_SCALE,
      Math.min(MAX_SCALE, (size.w - margin * 2) / layout.width_cm, (size.h - margin * 2) / layout.depth_cm),
    );
    setView({
      scale,
      x: layout.width_cm / 2 - size.w / 2 / scale,
      y: layout.depth_cm / 2 - size.h / 2 / scale,
    });
  }, [layout.width_cm, layout.depth_cm, size.w, size.h]);

  // Fit once the real container size is known.
  useEffect(() => {
    if (!fitted.current && size.measured) {
      fitted.current = true;
      fit();
    }
  }, [fit, size.measured]);

  useImperativeHandle(ref, () => ({
    viewCentre: () => ({ x: view.x + size.w / 2 / view.scale, y: view.y + size.h / 2 / view.scale }),
    fit,
  }), [view, size, fit]);

  const toCm = useCallback(
    (clientX: number, clientY: number): Point => {
      const rect = svgRef.current!.getBoundingClientRect();
      return { x: view.x + (clientX - rect.left) / view.scale, y: view.y + (clientY - rect.top) / view.scale };
    },
    [view],
  );

  // Wheel zoom needs a non-passive listener to stop the page scrolling.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      setView((current) => {
        const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.scale * Math.exp(-event.deltaY * 0.0015)));
        const cmX = current.x + px / current.scale;
        const cmY = current.y + py / current.scale;
        return { scale, x: cmX - px / scale, y: cmY - py / scale };
      });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  const elementsById = useMemo(() => new Map(layout.elements.map((e) => [e.id, e])), [layout.elements]);

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 && event.button !== 1) return;
    const target = event.target as Element;
    const handle = target.closest('[data-handle]')?.getAttribute('data-handle') as Handle | null;
    const id = target.closest('[data-id]')?.getAttribute('data-id') ?? null;
    const start = toCm(event.clientX, event.clientY);

    svgRef.current?.setPointerCapture(event.pointerId);

    if (event.button === 0 && handle && selectedId && !readOnly) {
      const orig = elementsById.get(selectedId);
      if (orig) {
        dispatch({ type: 'gesture/start' });
        drag.current = { mode: 'resize', id: selectedId, handle, start, orig };
        return;
      }
    }

    if (event.button === 0 && id) {
      dispatch({ type: 'select', id });
      const orig = elementsById.get(id);
      if (orig && !readOnly) {
        dispatch({ type: 'gesture/start' });
        drag.current = { mode: 'move', id, start, orig, moved: false };
      }
      return;
    }

    if (event.button === 0) dispatch({ type: 'select', id: null });
    drag.current = { mode: 'pan', startClient: { x: event.clientX, y: event.clientY }, origView: view };
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const current = drag.current;
    if (!current) return;
    const step = event.altKey ? 1 : SNAP_CM;

    if (current.mode === 'pan') {
      const dx = (event.clientX - current.startClient.x) / current.origView.scale;
      const dy = (event.clientY - current.startClient.y) / current.origView.scale;
      setView({ ...current.origView, x: current.origView.x - dx, y: current.origView.y - dy });
      return;
    }

    const point = toCm(event.clientX, event.clientY);
    const dx = point.x - current.start.x;
    const dy = point.y - current.start.y;

    if (current.mode === 'move') {
      const x = snap(current.orig.x + dx, step);
      const y = snap(current.orig.y + dy, step);
      if (x !== current.orig.x || y !== current.orig.y || current.moved) {
        current.moved = true;
        dispatch({ type: 'update', id: current.id, patch: { x, y }, transient: true });
      }
      return;
    }

    const o = current.orig;
    let left = o.x;
    let top = o.y;
    let right = o.x + o.w;
    let bottom = o.y + o.h;
    if (current.handle.includes('w')) left = Math.min(snap(o.x + dx, step), right - MIN_SIZE_CM);
    if (current.handle.includes('e')) right = Math.max(snap(o.x + o.w + dx, step), left + MIN_SIZE_CM);
    if (current.handle.includes('n')) top = Math.min(snap(o.y + dy, step), bottom - MIN_SIZE_CM);
    if (current.handle.includes('s')) bottom = Math.max(snap(o.y + o.h + dy, step), top + MIN_SIZE_CM);
    dispatch({
      type: 'update',
      id: current.id,
      patch: { x: left, y: top, w: right - left, h: bottom - top },
      transient: true,
    });
  };

  const endDrag = () => {
    const current = drag.current;
    drag.current = null;
    if (current && current.mode !== 'pan') dispatch({ type: 'gesture/end' });
  };

  const px = (pixels: number) => pixels / view.scale; // screen px -> cm
  const viewBox = `${view.x} ${view.y} ${size.w / view.scale} ${size.h / view.scale}`;
  const selected = selectedId ? elementsById.get(selectedId) : undefined;

  // One marker per bay face (levels share the bay's access point).
  const bayMarkers = useMemo(() => {
    const seen = new Map<string, { location: GeneratedLocation; assigned: boolean }>();
    for (const location of locations) {
      const key = `${location.element_id}:${location.face}:${location.bay}`;
      const assigned = assignedSlots.has(location.slot_key);
      const existing = seen.get(key);
      if (!existing) seen.set(key, { location, assigned });
      else if (assigned) existing.assigned = true;
    }
    return [...seen.values()];
  }, [locations, assignedSlots]);

  const gridVisible = layout.grid_cm * view.scale >= 6;
  const showBayCodes = showLocations && view.scale >= 0.6;

  return (
    <svg
      ref={svgRef}
      className={readOnly ? 'gwpp-canvas is-readonly' : 'gwpp-canvas'}
      viewBox={viewBox}
      preserveAspectRatio="xMinYMin meet"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      role="application"
      aria-label="Warehouse floor plan"
    >
      <defs>
        <pattern id="gwpp-grid" width={layout.grid_cm} height={layout.grid_cm} patternUnits="userSpaceOnUse">
          <path d={`M ${layout.grid_cm} 0 L 0 0 0 ${layout.grid_cm}`} className="gwpp-grid-line" vectorEffect="non-scaling-stroke" />
        </pattern>
        <pattern id="gwpp-hatch" width={40} height={40} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="40" className="gwpp-hatch-line" vectorEffect="non-scaling-stroke" />
        </pattern>
      </defs>

      <rect className="gwpp-floor" x={0} y={0} width={layout.width_cm} height={layout.depth_cm} vectorEffect="non-scaling-stroke" />
      {gridVisible && <rect x={0} y={0} width={layout.width_cm} height={layout.depth_cm} fill="url(#gwpp-grid)" pointerEvents="none" />}

      {/* Zones first so everything else sits on top of them. */}
      {[...layout.elements]
        .sort((a, b) => Number(b.type === 'zone') - Number(a.type === 'zone'))
        .map((element) => (
          <ElementShape key={element.id} element={element} selected={element.id === selectedId} fontSize={px(12)} />
        ))}

      {showLocations &&
        bayMarkers.map(({ location, assigned }) => (
          <g key={`${location.element_id}:${location.face}:${location.bay}`} className="gwpp-bay-marker" pointerEvents="none">
            <circle
              cx={location.access_x}
              cy={location.access_y}
              r={px(4)}
              className={assigned ? 'gwpp-access is-assigned' : 'gwpp-access'}
              vectorEffect="non-scaling-stroke"
            />
            {showBayCodes && (
              <text x={location.access_x} y={location.access_y + px(14)} fontSize={px(10)} className="gwpp-bay-code" textAnchor="middle">
                {location.code.replace(/-[A-Z]$/, '')}
              </text>
            )}
          </g>
        ))}

      {selected && !readOnly &&
        HANDLES.map((handle) => {
          const hx = handle.includes('w') ? selected.x : handle.includes('e') ? selected.x + selected.w : selected.x + selected.w / 2;
          const hy = handle.includes('n') ? selected.y : handle.includes('s') ? selected.y + selected.h : selected.y + selected.h / 2;
          const s = px(9);
          return (
            <rect
              key={handle}
              data-handle={handle}
              className={`gwpp-handle gwpp-handle-${handle}`}
              x={hx - s / 2}
              y={hy - s / 2}
              width={s}
              height={s}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
    </svg>
  );
});

function ElementShape({ element, selected, fontSize }: { element: LayoutElement; selected: boolean; fontSize: number }) {
  const { x, y, w, h } = element;
  const label = element.type === 'start' && !element.label ? 'Start' : element.label;
  const className = `gwpp-el gwpp-el-${element.type}${selected ? ' is-selected' : ''}`;
  // Readable but never wider or taller than the element: shrink to fit, and
  // drop the label when it would be too small to read (it's in the panel).
  const preferred = Math.min(fontSize * 1.4, Math.max(fontSize * 0.8, Math.min(w, h) * 0.45));
  const fitsWidth = (w * 0.9) / (Math.max(1, label.length) * 0.6);
  const textSize = Math.min(preferred, fitsWidth, h * 0.8);
  const showLabel = label !== '' && textSize >= fontSize * 0.6;

  return (
    <g data-id={element.id} className={className}>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        className="gwpp-el-body"
        fill={element.type === 'obstacle' ? 'url(#gwpp-hatch)' : undefined}
        vectorEffect="non-scaling-stroke"
      />
      {element.type === 'rack' && element.rack && <RackDetail element={element} />}
      {showLabel && (
        <text x={x + w / 2} y={y + h / 2} fontSize={textSize} className="gwpp-el-label" textAnchor="middle" dominantBaseline="central">
          {label}
        </text>
      )}
    </g>
  );
}

/** Bay dividers and a bold line on each pick face. */
function RackDetail({ element }: { element: LayoutElement }) {
  const rack = element.rack!;
  const { x, y, w, h } = element;
  const horizontal = rack.faces.some((face) => face === 'n' || face === 's') || !rack.faces.some((face) => face === 'e' || face === 'w');
  const dividers = [];
  for (let i = 1; i < rack.bays; i++) {
    if (horizontal) {
      const dx = x + (w * i) / rack.bays;
      dividers.push(<line key={i} x1={dx} y1={y} x2={dx} y2={y + h} className="gwpp-bay-divider" vectorEffect="non-scaling-stroke" />);
    } else {
      const dy = y + (h * i) / rack.bays;
      dividers.push(<line key={i} x1={x} y1={dy} x2={x + w} y2={dy} className="gwpp-bay-divider" vectorEffect="non-scaling-stroke" />);
    }
  }
  const faces = rack.faces.map((face) => {
    const [x1, y1, x2, y2] =
      face === 'n' ? [x, y, x + w, y] : face === 's' ? [x, y + h, x + w, y + h] : face === 'w' ? [x, y, x, y + h] : [x + w, y, x + w, y + h];
    return <line key={face} x1={x1} y1={y1} x2={x2} y2={y2} className="gwpp-pick-face" vectorEffect="non-scaling-stroke" />;
  });
  return (
    <g pointerEvents="none">
      {dividers}
      {faces}
    </g>
  );
}
