import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { useMcp } from '../hooks/useMcp';
import { useAccess } from '../hooks/useAccess';
import { useConnectionStore } from '../stores/connectionStore';
import { WarehousePlanner, createMcpApi } from '../warehouse-planner';
import '../warehouse-planner/styles.css';

/**
 * Warehouse Picking Planner floor-plan editor. The editor itself is a synced
 * copy of the planner repo's shared package (see warehouse-planner/README.md);
 * this page only supplies the MCP transport, the access gate and the height.
 */
export function Warehouse() {
  const { callTool } = useMcp();
  const { canWrite } = useAccess();
  const { warehouseEnabled } = useConnectionStore();

  const api = useMemo(
    () =>
      createMcpApi(async (name, args) => {
        try {
          // quiet: the editor shows its own errors, not the global status.
          return await callTool(name, args, { quiet: true, rethrow: true });
        } catch (error) {
          // Core throws access/transport problems as JSON-RPC errors (e.g.
          // "access_denied: …"). Hand the text to createMcpApi, which turns
          // it into a PlannerError with that code.
          return { content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }] };
        }
      }),
    [callTool],
  );

  if (warehouseEnabled === false) {
    // The sidebar hides this route, but just in case someone hits the URL:
    return (
      <div>
        <h1 className="text-2xl font-display font-bold text-goose-text mb-3">Warehouse</h1>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
          The <strong>Warehouse Picking Planner</strong> premium component isn't activated on this store. Enable it from your WordPress admin to plan your warehouse.
        </div>
      </div>
    );
  }

  // The editor fills whatever height it's given via --gwpp-height; give it
  // the whole content area so the canvas, not the page, does the scrolling.
  return (
    <div className="h-full" style={{ ['--gwpp-height' as string]: '100%' } as CSSProperties}>
      <WarehousePlanner api={api} canManage={canWrite('warehouse')} />
    </div>
  );
}
