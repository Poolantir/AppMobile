import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type BuildingStatus = 'recommended' | 'good' | 'warn' | 'offline';

export interface BuildingMarker {
  id: string;
  name: string;
  sublabel: string;
  status: BuildingStatus;
  lat: number;
  lng: number;
}

interface Props {
  markers: BuildingMarker[];
  onSelect: (id: string) => void;
}

// ── Status appearance ──────────────────────────────────────────────────────────
const STATUS = {
  recommended: { pin: '#38bdf8', pinBg: '#082f49', label: '#7dd3fc', pulse: true  },
  good:        { pin: '#34d399', pinBg: '#052e16', label: '#6ee7b7', pulse: false },
  warn:        { pin: '#fbbf24', pinBg: '#431407', label: '#fde68a', pulse: false },
  offline:     { pin: '#475569', pinBg: '#0f172a', label: '#64748b', pulse: false },
};

// ── Custom pin icon ────────────────────────────────────────────────────────────
function buildingIcon(name: string, sublabel: string, status: BuildingStatus): L.DivIcon {
  const s = STATUS[status];

  // Drop-pin SVG shape
  const pinSvg = `
    <svg width="36" height="44" viewBox="0 0 36 44" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="ds" x="-40%" y="-20%" width="180%" height="200%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="rgba(0,0,0,0.5)"/>
        </filter>
      </defs>
      <path d="M18 0 C8 0 0 8 0 18 C0 30 18 44 18 44 C18 44 36 30 36 18 C36 8 28 0 18 0Z"
            fill="${s.pinBg}" stroke="${s.pin}" stroke-width="2.5" filter="url(#ds)"/>
      <circle cx="18" cy="17" r="8" fill="${s.pin}" opacity="0.9"/>
    </svg>`;

  // Pulse ring for recommended
  const pulse = s.pulse ? `
    <div style="
      position:absolute; top:-6px; left:50%; transform:translateX(-50%);
      width:48px; height:48px; border-radius:50%;
      background:${s.pin}; opacity:0.25;
      animation:pmapPing 1.8s cubic-bezier(0,0,0.2,1) infinite;
      pointer-events:none;
    "></div>` : '';

  const html = `
    <style>
      @keyframes pmapPing {
        0%   { transform:translateX(-50%) scale(0.8); opacity:0.4; }
        80%  { transform:translateX(-50%) scale(1.8); opacity:0; }
        100% { transform:translateX(-50%) scale(1.8); opacity:0; }
      }
    </style>
    <div style="position:relative; display:flex; flex-direction:column; align-items:center; width:120px; margin-left:-42px;">
      ${pulse}
      <div style="width:36px; height:44px; position:relative; z-index:2;">${pinSvg}</div>
      <div style="
        margin-top:5px; z-index:2;
        background:rgba(8,12,24,0.92);
        border:1px solid ${s.pin}40;
        border-radius:10px;
        padding:5px 10px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04);
        backdrop-filter:blur(12px);
        text-align:center;
        max-width:120px;
      ">
        <div style="
          color:#f1f5f9; font-size:11px; font-weight:700;
          font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display',system-ui,sans-serif;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100px;
        ">${name}</div>
        <div style="
          color:#94a3b8; font-size:9px; font-weight:800;
          font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;
          letter-spacing:0.07em; text-transform:uppercase; margin-top:2px;
        ">${sublabel}</div>
      </div>
    </div>`;

  return L.divIcon({
    html,
    className: '',
    iconSize: [36, 44],
    iconAnchor: [18, 44],   // tip of pin touches the coordinate
    popupAnchor: [0, -50],
  });
}

// ── Component ──────────────────────────────────────────────────────────────────
export const CampusMap: React.FC<Props> = ({ markers, onSelect }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<L.Map | null>(null);
  const leafMarkers  = useRef<L.Marker[]>([]);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoom: 17,
      center: [40.7449, -74.0254], // default; overridden by fitBounds
      zoomControl: false,
      attributionControl: false,
    });

    // CartoDB Dark Matter — no API key needed, looks great
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      subdomains: 'abcd',
    }).addTo(map);

    // Zoom control bottom-right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Minimal attribution
    L.control.attribution({ prefix: false, position: 'bottomleft' })
      .addAttribution('© <a href="https://www.openstreetmap.org/copyright" style="color:#38bdf8">OSM</a> © <a href="https://carto.com" style="color:#38bdf8">CARTO</a>')
      .addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old markers
    leafMarkers.current.forEach(m => m.remove());
    leafMarkers.current = [];

    if (markers.length === 0) return;

    const bounds = L.latLngBounds([]);

    markers.forEach(bm => {
      const icon = buildingIcon(bm.name, bm.sublabel, bm.status);
      const marker = L.marker([bm.lat, bm.lng], { icon, riseOnHover: true })
        .addTo(map)
        .on('click', () => onSelect(bm.id));
      leafMarkers.current.push(marker);
      bounds.extend([bm.lat, bm.lng]);
    });

    if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], 18, { animate: true });
    } else {
      map.fitBounds(bounds, { padding: [80, 80], maxZoom: 18, animate: true });
    }
  }, [markers, onSelect]);

  return (
    <div
      className="w-full rounded-2xl overflow-hidden border border-white/10"
      style={{ height: '560px' }}
    >
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};
