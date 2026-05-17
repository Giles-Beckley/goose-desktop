import { useEffect, useState } from 'react';
import { useMcp } from '../hooks/useMcp';
import { useConnectionStore } from '../stores/connectionStore';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { SlideOver } from '../components/SlideOver';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { OutletForm } from '../components/OutletForm';
import { Pagination } from '../components/Pagination';
import { MCP_TOOLS } from '../../shared/mcpTools';
import type { Outlet } from '../../shared/types';

const STATUS_FILTERS: Array<'any' | 'active' | 'inactive'> = ['any', 'active', 'inactive'];

export function Locations() {
  const { callTool } = useMcp();
  const { locationsEnabled } = useConnectionStore();

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'any' | 'active' | 'inactive'>('any');
  const [countryFilter, setCountryFilter] = useState('');
  const [search, setSearch] = useState('');

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  const [slideOpen, setSlideOpen] = useState(false);
  const [selected, setSelected] = useState<Outlet | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Outlet | null>(null);
  const [deleting, setDeleting] = useState(false);

  const syncOutlets = async () => {
    setLoading(true);
    setError(null);
    try {
      const args: Record<string, unknown> = { status: statusFilter, limit: 500 };
      if (countryFilter.trim()) args.country = countryFilter.trim().toUpperCase().slice(0, 2);
      const result = await callTool(MCP_TOOLS.LIST_OUTLETS, args);
      const text = result?.content?.[0]?.text;
      if (text) {
        const data = JSON.parse(text);
        if (data?.success === false) {
          setError(data.message ?? data.error ?? 'Failed to fetch outlets');
          setOutlets([]);
        } else {
          setOutlets(data.outlets ?? []);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch outlets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (locationsEnabled === false) return;
    syncOutlets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, countryFilter, locationsEnabled]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await callTool(MCP_TOOLS.DELETE_OUTLET, { outlet_id: deleteTarget.id });
      const text = res?.content?.[0]?.text;
      if (text) {
        const data = JSON.parse(text);
        if (data?.success === false) {
          setError(data.message ?? data.error ?? 'Failed to delete outlet');
        }
      }
      setDeleteTarget(null);
      syncOutlets();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  const openCreate = () => {
    setSelected(null);
    setSlideOpen(true);
  };

  const openEdit = (outlet: Outlet) => {
    setSelected(outlet);
    setSlideOpen(true);
  };

  // Client-side search on name/city/country (server gives no text-search filter)
  const filtered = outlets.filter((o) => {
    if (!search.trim()) return true;
    const needle = search.toLowerCase();
    return (
      o.name.toLowerCase().includes(needle) ||
      o.city?.toLowerCase().includes(needle) ||
      o.country?.toLowerCase().includes(needle) ||
      o.slug?.toLowerCase().includes(needle)
    );
  });

  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  if (locationsEnabled === false) {
    // The sidebar hides this route, but just in case someone hits the URL:
    return (
      <div>
        <h1 className="text-2xl font-display font-bold text-goose-text mb-3">Locations</h1>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
          The <strong>Locations</strong> premium component isn't activated on this store. Enable it from your WordPress admin to manage outlets.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold text-goose-text">Locations</h1>
        <div className="flex gap-2">
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Outlet
          </button>
          <button
            onClick={syncOutlets}
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
        <div className="px-6 py-4 border-b border-goose-border flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, city, country..."
            className="input flex-1 min-w-[200px]"
          />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as 'any' | 'active' | 'inactive'); setPage(1); }}
            className="input w-32"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>{s === 'any' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <input
            type="text"
            value={countryFilter}
            onChange={(e) => { setCountryFilter(e.target.value.toUpperCase().slice(0, 2)); setPage(1); }}
            placeholder="Country (GB)"
            className="input w-28 uppercase"
            maxLength={2}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-goose-text-light uppercase tracking-wider">
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">City</th>
                <th className="px-6 py-3">Country</th>
                <th className="px-6 py-3">Coords</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-goose-border">
              {loading && outlets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center"><LoadingSpinner /></td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-goose-text-light text-sm">
                    {outlets.length === 0 ? 'No outlets yet. Click "Add Outlet" to create one.' : 'No outlets match your filters.'}
                  </td>
                </tr>
              ) : (
                paginated.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openEdit(o)}>
                    <td className="px-6 py-3 text-sm font-medium text-goose-text">{o.name}</td>
                    <td className="px-6 py-3 text-sm text-goose-text-light">{o.city ?? '--'}</td>
                    <td className="px-6 py-3 text-sm text-goose-text-light">{o.country ?? '--'}</td>
                    <td className="px-6 py-3 text-xs text-goose-text-light">
                      {o.lat != null && o.lng != null ? `${Number(o.lat).toFixed(3)}, ${Number(o.lng).toFixed(3)}` : 'no coords'}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        o.status === 'active' ? 'bg-primary-50 text-primary-700' : 'bg-gray-100 text-goose-text-light'
                      }`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(o); }}
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
        title={selected ? `Edit Outlet: ${selected.name}` : 'Add Outlet'}
      >
        <OutletForm
          key={selected?.id ?? 'new'}
          outlet={selected}
          onClose={() => setSlideOpen(false)}
          onSaved={syncOutlets}
        />
      </SlideOver>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Outlet"
        message={`Delete "${deleteTarget?.name}"? This also removes all product links to this outlet. The action cannot be undone.`}
        loading={deleting}
      />
    </div>
  );
}
