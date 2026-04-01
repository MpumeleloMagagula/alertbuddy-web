// User and Authentication Types
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  USER = 'USER',
}

export enum StandbyStatus {
  ON_STANDBY = 'ON_STANDBY',
  AVAILABLE = 'AVAILABLE',
  OFFLINE = 'OFFLINE',
}

export enum Severity {
  CRITICAL = 'CRITICAL',
  WARNING = 'WARNING',
  INFO = 'INFO',
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  position?: string;
  department?: string;
  phoneNumber?: string;
  createdAt: number;
  isActive: boolean;
}

export interface TeamMember {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  standbyStatus: StandbyStatus;
  phoneNumber?: string;
  createdAt: number;
  isCurrentUser: boolean;
}

// Alert Types
export interface Alert {
  id: string;
  channelId: string;
  channelName: string;
  title: string;
  body: string;
  severity: Severity;
  timestamp: number;
  isRead: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: number;
  source: string;
}

// Device Types
export interface Device {
  deviceId: string;
  fcmToken: string;
  email: string;
  registeredAt: number;
  lastSeen: number;
}

// Standby Types
export interface StandbyInfo {
  onStandby: boolean;
  email?: string;
  displayName?: string;
  fcmToken?: string;
  tokenResolved: boolean;
  updatedAt: number;
}

export interface HandoverLog {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  handoverAt: number;
  notes?: string;
  pendingAlertsCount: number;
}

// Shift Types
export interface Shift {
  id: string;
  assignedToId: string;
  assignedToName: string;
  startTime: number;
  endTime: number;
  handoverNotes?: string;
  isActive: boolean;
  createdById: string;
  createdByName: string;
  createdAt: number;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ServerStatus {
  status: string;
  firebase: 'connected' | 'disabled';
  standby: StandbyInfo;
  registeredDevices: number;
  uptime: string;
}

// Dashboard Stats
export interface DashboardStats {
  totalAlerts: number;
  unreadAlerts: number;
  criticalAlerts: number;
  warningAlerts: number;
  infoAlerts: number;
  acknowledgedAlerts: number;
  activeDevices: number;
  onStandby: boolean;
  standbyPerson?: string;
}

// Form Types
export interface LoginFormData {
  email: string;
  password: string;
}

export interface UserFormData {
  email: string;
  displayName: string;
  role: UserRole;
  position?: string;
  department?: string;
  phoneNumber?: string;
}

export interface TestAlertFormData {
  title: string;
  message: string;
  severity: Severity;
  channelId: string;
  channelName: string;
}
