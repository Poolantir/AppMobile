import { 
  collection, 
  getDocs, 
  addDoc, 
  serverTimestamp,
  query,
  limit
} from 'firebase/firestore';
import { db } from './firebase';

export async function seedInitialData() {
  try {
    const restroomsSnap = await getDocs(query(collection(db, 'restrooms'), limit(1)));
    if (!restroomsSnap.empty) return;

    console.log("Seeding initial facility data...");
    
    const r1 = await addDoc(collection(db, 'restrooms'), {
      name: "North Wing Lobby",
      location: "Floor 1, North",
      totalStalls: 4,
      activeIssues: 0
    });

    const r2 = await addDoc(collection(db, 'restrooms'), {
      name: "Engineering West",
      location: "Floor 2, Corridor C",
      totalStalls: 4,
      activeIssues: 0
    });

    const stalls = [
      { roomId: r1.id, label: 'L-Stall 1', type: 'stall' },
      { roomId: r1.id, label: 'L-Stall 2', type: 'stall' },
      { roomId: r1.id, label: 'L-Urinal 1', type: 'urinal' },
      { roomId: r2.id, label: 'W-Stall 1', type: 'stall' },
      { roomId: r2.id, label: 'W-Stall 2', type: 'stall' },
    ];

    for (const s of stalls) {
      await addDoc(collection(db, 'stalls'), {
        restroomId: s.roomId,
        label: s.label,
        type: s.type,
        status: Math.random() > 0.7 ? 'offline' : 'online',
        lastOccupiedAt: serverTimestamp(),
        occupancyCount: Math.floor(Math.random() * 50)
      });
    }
    console.log("Seeding complete.");
  } catch (error) {
    console.error("Critical: Data seeding failed.", error);
  }
}
