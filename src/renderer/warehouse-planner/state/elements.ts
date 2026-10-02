/**
 * Creating, duplicating and rotating layout elements. Pure functions so the
 * reducer and tests can use them directly.
 */

import type { ElementType, Layout, LayoutElement, Point, Side } from '../model/types';

/** Default footprint (cm) for a newly placed element. */
export const DEFAULT_SIZE: Record<ElementType, { w: number; h: number }> = {
  rack: { w: 400, h: 100 },
  wall: { w: 500, h: 20 },
  obstacle: { w: 200, h: 200 },
  zone: { w: 400, h: 300 },
  pack_station: { w: 200, h: 100 },
  start: { w: 100, h: 100 },
  door: { w: 120, h: 20 },
};

export const TYPE_NAMES: Record<ElementType, string> = {
  rack: 'Rack',
  wall: 'Wall',
  obstacle: 'Obstacle',
  zone: 'Zone',
  pack_station: 'Pack station',
  start: 'Start point',
  door: 'Door',
};

/** Snap step (cm) for moving and resizing. */
export const SNAP_CM = 10;

export function snap(value: number, step = SNAP_CM): number {
  return Math.round(value / step) * step;
}

let counter = 0;

export function newId(type: ElementType): string {
  counter = (counter + 1) % 1296;
  return `${type}-${Date.now().toString(36)}${counter.toString(36).padStart(2, '0')}`;
}

/** A, B, ... Z, AA, AB, ... */
export function letterLabel(index: number): string {
  let label = '';
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

/** The first label not already used by an element of the same type. */
export function nextLabel(layout: Layout, type: ElementType): string {
  const used = new Set(layout.elements.filter((e) => e.type === type).map((e) => e.label.toUpperCase()));
  if (type === 'wall') return '';

  for (let i = 0; i < 10000; i++) {
    const label = type === 'rack' ? letterLabel(i) : type === 'start' && i === 0 ? 'Start' : `${TYPE_NAMES[type]} ${i + 1}`;
    if (!used.has(label.toUpperCase())) return label;
  }
  return '';
}

/** A new element of the given type centred on a point, snapped and kept on the floor. */
export function createElement(layout: Layout, type: ElementType, at: Point): LayoutElement {
  const size = DEFAULT_SIZE[type];
  const w = Math.min(size.w, layout.width_cm);
  const h = Math.min(size.h, layout.depth_cm);
  const x = clamp(snap(at.x - w / 2), 0, Math.max(0, layout.width_cm - w));
  const y = clamp(snap(at.y - h / 2), 0, Math.max(0, layout.depth_cm - h));

  const element: LayoutElement = { id: newId(type), type, x, y, w, h, label: nextLabel(layout, type) };
  if (type === 'rack') {
    element.rack = { bays: 4, levels: 4, faces: ['s'], reverse_bays: false };
  }
  return element;
}

export function duplicateElement(layout: Layout, source: LayoutElement): LayoutElement {
  const step = Math.max(layout.grid_cm, SNAP_CM * 5);
  return {
    ...source,
    rack: source.rack ? { ...source.rack, faces: [...source.rack.faces] } : undefined,
    id: newId(source.type),
    x: source.x + step,
    y: source.y + step,
    label: source.type === 'rack' || source.label ? nextLabel(layout, source.type) : '',
  };
}

const CLOCKWISE: Record<Side, Side> = { n: 'e', e: 's', s: 'w', w: 'n' };
const SIDE_ORDER: Side[] = ['n', 'e', 's', 'w'];

/**
 * Rotate 90 degrees clockwise about the element's centre. Pick faces turn
 * with the rack, so a south-facing rack becomes west-facing.
 */
export function rotateElement(element: LayoutElement): LayoutElement {
  const cx = element.x + element.w / 2;
  const cy = element.y + element.h / 2;
  const rotated: LayoutElement = {
    ...element,
    w: element.h,
    h: element.w,
    x: snap(cx - element.h / 2),
    y: snap(cy - element.w / 2),
  };
  if (element.rack) {
    const turned = new Set(element.rack.faces.map((face) => CLOCKWISE[face]));
    rotated.rack = { ...element.rack, faces: SIDE_ORDER.filter((side) => turned.has(side)) };
  }
  return rotated;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
