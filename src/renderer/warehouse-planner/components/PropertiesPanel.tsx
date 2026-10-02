/**
 * Side panel: the selected element's properties, or the warehouse's own
 * settings when nothing is selected. People think in metres, the layout is
 * stored in centimetres, so lengths are shown and typed in metres.
 */

import { useEffect, useState } from 'react';
import type { Dispatch, KeyboardEvent } from 'react';
import type { GeneratedLocation, Layout, LayoutElement, Side } from '../model/types';
import type { EditorAction } from '../state/editorReducer';
import { TYPE_NAMES } from '../state/elements';
import { MAX_LEVELS } from '../model/layout';

interface Props {
  layout: Layout;
  element: LayoutElement | undefined;
  locations: GeneratedLocation[];
  readOnly: boolean;
  dispatch: Dispatch<EditorAction>;
}

const SIDE_NAMES: Record<Side, string> = { n: 'Top', e: 'Right', s: 'Bottom', w: 'Left' };
const GRID_OPTIONS = [25, 50, 100];

export function PropertiesPanel({ layout, element, locations, readOnly, dispatch }: Props) {
  if (!element) {
    return <WarehouseProperties layout={layout} locations={locations} readOnly={readOnly} dispatch={dispatch} />;
  }

  const update = (patch: Partial<LayoutElement>) => dispatch({ type: 'update', id: element.id, patch });
  const rackLocations = locations.filter((location) => location.element_id === element.id);

  return (
    <section className="gwpp-panel" aria-label={`${TYPE_NAMES[element.type]} properties`}>
      <h3 className="gwpp-panel-title">{TYPE_NAMES[element.type]}</h3>

      {element.type !== 'wall' && (
        <TextField
          label={element.type === 'rack' ? 'Rack label' : 'Label'}
          value={element.label}
          readOnly={readOnly}
          hint={element.type === 'rack' ? 'Starts every location code, e.g. A-01-A.' : undefined}
          onCommit={(label) => update({ label: label.trim() })}
        />
      )}

      <div className="gwpp-field-grid">
        <MetreField label="From left" cm={element.x} readOnly={readOnly} onCommit={(x) => update({ x })} />
        <MetreField label="From top" cm={element.y} readOnly={readOnly} onCommit={(y) => update({ y })} />
        <MetreField label="Width" cm={element.w} min={10} readOnly={readOnly} onCommit={(w) => update({ w })} />
        <MetreField label="Depth" cm={element.h} min={10} readOnly={readOnly} onCommit={(h) => update({ h })} />
      </div>

      {element.type === 'rack' && element.rack && (
        <>
          <div className="gwpp-field-grid">
            <IntegerField
              label="Bays"
              value={element.rack.bays}
              min={1}
              max={200}
              readOnly={readOnly}
              onCommit={(bays) => update({ rack: { ...element.rack!, bays } })}
            />
            <IntegerField
              label="Levels"
              value={element.rack.levels}
              min={1}
              max={MAX_LEVELS}
              readOnly={readOnly}
              onCommit={(levels) => update({ rack: { ...element.rack!, levels } })}
            />
          </div>

          <fieldset className="gwpp-field gwpp-faces" disabled={readOnly}>
            <legend>Pick from</legend>
            {(['n', 'e', 's', 'w'] as Side[]).map((side) => (
              <label key={side} className="gwpp-check">
                <input
                  type="checkbox"
                  checked={element.rack!.faces.includes(side)}
                  onChange={(event) => {
                    const wanted = new Set(element.rack!.faces);
                    if (event.target.checked) wanted.add(side);
                    else wanted.delete(side);
                    if (wanted.size === 0) return; // A rack needs at least one pick face.
                    update({ rack: { ...element.rack!, faces: (['n', 'e', 's', 'w'] as Side[]).filter((s) => wanted.has(s)) } });
                  }}
                />
                {SIDE_NAMES[side]}
              </label>
            ))}
          </fieldset>

          <label className="gwpp-check gwpp-check-row">
            <input
              type="checkbox"
              disabled={readOnly}
              checked={element.rack.reverse_bays}
              onChange={(event) => update({ rack: { ...element.rack!, reverse_bays: event.target.checked } })}
            />
            Number bays from the other end
          </label>

          <div className="gwpp-field">
            <span className="gwpp-label">Locations</span>
            <p className="gwpp-summary">
              {rackLocations.length} ({element.rack.faces.length > 1 ? `${element.rack.faces.length} faces × ` : ''}
              {element.rack.bays} bays × {element.rack.levels} levels)
              {rackLocations.length > 0 && (
                <>
                  <br />
                  <code>{rackLocations[0].code}</code> … <code>{rackLocations[rackLocations.length - 1].code}</code>
                </>
              )}
            </p>
          </div>
        </>
      )}

      {!readOnly && (
        <div className="gwpp-button-row">
          <button type="button" className="gwpp-button" onClick={() => dispatch({ type: 'rotate', id: element.id })} title="Rotate 90° (R)">
            Rotate
          </button>
          <button type="button" className="gwpp-button" onClick={() => dispatch({ type: 'duplicate', id: element.id })} title="Duplicate (Ctrl+D)">
            Duplicate
          </button>
          <button type="button" className="gwpp-button is-danger" onClick={() => dispatch({ type: 'remove', id: element.id })} title="Delete (Del)">
            Delete
          </button>
        </div>
      )}
    </section>
  );
}

function WarehouseProperties({ layout, locations, readOnly, dispatch }: Omit<Props, 'element'>) {
  const counts = layout.elements.reduce<Record<string, number>>((acc, element) => {
    acc[element.type] = (acc[element.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <section className="gwpp-panel" aria-label="Warehouse properties">
      <h3 className="gwpp-panel-title">Warehouse</h3>
      <div className="gwpp-field-grid">
        <MetreField label="Width" cm={layout.width_cm} min={100} readOnly={readOnly} onCommit={(width_cm) => dispatch({ type: 'warehouse', patch: { width_cm } })} />
        <MetreField label="Depth" cm={layout.depth_cm} min={100} readOnly={readOnly} onCommit={(depth_cm) => dispatch({ type: 'warehouse', patch: { depth_cm } })} />
      </div>
      <label className="gwpp-field">
        <span className="gwpp-label">Walking grid</span>
        <select
          className="gwpp-input"
          value={layout.grid_cm}
          disabled={readOnly}
          onChange={(event) => dispatch({ type: 'warehouse', patch: { grid_cm: Number(event.target.value) } })}
        >
          {[...new Set([...GRID_OPTIONS, layout.grid_cm])].sort((a, b) => a - b).map((cm) => (
            <option key={cm} value={cm}>
              {cm} cm{cm === 50 ? ' (recommended)' : ''}
            </option>
          ))}
        </select>
        <span className="gwpp-hint">Routes are measured on this grid. Aisles narrower than one square may not be walkable.</span>
      </label>

      <div className="gwpp-field">
        <span className="gwpp-label">On the plan</span>
        <p className="gwpp-summary">
          {counts.rack ?? 0} racks · {locations.length} pick locations
          <br />
          {counts.pack_station ?? 0} pack stations · {(counts.wall ?? 0) + (counts.obstacle ?? 0)} walls and obstacles
        </p>
      </div>

      {!readOnly && (
        <p className="gwpp-hint">
          Add racks, walls and a pack station from the toolbar. Drag to move, drag the handles to resize, and select an item to edit it here.
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Fields: keep a local draft while typing, commit on blur or Enter.
// ---------------------------------------------------------------------------

function useDraft(value: string) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return [draft, setDraft] as const;
}

function onEnter(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === 'Enter') event.currentTarget.blur();
}

function TextField({ label, value, hint, readOnly, onCommit }: { label: string; value: string; hint?: string; readOnly: boolean; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useDraft(value);
  return (
    <label className="gwpp-field">
      <span className="gwpp-label">{label}</span>
      <input
        className="gwpp-input"
        value={draft}
        readOnly={readOnly}
        maxLength={20}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => draft !== value && onCommit(draft)}
        onKeyDown={onEnter}
      />
      {hint && <span className="gwpp-hint">{hint}</span>}
    </label>
  );
}

function MetreField({ label, cm, min = 0, readOnly, onCommit }: { label: string; cm: number; min?: number; readOnly: boolean; onCommit: (cm: number) => void }) {
  const [draft, setDraft] = useDraft(formatMetres(cm));
  const commit = () => {
    const metres = parseFloat(draft.replace(',', '.'));
    if (!Number.isFinite(metres)) {
      setDraft(formatMetres(cm));
      return;
    }
    const next = Math.max(min, Math.round(metres * 100));
    if (next !== cm) onCommit(next);
    else setDraft(formatMetres(cm));
  };
  return (
    <label className="gwpp-field">
      <span className="gwpp-label">{label}</span>
      <span className="gwpp-input-unit">
        <input className="gwpp-input" inputMode="decimal" value={draft} readOnly={readOnly} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={onEnter} />
        <span>m</span>
      </span>
    </label>
  );
}

function IntegerField({ label, value, min, max, readOnly, onCommit }: { label: string; value: number; min: number; max: number; readOnly: boolean; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useDraft(String(value));
  const commit = () => {
    const parsed = parseInt(draft, 10);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    const next = Math.min(max, Math.max(min, parsed));
    if (next !== value) onCommit(next);
    else setDraft(String(value));
  };
  return (
    <label className="gwpp-field">
      <span className="gwpp-label">{label}</span>
      <input className="gwpp-input" type="number" min={min} max={max} value={draft} readOnly={readOnly} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={onEnter} />
    </label>
  );
}

export function formatMetres(cm: number): string {
  return (cm / 100).toFixed(2).replace(/\.?0+$/, '') || '0';
}
