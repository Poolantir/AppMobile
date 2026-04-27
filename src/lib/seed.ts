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
    // ── Seed buildings (independent check) ──────────────────────────────────
    const buildingsSnap = await getDocs(query(collection(db, 'buildings'), limit(1)));
    let seamanId = '';
    let chemId = '';
    let unionId = '';

    if (buildingsSnap.empty) {
      console.log("Seeding buildings...");
      const b1 = await addDoc(collection(db, 'buildings'), {
        name: "Seaman Center",
        location: "East Campus · Engineering",
        mapX: 22, mapY: 20,
        lat: 41.65817, lng: -91.52905,
      });
      const b2 = await addDoc(collection(db, 'buildings'), {
        name: "Chemistry Building",
        location: "East Campus · Sciences",
        mapX: 78, mapY: 25,
        lat: 41.66002, lng: -91.53183,
      });
      const b3 = await addDoc(collection(db, 'buildings'), {
        name: "MacLean Hall",
        location: "Pentacrest · Central Campus",
        mapX: 50, mapY: 65,
        lat: 41.66098, lng: -91.53878,
      });
      seamanId = b1.id;
      chemId   = b2.id;
      unionId  = b3.id;
    } else {
      // Buildings already exist — look up IDs for restroom assignment
      const allBuildings = await getDocs(collection(db, 'buildings'));
      allBuildings.docs.forEach(d => {
        const name = d.data().name as string;
        if (name === 'Seaman Center')          seamanId = d.id;
        else if (name === 'Chemistry Building') chemId   = d.id;
        else if (name === 'MacLean Hall')       unionId  = d.id;
      });
    }

    // ── Seed restrooms (idempotent) ──────────────────────────────────────────
    const restroomsSnap = await getDocs(query(collection(db, 'restrooms'), limit(1)));
    if (!restroomsSnap.empty) return;

    console.log("Seeding restrooms and stalls...");

    const r1 = await addDoc(collection(db, 'restrooms'), {
      buildingId: seamanId,
      name: "Lobby Restroom",
      location: "Ground Floor",
      totalStalls: 4, activeIssues: 0,
      mapX: 30, mapY: 65,
    });
    const r2 = await addDoc(collection(db, 'restrooms'), {
      buildingId: seamanId,
      name: "2nd Floor Restroom",
      location: "Second Floor",
      totalStalls: 3, activeIssues: 0,
      mapX: 70, mapY: 30,
    });
    const r3 = await addDoc(collection(db, 'restrooms'), {
      buildingId: chemId,
      name: "East Wing Restroom",
      location: "Ground Floor",
      totalStalls: 4, activeIssues: 0,
      mapX: 50, mapY: 50,
    });
    const r4 = await addDoc(collection(db, 'restrooms'), {
      buildingId: unionId,
      name: "Main Floor Restroom",
      location: "Level 1",
      totalStalls: 6, activeIssues: 0,
      mapX: 35, mapY: 60,
    });
    const r5 = await addDoc(collection(db, 'restrooms'), {
      buildingId: unionId,
      name: "Food Court Restroom",
      location: "Level 1, South",
      totalStalls: 5, activeIssues: 0,
      mapX: 70, mapY: 40,
    });

    const stallDefs = [
      { roomId: r1.id, label: 'S1-Stall 1',  type: 'stall' },
      { roomId: r1.id, label: 'S1-Stall 2',  type: 'stall' },
      { roomId: r1.id, label: 'S1-Urinal 1', type: 'urinal' },
      { roomId: r1.id, label: 'S1-Urinal 2', type: 'urinal' },
      { roomId: r2.id, label: 'S2-Stall 1',  type: 'stall' },
      { roomId: r2.id, label: 'S2-Stall 2',  type: 'stall' },
      { roomId: r2.id, label: 'S2-Urinal 1', type: 'urinal' },
      { roomId: r3.id, label: 'C1-Stall 1',  type: 'stall' },
      { roomId: r3.id, label: 'C1-Stall 2',  type: 'stall' },
      { roomId: r3.id, label: 'C1-Urinal 1', type: 'urinal' },
      { roomId: r3.id, label: 'C1-Urinal 2', type: 'urinal' },
      { roomId: r4.id, label: 'U1-Stall 1',  type: 'stall' },
      { roomId: r4.id, label: 'U1-Stall 2',  type: 'stall' },
      { roomId: r4.id, label: 'U1-Urinal 1', type: 'urinal' },
      { roomId: r5.id, label: 'U2-Stall 1',  type: 'stall' },
      { roomId: r5.id, label: 'U2-Stall 2',  type: 'stall' },
      { roomId: r5.id, label: 'U2-Urinal 1', type: 'urinal' },
    ];

    for (const s of stallDefs) {
      await addDoc(collection(db, 'stalls'), {
        restroomId: s.roomId,
        label: s.label,
        type: s.type,
        status: Math.random() > 0.7 ? 'offline' : 'online',
        lastOccupiedAt: serverTimestamp(),
        occupancyCount: Math.floor(Math.random() * 50),
      });
    }
    console.log("Seeding complete.");
  } catch (error) {
    console.error("Critical: Data seeding failed.", error);
  }
}
