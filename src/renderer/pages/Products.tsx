import { useEffect, useState } from 'react';
import { useMcp } from '../hooks/useMcp';
import { useProductsStore } from '../stores/productsStore';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { SlideOver } from '../components/SlideOver';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ProductForm } from '../components/ProductForm';
import { Pagination } from '../components/Pagination';
import { MCP_TOOLS } from '../../shared/mcpTools';
import type { Product } from '../../shared/types';

export function Products() {
  const { callTool } = useMcp();
  const { products, loading, error, setProducts, setLoading, setError } = useProductsStore();
  const [search, setSearch] = useState('');

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [slideOpen, setSlideOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const syncProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await callTool(MCP_TOOLS.SEARCH_PRODUCTS, { limit: 100 });
      if (result) {
        const text = result.content?.[0]?.text;
        if (text) {
          const data = JSON.parse(text);
          const items = Array.isArray(data) ? data : data.products ?? [];
          setProducts(items as Product[]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (products.length === 0) syncProducts();
  }, []);

  const openCreate = () => {
    setSelectedProduct(null);
    setSlideOpen(true);
  };

  const openEdit = (product: Product) => {
    setSelectedProduct(product);
    setSlideOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await callTool(MCP_TOOLS.DELETE_PRODUCT, { product_id: deleteTarget.id });
      setDeleteTarget(null);
      syncProducts();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const paginatedProducts = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold text-goose-text">Products</h1>
        <div className="flex gap-2">
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Product
          </button>
          <button
            onClick={syncProducts}
            disabled={loading}
            className="px-4 py-2 bg-gray-100 text-goose-text text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <LoadingSpinner size="sm" />}
            Sync
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-goose-border">
        <div className="px-6 py-4 border-b border-goose-border">
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search products..."
            className="input"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-goose-text-light uppercase tracking-wider">
                <th className="px-6 py-3">Product</th>
                <th className="px-6 py-3">SKU</th>
                <th className="px-6 py-3">Price</th>
                <th className="px-6 py-3">Stock</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-goose-border">
              {loading && products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center"><LoadingSpinner /></td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-goose-text-light text-sm">
                    {products.length === 0 ? 'No products loaded. Click "Sync" to fetch from your store.' : 'No products match your search.'}
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openEdit(p)}>
                    <td className="px-6 py-3 text-sm font-medium text-goose-text">{p.name}</td>
                    <td className="px-6 py-3 text-sm text-goose-text-light">{p.sku || '--'}</td>
                    <td className="px-6 py-3 text-sm text-goose-text">${p.price}</td>
                    <td className="px-6 py-3 text-sm text-goose-text-light">{p.stock_quantity ?? p.stock ?? 'N/A'}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.status === 'active' || p.status === 'publish' ? 'bg-primary-50 text-primary-700' : 'bg-gray-100 text-goose-text-light'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); }}
                        className="p-1 text-goose-text-light hover:text-red-600 rounded transition-colors"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={page}
          totalItems={filtered.length}
          perPage={perPage}
          onPageChange={setPage}
          onPerPageChange={setPerPage}
        />
      </div>

      <SlideOver
        open={slideOpen}
        onClose={() => setSlideOpen(false)}
        title={selectedProduct ? 'Edit Product' : 'Add Product'}
        wide
      >
        <ProductForm
          product={selectedProduct}
          onClose={() => setSlideOpen(false)}
          onSaved={syncProducts}
        />
      </SlideOver>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Product"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        loading={deleting}
      />
    </div>
  );
}
