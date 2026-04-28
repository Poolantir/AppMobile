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
