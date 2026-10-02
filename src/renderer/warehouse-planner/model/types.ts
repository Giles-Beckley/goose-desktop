/**
 * Layout data model, shared with the PHP engine (GWPP_Layout). Field names
 * stay snake_case because this is the wire format stored by the plugin.
 *
 * Units are integer centimetres on an axis-aligned plan whose origin is the
 * top-left corner (x grows right, y grows down, as in SVG).
 */

export type ElementType = 'rack' | 'wall' | 'obstacle' | 'zone' | 'pack_station' | 'start' | 'door';

/** Rack sides: north (top), east, south, west. */
export type Side = 'n' | 'e' | 's' | 'w';

export interface RackProps {
  bays: number;
  /** Levels are lettered A (floor) upwards, max 26. */
  levels: number;
  /** Sides that are pick faces, always in n, e, s, w order once normalised. */
  faces: Side[];
  /** Number bays from the high-coordinate end instead. */
  reverse_bays: boolean;
}

export interface LayoutElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  rack?: RackProps;
}

export interface Layout {
  schema?: number;
  width_cm: number;
  depth_cm: number;
  grid_cm: number;
  elements: LayoutElement[];
}

export interface Point {
  x: number;
  y: number;
}

export interface GeneratedLocation {
  slot_key: string;
  element_id: string;
  face: Side;
  bay: number;
  level: number;
  code: string;
  /** Centre of the bay on the rack face. */
  x: number;
  y: number;
  /** Where the picker stands, half a grid cell into the aisle. */
  access_x: number;
  access_y: number;
}

export interface ValidationIssue {
  code: 'no_start' | 'out_of_bounds' | 'duplicate_rack_label';
  element_id: string | null;
  message: string;
}
