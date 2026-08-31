import express from 'express';
import admin from 'firebase-admin';
import { requireAuth, requireRole, invalidateRoleCache } from './auth.js';
import { withTenant } from './tenant.js';

const router = express.Router();

// Every route here needs a signed-in user; mutations additionally need a role.
router.use(requireAuth);

// Lazy getter for Firestore to avoid initialization order issues
const getDb = () => admin.firestore();

// ==========================================
// AUDIT LOG
// ==========================================

/**
 * Get audit logs with optional filtering
 */
router.get('/audit-logs', async (req, res) => {
  try {
    const { limit = 100, action, startDate, endDate } = req.query;

    let query = getDb().collection('audit_logs')
      .orderBy('timestamp', 'desc')
      .limit(Number(limit));

    // Filter by action type
    if (action && action !== 'ALL') {
      query = query.where('action', '==', action);
    }

    // Filter by date range
    if (startDate) {
      query = query.where('timestamp', '>=', Number(startDate));
    }
    if (endDate) {
      query = query.where('timestamp', '<=', Number(endDate));
    }

    const snapshot = await query.get();
    const logs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(logs);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

/**
 * Create audit log entry
 */
async function logAuditAction(data: {
  action: string;
  performedBy: string;
  performedByEmail: string;
  description: string;
  metadata?: any;
}) {
  try {
    await getDb().collection('audit_logs').add(withTenant({
      ...data,
      timestamp: Date.now(),
    }));
  } catch (error) {
    console.error('Error logging audit action:', error);
  }
}

// ==========================================
// DEVICE HEALTH
// ==========================================

/**
 * Update device health information
 */
router.post('/devices/:deviceId/health', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { batteryLevel, isCharging, deviceModel, osVersion, appVersion } = req.body;

    const deviceRef = getDb().collection('devices').doc(deviceId);
    const device = await deviceRef.get();

    if (!device.exists) {
      return res.status(404).json({ error: 'Device not found' });
    }

    await deviceRef.update({
      batteryLevel,
      isCharging,
      deviceModel,
      osVersion,
      appVersion,
      lastSeen: Date.now(),
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating device health:', error);
    res.status(500).json({ error: 'Failed to update device health' });
  }
});

/**
 * Update device last seen
 */
router.post('/devices/:deviceId/ping', async (req, res) => {
  try {
    const { deviceId } = req.params;

    const deviceRef = getDb().collection('devices').doc(deviceId);
    await deviceRef.update({
      lastSeen: Date.now(),
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating device ping:', error);
    res.status(500).json({ error: 'Failed to update device ping' });
  }
});

/**
 * Get device health status
 */
router.get('/devices/health-summary', async (_req, res) => {
  try {
    const devicesSnapshot = await getDb().collection('devices').get();
    const devices = devicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);

    const summary = {
      total: devices.length,
      online: devices.filter((d: any) => d.lastSeen >= fiveMinutesAgo).length,
      lowBattery: devices.filter((d: any) => d.batteryLevel && d.batteryLevel < 20).length,
      offline: devices.filter((d: any) => d.lastSeen < fiveMinutesAgo).length,
    };

    res.json(summary);
  } catch (error) {
    console.error('Error fetching device health summary:', error);
    res.status(500).json({ error: 'Failed to fetch device health summary' });
  }
});

// ==========================================
// USER MANAGEMENT
// ==========================================

/**
 * Get all users
 */
router.get('/users', async (_req, res) => {
  try {
    const snapshot = await getDb().collection('users').get();
    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * Create a new user
 */
router.post('/users', requireRole('ADMIN'), async (req, res) => {
  try {
    const { adminId, adminEmail, ...userData } = req.body;
    const userRef = await getDb().collection('users').add(withTenant({
      ...userData,
      createdAt: Date.now(),
    }));

    await logAuditAction({
      action: 'USER_CREATED',
      performedBy: req.authUser!.email,
      performedByEmail: req.authUser!.email,
      description: `Created user: ${userData.email}`,
      metadata: { userId: userRef.id, email: userData.email },
    });

    res.json({ success: true, id: userRef.id });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

/**
 * Update a user
 */
// Fields a user is allowed to change on their OWN record
const SELF_EDITABLE_USER_FIELDS = ['displayName', 'department', 'position', 'phoneNumber', 'notificationPreferences'];

router.put('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const caller = req.authUser!;
    const isSelf = caller.uid === userId;
    const isAdmin = caller.role === 'ADMIN';

    if (!isSelf && !isAdmin) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const { adminId, adminEmail, ...incoming } = req.body;
    // A non-admin editing themselves may only touch profile/preference fields.
    const userData = isAdmin
      ? incoming
      : Object.fromEntries(Object.entries(incoming).filter(([k]) => SELF_EDITABLE_USER_FIELDS.includes(k)));

    // set+merge (not update) so this also works as an upsert for a user's
    // own profile/notification-preference edits, even if their Firestore
    // doc doesn't exist yet
    await getDb().collection('users').doc(userId).set(withTenant(userData), { merge: true });
    if (isAdmin && 'role' in incoming) invalidateRoleCache(userId);

    await logAuditAction({
      action: 'USER_UPDATED',
      performedBy: caller.email,
      performedByEmail: caller.email,
      description: `Updated user: ${userId}`,
      metadata: { userId, updates: Object.keys(userData) },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

/**
 * Delete a user
 */
router.delete('/users/:userId', requireRole('ADMIN'), async (req, res) => {
  try {
    const { userId } = req.params;

    await getDb().collection('users').doc(userId).delete();
    invalidateRoleCache(userId);

    await logAuditAction({
      action: 'USER_DELETED',
      performedBy: req.authUser!.email,
      performedByEmail: req.authUser!.email,
      description: `Deleted user: ${userId}`,
      metadata: { userId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ==========================================
// TEAM MANAGEMENT
// ==========================================

/**
 * Get team members
 */
router.get('/team', async (_req, res) => {
  try {
    const snapshot = await getDb().collection('team_members').get();
    const members = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(members);
  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

/**
 * Update team member
 */
router.put('/team/:memberId', requireRole('ADMIN'), async (req, res) => {
  try {
    const { memberId } = req.params;
    const { adminId, adminEmail, ...memberData } = req.body;

    await getDb().collection('team_members').doc(memberId).update(memberData);

    await logAuditAction({
      action: 'STANDBY_UPDATED',
      performedBy: req.authUser!.email,
      performedByEmail: req.authUser!.email,
      description: `Updated team member: ${memberId}`,
      metadata: { memberId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating team member:', error);
    res.status(500).json({ error: 'Failed to update team member' });
  }
});

// ==========================================
// SHIFT MANAGEMENT
// ==========================================

/**
 * Get all shifts
 */
router.get('/shifts', async (_req, res) => {
  try {
    const snapshot = await getDb().collection('shifts').get();
    const shifts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(shifts);
  } catch (error) {
    console.error('Error fetching shifts:', error);
    res.status(500).json({ error: 'Failed to fetch shifts' });
  }
});

/**
 * Create a shift
 */
router.post('/shifts', requireRole('ADMIN'), async (req, res) => {
  try {
    const { adminId, adminEmail, ...shiftData } = req.body;
    const shiftRef = await getDb().collection('shifts').add(withTenant({
      ...shiftData,
      createdAt: Date.now(),
    }));

    await logAuditAction({
      action: 'SETTINGS_CHANGED',
      performedBy: req.authUser!.email,
      performedByEmail: req.authUser!.email,
      description: `Created shift: ${shiftData.name}`,
      metadata: { shiftId: shiftRef.id, name: shiftData.name },
    });

    res.json({ success: true, id: shiftRef.id });
  } catch (error) {
    console.error('Error creating shift:', error);
    res.status(500).json({ error: 'Failed to create shift' });
  }
});

/**
 * Delete a shift
 */
router.delete('/shifts/:shiftId', requireRole('ADMIN'), async (req, res) => {
  try {
    const { shiftId } = req.params;

    await getDb().collection('shifts').doc(shiftId).delete();

    await logAuditAction({
      action: 'SETTINGS_CHANGED',
      performedBy: req.authUser!.email,
      performedByEmail: req.authUser!.email,
      description: `Deleted shift: ${shiftId}`,
      metadata: { shiftId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting shift:', error);
    res.status(500).json({ error: 'Failed to delete shift' });
  }
});

/**
 * Activate/Deactivate a shift
 */
router.post('/shifts/:shiftId/activate', requireRole('ADMIN'), async (req, res) => {
  try {
    const { shiftId } = req.params;
    const { isActive } = req.body;

    await getDb().collection('shifts').doc(shiftId).update({ isActive });

    await logAuditAction({
      action: 'SETTINGS_CHANGED',
      performedBy: req.authUser!.email,
      performedByEmail: req.authUser!.email,
      description: `${isActive ? 'Activated' : 'Deactivated'} shift: ${shiftId}`,
      metadata: { shiftId, isActive },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error toggling shift activation:', error);
    res.status(500).json({ error: 'Failed to toggle shift' });
  }
});

// Export utility function
export { logAuditAction };

export default router;
