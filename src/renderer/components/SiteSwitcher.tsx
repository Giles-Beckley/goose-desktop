import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConnectionStore } from '../stores/connectionStore';

/**
 * Compact dropdown in the sidebar header (multisite only) showing the active
 * "Connected" site and letting the user switch to another. Selecting a site
 * re-points the whole app via setActiveSite (which resets per-site state and
 * re-probes), persists the choice, and returns to the Dashboard so no stale
 * page state from the previous site lingers.
 */
export function SiteSwitcher() {
  const navigate = useNavigate();
  const { sites, activeSiteId, status, setActiveSite } = useConnectionStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const active = sites.find((s) => s.id === activeSiteId) ?? sites[0];
  if (!active) return null;

  const dotColor =
    status === 'connected' ? 'bg-green-400'
    : status === 'connecting' ? 'bg-yellow-400'
    : status === 'error' ? 'bg-red-400'
    : 'bg-gray-400';

  const handleSelect = (id: string) => {
    setOpen(false);
    if (id === activeSiteId) return;
    setActiveSite(id);
    void window.electronAPI.sites.setActive(id);
    navigate('/');
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-left"
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
        <span className="flex-1 min-w-0">
          <span className="block text-xs text-white/40 leading-tight">Connected</span>
          <span className="block text-sm text-white/90 truncate leading-tight">{active.label}</span>
        </span>
        <svg className={`w-4 h-4 text-white/40 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 mt-1 z-10 rounded-lg bg-slate-800 border border-white/10 shadow-lg py-1 max-h-72 overflow-auto">
          {sites.map((site) => (
            <button
              key={site.id}
              onClick={() => handleSelect(site.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                site.id === activeSiteId ? 'text-white bg-white/10' : 'text-white/70 hover:bg-white/8 hover:text-white'
              }`}
            >
              <span className="flex-1 min-w-0 truncate">{site.label}</span>
              {site.id === activeSiteId && (
                <svg className="w-4 h-4 text-primary-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
