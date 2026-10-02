/**
 * Edits one warehouse's floor plan: loads it, keeps a live preview of the
 * locations it will generate, and saves it with an edit-conflict check.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { PlannerError } from '../api';
import type { PlannerApi, SaveLayoutResult, StoredLocation, WarehouseDetail } from '../api';
import { normalizeLayout, validateLayout } from '../model/layout';
import { generateLocations } from '../model/locations';
import type { ElementType, Layout } from '../model/types';
import { editorReducer, initialState } from '../state/editorReducer';
import { SNAP_CM, TYPE_NAMES } from '../state/elements';
import { Canvas } from './Canvas';
import type { CanvasHandle } from './Canvas';
import { PropertiesPanel } from './PropertiesPanel';

interface Props {
  api: PlannerApi;
  warehouseId: number;
  canManage: boolean;
  onBack: () => void;
}

type SaveState = 'idle' | 'saving' | 'conflict';

const ADDABLE: ElementType[] = ['rack', 'wall', 'obstacle', 'zone', 'door', 'pack_station', 'start'];

export function LayoutEditor({ api, warehouseId, canManage, onBack }: Props) {
  const [state, dispatch] = useReducer(editorReducer, initialState(normalizeLayout({ width_cm: 2000, depth_cm: 1500 })));
  const [warehouse, setWarehouse] = useState<WarehouseDetail['warehouse'] | null>(null);
  const [savedLayout, setSavedLayout] = useState<Layout | null>(null);
  const [stored, setStored] = useState<StoredLocation[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [showLocations, setShowLocations] = useState(true);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const canvas = useRef<CanvasHandle>(null);
  const root = useRef<HTMLDivElement>(null);

  const readOnly = !canManage;
  const { layout, selectedId } = state;

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const detail = await api<WarehouseDetail>('get_warehouse', { warehouse_id: warehouseId });
      const normalised = normalizeLayout(detail.layout);
      dispatch({ type: 'load', layout: normalised });
      setSavedLayout(normalised);
      setWarehouse(detail.warehouse);
      setStored(detail.locations);
      setSaveState('idle');
      return detail;
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load this warehouse.');
      return null;
    }
  }, [api, warehouseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(() => savedLayout !== null && JSON.stringify(layout) !== JSON.stringify(savedLayout), [layout, savedLayout]);
  const locations = useMemo(() => generateLocations(layout), [layout]);
  const issues = useMemo(() => validateLayout(layout), [layout]);

  const assignedSlots = useMemo(
    () => new Set(stored.filter((location) => location.assignment_count > 0).map((location) => location.slot_key)),
    [stored],
  );

  // Saved locations with products that this edit would take off the plan.
  const wouldRetire = useMemo(() => {
    const live = new Set(locations.map((location) => location.slot_key));
    return stored.filter((location) => location.active && location.assignment_count > 0 && !live.has(location.slot_key));
  }, [locations, stored]);

  // Already off the plan but still holding product assignments.
  const retired = useMemo(() => stored.filter((location) => !location.active && location.assignment_count > 0), [stored]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = useCallback(
    async (revision?: number) => {
      if (!warehouse || readOnly) return;
      setSaveState('saving');
      setMessage(null);
      try {
        const result = await api<SaveLayoutResult>('save_warehouse_layout', {
          warehouse_id: warehouse.id,
          layout,
          revision: revision ?? warehouse.layout_revision,
        });
        const normalised = normalizeLayout(result.layout);
        dispatch({ type: 'saved', layout: normalised });
        setSavedLayout(normalised);
        setWarehouse(result.warehouse);
        setStored(result.locations);
        setSaveState('idle');
        setMessage({ kind: 'ok', text: describeSync(result.sync) });
      } catch (error) {
        if (error instanceof PlannerError && error.code === 'layout_conflict') {
          setSaveState('conflict');
          return;
        }
        setSaveState('idle');
        setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Saving failed.' });
      }
    },
    [api, layout, readOnly, warehouse],
  );

  /** Save over a newer version: fetch its revision, then save ours on top. */
  const overwrite = async () => {
    try {
      const latest = await api<WarehouseDetail>('get_warehouse', { warehouse_id: warehouseId });
      await save(latest.warehouse.layout_revision);
    } catch (error) {
      setSaveState('idle');
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Saving failed.' });
    }
  };

  const add = (type: ElementType) => {
    const at = canvas.current?.viewCentre() ?? { x: layout.width_cm / 2, y: layout.depth_cm / 2 };
    dispatch({ type: 'add', elementType: type, at });
    root.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('input, select, textarea, button')) return;
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();

    if (mod && key === 's') {
      event.preventDefault();
      if (dirty && saveState === 'idle') void save();
      return;
    }
    if (readOnly) return;
    if (mod && key === 'z') {
      event.preventDefault();
      dispatch({ type: event.shiftKey ? 'redo' : 'undo' });
      return;
    }
    if (mod && key === 'y') {
      event.preventDefault();
      dispatch({ type: 'redo' });
      return;
    }
    if (!selectedId) return;
    const element = layout.elements.find((e) => e.id === selectedId);
    if (!element) return;

    if (key === 'delete' || key === 'backspace') {
      event.preventDefault();
      dispatch({ type: 'remove', id: selectedId });
    } else if (mod && key === 'd') {
      event.preventDefault();
      dispatch({ type: 'duplicate', id: selectedId });
    } else if (key === 'r' && !mod) {
      dispatch({ type: 'rotate', id: selectedId });
    } else if (key === 'escape') {
      dispatch({ type: 'select', id: null });
    } else if (key.startsWith('arrow')) {
      event.preventDefault();
      const step = event.shiftKey ? 100 : SNAP_CM;
      const dx = key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0;
      const dy = key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0;
      dispatch({ type: 'update', id: selectedId, patch: { x: element.x + dx, y: element.y + dy } });
    }
  };

  if (loadError) {
    return (
      <div className="gwpp-message is-error" role="alert">
        <p>{loadError}</p>
        <div className="gwpp-button-row">
          <button type="button" className="gwpp-button" onClick={() => void load()}>Try again</button>
          <button type="button" className="gwpp-button" onClick={onBack}>Back to warehouses</button>
        </div>
      </div>
    );
  }

  if (!warehouse) {
    return <p className="gwpp-loading">Loading floor plan…</p>;
  }

  const selected = layout.elements.find((element) => element.id === selectedId);

  return (
    <div className="gwpp-editor" ref={root} tabIndex={-1} onKeyDown={onKeyDown}>
      <header className="gwpp-toolbar">
        <button type="button" className="gwpp-button is-ghost" onClick={() => (dirty ? setConfirmLeave(true) : onBack())}>
          ← Warehouses
        </button>
        <h2 className="gwpp-title">{warehouse.name}</h2>

        {!readOnly && (
          <div className="gwpp-tool-group" role="group" aria-label="Add to plan">
            {ADDABLE.map((type) => (
              <button key={type} type="button" className={`gwpp-tool gwpp-tool-${type}`} onClick={() => add(type)} title={`Add ${TYPE_NAMES[type].toLowerCase()}`}>
                <span className="gwpp-swatch" aria-hidden="true" />
                {TYPE_NAMES[type]}
              </button>
            ))}
          </div>
        )}

        <div className="gwpp-tool-group">
          {!readOnly && (
            <>
              <button type="button" className="gwpp-button is-icon" onClick={() => dispatch({ type: 'undo' })} disabled={!state.past.length} title="Undo (Ctrl+Z)" aria-label="Undo">↶</button>
              <button type="button" className="gwpp-button is-icon" onClick={() => dispatch({ type: 'redo' })} disabled={!state.future.length} title="Redo (Ctrl+Y)" aria-label="Redo">↷</button>
            </>
          )}
          <button type="button" className="gwpp-button" onClick={() => canvas.current?.fit()} title="Fit the whole warehouse on screen">Fit</button>
          <label className="gwpp-check">
            <input type="checkbox" checked={showLocations} onChange={(event) => setShowLocations(event.target.checked)} />
            Locations
          </label>
        </div>

        <div className="gwpp-save">
          <span className={`gwpp-status${dirty ? ' is-dirty' : ''}`}>
            {saveState === 'saving' ? 'Saving…' : dirty ? 'Unsaved changes' : readOnly ? 'View only' : 'All changes saved'}
          </span>
          {!readOnly && (
            <button type="button" className="gwpp-button is-primary" onClick={() => void save()} disabled={!dirty || saveState !== 'idle'} title="Save (Ctrl+S)">
              Save
            </button>
          )}
        </div>
      </header>

      {confirmLeave && (
        <div className="gwpp-message is-warning" role="alertdialog" aria-label="Unsaved changes">
          <p>You have unsaved changes to this floor plan. Leave without saving?</p>
          <div className="gwpp-button-row">
            <button type="button" className="gwpp-button is-danger" onClick={onBack}>Discard changes</button>
            <button type="button" className="gwpp-button" onClick={() => setConfirmLeave(false)}>Keep editing</button>
          </div>
        </div>
      )}

      {saveState === 'conflict' && (
        <div className="gwpp-message is-warning" role="alert">
          <p>Someone else saved this floor plan since you opened it (possibly from the desktop app). Your changes have not been saved.</p>
          <div className="gwpp-button-row">
            <button type="button" className="gwpp-button" onClick={() => void load()}>Load their version (discard mine)</button>
            <button type="button" className="gwpp-button is-danger" onClick={() => void overwrite()}>Save mine over theirs</button>
          </div>
        </div>
      )}

      {message && (
        <div className={`gwpp-message ${message.kind === 'ok' ? 'is-success' : 'is-error'}`} role="status">
          <p>{message.text}</p>
          <button type="button" className="gwpp-dismiss" onClick={() => setMessage(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      <div className="gwpp-workspace">
        <div className="gwpp-canvas-wrap">
          <Canvas
            ref={canvas}
            layout={layout}
            selectedId={selectedId}
            locations={locations}
            assignedSlots={assignedSlots}
            showLocations={showLocations}
            readOnly={readOnly}
            dispatch={dispatch}
          />
          {!readOnly && <p className="gwpp-canvas-hint">Scroll to zoom · drag empty floor to pan · hold Alt for 1 cm steps</p>}
        </div>

        <aside className="gwpp-sidebar">
          <PropertiesPanel layout={layout} element={selected} locations={locations} readOnly={readOnly} dispatch={dispatch} />

          {(issues.length > 0 || wouldRetire.length > 0 || retired.length > 0) && (
            <section className="gwpp-panel" aria-label="Problems">
              <h3 className="gwpp-panel-title">Check before picking</h3>
              <ul className="gwpp-issues">
                {issues.map((issue, index) => (
                  <li key={`${issue.code}-${issue.element_id ?? index}`}>
                    {issue.element_id ? (
                      <button type="button" className="gwpp-link" onClick={() => dispatch({ type: 'select', id: issue.element_id })}>
                        {issue.message}
                      </button>
                    ) : (
                      issue.message
                    )}
                  </li>
                ))}
                {wouldRetire.length > 0 && (
                  <li className="is-warning">
                    Saving will take {wouldRetire.length} location{wouldRetire.length === 1 ? '' : 's'} with products off the plan ({summariseCodes(wouldRetire)}).
                    Their product assignments are kept and come back if you restore the bays.
                  </li>
                )}
                {retired.length > 0 && (
                  <li>
                    {retired.length} location{retired.length === 1 ? ' is' : 's are'} no longer on the plan but still {retired.length === 1 ? 'has' : 'have'} products assigned ({summariseCodes(retired)}).
                  </li>
                )}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function describeSync(sync: SaveLayoutResult['sync']): string {
  const parts: string[] = [];
  if (sync.created) parts.push(`${sync.created} new location${sync.created === 1 ? '' : 's'}`);
  if (sync.updated) parts.push(`${sync.updated} updated`);
  if (sync.deleted) parts.push(`${sync.deleted} removed`);
  if (sync.deactivated) parts.push(`${sync.deactivated} taken off the plan (products kept)`);
  return parts.length ? `Floor plan saved: ${parts.join(', ')}.` : 'Floor plan saved.';
}

function summariseCodes(locations: StoredLocation[]): string {
  const codes = locations.map((location) => location.code).sort();
  return codes.length > 4 ? `${codes.slice(0, 4).join(', ')} and ${codes.length - 4} more` : codes.join(', ');
}
