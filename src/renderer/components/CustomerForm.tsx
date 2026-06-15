import { useState } from 'react';
import { useMcp } from '../hooks/useMcp';
import { MCP_TOOLS } from '../../shared/mcpTools';
import { LoadingSpinner } from './LoadingSpinner';
import type { Customer } from '../../shared/types';

interface CustomerFormProps {
  customer?: Customer | null;
  onClose: () => void;
  onSaved: () => void;
  /** View-only mode for read-access keys: disables inputs, hides save. */
  readOnly?: boolean;
}

export function CustomerForm({ customer, onClose, onSaved, readOnly = false }: CustomerFormProps) {
  const { callTool } = useMcp();
  const isEdit = !!customer;

  const [email, setEmail] = useState(customer?.email ?? '');
  const [firstName, setFirstName] = useState(customer?.first_name ?? '');
  const [lastName, setLastName] = useState(customer?.last_name ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [company, setCompany] = useState(customer?.company ?? '');
  const [accountType, setAccountType] = useState<string>(customer?.account_type ?? 'individual');
  const [taxId, setTaxId] = useState(customer?.tax_id ?? '');
  const [isTaxExempt, setIsTaxExempt] = useState(customer?.is_tax_exempt ?? false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !firstName.trim() || !lastName.trim()) return;

    setSaving(true);
    setError(null);

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

      if (isEdit) {
        args.customer_id = customer!.id;
        await callTool(MCP_TOOLS.UPDATE_CUSTOMER, args);
      } else {
        await callTool(MCP_TOOLS.CREATE_CUSTOMER, args);
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save customer');
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
    <div>
      <label className="block text-sm font-medium text-goose-text mb-1">{label}</label>
      {children}
    </div>
  );
}
