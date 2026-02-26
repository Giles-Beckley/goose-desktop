import { useEffect, useState } from 'react';
import { useMcp } from '../hooks/useMcp';
import { useCustomersStore } from '../stores/customersStore';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { SlideOver } from '../components/SlideOver';
import { CustomerForm } from '../components/CustomerForm';
import { MCP_TOOLS } from '../../shared/mcpTools';
import type { Customer } from '../../shared/types';

export function Customers() {
  const { callTool } = useMcp();
  const { customers, loading, error, setCustomers, setLoading, setError } = useCustomersStore();
  const [search, setSearch] = useState('');

  const [slideOpen, setSlideOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const syncCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await callTool(MCP_TOOLS.LIST_CUSTOMERS, { limit: 100 });
      if (result) {
        const text = result.content?.[0]?.text;
        if (text) {
          const data = JSON.parse(text);
          const items = Array.isArray(data) ? data : data.customers ?? [];
          setCustomers(items as Customer[]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (customers.length === 0) syncCustomers();
  }, []);

  const openCreate = () => {
    setSelectedCustomer(null);
    setSlideOpen(true);
  };

  const openEdit = (customer: Customer) => {
    setSelectedCustomer(customer);
    setSlideOpen(true);
  };

  const filtered = customers.filter((c) =>
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold text-goose-text">Customers</h1>
        <div className="flex gap-2">
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Customer
          </button>
          <button
            onClick={syncCustomers}
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
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers..."
            className="input"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-goose-text-light uppercase tracking-wider">
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Orders</th>
                <th className="px-6 py-3">Total Spent</th>
                <th className="px-6 py-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-goose-border">
              {loading && customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center"><LoadingSpinner /></td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-goose-text-light text-sm">
                    {customers.length === 0 ? 'No customers loaded. Click "Sync" to fetch from your store.' : 'No customers match your search.'}
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openEdit(c)}>
                    <td className="px-6 py-3 text-sm font-medium text-goose-text">
                      {c.first_name} {c.last_name}
                    </td>
                    <td className="px-6 py-3 text-sm text-goose-text-light">{c.email}</td>
                    <td className="px-6 py-3 text-sm text-goose-text-light">{c.orders_count ?? 0}</td>
                    <td className="px-6 py-3 text-sm font-medium text-goose-text">${c.total_spent ?? '0.00'}</td>
                    <td className="px-6 py-3 text-sm text-goose-text-light">
                      {c.date_created ? new Date(c.date_created).toLocaleDateString() : '--'}
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
        title={selectedCustomer ? 'Edit Customer' : 'Add Customer'}
      >
        <CustomerForm
          customer={selectedCustomer}
          onClose={() => setSlideOpen(false)}
          onSaved={syncCustomers}
        />
      </SlideOver>
    </div>
  );
}
