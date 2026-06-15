import { useEffect, useState } from 'react';
import { useMcp } from '../hooks/useMcp';
import { useAccess } from '../hooks/useAccess';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { MCP_TOOLS, MCP_RESOURCES } from '../../shared/mcpTools';

interface ExportBatch {
  id: number;
  batch_number: string;
  date_range: { from: string; to: string };
  order_count: number;
  refund_count: number;
  totals: {
    sales: number;
    refunds: number;
    tax: number;
    shipping: number;
    net: number;
  };
  format: string;
  has_file: boolean;
  created_by?: string;
  created_at: string;
}

interface PreviewData {
  unexported_count: number;
  totals: {
    order_count: number;
    refund_count: number;
    total_sales: number;
    total_refunds: number;
    total_tax: number;
    total_shipping: number;
    net_total: number;
  };
}

export function Exports() {
  const { readResource, callTool } = useMcp();
  const { canWrite } = useAccess();
  // export_transactions is a write op; download_export / preview are reads.
  const writable = canWrite('export');

  // Export history
  const [batches, setBatches] = useState<ExportBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [batchError, setBatchError] = useState<string | null>(null);

  // New export form
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [notes, setNotes] = useState('');

  // Preview
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Export action
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<{ batch_number: string; batch_id?: number } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);



  const loadBatches = async () => {
    setLoadingBatches(true);
    setBatchError(null);
    try {
      const result = await readResource(MCP_RESOURCES.EXPORT_BATCHES);
      if (result) {
        const text = result.content?.[0]?.text;
        if (text) {
          const data = JSON.parse(text);
          const items = Array.isArray(data) ? data : data.batches ?? [];
          setBatches(items);
        }
      }
    } catch (err) {
      setBatchError(err instanceof Error ? err.message : 'Failed to load export history');
    } finally {
      setLoadingBatches(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  const handlePreview = async () => {
    if (!dateFrom || !dateTo) return;
    setLoadingPreview(true);
    setPreview(null);
    setExportSuccess(null);
    setExportError(null);
    try {
      const result = await callTool(MCP_TOOLS.GET_UNEXPORTED_ORDERS_PREVIEW, {
        date_from: dateFrom,
        date_to: dateTo,
      });
      if (result) {
        const text = result.content?.[0]?.text;
        if (text) {
          const data = JSON.parse(text);
          setPreview(data);
        }
      }
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Failed to load preview');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleExport = async () => {
    if (!dateFrom || !dateTo) return;
    setExporting(true);
    setExportSuccess(null);
    setExportError(null);
    try {
      const args: Record<string, unknown> = {
        date_from: dateFrom,
        date_to: dateTo,
        format,
      };
      if (notes.trim()) args.notes = notes.trim();

      const result = await callTool(MCP_TOOLS.EXPORT_TRANSACTIONS, args);
      if (result) {
        const text = result.content?.[0]?.text;
        if (text) {
          const data = JSON.parse(text);
          if (data.error) {
            setExportError(data.error);
          } else {
            setExportSuccess({
              batch_number: data.batch_number ?? data.batch?.batch_number ?? '',
              batch_id: data.batch_id ?? data.batch?.id,
            });
            setPreview(null);
            setNotes('');
            loadBatches();
          }
        }
      }
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleDownload = async (batchId: number) => {
    setDownloading(true);
    try {
      const result = await callTool(MCP_TOOLS.DOWNLOAD_EXPORT, { batch_id: batchId });
      if (result) {
        const text = result.content?.[0]?.text;
        if (text) {
          const data = JSON.parse(text);
          if (data.success && data.content) {
            await window.electronAPI.dialog.saveFile(data.filename, data.content);
          } else {
            setExportError(data.error ?? 'Download failed');
          }
        }
      }
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-display font-bold text-goose-text mb-6">Exports</h1>

      {/* New Export Card — creating an export writes a batch (export_transactions),
          so it's hidden for read-only export keys. History/download remain. */}
      {writable && (
      <div className="bg-white rounded-xl border border-goose-border p-6 mb-8">
        <h2 className="text-lg font-semibold text-goose-text mb-4">New Export</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {/* Date From */}
          <div>
            <label className="block text-sm font-medium text-goose-text mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="input"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-sm font-medium text-goose-text mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="input"
            />
          </div>

          {/* Format */}
          <div>
            <label className="block text-sm font-medium text-goose-text mb-1">Format</label>
            <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: '#E2E8F0' }}>
              <button
                onClick={() => setFormat('csv')}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  format === 'csv'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-goose-text hover:bg-gray-50'
                }`}
              >
                CSV
              </button>
              <button
                onClick={() => setFormat('json')}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  format === 'json'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-goose-text hover:bg-gray-50'
                }`}
              >
                JSON
              </button>
            </div>
          </div>

          {/* Preview button */}
          <div className="flex items-end">
            <button
              onClick={handlePreview}
              disabled={!dateFrom || !dateTo || loadingPreview}
              className="w-full px-4 py-2 text-sm font-medium rounded-lg border border-goose-border text-goose-text hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loadingPreview ? 'Loading...' : 'Preview'}
            </button>
          </div>
        </div>

        {/* Notes */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-goose-text mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="e.g. Q4 2025 export for accountant"
            className="input resize-none"
          />
        </div>

        {/* Preview Results */}
        {preview && (
          <div className="bg-primary-50 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-semibold text-primary-800 mb-2">Export Preview</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
              <div>
                <p className="text-primary-600">Orders</p>
                <p className="font-semibold text-primary-900">{preview.totals.order_count}</p>
              </div>
              <div>
                <p className="text-primary-600">Total Sales</p>
                <p className="font-semibold text-primary-900">&pound;{(preview.totals.total_sales ?? 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-primary-600">Refunds</p>
                <p className="font-semibold text-primary-900">&pound;{(preview.totals.total_refunds ?? 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-primary-600">Tax</p>
                <p className="font-semibold text-primary-900">&pound;{(preview.totals.total_tax ?? 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-primary-600">Net Total</p>
                <p className="font-semibold text-primary-900">&pound;{(preview.totals.net_total ?? 0).toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Success */}
        {exportSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-green-800">
              Export created successfully — <span className="font-semibold">{exportSuccess.batch_number}</span>
            </p>
            {exportSuccess.batch_id && (
              <button
                onClick={() => handleDownload(exportSuccess.batch_id!)}
                disabled={downloading}
                className="text-sm text-green-700 underline mt-1 inline-block disabled:opacity-50"
              >
                {downloading ? 'Downloading...' : 'Download file'}
              </button>
            )}
          </div>
        )}

        {/* Error */}
        {exportError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-red-800">{exportError}</p>
          </div>
        )}

        {/* Export button */}
        <button
          onClick={handleExport}
          disabled={!dateFrom || !dateTo || exporting}
          className="px-6 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {exporting ? 'Exporting...' : 'Export Transactions'}
        </button>
      </div>
      )}

      {/* Export History */}
      <div className="bg-white rounded-xl border border-goose-border">
        <div className="px-6 py-4 border-b border-goose-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-goose-text">Export History</h2>
          <button
            onClick={loadBatches}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Refresh
          </button>
        </div>

        {loadingBatches ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : batchError ? (
          <div className="px-6 py-12 text-center text-red-600 text-sm">{batchError}</div>
        ) : batches.length === 0 ? (
          <div className="px-6 py-12 text-center text-goose-text-light text-sm">
            No exports yet. Create your first export above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-goose-border text-left text-goose-text-light">
                  <th className="px-6 py-3 font-medium">Batch #</th>
                  <th className="px-6 py-3 font-medium">Date Range</th>
                  <th className="px-6 py-3 font-medium">Orders</th>
                  <th className="px-6 py-3 font-medium">Net Total</th>
                  <th className="px-6 py-3 font-medium">Format</th>
                  <th className="px-6 py-3 font-medium">Created</th>
                  <th className="px-6 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.id} className="border-b border-goose-border last:border-0 hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-goose-text">{batch.batch_number}</td>
                    <td className="px-6 py-3 text-goose-text">
                      {batch.date_range?.from ?? '--'} &mdash; {batch.date_range?.to ?? '--'}
                    </td>
                    <td className="px-6 py-3 text-goose-text">{batch.order_count}</td>
                    <td className="px-6 py-3 text-goose-text">&pound;{(batch.totals?.net ?? 0).toFixed(2)}</td>
                    <td className="px-6 py-3">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 uppercase">
                        {batch.format}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-goose-text-light">
                      {batch.created_at ? new Date(batch.created_at).toLocaleDateString() : '--'}
                    </td>
                    <td className="px-6 py-3">
                      <button
                        onClick={() => handleDownload(batch.id)}
                        disabled={downloading}
                        className="text-xs text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50"
                      >
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
