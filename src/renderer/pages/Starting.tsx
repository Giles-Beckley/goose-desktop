import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConnectionStore } from '../stores/connectionStore';
import { McpClient } from '../services/mcpClient';
import { MCP_RESOURCES } from '../../shared/mcpTools';
import { formatCurrency, DEFAULT_CURRENCY } from '../../shared/currency';
import type { Currency } from '../../shared/currency';
import { LoadingSpinner } from '../components/LoadingSpinner';
import type { SiteConnection, SiteOverview } from '../../shared/types';

/**
 * Multisite overview ("Starting"). One card per connected site, each probed
 * independently so a slow or unreachable site shows 'offline' without blocking
 * the others. Clicking a card makes that site active and drops into the normal
 * Dashboard for it.
 */
export function Starting() {
  const navigate = useNavigate();
  const { sites, activeSiteId, setActiveSite } = useConnectionStore();
  const [overviews, setOverviews] = useState<Record<string, SiteOverview>>({});
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    // Each site resolves on its own; we merge results as they arrive so one
    // slow site never holds up the rest.
    await Promise.all(
      sites.map(async (site) => {
        const overview = await fetchOverview(site);
        setOverviews((prev) => ({ ...prev, [site.id]: overview }));
      }),
    );
    setLoading(false);
  }, [sites]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleOpen = (site: SiteConnection) => {
    setActiveSite(site.id);
    void window.electronAPI.sites.setActive(site.id);
    navigate('/');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-goose-text">Sites</h1>
          <p className="text-sm text-goose-text-light mt-0.5">{sites.length} connected sites — select one to manage it.</p>
        </div>
        <button
          onClick={() => void refresh()}
          disabled={loading}
          className="px-4 py-2 bg-gray-100 text-goose-text text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {loading && <LoadingSpinner size="sm" />}
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sites.map((site) => (
          <SiteCard
            key={site.id}
            site={site}
            overview={overviews[site.id]}
            isActive={site.id === activeSiteId}
            onOpen={() => handleOpen(site)}
          />
        ))}
      </div>
    </div>
  );
}

function SiteCard({
  site,
  overview,
  isActive,
  onOpen,
}: {
  site: SiteConnection;
  overview: SiteOverview | undefined;
  isActive: boolean;
  onOpen: () => void;
}) {
  const health = overview?.health;
  const dot =
    health === 'online' ? 'bg-green-500'
    : health === 'offline' || health === 'error' ? 'bg-red-500'
    : 'bg-gray-300';
  const healthLabel =
    health === 'online' ? 'Online'
    : health === 'offline' ? 'Offline'
    : health === 'error' ? 'Error'
    : 'Checking…';

  const pendingOrders = overview?.pending?.pendingOrders ?? null;
  const hasAttention = pendingOrders != null && pendingOrders > 0;

  return (
    <button
      onClick={onOpen}
      className={`text-left bg-white rounded-xl border p-5 transition-shadow hover:shadow-md ${
        isActive ? 'border-primary-400 ring-1 ring-primary-200' : 'border-goose-border'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <h2 className="text-base font-display font-semibold text-goose-text truncate">{site.label}</h2>
          <p className="text-xs text-goose-text-light truncate">{site.siteUrl}</p>
        </div>
        {isActive && (
          <span className="shrink-0 ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-700">Connected</span>
        )}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        <span className="text-sm text-goose-text-light">{healthLabel}</span>
        {overview?.error && (
          <span className="text-xs text-red-500 truncate">— {overview.error}</span>
        )}
      </div>

      {overview && (overview.health === 'online') ? (
        <>
          <div className="grid grid-cols-3 gap-2 border-t border-goose-border pt-3">
            <Metric label="Products" value={fmtCount(overview.metrics?.productCount)} />
            <Metric label="Recent orders" value={fmtCount(overview.metrics?.recentOrders)} />
            <Metric
              label="Revenue"
              value={overview.metrics?.revenue == null ? '--' : formatCurrency(overview.metrics.revenue, overview.currency ?? DEFAULT_CURRENCY)}
            />
          </div>
          {hasAttention && (
            <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-amber-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {pendingOrders} pending order{pendingOrders === 1 ? '' : 's'}
            </div>
          )}
        </>
      ) : (
        <div className="border-t border-goose-border pt-3 text-xs text-goose-text-light">
          {overview ? 'Metrics unavailable while offline.' : 'Loading metrics…'}
        </div>
      )}
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-goose-text-light">{label}</p>
      <p className="text-lg font-display font-bold text-goose-text">{value}</p>
    </div>
  );
}

function fmtCount(n: number | null | undefined): string {
  return n == null ? '--' : String(n);
}

/**
 * Probe a single site for its overview snapshot. Health first (a failed
 * initialize => offline); metrics/pending are best-effort and absent on error.
 */
async function fetchOverview(site: SiteConnection): Promise<SiteOverview> {
  const lastChecked = new Date().toISOString();
  const client = new McpClient(site.siteUrl, site.apiKey);

  let online = false;
  try {
    online = await client.testConnection();
  } catch {
    online = false;
  }

  if (!online) {
    return { id: site.id, health: 'offline', lastChecked };
  }

  let productCount: number | null = null;
  let recentOrders: number | null = null;
  let revenue: number | null = null;
  let pendingOrders: number | null = null;
  let currency: Currency | undefined;

  try {
    const settings = await client.getStoreSettings();
    if (settings.currency) currency = settings.currency;
  } catch { /* fall back to default currency */ }

  try {
    const productsResult = await client.readResource(MCP_RESOURCES.PRODUCT_CATALOG);
    const text = productsResult?.content?.[0]?.text;
    if (text) {
      const data = JSON.parse(text);
      const products = Array.isArray(data) ? data : data.products ?? [];
      productCount = Number(data.total ?? products.length);
    }
  } catch { /* leave null */ }

  try {
    const ordersResult = await client.readResource(MCP_RESOURCES.ORDER_RECENT);
    const text = ordersResult?.content?.[0]?.text;
    if (text) {
      const data = JSON.parse(text);
      const orders: Array<{ total_amount: number; status: string }> =
        Array.isArray(data) ? data : data.orders ?? [];
      recentOrders = Number(data.count ?? orders.length);
      revenue = orders.reduce((sum, o) => sum + (o.total_amount ?? 0), 0);
      pendingOrders = orders.filter((o) => o.status === 'pending' || o.status === 'on-hold').length;
    }
  } catch { /* leave null */ }

  return {
    id: site.id,
    health: 'online',
    lastChecked,
    currency,
    metrics: { productCount, recentOrders, revenue },
    pending: { pendingOrders },
  };
}
