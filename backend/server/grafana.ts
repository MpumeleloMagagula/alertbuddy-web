/**
 * Grafana Unified Alerting webhook parser
 * Maps Grafana alert payloads to Alert Buddy format
 */

interface GrafanaAlert {
  status: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  startsAt?: string;
  endsAt?: string;
  generatorURL?: string;
  fingerprint?: string;
  silenceURL?: string;
  dashboardURL?: string;
  panelURL?: string;
  values?: Record<string, number>;
}

interface GrafanaWebhookPayload {
  receiver: string;
  status: string;
  alerts: GrafanaAlert[];
  groupLabels: Record<string, string>;
  commonLabels: Record<string, string>;
  commonAnnotations: Record<string, string>;
  externalURL: string;
  version: string;
  groupKey: string;
  truncatedAlerts?: number;
}

export interface ParsedAlert {
  title: string;
  message: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  channelId: string;
  channelName: string;
  alertId: string;
  source: string;
}

// Channel mapping: Grafana folder/label → Alert Buddy channel
const CHANNEL_MAP: Record<string, { id: string; name: string }> = {
  'infinity dal ms': { id: 'infinity-dal-ms', name: 'Infinity DAL MS' },
  'infinity online': { id: 'infinity-online', name: 'Infinity Online' },
  'nemo': { id: 'nemo', name: 'Nemo' },
  'online dal': { id: 'online-dal', name: 'Online DAL' },
  'vsa crisis': { id: 'vsa-crisis', name: 'VSA IT Crisis War Room' },
  'vsa it crisis': { id: 'vsa-crisis', name: 'VSA IT Crisis War Room' },
};

const DEFAULT_CHANNEL = { id: 'vsa-crisis', name: 'VSA IT Crisis War Room' };

/**
 * Map Grafana severity to Alert Buddy severity
 */
function mapSeverity(grafanaSeverity?: string): 'CRITICAL' | 'WARNING' | 'INFO' {
  if (!grafanaSeverity) return 'WARNING';

  const severity = grafanaSeverity.toLowerCase();

  if (['critical', 'high', 'error'].includes(severity)) {
    return 'CRITICAL';
  }

  if (['warning', 'warn', 'medium'].includes(severity)) {
    return 'WARNING';
  }

  return 'INFO';
}

/**
 * Determine channel from Grafana labels
 */
function determineChannel(labels: Record<string, string>): { id: string; name: string } {
  // Check in priority order
  const checkLabels = [
    labels.grafana_folder,
    labels.channel,
    labels.service,
    labels.job,
    labels.namespace,
  ];

  for (const label of checkLabels) {
    if (label) {
      const normalized = label.toLowerCase().trim();
      const channel = CHANNEL_MAP[normalized];
      if (channel) {
        return channel;
      }
    }
  }

  return DEFAULT_CHANNEL;
}

/**
 * Parse Grafana webhook payload
 */
export function parseGrafanaWebhook(payload: GrafanaWebhookPayload): ParsedAlert[] {
  const parsedAlerts: ParsedAlert[] = [];

  for (const alert of payload.alerts) {
    // Only process firing alerts
    if (alert.status !== 'firing') {
      continue;
    }

    const labels = alert.labels || {};
    const annotations = alert.annotations || {};

    // Determine channel
    const channel = determineChannel(labels);

    // Map severity
    const severity = mapSeverity(labels.severity);

    // Build title
    const alertName = labels.alertname || 'Alert';
    const instance = labels.instance || '';
    const title = instance 
      ? `${alertName} — ${instance}`
      : alertName;

    // Build message
    const summary = annotations.summary || '';
    const description = annotations.description || '';
    const message = summary || description || 'No details provided';

    // Create parsed alert
    parsedAlerts.push({
      title,
      message,
      severity,
      channelId: channel.id,
      channelName: channel.name,
      alertId: alert.fingerprint || `grafana-${Date.now()}`,
      source: 'Grafana',
    });
  }

  return parsedAlerts;
}

/**
 * Validate Grafana webhook payload
 */
export function validateGrafanaPayload(payload: any): payload is GrafanaWebhookPayload {
  return (
    payload &&
    typeof payload === 'object' &&
    Array.isArray(payload.alerts) &&
    typeof payload.status === 'string'
  );
}

/**
 * Add or update channel mapping
 */
export function addChannelMapping(grafanaLabel: string, channelId: string, channelName: string): void {
  const normalized = grafanaLabel.toLowerCase().trim();
  CHANNEL_MAP[normalized] = { id: channelId, name: channelName };
  console.log(`✅ Channel mapping added: "${grafanaLabel}" → ${channelName}`);
}

/**
 * Get all channel mappings
 */
export function getChannelMappings(): Record<string, { id: string; name: string }> {
  return { ...CHANNEL_MAP };
}
