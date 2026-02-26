import { useState } from 'react';
import { useMcp } from '../hooks/useMcp';
import { MCP_TOOLS } from '../../shared/mcpTools';
import { LoadingSpinner } from './LoadingSpinner';
import type { Order, Product } from '../../shared/types';

interface OrderFormProps {
  order?: Order | null;
  onClose: () => void;
  onSaved: () => void;
}

interface LineItem {
  product_id: number;
  product_name: string;
  quantity: number;
}

export function OrderForm({ order, onClose, onSaved }: OrderFormProps) {
  const { callTool } = useMcp();
  const isView = !!order;

  // Customer fields (create mode)
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Line items (create mode)
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [searchingProducts, setSearchingProducts] = useState(false);

  // Status update (view mode)
  const [newStatus, setNewStatus] = useState(order?.status ?? '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchProducts = async (term: string) => {
    setProductSearch(term);
    if (term.length < 2) {
      setProductResults([]);
      return;
    }
    setSearchingProducts(true);
    try {
      const result = await callTool(MCP_TOOLS.SEARCH_PRODUCTS, { search_term: term, limit: 10 });
      if (result) {
        const text = result.content?.[0]?.text;
        if (text) {
          const data = JSON.parse(text);
          setProductResults(Array.isArray(data) ? data : data.products ?? []);
        }
      }
    } catch {
      setProductResults([]);
    } finally {
      setSearchingProducts(false);
    }
  };

  const addLineItem = (product: Product) => {
    const existing = lineItems.find(li => li.product_id === product.id);
    if (existing) {
      setLineItems(lineItems.map(li =>
        li.product_id === product.id ? { ...li, quantity: li.quantity + 1 } : li
      ));
    } else {
      setLineItems([...lineItems, { product_id: product.id, product_name: product.name, quantity: 1 }]);
    }
    setProductSearch('');
    setProductResults([]);
  };

  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity < 1) {
      setLineItems(lineItems.filter(li => li.product_id !== productId));
    } else {
      setLineItems(lineItems.map(li =>
        li.product_id === productId ? { ...li, quantity } : li
      ));
    }
  };

  const removeLineItem = (productId: number) => {
    setLineItems(lineItems.filter(li => li.product_id !== productId));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !firstName.trim() || !lastName.trim() || lineItems.length === 0) return;

    setSaving(true);
    setError(null);

    try {
      const args: Record<string, unknown> = {
        customer: {
          email: email.trim(),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
        },
        items: lineItems.map(li => ({ product_id: li.product_id, quantity: li.quantity })),
      };
      if (notes.trim()) args.notes = notes.trim();

      await callTool(MCP_TOOLS.CREATE_ORDER, args);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create order');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!order || !newStatus || newStatus === order.status) return;

    setSaving(true);
    setError(null);

    try {
      await callTool(MCP_TOOLS.UPDATE_ORDER_STATUS, { order_id: order.id, status: newStatus });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update order status');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!order) return;

    setSaving(true);
    setError(null);

    try {
      await callTool(MCP_TOOLS.CANCEL_ORDER, { order_id: order.id });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel order');
    } finally {
      setSaving(false);
    }
  };

  // ── View/Edit existing order ──
  if (isView && order) {
    return (
      <div className="space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">{error}</div>
        )}

        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-goose-text-light">Order</span>
            <span className="text-sm font-medium text-goose-text">#{order.order_number ?? order.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-goose-text-light">Date</span>
            <span className="text-sm text-goose-text">{new Date(order.date_created).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-goose-text-light">Total</span>
            <span className="text-sm font-medium text-goose-text">{order.currency_symbol ?? '$'}{order.total}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-goose-text-light">Customer</span>
            <span className="text-sm text-goose-text">{order.billing.first_name} {order.billing.last_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-goose-text-light">Email</span>
            <span className="text-sm text-goose-text">{order.billing.email}</span>
          </div>
        </div>

        {/* Line items */}
        <div>
          <h3 className="text-sm font-medium text-goose-text mb-2">Items</h3>
          <div className="border border-goose-border rounded-lg divide-y divide-goose-border">
            {order.line_items.map((item, i) => (
              <div key={i} className="flex justify-between px-4 py-2.5 text-sm">
                <span className="text-goose-text">{item.name} <span className="text-goose-text-light">x{item.quantity}</span></span>
                <span className="font-medium text-goose-text">${item.total}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Status update */}
        <div>
          <label className="block text-sm font-medium text-goose-text mb-1">Update Status</label>
          <div className="flex gap-2">
            <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="input flex-1">
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="on-hold">On Hold</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="refunded">Refunded</option>
            </select>
            <button
              onClick={handleStatusUpdate}
              disabled={saving || newStatus === order.status}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <LoadingSpinner size="sm" />}
              Update
            </button>
          </div>
        </div>

        {/* Cancel order */}
        {order.status !== 'cancelled' && order.status !== 'refunded' && (
          <div className="pt-4 border-t border-goose-border">
            <button
              onClick={handleCancel}
              disabled={saving}
              className="w-full px-4 py-2.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving && <LoadingSpinner size="sm" />}
              Cancel Order
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Create new order ──
  return (
    <form onSubmit={handleCreate} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">{error}</div>
      )}

      <h3 className="text-sm font-display font-semibold text-goose-text">Customer</h3>

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
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
      </Field>

      {/* Line items */}
      <div className="pt-4 border-t border-goose-border">
        <h3 className="text-sm font-display font-semibold text-goose-text mb-3">Items</h3>

        {/* Product search */}
        <div className="relative mb-3">
          <input
            type="text"
            value={productSearch}
            onChange={(e) => searchProducts(e.target.value)}
            placeholder="Search products to add..."
            className="input"
          />
          {searchingProducts && (
            <div className="absolute right-3 top-2.5">
              <LoadingSpinner size="sm" />
            </div>
          )}

          {/* Search results dropdown */}
          {productResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-goose-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {productResults.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addLineItem(p)}
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex justify-between items-center"
                >
                  <span className="text-goose-text">{p.name}</span>
                  <span className="text-goose-text-light">${p.price}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Added items */}
        {lineItems.length > 0 ? (
          <div className="border border-goose-border rounded-lg divide-y divide-goose-border">
            {lineItems.map((li) => (
              <div key={li.product_id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex-1 text-sm text-goose-text">{li.product_name}</span>
                <input
                  type="number"
                  min="1"
                  value={li.quantity}
                  onChange={(e) => updateQuantity(li.product_id, parseInt(e.target.value, 10) || 1)}
                  className="w-16 px-2 py-1 border border-goose-border rounded text-sm text-center"
                />
                <button
                  type="button"
                  onClick={() => removeLineItem(li.product_id)}
                  className="p-1 text-goose-text-light hover:text-red-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-goose-text-light text-center py-4">No items added yet. Search for products above.</p>
        )}
      </div>

      <Field label="Order notes">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input" rows={2} placeholder="Optional notes..." />
      </Field>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-goose-border">
        <button
          type="submit"
          disabled={saving || !email.trim() || !firstName.trim() || !lastName.trim() || lineItems.length === 0}
          className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving && <LoadingSpinner size="sm" />}
          Create Order
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
