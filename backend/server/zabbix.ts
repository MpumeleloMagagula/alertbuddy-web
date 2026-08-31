/**
 * Zabbix webhook parser
 *
 * Zabbix has no fixed webhook schema — the payload is whatever the "Media type"
 * script sends. Alert Buddy ships a media type (see backend/docs/zabbix-integration.md)
 * that POSTs the JSON shape below. The parser is deliberately tolerant so it also
 * copes with hand-rolled media types.
 *
 * Expected body (all fields optional except a name/alertId):
 * {
 *   "alertId":        "{EVENT.ID}",
 *   "eventValue":     "{EVENT.VALUE}",       // "1" = problem, "0" = recovery
 *   "eventNSeverity": "{EVENT.NSEVERITY}",   // 0..5
 *   "severity":       "{EVENT.SEVERITY}",    // "High", "Disaster", …
 *   "name":           "{EVENT.NAME}",
 *   "host":           "{HOST.NAME}",
 *   "hostGroups":     "{TRIGGER.HOSTGROUP.NAME}",
 *   "opdata":         "{EVENT.OPDATA}",
 *   "tags":           "{EVENT.TAGSJSON}",    // JSON: [{"tag":"channel","value":"nemo"}]
 *   "url":            "{$ZABBIX.URL}/tr_events.php?triggerid={TRIGGER.ID}&eventid={EVENT.ID}"
 * }
 */

import { ParsedAlert, mapSeverity } from './alert-routing.js';

interface ZabbixWebhookPayload {
  alertId?: string;
  eventId?: string;
  eventValue?: string | number;
  eventNSeverity?: string | number;
  severity?: string;
  name?: string;
  subject?: string;
  message?: string;
  host?: string;
  hostGroups?: string;
  opdata?: string;
  tags?: unknown;
  url?: string;
}

/** A Zabbix macro that was never substituted still looks like "{EVENT.ID}". */
function unsubstituted(v: unknown): boolean {
  return typeof v === 'string' && /^\{[\$#A-Z.]+\}$/.test(v.trim());
}

function clean(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  if (!s || unsubstituted(s)) return undefined;
  return s;
}

/**
 * Pull a tag value out of whatever shape `tags` arrived in:
 *  - {EVENT.TAGSJSON}: '[{"tag":"channel","value":"nemo"}]'  (string or parsed array)
 *  - {EVENT.TAGS}:     'channel: nemo, env: prod'            (comma/space separated)
 *  - object:           { channel: 'nemo' }
 */
function extractTag(tags: unknown, key: string): string | undefined {
  if (!tags) return undefined;
  const wanted = key.toLowerCase();

  let value: unknown = tags;
  if (typeof value === 'string') {
    const s = value.trim();
    if (unsubstituted(s)) return undefined;
    if (s.startsWith('[') || s.startsWith('{')) {
      try { value = JSON.parse(s); } catch { /* fall through to string parsing */ }
    }
    if (typeof value === 'string') {
      // "channel: nemo, env: prod"
      for (const part of value.split(',')) {
        const [k, ...rest] = part.split(/[:=]/);
        if (k && k.trim().toLowerCase() === wanted) return rest.join(':').trim() || undefined;
      }
      return undefined;
    }
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (entry && typeof entry === 'object') {
        const tag = (entry as any).tag ?? (entry as any).name;
        if (typeof tag === 'string' && tag.toLowerCase() === wanted) {
          return clean((entry as any).value) ?? '';
        }
      }
    }
    return undefined;
  }

  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k.toLowerCase() === wanted) return clean(v);
    }
  }
  return undefined;
}

function unwrap(payload: any): ZabbixWebhookPayload {
  if (payload && typeof payload === 'object' && payload.alert && typeof payload.alert === 'object') {
    return payload.alert;
  }
  return payload;
}

/**
 * Parse a Zabbix webhook payload into ParsedAlert[] (always 0 or 1 entry —
 * Zabbix fires one event per call — but returned as an array for symmetry
 * with the Grafana parser).
 */
export function parseZabbixWebhook(rawPayload: any): ParsedAlert[] {
  const payload = unwrap(rawPayload);

  const name = clean(payload.name) || clean(payload.subject) || 'Zabbix alert';
  const host = clean(payload.host);
  // {EVENT.NAME} often already contains the host — don't repeat it
  const title = host && !name.toLowerCase().includes(host.toLowerCase())
    ? `${name} — ${host}`
    : name;

  const message =
    clean(payload.opdata) || clean(payload.message) || name;

  // Recovery events carry eventValue "0"
  const eventValue = clean(payload.eventValue);
  const status: ParsedAlert['status'] = eventValue === '0' ? 'resolved' : 'firing';

  const severity = mapSeverity(
    clean(payload.eventNSeverity) ?? clean(payload.severity),
  );

  const channelCandidates = [
    extractTag(payload.tags, 'channel'),
    clean(payload.hostGroups),
    host,
  ].filter((v): v is string => Boolean(v));

  const rawId = clean(payload.alertId) || clean(payload.eventId);
  const alertId = rawId ? `zbx-${rawId}` : `zabbix-${Date.now()}`;

  return [{
    title,
    message,
    severity,
    channelCandidates,
    alertId,
    source: 'Zabbix',
    status,
    url: clean(payload.url),
  }];
}

/**
 * Validate Zabbix webhook payload shape.
 * Accepts anything object-shaped that carries a name/subject or an id —
 * the parser fills sensible defaults for the rest.
 */
export function validateZabbixPayload(payload: any): payload is ZabbixWebhookPayload {
  const p = unwrap(payload);
  if (!p || typeof p !== 'object' || Array.isArray(p)) return false;
  return Boolean(clean(p.name) || clean(p.subject) || clean(p.alertId) || clean(p.eventId));
}
