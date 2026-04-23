import React, { useState, useEffect } from 'react';
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
import { Restroom, Stall, Issue } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line
} from 'recharts';
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
  Edit2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { seedInitialData } from '../lib/seed';

export const AdminDashboard: React.FC = () => {
  const [restrooms, setRestrooms] = useState<Restroom[]>([]);
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'issues' | 'sensors'>('overview');

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

  // Analytics Helpers
  const analyticsData = restrooms.map(r => ({
    name: r.name,
    usage: stalls.filter(s => s.restroomId === r.id).reduce((acc, curr) => acc + curr.occupancyCount, 0),
    stalls: r.totalStalls,
    issues: issues.filter(i => i.restroomId === r.id && i.status === 'pending').length
  }));

  const anomalies = stalls.filter(s => {
    const isUnderperforming = s.occupancyCount === 0 && stalls.filter(other => other.restroomId === s.restroomId && other.id !== s.id).some(other => other.occupancyCount > 5);
    return isUnderperforming || s.status === 'offline';
  });

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total Stalls" value={stalls.filter(s => restrooms.some(r => r.id === s.restroomId)).length} icon={<Zap className="text-blue-400" />} />
        <StatCard title="Pending Issues" value={issues.filter(i => i.status === 'pending').length} icon={<AlertCircle className="text-amber-400" />} />
        <StatCard title="Anomalies Found" value={anomalies.length} icon={<AlertCircle className="text-red-400" />} />
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div 
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            <div className="lg:col-span-2 glass-card p-8 bg-white/[0.02]">
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2 tracking-tight">
                        <TrendingUp size={20} className="text-sky-400" />
                        Usage Heatmap (Events by Zone)
                    </h3>
                </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} style={{ fontSize: '10px', fontWeight: 600, fill: '#94a3b8' }} />
                    <YAxis axisLine={false} tickLine={false} style={{ fontSize: '10px', fill: '#94a3b8' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'rgba(15,23,42,0.9)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', color: '#fff' }} 
                    />
                    <Bar dataKey="usage" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-card p-8 flex flex-col bg-white/[0.02]">
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
                ) : (
                    anomalies.map(s => (
                        <div key={s.id} className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-4 group hover:border-red-500/40 transition-all">
                           <div className="p-2 bg-red-500/20 rounded-lg text-red-500 animate-pulse">
                             <AlertCircle size={18} />
                           </div>
                           <div className="flex-1">
                             <p className="text-sm font-bold text-red-100">{s.label}</p>
                             <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest opacity-80 mt-0.5">
                               {s.status === 'offline' ? 'Node Offline' : 'Sensor Deviation'}
                             </p>
                           </div>
                           <ChevronRight size={16} className="text-red-500/50 group-hover:translate-x-1 transition-transform" />
                        </div>
                    ))
                )}
              </div>
            </div>

            {/* removed predictive routing section */}
          </motion.div>
        )}

        {activeTab === 'issues' && (
           <motion.div 
             key="issues"
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             className="glass-card overflow-hidden bg-white/[0.02]"
           >
             <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-white/[0.03] border-b border-white/5">
                        <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Reporter</th>
                        <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Defect Type</th>
                        <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Facility block</th>
                        <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Timestamp</th>
                        <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Operations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issues.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="p-20 text-center text-slate-500 font-bold uppercase tracking-widest opacity-20">Clear Queue (No reports)</td>
                        </tr>
                    ) : issues.map(i => (
                        <tr key={i.id} className={`border-b border-white/5 transition-colors ${i.status === 'resolved' ? 'opacity-20 grayscale pointer-events-none' : 'hover:bg-white/[0.02]'}`}>
                            <td className="p-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-sky-500/10 text-sky-400 rounded-lg flex items-center justify-center border border-sky-500/20">
                                        <Activity size={14} />
                                    </div>
                                    <span className="text-sm font-bold text-slate-200">ID-{i.reportedBy.slice(0, 6)}</span>
                                </div>
                            </td>
                            <td className="p-6">
                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                    i.status === 'pending' ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                                }`}>
                                    {i.type.replace('_', ' ')}
                                </span>
                            </td>
                            <td className="p-6">
                                <p className="text-sm font-bold text-slate-300">
                                  {restrooms.find(r => r.id === i.restroomId)?.name || 'Unknown Zone'}
                                </p>
                            </td>
                            <td className="p-6 text-xs text-slate-500 font-medium">
                              {i.reportedAt?.toDate().toLocaleTimeString()}
                            </td>
                            <td className="p-6">
                              {i.status === 'pending' && (
                                <button 
                                  onClick={() => resolveIssue(i.id)}
                                  className="p-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 rounded-lg transition-all active:scale-90"
                                  title="Resolve"
                                >
                                  <CheckCircle size={18} />
                                </button>
                              )}
                            </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
             </div>
           </motion.div>
        )}

        {activeTab === 'sensors' && (
           <motion.div 
             key="sensors"
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
           >
             {restrooms.map(r => (
               <div key={r.id} className="glass-card p-6 bg-white/[0.02] hover:border-white/20 transition-all group">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                        <h4 className="font-bold text-lg text-white group-hover:text-sky-400 transition-colors tracking-tight">{r.name}</h4>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">{r.location}</p>
                    </div>
                    <div className="flex gap-1">
                        <button 
                            onClick={() => editRestroom(r)}
                            className="p-2 text-white/10 hover:text-sky-400 rounded-lg transition-colors"
                            title="Edit Block"
                        >
                            <Edit2 size={16} />
                        </button>
                        <button 
                            onClick={() => deleteRestroom(r.id)}
                            className="p-2 text-white/10 hover:text-red-500 rounded-lg transition-colors"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {stalls.filter(s => s.restroomId === r.id).map(s => (
                        <div key={s.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                            <span className="text-xs font-bold text-slate-300">{s.label}</span>
                            <div className="flex items-center gap-2">
                                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${
                                    s.status === 'online' ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' : 'bg-red-500/20 text-red-500 border border-red-500/30'
                                }`}>
                                    {s.status === 'online' ? 'ONLINE' : 'OFFLINE'}
                                </span>
                                <button
                                    onClick={() => deleteStall(s)}
                                    className="p-1 text-white/10 hover:text-red-500 rounded transition-colors"
                                    title="Delete stall"
                                >
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        </div>
                    ))}
                    <button
                        onClick={() => addStall(r.id)}
                        className="w-full py-3 border border-dashed border-white/10 text-slate-500 rounded-xl hover:border-white/20 hover:text-slate-300 transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest mt-4"
                    >
                        <Plus size={14} /> Provision Node
                    </button>
                  </div>
               </div>
             ))}
             <button 
               className="p-8 border-2 border-dashed border-white/5 rounded-[2.5rem] text-slate-600 hover:text-sky-500 hover:border-sky-500/30 hover:bg-sky-500/5 transition-all flex flex-col items-center justify-center gap-6 group"
               onClick={() => showInputs('Deploy Block', [
                 { label: 'Name', placeholder: 'e.g. North Wing' },
                 { label: 'Location', placeholder: 'e.g. Floor 1, North' },
               ], ([name, location]) => {
                 if (name && location) addDoc(collection(db, 'restrooms'), { name, location, totalStalls: 0, activeIssues: 0 });
               })}
             >
                <div className="w-16 h-16 glass rounded-2xl flex items-center justify-center shadow-2xl group-hover:rotate-6 transition-transform">
                    <Plus size={32} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 group-hover:opacity-100 transition-opacity">Deploy Block</span>
             </button>
           </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Modal */}
      <AnimatePresence>
        {confirmModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
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

      {/* Input Modal */}
      <AnimatePresence>
        {inputModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card p-8 max-w-sm w-full space-y-5"
            >
              <h3 className="text-white font-bold text-lg tracking-tight">{inputModal.title}</h3>
              {inputModal.fields.map((field, i) => (
                <div key={i} className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{field.label}</label>
                  <input
                    value={inputValues[i] || ''}
                    onChange={e => setInputValues(v => { const next = [...v]; next[i] = e.target.value; return next; })}
                    placeholder={field.placeholder}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-sky-500/50"
                  />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
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

