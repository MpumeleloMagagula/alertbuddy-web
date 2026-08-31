/**
 * Monitoring webhook gateway routes.
 *
 * Alert Buddy is the single ingress for every monitoring system. Each source has
 * a thin parser (grafana.ts / zabbix.ts) that normalises its payload; the shared
 * dispatchAlerts() pipeline handles standby routing, broadcast fallback,
 * Firestore history and auto-resolve.
 *
 * These routes carry their OWN credential (requireWebhookAuth) and are mounted
 * ahead of the portal API so the Firebase-ID-token middleware never sees them.
 * The one exception is /webhooks/test, which is portal-only and needs a session.
 */

import { Router, Request, Response } from 'express';
import * as grafana from './grafana.js';
import * as zabbix from './zabbix.js';
import { requireWebhookAuth, verifyTenantToken } from './webhook-auth.js';
import { requireAuth, requireRole } from './auth.js';
import { dispatchAlerts } from './alert-dispatch.js';
import type { ParsedAlert } from './alert-routing.js';

const router = Router();

type WebhookSource = 'grafana' | 'zabbix';

const PARSERS: Record<WebhookSource, {
  validate: (body: any) => boolean;
  parse: (body: any) => ParsedAlert[];
}> = {
  grafana: { validate: grafana.validateGrafanaPayload, parse: grafana.parseGrafanaWebhook },
  zabbix: { validate: zabbix.validateZabbixPayload, parse: zabbix.parseZabbixWebhook },
};

async function handleWebhook(source: WebhookSource, body: any, res: Response) {
  const parser = PARSERS[source];

  if (!parser.validate(body)) {
    return res.status(400).json({ success: false, error: `Invalid ${source} webhook payload` });
  }

  const alerts = parser.parse(body);
  if (alerts.length === 0) {
    return res.json({ success: true, message: 'Nothing to process' });
  }

  const firing = alerts.filter(a => a.status === 'firing').length;
  console.log(`📨 ${source} webhook: ${alerts.length} event(s) (${firing} firing)`);

  const results = await dispatchAlerts(alerts);
  res.json({ success: true, processed: alerts.length, results });
}

// Canonical routes — HTTP Basic or Bearer credential
router.post('/webhooks/grafana', requireWebhookAuth, (req, res) => handleWebhook('grafana', req.body, res));
router.post('/webhooks/zabbix', requireWebhookAuth, (req, res) => handleWebhook('zabbix', req.body, res));

// Back-compat alias — existing Grafana contact points point here
router.post('/grafana/webhook', requireWebhookAuth, (req, res) => handleWebhook('grafana', req.body, res));

// Tenant-token routes — the token is in the path, handy for systems that can't
// set an Authorization header (e.g. a minimal Zabbix media type).
router.post('/webhooks/:source/:tenantToken', async (req: Request, res: Response) => {
  const source = req.params.source;
  if (source !== 'grafana' && source !== 'zabbix') {
    return res.status(404).json({ success: false, error: 'Unknown webhook source' });
  }
  if (!(await verifyTenantToken(req.params.tenantToken))) {
    return res.status(401).json({ success: false, error: 'Invalid tenant token' });
  }
  return handleWebhook(source, req.body, res);
});

// Portal-only test hook — requires a signed-in MANAGER/ADMIN session
router.post('/webhooks/test', requireAuth, requireRole('MANAGER'), (req: Request, res: Response) => {
  const { source, payload } = req.body ?? {};
  if (source !== 'grafana' && source !== 'zabbix') {
    return res.status(400).json({ success: false, error: 'source must be "grafana" or "zabbix"' });
  }
  return handleWebhook(source, payload, res);
});

export default router;
