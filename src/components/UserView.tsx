import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Building, Restroom, Stall, Issue, IssueType } from '../types';
import { useAuth } from '../App';
import { CampusMap, BuildingMarker, BuildingStatus } from './CampusMap';
import { BuildingFloorPlan } from './BuildingFloorPlan';
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

  const recommendedRestroom = useMemo(() => {
    if (restrooms.length === 0) return null;

    const score = (roomId: string) => {
      const roomStalls = stalls.filter(s => s.restroomId === roomId);
      const onlineStalls = roomStalls.filter(s => s.status === 'online');
      const roomIssues = issues.filter(i => i.restroomId === roomId).length;
      const avgOccupancy = onlineStalls.length > 0
        ? onlineStalls.reduce((sum, s) => sum + (s.occupancyCount || 0), 0) / onlineStalls.length
        : 0;
      return onlineStalls.length * 10 - roomIssues * 5 - avgOccupancy * 0.1;
    };

    return restrooms.reduce((best, room) => score(room.id) >= score(best.id) ? room : best);
  }, [restrooms, stalls, issues]);

  const getRecommendationReason = (roomId: string) => {
    const roomStalls = stalls.filter(s => s.restroomId === roomId);
    const onlineStalls = roomStalls.filter(s => s.status === 'online');
    const roomIssues = issues.filter(i => i.restroomId === roomId).length;
    const avgOccupancy = onlineStalls.length > 0
      ? Math.round(onlineStalls.reduce((sum, s) => sum + (s.occupancyCount || 0), 0) / onlineStalls.length)
      : 0;
    const parts: string[] = [];
    if (onlineStalls.length === roomStalls.length && roomStalls.length > 0) {
      parts.push(`All ${onlineStalls.length} stalls online`);
    } else {
      parts.push(`${onlineStalls.length}/${roomStalls.length} stalls online`);
    }
    if (roomIssues === 0) parts.push('No active issues');
    parts.push(`Avg. usage: ${avgOccupancy}`);
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
            : `${bRooms.length} restroom${bRooms.length > 1 ? 's' : ''} · ${onlineCount} online`,
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
          onClick={() => setSelectedRestroom(recommendedRestroom)}
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
              // ── Building interior floor plan ──
              <BuildingFloorPlan
                restrooms={buildingRestrooms}
                stalls={stalls}
                issues={issues}
                recommendedId={recommendedRestroom?.id ?? null}
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
              (() => {
                const bRooms = restrooms.filter(r => r.buildingId === listBuilding.id);
                if (bRooms.length === 0) {
                  return (
                    <div className="py-16 text-center glass-card border-dashed">
                      <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">No restrooms in this building</p>
                    </div>
                  );
                }
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {bRooms.map(restroom => {
                      const rStalls = stalls.filter(s => s.restroomId === restroom.id);
                      const online = rStalls.filter(s => s.status === 'online').length;
                      const issuesCount = issues.filter(i => i.restroomId === restroom.id).length;
                      const isRec = recommendedRestroom?.id === restroom.id;
                      return (
                        <motion.div
                          key={restroom.id}
                          whileHover={{ y: -3, scale: 1.01 }}
                          className={`glass-card p-6 cursor-pointer hover:border-white/20 transition-all group ${
                            isRec ? 'border-sky-500/30 bg-sky-500/5' : ''
                          }`}
                          onClick={() => setSelectedRestroom(restroom)}
                        >
                          <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-white/5 text-slate-400 rounded-xl group-hover:text-sky-400 transition-colors">
                              <MapPin size={20} />
                            </div>
                            <div className="flex items-center gap-2">
                              {isRec && (
                                <span className="text-[8px] font-black text-sky-400 uppercase tracking-widest px-2 py-0.5 bg-sky-500/10 rounded-full border border-sky-500/20">Best Now</span>
                              )}
                              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${
                                isRec
                                  ? 'bg-sky-500/10 border-sky-500/20 text-sky-400'
                                  : online === 0
                                  ? 'bg-slate-500/10 border-slate-500/20 text-slate-500'
                                  : issuesCount > 0
                                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                              }`}>
                                <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                                  isRec ? 'bg-sky-400' : online === 0 ? 'bg-slate-500' : issuesCount > 0 ? 'bg-amber-400' : 'bg-emerald-500'
                                }`} />
                                {online === 0 ? 'Offline' : issuesCount > 0 ? 'Alert' : 'Active'}
                              </div>
                            </div>
                          </div>
                          <h3 className="text-base font-bold text-white mb-0.5 tracking-tight">{restroom.name}</h3>
                          <p className="text-xs text-slate-400 mb-4 flex items-center gap-1.5">
                            <Navigation size={12} /> {restroom.location}
                          </p>
                          <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest">
                            <span className="text-slate-500">{rStalls.length} nodes</span>
                            <span className="text-slate-700">·</span>
                            <span className={online > 0 ? 'text-emerald-500' : 'text-slate-600'}>{online} online</span>
                            {issuesCount > 0 && (
                              <span className="text-amber-400 flex items-center gap-1"><AlertTriangle size={10} /> {issuesCount}</span>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                );
              })()
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
                {/* Node Grid */}
                <section>
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6">Facility Node Network</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {stalls.filter(s => s.restroomId === selectedRestroom.id).map(stall => (
                      <div 
                        key={stall.id}
                        className={`p-5 rounded-2xl border transition-all flex flex-col items-center gap-4 text-center relative overflow-hidden group ${
                          stall.status === 'offline'
                            ? 'bg-red-500/10 border-red-500/30 text-red-100'
                            : 'bg-white/5 border-white/10 text-slate-300'
                        }`}
                      >
                         <div className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full ${
                             stall.status === 'offline' ? 'bg-red-500 animate-pulse' : 'bg-emerald-500 shadow-[0_0_8px_#10b981]'
                        }`} />
                        
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${
                           stall.status === 'offline' ? 'bg-red-500/20' : 'bg-emerald-500/20'
                        }`}>
                          {stall.type === 'stall' ? <Lock size={20} /> : <Circle size={20} />}
                        </div>
                        <div>
                          <p className="text-sm font-bold tracking-tight">{stall.label}</p>
                          <p className="text-[9px] uppercase font-black opacity-60 tracking-widest mt-1">
                            {stall.status === 'offline' ? 'OFFLINE' : 'ONLINE'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

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
