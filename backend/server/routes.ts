import { Router, Request, Response } from 'express';
import admin from 'firebase-admin';
import * as fcm from './fcm.js';
import * as deviceStorage from './device-storage.js';
import * as standbyStorage from './standby-storage.js';
import type { StandbyInfo } from './standby-storage.js';
import * as mailer from './mailer.js';
import { logAuditAction } from './enhanced-features.js';
import { saveAlertToFirestore, getAllFcmTokens } from './alert-dispatch.js';
import { requireAuth, requireRole } from './auth.js';
import { withTenant } from './tenant.js';

const router = Router();

// ── Server Status (public — health check) ─────────────────────────────────────
router.get('/status', async (_req: Request, res: Response) => {
  const standby = await standbyStorage.getCurrentStandby();
  const uptime  = process.uptime();
  const hours   = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);

  let deviceCount = deviceStorage.getDeviceCount();
  if (deviceCount === 0 && admin.apps.length) {
    try {
      const snap = await admin.firestore().collection('devices').get();
      deviceCount = snap.size;
    } catch {}
  }

  res.json({
    status: 'running',
    firebase: fcm.isFirebaseReady() ? 'connected' : 'disabled',
    standby,
    registeredDevices: deviceCount,
    uptime: `${hours}h ${minutes}m`,
  });
});

// ── Everything below requires a Firebase ID token ─────────────────────────────
router.use(requireAuth);

// Who am I? Authoritative role for the signed-in user (drives portal UI gating).
router.get('/me', (req: Request, res: Response) => {
  res.json(req.authUser);
});

// ── Device Management ─────────────────────────────────────────────────────────
router.post('/devices/register', async (req: Request, res: Response) => {
  const { deviceId, fcmToken, deviceName, manufacturer, deviceModel, osVersion, appVersion, batteryLevel, isCharging } = req.body;
  // The device belongs to the signed-in user — never trust a body-supplied email.
  const email = req.authUser!.email;

  if (!deviceId || !fcmToken) {
    return res.status(400).json({ success: false, error: 'Missing required fields: deviceId, fcmToken' });
  }

  const device = deviceStorage.registerDevice(deviceId, fcmToken, email);

  if (fcm.isFirebaseReady()) {
    try {
      await admin.firestore().collection('devices').doc(deviceId).set(withTenant({
        deviceId, fcmToken, email,
        deviceName: deviceName ?? null, manufacturer: manufacturer ?? null,
        deviceModel: deviceModel ?? null, osVersion: osVersion ?? null,
        appVersion: appVersion ?? null, batteryLevel: batteryLevel ?? null,
        isCharging: isCharging ?? null,
        registeredAt: device.registeredAt, lastSeen: device.lastSeen,
      }), { merge: true });
      console.log(`📦 Device saved to Firestore: ${email}`);
    } catch (err) {
      console.error('Failed to save device to Firestore:', err);
    }
  }

  // If this person is on standby, refresh their token
  const standby = await standbyStorage.getCurrentStandby();
  if (standby.onStandby && standby.email === email) {
    await standbyStorage.updateStandby(email, standby.displayName!);
  }

  // Clean up stale registrations from the same physical device (app reinstall / upgrade)
  if (fcm.isFirebaseReady() && deviceModel) {
    try {
      const devSnap = await admin.firestore().collection('devices').where('email', '==', email).get();
      const stale = devSnap.docs.filter(d =>
        d.id !== deviceId &&
        d.data().deviceModel === deviceModel &&
        d.data().deviceName === deviceName
      );
      if (stale.length > 0) {
        const batch = admin.firestore().batch();
        stale.forEach(d => { batch.delete(d.ref); deviceStorage.unregisterDevice(d.id); });
        await batch.commit();
        console.log(`🧹 Removed ${stale.length} stale registration(s) for ${email}`);
      }
    } catch (err) {
      console.error('Stale device cleanup failed:', err);
    }
  }

  await logAuditAction({
    action: 'DEVICE_REGISTERED',
    performedBy: email,
    performedByEmail: email,
    description: `Device registered: ${deviceName ?? deviceId}`,
    metadata: { deviceId, manufacturer, deviceModel },
  });

  res.json({ success: true, device });
});

router.post('/devices/unregister', async (req: Request, res: Response) => {
  const { deviceId } = req.body;

  if (!deviceId) {
    return res.status(400).json({ success: false, error: 'Missing required field: deviceId' });
  }

  const existing = deviceStorage.getDeviceById(deviceId);
  // A non-admin may only unregister their own device.
  if (req.authUser!.role !== 'ADMIN' && existing && existing.email !== req.authUser!.email) {
    return res.status(403).json({ success: false, error: 'Not your device' });
  }

  const success = deviceStorage.unregisterDevice(deviceId);

  if (success && fcm.isFirebaseReady()) {
    try {
      await admin.firestore().collection('devices').doc(deviceId).delete();
      console.log(`🗑️  Device removed from Firestore: ${deviceId}`);
    } catch (err) {
      console.error('Failed to delete device from Firestore:', err);
    }
  }

  if (success) {
    await logAuditAction({
      action: 'DEVICE_UNREGISTERED',
      performedBy: req.authUser!.email,
      performedByEmail: req.authUser!.email,
      description: `Device unregistered: ${deviceId}`,
      metadata: { deviceId, owner: existing?.email },
    });
  }

  res.json({ success, message: success ? 'Device unregistered' : 'Device not found' });
});

router.get('/devices', async (_req: Request, res: Response) => {
  let devices = deviceStorage.getAllDevices();
  // In-memory store is empty on cold start — fall back to Firestore
  if (devices.length === 0 && fcm.isFirebaseReady()) {
    try {
      const snap = await admin.firestore().collection('devices').get();
      devices = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
    } catch {}
  }
  res.json(devices);
});

// Fires push + email in background so the HTTP response is not delayed
async function sendStandbyNotifications(standby: StandbyInfo, email: string, displayName: string) {
  const jobs: Promise<unknown>[] = [];

  if (standby.tokenResolved && standby.fcmToken) {
    jobs.push(
      fcm.sendToToken(
        standby.fcmToken,
        { title: "You're now on standby", body: 'Alerts from Alert Buddy will be routed to your device.' },
        { alertId: `standby-notify-${Date.now()}`, channelId: 'general', channelName: 'General', severity: 'INFO', source: 'System' },
      ).then(ok => console.log(`🔔 Standby push → ${email}: ${ok ? 'sent' : 'failed'}`)),
    );
  } else {
    console.log(`⚠️  No FCM token for ${email} — push skipped`);
  }

  jobs.push(
    emailOnStandbyAssignedEnabled(email).then(enabled => {
      if (!enabled) {
        console.log(`📧 Standby email → ${email}: skipped (disabled in notification preferences)`);
        return;
      }
      return mailer.sendStandbyAssignedEmail(email, displayName)
        .then(ok => console.log(`📧 Standby email → ${email}: ${ok ? 'sent' : 'not configured'}`));
    }),
  );

  await Promise.all(jobs);
}

// Defaults to true (opt-out) so users who haven't touched notification settings keep getting emailed
async function emailOnStandbyAssignedEnabled(email: string): Promise<boolean> {
  if (!admin.apps.length) return true;
  try {
    const snap = await admin.firestore().collection('users').where('email', '==', email).limit(1).get();
    if (snap.empty) return true;
    const prefs = snap.docs[0].data().notificationPreferences;
    return prefs?.emailOnStandbyAssigned !== false;
  } catch {
    return true;
  }
}

// ── Standby Management ────────────────────────────────────────────────────────
router.get('/standby/current', async (_req: Request, res: Response) => {
  const standby = await standbyStorage.getCurrentStandby();
  res.json(standby);
});

router.post('/standby/update', requireRole('MANAGER'), async (req: Request, res: Response) => {
  const { email, displayName, notes } = req.body;

  if (!email || !displayName) {
    return res.status(400).json({ success: false, error: 'Missing required fields: email, displayName' });
  }

  const standby = await standbyStorage.updateStandby(email, displayName, req.authUser!.email, notes);

  // Send push + email in background — don't block the HTTP response
  void sendStandbyNotifications(standby, email, displayName);

  await logAuditAction({
    action: 'STANDBY_UPDATE',
    performedBy: req.authUser!.email,
    performedByEmail: req.authUser!.email,
    description: `Standby assigned to ${displayName}`,
    metadata: notes ? { email, notes } : { email },
  });

  res.json({ success: true, standby, tokenResolved: standby.tokenResolved });
});

router.delete('/standby', requireRole('MANAGER'), async (req: Request, res: Response) => {
  const previous = await standbyStorage.getCurrentStandby();
  const standby = await standbyStorage.clearStandby();

  if (previous.onStandby) {
    await logAuditAction({
      action: 'STANDBY_UPDATE',
      performedBy: req.authUser!.email,
      performedByEmail: req.authUser!.email,
      description: `Standby cleared (was ${previous.displayName ?? previous.email})`,
      metadata: { previousEmail: previous.email },
    });
  }

  res.json({ success: true, standby });
});

router.get('/standby/history', async (req: Request, res: Response) => {
  const limit = Number.parseInt(req.query.limit as string) || 20;
  const history = await standbyStorage.getHandoverHistory(limit);
  res.json(history);
});

// ── Alert History ─────────────────────────────────────────────────────────────
router.get('/alerts', async (req: Request, res: Response) => {
  if (!fcm.isFirebaseReady()) return res.json([]);
  try {
    const limit = Number.parseInt(req.query.limit as string) || 50;
    const snap = await admin.firestore()
      .collection('alerts')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (err) {
    console.error('Failed to list alerts:', err);
    res.json([]);
  }
});

// ── Alert Sending ─────────────────────────────────────────────────────────────
router.post('/alerts/send', requireRole('MANAGER'), async (req: Request, res: Response) => {
  const { title, message, severity, channelId, channelName } = req.body;

  if (!title || !message) {
    return res.status(400).json({ success: false, error: 'Missing required fields: title, message' });
  }

  const tokens = await getAllFcmTokens();

  if (tokens.length === 0) {
    return res.json({ success: false, error: 'No registered devices' });
  }

  const alertId           = `manual-${Date.now()}`;
  const resolvedChannelId   = channelId || 'general';
  const resolvedChannelName = channelName || 'General';
  const resolvedSeverity    = severity || 'WARNING';

  const result = await fcm.sendToMultipleTokens(
    tokens,
    { title, body: message },
    { alertId, channelId: resolvedChannelId, channelName: resolvedChannelName, severity: resolvedSeverity, source: 'Manual' },
  );

  await saveAlertToFirestore({ alertId, title, body: message, severity: resolvedSeverity, channelId: resolvedChannelId, channelName: resolvedChannelName, source: 'Manual' });

  await logAuditAction({
    action: 'ALERT_SENT',
    performedBy: req.authUser!.email,
    performedByEmail: req.authUser!.email,
    description: `Sent alert to all devices: ${title}`,
    metadata: { alertId, sentTo: tokens.length },
  });

  res.json({ success: true, sent: result.successCount, failed: result.failureCount, totalDevices: tokens.length });
});

router.post('/alerts/send-standby', requireRole('MANAGER'), async (req: Request, res: Response) => {
  const { title, message, severity, channelId, channelName } = req.body;

  if (!title || !message) {
    return res.status(400).json({ success: false, error: 'Missing required fields: title, message' });
  }

  const standby = await standbyStorage.getCurrentStandby();

  if (!standby.onStandby || !standby.fcmToken) {
    return res.json({ success: false, error: 'No one on standby or token not resolved' });
  }

  const alertId           = `manual-${Date.now()}`;
  const resolvedChannelId   = channelId || 'general';
  const resolvedChannelName = channelName || 'General';
  const resolvedSeverity    = severity || 'WARNING';

  const success = await fcm.sendToToken(
    standby.fcmToken,
    { title, body: message },
    { alertId, channelId: resolvedChannelId, channelName: resolvedChannelName, severity: resolvedSeverity, source: 'Manual' },
  );

  if (success) {
    await saveAlertToFirestore({ alertId, title, body: message, severity: resolvedSeverity, channelId: resolvedChannelId, channelName: resolvedChannelName, source: 'Manual' });
    await logAuditAction({
      action: 'ALERT_SENT',
      performedBy: req.authUser!.email,
      performedByEmail: req.authUser!.email,
      description: `Sent alert to standby (${standby.email}): ${title}`,
      metadata: { alertId, sentTo: standby.email },
    });
  }

  res.json({ success, sentTo: standby.email });
});

router.post('/alerts/send-topic', requireRole('MANAGER'), async (req: Request, res: Response) => {
  const { topic, title, message, severity, channelId, channelName } = req.body;

  if (!topic || !title || !message) {
    return res.status(400).json({ success: false, error: 'Missing required fields: topic, title, message' });
  }

  const success = await fcm.sendToTopic(
    topic,
    { title, body: message },
    { alertId: `manual-${Date.now()}`, channelId: channelId || 'general', channelName: channelName || 'General', severity: severity || 'WARNING', source: 'Manual' },
  );

  res.json({ success, topic });
});

router.post('/alerts/send-to-device', requireRole('MANAGER'), async (req: Request, res: Response) => {
  const { fcmToken, title, message, severity, channelId, channelName } = req.body;

  if (!fcmToken || !title || !message) {
    return res.status(400).json({ success: false, error: 'Missing required fields: fcmToken, title, message' });
  }

  const alertId           = `manual-${Date.now()}`;
  const resolvedChannelId   = channelId || 'general';
  const resolvedChannelName = channelName || 'General';
  const resolvedSeverity    = severity || 'WARNING';

  const success = await fcm.sendToToken(
    fcmToken,
    { title, body: message },
    { alertId, channelId: resolvedChannelId, channelName: resolvedChannelName, severity: resolvedSeverity, source: 'Manual' },
  );

  if (success) {
    await saveAlertToFirestore({ alertId, title, body: message, severity: resolvedSeverity, channelId: resolvedChannelId, channelName: resolvedChannelName, source: 'Manual' });
    await logAuditAction({
      action: 'ALERT_SENT',
      performedBy: req.authUser!.email,
      performedByEmail: req.authUser!.email,
      description: `Sent alert to device: ${title}`,
      metadata: { alertId, fcmToken: fcmToken.slice(0, 20) + '...' },
    });
  }

  res.json({ success, sentTo: fcmToken.slice(0, 20) + '...' });
});

// ── Alert Acknowledgment / Management ─────────────────────────────────────────
router.post('/alerts/:alertId/acknowledge', async (req: Request, res: Response) => {
  const { alertId } = req.params;

  if (!admin.apps.length) return res.status(503).json({ success: false, error: 'Firebase not available' });

  try {
    await admin.firestore().collection('alerts').doc(alertId).update({
      isRead: true,
      acknowledgedBy: req.authUser!.email,
      acknowledgedAt: Date.now(),
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to acknowledge alert:', err);
    res.status(500).json({ success: false, error: 'Failed to update alert' });
  }
});

router.post('/alerts/bulk-mark-read', requireRole('MANAGER'), async (req: Request, res: Response) => {
  const { alertIds } = req.body as { alertIds: string[] };

  if (!Array.isArray(alertIds) || alertIds.length === 0) {
    return res.status(400).json({ success: false, error: 'alertIds array required' });
  }
  if (!admin.apps.length) return res.status(503).json({ success: false, error: 'Firebase not available' });

  try {
    const now = Date.now();
    const batch = admin.firestore().batch();
    alertIds.forEach(id => {
      batch.update(admin.firestore().collection('alerts').doc(id), {
        isRead: true, acknowledgedAt: now, acknowledgedBy: req.authUser!.email,
      });
    });
    await batch.commit();

    await logAuditAction({
      action: 'ALERT_UPDATED',
      performedBy: req.authUser!.email,
      performedByEmail: req.authUser!.email,
      description: `Marked ${alertIds.length} alert(s) as read`,
      metadata: { alertCount: alertIds.length },
    });

    res.json({ success: true, updated: alertIds.length });
  } catch (err) {
    console.error('Bulk mark-read error:', err);
    res.status(500).json({ success: false, error: 'Failed to update alerts' });
  }
});

router.post('/alerts/bulk-delete', requireRole('MANAGER'), async (req: Request, res: Response) => {
  const { alertIds } = req.body as { alertIds: string[] };

  if (!Array.isArray(alertIds) || alertIds.length === 0) {
    return res.status(400).json({ success: false, error: 'alertIds array required' });
  }
  if (!admin.apps.length) return res.status(503).json({ success: false, error: 'Firebase not available' });

  try {
    const batch = admin.firestore().batch();
    alertIds.forEach(id => batch.delete(admin.firestore().collection('alerts').doc(id)));
    await batch.commit();

    await logAuditAction({
      action: 'ALERT_DELETED',
      performedBy: req.authUser!.email,
      performedByEmail: req.authUser!.email,
      description: `Deleted ${alertIds.length} alert(s)`,
      metadata: { alertCount: alertIds.length },
    });

    res.json({ success: true, deleted: alertIds.length });
  } catch (err) {
    console.error('Bulk delete error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete alerts' });
  }
});

// ── User Invite ───────────────────────────────────────────────────────────────
router.post('/users/invite', requireRole('ADMIN'), async (req: Request, res: Response) => {
  const { email, displayName, role } = req.body;

  if (!email || !displayName) {
    return res.status(400).json({ success: false, error: 'Missing required fields: email, displayName' });
  }
  if (!admin.apps.length) {
    return res.status(503).json({ success: false, error: 'Firebase not available' });
  }

  try {
    // Create Firebase Auth account (no password — user sets it via the reset link)
    let uid: string;
    try {
      const existing = await admin.auth().getUserByEmail(email);
      uid = existing.uid;
    } catch {
      const created = await admin.auth().createUser({ email, displayName });
      uid = created.uid;
    }

    // Save/update user record in Firestore
    await admin.firestore().collection('users').doc(uid).set(withTenant({
      email,
      displayName,
      role: role ?? 'USER',
      isActive: true,
      createdAt: Date.now(),
    }), { merge: true });

    // After setting their password, the user is redirected to the portal login page.
    // continueUrl must be an authorized domain in Firebase Console → Auth → Settings.
    const continueUrl = 'https://alertbuddy-web.vercel.app/login';

    // Generate a set-password link — fall back without continueUrl if domain not yet whitelisted
    let inviteLink: string;
    try {
      inviteLink = await admin.auth().generatePasswordResetLink(email, { url: continueUrl });
    } catch {
      inviteLink = await admin.auth().generatePasswordResetLink(email);
    }

    // Also send email via Firebase Auth REST API so the invitee gets it automatically
    const apiKey = process.env.VITE_FIREBASE_API_KEY;
    let emailSent = false;
    if (apiKey) {
      try {
        const emailRes = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestType: 'PASSWORD_RESET', email, continueUrl }),
          }
        );
        emailSent = emailRes.ok;
        if (!emailRes.ok) console.error('Firebase email API:', await emailRes.text());
      } catch (emailErr) {
        console.error('Failed to send invite email:', emailErr);
      }
    }

    console.log(`✉️  User invited: ${email}, email sent: ${emailSent}`);

    await logAuditAction({
      action: 'USER_CREATED',
      performedBy: req.authUser!.email,
      performedByEmail: req.authUser!.email,
      description: `Invited user: ${email}`,
      metadata: { email, role: role ?? 'USER' },
    });

    res.json({ success: true, uid, inviteLink, emailSent });
  } catch (err: any) {
    console.error('Failed to invite user:', err);
    res.status(500).json({ success: false, error: err.message ?? 'Failed to create user' });
  }
});

// ── Alert Templates ───────────────────────────────────────────────────────────
router.get('/alert-templates', async (_req: Request, res: Response) => {
  if (!fcm.isFirebaseReady()) return res.json([]);
  try {
    const snap = await admin.firestore()
      .collection('alert_templates')
      .orderBy('createdAt', 'desc')
      .get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch { res.json([]); }
});

router.post('/alert-templates', requireRole('ADMIN'), async (req: Request, res: Response) => {
  const { name, title, message, severity, channelId, channelName } = req.body;
  if (!name || !title || !message) {
    return res.status(400).json({ success: false, error: 'Missing required fields: name, title, message' });
  }
  if (!admin.apps.length) return res.status(503).json({ success: false, error: 'Firebase not available' });
  try {
    const ref = await admin.firestore().collection('alert_templates').add(withTenant({
      name, title, message,
      severity: severity ?? 'WARNING',
      channelId: channelId ?? 'core-monitoring',
      channelName: channelName ?? 'Core Services Monitoring',
      createdAt: Date.now(),
    }));

    await logAuditAction({
      action: 'SETTINGS_CHANGED',
      performedBy: req.authUser!.email,
      performedByEmail: req.authUser!.email,
      description: `Created alert template: ${name}`,
      metadata: { templateId: ref.id, templateName: name },
    });

    res.json({ success: true, id: ref.id });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/alert-templates/:id', requireRole('ADMIN'), async (req: Request, res: Response) => {
  if (!admin.apps.length) return res.status(503).json({ success: false, error: 'Firebase not available' });
  try {
    await admin.firestore().collection('alert_templates').doc(req.params.id).delete();

    await logAuditAction({
      action: 'SETTINGS_CHANGED',
      performedBy: req.authUser!.email,
      performedByEmail: req.authUser!.email,
      description: `Deleted alert template: ${req.params.id}`,
      metadata: { templateId: req.params.id },
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
