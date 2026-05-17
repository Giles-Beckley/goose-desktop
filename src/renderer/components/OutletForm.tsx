import { useEffect, useState } from 'react';
import { useMcp } from '../hooks/useMcp';
import { MCP_TOOLS } from '../../shared/mcpTools';
import { LoadingSpinner } from './LoadingSpinner';
import type { Outlet } from '../../shared/types';

interface OutletFormProps {
  outlet?: Outlet | null; // null = create
  onClose: () => void;
  onSaved: () => void;
}

export function OutletForm({ outlet, onClose, onSaved }: OutletFormProps) {
  const { callTool } = useMcp();
  const isEdit = !!outlet;

  // If we were given a stub outlet (id-only or partial), fetch the full record
  const [fullOutlet, setFullOutlet] = useState<Outlet | null>(outlet ?? null);
  const [loading, setLoading] = useState(false);

  const o = fullOutlet ?? outlet;

  const [name, setName] = useState(o?.name ?? '');
  const [slug, setSlug] = useState(o?.slug ?? '');
  const [address1, setAddress1] = useState(o?.address_1 ?? '');
  const [address2, setAddress2] = useState(o?.address_2 ?? '');
  const [city, setCity] = useState(o?.city ?? '');
  const [state, setState] = useState(o?.state ?? '');
  const [postcode, setPostcode] = useState(o?.postcode ?? '');
  const [country, setCountry] = useState(o?.country ?? '');
  const [phone, setPhone] = useState(o?.phone ?? '');
  const [email, setEmail] = useState(o?.email ?? '');
  const [url, setUrl] = useState(o?.url ?? '');
  const [openingHours, setOpeningHours] = useState(o?.opening_hours ?? '');
  const [status, setStatus] = useState<'active' | 'inactive'>(o?.status ?? 'active');
  const [lat, setLat] = useState<string>(o?.lat != null ? String(o.lat) : '');
  const [lng, setLng] = useState<string>(o?.lng != null ? String(o.lng) : '');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // On edit, fetch the freshest copy
  useEffect(() => {
    if (!isEdit || !outlet) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const result = await callTool(MCP_TOOLS.GET_OUTLET, { outlet_id: outlet.id });
        const text = result?.content?.[0]?.text;
        if (!text || cancelled) return;
        const data = JSON.parse(text);
        const fresh: Outlet | null = data?.outlet ?? data;
        if (fresh && !cancelled) {
          setFullOutlet(fresh);
          setName(fresh.name ?? '');
          setSlug(fresh.slug ?? '');
          setAddress1(fresh.address_1 ?? '');
          setAddress2(fresh.address_2 ?? '');
          setCity(fresh.city ?? '');
          setState(fresh.state ?? '');
          setPostcode(fresh.postcode ?? '');
          setCountry(fresh.country ?? '');
          setPhone(fresh.phone ?? '');
          setEmail(fresh.email ?? '');
          setUrl(fresh.url ?? '');
          setOpeningHours(fresh.opening_hours ?? '');
          setStatus((fresh.status as 'active' | 'inactive') ?? 'active');
          setLat(fresh.lat != null ? String(fresh.lat) : '');
          setLng(fresh.lng != null ? String(fresh.lng) : '');
        }
      } catch {
        // non-critical — fall back to whatever we were passed
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const args: Record<string, unknown> = { name: name.trim(), status };
      if (slug.trim()) args.slug = slug.trim();
      if (address1.trim()) args.address_1 = address1.trim();
      if (address2.trim()) args.address_2 = address2.trim();
      if (city.trim()) args.city = city.trim();
      if (state.trim()) args.state = state.trim();
      if (postcode.trim()) args.postcode = postcode.trim();
      if (country.trim()) args.country = country.trim().toUpperCase().slice(0, 2);
      if (phone.trim()) args.phone = phone.trim();
      if (email.trim()) args.email = email.trim();
      if (url.trim()) args.url = url.trim();
      if (openingHours.trim()) args.opening_hours = openingHours.trim();
      if (lat.trim()) args.lat = parseFloat(lat);
      if (lng.trim()) args.lng = parseFloat(lng);

      if (isEdit && outlet) {
        args.outlet_id = outlet.id;
        const res = await callTool(MCP_TOOLS.UPDATE_OUTLET, args);
        const text = res?.content?.[0]?.text;
        if (text) {
          const data = JSON.parse(text);
          if (data?.success === false) {
            setError(data.message ?? data.error ?? 'Failed to update outlet');
            return;
          }
        }
      } else {
        const res = await callTool(MCP_TOOLS.CREATE_OUTLET, args);
        const text = res?.content?.[0]?.text;
        if (text) {
          const data = JSON.parse(text);
          if (data?.success === false) {
            setError(data.message ?? data.error ?? 'Failed to create outlet');
            return;
          }
        }
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save outlet');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">{error}</div>
      )}

      {loading && isEdit && (
        <div className="flex justify-center py-2"><LoadingSpinner size="sm" /></div>
      )}

      <Field label="Name *">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="input"
          placeholder="e.g. Soho Flagship Store"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Slug">
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="input"
            placeholder="auto-generated from name"
          />
        </Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')} className="input">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </Field>
      </div>

      <div>
        <h3 className="text-sm font-medium text-goose-text mb-2">Address</h3>
        <div className="space-y-3">
          <Field label="Address line 1">
            <input type="text" value={address1} onChange={(e) => setAddress1(e.target.value)} className="input" />
          </Field>
          <Field label="Address line 2">
            <input type="text" value={address2} onChange={(e) => setAddress2(e.target.value)} className="input" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="City">
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className="input" />
            </Field>
            <Field label="County / State">
              <input type="text" value={state} onChange={(e) => setState(e.target.value)} className="input" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Postcode">
              <input type="text" value={postcode} onChange={(e) => setPostcode(e.target.value)} className="input" />
            </Field>
            <Field label="Country (2-letter ISO)">
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 2))}
                className="input uppercase"
                maxLength={2}
                placeholder="GB"
              />
            </Field>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-goose-text mb-2">Contact</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone">
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
            </Field>
            <Field label="Email">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
            </Field>
          </div>
          <Field label="Website URL">
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} className="input" placeholder="https://..." />
          </Field>
          <Field label="Opening hours">
            <textarea value={openingHours} onChange={(e) => setOpeningHours(e.target.value)} className="input" rows={2} placeholder="Mon-Fri 9-6, Sat 10-4" />
          </Field>
        </div>
      </div>

      {/* Advanced: manual lat/lng override */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-goose-text-light hover:text-goose-text flex items-center gap-1"
        >
          <svg className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Advanced (manual coordinates)
        </button>
        {showAdvanced && (
          <div className="mt-3 grid grid-cols-2 gap-4">
            <Field label="Latitude">
              <input
                type="number"
                step="any"
                min="-90"
                max="90"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="input"
                placeholder="auto-geocoded"
              />
            </Field>
            <Field label="Longitude">
              <input
                type="number"
                step="any"
                min="-180"
                max="180"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                className="input"
                placeholder="auto-geocoded"
              />
            </Field>
            <p className="col-span-2 text-xs text-goose-text-light">
              Leave blank to let the plugin auto-geocode the address. Coordinates are saved as-is when supplied.
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-4 border-t border-goose-border">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving && <LoadingSpinner size="sm" />}
          {isEdit ? 'Update Outlet' : 'Create Outlet'}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="px-4 py-2.5 text-sm font-medium text-goose-text bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-goose-text mb-1">{label}</label>
      {children}
    </div>
  );
}
