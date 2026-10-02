/**
 * The editor talks to the planner through one function: api(operation, args).
 * Each host supplies its own transport:
 *
 * - WP admin:    createRestApi() -> gwpp/v1/ops/{operation} (cookie + nonce)
 * - Desktop app: createMcpApi()  -> the Goose Commerce MCP tool of the same name
 *
 * Operation names and argument/result shapes are identical in both (they
 * come from GWPP_Operations on the server), so components never need to know
 * which host they are running in. Failures always surface as PlannerError
 * with the server's machine code (e.g. layout_conflict, license_inactive).
 */

import type { Layout, ValidationIssue } from './model/types';

export type PlannerApi = <T = unknown>(operation: string, args?: Record<string, unknown>) => Promise<T>;

export class PlannerError extends Error {
  readonly code: string;
  readonly status: number;
  readonly data: Record<string, unknown>;

  constructor(code: string, message: string, status = 0, data: Record<string, unknown> = {}) {
    super(message);
    this.name = 'PlannerError';
    this.code = code;
    this.status = status;
    this.data = data;
  }
}

export interface RestApiConfig {
  /** e.g. https://shop.example/wp-json/gwpp/v1/ops/ */
  restBase: string;
  /** wp_rest nonce. */
  nonce: string;
  fetchImpl?: typeof fetch;
}

export function createRestApi({ restBase, nonce, fetchImpl }: RestApiConfig): PlannerApi {
  const doFetch = fetchImpl ?? fetch.bind(globalThis);
  const base = restBase.endsWith('/') ? restBase : `${restBase}/`;

  return async <T,>(operation: string, args: Record<string, unknown> = {}) => {
    let response: Response;
    try {
      response = await doFetch(base + encodeURIComponent(operation), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': nonce },
        body: JSON.stringify(args),
      });
    } catch (error) {
      throw new PlannerError('network_error', 'Could not reach the server. Check your connection and try again.');
    }

    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok || !body) {
      const data = (body?.data as Record<string, unknown>) ?? {};
      throw new PlannerError(
        String(body?.code ?? 'request_failed'),
        String(body?.message ?? `The server returned an error (${response.status}).`),
        response.status,
        data,
      );
    }
    return body as T;
  };
}

/** Shape of an MCP tools/call result, as the desktop app's useMcp().callTool returns it. */
export interface McpToolResult {
  content?: Array<{ type: string; text?: string }>;
}

export type McpCallTool = (name: string, args: Record<string, unknown>) => Promise<McpToolResult | null | undefined>;

export function createMcpApi(callTool: McpCallTool): PlannerApi {
  return async <T,>(operation: string, args: Record<string, unknown> = {}) => {
    const result = await callTool(operation, args);
    const text = result?.content?.[0]?.text;
    if (!text) {
      throw new PlannerError('request_failed', 'The store did not respond. Check the connection and try again.');
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      // Core reports access/transport problems as plain text, e.g. "access_denied: ...".
      const code = /^([a-z_]+):/.exec(text)?.[1] ?? 'request_failed';
      throw new PlannerError(code, text);
    }

    if (body.success === false) {
      throw new PlannerError(String(body.error ?? 'request_failed'), String(body.message ?? 'The request failed.'), 0, (body.data as Record<string, unknown>) ?? {});
    }
    return body as T;
  };
}

// ---------------------------------------------------------------------------
// Result shapes (see GWPP_Service)
// ---------------------------------------------------------------------------

export interface WarehouseSummary {
  id: number;
  name: string;
  status: 'active' | 'archived';
  layout_revision: number;
  updated_at: string;
  location_count: number;
  assignment_count: number;
}

export interface WarehouseSettings {
  walk_speed_mps: number;
  seconds_per_line: number;
}

export interface StoredLocation {
  id: number;
  warehouse_id: number;
  slot_key: string;
  element_id: string;
  code: string;
  bay: number;
  level: number;
  active: boolean;
  assignment_count: number;
}

export interface WarehouseDetail {
  warehouse: {
    id: number;
    name: string;
    status: 'active' | 'archived';
    layout_revision: number;
    settings: WarehouseSettings;
    updated_at: string;
  };
  layout: Layout;
  validation: ValidationIssue[];
  locations: StoredLocation[];
}

export interface SaveLayoutResult extends WarehouseDetail {
  sync: { created: number; updated: number; deactivated: number; deleted: number };
}
