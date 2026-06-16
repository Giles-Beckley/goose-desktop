import { useState, useEffect } from 'react';
import { useMcp } from '../hooks/useMcp';
import { useConnectionStore } from '../stores/connectionStore';
import { MCP_TOOLS } from '../../shared/mcpTools';
import { LoadingSpinner } from './LoadingSpinner';
import type { Customer, CustomerAddress } from '../../shared/types';

interface CustomerFormProps {
  customer?: Customer | null;
  onClose: () => void;
  onSaved: () => void;
  /** View-only mode for read-access keys: disables inputs, hides save. */
  readOnly?: boolean;
}

/** An address being edited in the form: the saved id (if persisted) + fields. */
interface AddressDraft {
  /** Local-only key for React lists / tracking unsaved rows. */
  key: string;
  /** Server id once persisted; undefined for a new, unsaved address. */
  id?: number;
  address_type: 'billing' | 'shipping';
  address_name: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
}

let draftKeySeq = 0;
const nextKey = () => `addr-${draftKeySeq++}`;

const emptyDraft = (type: 'billing' | 'shipping'): AddressDraft => ({
  key: nextKey(),
  address_type: type,
  address_name: '',
  address_line_1: '',
  address_line_2: '',
  city: '',
  state: '',
  postcode: '',
  country: '',
});

const toDraft = (a: CustomerAddress): AddressDraft => ({
  key: nextKey(),
  id: a.id,
  address_type: a.address_type === 'shipping' ? 'shipping' : 'billing',
  address_name: a.address_name ?? '',
  address_line_1: a.address_line_1 ?? '',
  address_line_2: a.address_line_2 ?? '',
  city: a.city ?? '',
  state: a.state ?? '',
  postcode: a.postcode ?? '',
  country: a.country ?? '',
});

/** A draft is "filled" enough to save (plugin requires these four). */
const isFilled = (d: AddressDraft) =>
  d.address_line_1.trim() !== '' && d.city.trim() !== '' && d.postcode.trim() !== '' && d.country.trim() !== '';

/** Any field has content (used to tell "blank new row" from "cleared existing"). */
const hasAnyContent = (d: AddressDraft) =>
  [d.address_name, d.address_line_1, d.address_line_2, d.city, d.state, d.postcode, d.country]
    .some((v) => v.trim() !== '');

const addressArgs = (d: AddressDraft) => ({
  address_name: d.address_name.trim(),
  address_line_1: d.address_line_1.trim(),
  address_line_2: d.address_line_2.trim(),
  city: d.city.trim(),
  state: d.state.trim(),
  postcode: d.postcode.trim(),
  country: d.country.trim(),
});

const parse = (result: { content?: Array<{ text?: string }> } | null): any => {
  const text = result?.content?.[0]?.text;
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
};

export function CustomerForm({ customer, onClose, onSaved, readOnly = false }: CustomerFormProps) {
  const { callTool } = useMcp();
  const { allow_multiple_billing, allow_multiple_shipping } = useConnectionStore((s) => s.addressSettings);
  const isEdit = !!customer;

  const [email, setEmail] = useState(customer?.email ?? '');
  const [firstName, setFirstName] = useState(customer?.first_name ?? '');
  const [lastName, setLastName] = useState(customer?.last_name ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [company, setCompany] = useState(customer?.company ?? '');
  const [accountType, setAccountType] = useState<string>(customer?.account_type ?? 'individual');
  const [taxId, setTaxId] = useState(customer?.tax_id ?? '');
  const [isTaxExempt, setIsTaxExempt] = useState(customer?.is_tax_exempt ?? false);

  // Addresses
  const [addresses, setAddresses] = useState<AddressDraft[]>([]);
  // Snapshot of address ids present when the form loaded — used on save to
  // detect which saved addresses were removed (so we can DELETE them).
  const [loadedIds, setLoadedIds] = useState<number[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // Load full customer detail (incl. addresses) in edit mode. The list view's
  // Customer object has no addresses, so we fetch them here.
  useEffect(() => {
    if (!isEdit || !customer) return;
    let cancelled = false;
    (async () => {
      setLoadingAddresses(true);
      try {
        const result = await callTool(MCP_TOOLS.GET_CUSTOMER, { customer_id: customer.id });
        const data = parse(result);
        if (result === null || (data && data.success === false)) {
          if (!cancelled) setWarning('Could not load saved addresses. You can still edit the customer.');
          return;
        }
        const list: CustomerAddress[] = data?.customer?.addresses ?? [];
        if (!cancelled) {
          setAddresses(list.map(toDraft));
          setLoadedIds(list.map((a) => a.id).filter((id): id is number => typeof id === 'number'));
        }
      } finally {
        if (!cancelled) setLoadingAddresses(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // In single-address mode, guarantee exactly one editable row per type so the
  // operator always has a blank address to fill. Runs once addresses settle
  // (after the edit-mode fetch) and when the store's capability flags arrive.
  useEffect(() => {
    if (loadingAddresses) return;
    setAddresses((prev) => {
      const next = [...prev];
      const ensure = (type: 'billing' | 'shipping', allowMultiple: boolean) => {
        if (allowMultiple) return;
        if (!next.some((a) => a.address_type === type)) next.push(emptyDraft(type));
      };
      ensure('billing', allow_multiple_billing);
      ensure('shipping', allow_multiple_shipping);
      return next.length === prev.length ? prev : next;
    });
  }, [loadingAddresses, allow_multiple_billing, allow_multiple_shipping]);

  const billingRows = addresses.filter((a) => a.address_type === 'billing');
  const shippingRows = addresses.filter((a) => a.address_type === 'shipping');

  const updateDraft = (key: string, patch: Partial<AddressDraft>) =>
    setAddresses((prev) => prev.map((a) => (a.key === key ? { ...a, ...patch } : a)));

  const addDraft = (type: 'billing' | 'shipping') =>
    setAddresses((prev) => [...prev, emptyDraft(type)]);

  const removeDraft = (key: string) =>
    setAddresses((prev) => prev.filter((a) => a.key !== key));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !firstName.trim() || !lastName.trim()) return;

    // Client-side address validation: a partially-filled address can't be saved.
    const partial = addresses.find((a) => hasAnyContent(a) && !isFilled(a));
    if (partial) {
      setError(`Incomplete ${partial.address_type} address — line 1, city, postcode and country are required.`);
      return;
    }

    setSaving(true);
    setError(null);
    setWarning(null);

    try {
      const args: Record<string, unknown> = {
        email: email.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        account_type: accountType,
        is_tax_exempt: isTaxExempt,
      };
      if (phone.trim()) args.phone = phone.trim();
      if (company.trim()) args.company = company.trim();
      if (taxId.trim()) args.tax_id = taxId.trim();

      // 1. Save the customer (callTool returns null on failure — check explicitly).
      let customerId: number | undefined = customer?.id;
      if (isEdit) {
        args.customer_id = customer!.id;
        const res = parse(await callTool(MCP_TOOLS.UPDATE_CUSTOMER, args));
        if (res === null || res?.success === false) {
          setError(res?.error || 'Failed to update customer');
          return;
        }
      } else {
        const res = parse(await callTool(MCP_TOOLS.CREATE_CUSTOMER, args));
        if (res === null || res?.success === false) {
          setError(res?.error || 'Failed to create customer');
          return;
        }
        customerId = res?.customer_id ?? res?.customer?.id ?? res?.id;
        if (!customerId) {
          setError('Customer created but no id was returned; cannot save addresses.');
          onSaved();
          return;
        }
      }

      // 2. Reconcile addresses: add new, update existing, delete removed.
      const addressFailures: string[] = [];

      // Deletes: ids that were loaded but no longer present in the drafts.
      const survivingIds = new Set(addresses.map((a) => a.id).filter(Boolean) as number[]);
      for (const id of loadedIds) {
        if (!survivingIds.has(id)) {
          const res = parse(await callTool(MCP_TOOLS.DELETE_CUSTOMER_ADDRESS, { address_id: id }));
          if (res === null || res?.success === false) addressFailures.push(`delete #${id}`);
        }
      }

      // Adds / updates.
      for (const d of addresses) {
        const filled = isFilled(d);
        if (d.id) {
          if (filled) {
            const res = parse(await callTool(MCP_TOOLS.UPDATE_CUSTOMER_ADDRESS, { address_id: d.id, ...addressArgs(d) }));
            if (res === null || res?.success === false) addressFailures.push(`${d.address_type} address`);
          } else if (hasAnyContent(d)) {
            // Existing address cleared out → delete it.
            const res = parse(await callTool(MCP_TOOLS.DELETE_CUSTOMER_ADDRESS, { address_id: d.id }));
            if (res === null || res?.success === false) addressFailures.push(`delete ${d.address_type}`);
          }
          // existing + fully empty (no content) → nothing to do
        } else if (filled) {
          const res = parse(await callTool(MCP_TOOLS.ADD_CUSTOMER_ADDRESS, {
            customer_id: customerId,
            address_type: d.address_type,
            is_default: true,
            ...addressArgs(d),
          }));
          if (res === null || res?.success === false) addressFailures.push(`${d.address_type} address`);
        }
      }

      if (addressFailures.length > 0) {
        // Customer saved, but some address ops failed — surface, don't discard.
        setWarning(`Customer saved, but these address changes failed: ${addressFailures.join(', ')}.`);
        onSaved();
        return;
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  const renderAddressFields = (d: AddressDraft, allowMultiple: boolean) => (
    <div key={d.key} className="space-y-3 rounded-lg border border-goose-border p-3">
      {allowMultiple && (
        <div className="flex items-center justify-between">
          <Field label="Label">
            <input type="text" value={d.address_name} onChange={(e) => updateDraft(d.key, { address_name: e.target.value })} className="input" placeholder="Home, Office..." />
          </Field>
          <button type="button" onClick={() => removeDraft(d.key)} className="ml-3 mt-5 p-1 text-goose-text-light hover:text-red-600 transition-colors" title="Remove address">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      <Field label="Address line 1">
        <input type="text" value={d.address_line_1} onChange={(e) => updateDraft(d.key, { address_line_1: e.target.value })} className="input" />
      </Field>
      <Field label="Address line 2">
        <input type="text" value={d.address_line_2} onChange={(e) => updateDraft(d.key, { address_line_2: e.target.value })} className="input" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="City">
          <input type="text" value={d.city} onChange={(e) => updateDraft(d.key, { city: e.target.value })} className="input" />
        </Field>
        <Field label="County / State">
          <input type="text" value={d.state} onChange={(e) => updateDraft(d.key, { state: e.target.value })} className="input" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Postcode">
          <input type="text" value={d.postcode} onChange={(e) => updateDraft(d.key, { postcode: e.target.value })} className="input" />
        </Field>
        <Field label="Country">
          <input type="text" value={d.country} onChange={(e) => updateDraft(d.key, { country: e.target.value })} className="input" placeholder="e.g. GB" />
        </Field>
      </div>
    </div>
  );

  const renderAddressSection = (
    label: string,
    type: 'billing' | 'shipping',
    rows: AddressDraft[],
    allowMultiple: boolean,
  ) => (
    <div className="pt-4 border-t border-goose-border">
      <h3 className="text-sm font-display font-semibold text-goose-text mb-3">
        {label}{allowMultiple ? ' Addresses' : ' Address'}
      </h3>
      <div className="space-y-3">
        {rows.map((d) => renderAddressFields(d, allowMultiple))}
      </div>
      {allowMultiple && (
        <button
          type="button"
          onClick={() => addDraft(type)}
          className="mt-3 w-full px-4 py-2 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add {label.toLowerCase()} address
        </button>
      )}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">{error}</div>
      )}
      {warning && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">{warning}</div>
      )}
      {readOnly && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
          Your API key has read-only access to customers. Editing is disabled.
        </div>
      )}

      <fieldset disabled={readOnly} className="contents">
      <Field label="Email *">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input" placeholder="customer@example.com" />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="First name *">
          <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="input" />
        </Field>
        <Field label="Last name *">
          <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required className="input" />
        </Field>
      </div>

      <Field label="Phone">
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" placeholder="+44 7..." />
      </Field>

      <Field label="Account type">
        <select value={accountType} onChange={(e) => setAccountType(e.target.value)} className="input">
          <option value="individual">Individual</option>
          <option value="business">Business</option>
        </select>
      </Field>

      {accountType === 'business' && (
        <>
          <Field label="Company name">
            <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} className="input" />
          </Field>
          <Field label="Tax ID / VAT number">
            <input type="text" value={taxId} onChange={(e) => setTaxId(e.target.value)} className="input" />
          </Field>
        </>
      )}

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={isTaxExempt} onChange={(e) => setIsTaxExempt(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
        <span className="text-sm text-goose-text">Tax exempt</span>
      </label>

      {/* Addresses */}
      {loadingAddresses ? (
        <div className="flex items-center gap-2 pt-4 border-t border-goose-border text-sm text-goose-text-light">
          <LoadingSpinner size="sm" /> Loading addresses…
        </div>
      ) : (
        <>
          {renderAddressSection('Billing', 'billing', billingRows, allow_multiple_billing)}
          {renderAddressSection('Shipping', 'shipping', shippingRows, allow_multiple_shipping)}
        </>
      )}
      </fieldset>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-goose-border">
        {!readOnly && (
          <button
            type="submit"
            disabled={saving || !email.trim() || !firstName.trim() || !lastName.trim()}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <LoadingSpinner size="sm" />}
            {isEdit ? 'Update Customer' : 'Create Customer'}
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
    <div className="flex-1">
      <label className="block text-sm font-medium text-goose-text mb-1">{label}</label>
      {children}
    </div>
  );
}
