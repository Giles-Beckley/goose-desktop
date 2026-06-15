/**
 * Access Group helpers — interpret the ggmcAccess block from `initialize`
 * (or the `whoami` tool) and answer "can this key read/write this domain?".
 *
 * The store is the final authority; the app uses these only to shape the UI.
 * Always still handle an `access_denied:`-prefixed error at call time — group
 * membership can change between calls.
 */
import type { AccessDomain, AccessLevel, GgmcAccess } from './types';

const LEVEL_RANK: Record<AccessLevel, number> = { none: 0, read: 1, write: 2 };

/**
 * Resolve the effective level for a domain from a ggmcAccess block.
 * - No access block yet (null) => assume 'write' so the UI doesn't flicker
 *   away before initialize resolves; call sites re-gate once access loads.
 * - Unrestricted key (restricted === false) => every domain is 'write'.
 * - Restricted key => the explicit level, or 'none' if the domain is missing.
 */
export function levelForDomain(
  access: GgmcAccess | null,
  domain: AccessDomain,
): AccessLevel {
  if (!access) return 'write';
  if (!access.restricted) return 'write';
  return access.domains?.[domain] ?? 'none';
}

/** True if the key may perform an operation of `need` on `domain`. */
export function can(
  access: GgmcAccess | null,
  domain: AccessDomain,
  need: AccessLevel,
): boolean {
  return LEVEL_RANK[levelForDomain(access, domain)] >= LEVEL_RANK[need];
}

/** Convenience: domain is at least readable (read or write). */
export function canRead(access: GgmcAccess | null, domain: AccessDomain): boolean {
  return can(access, domain, 'read');
}

/** Convenience: domain is writable. */
export function canWrite(access: GgmcAccess | null, domain: AccessDomain): boolean {
  return can(access, domain, 'write');
}

/**
 * Detect a store-side access-denial. The server prefixes these errors with
 * `access_denied:` (see docs/mcp-access-contract.md). Matched on the message
 * text since errors surface as plain Error instances through the MCP proxy.
 */
export function isAccessDenied(error: unknown): boolean {
  const msg =
    error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return /(^|\b)access_denied:/i.test(msg);
}

/**
 * Pull the ggmcAccess block out of an `initialize` result or a `whoami` tool
 * payload. `initialize` carries it at result.ggmcAccess; `whoami` returns
 * `{ success, access: {...} }`. Returns null if neither shape is present.
 */
export function extractAccess(raw: unknown): GgmcAccess | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const candidate =
    (obj.ggmcAccess as unknown) ?? (obj.access as unknown) ?? null;
  if (!candidate || typeof candidate !== 'object') return null;
  const block = candidate as Record<string, unknown>;
  if (typeof block.restricted !== 'boolean') return null;
  return {
    group_name: typeof block.group_name === 'string' ? block.group_name : undefined,
    restricted: block.restricted,
    domains:
      block.domains && typeof block.domains === 'object'
        ? (block.domains as GgmcAccess['domains'])
        : undefined,
  };
}
