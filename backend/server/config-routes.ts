/**
 * Integrations configuration API (ADMIN only).
 * Backs the Settings → Integrations tab: webhook credentials + channel map.
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from './auth.js';
import { logAuditAction } from './enhanced-features.js';
import {
  getWebhookConfig, setWebhookConfig, generateToken,
  getChannels, upsertChannel, deleteChannel,
} from './config-store.js';

const router = Router();
router.use(requireAuth);

const adminOnly = requireRole('ADMIN');

// Never return the live secrets in full — mask them so the UI can show
// "configured / not configured" without leaking the value.
function maskWebhook(c: Awaited<ReturnType<typeof getWebhookConfig>>) {
  const mask = (v: string) => (v ? `${v.slice(0, 2)}••••${v.slice(-2)}` : '');
  return {
    basicUser: c.basicUser,
    basicPasswordSet: Boolean(c.basicPassword),
    basicPasswordMasked: mask(c.basicPassword),
    bearerTokenSet: Boolean(c.bearerToken),
    bearerTokenMasked: mask(c.bearerToken),
    tenantTokenSet: Boolean(c.tenantToken),
    tenantToken: c.tenantToken, // path token is not really a secret (it's in the URL)
  };
}

router.get('/config/webhook', adminOnly, async (_req: Request, res: Response) => {
  res.json(maskWebhook(await getWebhookConfig()));
});

router.put('/config/webhook', adminOnly, async (req: Request, res: Response) => {
  const { basicUser, basicPassword, bearerToken, regenerateTenantToken } = req.body ?? {};
  const patch: Record<string, string> = {};
  if (typeof basicUser === 'string') patch.basicUser = basicUser.trim();
  if (typeof basicPassword === 'string' && basicPassword) patch.basicPassword = basicPassword;
  if (typeof bearerToken === 'string') patch.bearerToken = bearerToken;
  if (regenerateTenantToken) patch.tenantToken = generateToken();

  const next = await setWebhookConfig(patch);

  await logAuditAction({
    action: 'SETTINGS_CHANGED',
    performedBy: req.authUser!.email,
    performedByEmail: req.authUser!.email,
    description: 'Updated webhook credentials',
    metadata: { fields: Object.keys(patch) },
  });

  res.json(maskWebhook(next));
});

// Any signed-in user can read the channel list (used by the Send Alert form).
router.get('/config/channels', async (_req: Request, res: Response) => {
  res.json(await getChannels());
});

router.post('/config/channels', adminOnly, async (req: Request, res: Response) => {
  const { id, name, matchKeys } = req.body ?? {};
  if (!id || !name) {
    return res.status(400).json({ success: false, error: 'id and name are required' });
  }
  const channel = {
    id: String(id).toLowerCase().trim(),
    name: String(name).trim(),
    matchKeys: Array.isArray(matchKeys) ? matchKeys.map(String) : [],
  };
  await upsertChannel(channel);

  await logAuditAction({
    action: 'SETTINGS_CHANGED',
    performedBy: req.authUser!.email,
    performedByEmail: req.authUser!.email,
    description: `Saved channel: ${channel.name}`,
    metadata: { channelId: channel.id },
  });

  res.json({ success: true, channel });
});

router.delete('/config/channels/:id', adminOnly, async (req: Request, res: Response) => {
  await deleteChannel(req.params.id);

  await logAuditAction({
    action: 'SETTINGS_CHANGED',
    performedBy: req.authUser!.email,
    performedByEmail: req.authUser!.email,
    description: `Deleted channel: ${req.params.id}`,
    metadata: { channelId: req.params.id },
  });

  res.json({ success: true });
});

export default router;
