/**
 * TypeScript twin of GWPP_Location_Generator: rack face x bay x level ->
 * location code, bay-face centre and aisle access point. Lets the editor show
 * the codes and access points a layout will produce before it is saved.
 */

import { phpRound } from './layout';
import type { GeneratedLocation, Layout, LayoutElement, Side } from './types';

export function slotKey(elementId: string, face: Side, bay: number, level: number): string {
  return `${elementId}:${face}:${bay}:${level}`;
}

export function locationCode(label: string, face: Side | '', bay: number, level: number): string {
  return `${(label + face).toUpperCase()}-${String(bay).padStart(2, '0')}-${String.fromCharCode(65 + level - 1)}`;
}

export function generateRackLocations(rack: LayoutElement, gridCm: number): GeneratedLocation[] {
  if (rack.type !== 'rack' || !rack.rack) return [];

  const props = rack.rack;
  const offset = gridCm / 2;
  const multiFace = props.faces.length > 1;
  const out: GeneratedLocation[] = [];

  for (const face of props.faces) {
    const horizontal = face === 'n' || face === 's';
    const span = horizontal ? rack.w : rack.h;
    const baySize = span / props.bays;

    for (let bay = 1; bay <= props.bays; bay++) {
      const index = props.reverse_bays ? props.bays - bay : bay - 1;
      const along = (horizontal ? rack.x : rack.y) + (index + 0.5) * baySize;

      let faceXY: [number, number];
      let accessXY: [number, number];
      switch (face) {
        case 'n':
          faceXY = [along, rack.y];
          accessXY = [along, rack.y - offset];
          break;
        case 's':
          faceXY = [along, rack.y + rack.h];
          accessXY = [along, rack.y + rack.h + offset];
          break;
        case 'w':
          faceXY = [rack.x, along];
          accessXY = [rack.x - offset, along];
          break;
        default:
          faceXY = [rack.x + rack.w, along];
          accessXY = [rack.x + rack.w + offset, along];
      }

      for (let level = 1; level <= props.levels; level++) {
        out.push({
          slot_key: slotKey(rack.id, face, bay, level),
          element_id: rack.id,
          face,
          bay,
          level,
          code: locationCode(rack.label, multiFace ? face : '', bay, level),
          x: phpRound(faceXY[0]),
          y: phpRound(faceXY[1]),
          access_x: phpRound(accessXY[0]),
          access_y: phpRound(accessXY[1]),
        });
      }
    }
  }

  return out;
}

export function generateLocations(layout: Layout): GeneratedLocation[] {
  return layout.elements.flatMap((element) => generateRackLocations(element, layout.grid_cm));
}
