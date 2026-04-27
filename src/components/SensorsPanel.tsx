/**
 * SensorsPanel
 * ─────────────────────────────────────────────────────
 * Three-level drill-down hierarchy for the Admin "Sensors" tab:
 *   1. Buildings  — add / edit (name, location, map position)
 *   2. Restrooms  — add / edit  per building
 *   3. Stalls     — add / edit / toggle  per restroom
 *
 * Navigation: Campus → Building → Restroom
 */
import React, { useState, useMemo } from 'react';
import {
  collection, addDoc, updateDoc, deleteDoc, getDocs,
  doc, query, where, increment,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Building, Restroom, Stall, StallType } from '../types';
import { BuildingPickerMap } from './BuildingPickerMap';
import { BuildingFloorPlan } from './BuildingFloorPlan';
import {
  Plus, Trash2, Edit2, ChevronLeft, Building2,
  DoorOpen, CheckCircle2, XCircle, Save, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  buildings: Building[];
  restrooms: Restroom[];
  stalls: Stall[];
}

// ── Small helpers ──────────────────────────────────────────────────────────────
const STALL_TYPES: StallType[] = ['stall', 'urinal'];

// ── Sub-component: Building form (add / edit) ──────────────────────────────────
interface BuildingFormProps {
  initial?: Building;
  onSave: (data: Omit<Building, 'id'>) => Promise<void>;
  onClose: () => void;
}

const BuildingForm: React.FC<BuildingFormProps> = ({ initial, onSave, onClose }) => {
  const [name, setName]       = useState(initial?.name     ?? '');
  const [location, setLoc]    = useState(initial?.location ?? '');
  const [lat, setLat]         = useState<number>(initial?.lat ?? 41.6617);
  const [lng, setLng]         = useState<number>(initial?.lng ?? -91.5364);
  const [saving, setSaving]   = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !location.trim()) return;
    setSaving(true);
    await onSave({ name: name.trim(), location: location.trim(), lat, lng });
    setSaving(false);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm px-4 py-8 overflow-y-auto"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="glass-card p-8 w-full max-w-lg space-y-6 mt-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold text-lg tracking-tight">
            {initial ? 'Edit Building' : 'Add Building'}
          </h3>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Name & location */}
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Building Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Seaman Center"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-sky-500/50"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Location / Description</label>
            <input
              value={location}
              onChange={e => setLoc(e.target.value)}
              placeholder="e.g. East Campus · Engineering"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-sky-500/50"
            />
          </div>
        </div>

        {/* Coordinate display */}
        <div className="flex gap-3">
          <div className="flex-1 space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Latitude</label>
            <input
              type="number" step="0.00001"
              value={lat}
              onChange={e => setLat(parseFloat(e.target.value))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-sky-500/50"
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Longitude</label>
            <input
              type="number" step="0.00001"
              value={lng}
              onChange={e => setLng(parseFloat(e.target.value))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-sky-500/50"
            />
          </div>
        </div>

        {/* Map picker */}
        <BuildingPickerMap
          initialLat={lat}
          initialLng={lng}
          onChange={(newLat, newLng) => { setLat(newLat); setLng(newLng); }}
        />

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 hover:text-white transition-colors font-bold text-sm"
          >Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || !location.trim()}
            className="flex-1 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-[#0f172a] font-black text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Save size={15} />
            {saving ? 'Saving…' : 'Save Building'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── Sub-component: Restroom form ───────────────────────────────────────────────
interface RestroomFormProps {
  initial?: Restroom;
  buildingId: string;
  onSave: (data: Omit<Restroom, 'id'>) => Promise<void>;
  onClose: () => void;
}

const RestroomForm: React.FC<RestroomFormProps> = ({ initial, buildingId, onSave, onClose }) => {
  const [name, setName]     = useState(initial?.name     ?? '');
  const [location, setLoc]  = useState(initial?.location ?? '');
  const [mapX, setMapX]     = useState(initial?.mapX ?? 50);
  const [mapY, setMapY]     = useState(initial?.mapY ?? 50);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !location.trim()) return;
    setSaving(true);
    await onSave({
      buildingId,
      name: name.trim(),
      location: location.trim(),
      totalStalls: initial?.totalStalls ?? 0,
      activeIssues: initial?.activeIssues ?? 0,
      mapX, mapY,
    });
    setSaving(false);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="glass-card p-8 w-full max-w-sm space-y-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold text-lg tracking-tight">
            {initial ? 'Edit Restroom' : 'Add Restroom'}
          </h3>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Lobby Restroom"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-sky-500/50"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Location</label>
          <input
            value={location}
            onChange={e => setLoc(e.target.value)}
            placeholder="e.g. Ground Floor, East Wing"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-sky-500/50"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
            Position on floor plan (0–100)
          </label>
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <span className="text-[9px] text-slate-600 uppercase tracking-wider">X (left ↔ right)</span>
              <input
                type="range" min="5" max="95" value={mapX}
                onChange={e => setMapX(Number(e.target.value))}
                className="w-full accent-sky-500"
              />
              <span className="text-[9px] text-slate-500">{mapX}</span>
            </div>
            <div className="flex-1 space-y-1">
              <span className="text-[9px] text-slate-600 uppercase tracking-wider">Y (top ↕ bottom)</span>
              <input
                type="range" min="5" max="95" value={mapY}
                onChange={e => setMapY(Number(e.target.value))}
                className="w-full accent-sky-500"
              />
              <span className="text-[9px] text-slate-500">{mapY}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 hover:text-white transition-colors font-bold text-sm">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || !location.trim()}
            className="flex-1 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-[#0f172a] font-black text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Save size={15} />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── Sub-component: Stall form ──────────────────────────────────────────────────
interface StallFormProps {
  initial?: Stall;
  restroomId: string;
  onSave: (data: Omit<Stall, 'id'>) => Promise<void>;
  onClose: () => void;
}

const StallForm: React.FC<StallFormProps> = ({ initial, restroomId, onSave, onClose }) => {
  const [label, setLabel]   = useState(initial?.label  ?? '');
  const [type, setType]     = useState<StallType>(initial?.type ?? 'stall');
  const [status, setStatus] = useState(initial?.status ?? 'online');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!label.trim()) return;
    setSaving(true);
    await onSave({
      restroomId,
      label: label.trim(),
      type,
      status: status as 'online' | 'offline',
      occupancyCount: initial?.occupancyCount ?? 0,
    });
    setSaving(false);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="glass-card p-8 w-full max-w-sm space-y-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold text-lg tracking-tight">
            {initial ? 'Edit Node' : 'Add Node'}
          </h3>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Label</label>
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="e.g. Stall 1, Urinal A"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-sky-500/50"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Type</label>
          <div className="flex gap-2">
            {STALL_TYPES.map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                  type === t
                    ? 'bg-sky-500 text-[#0f172a]'
                    : 'bg-white/5 text-slate-400 border border-white/10 hover:border-white/20'
                }`}
              >
                {t === 'stall' ? '🚽 Stall' : '🚿 Urinal'}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</label>
          <div className="flex gap-2">
            {(['online', 'offline'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                  status === s
                    ? s === 'online'
                      ? 'bg-emerald-500 text-[#0f172a]'
                      : 'bg-red-500 text-white'
                    : 'bg-white/5 text-slate-400 border border-white/10 hover:border-white/20'
                }`}
              >
                {s === 'online' ? '● Online' : '○ Offline'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 hover:text-white transition-colors font-bold text-sm">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !label.trim()}
            className="flex-1 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-[#0f172a] font-black text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Save size={15} />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── Main SensorsPanel ──────────────────────────────────────────────────────────
export const SensorsPanel: React.FC<Props> = ({ buildings, restrooms, stalls }) => {
  // Drill-down state
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [selectedRestroom, setSelectedRestroom] = useState<Restroom | null>(null);

  // Form visibility
  const [buildingForm, setBuildingForm] = useState<{ open: boolean; editing?: Building }>({ open: false });
  const [restroomForm, setRestroomForm] = useState<{ open: boolean; editing?: Restroom }>({ open: false });
  const [stallForm, setStallForm]       = useState<{ open: boolean; editing?: Stall }>({ open: false });

  // Confirm delete
  const [confirmDelete, setConfirmDelete] = useState<{ message: string; onConfirm: () => void } | null>(null);

  // ── Building CRUD ────────────────────────────────────────────────────────────
  const saveBuilding = async (data: Omit<Building, 'id'>) => {
    if (buildingForm.editing) {
      await updateDoc(doc(db, 'buildings', buildingForm.editing.id), { ...data });
    } else {
      await addDoc(collection(db, 'buildings'), { ...data });
    }
  };

  const deleteBuilding = (b: Building) => {
    setConfirmDelete({
      message: `Delete "${b.name}" and all its restrooms & stalls?`,
      onConfirm: async () => {
        // cascade delete restrooms → stalls
        const rSnap = await getDocs(query(collection(db, 'restrooms'), where('buildingId', '==', b.id)));
        for (const rDoc of rSnap.docs) {
          const sSnap = await getDocs(query(collection(db, 'stalls'), where('restroomId', '==', rDoc.id)));
          await Promise.all(sSnap.docs.map(s => deleteDoc(s.ref)));
          await deleteDoc(rDoc.ref);
        }
        await deleteDoc(doc(db, 'buildings', b.id));
        if (selectedBuilding?.id === b.id) setSelectedBuilding(null);
      },
    });
  };

  // ── Restroom CRUD ────────────────────────────────────────────────────────────
  const saveRestroom = async (data: Omit<Restroom, 'id'>) => {
    if (restroomForm.editing) {
      await updateDoc(doc(db, 'restrooms', restroomForm.editing.id), { ...data });
    } else {
      await addDoc(collection(db, 'restrooms'), { ...data });
    }
  };

  const deleteRestroom = (r: Restroom) => {
    setConfirmDelete({
      message: `Delete "${r.name}" and all its stalls?`,
      onConfirm: async () => {
        const sSnap = await getDocs(query(collection(db, 'stalls'), where('restroomId', '==', r.id)));
        await Promise.all(sSnap.docs.map(s => deleteDoc(s.ref)));
        await deleteDoc(doc(db, 'restrooms', r.id));
        if (selectedRestroom?.id === r.id) setSelectedRestroom(null);
      },
    });
  };

  // ── Stall CRUD ───────────────────────────────────────────────────────────────
  const saveStall = async (data: Omit<Stall, 'id'>) => {
    if (stallForm.editing) {
      await updateDoc(doc(db, 'stalls', stallForm.editing.id), { ...data });
    } else {
      const newDoc = await addDoc(collection(db, 'stalls'), { ...data });
      await updateDoc(doc(db, 'restrooms', data.restroomId), { totalStalls: increment(1) });
      return newDoc;
    }
  };

  const toggleStallStatus = async (s: Stall) => {
    await updateDoc(doc(db, 'stalls', s.id), {
      status: s.status === 'online' ? 'offline' : 'online',
    });
  };

  const deleteStall = (s: Stall) => {
    setConfirmDelete({
      message: `Delete "${s.label}"?`,
      onConfirm: async () => {
        await deleteDoc(doc(db, 'stalls', s.id));
        await updateDoc(doc(db, 'restrooms', s.restroomId), { totalStalls: increment(-1) });
      },
    });
  };

  // Derived data
  const buildingRestrooms = useMemo(
    () => selectedBuilding ? restrooms.filter(r => r.buildingId === selectedBuilding.id) : [],
    [selectedBuilding, restrooms]
  );
  const restroomStalls = useMemo(
    () => selectedRestroom ? stalls.filter(s => s.restroomId === selectedRestroom.id) : [],
    [selectedRestroom, stalls]
  );

  // ── Level: Stall detail ──────────────────────────────────────────────────────
  if (selectedRestroom) {
    return (
      <>
        <motion.div key="stall-level" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => { setSelectedRestroom(null); setSelectedBuilding(null); }}
              className="flex items-center gap-1.5 text-sky-400 hover:text-sky-300 text-xs font-bold transition-colors">
              <ChevronLeft size={14} /> Campus
            </button>
            <span className="text-slate-600">/</span>
            <button onClick={() => setSelectedRestroom(null)}
              className="flex items-center gap-1.5 text-sky-400 hover:text-sky-300 text-xs font-bold transition-colors">
              <Building2 size={12} className="text-slate-500" />
              {selectedBuilding?.name}
            </button>
            <span className="text-slate-600">/</span>
            <span className="text-white text-xs font-bold flex items-center gap-1.5">
              <DoorOpen size={12} className="text-slate-500" />
              {selectedRestroom.name}
            </span>
          </div>

          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-white">{selectedRestroom.name}</h3>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">{selectedRestroom.location}</p>
            </div>
            <button
              onClick={() => setRestroomForm({ open: true, editing: selectedRestroom })}
              className="p-2.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-sky-400 rounded-xl transition-all border border-white/10"
            >
              <Edit2 size={16} />
            </button>
          </div>

          {/* Stall grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {restroomStalls.map(s => (
              <motion.div
                key={s.id}
                layout
                className={`glass-card p-5 flex items-center justify-between gap-4 border transition-all ${
                  s.status === 'online' ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{s.type === 'urinal' ? '🚿' : '🚽'}</span>
                  <div>
                    <p className="text-sm font-bold text-white">{s.label}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest mt-0.5 text-slate-500">
                      {s.type} · {s.occupancyCount} uses
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Toggle status */}
                  <button
                    onClick={() => toggleStallStatus(s)}
                    title={s.status === 'online' ? 'Set Offline' : 'Set Online'}
                    className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                      s.status === 'online'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                    }`}
                  >
                    {s.status === 'online' ? '● Online' : '○ Offline'}
                  </button>
                  <button
                    onClick={() => setStallForm({ open: true, editing: s })}
                    className="p-1.5 text-slate-600 hover:text-sky-400 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => deleteStall(s)}
                    className="p-1.5 text-slate-600 hover:text-red-500 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            ))}

            {/* Add node card */}
            <button
              onClick={() => setStallForm({ open: true })}
              className="p-6 border-2 border-dashed border-white/10 rounded-2xl text-slate-600 hover:text-sky-400 hover:border-sky-500/30 hover:bg-sky-500/5 transition-all flex flex-col items-center justify-center gap-3"
            >
              <Plus size={22} />
              <span className="text-[10px] font-black uppercase tracking-widest">Add Node</span>
            </button>
          </div>
        </motion.div>

        {/* Stall form */}
        <AnimatePresence>
          {stallForm.open && (
            <StallForm
              initial={stallForm.editing}
              restroomId={selectedRestroom.id}
              onSave={saveStall}
              onClose={() => setStallForm({ open: false })}
            />
          )}
          {restroomForm.open && restroomForm.editing && selectedBuilding && (
            <RestroomForm
              initial={restroomForm.editing}
              buildingId={selectedBuilding.id}
              onSave={saveRestroom}
              onClose={() => setRestroomForm({ open: false })}
            />
          )}
        </AnimatePresence>

        <ConfirmModal state={confirmDelete} onClose={() => setConfirmDelete(null)} />
      </>
    );
  }

  // ── Level: Building interior (restrooms) ─────────────────────────────────────
  if (selectedBuilding) {
    return (
      <>
        <motion.div key="building-level" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedBuilding(null)}
              className="flex items-center gap-1.5 text-sky-400 hover:text-sky-300 text-xs font-bold transition-colors">
              <ChevronLeft size={14} /> Campus
            </button>
            <span className="text-slate-600">/</span>
            <span className="text-white text-xs font-bold flex items-center gap-1.5">
              <Building2 size={12} className="text-slate-500" />
              {selectedBuilding.name}
            </span>
          </div>

          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-white">{selectedBuilding.name}</h3>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">{selectedBuilding.location}</p>
            </div>
            <button
              onClick={() => setBuildingForm({ open: true, editing: selectedBuilding })}
              className="p-2.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-sky-400 rounded-xl transition-all border border-white/10"
            >
              <Edit2 size={16} />
            </button>
          </div>

          {/* Floor plan preview (read-only, clickable) */}
          {buildingRestrooms.length > 0 && (
            <BuildingFloorPlan
              restrooms={buildingRestrooms}
              stalls={stalls}
              issues={[]}
              recommendedId={null}
              onSelect={r => setSelectedRestroom(r)}
            />
          )}

          {/* Restroom list */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            {buildingRestrooms.map(r => {
              const rStalls = stalls.filter(s => s.restroomId === r.id);
              const online = rStalls.filter(s => s.status === 'online').length;
              return (
                <motion.div
                  key={r.id}
                  layout
                  className="glass-card p-5 flex items-center gap-4 hover:border-white/20 transition-all group cursor-pointer"
                  onClick={() => setSelectedRestroom(r)}
                >
                  <div className="p-3 bg-sky-500/10 text-sky-400 rounded-xl border border-sky-500/20 shrink-0">
                    <DoorOpen size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white group-hover:text-sky-400 transition-colors truncate">{r.name}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mt-0.5">
                      {r.location} · {online}/{rStalls.length} online
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => setRestroomForm({ open: true, editing: r })}
                      className="p-2 text-slate-600 hover:text-sky-400 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => deleteRestroom(r)}
                      className="p-2 text-slate-600 hover:text-red-500 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </motion.div>
              );
            })}

            {/* Add restroom */}
            <button
              onClick={() => setRestroomForm({ open: true })}
              className="p-6 border-2 border-dashed border-white/10 rounded-2xl text-slate-600 hover:text-sky-400 hover:border-sky-500/30 hover:bg-sky-500/5 transition-all flex flex-col items-center justify-center gap-3"
            >
              <Plus size={22} />
              <span className="text-[10px] font-black uppercase tracking-widest">Add Restroom</span>
            </button>
          </div>
        </motion.div>

        <AnimatePresence>
          {restroomForm.open && (
            <RestroomForm
              initial={restroomForm.editing}
              buildingId={selectedBuilding.id}
              onSave={saveRestroom}
              onClose={() => setRestroomForm({ open: false })}
            />
          )}
          {buildingForm.open && buildingForm.editing && (
            <BuildingForm
              initial={buildingForm.editing}
              onSave={saveBuilding}
              onClose={() => setBuildingForm({ open: false })}
            />
          )}
        </AnimatePresence>

        <ConfirmModal state={confirmDelete} onClose={() => setConfirmDelete(null)} />
      </>
    );
  }

  // ── Level: Campus (buildings) ────────────────────────────────────────────────
  return (
    <>
      <motion.div key="campus-level" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Campus · All Buildings</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {buildings.map(b => {
            const bRooms  = restrooms.filter(r => r.buildingId === b.id);
            const bStalls = stalls.filter(s => bRooms.some(r => r.id === s.restroomId));
            const online  = bStalls.filter(s => s.status === 'online').length;

            return (
              <motion.div
                key={b.id}
                layout
                className="glass-card p-6 flex flex-col gap-4 hover:border-white/20 transition-all group cursor-pointer"
                onClick={() => setSelectedBuilding(b)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="p-3 bg-sky-500/10 text-sky-400 rounded-xl border border-sky-500/20 shrink-0">
                    <Building2 size={22} />
                  </div>
                  <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => setBuildingForm({ open: true, editing: b })}
                      className="p-2 text-slate-600 hover:text-sky-400 rounded-lg transition-colors"
                      title="Edit building"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => deleteBuilding(b)}
                      className="p-2 text-slate-600 hover:text-red-500 rounded-lg transition-colors"
                      title="Delete building"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="flex-1">
                  <p className="font-bold text-lg text-white group-hover:text-sky-400 transition-colors tracking-tight">{b.name}</p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mt-1">{b.location}</p>
                </div>

                <div className="flex items-center justify-between border-t border-white/5 pt-4">
                  <div className="text-center">
                    <p className="text-xl font-black text-white">{bRooms.length}</p>
                    <p className="text-[8px] font-black uppercase tracking-widest text-slate-600">Restrooms</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-black text-white">{bStalls.length}</p>
                    <p className="text-[8px] font-black uppercase tracking-widest text-slate-600">Total Nodes</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-xl font-black ${online === bStalls.length && bStalls.length > 0 ? 'text-emerald-400' : online === 0 ? 'text-red-400' : 'text-amber-400'}`}>
                      {online}
                    </p>
                    <p className="text-[8px] font-black uppercase tracking-widest text-slate-600">Online</p>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {/* Add building card */}
          <button
            onClick={() => setBuildingForm({ open: true })}
            className="p-8 border-2 border-dashed border-white/5 rounded-[2.5rem] text-slate-600 hover:text-sky-400 hover:border-sky-500/30 hover:bg-sky-500/5 transition-all flex flex-col items-center justify-center gap-4 group min-h-[220px]"
          >
            <div className="w-14 h-14 glass rounded-2xl flex items-center justify-center group-hover:rotate-6 transition-transform">
              <Plus size={28} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 group-hover:opacity-100 transition-opacity">Add Building</span>
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {buildingForm.open && (
          <BuildingForm
            initial={buildingForm.editing}
            onSave={saveBuilding}
            onClose={() => setBuildingForm({ open: false })}
          />
        )}
      </AnimatePresence>

      <ConfirmModal state={confirmDelete} onClose={() => setConfirmDelete(null)} />
    </>
  );
};

// ── Shared confirm modal ───────────────────────────────────────────────────────
const ConfirmModal: React.FC<{
  state: { message: string; onConfirm: () => void } | null;
  onClose: () => void;
}> = ({ state, onClose }) => (
  <AnimatePresence>
    {state && (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm px-6"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
          className="glass-card p-8 max-w-sm w-full space-y-6"
        >
          <p className="text-white font-bold text-center">{state.message}</p>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 hover:text-white transition-colors font-bold text-sm">
              Cancel
            </button>
            <button
              onClick={() => { state.onConfirm(); onClose(); }}
              className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-colors"
            >
              Delete
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);
