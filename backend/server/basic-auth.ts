import { timingSafeEqual } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

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

/**
 * Basic-auth middleware for the Grafana webhook.
 * Credentials come from GRAFANA_WEBHOOK_USER / GRAFANA_WEBHOOK_PASSWORD.
 * Fails closed: if either env var is missing, requests are rejected rather
 * than silently accepted unauthenticated.
 */
export function requireBasicAuth(req: Request, res: Response, next: NextFunction) {
  const expectedUser = process.env.GRAFANA_WEBHOOK_USER;
  const expectedPass = process.env.GRAFANA_WEBHOOK_PASSWORD;

  if (!expectedUser || !expectedPass) {
    console.error('⚠️  GRAFANA_WEBHOOK_USER/GRAFANA_WEBHOOK_PASSWORD not set — rejecting webhook request');
    return res.status(500).json({ success: false, error: 'Webhook authentication is not configured on the server' });
  }

  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');

  if (scheme !== 'Basic' || !encoded) {
    res.set('WWW-Authenticate', 'Basic realm="Grafana Webhook"');
    return res.status(401).json({ success: false, error: 'Missing credentials' });
  }

  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  const sepIndex = decoded.indexOf(':');
  const reqUser = sepIndex >= 0 ? decoded.slice(0, sepIndex) : decoded;
  const reqPass = sepIndex >= 0 ? decoded.slice(sepIndex + 1) : '';

  if (!safeCompare(reqUser, expectedUser) || !safeCompare(reqPass, expectedPass)) {
    res.set('WWW-Authenticate', 'Basic realm="Grafana Webhook"');
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  next();
}
