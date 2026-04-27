import { useEffect, useState } from 'react';
import { useMcp } from '../hooks/useMcp';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { SlideOver } from '../components/SlideOver';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { MCP_TOOLS } from '../../shared/mcpTools';

interface Discount {
  id: number;
  code: string;
  type: 'percentage' | 'fixed' | 'voucher';
  value: number;
  usage_count?: number;
  usage_limit?: number;
  usage_limit_per_user?: number;
  minimum_amount?: number;
  maximum_discount?: number;
  free_shipping?: boolean;
  single_use?: boolean;
  valid_from?: string;
  valid_until?: string;
  status?: string;
  remaining_balance?: number;
  created_at?: string;
}

export function Discounts() {
  const { callTool } = useMcp();
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'percentage' | 'fixed' | 'voucher'>('all');

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
      // There's no list_discounts tool, so we'll use validate to check individual codes
      // For now, we search via the available tools
      // The MCP server doesn't expose a list endpoint — we'll note this limitation
      // and fetch what we can
      setDiscounts([]);
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
      await callTool(MCP_TOOLS.DELETE_DISCOUNT, { discount_id: deleteTarget.id });
      setDeleteTarget(null);
      syncDiscounts();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleValidate = async () => {
    if (!validateCode.trim()) return;
    setValidating(true);
    setValidateResult(null);
    try {
      const result = await callTool(MCP_TOOLS.VALIDATE_DISCOUNT_CODE, {
        code: validateCode.trim(),
        ...(validateTotal ? { cart_total: parseFloat(validateTotal) } : {}),
      });
      if (result?.content?.[0]?.text) {
        const data = JSON.parse(result.content[0].text);
        if (data.valid) {
          setValidateResult(`Valid! Discount: ${data.discount_type === 'percentage' ? `${data.discount_value}%` : `$${data.discount_value}`}${data.calculated_discount ? ` (saves $${data.calculated_discount})` : ''}`);
        } else {
          setValidateResult(`Invalid: ${data.reason ?? 'Code not found or expired'}`);
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold text-goose-text">Discounts & Vouchers</h1>
        <div className="flex gap-2">
          <button
            onClick={() => { setSelectedDiscount(null); setSlideOpen(true); }}
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
            placeholder="Cart total (optional)"
            className="input w-40"
          />
          <button
            onClick={handleValidate}
            disabled={validating || !validateCode.trim()}
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

      {/* Create discount slide-over */}
      <SlideOver
        open={slideOpen}
        onClose={() => setSlideOpen(false)}
        title="Create Discount"
      >
        <DiscountForm
          onClose={() => setSlideOpen(false)}
          onSaved={syncDiscounts}
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
              <Field label="Value ($)">
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
          setResult(`Balance: $${data.remaining_balance?.toFixed(2) ?? '0.00'} (Original: $${data.original_value?.toFixed(2) ?? '0.00'})`);
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

function DiscountForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { callTool } = useMcp();

  const [code, setCode] = useState('');
  const [type, setType] = useState<'percentage' | 'fixed' | 'voucher'>('percentage');
  const [value, setValue] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [usageLimitPerUser, setUsageLimitPerUser] = useState('');
  const [minimumAmount, setMinimumAmount] = useState('');
  const [maximumDiscount, setMaximumDiscount] = useState('');
  const [freeShipping, setFreeShipping] = useState(false);
  const [singleUse, setSingleUse] = useState(false);
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !value) return;

    setSaving(true);
    setError(null);

    try {
      const args: Record<string, unknown> = {
        code: code.trim().toUpperCase(),
        type,
        value: parseFloat(value),
      };
      if (usageLimit) args.usage_limit = parseInt(usageLimit, 10);
      if (usageLimitPerUser) args.usage_limit_per_user = parseInt(usageLimitPerUser, 10);
      if (minimumAmount) args.minimum_amount = parseFloat(minimumAmount);
      if (maximumDiscount) args.maximum_discount = parseFloat(maximumDiscount);
      if (freeShipping) args.free_shipping = true;
      if (singleUse) args.single_use = true;
      if (validFrom) args.valid_from = validFrom;
      if (validUntil) args.valid_until = validUntil;

      await callTool(MCP_TOOLS.CREATE_DISCOUNT, args);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create discount');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="Code *">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            className="input uppercase"
            placeholder="SUMMER20"
          />
        </Field>
        <Field label="Type">
          <select value={type} onChange={(e) => setType(e.target.value as any)} className="input">
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed Amount ($)</option>
            <option value="voucher">Voucher ($)</option>
          </select>
        </Field>
      </div>

      <Field label={type === 'percentage' ? 'Discount (%)' : 'Value ($)'}>
        <input
          type="number"
          step="0.01"
          min="0"
          max={type === 'percentage' ? '100' : undefined}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
          className="input"
          placeholder={type === 'percentage' ? '20' : '10.00'}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Usage limit (total)">
          <input type="number" min="0" value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} className="input" placeholder="Unlimited" />
        </Field>
        <Field label="Limit per customer">
          <input type="number" min="0" value={usageLimitPerUser} onChange={(e) => setUsageLimitPerUser(e.target.value)} className="input" placeholder="Unlimited" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Min. order amount ($)">
          <input type="number" step="0.01" min="0" value={minimumAmount} onChange={(e) => setMinimumAmount(e.target.value)} className="input" placeholder="No minimum" />
        </Field>
        {type === 'percentage' && (
          <Field label="Max. discount cap ($)">
            <input type="number" step="0.01" min="0" value={maximumDiscount} onChange={(e) => setMaximumDiscount(e.target.value)} className="input" placeholder="No cap" />
          </Field>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Valid from">
          <input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className="input" />
        </Field>
        <Field label="Valid until">
          <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="input" />
        </Field>
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={freeShipping} onChange={(e) => setFreeShipping(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
          <span className="text-sm text-goose-text">Free shipping</span>
        </label>
        {type === 'voucher' && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={singleUse} onChange={(e) => setSingleUse(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
            <span className="text-sm text-goose-text">Single use</span>
          </label>
        )}
      </div>

      <div className="flex gap-3 pt-4 border-t border-goose-border">
        <button
          type="submit"
          disabled={saving || !code.trim() || !value}
          className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving && <LoadingSpinner size="sm" />}
          Create Discount
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="px-4 py-2.5 text-sm font-medium text-goose-text bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          Cancel
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
