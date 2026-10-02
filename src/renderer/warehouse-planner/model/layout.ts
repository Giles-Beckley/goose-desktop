/**
 * TypeScript twin of the PHP GWPP_Layout: normalisation, validation and the
 * start/end points. The editor uses it to show exactly what the server will
 * store, so any change here must be mirrored in class-gwpp-layout.php; the
 * parity test compares both against fixtures exported from PHP.
 */

import type { ElementType, Layout, LayoutElement, Point, RackProps, Side, ValidationIssue } from './types';

export const SCHEMA_VERSION = 1;
export const DEFAULT_GRID_CM = 50;
export const MIN_GRID_CM = 10;
export const MAX_LEVELS = 26;

export const BLOCKING_TYPES: readonly ElementType[] = ['rack', 'wall', 'obstacle'];
export const ELEMENT_TYPES: readonly ElementType[] = ['rack', 'wall', 'obstacle', 'zone', 'pack_station', 'start', 'door'];
export const SIDES: readonly Side[] = ['n', 'e', 's', 'w'];

/** PHP (int) cast for the values the editor and API can produce. */
export function toInt(value: unknown): number {
  if (typeof value === 'boolean') return value ? 1 : 0;
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

/** PHP round(): halves go away from zero (Math.round sends -0.5 to 0). */
export function phpRound(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeLayout(data: unknown): Layout {
  const raw = isRecord(data) ? data : {};
  const width = Math.max(1, toInt(raw.width_cm));
  const depth = Math.max(1, toInt(raw.depth_cm));
  const grid = Math.max(MIN_GRID_CM, toInt(raw.grid_cm ?? DEFAULT_GRID_CM));

  const input = Array.isArray(raw.elements) ? raw.elements : isRecord(raw.elements) ? Object.values(raw.elements) : [];
  const elements: LayoutElement[] = [];
  const seen = new Set<string>();

  input.forEach((element, index) => {
    if (!isRecord(element)) return;
    const type = String(element.type ?? '') as ElementType;
    if (!ELEMENT_TYPES.includes(type)) return;

    let id = String(element.id ?? '').trim();
    if (id === '' || seen.has(id)) id = `el-${index + 1}`;
    seen.add(id);

    const normalised: LayoutElement = {
      id,
      type,
      x: toInt(element.x ?? 0),
      y: toInt(element.y ?? 0),
      w: Math.max(1, toInt(element.w ?? 1)),
      h: Math.max(1, toInt(element.h ?? 1)),
      label: String(element.label ?? '').trim(),
    };

    if (type === 'rack') {
      const rack = isRecord(element.rack) ? element.rack : {};
      const wanted = (Array.isArray(rack.faces) ? rack.faces : rack.faces === undefined ? ['s'] : [rack.faces]).map(String);
      const faces = SIDES.filter((side) => wanted.includes(side));
      normalised.rack = {
        bays: Math.max(1, toInt(rack.bays ?? 1)),
        levels: Math.min(MAX_LEVELS, Math.max(1, toInt(rack.levels ?? 1))),
        faces: faces.length ? faces : ['s'],
        reverse_bays: Boolean(rack.reverse_bays) && rack.reverse_bays !== '0',
      };
      if (normalised.label === '') normalised.label = id.toUpperCase();
    }

    elements.push(normalised);
  });

  return { schema: SCHEMA_VERSION, width_cm: width, depth_cm: depth, grid_cm: grid, elements };
}

export function isBlocking(element: LayoutElement): boolean {
  return BLOCKING_TYPES.includes(element.type);
}

export function centre(element: LayoutElement): Point {
  return { x: phpRound(element.x + element.w / 2), y: phpRound(element.y + element.h / 2) };
}

function firstOfType(layout: Layout, type: ElementType): LayoutElement | undefined {
  return layout.elements.find((element) => element.type === type);
}

/** Where a pick run begins: the first start marker, else the first pack station. */
export function startPoint(layout: Layout): Point | null {
  const marker = firstOfType(layout, 'start') ?? firstOfType(layout, 'pack_station');
  return marker ? centre(marker) : null;
}

/** Where a pick run ends: the first pack station, else the start marker. */
export function endPoint(layout: Layout): Point | null {
  const marker = firstOfType(layout, 'pack_station') ?? firstOfType(layout, 'start');
  return marker ? centre(marker) : null;
}

export function validateLayout(layout: Layout): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (startPoint(layout) === null) {
    issues.push({
      code: 'no_start',
      element_id: null,
      message: 'Place a pack station or start point so pick routes have somewhere to begin.',
    });
  }

  const labels = new Set<string>();
  for (const element of layout.elements) {
    const outside =
      element.x < 0 ||
      element.y < 0 ||
      element.x + element.w > layout.width_cm ||
      element.y + element.h > layout.depth_cm;

    if (outside) {
      issues.push({
        code: 'out_of_bounds',
        element_id: element.id,
        message: `"${element.label || element.id}" extends beyond the warehouse walls.`,
      });
    }

    if (element.type === 'rack') {
      const key = element.label.toUpperCase();
      if (labels.has(key)) {
        issues.push({
          code: 'duplicate_rack_label',
          element_id: element.id,
          message: `Rack label "${element.label}" is used more than once, so location codes would clash.`,
        });
      }
      labels.add(key);
    }
  }

  return issues;
}

export function defaultRack(): RackProps {
  return { bays: 1, levels: 1, faces: ['s'], reverse_bays: false };
}
