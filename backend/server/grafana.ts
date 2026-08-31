/**
 * Grafana Unified Alerting webhook parser
 * Normalises a Grafana Alertmanager-style payload into Alert Buddy's ParsedAlert[].
 * Channel resolution + everything downstream live in ./alert-dispatch.
 */

import { ParsedAlert, mapSeverity } from './alert-routing.js';

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

export type { ParsedAlert };

/**
 * Parse a Grafana webhook payload into ParsedAlert[].
 * Both firing and resolved alerts are returned — dispatch decides what to do.
 */
export function parseGrafanaWebhook(payload: GrafanaWebhookPayload): ParsedAlert[] {
  const parsed: ParsedAlert[] = [];

  for (const alert of payload.alerts || []) {
    const labels = alert.labels || {};
    const annotations = alert.annotations || {};

    const channelCandidates = [
      labels.grafana_folder,
      labels.channel,
      labels.service,
      labels.job,
      labels.namespace,
    ].filter((v): v is string => Boolean(v));

    const alertName = labels.alertname || 'Alert';
    const instance = labels.instance || '';
    const title = instance ? `${alertName} — ${instance}` : alertName;

    const message =
      annotations.summary || annotations.description || 'No details provided';

    parsed.push({
      title,
      message,
      severity: mapSeverity(labels.severity),
      channelCandidates,
      alertId: alert.fingerprint || `grafana-${Date.now()}`,
      source: 'Grafana',
      status: alert.status === 'resolved' ? 'resolved' : 'firing',
      url: alert.dashboardURL || alert.panelURL || alert.generatorURL || undefined,
    });
  }

  return parsed;
}

/**
 * Validate Grafana webhook payload shape
 */
export function validateGrafanaPayload(payload: any): payload is GrafanaWebhookPayload {
  return (
    payload &&
    typeof payload === 'object' &&
    Array.isArray(payload.alerts) &&
    typeof payload.status === 'string'
  );
}
