/**
 * BuildingPickerMap
 * ─────────────────
 * Admin can either:
 *  1. Type a free-text address → geocoded via Nominatim (OSM, no API key)
 *  2. Drag the pin on the map
 *
 * The map initialises centred on the University of Iowa campus.
 * Props: initialLat/Lng (optional), onChange(lat, lng) called whenever position changes.
 */
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, LocateFixed, Loader2 } from 'lucide-react';

interface Props {
  initialLat?: number;
  initialLng?: number;
  onChange: (lat: number, lng: number) => void;
}

const UI_CENTER: [number, number] = [41.6617, -91.5364];

// A simple draggable pin icon
function makePinIcon(): L.DivIcon {
  return L.divIcon({
    html: `<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 0 C6.7 0 0 6.7 0 15 C0 25 15 40 15 40 C15 40 30 25 30 15 C30 6.7 23.3 0 15 0Z"
        fill="#0ea5e9" stroke="white" stroke-width="2"/>
      <circle cx="15" cy="15" r="6" fill="white" opacity="0.9"/>
    </svg>`,
    className: '',
    iconSize: [30, 40],
    iconAnchor: [15, 40],
  });
}

export const BuildingPickerMap: React.FC<Props> = ({
  initialLat,
  initialLng,
  onChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<L.Map | null>(null);
  const markerRef    = useRef<L.Marker | null>(null);

  const [query, setQuery]         = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [geoError, setGeoError]   = useState('');

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center: [number, number] = (initialLat && initialLng)
      ? [initialLat, initialLng]
      : UI_CENTER;

    const map = L.map(containerRef.current, {
      center,
      zoom: initialLat ? 18 : 16,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      subdomains: 'abcd',
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Place initial marker
    const marker = L.marker(center, {
      icon: makePinIcon(),
      draggable: true,
    }).addTo(map);

    marker.on('dragend', () => {
      const { lat, lng } = marker.getLatLng();
      onChange(lat, lng);
    });

    // Click on map moves the marker
    map.on('click', (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      onChange(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Geocode address using Nominatim (OSM — free, no key)
  const geocode = async () => {
    if (!query.trim()) return;
    setGeocoding(true);
    setGeoError('');
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
      const res = await fetch(url, {
        headers: { 'Accept-Language': 'en', 'User-Agent': 'Poolantir/1.0' },
      });
      const data = await res.json();
      if (!data || data.length === 0) {
        setGeoError('Address not found — try a different search');
        return;
      }
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      markerRef.current?.setLatLng([lat, lng]);
      mapRef.current?.flyTo([lat, lng], 18, { duration: 1 });
      onChange(lat, lng);
    } catch {
      setGeoError('Geocode failed — check your connection');
    } finally {
      setGeocoding(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Address search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setGeoError(''); }}
            onKeyDown={e => e.key === 'Enter' && geocode()}
            placeholder="Search address or place name…"
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-sky-500/50"
          />
          {geocoding && (
            <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-sky-400 animate-spin" />
          )}
        </div>
        <button
          onClick={geocode}
          disabled={geocoding}
          className="px-4 py-3 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-[#0f172a] rounded-xl transition-all active:scale-95"
        >
          <Search size={16} />
        </button>
      </div>
      {geoError && (
        <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider">{geoError}</p>
      )}
      <p className="text-[10px] text-slate-600 uppercase tracking-wider font-bold flex items-center gap-1.5">
        <LocateFixed size={11} />
        Or tap / drag the pin on the map
      </p>

      {/* Map container */}
      <div
        className="w-full rounded-2xl overflow-hidden border border-white/10"
        style={{ height: '280px' }}
      >
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
};
