import { Router, Request, Response } from 'express';
import * as fcm from './fcm.js';
import * as deviceStorage from './device-storage.js';
import * as standbyStorage from './standby-storage.js';
import * as grafana from './grafana.js';

const router = Router();

// ========== Server Status ==========
router.get('/status', (req: Request, res: Response) => {
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
router.post('/devices/register', (req: Request, res: Response) => {
  const { deviceId, fcmToken, email } = req.body;

  if (!deviceId || !fcmToken || !email) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: deviceId, fcmToken, email',
    });
  }

  const device = deviceStorage.registerDevice(deviceId, fcmToken, email);

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

router.post('/devices/unregister', (req: Request, res: Response) => {
  const { deviceId } = req.body;

  if (!deviceId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field: deviceId',
    });
  }

  const success = deviceStorage.unregisterDevice(deviceId);

  res.json({
    success,
    message: success ? 'Device unregistered' : 'Device not found',
  });
});

router.get('/devices', (req: Request, res: Response) => {
  const devices = deviceStorage.getAllDevices();
  res.json(devices);
});

// ========== Standby Management ==========
router.get('/standby/current', (req: Request, res: Response) => {
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

router.delete('/standby', (req: Request, res: Response) => {
  const standby = standbyStorage.clearStandby();
  res.json({
    success: true,
    standby,
  });
});

router.get('/standby/history', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 20;
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

  const result = await fcm.sendToMultipleTokens(
    tokens,
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

  const success = await fcm.sendToToken(
    standby.fcmToken,
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
