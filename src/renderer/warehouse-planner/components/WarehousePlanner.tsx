/**
 * Top-level component both hosts mount: the warehouse list, creating a
 * warehouse, and opening one in the floor-plan editor.
 */

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { PlannerError } from '../api';
import type { PlannerApi, WarehouseDetail, WarehouseSummary } from '../api';
import { LayoutEditor } from './LayoutEditor';

export interface WarehousePlannerProps {
  api: PlannerApi;
  /** May create warehouses and edit floor plans (otherwise view only). */
  canManage: boolean;
  /** Open this warehouse straight away. */
  initialWarehouseId?: number;
}

export function WarehousePlanner({ api, canManage, initialWarehouseId }: WarehousePlannerProps) {
  const [openId, setOpenId] = useState<number | null>(initialWarehouseId ?? null);

  return (
    <div className="gwpp-planner">
      {openId === null ? (
        <WarehouseList api={api} canManage={canManage} onOpen={setOpenId} />
      ) : (
        <LayoutEditor key={openId} api={api} warehouseId={openId} canManage={canManage} onBack={() => setOpenId(null)} />
      )}
    </div>
  );
}

function WarehouseList({ api, canManage, onOpen }: { api: PlannerApi; canManage: boolean; onOpen: (id: number) => void }) {
  const [warehouses, setWarehouses] = useState<WarehouseSummary[] | null>(null);
  const [error, setError] = useState<PlannerError | Error | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await api<{ warehouses: WarehouseSummary[] }>('list_warehouses');
      setWarehouses(result.warehouses);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Could not load warehouses.'));
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    const inactive = error instanceof PlannerError && error.code === 'license_inactive';
    return (
      <div className={`gwpp-message ${inactive ? 'is-warning' : 'is-error'}`} role="alert">
        <p>{inactive ? 'Warehouse Picking Planner is a premium component and is not activated on this store.' : error.message}</p>
        {!inactive && (
          <button type="button" className="gwpp-button" onClick={() => void load()}>
            Try again
          </button>
        )}
      </div>
    );
  }

  if (!warehouses) return <p className="gwpp-loading">Loading warehouses…</p>;

  return (
    <div className="gwpp-list">
      <div className="gwpp-list-header">
        <h2 className="gwpp-title">Warehouses</h2>
        {canManage && !creating && (
          <button type="button" className="gwpp-button is-primary" onClick={() => setCreating(true)}>
            New warehouse
          </button>
        )}
      </div>

      {creating && <CreateWarehouse api={api} onCancel={() => setCreating(false)} onCreated={onOpen} />}

      {warehouses.length === 0 && !creating ? (
        <div className="gwpp-empty">
          <p>No warehouses yet.</p>
          <p className="gwpp-hint">
            {canManage
              ? 'Create one, then draw its racks, walls and pack station. Pick locations are generated from the plan.'
              : 'Ask someone who manages inventory to set one up.'}
          </p>
        </div>
      ) : (
        <ul className="gwpp-cards">
          {warehouses.map((warehouse) => (
            <li key={warehouse.id}>
              <button type="button" className="gwpp-card" onClick={() => onOpen(warehouse.id)}>
                <span className="gwpp-card-title">{warehouse.name}</span>
                {warehouse.status === 'archived' && <span className="gwpp-badge">Archived</span>}
                <span className="gwpp-card-meta">
                  {warehouse.location_count} locations · {warehouse.assignment_count} product assignments
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CreateWarehouse({ api, onCancel, onCreated }: { api: PlannerApi; onCancel: () => void; onCreated: (id: number) => void }) {
  const [name, setName] = useState('');
  const [width, setWidth] = useState('20');
  const [depth, setDepth] = useState('15');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const w = parseFloat(width.replace(',', '.'));
    const d = parseFloat(depth.replace(',', '.'));
    if (!name.trim()) return setError('Give the warehouse a name.');
    if (!(w >= 1 && d >= 1)) return setError('Width and depth must be at least 1 metre.');

    setBusy(true);
    setError(null);
    try {
      const result = await api<WarehouseDetail>('create_warehouse', {
        name: name.trim(),
        width_cm: Math.round(w * 100),
        depth_cm: Math.round(d * 100),
      });
      onCreated(result.warehouse.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the warehouse.');
      setBusy(false);
    }
  };

  return (
    <form className="gwpp-panel gwpp-create" onSubmit={(event) => void submit(event)}>
      <h3 className="gwpp-panel-title">New warehouse</h3>
      <label className="gwpp-field">
        <span className="gwpp-label">Name</span>
        <input className="gwpp-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={190} />
      </label>
      <div className="gwpp-field-grid">
        <label className="gwpp-field">
          <span className="gwpp-label">Width</span>
          <span className="gwpp-input-unit">
            <input className="gwpp-input" inputMode="decimal" value={width} onChange={(e) => setWidth(e.target.value)} />
            <span>m</span>
          </span>
        </label>
        <label className="gwpp-field">
          <span className="gwpp-label">Depth</span>
          <span className="gwpp-input-unit">
            <input className="gwpp-input" inputMode="decimal" value={depth} onChange={(e) => setDepth(e.target.value)} />
            <span>m</span>
          </span>
        </label>
      </div>
      <p className="gwpp-hint">The inside floor area. You can change it later.</p>
      {error && <p className="gwpp-error">{error}</p>}
      <div className="gwpp-button-row">
        <button type="submit" className="gwpp-button is-primary" disabled={busy}>
          {busy ? 'Creating…' : 'Create and open'}
        </button>
        <button type="button" className="gwpp-button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}
