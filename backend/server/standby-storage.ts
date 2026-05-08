import { getTokenByEmail } from './device-storage.js';

/**
 * In-memory standby state storage
 * In production, this should be replaced with a database
 */

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

let currentStandby: StandbyInfo = {
  onStandby: false,
  tokenResolved: false,
  updatedAt: Date.now(),
};

const handoverHistory: HandoverLog[] = [];

/**
 * Update who is on standby
 */
export function updateStandby(
  email: string,
  displayName: string,
  _updatedByEmail?: string
): StandbyInfo {
  const token = getTokenByEmail(email);
  
  // Log handover if someone was already on standby
  if (currentStandby.onStandby && currentStandby.email !== email) {
    logHandover(
      currentStandby.email!,
      currentStandby.displayName!,
      email,
      displayName,
      'Manual handover via API'
    );
  }

  currentStandby = {
    onStandby: true,
    email,
    displayName,
    fcmToken: token,
    tokenResolved: !!token,
    updatedAt: Date.now(),
  };

  console.log(`✅ Standby updated: ${displayName} (${email})`);
  console.log(`   Token resolved: ${currentStandby.tokenResolved}`);

  return currentStandby;
}

/**
 * Get current standby info
 */
export function getCurrentStandby(): StandbyInfo {
  // Try to resolve token if it wasn't resolved before
  if (currentStandby.onStandby && !currentStandby.tokenResolved && currentStandby.email) {
    const token = getTokenByEmail(currentStandby.email);
    if (token) {
      currentStandby.fcmToken = token;
      currentStandby.tokenResolved = true;
      console.log(`✅ Token resolved for ${currentStandby.email}`);
    }
  }

  return currentStandby;
}

/**
 * Clear standby (no one on call)
 */
export function clearStandby(): StandbyInfo {
  if (currentStandby.onStandby) {
    console.log(`✅ Standby cleared: ${currentStandby.displayName}`);
  }

  currentStandby = {
    onStandby: false,
    tokenResolved: false,
    updatedAt: Date.now(),
  };

  return currentStandby;
}

/**
 * Log a handover event
 */
function logHandover(
  fromEmail: string,
  fromName: string,
  toEmail: string,
  toName: string,
  notes?: string
): void {
  const log: HandoverLog = {
    id: `handover-${Date.now()}`,
    fromUserId: fromEmail,
    fromUserName: fromName,
    toUserId: toEmail,
    toUserName: toName,
    handoverAt: Date.now(),
    notes,
    pendingAlertsCount: 0, // Could be calculated from alert storage
  };

  handoverHistory.unshift(log);

  // Keep only last 100 handovers
  if (handoverHistory.length > 100) {
    handoverHistory.pop();
  }

  console.log(`📝 Handover logged: ${fromName} → ${toName}`);
}

/**
 * Get handover history
 */
export function getHandoverHistory(limit: number = 20): HandoverLog[] {
  return handoverHistory.slice(0, limit);
}

/**
 * Clear handover history (for testing)
 */
export function clearHandoverHistory(): void {
  handoverHistory.length = 0;
  console.log('🗑️  Handover history cleared');
}
