import { Timestamp } from 'firebase/firestore';

export type StallStatus = 'online' | 'offline';
export type StallType = 'stall' | 'urinal';
export type IssueType = 'clogged' | 'no_paper' | 'broken_lock' | 'unclean' | 'other';
export type IssueStatus = 'pending' | 'resolved';

export interface Restroom {
  id: string;
  name: string;
  location: string;
  totalStalls: number;
  activeIssues: number;
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
}

export interface UserProfile {
  uid: string;
  email: string;
  isAdmin: boolean;
  lastSeenAt?: Timestamp;
}
