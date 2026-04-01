import admin from 'firebase-admin';

interface NotificationPayload {
  title: string;
  body: string;
}

interface DataPayload {
  alertId: string;
  channelId: string;
  channelName: string;
  severity: string;
  source: string;
}

let isInitialized = false;

/**
 * Initialize Firebase Admin SDK
 */
export function initializeFirebase() {
  try {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (!serviceAccountKey) {
      console.warn('⚠️  FIREBASE_SERVICE_ACCOUNT_KEY not set. FCM is DISABLED.');
      return false;
    }

    const serviceAccount = JSON.parse(serviceAccountKey);
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    isInitialized = true;
    console.log('✅ Firebase Admin SDK initialized');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Firebase:', error);
    return false;
  }
}

/**
 * Check if Firebase is initialized
 */
export function isFirebaseReady(): boolean {
  return isInitialized;
}

/**
 * Send notification to a specific device token
 */
export async function sendToToken(
  token: string,
  notification: NotificationPayload,
  data: DataPayload
): Promise<boolean> {
  if (!isInitialized) {
    console.warn('Firebase not initialized. Cannot send notification.');
    return false;
  }

  try {
    const message: admin.messaging.Message = {
      token,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: {
        alertId: data.alertId,
        channelId: data.channelId,
        channelName: data.channelName,
        severity: data.severity,
        source: data.source,
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'alert_buddy_alerts',
          priority: 'max' as any,
          defaultSound: true,
          defaultVibrateTimings: true,
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log('✅ FCM sent successfully:', response);
    return true;
  } catch (error: any) {
    console.error('❌ FCM send error:', error.message);
    return false;
  }
}

/**
 * Send notification to a topic
 */
export async function sendToTopic(
  topic: string,
  notification: NotificationPayload,
  data: DataPayload
): Promise<boolean> {
  if (!isInitialized) {
    console.warn('Firebase not initialized. Cannot send notification.');
    return false;
  }

  try {
    const message: admin.messaging.Message = {
      topic,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: {
        alertId: data.alertId,
        channelId: data.channelId,
        channelName: data.channelName,
        severity: data.severity,
        source: data.source,
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'alert_buddy_alerts',
          priority: 'max' as any,
          defaultSound: true,
          defaultVibrateTimings: true,
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log('✅ FCM sent to topic successfully:', response);
    return true;
  } catch (error: any) {
    console.error('❌ FCM topic send error:', error.message);
    return false;
  }
}

/**
 * Broadcast to multiple tokens
 */
export async function sendToMultipleTokens(
  tokens: string[],
  notification: NotificationPayload,
  data: DataPayload
): Promise<{ successCount: number; failureCount: number }> {
  if (!isInitialized) {
    console.warn('Firebase not initialized. Cannot send notifications.');
    return { successCount: 0, failureCount: tokens.length };
  }

  const message: admin.messaging.MulticastMessage = {
    tokens,
    notification: {
      title: notification.title,
      body: notification.body,
    },
    data: {
      alertId: data.alertId,
      channelId: data.channelId,
      channelName: data.channelName,
      severity: data.severity,
      source: data.source,
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'alert_buddy_alerts',
        priority: 'max' as any,
        defaultSound: true,
        defaultVibrateTimings: true,
      },
    },
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`✅ Multicast: ${response.successCount} sent, ${response.failureCount} failed`);
    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error: any) {
    console.error('❌ Multicast send error:', error.message);
    return { successCount: 0, failureCount: tokens.length };
  }
}
