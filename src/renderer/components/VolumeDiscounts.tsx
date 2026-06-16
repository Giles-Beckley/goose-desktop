import { useEffect, useState } from 'react';
import { useMcp } from '../hooks/useMcp';
import { useAccess } from '../hooks/useAccess';
import { useConnectionStore } from '../stores/connectionStore';
import { formatCurrency } from '../../shared/currency';
import type { Currency } from '../../shared/currency';
import { LoadingSpinner } from './LoadingSpinner';
import { SlideOver } from './SlideOver';
import { ConfirmDialog } from './ConfirmDialog';
import { MCP_TOOLS } from '../../shared/mcpTools';

// ── Types (match the plugin's quantity-discount settings contract) ──────────

type DiscountValueType = 'percentage' | 'fixed';
type GroupType = 'whole_basket' | 'tiered';
type Measure = 'spend' | 'count';
type Scope = 'cart' | 'category' | 'product';

interface VolumeTier {
  min: number;
  /** `0` = no upper limit. */
  max: number;
  discount_type: DiscountValueType;
  discount_value: number;
  label: string;
}

interface VolumeGroup {
  /** Local-only React list key; never sent to the plugin. */
  key: string;
  /** Server id; auto-generated `grp_…` if omitted on create. */
  id?: string;
  name: string;
  enabled: boolean;
  type: GroupType;
  stack_with_groups: boolean;
  stack_with_vouchers: boolean;
  // whole_basket fields
  threshold_amount: number;
  discount_type: DiscountValueType;
  discount_value: number;
  // tiered fields
  measure: Measure;
  scope: Scope;
  product_ids: number[];
  category_ids: number[];
  tiers: VolumeTier[];
}

const FEATURE_OFF = 'Quantity discounts feature is not activated.';

// ── Local key generation (same idiom as CustomerForm address drafts) ────────

let keySeq = 0;
const nextKey = () => `vgrp-${keySeq++}`;

const emptyTier = (): VolumeTier => ({
  min: 0,
  max: 0,
  discount_type: 'percentage',
  discount_value: 0,
  label: '',
});

const emptyGroup = (type: GroupType): VolumeGroup => ({
  key: nextKey(),
  name: '',
  enabled: true,
  type,
  stack_with_groups: false,
  stack_with_vouchers: false,
  threshold_amount: 0,
  discount_type: 'percentage',
  discount_value: 0,
  measure: 'spend',
  scope: 'cart',
  product_ids: [],
  category_ids: [],
  tiers: type === 'tiered' ? [emptyTier()] : [],
});

/** Default every missing key — read is raw and can be sparse (gotcha #2). */
function normaliseGroup(raw: any): VolumeGroup {
  const type: GroupType = raw?.type === 'tiered' ? 'tiered' : 'whole_basket';
  return {
    key: nextKey(),
    id: typeof raw?.id === 'string' ? raw.id : undefined,
    name: String(raw?.name ?? ''),
    enabled: raw?.enabled !== false,
    type,
    stack_with_groups: raw?.stack_with_groups === true,
    stack_with_vouchers: raw?.stack_with_vouchers === true,
    threshold_amount: Number(raw?.threshold_amount ?? 0),
    discount_type: raw?.discount_type === 'fixed' ? 'fixed' : 'percentage',
    discount_value: Number(raw?.discount_value ?? 0),
    measure: raw?.measure === 'count' ? 'count' : 'spend',
    scope: raw?.scope === 'category' ? 'category' : raw?.scope === 'product' ? 'product' : 'cart',
    product_ids: Array.isArray(raw?.product_ids) ? raw.product_ids.map(Number) : [],
    category_ids: Array.isArray(raw?.category_ids) ? raw.category_ids.map(Number) : [],
    tiers: Array.isArray(raw?.tiers)
      ? raw.tiers.map((t: any) => ({
          min: Number(t?.min ?? 0),
          max: Number(t?.max ?? 0),
          discount_type: t?.discount_type === 'fixed' ? 'fixed' : 'percentage',
          discount_value: Number(t?.discount_value ?? 0),
          label: String(t?.label ?? ''),
        }))
      : [],
  };
}

/** Strip local-only/derived fields before sending the full settings object. */
function toWireGroup(g: VolumeGroup): Record<string, unknown> {
  const common: Record<string, unknown> = {
    name: g.name.trim(),
    enabled: g.enabled,
    type: g.type,
    stack_with_groups: g.stack_with_groups,
    stack_with_vouchers: g.stack_with_vouchers,
  };
  if (g.id) common.id = g.id;

  if (g.type === 'whole_basket') {
    // Send only the flat fields — never the derived tiers/measure/scope (gotcha #1).
    return {
      ...common,
      threshold_amount: g.threshold_amount,
      discount_type: g.discount_type,
      discount_value: g.discount_value,
    };
  }

  return {
    ...common,
    measure: g.measure,
    scope: g.scope,
    product_ids: g.scope === 'product' ? g.product_ids : [],
    category_ids: g.scope === 'category' ? g.category_ids : [],
    tiers: g.tiers.map((t) => ({
      min: t.min,
      max: t.max,
      discount_type: t.discount_type,
      discount_value: t.discount_value,
      label: t.label.trim(),
    })),
  };
}

const parse = (result: { content?: Array<{ text?: string }> } | null): any => {
  const text = result?.content?.[0]?.text;
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

// ── Main component ──────────────────────────────────────────────────────────

export function VolumeDiscounts() {
  const { callTool } = useMcp();
  const { canWrite } = useAccess();
  const currency = useConnectionStore((s) => s.currency);
  const writable = canWrite('discount');
  const readOnly = !writable;

  const [showBadges, setShowBadges] = useState(true);
  const [groups, setGroups] = useState<VolumeGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [featureOff, setFeatureOff] = useState(false);

  const [editing, setEditing] = useState<VolumeGroup | null>(null);
  const [slideOpen, setSlideOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VolumeGroup | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    setFeatureOff(false);
    try {
      const result = await callTool(
        MCP_TOOLS.STORE_QUERY,
        { operation: 'get_quantity_discounts', params: {} },
        { quiet: true },
      );
      if (result === null) {
        // The call threw (transport error, or the plugin rejected the
        // operation). Surface it here without breaking the rest of the app.
        setError('Could not reach the volume-discounts service. Check the store connection or that the plugin supports this feature.');
        setGroups([]);
        return;
      }
      const data = parse(result);
      if (data?.success === false) {
        if (String(data.error ?? '').includes('not activated')) {
          setFeatureOff(true);
        } else {
          setError(data.error ?? 'Failed to load volume discounts');
        }
        setGroups([]);
        return;
      }
      const settings = data?.settings ?? {};
      setShowBadges(settings.show_product_badges !== false);
      setGroups(Array.isArray(settings.groups) ? settings.groups.map(normaliseGroup) : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load volume discounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /** Persist the WHOLE settings object (full replace). */
  const persist = async (nextGroups: VolumeGroup[], nextBadges: boolean) => {
    setSaving(true);
    setError(null);
    try {
      const result = await callTool(
        MCP_TOOLS.STORE_ACTION,
        {
          operation: 'update_quantity_discounts',
          params: {
            show_product_badges: nextBadges,
            groups: nextGroups.map(toWireGroup),
          },
        },
        { quiet: true },
      );
      if (result === null) {
        setError('Could not reach the volume-discounts service. Your changes were not saved.');
        return false;
      }
      const data = parse(result);
      if (data?.success === false) {
        setError(data.error ?? 'Failed to save volume discounts');
        return false;
      }
      const settings = data?.settings ?? {};
      setShowBadges(settings.show_product_badges !== false);
      setGroups(Array.isArray(settings.groups) ? settings.groups.map(normaliseGroup) : []);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save volume discounts');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const openCreate = () => {
    setEditing(emptyGroup('whole_basket'));
    setSlideOpen(true);
  };

  const openEdit = (g: VolumeGroup) => {
    setEditing(g);
    setSlideOpen(true);
  };

  // Editor "Done" commits the group into local state and saves the whole object.
  const handleGroupSave = async (g: VolumeGroup) => {
    const exists = groups.some((x) => x.key === g.key);
    const next = exists ? groups.map((x) => (x.key === g.key ? g : x)) : [...groups, g];
    const ok = await persist(next, showBadges);
    if (ok) setSlideOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const next = groups.filter((x) => x.key !== deleteTarget.key);
    const ok = await persist(next, showBadges);
    if (ok) setDeleteTarget(null);
  };

  const toggleBadges = async (value: boolean) => {
    setShowBadges(value); // optimistic
    const ok = await persist(groups, value);
    if (!ok) setShowBadges(!value); // revert on failure
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-goose-border p-12 flex justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (featureOff) {
    return (
      <div className="bg-white rounded-xl border border-goose-border p-10 text-center">
        <h2 className="text-base font-medium text-goose-text mb-1">Volume discounts aren't enabled</h2>
        <p className="text-sm text-goose-text-light">
          The Quantity Discounts feature isn't activated on this store. Enable it in the Goose
          Commerce plugin settings to manage volume discounts here.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showBadges}
            onChange={(e) => toggleBadges(e.target.checked)}
            disabled={readOnly || saving}
            className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm text-goose-text">Show volume-discount badges on product pages</span>
        </label>
        {writable && (
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add volume discount
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-goose-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-goose-text-light uppercase tracking-wider">
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Rule</th>
                <th className="px-6 py-3">Stacking</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-goose-border">
              {groups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-goose-text-light text-sm">
                    No volume discounts yet.
                  </td>
                </tr>
              ) : (
                groups.map((g) => (
                  <tr
                    key={g.key}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => openEdit(g)}
                  >
                    <td className="px-6 py-3 text-sm font-medium text-goose-text">{g.name || '(untitled)'}</td>
                    <td className="px-6 py-3 text-sm text-goose-text-light">
                      {g.type === 'whole_basket' ? 'Whole basket' : 'Tiered'}
                    </td>
                    <td className="px-6 py-3 text-sm text-goose-text">{summarise(g, currency)}</td>
                    <td className="px-6 py-3 text-xs text-goose-text-light">
                      {[g.stack_with_groups && 'groups', g.stack_with_vouchers && 'vouchers']
                        .filter(Boolean)
                        .join(', ') || 'none'}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          g.enabled ? 'bg-primary-50 text-primary-700' : 'bg-gray-100 text-goose-text-light'
                        }`}
                      >
                        {g.enabled ? 'enabled' : 'disabled'}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      {writable && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(g);
                          }}
                          className="p-1 text-goose-text-light hover:text-red-600 rounded transition-colors"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SlideOver
        open={slideOpen}
        onClose={() => setSlideOpen(false)}
        title={editing && groups.some((x) => x.key === editing.key) ? 'Edit volume discount' : 'Add volume discount'}
        wide
      >
        {editing && (
          <VolumeGroupForm
            key={editing.key}
            group={editing}
            onCancel={() => setSlideOpen(false)}
            onSave={handleGroupSave}
            saving={saving}
            error={error}
            readOnly={readOnly}
          />
        )}
      </SlideOver>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete volume discount"
        message={`Delete "${deleteTarget?.name || 'this volume discount'}"? This action cannot be undone.`}
        loading={saving}
      />
    </div>
  );
}

function summarise(g: VolumeGroup, currency: Currency): string {
  const val = (type: DiscountValueType, value: number) =>
    type === 'percentage' ? `${value}%` : formatCurrency(value, currency);
  if (g.type === 'whole_basket') {
    return `Spend ${formatCurrency(g.threshold_amount, currency)}+ → ${val(g.discount_type, g.discount_value)} off`;
  }
  return `${g.tiers.length} tier${g.tiers.length === 1 ? '' : 's'} by ${g.measure}, scope ${g.scope}`;
}

// ── Group editor ────────────────────────────────────────────────────────────

function VolumeGroupForm({
  group,
  onCancel,
  onSave,
  saving,
  error,
  readOnly,
}: {
  group: VolumeGroup;
  onCancel: () => void;
  onSave: (g: VolumeGroup) => void;
  saving: boolean;
  error: string | null;
  readOnly: boolean;
}) {
  const sym = useConnectionStore((s) => s.currency.symbol);
  const [g, setG] = useState<VolumeGroup>(group);
  const set = <K extends keyof VolumeGroup>(k: K, v: VolumeGroup[K]) => setG((prev) => ({ ...prev, [k]: v }));

  const setTier = (i: number, patch: Partial<VolumeTier>) =>
    setG((prev) => ({ ...prev, tiers: prev.tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) }));
  const addTier = () => setG((prev) => ({ ...prev, tiers: [...prev.tiers, emptyTier()] }));
  const removeTier = (i: number) => setG((prev) => ({ ...prev, tiers: prev.tiers.filter((_, idx) => idx !== i) }));

  const valid =
    g.name.trim() !== '' &&
    (g.type === 'whole_basket' ? g.discount_value > 0 : g.tiers.length > 0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    onSave({ ...g, name: g.name.trim() });
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">{error}</div>}
      {readOnly && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
          Your API key has read-only access to discounts. Editing is disabled.
        </div>
      )}

      <fieldset disabled={readOnly} className="contents">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Name *">
            <input
              type="text"
              value={g.name}
              onChange={(e) => set('name', e.target.value)}
              required
              className="input"
              placeholder="e.g. Buy more, save more"
            />
          </Field>
          <Field label="Type">
            <select
              value={g.type}
              onChange={(e) => {
                const type = e.target.value as GroupType;
                setG((prev) => ({
                  ...prev,
                  type,
                  tiers: type === 'tiered' && prev.tiers.length === 0 ? [emptyTier()] : prev.tiers,
                }));
              }}
              className="input"
            >
              <option value="whole_basket">Whole basket</option>
              <option value="tiered">Tiered</option>
            </select>
          </Field>
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={g.enabled}
              onChange={(e) => set('enabled', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-goose-text">Enabled</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={g.stack_with_groups}
              onChange={(e) => set('stack_with_groups', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-goose-text">Stack with other groups</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={g.stack_with_vouchers}
              onChange={(e) => set('stack_with_vouchers', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-goose-text">Stack with vouchers</span>
          </label>
        </div>

        {g.type === 'whole_basket' ? (
          <div className="grid grid-cols-3 gap-4">
            <Field label={`Spend threshold (${sym})`}>
              <input
                type="number"
                step="0.01"
                min="0"
                value={String(g.threshold_amount)}
                onChange={(e) => set('threshold_amount', parseFloat(e.target.value) || 0)}
                className="input"
              />
            </Field>
            <Field label="Discount type">
              <select
                value={g.discount_type}
                onChange={(e) => set('discount_type', e.target.value as DiscountValueType)}
                className="input"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">{`Fixed (${sym})`}</option>
              </select>
            </Field>
            <Field label={g.discount_type === 'percentage' ? 'Value (%)' : `Value (${sym})`}>
              <input
                type="number"
                step="0.01"
                min="0"
                max={g.discount_type === 'percentage' ? '100' : undefined}
                value={String(g.discount_value)}
                onChange={(e) => set('discount_value', parseFloat(e.target.value) || 0)}
                required
                className="input"
              />
            </Field>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Measure by">
                <select value={g.measure} onChange={(e) => set('measure', e.target.value as Measure)} className="input">
                  <option value="spend">Amount spent</option>
                  <option value="count">Item count</option>
                </select>
              </Field>
              <Field label="Applies to">
                <select value={g.scope} onChange={(e) => set('scope', e.target.value as Scope)} className="input">
                  <option value="cart">Whole cart</option>
                  <option value="category">Specific categories</option>
                  <option value="product">Specific products</option>
                </select>
              </Field>
            </div>

            {g.scope === 'product' && (
              <IdPicker
                label="Products"
                kind="product"
                ids={g.product_ids}
                onChange={(ids) => set('product_ids', ids)}
                readOnly={readOnly}
              />
            )}
            {g.scope === 'category' && (
              <IdPicker
                label="Categories"
                kind="category"
                ids={g.category_ids}
                onChange={(ids) => set('category_ids', ids)}
                readOnly={readOnly}
              />
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-goose-text">Tiers</label>
                {!readOnly && (
                  <button type="button" onClick={addTier} className="text-sm text-primary-600 hover:text-primary-700">
                    + Add tier
                  </button>
                )}
              </div>
              <p className="text-xs text-goose-text-light mb-2">
                Upper limit of <span className="font-mono">0</span> means “no upper limit”.
              </p>
              <div className="space-y-2">
                {g.tiers.map((t, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end bg-gray-50 rounded-lg p-2">
                    <div className="col-span-2">
                      <label className="block text-xs text-goose-text-light mb-1">Min {g.measure === 'spend' ? sym : 'qty'}</label>
                      <input
                        type="number"
                        step={g.measure === 'spend' ? '0.01' : '1'}
                        min="0"
                        value={String(t.min)}
                        onChange={(e) => setTier(i, { min: parseFloat(e.target.value) || 0 })}
                        className="input"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-goose-text-light mb-1">Max (0 = ∞)</label>
                      <input
                        type="number"
                        step={g.measure === 'spend' ? '0.01' : '1'}
                        min="0"
                        value={String(t.max)}
                        onChange={(e) => setTier(i, { max: parseFloat(e.target.value) || 0 })}
                        className="input"
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="block text-xs text-goose-text-light mb-1">Discount</label>
                      <select
                        value={t.discount_type}
                        onChange={(e) => setTier(i, { discount_type: e.target.value as DiscountValueType })}
                        className="input"
                      >
                        <option value="percentage">%</option>
                        <option value="fixed">{sym}</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-goose-text-light mb-1">Value</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={String(t.discount_value)}
                        onChange={(e) => setTier(i, { discount_value: parseFloat(e.target.value) || 0 })}
                        className="input"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-goose-text-light mb-1">Label</label>
                      <input
                        type="text"
                        value={t.label}
                        onChange={(e) => setTier(i, { label: e.target.value })}
                        className="input"
                        placeholder="3–5 items"
                      />
                    </div>
                    <div className="col-span-1 flex justify-center pb-1.5">
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => removeTier(i)}
                          className="p-1 text-goose-text-light hover:text-red-600 rounded transition-colors"
                          title="Remove tier"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {g.tiers.length === 0 && (
                  <p className="text-sm text-goose-text-light">No tiers — add at least one.</p>
                )}
              </div>
            </div>
          </>
        )}
      </fieldset>

      <div className="flex gap-3 pt-4 border-t border-goose-border">
        {!readOnly && (
          <button
            type="submit"
            disabled={saving || !valid}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <LoadingSpinner size="sm" />}
            Save
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2.5 text-sm font-medium text-goose-text bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          {readOnly ? 'Close' : 'Cancel'}
        </button>
      </div>
    </form>
  );
}

// ── Lightweight product / category multi-select ─────────────────────────────

function IdPicker({
  label,
  kind,
  ids,
  onChange,
  readOnly,
}: {
  label: string;
  kind: 'product' | 'category';
  ids: number[];
  onChange: (ids: number[]) => void;
  readOnly: boolean;
}) {
  const { callTool } = useMcp();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Array<{ id: number; name: string }>>([]);
  const [chosen, setChosen] = useState<Record<number, string>>({});
  const [searching, setSearching] = useState(false);

  // Resolve names for any pre-existing ids (best effort via category list).
  useEffect(() => {
    if (kind !== 'category' || ids.length === 0) return;
    (async () => {
      try {
        const result = await callTool(MCP_TOOLS.LIST_CATEGORIES, {});
        const text = result?.content?.[0]?.text;
        if (!text) return;
        const data = JSON.parse(text);
        const list: any[] = Array.isArray(data) ? data : data.categories ?? [];
        const map: Record<number, string> = {};
        for (const c of list) if (ids.includes(Number(c.id))) map[Number(c.id)] = String(c.name);
        setChosen((prev) => ({ ...map, ...prev }));
      } catch {
        /* names are cosmetic; ignore */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const search = async (value: string) => {
    setTerm(value);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      if (kind === 'product') {
        const result = await callTool(MCP_TOOLS.SEARCH_PRODUCTS, { search_term: value.trim(), limit: 10 });
        const text = result?.content?.[0]?.text;
        const data = text ? JSON.parse(text) : {};
        const list: any[] = Array.isArray(data) ? data : data.products ?? [];
        setResults(list.map((p) => ({ id: Number(p.id), name: String(p.name) })));
      } else {
        const result = await callTool(MCP_TOOLS.LIST_CATEGORIES, {});
        const text = result?.content?.[0]?.text;
        const data = text ? JSON.parse(text) : {};
        const list: any[] = Array.isArray(data) ? data : data.categories ?? [];
        const lower = value.trim().toLowerCase();
        setResults(
          list
            .filter((c) => String(c.name).toLowerCase().includes(lower))
            .slice(0, 10)
            .map((c) => ({ id: Number(c.id), name: String(c.name) })),
        );
      }
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const add = (item: { id: number; name: string }) => {
    if (!ids.includes(item.id)) onChange([...ids, item.id]);
    setChosen((prev) => ({ ...prev, [item.id]: item.name }));
    setTerm('');
    setResults([]);
  };

  const remove = (id: number) => onChange(ids.filter((x) => x !== id));

  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-2 mb-2">
        {ids.length === 0 && <span className="text-sm text-goose-text-light">None selected.</span>}
        {ids.map((id) => (
          <span
            key={id}
            className="inline-flex items-center gap-1 px-2 py-1 bg-primary-50 text-primary-700 rounded-full text-xs"
          >
            {chosen[id] ?? `#${id}`}
            {!readOnly && (
              <button type="button" onClick={() => remove(id)} className="hover:text-red-600">
                ×
              </button>
            )}
          </span>
        ))}
      </div>
      {!readOnly && (
        <div className="relative">
          <input
            type="text"
            value={term}
            onChange={(e) => search(e.target.value)}
            className="input"
            placeholder={`Search ${kind === 'product' ? 'products' : 'categories'}…`}
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <LoadingSpinner size="sm" />
            </div>
          )}
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-goose-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => add(r)}
                  className="block w-full text-left px-3 py-2 text-sm text-goose-text hover:bg-gray-50"
                >
                  {r.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </Field>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-goose-text mb-1">{label}</label>
      {children}
    </div>
  );
}
