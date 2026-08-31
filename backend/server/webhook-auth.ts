import { timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { getWebhookConfig } from './config-store.js';

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // Compare against a fixed-length buffer first so length differences
  // don't short-circuit before timingSafeEqual (which requires equal lengths).
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export { safeCompare };

/**
 * Credentials for every inbound monitoring webhook (Grafana, Zabbix, …).
 * Alert Buddy is the gateway — one credential set, any number of sources.
 * Stored in Firestore (config/webhook, editable from the portal) with an
 * environment-variable fallback so a fresh deploy works immediately:
 *
 *   WEBHOOK_USER / WEBHOOK_PASSWORD   → HTTP Basic  (Grafana contact points, Zabbix)
 *   WEBHOOK_TOKEN                     → Bearer token
 *   WEBHOOK_TENANT_TOKEN             → path token   (/api/webhooks/zabbix/<token>)
 *
 * Legacy GRAFANA_WEBHOOK_USER / GRAFANA_WEBHOOK_PASSWORD are still honoured.
 * Fails closed: if nothing is configured, every webhook request is rejected.
 */

function unauthorized(res: Response, error: string) {
  res.set('WWW-Authenticate', 'Basic realm="Alert Buddy Webhook", Bearer');
  return res.status(401).json({ success: false, error });
}

function basicAuthOk(encoded: string, user: string, pass: string): boolean {
  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  const sep = decoded.indexOf(':');
  const reqUser = sep >= 0 ? decoded.slice(0, sep) : decoded;
  const reqPass = sep >= 0 ? decoded.slice(sep + 1) : '';
  // Evaluate both halves regardless of the first result to keep timing flat.
  const userOk = safeCompare(reqUser, user);
  const passOk = safeCompare(reqPass, pass);
  return userOk && passOk;
}

export async function requireWebhookAuth(req: Request, res: Response, next: NextFunction) {
  const { basicUser, basicPassword, bearerToken } = await getWebhookConfig();

  if (!bearerToken && !(basicUser && basicPassword)) {
    console.error('⚠️  No webhook credentials configured — rejecting request');
    return res.status(500).json({ success: false, error: 'Webhook authentication is not configured on the server' });
  }

  const [scheme, encoded] = (req.headers.authorization || '').split(' ');
  if (!encoded) return unauthorized(res, 'Missing credentials');

  if (scheme === 'Bearer' && bearerToken) {
    return safeCompare(encoded, bearerToken) ? next() : unauthorized(res, 'Invalid token');
  }

  if (scheme === 'Basic' && basicUser && basicPassword) {
    return basicAuthOk(encoded, basicUser, basicPassword) ? next() : unauthorized(res, 'Invalid credentials');
  }

  return unauthorized(res, 'Missing credentials');
}

/** Validate a path-supplied tenant token (constant-time). */
export async function verifyTenantToken(token: string): Promise<boolean> {
  const { tenantToken } = await getWebhookConfig();
  return Boolean(tenantToken) && safeCompare(token, tenantToken);
}

/** @deprecated use requireWebhookAuth */
export const requireBasicAuth = requireWebhookAuth;
