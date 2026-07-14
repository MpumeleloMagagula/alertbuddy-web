import { Router, Request, Response } from 'express';
import admin from 'firebase-admin';
import * as fcm from './fcm.js';
import * as deviceStorage from './device-storage.js';
import * as standbyStorage from './standby-storage.js';
import * as grafana from './grafana.js';

const router = Router();

// ========== Firestore Alert Helper ==========
async function saveAlertToFirestore(params: {
  alertId: string;
  title: string;
  body: string;
  severity: string;
  channelId: string;
  channelName: string;
  source: string;
}) {
  if (!admin.apps.length) return;
  try {
    await admin.firestore().collection('alerts').doc(params.alertId).set({
      channelId: params.channelId,
      channelName: params.channelName,
      title: params.title,
      body: params.body,
      severity: params.severity,
      timestamp: Date.now(),
      isRead: false,
      source: params.source,
    });
  } catch (err) {
    console.error('Failed to save alert to Firestore:', err);
  }
}

// ========== Server Status ==========
router.get('/status', (_req: Request, res: Response) => {
  const standby = standbyStorage.getCurrentStandby();
  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);

  res.json({
    status: 'running',
    firebase: fcm.isFirebaseReady() ? 'connected' : 'disabled',
    standby,
    registeredDevices: deviceStorage.getDeviceCount(),
    uptime: `${hours}h ${minutes}m`,
  });
});

// ========== Device Management ==========
router.post('/devices/register', async (req: Request, res: Response) => {
  const { deviceId, fcmToken, email, deviceName, manufacturer, deviceModel, osVersion, appVersion, batteryLevel, isCharging } = req.body;

  if (!deviceId || !fcmToken || !email) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: deviceId, fcmToken, email',
    });
  }

  const device = deviceStorage.registerDevice(deviceId, fcmToken, email);

  // Persist to Firestore so the web portal can see registered devices
  if (fcm.isFirebaseReady()) {
    try {
      await admin.firestore().collection('devices').doc(deviceId).set({
        deviceId,
        fcmToken,
        email,
        deviceName: deviceName ?? null,
        manufacturer: manufacturer ?? null,
        deviceModel: deviceModel ?? null,
        osVersion: osVersion ?? null,
        appVersion: appVersion ?? null,
        batteryLevel: batteryLevel ?? null,
        isCharging: isCharging ?? null,
        registeredAt: device.registeredAt,
        lastSeen: device.lastSeen,
      }, { merge: true });
      console.log(`📦 Device saved to Firestore: ${email}`);
    } catch (err) {
      console.error('Failed to save device to Firestore:', err);
    }
  }

  // If this person is on standby, update their token
  const standby = standbyStorage.getCurrentStandby();
  if (standby.onStandby && standby.email === email) {
    standbyStorage.updateStandby(email, standby.displayName!);
  }

  res.json({
    success: true,
    device,
  });
});

router.post('/devices/unregister', async (req: Request, res: Response) => {
  const { deviceId } = req.body;

  if (!deviceId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field: deviceId',
    });
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

  res.json({
    success,
    message: success ? 'Device unregistered' : 'Device not found',
  });
});

router.get('/devices', (_req: Request, res: Response) => {
  const devices = deviceStorage.getAllDevices();
  res.json(devices);
});

// ========== Standby Management ==========
router.get('/standby/current', (_req: Request, res: Response) => {
  const standby = standbyStorage.getCurrentStandby();
  res.json(standby);
});

router.post('/standby/update', (req: Request, res: Response) => {
  const { email, displayName, updatedByEmail } = req.body;

  if (!email || !displayName) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: email, displayName',
    });
  }

  const standby = standbyStorage.updateStandby(email, displayName, updatedByEmail);

  res.json({
    success: true,
    standby,
    tokenResolved: standby.tokenResolved,
  });
});

router.delete('/standby', (_req: Request, res: Response) => {
  const standby = standbyStorage.clearStandby();
  res.json({
    success: true,
    standby,
  });
});

router.get('/standby/history', (req: Request, res: Response) => {
  const limit = Number.parseInt(req.query.limit as string) || 20;
  const history = standbyStorage.getHandoverHistory(limit);
  res.json(history);
});

// ========== Alert Sending ==========
router.post('/alerts/send', async (req: Request, res: Response) => {
  const { title, message, severity, channelId, channelName } = req.body;

  if (!title || !message) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: title, message',
    });
  }

  const tokens = deviceStorage.getAllTokens();

  if (tokens.length === 0) {
    return res.json({
      success: false,
      error: 'No registered devices',
    });
  }

  const alertId = `manual-${Date.now()}`;
  const resolvedChannelId = channelId || 'general';
  const resolvedChannelName = channelName || 'General';
  const resolvedSeverity = severity || 'WARNING';

  const result = await fcm.sendToMultipleTokens(
    tokens,
    { title, body: message },
    { alertId, channelId: resolvedChannelId, channelName: resolvedChannelName, severity: resolvedSeverity, source: 'Manual' }
  );

  await saveAlertToFirestore({ alertId, title, body: message, severity: resolvedSeverity, channelId: resolvedChannelId, channelName: resolvedChannelName, source: 'Manual' });

  res.json({
    success: true,
    sent: result.successCount,
    failed: result.failureCount,
    totalDevices: tokens.length,
  });
});

router.post('/alerts/send-standby', async (req: Request, res: Response) => {
  const { title, message, severity, channelId, channelName } = req.body;

  if (!title || !message) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: title, message',
    });
  }

  const standby = standbyStorage.getCurrentStandby();

  if (!standby.onStandby || !standby.fcmToken) {
    return res.json({
      success: false,
      error: 'No one on standby or token not resolved',
    });
  }

  const alertId = `manual-${Date.now()}`;
  const resolvedChannelId = channelId || 'general';
  const resolvedChannelName = channelName || 'General';
  const resolvedSeverity = severity || 'WARNING';

  const success = await fcm.sendToToken(
    standby.fcmToken,
    { title, body: message },
    { alertId, channelId: resolvedChannelId, channelName: resolvedChannelName, severity: resolvedSeverity, source: 'Manual' }
  );

  if (success) {
    await saveAlertToFirestore({ alertId, title, body: message, severity: resolvedSeverity, channelId: resolvedChannelId, channelName: resolvedChannelName, source: 'Manual' });
  }

  res.json({
    success,
    sentTo: standby.email,
  });
});

router.post('/alerts/send-topic', async (req: Request, res: Response) => {
  const { topic, title, message, severity, channelId, channelName } = req.body;

  if (!topic || !title || !message) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: topic, title, message',
    });
  }

  const success = await fcm.sendToTopic(
    topic,
    { title, body: message },
    {
      alertId: `manual-${Date.now()}`,
      channelId: channelId || 'general',
      channelName: channelName || 'General',
      severity: severity || 'WARNING',
      source: 'Manual',
    }
  );

  res.json({
    success,
    topic,
  });
});

// Send to a specific device by FCM token
router.post('/alerts/send-to-device', async (req: Request, res: Response) => {
  const { fcmToken, title, message, severity, channelId, channelName } = req.body;

  if (!fcmToken || !title || !message) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: fcmToken, title, message',
    });
  }

  const alertId = `manual-${Date.now()}`;
  const resolvedChannelId = channelId || 'general';
  const resolvedChannelName = channelName || 'General';
  const resolvedSeverity = severity || 'WARNING';

  const success = await fcm.sendToToken(
    fcmToken,
    { title, body: message },
    { alertId, channelId: resolvedChannelId, channelName: resolvedChannelName, severity: resolvedSeverity, source: 'Manual' }
  );

  if (success) {
    await saveAlertToFirestore({ alertId, title, body: message, severity: resolvedSeverity, channelId: resolvedChannelId, channelName: resolvedChannelName, source: 'Manual' });
  }

  res.json({ success, sentTo: fcmToken.slice(0, 20) + '...' });
});

// ========== Alert Acknowledgment / Management ==========

// Called by the Android app when a user opens/acknowledges an alert
router.post('/alerts/:alertId/acknowledge', async (req: Request, res: Response) => {
  const { alertId } = req.params;
  const { acknowledgedBy, acknowledgedAt } = req.body;

  if (!admin.apps.length) {
    return res.status(503).json({ success: false, error: 'Firebase not available' });
  }

  try {
    await admin.firestore().collection('alerts').doc(alertId).update({
      isRead: true,
      acknowledgedBy: acknowledgedBy ?? null,
      acknowledgedAt: acknowledgedAt ?? Date.now(),
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to acknowledge alert:', err);
    res.status(500).json({ success: false, error: 'Failed to update alert' });
  }
});

router.post('/alerts/bulk-mark-read', async (req: Request, res: Response) => {
  const { alertIds, userEmail } = req.body as { alertIds: string[]; userEmail?: string };

  if (!Array.isArray(alertIds) || alertIds.length === 0) {
    return res.status(400).json({ success: false, error: 'alertIds array required' });
  }
  if (!admin.apps.length) {
    return res.status(503).json({ success: false, error: 'Firebase not available' });
  }

  try {
    const now = Date.now();
    const batch = admin.firestore().batch();
    alertIds.forEach(id => {
      batch.update(admin.firestore().collection('alerts').doc(id), {
        isRead: true,
        acknowledgedAt: now,
        acknowledgedBy: userEmail ?? null,
      });
    });
    await batch.commit();
    res.json({ success: true, updated: alertIds.length });
  } catch (err) {
    console.error('Bulk mark-read error:', err);
    res.status(500).json({ success: false, error: 'Failed to update alerts' });
  }
});

router.post('/alerts/bulk-delete', async (req: Request, res: Response) => {
  const { alertIds } = req.body as { alertIds: string[] };

  if (!Array.isArray(alertIds) || alertIds.length === 0) {
    return res.status(400).json({ success: false, error: 'alertIds array required' });
  }
  if (!admin.apps.length) {
    return res.status(503).json({ success: false, error: 'Firebase not available' });
  }

  try {
    const batch = admin.firestore().batch();
    alertIds.forEach(id => {
      batch.delete(admin.firestore().collection('alerts').doc(id));
    });
    await batch.commit();
    res.json({ success: true, deleted: alertIds.length });
  } catch (err) {
    console.error('Bulk delete error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete alerts' });
  }
});

// ========== Grafana Webhook ==========
router.post('/grafana/webhook', async (req: Request, res: Response) => {
  if (!grafana.validateGrafanaPayload(req.body)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid Grafana webhook payload',
    });
  }

  const parsedAlerts = grafana.parseGrafanaWebhook(req.body);

  if (parsedAlerts.length === 0) {
    return res.json({
      success: true,
      message: 'No firing alerts to process',
    });
  }

  console.log(`📨 Grafana webhook: ${parsedAlerts.length} alert(s)`);

  const results = [];

  for (const alert of parsedAlerts) {
    const standby = standbyStorage.getCurrentStandby();

    let success = false;

    if (standby.onStandby && standby.fcmToken) {
      // Send to standby person
      success = await fcm.sendToToken(
        standby.fcmToken,
        { title: alert.title, body: alert.message },
        {
          alertId: alert.alertId,
          channelId: alert.channelId,
          channelName: alert.channelName,
          severity: alert.severity,
          source: alert.source,
        }
      );

      results.push({
        alert: alert.title,
        sentTo: standby.email,
        success,
      });
    } else {
      // Broadcast to all devices
      const tokens = deviceStorage.getAllTokens();

      if (tokens.length > 0) {
        const result = await fcm.sendToMultipleTokens(
          tokens,
          { title: alert.title, body: alert.message },
          {
            alertId: alert.alertId,
            channelId: alert.channelId,
            channelName: alert.channelName,
            severity: alert.severity,
            source: alert.source,
          }
        );

        results.push({
          alert: alert.title,
          sentTo: 'all',
          successCount: result.successCount,
          failureCount: result.failureCount,
        });
      }
    }
  }

  res.json({
    success: true,
    processed: parsedAlerts.length,
    results,
  });
});

export default router;
