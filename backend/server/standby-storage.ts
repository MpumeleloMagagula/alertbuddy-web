import admin from 'firebase-admin';

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

// Warm in-memory cache so subsequent requests on the same instance skip Firestore reads
let memCache: StandbyInfo = { onStandby: false, tokenResolved: false, updatedAt: Date.now() };

function ready(): boolean { return admin.apps.length > 0; }

async function resolveTokenForEmail(email: string): Promise<string | null> {
  if (!ready()) return null;
  try {
    const snap = await admin.firestore()
      .collection('devices')
      .where('email', '==', email)
      .orderBy('lastSeen', 'desc')
      .limit(1)
      .get();
    return snap.empty ? null : ((snap.docs[0].data().fcmToken as string) ?? null);
  } catch {
    return null;
  }
}

export async function getCurrentStandby(): Promise<StandbyInfo> {
  if (!ready()) return memCache;
  try {
    const snap = await admin.firestore().doc('standby/current').get();
    if (!snap.exists) return memCache;
    const data = snap.data() as StandbyInfo;
    memCache = data;
    return data;
  } catch {
    return memCache;
  }
}

// Synchronous read of warm cache — safe to call in places that can't await
export function getCurrentStandbySync(): StandbyInfo {
  return memCache;
}

export async function updateStandby(
  email: string,
  displayName: string,
  _updatedByEmail?: string,
): Promise<StandbyInfo> {
  const prev = await getCurrentStandby();

  // Log handover when the person changes
  if (prev.onStandby && prev.email && prev.email !== email) {
    void logHandover(prev.email, prev.displayName ?? prev.email, email, displayName);
  }

  const fcmToken = await resolveTokenForEmail(email);
  const next: StandbyInfo = {
    onStandby: true,
    email,
    displayName,
    fcmToken: fcmToken ?? undefined,
    tokenResolved: !!fcmToken,
    updatedAt: Date.now(),
  };

  memCache = next;
  if (ready()) {
    try { await admin.firestore().doc('standby/current').set(next); } catch (err) {
      console.error('Failed to persist standby:', err);
    }
  }

  console.log(`✅ Standby → ${displayName} (${email}), token: ${next.tokenResolved}`);
  return next;
}

export async function clearStandby(): Promise<StandbyInfo> {
  const cleared: StandbyInfo = { onStandby: false, tokenResolved: false, updatedAt: Date.now() };
  memCache = cleared;
  if (ready()) {
    try { await admin.firestore().doc('standby/current').set(cleared); } catch {}
  }
  return cleared;
}

async function logHandover(
  fromEmail: string, fromName: string,
  toEmail: string, toName: string,
  notes = 'Manual handover',
): Promise<void> {
  if (!ready()) return;
  try {
    const log: HandoverLog = {
      id: `handover-${Date.now()}`,
      fromUserId: fromEmail,
      fromUserName: fromName,
      toUserId: toEmail,
      toUserName: toName,
      handoverAt: Date.now(),
      notes,
      pendingAlertsCount: 0,
    };
    await admin.firestore().collection('handover_logs').doc(log.id).set(log);
    console.log(`📝 Handover logged: ${fromName} → ${toName}`);
  } catch (err) {
    console.error('Failed to log handover:', err);
  }
}

export async function getHandoverHistory(limitCount = 20): Promise<HandoverLog[]> {
  if (!ready()) return [];
  try {
    const snap = await admin.firestore()
      .collection('handover_logs')
      .orderBy('handoverAt', 'desc')
      .limit(limitCount)
      .get();
    return snap.docs.map(d => d.data() as HandoverLog);
  } catch {
    return [];
  }
}
