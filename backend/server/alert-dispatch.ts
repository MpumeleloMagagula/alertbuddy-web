/**
 * Alert Buddy dispatch pipeline — the shared "gateway" that every alert
 * flows through, regardless of source (Grafana, Zabbix, manual send, …).
 *
 * Responsibilities:
 *   1. Resolve the raw routing hints to an Alert Buddy channel.
 *   2. Persist the alert to Firestore (history / audit), tenant-stamped.
 *   3. Route it to whoever is on standby, falling back to a broadcast.
 *   4. Close out the matching alert when a "resolved" event arrives.
 */

import admin from 'firebase-admin';
import * as fcm from './fcm.js';
import * as deviceStorage from './device-storage.js';
import * as standbyStorage from './standby-storage.js';
import { logAuditAction } from './enhanced-features.js';
import { matchChannel } from './alert-routing.js';
import type { ParsedAlert } from './alert-routing.js';
import { getChannels } from './config-store.js';
import { withTenant } from './tenant.js';

// ── Firestore helpers ─────────────────────────────────────────────────────────

export async function saveAlertToFirestore(params: {
  alertId: string; title: string; body: string; severity: string;
  channelId: string; channelName: string; source: string; url?: string;
}) {
  if (!admin.apps.length) return;
  try {
    await admin.firestore().collection('alerts').doc(params.alertId).set(withTenant({
      channelId: params.channelId, channelName: params.channelName,
      title: params.title, body: params.body, severity: params.severity,
      timestamp: Date.now(), isRead: false, source: params.source,
      ...(params.url ? { sourceUrl: params.url } : {}),
    }));
  } catch (err) {
    console.error('Failed to save alert to Firestore:', err);
  }
}

/** Mark an alert resolved when the source sends a recovery event. */
async function resolveAlertInFirestore(alertId: string, source: string) {
  if (!admin.apps.length) return;
  try {
    const ref = admin.firestore().collection('alerts').doc(alertId);
    const snap = await ref.get();
    if (!snap.exists) return; // never notified for it — nothing to close
    await ref.update({
      isRead: true,
      resolvedAt: Date.now(),
      resolvedBy: `${source} (auto)`,
    });
    console.log(`✅ Alert ${alertId} auto-resolved by ${source}`);
  } catch (err) {
    console.error('Failed to resolve alert in Firestore:', err);
  }
}

// Returns FCM tokens from in-memory cache first; falls back to Firestore on cold start
export async function getAllFcmTokens(): Promise<string[]> {
  const cached = deviceStorage.getAllTokens();
  if (cached.length > 0) return cached;
  if (!admin.apps.length) return [];
  try {
    const snap = await admin.firestore().collection('devices').get();
    return snap.docs.map(d => d.data().fcmToken as string).filter(Boolean);
  } catch {
    return [];
  }
}

// ── The gateway ───────────────────────────────────────────────────────────────

export interface DispatchOutcome {
  alert: string;
  status: 'firing' | 'resolved';
  channel?: string;
  sentTo?: string;
  success?: boolean;
  successCount?: number;
  failureCount?: number;
}

/**
 * Push a batch of already-normalised alerts through the standby / broadcast
 * pipeline. Used by both the Grafana and Zabbix webhook receivers.
 */
export async function dispatchAlerts(alerts: ParsedAlert[]): Promise<DispatchOutcome[]> {
  const outcomes: DispatchOutcome[] = [];
  const standby = await standbyStorage.getCurrentStandby();
  const channels = await getChannels();

  for (const alert of alerts) {
    if (alert.status === 'resolved') {
      await resolveAlertInFirestore(alert.alertId, alert.source);
      outcomes.push({ alert: alert.title, status: 'resolved' });
      continue;
    }

    const channel = matchChannel(alert.channelCandidates, channels);

    const notification = { title: alert.title, body: alert.message };
    const data = {
      alertId: alert.alertId,
      channelId: channel.id,
      channelName: channel.name,
      severity: alert.severity,
      source: alert.source,
      url: alert.url,
    };

    let standbySuccess = false;
    if (standby.onStandby && standby.fcmToken) {
      standbySuccess = await fcm.sendToToken(standby.fcmToken, notification, data);
      outcomes.push({ alert: alert.title, status: 'firing', channel: channel.name, sentTo: standby.email, success: standbySuccess });
    }

    // Broadcast when there's no standby, or the standby's own push failed
    // (e.g. a stale token) — better a duplicate notification than a dropped alert.
    if (!standby.onStandby || !standby.fcmToken || !standbySuccess) {
      const tokens = (await getAllFcmTokens()).filter(t => t !== standby.fcmToken);
      if (tokens.length > 0) {
        const result = await fcm.sendToMultipleTokens(tokens, notification, data);
        outcomes.push({
          alert: alert.title, status: 'firing', channel: channel.name, sentTo: 'all',
          successCount: result.successCount, failureCount: result.failureCount,
        });
      }
    }

    await saveAlertToFirestore({
      alertId: alert.alertId, title: alert.title, body: alert.message,
      severity: alert.severity, channelId: channel.id, channelName: channel.name,
      source: alert.source, url: alert.url,
    });

    await logAuditAction({
      action: 'WEBHOOK_ALERT',
      performedBy: alert.source,
      performedByEmail: alert.source,
      description: `${alert.source} alert routed to ${channel.name}: ${alert.title}`,
      metadata: { alertId: alert.alertId, severity: alert.severity, channelId: channel.id },
    });
  }

  return outcomes;
}
