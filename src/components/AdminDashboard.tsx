import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  query,
  where,
  orderBy, 
  doc, 
  updateDoc, 
  deleteDoc, 
  addDoc, 
  increment,
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Building, Restroom, Stall, Issue } from '../types';
import { SensorsPanel } from './SensorsPanel';
import { 
  Activity, 
  AlertCircle, 
  CheckCircle, 
  MoreVertical, 
  Plus, 
  Trash2,
  Zap,
  TrendingUp,
  Clock,
  Wrench,
  ChevronRight,
  Edit2,
  Cpu,
  User,
  ArrowRight,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { seedInitialData } from '../lib/seed';

export const AdminDashboard: React.FC = () => {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [restrooms, setRestrooms] = useState<Restroom[]>([]);
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'issues' | 'sensors'>('overview');
  const [seeding, setSeeding] = useState(false);
  const [selectedNode, setSelectedNode] = useState<{ stall: Stall; restroom: Restroom; building: Building } | null>(null);

  const handleForceSeed = async () => {
    setSeeding(true);
    try {
      await seedInitialData();
    } finally {
      setSeeding(false);
    }
  };

  const handleResetStall = async (stallId: string) => {
    // Calculate peer average to clear the underperforming anomaly check
    const stallDoc = stalls.find(s => s.id === stallId);
    const peers = stallDoc ? stalls.filter(s => s.restroomId === stallDoc.restroomId && s.id !== stallId) : [];
    const peerAvg = peers.length > 0 ? Math.round(peers.reduce((sum, s) => sum + s.occupancyCount, 0) / peers.length) : 0;
    // Set back online and match peer average so underperforming check clears
    await updateDoc(doc(db, 'stalls', stallId), { status: 'online', occupancyCount: Math.max(stallDoc?.occupancyCount ?? 0, peerAvg) });
    // Resolve all pending issues on this stall
    const pendingSnap = await getDocs(
      query(collection(db, 'issues'), where('stallId', '==', stallId), where('status', '==', 'pending'))
    );
    await Promise.all(pendingSnap.docs.map(d => updateDoc(d.ref, { status: 'resolved' })));
    setSelectedNode(prev => prev?.stall.id === stallId ? null : prev);
  };

  // Modal state
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [inputModal, setInputModal] = useState<{ fields: { label: string; placeholder?: string; defaultValue?: string }[]; onSubmit: (values: string[]) => void; title: string } | null>(null);
  const [inputValues, setInputValues] = useState<string[]>([]);

  const showConfirm = (message: string, onConfirm: () => void) => {
    setConfirmModal({ message, onConfirm });
  };

  const showInputs = (title: string, fields: { label: string; placeholder?: string; defaultValue?: string }[], onSubmit: (values: string[]) => void) => {
    setInputValues(fields.map(f => f.defaultValue || ''));
    setInputModal({ title, fields, onSubmit });
  };

  useEffect(() => {
    seedInitialData();
    const unsubscribeB = onSnapshot(query(collection(db, 'buildings')), (snapshot) => {
      setBuildings(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Building)));
    });
    const unsubscribeR = onSnapshot(query(collection(db, 'restrooms')), (snapshot) => {
      setRestrooms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Restroom)));
    });

    const unsubscribeS = onSnapshot(query(collection(db, 'stalls')), (snapshot) => {
      setStalls(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Stall)));
    });

    const unsubscribeI = onSnapshot(query(collection(db, 'issues'), orderBy('reportedAt', 'desc')), (snapshot) => {
      setIssues(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Issue)));
    });

    return () => {
      unsubscribeB();
      unsubscribeR();
      unsubscribeS();
      unsubscribeI();
    };
  }, []);

  const resolveIssue = async (id: string) => {
    try {
      await updateDoc(doc(db, 'issues', id), { status: 'resolved' });
    } catch (e) {
      console.error(e);
    }
  };

  const deleteRestroom = async (id: string) => {
    showConfirm("Delete this block? All its stalls will be removed too.", async () => {
      const stallsSnap = await getDocs(query(collection(db, 'stalls'), where('restroomId', '==', id)));
      await Promise.all(stallsSnap.docs.map(s => deleteDoc(s.ref)));
      await deleteDoc(doc(db, 'restrooms', id));
    });
  }

  const editRestroom = async (restroom: Restroom) => {
    showInputs('Edit Block', [
      { label: 'Name', defaultValue: restroom.name },
      { label: 'Location', defaultValue: restroom.location },
    ], async ([name, location]) => {
      if (name && location) {
        await updateDoc(doc(db, 'restrooms', restroom.id), { name, location });
      }
    });
  }

  const addStall = async (restroomId: string) => {
    showInputs('Provision Node', [
      { label: 'Label', placeholder: 'e.g. Stall 1, Urinal A' },
      { label: "Type ('stall' or 'urinal')", placeholder: 'stall' },
    ], async ([label, type]) => {
      if (!label) return;
      await addDoc(collection(db, 'stalls'), {
        restroomId,
        label,
        type: type === 'urinal' ? 'urinal' : 'stall',
        status: 'online',
        occupancyCount: 0,
      });
      await updateDoc(doc(db, 'restrooms', restroomId), { totalStalls: increment(1) });
    });
  };

  const deleteStall = async (stall: Stall) => {
    showConfirm(`Delete "${stall.label}"?`, async () => {
      await deleteDoc(doc(db, 'stalls', stall.id));
      await updateDoc(doc(db, 'restrooms', stall.restroomId), { totalStalls: increment(-1) });
    });
  };

  const anomalies = stalls.filter(s => {
    const peers = stalls.filter(other => other.restroomId === s.restroomId && other.id !== s.id);
    const highUsagePeers = peers.filter(other => other.occupancyCount > 10);
    const isUnderperforming = s.occupancyCount === 0 && highUsagePeers.length >= 2;
    return isUnderperforming || s.status === 'offline';
  });

  // Auto-create a system issue the first time each stall becomes anomalous
  const autoIssuedRef = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    if (stalls.length === 0) return;
    anomalies.forEach(async (stall) => {
      if (autoIssuedRef.current.has(stall.id)) return;
      // Don't duplicate if a pending system issue already exists for this stall
      const alreadyOpen = issues.some(i => i.stallId === stall.id && i.status === 'pending' && i.source === 'system');
      if (alreadyOpen) { autoIssuedRef.current.add(stall.id); return; }
      autoIssuedRef.current.add(stall.id);
      const issueType: import('../types').IssueType = stall.status === 'offline' ? 'sensor_glitch' : 'extended_occupancy';
      await addDoc(collection(db, 'issues'), {
        restroomId: stall.restroomId,
        stallId: stall.id,
        type: issueType,
        status: 'pending',
        reportedAt: serverTimestamp(),
        reportedBy: 'system',
        source: 'system',
        nodeLabel: stall.label,
        scenario: stall.status === 'offline' ? 'node_offline' : 'zero_usage',
        sensorConf: stall.status === 'offline' ? 0.95 : 0.75,
      });
    });
    // Clear tracking for stalls that are no longer anomalous (so they can re-trigger if they go bad again)
    const anomalyIds = new Set(anomalies.map(s => s.id));
    autoIssuedRef.current.forEach(id => {
      if (!anomalyIds.has(id)) autoIssuedRef.current.delete(id);
    });
  }, [anomalies.map(s => s.id).sort().join(','), issues]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 pb-20"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Facility Console</h2>
          <p className="text-slate-400">Live analytics and anomaly detection system.</p>
        </div>
        <div className="flex items-center gap-3">
          {restrooms.length === 0 && (
            <button
              onClick={handleForceSeed}
              disabled={seeding}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-[#0f172a] font-black text-[10px] uppercase tracking-widest rounded-xl transition-all active:scale-95"
            >
              {seeding ? 'Provisioning…' : 'Provision Data'}
            </button>
          )}
          <div className="flex gap-2 p-1 glass rounded-2xl w-fit">
            {['overview', 'issues', 'sensors'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                  activeTab === tab 
                    ? 'bg-sky-500 text-[#0f172a] shadow-lg shadow-sky-500/20' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total Stalls" value={stalls.filter(s => restrooms.some(r => r.id === s.restroomId)).length} icon={<Zap className="text-blue-400" />} />
        <StatCard title="Pending Issues" value={issues.filter(i => i.status === 'pending').length} icon={<AlertCircle className="text-amber-400" />} />
        <StatCard title="Anomalies Found" value={anomalies.length} icon={<AlertCircle className="text-red-400" />} />
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (() => {
          const handleNodeSelect = (s: Stall) => {
            const r = restrooms.find(r => r.id === s.restroomId);
            const b = r ? buildings.find(b => b.id === r.buildingId) : undefined;
            if (r && b) setSelectedNode({ stall: s, restroom: r, building: b });
          };
          const nodeIssues = selectedNode
            ? issues.filter(i => i.stallId === selectedNode.stall.id || i.restroomId === selectedNode.stall.restroomId)
            : [];
          const restroomStalls = selectedNode
            ? stalls.filter(s => s.restroomId === selectedNode.stall.restroomId)
            : [];
          const maxInRoom = Math.max(1, ...restroomStalls.map(s => s.occupancyCount));
          const usagePct = selectedNode ? Math.round((selectedNode.stall.occupancyCount / maxInRoom) * 100) : 0;
          return (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              <div className="lg:col-span-2 glass-card p-8 bg-white/[0.02]">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2 tracking-tight">
                    <TrendingUp size={20} className="text-sky-400" />
                    Node Usage Map
                  </h3>
                  <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">tap a node to inspect · size = relative usage · red = offline</span>
                </div>
                <NodeUsageMap
                  buildings={buildings}
                  restrooms={restrooms}
                  stalls={stalls}
                  selectedId={selectedNode?.stall.id ?? null}
                  onSelect={handleNodeSelect}
                />
              </div>

              {/* Right panel: node detail or anomaly list */}
              <div className="glass-card p-8 flex flex-col bg-white/[0.02]">
                <AnimatePresence mode="wait">
                  {selectedNode ? (
                    <motion.div key="detail" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="flex flex-col h-full gap-5">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">{selectedNode.building.name} · {selectedNode.restroom.name}</p>
                          <h3 className="text-xl font-black text-white tracking-tight">{selectedNode.stall.label}</h3>
                          <p className="text-[9px] font-black uppercase tracking-widest mt-1 text-slate-500">{selectedNode.stall.type}</p>
                        </div>
                        <button onClick={() => setSelectedNode(null)} className="p-2 text-slate-600 hover:text-white rounded-lg transition-colors shrink-0">
                          <X size={16} />
                        </button>
                      </div>

                      {/* Status badge */}
                      <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${
                        selectedNode.stall.status === 'online'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-red-500/10 border-red-500/30 text-red-400'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${selectedNode.stall.status === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                          {selectedNode.stall.status === 'online' ? 'Online' : 'Offline'}
                        </span>
                      </div>

                      {/* Usage stats */}
                      <div className="space-y-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Usage</p>
                        <div className="flex items-end gap-3">
                          <span className="text-3xl font-black text-white tracking-tighter">{selectedNode.stall.occupancyCount}</span>
                          <span className="text-xs text-slate-500 font-bold pb-1">total uses</span>
                        </div>
                        {/* Relative bar */}
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">vs. room avg</span>
                            <span className="text-[9px] text-slate-500 font-bold">{usagePct}%</span>
                          </div>
                          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                usagePct > 80 ? 'bg-emerald-400' : usagePct > 40 ? 'bg-sky-400' : 'bg-slate-600'
                              }`}
                              style={{ width: `${usagePct}%` }}
                            />
                          </div>
                          <p className="text-[9px] text-slate-600 mt-1">
                            {usagePct > 80 ? 'High usage — monitor closely' : usagePct > 40 ? 'Normal usage' : 'Low usage — possible sensor issue'}
                          </p>
                        </div>
                      </div>

                      {/* Issues on this node */}
                      <div className="flex-1 min-h-0">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">
                          Issues ({nodeIssues.filter(i => i.status === 'pending').length} pending)
                        </p>
                        <div className="space-y-2 overflow-y-auto max-h-[140px]">
                          {nodeIssues.length === 0 ? (
                            <div className="flex items-center gap-2 text-slate-700">
                              <CheckCircle size={14} className="text-emerald-500/40" />
                              <span className="text-[9px] font-bold uppercase tracking-widest">No issues reported</span>
                            </div>
                          ) : nodeIssues.map(i => (
                            <div key={i.id} className={`px-3 py-2 rounded-xl border text-[9px] font-black uppercase tracking-widest flex items-center gap-2 ${
                              i.status === 'pending'
                                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                : 'bg-white/5 border-white/5 text-slate-600'
                            }`}>
                              {i.source === 'system' ? <Cpu size={10} /> : <User size={10} />}
                              {i.type.replace(/_/g, ' ')}
                              {i.status === 'resolved' && ' · resolved'}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Reset button — only show when offline or flagged */}
                      {(selectedNode.stall.status === 'offline' || anomalies.some(a => a.id === selectedNode.stall.id)) && (
                        <button
                          onClick={() => handleResetStall(selectedNode.stall.id)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all active:scale-95"
                        >
                          <CheckCircle size={14} />
                          Mark as Resolved / Reset Sensor
                        </button>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div key="anomalies" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="flex flex-col h-full">
                      <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2 tracking-tight">
                        <AlertCircle size={20} className="text-red-500" />
                        Active Anomalies
                      </h3>
                      <div className="space-y-3 flex-1 overflow-y-auto max-h-[300px] pr-2">
                        {anomalies.length === 0 ? (
                          <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 bg-white/[0.02] rounded-2xl border border-dashed border-white/10 h-full">
                            <CheckCircle size={32} className="mb-3 text-emerald-500/50" />
                            <p className="text-xs font-bold uppercase tracking-widest">Normal Ops</p>
                          </div>
                        ) : anomalies.map(s => (
                          <div
                            key={s.id}
                            className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-4 group hover:border-red-500/40 transition-all"
                          >
                            <div className="p-2 bg-red-500/20 rounded-lg text-red-500 animate-pulse cursor-pointer" onClick={() => handleNodeSelect(s)}>
                              <AlertCircle size={18} />
                            </div>
                            <div className="flex-1 cursor-pointer" onClick={() => handleNodeSelect(s)}>
                              <p className="text-sm font-bold text-red-100">{s.label}</p>
                              <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest opacity-80 mt-0.5">
                                {s.status === 'offline' ? 'Node Offline' : 'Sensor Deviation'}
                              </p>
                            </div>
                            <button
                              onClick={e => { e.stopPropagation(); handleResetStall(s.id); }}
                              title="Mark resolved & reset sensor"
                              className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/20 text-emerald-400 transition-all active:scale-95 shrink-0"
                            >
                              <CheckCircle size={15} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })()}

        {activeTab === 'issues' && (
           <motion.div 
             key="issues"
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             className="space-y-4"
           >
             <div className="glass-card overflow-hidden bg-white/[0.02]">
               <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse min-w-[900px]">
                   <thead>
                     <tr className="bg-white/[0.03] border-b border-white/5">
                       <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Source</th>
                       <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Defect Type</th>
                       <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Facility / Node</th>
                       <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Sensor Conf</th>
                       <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Timestamp</th>
                       <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Actions</th>
                     </tr>
                   </thead>
                   <tbody>
                     {issues.length === 0 ? (
                       <tr>
                         <td colSpan={6} className="p-20 text-center text-slate-500 font-bold uppercase tracking-widest opacity-20">Clear Queue (No reports)</td>
                       </tr>
                     ) : issues.map(i => {
                       const isSystem = i.source === 'system';
                       const restroom = restrooms.find(r => r.id === i.restroomId);
                       const typeLabel = i.type === 'extended_occupancy' ? 'Extended Occupancy'
                         : i.type === 'sensor_glitch' ? 'Sensor Glitch'
                         : i.type.replace(/_/g, ' ');
                       return (
                         <tr key={i.id} className={`border-b border-white/5 transition-colors ${i.status === 'resolved' ? 'opacity-20 grayscale pointer-events-none' : 'hover:bg-white/[0.02]'}`}>
                           <td className="p-5">
                             {isSystem ? (
                               <div className="flex items-center gap-2">
                                 <div className="w-7 h-7 bg-sky-500/10 text-sky-400 rounded-lg flex items-center justify-center border border-sky-500/20">
                                   <Cpu size={12} />
                                 </div>
                                 <span className="text-[10px] font-black text-sky-400 uppercase tracking-widest">System</span>
                               </div>
                             ) : (
                               <div className="flex items-center gap-2">
                                 <div className="w-7 h-7 bg-slate-500/10 text-slate-400 rounded-lg flex items-center justify-center border border-slate-500/20">
                                   <User size={12} />
                                 </div>
                                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                   {i.reportedBy === 'ml-system' ? 'ML' : `ID-${i.reportedBy.slice(0, 6)}`}
                                 </span>
                               </div>
                             )}
                           </td>
                           <td className="p-5">
                             <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                               i.status === 'pending'
                                 ? isSystem
                                   ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                   : 'bg-amber-500/20 text-amber-500 border-amber-500/30'
                                 : 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30'
                             }`}>
                               {typeLabel}
                             </span>
                           </td>
                           <td className="p-5">
                             <p className="text-sm font-bold text-slate-300">{restroom?.name ?? 'Unknown'}</p>
                             {i.nodeLabel && (
                               <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mt-0.5">{i.nodeLabel}</p>
                             )}
                           </td>
                           <td className="p-5">
                             {i.sensorConf != null ? (
                               <div className="flex items-center gap-2">
                                 <div className="flex-1 max-w-[60px] h-1.5 bg-white/10 rounded-full overflow-hidden">
                                   <div
                                     className={`h-full rounded-full ${i.sensorConf > 0.8 ? 'bg-emerald-400' : i.sensorConf > 0.5 ? 'bg-amber-400' : 'bg-red-400'}`}
                                     style={{ width: `${i.sensorConf * 100}%` }}
                                   />
                                 </div>
                                 <span className="text-[9px] text-slate-500 font-bold">{Math.round(i.sensorConf * 100)}%</span>
                               </div>
                             ) : (
                               <span className="text-[9px] text-slate-700">—</span>
                             )}
                           </td>
                           <td className="p-5 text-xs text-slate-500 font-medium">
                             {i.reportedAt?.toDate().toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                           </td>
                           <td className="p-5">
                             <div className="flex items-center gap-2">
                               {i.status === 'pending' && (
                                 <>
                                   <button
                                     onClick={() => resolveIssue(i.id)}
                                     className="p-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 rounded-lg transition-all active:scale-90"
                                     title="Mark resolved"
                                   >
                                     <CheckCircle size={16} />
                                   </button>
                                   <button
                                     onClick={() => setActiveTab('sensors')}
                                     className="p-2 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 rounded-lg transition-all active:scale-90"
                                     title="Investigate in Sensors"
                                   >
                                     <ArrowRight size={16} />
                                   </button>
                                 </>
                               )}
                             </div>
                           </td>
                         </tr>
                       );
                     })}
                   </tbody>
                 </table>
               </div>
             </div>
           </motion.div>
        )}

        {activeTab === 'sensors' && (
           <motion.div
             key="sensors"
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
           >
             <SensorsPanel
               buildings={buildings}
               restrooms={restrooms}
               stalls={stalls}
             />
           </motion.div>
        )}

      </AnimatePresence>

      {/* Confirm modal */}
      <AnimatePresence>
        {confirmModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card p-8 max-w-sm w-full space-y-6"
            >
              <p className="text-white font-bold text-center">{confirmModal.message}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmModal(null)}
                  className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 hover:text-white transition-colors font-bold text-sm"
                >Cancel</button>
                <button
                  onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-colors"
                >Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input modal */}
      <AnimatePresence>
        {inputModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card p-8 max-w-sm w-full space-y-6"
            >
              <h3 className="text-white font-bold text-lg">{inputModal.title}</h3>
              <div className="space-y-4">
                {inputModal.fields.map((f, i) => (
                  <div key={i}>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{f.label}</label>
                    <input
                      value={inputValues[i] || ''}
                      onChange={e => setInputValues(v => { const n = [...v]; n[i] = e.target.value; return n; })}
                      placeholder={f.placeholder}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-sky-500/50"
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setInputModal(null)}
                  className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 hover:text-white transition-colors font-bold text-sm"
                >Cancel</button>
                <button
                  onClick={() => { inputModal.onSubmit(inputValues); setInputModal(null); }}
                  className="flex-1 py-3 rounded-xl bg-sky-500 text-white font-bold text-sm hover:bg-sky-600 transition-colors"
                >Confirm</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const StatCard = ({ title, value, icon }: { title: string, value: any, icon: React.ReactNode }) => (
  <div className="glass-card p-6 bg-white/[0.02] flex items-center justify-between group hover:border-white/20 transition-all">
    <div>
      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{title}</p>
      <p className="text-3xl font-black text-white tracking-tighter">{value}</p>
    </div>
    <div className="p-4 bg-white/5 rounded-2xl group-hover:bg-white/10 transition-colors">
      {icon}
    </div>
  </div>
);

// ── Node Usage Map ───────────────────────────────────────────────────────────
interface NodeUsageMapProps {
  buildings: Building[];
  restrooms: Restroom[];
  stalls: Stall[];
  selectedId: string | null;
  onSelect: (s: Stall) => void;
}

function NodeUsageMap({ buildings, restrooms, stalls, selectedId, onSelect }: NodeUsageMapProps) {
  if (buildings.length === 0) {
    return (
      <div className="py-16 text-center text-slate-600 text-xs font-bold uppercase tracking-widest">
        No facility data yet
      </div>
    );
  }

  return (
    <div className="space-y-6 overflow-y-auto max-h-[420px] pr-1">
      {buildings.map(b => {
        const bRooms = restrooms.filter(r => r.buildingId === b.id);
        if (bRooms.length === 0) return null;
        return (
          <div key={b.id}>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-3">{b.name}</p>
            <div className="space-y-3">
              {bRooms.map(r => {
                const rStalls = stalls.filter(s => s.restroomId === r.id);
                const maxUsage = Math.max(1, ...rStalls.map(s => s.occupancyCount));
                return (
                  <div key={r.id} className="p-4 bg-white/[0.02] rounded-2xl border border-white/5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-3">{r.name}</p>
                    <div className="flex flex-wrap gap-2">
                      {rStalls.map(s => {
                        const isOffline = s.status === 'offline';
                        const intensity = isOffline ? 0 : s.occupancyCount / maxUsage;
                        // Color: offline=red, low=slate, high=sky→emerald
                        const bg = isOffline
                          ? 'rgba(239,68,68,0.7)'
                          : `rgba(${Math.round(56 + (16 - 56) * intensity)},${Math.round(189 + (185 - 189) * intensity)},${Math.round(248 + (129 - 248) * intensity)},${0.15 + intensity * 0.7})`;
                        const border = isOffline ? 'border-red-500/50' : intensity > 0.6 ? 'border-sky-500/40' : 'border-white/10';
                        // Node size scales with usage (32–52px)
                        const size = Math.round(32 + intensity * 20);
                        return (
                          <div
                            key={s.id}
                            onClick={() => onSelect(s)}
                            title={`${s.label} · ${s.occupancyCount} uses${isOffline ? ' · OFFLINE' : ''}`}
                            className={`relative flex flex-col items-center justify-center rounded-xl border transition-all cursor-pointer ${
                              selectedId === s.id
                                ? 'ring-2 ring-white/50 ring-offset-1 ring-offset-transparent scale-110'
                                : 'hover:scale-105'
                            } ${border}`}
                            style={{ width: size, height: size, backgroundColor: bg }}
                          >
                            <span className="text-[7px] font-black text-white/70 leading-tight text-center px-0.5 truncate w-full text-center">
                              {s.type === 'urinal' ? 'U' : 'S'}{s.label.match(/(\d+)$/)?.[1] ?? ''}
                            </span>
                            <span className="text-[7px] text-white/50 font-bold leading-none">{s.occupancyCount}</span>
                            {isOffline && (
                              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-[#0f172a] animate-pulse" />
                            )}
                          </div>
                        );
                      })}
                      {rStalls.length === 0 && (
                        <span className="text-[9px] text-slate-700 italic">No nodes provisioned</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

