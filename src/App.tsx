/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  User, 
  GoogleAuthProvider,
  signInWithCredential,
  signOut
} from 'firebase/auth';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp,
  collection,
  onSnapshot,
  query,
  orderBy
} from 'firebase/firestore';
import { auth, db, handleFirestoreError } from './lib/firebase';
import { UserProfile, Restroom, Stall, Issue } from './types';
import { 
  LayoutDashboard, 
  LogOut, 
  History, 
  AlertTriangle, 
  Map as MapIcon, 
  Settings,
  User as UserIcon,
  Plus,
  CheckCircle2,
  Clock,
  Navigation,
  Droplets,
  Lock,
  Search,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Components
import { AdminDashboard } from './components/AdminDashboard';
import { UserView } from './components/UserView';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true, isAdmin: false });

export const useAuth = () => useContext(AuthContext);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [guestMode, setGuestMode] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          const isBootstrapAdmin = user.email?.toLowerCase() === 'braden022@gmail.com';
          
          if (!userSnap.exists()) {
            const newProfile = {
              email: user.email!,
              isAdmin: isBootstrapAdmin,
              lastSeenAt: serverTimestamp(),
            };
            await setDoc(userRef, newProfile);
            setProfile({ uid: user.uid, ...newProfile } as any);
          } else {
            const data = userSnap.data();
            // Ensure bootstrap admin always has permissions even if profile existed
            if (isBootstrapAdmin && !data.isAdmin) {
              await setDoc(userRef, { isAdmin: true }, { merge: true });
              data.isAdmin = true;
            }
            setProfile({ uid: user.uid, ...data } as any);
            await setDoc(userRef, { lastSeenAt: serverTimestamp() }, { merge: true });
          }
        } catch (e) {
          console.error("Error fetching profile", e);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      // Use native Google Sign-In via Capacitor plugin (works in WKWebView on iOS)
      const result = await FirebaseAuthentication.signInWithGoogle();
      const credential = GoogleAuthProvider.credential(result.credential?.idToken);
      await signInWithCredential(auth, credential);
    } catch (e) {
      console.error("Login failed", e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user && !guestMode) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 relative">
        <div className="mesh-bg" />
        <div className="mesh-accent-1" />
        <div className="mesh-accent-2" />
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full glass-card p-10 text-center"
        >
          <div className="w-20 h-20 bg-sky-500 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-sky-500/20">
            <Droplets className="text-[#0f172a] w-10 h-10" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Poolantir</h1>
          <p className="text-slate-400 mb-10 leading-relaxed">
            The Smart Stall Facility Analytics System.
          </p>
          <button 
            onClick={login}
            className="w-full bg-sky-500 hover:bg-sky-400 text-[#0f172a] font-bold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-3 active:scale-95 shadow-lg shadow-sky-500/10"
          >
            <UserIcon size={20} />
            Sign in with Google
          </button>
          <button
            onClick={() => setGuestMode(true)}
            className="w-full mt-3 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white font-bold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-3 active:scale-95 border border-white/10"
          >
            <Navigation size={20} />
            View Facility Status
          </button>
          <p className="text-[10px] text-slate-600 mt-4 uppercase tracking-widest">Admin sign-in required to manage facilities</p>
        </motion.div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin: profile?.isAdmin || false }}>
      <div className="min-h-screen text-[#f8fafc]">
        <div className="mesh-bg" />
        <div className="mesh-accent-1" />
        <div className="mesh-accent-2" />
        
        <nav className="sticky top-0 z-50 bg-[#0f172a] border-b border-white/[0.06] rounded-none px-6 py-4" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/poolantir_icon 1.svg" alt="Poolantir" className="h-9 w-9" />
              <span className="text-xl font-bold text-white tracking-tight">Poolantir</span>
            </div>
            
            <div className="flex items-center gap-4">
              {profile?.isAdmin && (
                <span className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-violet-500/20 text-violet-300 rounded-full text-[10px] font-black uppercase tracking-widest border border-violet-500/30">
                  <Lock size={12} />
                  Admin
                </span>
              )}
              {user ? (
                <>
                  <div className="flex items-center gap-3 pr-4 border-r border-white/10 mr-2">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-bold text-white leading-none">{user.displayName}</p>
                      <p className="text-xs text-slate-400 mt-1">{user.email}</p>
                    </div>
                    <img 
                      src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                      className="w-10 h-10 rounded-xl border border-white/20 shadow-sm"
                      alt="Avatar"
                    />
                  </div>
                  <button 
                    onClick={() => signOut(auth)}
                    className="p-2.5 text-slate-400 hover:text-white transition-colors"
                    title="Sign Out"
                  >
                    <LogOut size={20} />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setGuestMode(false)}
                  className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-400 text-[#0f172a] font-bold text-xs rounded-xl transition-all active:scale-95"
                >
                  <UserIcon size={14} />
                  Sign In
                </button>
              )}
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto p-6">
          <AnimatePresence mode="wait">
            {user && profile?.isAdmin ? (
               <AdminDashboard key="admin" />
            ) : (
              <UserView key="user" />
            )}
          </AnimatePresence>
        </main>
      </div>
    </AuthContext.Provider>
  );
}

