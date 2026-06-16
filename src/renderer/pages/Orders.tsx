import { useEffect, useState } from 'react';
import { useMcp } from '../hooks/useMcp';
import { useAccess } from '../hooks/useAccess';
import { useOrdersStore } from '../stores/ordersStore';
import { useConnectionStore } from '../stores/connectionStore';
import { formatCurrency } from '../../shared/currency';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { SlideOver } from '../components/SlideOver';
import { OrderForm } from '../components/OrderForm';
import { Pagination } from '../components/Pagination';
import { MCP_RESOURCES } from '../../shared/mcpTools';
import type { Order } from '../../shared/types';

export function Orders() {
  const { readResource } = useMcp();
  const { canWrite } = useAccess();
  const writable = canWrite('order');
  const { orders, loading, error, setOrders, setLoading, setError } = useOrdersStore();
  const currency = useConnectionStore((s) => s.currency);
  const [filter, setFilter] = useState('all');

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [slideOpen, setSlideOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const syncOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await readResource(MCP_RESOURCES.ORDER_LIST);
      if (result) {
        const text = result.content?.[0]?.text;
        if (text) {
          const data = JSON.parse(text);
          const items = Array.isArray(data) ? data : data.orders ?? [];
          setOrders(items as Order[]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orders.length === 0) syncOrders();
  }, []);

  const openCreate = () => {
    setSelectedOrder(null);
    setSlideOpen(true);
  };

  const openView = (order: Order) => {
    setSelectedOrder(order);
    setSlideOpen(true);
  };

  const filtered = filter === 'all' ? orders : orders.filter((o) => o.status === filter);
  const paginatedOrders = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold text-goose-text">Orders</h1>
        <div className="flex gap-2">
          {writable && (
            <button
              onClick={openCreate}
              className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Order
            </button>
          )}
          <button
            onClick={syncOrders}
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
        <div className="px-6 py-4 border-b border-goose-border flex gap-2">
          {['all', 'pending', 'processing', 'completed', 'cancelled'].map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                filter === f ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-goose-text-light hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1).replace('-', ' ')}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-goose-text-light uppercase tracking-wider">
                <th className="px-6 py-3">Order</th>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-goose-border">
              {loading && orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center"><LoadingSpinner /></td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-goose-text-light text-sm">
                    {orders.length === 0 ? 'No orders loaded. Click "Sync" to fetch from your store.' : 'No orders match this filter.'}
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openView(o)}>
                    <td className="px-6 py-3 text-sm font-medium text-goose-text">#{o.order_number ?? o.id}</td>
                    <td className="px-6 py-3 text-sm text-goose-text-light">
                      {o.customer_first_name ? `${o.customer_first_name} ${o.customer_last_name ?? ''}`.trim() : o.customer_email ?? 'Guest'}
                    </td>
                    <td className="px-6 py-3 text-sm text-goose-text-light">
                      {o.created_at ? new Date(o.created_at).toLocaleDateString() : '--'}
                    </td>
                    <td className="px-6 py-3">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="px-6 py-3 text-sm font-medium text-goose-text">
                      {formatCurrency(o.total_amount, currency)}
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
        title={selectedOrder ? `Order #${selectedOrder.order_number ?? selectedOrder.id}` : 'New Order'}
        wide
      >
        <OrderForm
          order={selectedOrder}
          onClose={() => setSlideOpen(false)}
          onSaved={syncOrders}
          readOnly={!writable}
        />
      </SlideOver>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    processing: 'bg-blue-100 text-blue-700',
    completed: 'bg-primary-50 text-primary-700',
    'on-hold': 'bg-yellow-100 text-yellow-700',
    pending: 'bg-gray-100 text-goose-text-light',
    cancelled: 'bg-red-100 text-red-700',
    refunded: 'bg-purple-100 text-purple-700',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] ?? 'bg-gray-100 text-goose-text-light'}`}>
      {status}
    </span>
  );
}
