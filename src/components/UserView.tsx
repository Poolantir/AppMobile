import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Building, Restroom, Stall, Issue, IssueType } from '../types';
import { useAuth } from '../App';
import { CampusMap, BuildingMarker, BuildingStatus } from './CampusMap';
import { 
  AlertTriangle, 
  CheckCircle2, 
  MapPin, 
  Users, 
  AlertCircle,
  X,
  Send,
  Flag,
  Circle,
  Navigation,
  Lock,
  Zap,
  Map as MapIcon,
  List,
  ChevronLeft,
  Building2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ── Module-level helpers ──────────────────────────────────────────────────────
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseFloor(location: string): string {
  const l = location.toLowerCase();
  if (l.includes('ground') || l.includes('lobby')) return 'Ground Floor';
  if (l.includes('first') || l.includes('1st') || /level\s*1\b/.test(l) || /floor\s*1\b/.test(l)) return '1st Floor';
  if (l.includes('second') || l.includes('2nd') || /level\s*2\b/.test(l) || /floor\s*2\b/.test(l)) return '2nd Floor';
  if (l.includes('third') || l.includes('3rd') || /level\s*3\b/.test(l) || /floor\s*3\b/.test(l)) return '3rd Floor';
  return location.split(',')[0].trim();
}

function parseWing(location: string): string | null {
  const l = location.toLowerCase();
  const keywords = ['north', 'south', 'east', 'west', 'central', 'main', 'food court', 'lobby'];
  for (const w of keywords) {
    if (l.includes(w)) return w.split(' ').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
  }
  const parts = location.split(',');
  if (parts.length > 1) return parts.slice(1).join(', ').trim();
  return null;
}

// ── BuildingRoomsList ─────────────────────────────────────────────────────────
interface BRLProps {
  rooms: Restroom[];
  stalls: Stall[];
  issues: Issue[];
  recommendedId: string | null;
  userLocation: { lat: number; lng: number } | null;
  buildings: Building[];
  onSelect: (r: Restroom) => void;
}

const BuildingRoomsList: React.FC<BRLProps> = ({
  rooms, stalls, issues, recommendedId, userLocation, buildings, onSelect,
}) => {
  const grouped = useMemo(() => {
    const map = new Map<string, Restroom[]>();
    rooms.forEach(r => {
      const floor = parseFloor(r.location);
      if (!map.has(floor)) map.set(floor, []);
      map.get(floor)!.push(r);
    });
    return Array.from(map.entries());
  }, [rooms]);

  if (rooms.length === 0) {
    return (
      <div className="py-16 text-center glass-card border-dashed">
        <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">No restrooms in this building</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {grouped.map(([floor, floorRooms]) => (
        <div key={floor}>
          {/* Floor divider */}
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1 bg-white/[0.06]" />
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.25em] px-2">{floor}</span>
            <div className="h-px flex-1 bg-white/[0.06]" />
          </div>
          <div className="space-y-3">
            {floorRooms.map(r => {
              const rStalls = stalls.filter(s => s.restroomId === r.id);
              const stallNodes  = rStalls.filter(s => s.type === 'stall');
              const urinalNodes = rStalls.filter(s => s.type === 'urinal');
              const online = rStalls.filter(s => s.status === 'online').length;
              const issuesCount = issues.filter(i => i.restroomId === r.id).length;
              const isRec = r.id === recommendedId;
              const wing = parseWing(r.location);
              const status = isRec ? 'rec' : online === 0 ? 'offline' : issuesCount > 0 ? 'warn' : 'good';

              let distLabel: string | null = null;
              if (userLocation) {
                const bld = buildings.find(b => b.id === r.buildingId);
                if (bld?.lat && bld?.lng) {
                  const d = haversineMeters(userLocation.lat, userLocation.lng, bld.lat, bld.lng);
                  distLabel = d < 1000 ? `${Math.round(d)}m` : `${(d / 1000).toFixed(1)}km`;
                }
              }

              return (
                <motion.div
                  key={r.id}
                  className={`glass-card p-5 transition-all ${
                    isRec ? 'border-sky-500/30 bg-sky-500/5' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Name + wing + node dots */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <h4 className="text-sm font-bold text-white tracking-tight">{r.name}</h4>
                        {isRec && (
                          <span className="text-[8px] font-black text-sky-400 px-1.5 py-0.5 bg-sky-500/10 rounded-md border border-sky-500/20 uppercase tracking-widest">Best Now</span>
                        )}
                        {issuesCount > 0 && (
                          <span className="text-[8px] font-black text-amber-400 px-1.5 py-0.5 bg-amber-500/10 rounded-md border border-amber-500/20 uppercase tracking-widest flex items-center gap-0.5">
                            <AlertTriangle size={7} /> Alert
                          </span>
                        )}
                      </div>
                      {wing && (
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-3">{wing}</p>
                      )}
                      {/* Per-type node dot bars */}
                      <div className="space-y-1.5">
                        {stallNodes.length > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-slate-600 font-bold uppercase tracking-wider w-11 shrink-0">Stalls</span>
                            <div className="flex flex-wrap gap-1">
                              {stallNodes.map(s => (
                                <div key={s.id} title={`${s.label} · ${s.status}`}
                                  className={`w-3 h-3 rounded-sm ${
                                    s.status === 'online'
                                      ? 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.7)]'
                                      : 'bg-red-500/40 border border-red-500/30'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-[9px] text-slate-600">{stallNodes.filter(s => s.status === 'online').length}/{stallNodes.length}</span>
                          </div>
                        )}
                        {urinalNodes.length > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-slate-600 font-bold uppercase tracking-wider w-11 shrink-0">Urinals</span>
                            <div className="flex flex-wrap gap-1">
                              {urinalNodes.map(s => (
                                <div key={s.id} title={`${s.label} · ${s.status}`}
                                  className={`w-3 h-3 rounded-full ${
                                    s.status === 'online'
                                      ? 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.7)]'
                                      : 'bg-red-500/40 border border-red-500/30'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-[9px] text-slate-600">{urinalNodes.filter(s => s.status === 'online').length}/{urinalNodes.length}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Status badge only — no distance */}
                    <div className="flex flex-col items-end gap-2 shrink-0 pt-0.5">
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${
                        status === 'rec'     ? 'bg-sky-500/10 border-sky-500/20 text-sky-400' :
                        status === 'offline' ? 'bg-slate-500/10 border-slate-500/20 text-slate-400' :
                        status === 'warn'    ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                                              'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          status !== 'offline' ? 'animate-pulse' : ''
                        } ${
                          status === 'rec' ? 'bg-sky-400' :
                          status === 'offline' ? 'bg-slate-500' :
                          status === 'warn' ? 'bg-amber-400' : 'bg-emerald-500'
                        }`} />
                        {status === 'offline' ? 'Offline' : status === 'warn' ? 'Alert' : `${online}/${rStalls.length} online`}
                      </div>
                      {distLabel && (
                        <span style={{display:'none'}} />
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export const UserView: React.FC = () => {
  const { user } = useAuth();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [restrooms, setRestrooms] = useState<Restroom[]>([]);
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [listBuilding, setListBuilding] = useState<Building | null>(null);
  const [selectedRestroom, setSelectedRestroom] = useState<Restroom | null>(null);
  const [isReporting, setIsReporting] = useState(false);
  const [reportData, setReportData] = useState<{ type: IssueType; stallId?: string }>({ type: 'unclean' });
  const [view, setView] = useState<'map' | 'list'>('map');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Get building lat/lng for a restroom (via buildingId)
  const restroomCoords = (roomId: string): { lat: number; lng: number } | null => {
    const room = restrooms.find(r => r.id === roomId);
    if (!room?.buildingId) return null;
    const bld = buildings.find(b => b.id === room.buildingId);
    if (!bld?.lat || !bld?.lng) return null;
    return { lat: bld.lat, lng: bld.lng };
  };

  const recommendedRestroom = useMemo(() => {
    if (restrooms.length === 0) return null;

    const score = (roomId: string) => {
      const roomStalls = stalls.filter(s => s.restroomId === roomId);
      const onlineStalls = roomStalls.filter(s => s.status === 'online');
      const roomIssues = issues.filter(i => i.restroomId === roomId).length;
      let distancePenalty = 0;
      if (userLocation) {
        const coords = restroomCoords(roomId);
        if (coords) {
          const dist = haversineMeters(userLocation.lat, userLocation.lng, coords.lat, coords.lng);
          distancePenalty = dist * 0.05; // 1 metre costs 0.05 points
        }
      }
      return onlineStalls.length * 10 - roomIssues * 5 - distancePenalty;
    };

    return restrooms.reduce((best, room) => score(room.id) >= score(best.id) ? room : best);
  }, [restrooms, stalls, issues, buildings, userLocation]);

  const getRecommendationReason = (roomId: string) => {
    const roomStalls = stalls.filter(s => s.restroomId === roomId);
    const onlineStalls = roomStalls.filter(s => s.status === 'online');
    const roomIssues = issues.filter(i => i.restroomId === roomId).length;
    const parts: string[] = [];
    if (onlineStalls.length === roomStalls.length && roomStalls.length > 0) {
      parts.push(`All ${onlineStalls.length} stalls online`);
    } else {
      parts.push(`${onlineStalls.length}/${roomStalls.length} stalls online`);
    }
    if (roomIssues === 0) parts.push('No active issues');
    return parts.join(' · ');
  };

  // Helper: compute a node status from a set of stalls/issues
  const nodeStatus = (
    restroomIds: string[],
    isRecommended: boolean
  ): BuildingStatus => {
    if (isRecommended) return 'recommended';
    const rs = stalls.filter(s => restroomIds.includes(s.restroomId));
    const onlineCount = rs.filter(s => s.status === 'online').length;
    const hasIssues = issues.some(i => restroomIds.includes(i.restroomId));
    if (rs.length > 0 && onlineCount === 0) return 'offline';
    if (hasIssues) return 'warn';
    return 'good';
  };

  // Campus-level map markers: one per building (or per restroom if no buildings)
  const DEFAULT_CAMPUS_POS: [number, number][] = [
    [22, 20], [78, 20], [22, 70], [78, 70], [50, 45],
    [50, 15], [15, 45], [85, 45], [50, 80], [35, 55],
  ];
  const campusMarkers = useMemo<BuildingMarker[]>(() => {
    if (buildings.length === 0) {
      return restrooms
        .filter(r => typeof r.mapX === 'number') // only show if positioned
        .map((r) => {
          const rs = stalls.filter(s => s.restroomId === r.id);
          const onlineCount = rs.filter(s => s.status === 'online').length;
          const status = nodeStatus([r.id], recommendedRestroom?.id === r.id);
          return {
            id: `restroom:${r.id}`,
            name: r.name,
            sublabel: `${onlineCount}/${rs.length} stalls`,
            status,
            lat: 40.7449,
            lng: -74.0254,
          } as BuildingMarker;
        });
    }

    return buildings
      .filter(b => typeof b.lat === 'number' && typeof b.lng === 'number')
      .map(b => {
        const bRooms = restrooms.filter(r => r.buildingId === b.id);
        const bIds = bRooms.map(r => r.id);
        const bStalls = stalls.filter(s => bIds.includes(s.restroomId));
        const onlineCount = bStalls.filter(s => s.status === 'online').length;
        const isRec = !!(recommendedRestroom && bIds.includes(recommendedRestroom.id));
        const status = nodeStatus(bIds, isRec);
        return {
          id: b.id,
          name: b.name,
          sublabel: bRooms.length === 0
            ? 'No restrooms'
            : `${bRooms.length} restroom${bRooms.length > 1 ? 's' : ''}`,
          status,
          lat: b.lat!,
          lng: b.lng!,
        } as BuildingMarker;
      });
  }, [buildings, restrooms, stalls, issues, recommendedRestroom]);

  // Still keep campusNodes for the fallback (buildings without lat/lng)
  const campusNodes = useMemo(() => buildings.filter(b => !b.lat || !b.lng), [buildings]);

  // Building-level: restrooms within selected building
  const buildingRestrooms = useMemo(() =>
    selectedBuilding
      ? restrooms.filter(r => r.buildingId === selectedBuilding.id)
      : [],
    [selectedBuilding, restrooms]
  );

  const handleCampusNodeClick = (id: string) => {
    if (id.startsWith('restroom:')) {
      const r = restrooms.find(r => r.id === id.slice('restroom:'.length));
      if (r) setSelectedRestroom(r);
      return;
    }
    const building = buildings.find(b => b.id === id);
    if (building) setSelectedBuilding(building);
  };

  useEffect(() => {
    const qB = query(collection(db, 'buildings'));
    const unsubscribeB = onSnapshot(qB, (snapshot) => {
      setBuildings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Building)));
    });

    const qR = query(collection(db, 'restrooms'));
    const unsubscribeR = onSnapshot(qR, (snapshot) => {
      setRestrooms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Restroom)));
    });

    const qS = query(collection(db, 'stalls'));
    const unsubscribeS = onSnapshot(qS, (snapshot) => {
      setStalls(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Stall)));
    });

    const qI = query(collection(db, 'issues'), where('status', '==', 'pending'));
    const unsubscribeI = onSnapshot(qI, (snapshot) => {
      setIssues(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Issue)));
    });

    return () => {
      unsubscribeB();
      unsubscribeR();
      unsubscribeS();
      unsubscribeI();
    };
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}, // silently ignore denial
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const handleSubmitReport = async () => {
    if (!selectedRestroom || !user) return;
    
    try {
      await addDoc(collection(db, 'issues'), {
        restroomId: selectedRestroom.id,
        stallId: reportData.stallId || null,
        type: reportData.type,
        status: 'pending',
        reportedAt: serverTimestamp(),
        reportedBy: user.uid
      });
      setIsReporting(false);
      setReportData({ type: 'unclean' });
    } catch (e) {
      console.error("Failed to report issue", e);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Facility Status</h2>
          <p className="text-slate-400 text-sm">Real-time restroom availability.</p>
        </div>
        <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 border border-white/10 shrink-0">
          <button
            onClick={() => setView('map')}
            className={`p-2 rounded-lg transition-all ${
              view === 'map' ? 'bg-sky-500 text-[#0f172a]' : 'text-slate-400 hover:text-white'
            }`}
            title="Map view"
          >
            <MapIcon size={16} />
          </button>
          <button
            onClick={() => setView('list')}
            className={`p-2 rounded-lg transition-all ${
              view === 'list' ? 'bg-sky-500 text-[#0f172a]' : 'text-slate-400 hover:text-white'
            }`}
            title="List view"
          >
            <List size={16} />
          </button>
        </div>
      </header>

      {/* Recommendation Banner */}
      {recommendedRestroom && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ y: -2, scale: 1.01 }}
          className="glass-card p-6 border-sky-500/30 bg-sky-500/5 cursor-pointer hover:border-sky-400/50 transition-all"
          onClick={() => {
            const b = buildings.find(b => b.id === recommendedRestroom.buildingId);
            if (b) { setView('map'); setSelectedBuilding(b); }
          }}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-sky-500/20 rounded-xl text-sky-400 border border-sky-500/30 shrink-0">
              <Zap size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-sky-400 uppercase tracking-widest mb-1">Recommended · Best Option Now</p>
              <p className="text-lg font-bold text-white tracking-tight">{recommendedRestroom.name}</p>
              <p className="text-xs text-slate-400 mt-0.5 truncate">{getRecommendationReason(recommendedRestroom.id)}</p>
            </div>
            <Navigation size={18} className="text-sky-400/60 shrink-0" />
          </div>
        </motion.div>
      )}

      {/* ── Map / List toggle ── */}
      <AnimatePresence mode="wait">
        {view === 'map' ? (
          <motion.div
            key="map"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="space-y-3"
          >
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 min-h-[28px]">
              {selectedBuilding ? (
                <>
                  <button
                    onClick={() => setSelectedBuilding(null)}
                    className="flex items-center gap-1.5 text-sky-400 hover:text-sky-300 text-xs font-bold transition-colors"
                  >
                    <ChevronLeft size={14} />
                    Campus
                  </button>
                  <span className="text-slate-600">/</span>
                  <div className="flex items-center gap-1.5">
                    <Building2 size={12} className="text-slate-500" />
                    <span className="text-white text-xs font-bold">{selectedBuilding.name}</span>
                  </div>
                </>
              ) : (
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Campus Map</span>
              )}
            </div>

            {selectedBuilding ? (
              // ── Building interior ──
              <BuildingRoomsList
                rooms={buildingRestrooms}
                stalls={stalls}
                issues={issues}
                recommendedId={recommendedRestroom?.id ?? null}
                userLocation={userLocation}
                buildings={buildings}
                onSelect={setSelectedRestroom}
              />
            ) : campusMarkers.length === 0 ? (
              <div className="py-20 text-center glass-card border-dashed">
                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-500">
                  <AlertCircle size={32} />
                </div>
                <p className="text-slate-500 font-bold uppercase tracking-widest">No Facility Data Available</p>
                <p className="text-xs text-slate-600 mt-2">The system is awaiting initial sensor provisioning.</p>
              </div>
            ) : (
              // ── Campus Leaflet map ──
              <CampusMap
                markers={campusMarkers}
                onSelect={handleCampusNodeClick}
              />
            )}

            <p className="text-center text-[10px] text-slate-600 uppercase tracking-widest">
              {selectedBuilding
                ? 'Tap a restroom to view stall details'
                : 'Tap a building to explore its restrooms'}
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="space-y-4"
          >
            {/* Breadcrumb */}
            {listBuilding && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setListBuilding(null)}
                  className="flex items-center gap-1.5 text-sky-400 hover:text-sky-300 text-xs font-bold transition-colors"
                >
                  <ChevronLeft size={14} /> Campus
                </button>
                <span className="text-slate-600">/</span>
                <span className="text-white text-xs font-bold flex items-center gap-1.5">
                  <Building2 size={12} className="text-slate-500" />
                  {listBuilding.name}
                </span>
              </div>
            )}

            {buildings.length === 0 ? (
              <div className="py-20 text-center glass-card border-dashed">
                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-500">
                  <AlertCircle size={32} />
                </div>
                <p className="text-slate-500 font-bold uppercase tracking-widest">No Facility Data Available</p>
                <p className="text-xs text-slate-600 mt-2">The system is awaiting initial sensor provisioning by an administrator.</p>
              </div>
            ) : !listBuilding ? (
              // ── Level 1: Buildings ──
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {buildings.map(b => {
                  const bRooms = restrooms.filter(r => r.buildingId === b.id);
                  const bIds = bRooms.map(r => r.id);
                  const bStalls = stalls.filter(s => bIds.includes(s.restroomId));
                  const online = bStalls.filter(s => s.status === 'online').length;
                  const hasRec = !!(recommendedRestroom && bIds.includes(recommendedRestroom.id));
                  const hasIssues = issues.some(i => bIds.includes(i.restroomId));
                  const allOffline = bStalls.length > 0 && online === 0;
                  const statusColor = hasRec
                    ? 'border-sky-500/30 bg-sky-500/5'
                    : allOffline
                    ? 'border-slate-500/20 bg-slate-500/5'
                    : hasIssues
                    ? 'border-amber-500/20 bg-amber-500/5'
                    : 'border-emerald-500/20 bg-emerald-500/5';
                  const dotColor = hasRec
                    ? 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]'
                    : allOffline
                    ? 'bg-slate-500'
                    : hasIssues
                    ? 'bg-amber-400'
                    : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]';
                  return (
                    <motion.div
                      key={b.id}
                      whileHover={{ y: -3, scale: 1.01 }}
                      className={`glass-card p-6 cursor-pointer hover:border-white/20 transition-all group ${statusColor}`}
                      onClick={() => setListBuilding(b)}
                    >
                      <div className="flex justify-between items-start mb-5">
                        <div className="p-3 bg-white/5 text-slate-400 rounded-xl group-hover:text-sky-400 transition-colors">
                          <Building2 size={22} />
                        </div>
                        <div className="flex items-center gap-1.5">
                          {hasRec && (
                            <span className="text-[8px] font-black text-sky-400 uppercase tracking-widest px-2 py-0.5 bg-sky-500/10 rounded-full border border-sky-500/20">Recommended</span>
                          )}
                          <div className={`w-2 h-2 rounded-full animate-pulse ${dotColor}`} />
                        </div>
                      </div>
                      <h3 className="text-base font-bold text-white tracking-tight mb-0.5">{b.name}</h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mb-4">
                        <MapPin size={11} /> {b.location}
                      </p>
                      <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest">
                        <span className="text-slate-500">{bRooms.length} restroom{bRooms.length !== 1 ? 's' : ''}</span>
                        <span className="text-slate-700">·</span>
                        <span className={online > 0 ? 'text-emerald-500' : 'text-slate-600'}>{online} online</span>
                        {hasIssues && <span className="text-amber-400 flex items-center gap-1"><AlertTriangle size={10} /> Alert</span>}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              // ── Level 2: Restrooms in building ──
              <BuildingRoomsList
                rooms={restrooms.filter(r => r.buildingId === listBuilding.id)}
                stalls={stalls}
                issues={issues}
                recommendedId={recommendedRestroom?.id ?? null}
                userLocation={userLocation}
                buildings={buildings}
                onSelect={setSelectedRestroom}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Restroom Detail Modal */}
      <AnimatePresence>
        {selectedRestroom && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#0f172a]/80 backdrop-blur-md">
            <motion.div 
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              className="glass border-white/10 w-full max-w-2xl rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/5">
                <div>
                  <h3 className="text-2xl font-bold text-white leading-tight tracking-tight">{selectedRestroom.name}</h3>
                  <p className="text-slate-400 flex items-center gap-1.5 mt-1 text-sm">
                    <MapPin size={16} />
                    {selectedRestroom.location}
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedRestroom(null)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
                >
                  <X />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {/* Reporting — admins/signed-in users only */}
                {user && (
                <section className="bg-white/5 rounded-[2rem] p-6 border border-white/10 shadow-inner">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-sky-500/10 rounded-2xl text-sky-400 border border-sky-500/20">
                        <Flag size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-white tracking-tight">Report an Issue</h4>
                        <p className="text-xs text-slate-500">Alert facility maintenance immediately.</p>
                      </div>
                    </div>
                    {!isReporting && (
                      <button 
                        onClick={() => setIsReporting(true)}
                        className="bg-sky-500 text-[#0f172a] text-[10px] font-black py-2.5 px-5 rounded-xl active:scale-95 transition-all shadow-lg shadow-sky-500/20 uppercase tracking-widest"
                      >
                        New Report
                      </button>
                    )}
                  </div>

                  {isReporting && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-6 pt-2"
                    >
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Select Defect Type</label>
                        <div className="grid grid-cols-2 gap-2">
                          {['clogged', 'no_paper', 'broken_lock', 'unclean', 'other'].map(type => (
                            <button
                              key={type}
                              onClick={() => setReportData({ ...reportData, type: type as IssueType })}
                              className={`py-3 px-4 rounded-xl border font-bold text-[10px] uppercase tracking-widest transition-all ${
                                reportData.type === type 
                                  ? 'bg-sky-500 border-sky-500 text-[#0f172a] shadow-[0_0_15px_rgba(56,189,248,0.3)]' 
                                  : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                              }`}
                            >
                              {type.replace('_', ' ')}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button 
                          onClick={handleSubmitReport}
                          className="flex-1 bg-white text-[#0f172a] font-black py-4 rounded-xl flex items-center justify-center gap-2 uppercase text-xs tracking-widest active:scale-[0.98] transition-transform"
                        >
                          <Send size={16} /> Submit Report
                        </button>
                        <button 
                          onClick={() => setIsReporting(false)}
                          className="px-8 bg-white/10 text-white font-bold py-4 rounded-xl text-xs hover:bg-white/20 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </motion.div>
                  )}
                </section>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );

};
