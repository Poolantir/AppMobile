import { Timestamp } from 'firebase/firestore';

export type StallStatus = 'online' | 'offline';
export type StallType = 'stall' | 'urinal';
export type IssueType = 'clogged' | 'no_paper' | 'broken_lock' | 'unclean' | 'other' | 'extended_occupancy' | 'sensor_glitch';
export type IssueStatus = 'pending' | 'resolved';

export interface Building {
  id: string;
  name: string;
  location: string;
  mapX?: number;
  mapY?: number;
  lat?: number;  // GPS latitude
  lng?: number;  // GPS longitude
}

export interface Restroom {
  id: string;
  buildingId?: string;
  name: string;
  location: string;
  totalStalls: number;
  activeIssues: number;
  mapX?: number; // 0–100 position within building (or campus if no buildingId)
  mapY?: number;
}

export interface Stall {
  id: string;
  restroomId: string;
  label: string;
  type: StallType;
  status: StallStatus;
  lastOccupiedAt?: Timestamp;
  occupancyCount: number;
  /** Physical sensor hardware ID — used to match incoming sensor_events */
  nodeId?: string;
}

export interface Issue {
  id: string;
  restroomId: string;
  stallId?: string;
  type: IssueType;
  status: IssueStatus;
  reportedAt: Timestamp;
  reportedBy: string;
  /** 'system' = ML-detected anomaly; 'user' = user-reported (default) */
  source?: 'user' | 'system';
  /** Human-readable node label, e.g. "Stall 2" */
  nodeLabel?: string;
  /** ML scenario that triggered this issue */
  scenario?: string;
  /** Sensor confidence score 0–1 */
  sensorConf?: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  isAdmin: boolean;
  lastSeenAt?: Timestamp;
}

export type SensorEventType = 'in_use' | 'vacant' | 'offline' | 'online';

export interface SensorEvent {
  id: string;
  /** Matches Stall.nodeId — the physical hardware identifier */
  nodeId: string;
  event: SensorEventType;
  timestamp: Timestamp;
  /** Set to true once the app has processed this event */
  processed?: boolean;
}
