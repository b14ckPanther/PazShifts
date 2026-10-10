'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type * as Leaflet from 'leaflet';
import type { Circle, Map as LeafletMap, Marker } from 'leaflet';
import { MapPinIcon, SearchIcon } from '@yellowshifts/icons';
import 'leaflet/dist/leaflet.css';
import './station-location.css';

// Israel overview until a point is chosen.
const FALLBACK: [number, number] = [31.6, 34.9];
const PIN = `<svg width="36" height="46" viewBox="0 0 36 46" xmlns="http://www.w3.org/2000/svg"><path d="M18 45s15-15.2 15-27A15 15 0 0 0 3 18c0 11.8 15 27 15 27Z" fill="#d10040" stroke="#fff" stroke-width="2.5"/><circle cx="18" cy="18" r="6" fill="#fcbc00"/></svg>`;
const round = (n: number) => Math.round(n * 1e6) / 1e6;

/** Station point for NFC attendance: pick it on a map (tap, drag, search or current location).
    The coordinate inputs stay in the form, so saving is unchanged. */
export function StationLocationFields({
  latitude,
  longitude,
  radius = 50,
  children,
}: {
  latitude?: number | null;
  longitude?: number | null;
  radius?: number;
  children?: ReactNode;
}) {
  const [point, setPoint] = useState<[number, number] | null>(
    latitude != null && longitude != null ? [latitude, longitude] : null
  );
  const [range, setRange] = useState(radius);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<{ map: LeafletMap; marker?: Marker; circle?: Circle; L: typeof Leaflet }>(
    null
  );
  const pointRef = useRef(point);
  pointRef.current = point;

  useEffect(() => {
    let cancelled = false;
    void import('leaflet').then((L) => {
      if (cancelled || !box.current || map.current) return;
      const start = pointRef.current;
      const m = L.map(box.current, { zoomControl: true, attributionControl: true }).setView(
        start ?? FALLBACK,
        start ? 18 : 7
      );
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap',
      }).addTo(m);
      m.on('click', (e) => setPoint([round(e.latlng.lat), round(e.latlng.lng)]));
      map.current = { map: m, L };
      // The map mounts inside forms and sheets that may still be laying out.
      setTimeout(() => m.invalidateSize(), 200);
      setPoint((p) => (p ? [...p] : p));
    });
    return () => {
      cancelled = true;
      map.current?.map.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const ctx = map.current;
    if (!ctx) return;
    const { L, map: m } = ctx;
    if (!point) return;
    if (!ctx.marker) {
      ctx.marker = L.marker(point, {
        draggable: true,
        icon: L.divIcon({ html: PIN, className: 'station-pin', iconSize: [36, 46], iconAnchor: [18, 45] }),
        keyboard: false,
      }).addTo(m);
      ctx.marker.on('dragend', () => {
        const at = ctx.marker!.getLatLng();
        setPoint([round(at.lat), round(at.lng)]);
      });
      ctx.circle = L.circle(point, {
        radius: range,
        color: '#d10040',
        weight: 2,
        fillColor: '#fcbc00',
        fillOpacity: 0.22,
      }).addTo(m);
    } else {
      ctx.marker.setLatLng(point);
      ctx.circle!.setLatLng(point);
    }
  }, [point, range]);

  useEffect(() => {
    if (Number.isFinite(range) && range > 0) map.current?.circle?.setRadius(range);
  }, [range]);

  const focus = (p: [number, number]) => {
    setPoint(p);
    map.current?.map.setView(p, 18);
  };

  const locate = () => {
    if (!navigator.geolocation) return setStatus('המכשיר לא תומך באיתור מיקום.');
    setStatus('מאתרים את המיקום שלך…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        focus([round(pos.coords.latitude), round(pos.coords.longitude)]);
        setStatus(`המיקום נקבע (דיוק של כ-${Math.round(pos.coords.accuracy)} מטר). אפשר לגרור את הסיכה לדיוק.`);
      },
      () => setStatus('לא התקבל מיקום. אפשרו גישה למיקום או בחרו נקודה במפה.'),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    setStatus('מחפשים…');
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=he&countrycodes=il&q=${encodeURIComponent(q)}`
      );
      const [hit] = (await res.json()) as { lat: string; lon: string }[];
      if (!hit) return setStatus('הכתובת לא נמצאה. נסו ניסוח אחר או בחרו נקודה במפה.');
      focus([round(Number(hit.lat)), round(Number(hit.lon))]);
      setStatus('נמצא. גררו את הסיכה לנקודה המדויקת של התחנה.');
    } catch {
      setStatus('החיפוש לא זמין כרגע. בחרו נקודה במפה.');
    }
  };

  const typed = (index: 0 | 1, value: string) => {
    const n = Number(value);
    if (value === '' || !Number.isFinite(n)) return;
    const next: [number, number] = point ? [...point] : [...FALLBACK];
    next[index] = n;
    setPoint(next);
    map.current?.map.panTo(next);
  };

  return (
    <fieldset className="ys-fieldset station-location-fields">
      <legend>מיקום התחנה לדיווח נוכחות</legend>
      <p className="station-location-help">
        הקישו על המפה או גררו את הסיכה לנקודת התחנה. העיגול מראה את הטווח שבו אפשר לדווח נוכחות.
      </p>

      <div className="station-map-tools">
        <div className="station-map-search">
          <input
            type="search"
            className="ys-input"
            placeholder="חיפוש כתובת"
            aria-label="חיפוש כתובת התחנה"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void search();
              }
            }}
          />
          <button type="button" className="station-map-icon-button" aria-label="חיפוש" onClick={() => void search()}>
            <SearchIcon size={18} />
          </button>
        </div>
        <button type="button" className="ys-button ys-button--secondary" onClick={locate}>
          <MapPinIcon size={18} aria-hidden="true" />
          המיקום שלי
        </button>
      </div>

      <div ref={box} className="station-map" role="application" aria-label="מפת מיקום התחנה" />
      <p className="station-map-status" role="status" aria-live="polite">
        {status || (point ? '' : 'עדיין לא נבחרה נקודה.')}
      </p>

      <div className="ys-form-grid station-location-values">
        <div className="ys-form-field">
          <label className="ys-label" htmlFor="station-latitude">
            קו רוחב
          </label>
          <input
            className="ys-input ys-num"
            name="latitude"
            id="station-latitude"
            type="number"
            inputMode="decimal"
            dir="ltr"
            step="any"
            required
            min={-90}
            max={90}
            value={point ? point[0] : ''}
            onChange={(e) => typed(0, e.target.value)}
          />
        </div>
        <div className="ys-form-field">
          <label className="ys-label" htmlFor="station-longitude">
            קו אורך
          </label>
          <input
            className="ys-input ys-num"
            name="longitude"
            id="station-longitude"
            type="number"
            inputMode="decimal"
            dir="ltr"
            step="any"
            required
            min={-180}
            max={180}
            value={point ? point[1] : ''}
            onChange={(e) => typed(1, e.target.value)}
          />
        </div>
        <div className="ys-form-field">
          <label className="ys-label" htmlFor="station-attendanceRadiusM">
            רדיוס מותר (מטר)
          </label>
          <input
            className="ys-input ys-num"
            name="attendanceRadiusM"
            id="station-attendanceRadiusM"
            type="number"
            inputMode="numeric"
            dir="ltr"
            step="1"
            required
            min={30}
            max={200}
            value={Number.isFinite(range) ? range : ''}
            onChange={(e) => setRange(Number(e.target.value))}
          />
        </div>
      </div>
      {children}
    </fieldset>
  );
}
