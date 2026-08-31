/**
 * Shared alert-routing primitives used by every webhook source
 * (Grafana, Zabbix, …).
 *
 * Parsers turn a source payload into ParsedAlert[]. They do NOT resolve the
 * Alert Buddy channel themselves — they emit `channelCandidates` (raw label /
 * tag / folder values in priority order) and the dispatch pipeline resolves them
 * against the tenant's channel map (see config-store.ts).
 */

export type Severity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface ParsedAlert {
  title: string;
  message: string;
  severity: Severity;
  /** Raw routing hints in priority order; resolved to a channel by dispatch. */
  channelCandidates: string[];
  alertId: string;
  /** Human-readable origin, shown in the app + audit log: "Grafana", "Zabbix", … */
  source: string;
  /** 'firing' → notify; 'resolved' → close the matching alert, no push */
  status: 'firing' | 'resolved';
  /** Link back to the source UI for the on-call engineer, when available */
  url?: string;
}

export interface Channel {
  id: string;
  name: string;
  /** Lower-cased label/tag/folder values that route to this channel. */
  matchKeys: string[];
}

export const DEFAULT_CHANNEL = { id: 'vsa-crisis', name: 'VSA IT Crisis War Room' };

/**
 * Built-in channel map. Used to seed a fresh deployment's `channels` collection;
 * after that the Firestore copy is authoritative (editable in the portal).
 */
export const SEED_CHANNELS: Channel[] = [
  { id: 'infinity-dal-ms', name: 'Infinity DAL MS', matchKeys: ['infinity dal ms'] },
  { id: 'infinity-online', name: 'Infinity Online', matchKeys: ['infinity online'] },
  { id: 'nemo', name: 'Nemo', matchKeys: ['nemo'] },
  { id: 'online-dal', name: 'Online DAL', matchKeys: ['online dal'] },
  { id: 'vsa-crisis', name: 'VSA IT Crisis War Room', matchKeys: ['vsa crisis', 'vsa it crisis'] },
  { id: 'core-monitoring', name: 'Core Services Monitoring', matchKeys: ['core-monitoring', 'core services monitoring'] },
  { id: 'infra-alerts', name: 'Cloud Infrastructure Alerts', matchKeys: ['infra-alerts', 'cloud infrastructure alerts'] },
  { id: 'api-gateway', name: 'External API Gateway', matchKeys: ['api-gateway', 'external api gateway'] },
  { id: 'db-health', name: 'Database Health Cluster', matchKeys: ['db-health', 'database health cluster'] },
  { id: 'crisis-response', name: 'Urgent Crisis Response', matchKeys: ['crisis-response', 'urgent crisis response'] },
];

/**
 * Pure channel resolution against a supplied channel list. dispatch loads the
 * list from config-store and calls this.
 */
export function matchChannel(
  candidates: Array<string | undefined | null>,
  channels: Channel[],
): { id: string; name: string } {
  for (const raw of candidates) {
    if (!raw) continue;
    const key = raw.toLowerCase().trim();
    const hit = channels.find(c => c.id === key || c.matchKeys.includes(key));
    if (hit) return { id: hit.id, name: hit.name };
  }
  return DEFAULT_CHANNEL;
}

// ── Severity mapping ──────────────────────────────────────────────────────────
// Superset covering Grafana (critical/warning/info) and Zabbix
// (Disaster/High/Average/Warning/Information/Not classified, or numeric 0–5).
const CRITICAL_WORDS = ['critical', 'high', 'error', 'disaster', 'crit', 'sev1', 'p1', 'emergency'];
const WARNING_WORDS = ['warning', 'warn', 'medium', 'average', 'sev2', 'p2'];

export function mapSeverity(raw?: string | number | null): Severity {
  if (raw === undefined || raw === null || raw === '') return 'WARNING';

  // Zabbix numeric severity: 0 not classified, 1 info, 2 warning, 3 average, 4 high, 5 disaster
  if (typeof raw === 'number' || /^\d+$/.test(String(raw))) {
    const n = Number(raw);
    if (n >= 4) return 'CRITICAL';
    if (n >= 2) return 'WARNING';
    return 'INFO';
  }

  const s = String(raw).toLowerCase().trim();
  if (CRITICAL_WORDS.includes(s)) return 'CRITICAL';
  if (WARNING_WORDS.includes(s)) return 'WARNING';
  return 'INFO';
}
