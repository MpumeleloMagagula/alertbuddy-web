/**
 * Backend authentication + authorization.
 *
 * Every /api route except the health check and the monitoring webhooks (which
 * carry their own credential) requires a Firebase ID token:
 *
 *     Authorization: Bearer <firebase id token>
 *
 * The portal and the mobile app both obtain this from the Firebase Auth SDK
 * (`user.getIdToken()`). We verify it with the Admin SDK, then look up the
 * caller's role from the `users` collection.
 */

import type { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';
import { TENANT_ID } from './tenant.js';

export type Role = 'ADMIN' | 'MANAGER' | 'USER';

export interface AuthUser {
  uid: string;
  email: string;
  role: Role;
  tenantId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

// ── Role lookup (cached) ──────────────────────────────────────────────────────

interface CachedRole { role: Role; uid: string; expiresAt: number }
const roleCache = new Map<string, CachedRole>();
const ROLE_TTL_MS = 60_000;

function normalizeRole(raw: unknown): Role {
  const r = typeof raw === 'string' ? raw.toUpperCase() : '';
  return r === 'ADMIN' || r === 'MANAGER' ? r : 'USER';
}

/**
 * Resolve a role from Firestore. The `users` collection is written both keyed by
 * uid (invite flow) and with random ids (seed / legacy), so try uid first then
 * fall back to an email match.
 */
async function resolveRole(uid: string, email: string): Promise<Role> {
  const cached = roleCache.get(uid);
  if (cached && cached.expiresAt > Date.now()) return cached.role;

  let role: Role = 'USER';
  try {
    const db = admin.firestore();
    const byId = await db.collection('users').doc(uid).get();
    if (byId.exists) {
      role = normalizeRole(byId.data()?.role);
    } else if (email) {
      const byEmail = await db.collection('users').where('email', '==', email).limit(1).get();
      if (!byEmail.empty) role = normalizeRole(byEmail.docs[0].data().role);
    }
  } catch (err) {
    console.error('Role lookup failed, defaulting to USER:', err);
  }

  roleCache.set(uid, { role, uid, expiresAt: Date.now() + ROLE_TTL_MS });
  return role;
}

/** Clear a cached role (call after a role change so it takes effect immediately). */
export function invalidateRoleCache(uid?: string) {
  if (uid) roleCache.delete(uid);
  else roleCache.clear();
}

// ── Middleware ────────────────────────────────────────────────────────────────

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!admin.apps.length) {
    return res.status(503).json({ success: false, error: 'Authentication is not available (Firebase not configured)' });
  }

  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ success: false, error: 'Missing bearer token' });
  }

  let decoded: admin.auth.DecodedIdToken;
  try {
    decoded = await admin.auth().verifyIdToken(token);
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }

  const email = decoded.email ?? '';
  const role = await resolveRole(decoded.uid, email);
  req.authUser = { uid: decoded.uid, email, role, tenantId: TENANT_ID };
  next();
}

const RANK: Record<Role, number> = { USER: 0, MANAGER: 1, ADMIN: 2 };

/**
 * Gate a route to a minimum role. `requireRole('MANAGER')` also lets ADMINs
 * through; `requireRole('ADMIN','MANAGER')` is equivalent to `requireRole('MANAGER')`.
 */
export function requireRole(...roles: Role[]) {
  const min = Math.min(...roles.map(r => RANK[r]));
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    if (RANK[req.authUser.role] < min) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }
    next();
  };
}
