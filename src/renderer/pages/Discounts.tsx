import { useEffect, useState } from 'react';
import { useMcp } from '../hooks/useMcp';
import { useAccess } from '../hooks/useAccess';
import { useConnectionStore } from '../stores/connectionStore';
import { formatCurrency } from '../../shared/currency';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { SlideOver } from '../components/SlideOver';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { MCP_TOOLS, MCP_RESOURCES } from '../../shared/mcpTools';
import { VolumeDiscounts } from '../components/VolumeDiscounts';

type DiscountType = 'percentage' | 'fixed_amount' | 'voucher';

type DiscountTab = 'coupons' | 'volume';

export function Discounts() {
  const [tab, setTab] = useState<DiscountTab>('coupons');

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-2xl font-display font-bold text-goose-text mr-4">Discounts</h1>
        {(['coupons', 'volume'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
              tab === t ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-goose-text-light hover:bg-gray-200'
            }`}
          >
            {t === 'coupons' ? 'Discounts & Vouchers' : 'Volume Discounts'}
          </button>
        ))}
      </div>

      {tab === 'coupons' ? <CouponDiscounts /> : <VolumeDiscounts />}
    </div>
  );
}

interface Discount {
  id: number;
  code: string;
  name?: string;
  description?: string;
  discount_type: DiscountType;
  amount: number;
  usage_count?: number;
  usage_limit?: number | null;
  usage_limit_per_user?: number | null;
  minimum_order_amount?: number | null;
  maximum_discount_amount?: number | null;
  free_shipping?: boolean;
  single_use_voucher?: boolean;
  valid_from?: string | null;
  valid_to?: string | null;
  status?: string;
  remaining_balance?: number;
  created_at?: string;
}

function CouponDiscounts() {
  const { callTool, readResource } = useMcp();
  const { canWrite } = useAccess();
  const currency = useConnectionStore((s) => s.currency);
  const sym = currency.symbol;
  const writable = canWrite('discount');
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | DiscountType>('all');

  const [slideOpen, setSlideOpen] = useState(false);
  const [selectedDiscount, setSelectedDiscount] = useState<Discount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Discount | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Voucher tools
  const [showBulkGenerate, setShowBulkGenerate] = useState(false);
  const [bulkPrefix, setBulkPrefix] = useState('');
  const [bulkCount, setBulkCount] = useState('10');
  const [bulkValue, setBulkValue] = useState('');
  const [bulkGenerating, setBulkGenerating] = useState(false);

  // Validate code
  const [validateCode, setValidateCode] = useState('');
  const [validateTotal, setValidateTotal] = useState('');
  const [validateResult, setValidateResult] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);

  const syncDiscounts = async () => {
    setLoading(true);
    setError(null);
    try {
      // quiet: a failure here (e.g. a server-side 500 on the discounts
      // endpoint) must not flip the whole app to "Connection Error".
      const result = await readResource(MCP_RESOURCES.DISCOUNTS, { quiet: true });
      if (result === null) {
        setError('Could not load discounts (the store returned an error). Other sections are unaffected.');
        setDiscounts([]);
      } else if (result?.content?.[0]?.text) {
        const data = JSON.parse(result.content[0].text);
        if (data.error) {
          setError(data.error);
          setDiscounts([]);
        } else {
          setDiscounts(data.discounts ?? []);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch discounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncDiscounts();
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await callTool(MCP_TOOLS.DELETE_DISCOUNT, { id: deleteTarget.id });
      setDeleteTarget(null);
      syncDiscounts();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  const openEdit = (d: Discount) => {
    setSelectedDiscount(d);
    setSlideOpen(true);
  };

  const openCreate = () => {
    setSelectedDiscount(null);
    setSlideOpen(true);
  };

  const handleValidate = async () => {
    if (!validateCode.trim() || !validateTotal) return;
    setValidating(true);
    setValidateResult(null);
    try {
      const result = await callTool(MCP_TOOLS.VALIDATE_DISCOUNT_CODE, {
        code: validateCode.trim(),
        cart_total: parseFloat(validateTotal),
      });
      if (result?.content?.[0]?.text) {
        const data = JSON.parse(result.content[0].text);
        if (data.valid) {
          const amount = formatCurrency(Number(data.discount_amount ?? 0), currency);
          setValidateResult(`Valid! ${data.discount_type === 'percentage' ? 'Percentage' : 'Fixed'} discount — saves ${amount}. ${data.message ?? ''}`);
        } else {
          setValidateResult(`Invalid: ${data.error ?? 'Code not found or expired'}`);
        }
      }
    } catch (err) {
      setValidateResult('Error validating code');
    } finally {
      setValidating(false);
    }
  };

  const handleBulkGenerate = async () => {
    if (!bulkValue) return;
    setBulkGenerating(true);
    setError(null);
    try {
      const result = await callTool(MCP_TOOLS.BULK_GENERATE_VOUCHERS, {
        count: parseInt(bulkCount, 10),
        value: parseFloat(bulkValue),
        ...(bulkPrefix.trim() ? { prefix: bulkPrefix.trim() } : {}),
      });
      if (result?.content?.[0]?.text) {
        const data = JSON.parse(result.content[0].text);
        const codes = data.vouchers?.map((v: any) => v.code).join('\n') ?? '';
        if (codes) {
          // Offer download of generated codes
          const base64 = btoa(unescape(encodeURIComponent(codes)));
          await window.electronAPI.dialog.saveFile('voucher-codes.txt', base64);
        }
      }
      setShowBulkGenerate(false);
      setBulkPrefix('');
      setBulkCount('10');
      setBulkValue('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate vouchers');
    } finally {
      setBulkGenerating(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-end mb-6">
        {writable && (
          <div className="flex gap-2">
            <button
              onClick={openCreate}
              className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Discount
            </button>
            <button
              onClick={() => setShowBulkGenerate(true)}
              className="px-4 py-2 bg-gray-100 text-goose-text text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
            >
              Bulk Vouchers
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">{error}</div>
      )}

      {/* Validate discount code */}
      <div className="bg-white rounded-xl border border-goose-border p-6 mb-6">
        <h2 className="text-sm font-medium text-goose-text mb-3">Validate Discount Code</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={validateCode}
            onChange={(e) => setValidateCode(e.target.value)}
            placeholder="Enter discount code..."
            className="input flex-1"
          />
          <input
            type="number"
            step="0.01"
            min="0"
            value={validateTotal}
            onChange={(e) => setValidateTotal(e.target.value)}
            placeholder="Cart total"
            className="input w-40"
          />
          <button
            onClick={handleValidate}
            disabled={validating || !validateCode.trim() || !validateTotal}
            className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {validating && <LoadingSpinner size="sm" />}
            Validate
          </button>
        </div>
        {validateResult && (
          <p className={`mt-2 text-sm ${validateResult.startsWith('Valid') ? 'text-green-600' : 'text-red-600'}`}>
            {validateResult}
          </p>
        )}
      </div>

      {/* Check voucher balance */}
      <VoucherBalanceCheck />

      {/* Discount list */}
      <div className="bg-white rounded-xl border border-goose-border mb-6">
        <div className="px-6 py-4 border-b border-goose-border flex items-center gap-2">
          <h2 className="text-sm font-medium text-goose-text mr-2">All Discounts</h2>
          {(['all', 'percentage', 'fixed_amount', 'voucher'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                filter === f ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-goose-text-light hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? 'All' : f === 'fixed_amount' ? 'Fixed' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-goose-text-light uppercase tracking-wider">
                <th className="px-6 py-3">Code</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Value</th>
                <th className="px-6 py-3">Usage</th>
                <th className="px-6 py-3">Valid</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-goose-border">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center"><LoadingSpinner /></td></tr>
              ) : discounts.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-goose-text-light text-sm">No discounts found.</td></tr>
              ) : (
                discounts
                  .filter(d => filter === 'all' || d.discount_type === filter)
                  .map(d => (
                    <tr key={d.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openEdit(d)}>
                      <td className="px-6 py-3 text-sm font-medium text-goose-text font-mono">{d.code}</td>
                      <td className="px-6 py-3 text-sm text-goose-text-light capitalize">
                        {d.discount_type === 'fixed_amount' ? 'fixed' : d.discount_type}
                      </td>
                      <td className="px-6 py-3 text-sm text-goose-text">
                        {d.discount_type === 'percentage' ? `${d.amount}%` : formatCurrency(Number(d.amount), currency)}
                      </td>
                      <td className="px-6 py-3 text-sm text-goose-text-light">
                        {d.usage_count ?? 0}{d.usage_limit ? ` / ${d.usage_limit}` : ''}
                      </td>
                      <td className="px-6 py-3 text-xs text-goose-text-light">
                        {d.valid_to ? `Until ${new Date(d.valid_to).toLocaleDateString()}` : 'No expiry'}
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          d.status === 'active' ? 'bg-primary-50 text-primary-700' : 'bg-gray-100 text-goose-text-light'
                        }`}>
                          {d.status ?? 'active'}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        {writable && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(d); }}
                            className="p-1 text-goose-text-light hover:text-red-600 rounded transition-colors"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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

      {/* Create / edit discount slide-over */}
      <SlideOver
        open={slideOpen}
        onClose={() => setSlideOpen(false)}
        title={selectedDiscount ? (writable ? `Edit Discount: ${selectedDiscount.code}` : `Discount: ${selectedDiscount.code}`) : 'Create Discount'}
      >
        <DiscountForm
          key={selectedDiscount?.id ?? 'new'}
          discount={selectedDiscount}
          onClose={() => setSlideOpen(false)}
          onSaved={syncDiscounts}
          readOnly={!writable}
        />
      </SlideOver>

      {/* Bulk generate modal */}
      {showBulkGenerate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96 space-y-4">
            <h2 className="text-lg font-display font-bold text-goose-text">Bulk Generate Vouchers</h2>
            <Field label="Prefix (optional)">
              <input type="text" value={bulkPrefix} onChange={(e) => setBulkPrefix(e.target.value)} className="input" placeholder="e.g. GIFT" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Count">
                <input type="number" min="1" max="100" value={bulkCount} onChange={(e) => setBulkCount(e.target.value)} className="input" />
              </Field>
              <Field label={`Value (${sym})`}>
                <input type="number" step="0.01" min="0" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="input" placeholder="25.00" />
              </Field>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleBulkGenerate}
                disabled={bulkGenerating || !bulkValue}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {bulkGenerating && <LoadingSpinner size="sm" />}
                Generate & Download
              </button>
              <button
                onClick={() => setShowBulkGenerate(false)}
                className="px-4 py-2.5 text-sm font-medium text-goose-text bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Discount"
        message={`Are you sure you want to delete discount "${deleteTarget?.code}"? This action cannot be undone.`}
        loading={deleting}
      />
    </div>
  );
}

function VoucherBalanceCheck() {
  const { callTool } = useMcp();
  const currency = useConnectionStore((s) => s.currency);
  const [code, setCode] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const check = async () => {
    if (!code.trim()) return;
    setChecking(true);
    setResult(null);
    try {
      const res = await callTool(MCP_TOOLS.GET_VOUCHER_BALANCE, { code: code.trim() });
      if (res?.content?.[0]?.text) {
        const data = JSON.parse(res.content[0].text);
        if (data.success !== false) {
          setResult(`Balance: ${formatCurrency(data.remaining_balance ?? 0, currency)} (Original: ${formatCurrency(data.original_value ?? 0, currency)})`);
        } else {
          setResult(data.error ?? 'Voucher not found');
        }
      }
    } catch {
      setResult('Error checking balance');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-goose-border p-6 mb-6">
      <h2 className="text-sm font-medium text-goose-text mb-3">Check Voucher Balance</h2>
      <div className="flex gap-3">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter voucher code..."
          className="input flex-1"
        />
        <button
          onClick={check}
          disabled={checking || !code.trim()}
          className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {checking && <LoadingSpinner size="sm" />}
          Check
        </button>
      </div>
      {result && (
        <p className={`mt-2 text-sm ${result.startsWith('Balance') ? 'text-green-600' : 'text-red-600'}`}>{result}</p>
      )}
    </div>
  );
}

function DiscountForm({
  discount,
  onClose,
  onSaved,
  readOnly = false,
}: {
  discount: Discount | null;
  onClose: () => void;
  onSaved: () => void;
  readOnly?: boolean;
}) {
  const { callTool } = useMcp();
  const sym = useConnectionStore((s) => s.currency.symbol);
  const isEdit = !!discount;

  const toDateInput = (val: string | null | undefined): string => {
    if (!val) return '';
    return val.split(' ')[0]?.split('T')[0] ?? '';
  };

  const [code, setCode] = useState(discount?.code ?? '');
  const [name, setName] = useState(discount?.name ?? '');
  const [description, setDescription] = useState(discount?.description ?? '');
  const [discountType, setDiscountType] = useState<DiscountType>(discount?.discount_type ?? 'percentage');
  const [amount, setAmount] = useState(discount?.amount != null ? String(discount.amount) : '');
  const [usageLimit, setUsageLimit] = useState(discount?.usage_limit != null ? String(discount.usage_limit) : '');
  const [usageLimitPerUser, setUsageLimitPerUser] = useState(discount?.usage_limit_per_user != null ? String(discount.usage_limit_per_user) : '');
  const [minimumOrderAmount, setMinimumOrderAmount] = useState(discount?.minimum_order_amount != null ? String(discount.minimum_order_amount) : '');
  const [maximumDiscountAmount, setMaximumDiscountAmount] = useState(discount?.maximum_discount_amount != null ? String(discount.maximum_discount_amount) : '');
  const [freeShipping, setFreeShipping] = useState(discount?.free_shipping ?? false);
  const [singleUseVoucher, setSingleUseVoucher] = useState(discount?.single_use_voucher ?? false);
  const [validFrom, setValidFrom] = useState(toDateInput(discount?.valid_from));
  const [validTo, setValidTo] = useState(toDateInput(discount?.valid_to));
  const [status, setStatus] = useState<'active' | 'inactive'>((discount?.status as 'active' | 'inactive') ?? 'active');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim() || !amount) return;

    setSaving(true);
    setError(null);

    try {
      if (isEdit && discount) {
        // update_discount: id is required, code is NOT updatable
        const args: Record<string, unknown> = {
          id: discount.id,
          name: name.trim(),
          amount: parseFloat(amount),
          status,
        };
        if (description.trim()) args.description = description.trim();
        if (usageLimit) args.usage_limit = parseInt(usageLimit, 10);
        if (usageLimitPerUser) args.usage_limit_per_user = parseInt(usageLimitPerUser, 10);
        if (minimumOrderAmount) args.minimum_order_amount = parseFloat(minimumOrderAmount);
        if (maximumDiscountAmount) args.maximum_discount_amount = parseFloat(maximumDiscountAmount);
        args.free_shipping = freeShipping;
        if (validFrom) args.valid_from = validFrom;
        if (validTo) args.valid_to = validTo;

        await callTool(MCP_TOOLS.UPDATE_DISCOUNT, args);
      } else {
        // create_discount
        const args: Record<string, unknown> = {
          code: code.trim().toUpperCase(),
          name: name.trim(),
          discount_type: discountType,
          amount: parseFloat(amount),
          status,
        };
        if (description.trim()) args.description = description.trim();
        if (usageLimit) args.usage_limit = parseInt(usageLimit, 10);
        if (usageLimitPerUser) args.usage_limit_per_user = parseInt(usageLimitPerUser, 10);
        if (minimumOrderAmount) args.minimum_order_amount = parseFloat(minimumOrderAmount);
        if (maximumDiscountAmount) args.maximum_discount_amount = parseFloat(maximumDiscountAmount);
        if (freeShipping) args.free_shipping = true;
        if (singleUseVoucher && discountType === 'voucher') args.single_use_voucher = true;
        if (validFrom) args.valid_from = validFrom;
        if (validTo) args.valid_to = validTo;

        await callTool(MCP_TOOLS.CREATE_DISCOUNT, args);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isEdit ? 'update' : 'create'} discount`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">{error}</div>
      )}
      {readOnly && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
          Your API key has read-only access to discounts. Editing is disabled.
        </div>
      )}

      <fieldset disabled={readOnly} className="contents">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Code *">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            disabled={isEdit}
            className="input uppercase disabled:bg-gray-100 disabled:text-goose-text-light"
            placeholder="SUMMER20"
          />
        </Field>
        <Field label="Type">
          <select
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as DiscountType)}
            disabled={isEdit}
            className="input disabled:bg-gray-100 disabled:text-goose-text-light"
          >
            <option value="percentage">Percentage (%)</option>
            <option value="fixed_amount">{`Fixed Amount (${sym})`}</option>
            <option value="voucher">{`Voucher (${sym})`}</option>
          </select>
        </Field>
      </div>

      <Field label="Name *">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="input"
          placeholder="e.g. Summer 2026 Sale"
        />
      </Field>

      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="input"
          rows={2}
          placeholder="Optional internal description..."
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label={discountType === 'percentage' ? 'Discount (%)' : `Value (${sym})`}>
          <input
            type="number"
            step="0.01"
            min="0"
            max={discountType === 'percentage' ? '100' : undefined}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className="input"
            placeholder={discountType === 'percentage' ? '20' : '10.00'}
          />
        </Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')} className="input">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Usage limit (total)">
          <input type="number" min="0" value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} className="input" placeholder="Unlimited" />
        </Field>
        <Field label="Limit per customer">
          <input type="number" min="0" value={usageLimitPerUser} onChange={(e) => setUsageLimitPerUser(e.target.value)} className="input" placeholder="Unlimited" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label={`Min. order amount (${sym})`}>
          <input type="number" step="0.01" min="0" value={minimumOrderAmount} onChange={(e) => setMinimumOrderAmount(e.target.value)} className="input" placeholder="No minimum" />
        </Field>
        {discountType === 'percentage' && (
          <Field label={`Max. discount cap (${sym})`}>
            <input type="number" step="0.01" min="0" value={maximumDiscountAmount} onChange={(e) => setMaximumDiscountAmount(e.target.value)} className="input" placeholder="No cap" />
          </Field>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Valid from">
          <input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className="input" />
        </Field>
        <Field label="Valid until">
          <input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} className="input" />
        </Field>
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={freeShipping} onChange={(e) => setFreeShipping(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
          <span className="text-sm text-goose-text">Free shipping</span>
        </label>
        {discountType === 'voucher' && !isEdit && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={singleUseVoucher} onChange={(e) => setSingleUseVoucher(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
            <span className="text-sm text-goose-text">Single use (full balance per redemption)</span>
          </label>
        )}
      </div>

      </fieldset>

      <div className="flex gap-3 pt-4 border-t border-goose-border">
        {!readOnly && (
          <button
            type="submit"
            disabled={saving || !code.trim() || !name.trim() || !amount}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <LoadingSpinner size="sm" />}
            {isEdit ? 'Update Discount' : 'Create Discount'}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="px-4 py-2.5 text-sm font-medium text-goose-text bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          {readOnly ? 'Close' : 'Cancel'}
        </button>
      </div>
    </form>
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
