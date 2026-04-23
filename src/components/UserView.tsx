import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Restroom, Stall, Issue, IssueType } from '../types';
import { useAuth } from '../App';
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
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const UserView: React.FC = () => {
  const { user } = useAuth();
  const [restrooms, setRestrooms] = useState<Restroom[]>([]);
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedRestroom, setSelectedRestroom] = useState<Restroom | null>(null);
  const [isReporting, setIsReporting] = useState(false);
  const [reportData, setReportData] = useState<{ type: IssueType; stallId?: string }>({ type: 'unclean' });

  useEffect(() => {
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
      <header className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold text-white">Facility Status</h2>
        <p className="text-slate-400">Real-time restroom availability and maintenance reporting.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {restrooms.length === 0 ? (
          <div className="col-span-full py-20 text-center glass-card border-dashed">
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-500">
               <AlertCircle size={32} />
            </div>
            <p className="text-slate-500 font-bold uppercase tracking-widest">No Facility Data Available</p>
            <p className="text-xs text-slate-600 mt-2">The system is awaiting initial sensor provisioning by an administrator.</p>
          </div>
        ) : restrooms.map(restroom => {
          const issuesCount = issues.filter(i => i.restroomId === restroom.id).length;
          
          return (
            <motion.div 
              key={restroom.id}
              whileHover={{ y: -4, scale: 1.02 }}
              className="glass-card p-6 cursor-pointer hover:border-white/20 transition-all group"
              onClick={() => setSelectedRestroom(restroom)}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-white/5 text-slate-400 rounded-xl group-hover:text-sky-400 transition-colors">
                  <MapPin size={24} />
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                  <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Active</span>
                </div>
              </div>
              
              <h3 className="text-lg font-bold text-white mb-1 tracking-tight">{restroom.name}</h3>
              <p className="text-sm text-slate-400 mb-6 flex items-center gap-1.5">
                <Navigation size={14} />
                {restroom.location}
              </p>

              <div className="space-y-3">
                <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                  <span className="text-emerald-400">System Monitoring Active</span>
                  {issuesCount > 0 && (
                    <span className="text-amber-400 flex items-center gap-1">
                      <AlertTriangle size={12} /> Alert
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

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

                {/* Reporting */}
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
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );

};
