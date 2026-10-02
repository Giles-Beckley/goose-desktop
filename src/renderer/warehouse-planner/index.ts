/**
 * Goose Warehouse Picking Planner: shared floor-plan editor.
 *
 * Desktop app usage (bundled with the app's own React):
 *
 *   import { WarehousePlanner, createMcpApi } from '<path>/editor/src';
 *   import '<path>/editor/src/styles.css';
 *   const api = useMemo(() => createMcpApi(callTool), [callTool]);
 *   <WarehousePlanner api={api} canManage={canWrite('warehouse')} />
 *
 * WP admin uses the prebuilt bundle (src/wp/entry.tsx) instead.
 */
export { WarehousePlanner } from './components/WarehousePlanner';
export type { WarehousePlannerProps } from './components/WarehousePlanner';
export { LayoutEditor } from './components/LayoutEditor';
export { createMcpApi, createRestApi, PlannerError } from './api';
export type { McpCallTool, McpToolResult, PlannerApi, RestApiConfig, SaveLayoutResult, StoredLocation, WarehouseDetail, WarehouseSummary } from './api';
export * from './model/types';
export { normalizeLayout, validateLayout, startPoint, endPoint } from './model/layout';
export { generateLocations } from './model/locations';
