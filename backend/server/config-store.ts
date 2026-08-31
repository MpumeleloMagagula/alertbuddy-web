/**
 * Runtime configuration, stored in Firestore so it can be edited from the portal
 * without a redeploy. Falls back to environment variables / built-in seeds so a
 * fresh deployment works before anyone opens the Integrations page.
 *
 *   config/webhook   → { basicUser, basicPassword, bearerToken, tenantToken }
 *   channels/{id}    → { name, matchKeys: string[] }
 *
 * Reads are cached for CACHE_TTL_MS; writes go through this module and bust the
 * cache immediately.
 */

import admin from 'firebase-admin';
import { randomBytes } from 'node:crypto';
import { Channel, SEED_CHANNELS } from './alert-routing.js';
import { withTenant } from './tenant.js';

const CACHE_TTL_MS = 60_000;

// ── Webhook credentials ──────────────────────────────────────────────────────

export interface WebhookConfig {
  basicUser: string;
  basicPassword: string;
  bearerToken: string;
  tenantToken: string;
}

function envWebhookConfig(): WebhookConfig {
  return {
    basicUser: process.env.WEBHOOK_USER || process.env.GRAFANA_WEBHOOK_USER || '',
    basicPassword: process.env.WEBHOOK_PASSWORD || process.env.GRAFANA_WEBHOOK_PASSWORD || '',
    bearerToken: process.env.WEBHOOK_TOKEN || '',
    tenantToken: process.env.WEBHOOK_TENANT_TOKEN || '',
  };
}

let webhookCache: { value: WebhookConfig; expiresAt: number } | null = null;

export async function getWebhookConfig(): Promise<WebhookConfig> {
  if (webhookCache && webhookCache.expiresAt > Date.now()) return webhookCache.value;

  const fallback = envWebhookConfig();
  let value = fallback;

  if (admin.apps.length) {
    try {
      const snap = await admin.firestore().doc('config/webhook').get();
      if (snap.exists) {
        const d = snap.data() || {};
        value = {
          basicUser: d.basicUser ?? fallback.basicUser,
          basicPassword: d.basicPassword ?? fallback.basicPassword,
          bearerToken: d.bearerToken ?? fallback.bearerToken,
          tenantToken: d.tenantToken ?? fallback.tenantToken,
        };
      }
    } catch (err) {
      console.error('getWebhookConfig: Firestore read failed, using env fallback:', err);
    }
  }

  webhookCache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

export async function setWebhookConfig(patch: Partial<WebhookConfig>): Promise<WebhookConfig> {
  const current = await getWebhookConfig();
  const next: WebhookConfig = { ...current, ...patch };
  if (admin.apps.length) {
    await admin.firestore().doc('config/webhook').set(withTenant(next), { merge: true });
  }
  webhookCache = { value: next, expiresAt: Date.now() + CACHE_TTL_MS };
  return next;
}

export function generateToken(): string {
  return randomBytes(24).toString('base64url');
}

// ── Channels ─────────────────────────────────────────────────────────────────

let channelCache: { value: Channel[]; expiresAt: number } | null = null;

async function ensureChannelsSeeded(): Promise<void> {
  if (!admin.apps.length) return;
  const col = admin.firestore().collection('channels');
  const snap = await col.limit(1).get();
  if (!snap.empty) return;
  const batch = admin.firestore().batch();
  for (const c of SEED_CHANNELS) {
    batch.set(col.doc(c.id), withTenant({ name: c.name, matchKeys: c.matchKeys }));
  }
  await batch.commit();
  console.log(`🌱 Seeded ${SEED_CHANNELS.length} channels`);
}

export async function getChannels(): Promise<Channel[]> {
  if (channelCache && channelCache.expiresAt > Date.now()) return channelCache.value;

  let value: Channel[] = SEED_CHANNELS;
  if (admin.apps.length) {
    try {
      await ensureChannelsSeeded();
      const snap = await admin.firestore().collection('channels').get();
      if (!snap.empty) {
        value = snap.docs.map(d => ({
          id: d.id,
          name: d.data().name ?? d.id,
          matchKeys: Array.isArray(d.data().matchKeys) ? d.data().matchKeys : [],
        }));
      }
    } catch (err) {
      console.error('getChannels: Firestore read failed, using seed:', err);
    }
  }

  channelCache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

export async function upsertChannel(channel: Channel): Promise<void> {
  if (admin.apps.length) {
    await admin.firestore().collection('channels').doc(channel.id).set(
      withTenant({
        name: channel.name,
        matchKeys: channel.matchKeys.map(k => k.toLowerCase().trim()).filter(Boolean),
      }),
      { merge: true },
    );
  }
  channelCache = null;
}

export async function deleteChannel(id: string): Promise<void> {
  if (admin.apps.length) {
    await admin.firestore().collection('channels').doc(id).delete();
  }
  channelCache = null;
}
