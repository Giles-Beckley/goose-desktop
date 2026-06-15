import { useMemo } from 'react';
import { useConnectionStore } from '../stores/connectionStore';
import { canRead, canWrite, levelForDomain } from '../../shared/access';
import type { AccessDomain, AccessLevel } from '../../shared/types';

/**
 * Read-side helpers for the active key's Access Group. Pages call these to
 * gate write controls (hide them when the domain is read-only) and whole
 * features (hide them when the domain is 'none'). The store remains the final
 * authority — call sites must still handle `access_denied:` errors at runtime.
 */
export function useAccess() {
  const access = useConnectionStore((s) => s.access);

  return useMemo(
    () => ({
      access,
      /** Effective level for a domain ('write' until access is known). */
      level: (domain: AccessDomain): AccessLevel => levelForDomain(access, domain),
      /** Domain is at least readable. */
      canRead: (domain: AccessDomain) => canRead(access, domain),
      /** Domain is writable (gate create/edit/delete controls on this). */
      canWrite: (domain: AccessDomain) => canWrite(access, domain),
    }),
    [access],
  );
}
