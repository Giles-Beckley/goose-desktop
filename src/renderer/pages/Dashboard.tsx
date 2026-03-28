import { useEffect, useState } from 'react';
import { useMcp } from '../hooks/useMcp';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { MCP_RESOURCES } from '../../shared/mcpTools';

export function Dashboard() {
  const { readResource } = useMcp();
  const [totalProducts, setTotalProducts] = useState<string>('--');
  const [totalOrders, setTotalOrders] = useState<string>('--');
  const [revenue, setRevenue] = useState<string>('--');
  const [recentOrders, setRecentOrders] = useState<Array<{ id: number; total: string; status: string; customer: string }>>([]);
  const [loading, setLoading] = useState(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch products count via resource
      const productsResult = await readResource(MCP_RESOURCES.PRODUCT_CATALOG);
      if (productsResult) {
        const text = productsResult.content?.[0]?.text;
        if (text) {
          try {
            const data = JSON.parse(text);
            const products = Array.isArray(data) ? data : data.products ?? [];
            setTotalProducts(String(data.total ?? products.length));
          } catch { /* non-JSON response */ }
        }
      }

      // Fetch recent orders via resource
      const ordersResult = await readResource(MCP_RESOURCES.ORDER_RECENT);
      if (ordersResult) {
        const text = ordersResult.content?.[0]?.text;
        if (text) {
          try {
            const data = JSON.parse(text);
            const orders = Array.isArray(data) ? data : data.orders ?? [];
            setTotalOrders(String(data.count ?? orders.length));

            const totalRev = orders.reduce((sum: number, o: { total_amount: number }) => sum + o.total_amount, 0);
            setRevenue(`$${totalRev.toFixed(2)}`);

            setRecentOrders(
              orders.slice(0, 5).map((o: { id: number; total_amount: number; status: string; customer_first_name?: string; customer_last_name?: string; customer_email?: string }) => ({
                id: o.id,
                total: o.total_amount.toFixed(2),
                status: o.status,
                customer: o.customer_first_name
                  ? `${o.customer_first_name} ${o.customer_last_name ?? ''}`.trim()
                  : o.customer_email ?? 'Guest',
              }))
            );
          } catch { /* non-JSON response */ }
        }
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold text-goose-text">Dashboard</h1>
        <button
          onClick={fetchDashboardData}
          disabled={loading}
          className="px-4 py-2 bg-gray-100 text-goose-text text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {loading && <LoadingSpinner size="sm" />}
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard title="Total Products" value={totalProducts} icon={<ProductIcon />} />
        <StatCard title="Total Orders" value={totalOrders} icon={<OrderIcon />} />
        <StatCard title="Revenue" value={revenue} icon={<RevenueIcon />} />
      </div>

      <div className="bg-white rounded-xl border border-goose-border p-6">
        <h2 className="text-lg font-display font-semibold text-goose-text mb-4">Recent Orders</h2>
        {recentOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-medium text-goose-text-light uppercase tracking-wider">
                  <th className="pb-3">Order</th>
                  <th className="pb-3">Customer</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-goose-border">
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="py-2.5 text-sm font-medium text-goose-text">#{order.id}</td>
                    <td className="py-2.5 text-sm text-goose-text-light">{order.customer}</td>
                    <td className="py-2.5">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="py-2.5 text-sm font-medium text-goose-text">${order.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-goose-text-light text-sm py-8 text-center">
            {loading ? <LoadingSpinner /> : 'No recent orders found.'}
          </div>
        )}
      </div>
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

function StatCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-goose-border p-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-goose-text-light">{title}</span>
        <span className="text-primary-400">{icon}</span>
      </div>
      <p className="text-3xl font-display font-bold text-goose-text">{value}</p>
    </div>
  );
}

function ProductIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

function OrderIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}

function RevenueIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
