import express from 'express';
import admin from 'firebase-admin';

const router = express.Router();

// Lazy getter for Firestore to avoid initialization order issues
const getDb = () => admin.firestore();

// ==========================================
// BULK ALERT ACTIONS
// ==========================================

/**
 * Mark multiple alerts as read
 */
router.post('/alerts/bulk-mark-read', async (req, res) => {
  try {
    const { alertIds } = req.body;

    if (!Array.isArray(alertIds) || alertIds.length === 0) {
      return res.status(400).json({ error: 'alertIds array is required' });
    }

    const batch = db.batch();

    for (const alertId of alertIds) {
      const alertRef = db.collection('alerts').doc(alertId);
      batch.update(alertRef, {
        isRead: true,
        acknowledgedAt: Date.now(),
        acknowledgedBy: req.body.userId || 'admin',
      });
    }

    await batch.commit();

    // Log audit entry
    await logAuditAction({
      action: 'ALERT_UPDATED',
      performedBy: req.body.userId || 'admin',
      performedByEmail: req.body.userEmail || 'admin@alertbuddy.com',
      description: `Marked ${alertIds.length} alerts as read`,
      metadata: { alertCount: alertIds.length },
    });

    res.json({
      success: true,
      updatedCount: alertIds.length,
    });
  } catch (error) {
    console.error('Error marking alerts as read:', error);
    res.status(500).json({ error: 'Failed to mark alerts as read' });
  }
});

/**
 * Delete multiple alerts
 */
router.post('/alerts/bulk-delete', async (req, res) => {
  try {
    const { alertIds } = req.body;

    if (!Array.isArray(alertIds) || alertIds.length === 0) {
      return res.status(400).json({ error: 'alertIds array is required' });
    }

    const batch = db.batch();

    for (const alertId of alertIds) {
      const alertRef = db.collection('alerts').doc(alertId);
      batch.delete(alertRef);
    }

    await batch.commit();

    // Log audit entry
    await logAuditAction({
      action: 'ALERT_DELETED',
      performedBy: req.body.userId || 'admin',
      performedByEmail: req.body.userEmail || 'admin@alertbuddy.com',
      description: `Deleted ${alertIds.length} alerts`,
      metadata: { alertCount: alertIds.length },
    });

    res.json({
      success: true,
      deletedCount: alertIds.length,
    });
  } catch (error) {
    console.error('Error deleting alerts:', error);
    res.status(500).json({ error: 'Failed to delete alerts' });
  }
});

// ==========================================
// AUDIT LOG
// ==========================================

/**
 * Get audit logs with optional filtering
 */
router.get('/audit-logs', async (req, res) => {
  try {
    const { limit = 100, action, startDate, endDate } = req.query;

    let query = db.collection('audit_logs')
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
    await getDb().collection('audit_logs').add({
      ...data,
      timestamp: Date.now(),
    });
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

    const deviceRef = db.collection('devices').doc(deviceId);
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

    const deviceRef = db.collection('devices').doc(deviceId);
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
router.get('/devices/health-summary', async (req, res) => {
  try {
    const devicesSnapshot = await db.collection('devices').get();
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
// ALERT TEMPLATES
// ==========================================

/**
 * Get alert templates
 */
router.get('/alert-templates', async (req, res) => {
  try {
    const snapshot = await getDb().collection('alert_templates').get();
    const templates = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(templates);
  } catch (error) {
    console.error('Error fetching alert templates:', error);
    res.status(500).json({ error: 'Failed to fetch alert templates' });
  }
});

/**
 * Create alert template
 */
router.post('/alert-templates', async (req, res) => {
  try {
    const { name, title, message, severity, channelId, channelName } = req.body;

    const templateRef = await db.collection('alert_templates').add({
      name,
      title,
      message,
      severity,
      channelId,
      channelName,
      createdAt: Date.now(),
      createdBy: req.body.userId || 'admin',
    });

    await logAuditAction({
      action: 'SETTINGS_CHANGED',
      performedBy: req.body.userId || 'admin',
      performedByEmail: req.body.userEmail || 'admin@alertbuddy.com',
      description: `Created alert template: ${name}`,
      metadata: { templateId: templateRef.id, templateName: name },
    });

    res.json({
      success: true,
      id: templateRef.id,
    });
  } catch (error) {
    console.error('Error creating alert template:', error);
    res.status(500).json({ error: 'Failed to create alert template' });
  }
});

/**
 * Delete alert template
 */
router.delete('/alert-templates/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;

    await getDb().collection('alert_templates').doc(templateId).delete();

    await logAuditAction({
      action: 'SETTINGS_CHANGED',
      performedBy: req.body.userId || 'admin',
      performedByEmail: req.body.userEmail || 'admin@alertbuddy.com',
      description: 'Deleted alert template',
      metadata: { templateId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting alert template:', error);
    res.status(500).json({ error: 'Failed to delete alert template' });
  }
});

// ==========================================
// USER MANAGEMENT
// ==========================================

/**
 * Get all users
 */
router.get('/users', async (req, res) => {
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
router.post('/users', async (req, res) => {
  try {
    const userData = req.body;
    const userRef = await db.collection('users').add({
      ...userData,
      createdAt: Date.now(),
    });

    await logAuditAction({
      action: 'USER_CREATED',
      performedBy: req.body.adminId || 'admin',
      performedByEmail: req.body.adminEmail || 'admin@alertbuddy.com',
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
router.put('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const userData = req.body;

    await getDb().collection('users').doc(userId).update(userData);

    await logAuditAction({
      action: 'USER_UPDATED',
      performedBy: req.body.adminId || 'admin',
      performedByEmail: req.body.adminEmail || 'admin@alertbuddy.com',
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
router.delete('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    await getDb().collection('users').doc(userId).delete();

    await logAuditAction({
      action: 'USER_DELETED',
      performedBy: req.query.adminId as string || 'admin',
      performedByEmail: req.query.adminEmail as string || 'admin@alertbuddy.com',
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
router.get('/team', async (req, res) => {
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
router.put('/team/:memberId', async (req, res) => {
  try {
    const { memberId } = req.params;
    const memberData = req.body;

    await getDb().collection('team_members').doc(memberId).update(memberData);

    await logAuditAction({
      action: 'STANDBY_UPDATED',
      performedBy: req.body.adminId || 'admin',
      performedByEmail: req.body.adminEmail || 'admin@alertbuddy.com',
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
router.get('/shifts', async (req, res) => {
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
router.post('/shifts', async (req, res) => {
  try {
    const shiftData = req.body;
    const shiftRef = await db.collection('shifts').add({
      ...shiftData,
      createdAt: Date.now(),
    });

    await logAuditAction({
      action: 'SETTINGS_CHANGED',
      performedBy: req.body.adminId || 'admin',
      performedByEmail: req.body.adminEmail || 'admin@alertbuddy.com',
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
router.delete('/shifts/:shiftId', async (req, res) => {
  try {
    const { shiftId } = req.params;

    await getDb().collection('shifts').doc(shiftId).delete();

    await logAuditAction({
      action: 'SETTINGS_CHANGED',
      performedBy: req.query.adminId as string || 'admin',
      performedByEmail: req.query.adminEmail as string || 'admin@alertbuddy.com',
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
router.post('/shifts/:shiftId/activate', async (req, res) => {
  try {
    const { shiftId } = req.params;
    const { isActive } = req.body;

    await getDb().collection('shifts').doc(shiftId).update({ isActive });

    await logAuditAction({
      action: 'SETTINGS_CHANGED',
      performedBy: req.body.adminId || 'admin',
      performedByEmail: req.body.adminEmail || 'admin@alertbuddy.com',
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
