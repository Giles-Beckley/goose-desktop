import { useState } from 'react';
import { useMcp } from '../hooks/useMcp';
import { MCP_TOOLS } from '../../shared/mcpTools';
import { LoadingSpinner } from './LoadingSpinner';
import type { Product } from '../../shared/types';

interface ProductFormProps {
  product?: Product | null;
  onClose: () => void;
  onSaved: () => void;
}

export function ProductForm({ product, onClose, onSaved }: ProductFormProps) {
  const { callTool } = useMcp();
  const isEdit = !!product;

  const [name, setName] = useState(product?.name ?? '');
  const [sku, setSku] = useState(product?.sku ?? '');
  const [price, setPrice] = useState(product?.price ?? '');
  const [salePrice, setSalePrice] = useState(product?.sale_price ?? '');
  const [stock, setStock] = useState(String(product?.stock ?? product?.stock_quantity ?? '0'));
  const [status, setStatus] = useState(product?.status ?? 'active');
  const [description, setDescription] = useState(product?.description ?? '');
  const [shortDescription, setShortDescription] = useState(product?.short_description ?? '');
  const [weight, setWeight] = useState(product?.weight != null ? String(product.weight) : '');
  const [featured, setFeatured] = useState(product?.featured ?? false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const args: Record<string, unknown> = {
        name: name.trim(),
        status,
        featured,
      };
      if (sku.trim()) args.sku = sku.trim();
      if (price) args.price = parseFloat(price);
      if (salePrice) args.sale_price = parseFloat(salePrice);
      if (stock) args.stock = parseInt(stock, 10);
      if (description.trim()) args.description = description.trim();
      if (shortDescription.trim()) args.short_description = shortDescription.trim();
      if (weight) args.weight = parseFloat(weight);

      if (isEdit) {
        args.product_id = product!.id;
        await callTool(MCP_TOOLS.UPDATE_PRODUCT, args);
      } else {
        await callTool(MCP_TOOLS.CREATE_PRODUCT, args);
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">{error}</div>
      )}

      <Field label="Product name *">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="input"
          placeholder="e.g. Organic Coffee Beans"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="SKU">
          <input type="text" value={sku} onChange={(e) => setSku(e.target.value)} className="input" placeholder="ABC-001" />
        </Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Price">
          <input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className="input" placeholder="0.00" />
        </Field>
        <Field label="Sale price">
          <input type="number" step="0.01" min="0" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} className="input" placeholder="0.00" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Stock quantity">
          <input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} className="input" />
        </Field>
        <Field label="Weight">
          <input type="number" step="0.01" min="0" value={weight} onChange={(e) => setWeight(e.target.value)} className="input" placeholder="kg" />
        </Field>
      </div>

      <Field label="Short description">
        <textarea value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} className="input" rows={2} placeholder="Brief summary..." />
      </Field>

      <Field label="Description">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input" rows={4} placeholder="Full product description..." />
      </Field>

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
        <span className="text-sm text-goose-text">Featured product</span>
      </label>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-goose-border">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving && <LoadingSpinner size="sm" />}
          {isEdit ? 'Update Product' : 'Create Product'}
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
