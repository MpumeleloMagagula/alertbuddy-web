/**
 * In-memory device token storage
 * In production, this should be replaced with a database (PostgreSQL/Firestore)
 */

export interface Device {
  deviceId: string;
  fcmToken: string;
  email: string;
  registeredAt: number;
  lastSeen: number;
}

// Store devices by deviceId and email
const devicesByDeviceId = new Map<string, Device>();
const devicesByEmail = new Map<string, Device[]>();

/**
 * Register a new device or update existing
 */
export function registerDevice(deviceId: string, fcmToken: string, email: string): Device {
  const device: Device = {
    deviceId,
    fcmToken,
    email,
    registeredAt: devicesByDeviceId.has(deviceId) 
      ? devicesByDeviceId.get(deviceId)!.registeredAt 
      : Date.now(),
    lastSeen: Date.now(),
  };

  // Store by deviceId
  devicesByDeviceId.set(deviceId, device);

  // Store by email (one email can have multiple devices)
  if (!devicesByEmail.has(email)) {
    devicesByEmail.set(email, []);
  }
  
  const emailDevices = devicesByEmail.get(email)!;
  const existingIndex = emailDevices.findIndex(d => d.deviceId === deviceId);
  
  if (existingIndex >= 0) {
    emailDevices[existingIndex] = device;
  } else {
    emailDevices.push(device);
  }

  console.log(`✅ Device registered: ${email} (${deviceId.slice(0, 8)}...)`);
  return device;
}

/**
 * Unregister a device
 */
export function unregisterDevice(deviceId: string): boolean {
  const device = devicesByDeviceId.get(deviceId);
  
  if (!device) {
    return false;
  }

  // Remove from deviceId map
  devicesByDeviceId.delete(deviceId);

  // Remove from email map
  const emailDevices = devicesByEmail.get(device.email);
  if (emailDevices) {
    const filtered = emailDevices.filter(d => d.deviceId !== deviceId);
    if (filtered.length > 0) {
      devicesByEmail.set(device.email, filtered);
    } else {
      devicesByEmail.delete(device.email);
    }
  }

  console.log(`✅ Device unregistered: ${device.email} (${deviceId.slice(0, 8)}...)`);
  return true;
}

/**
 * Get device by deviceId
 */
export function getDeviceById(deviceId: string): Device | undefined {
  return devicesByDeviceId.get(deviceId);
}

/**
 * Get all devices for an email
 */
export function getDevicesByEmail(email: string): Device[] {
  return devicesByEmail.get(email) || [];
}

/**
 * Get FCM token for an email (returns first device's token)
 */
export function getTokenByEmail(email: string): string | undefined {
  const devices = devicesByEmail.get(email);
  return devices && devices.length > 0 ? devices[0].fcmToken : undefined;
}

/**
 * Get all registered devices
 */
export function getAllDevices(): Device[] {
  return Array.from(devicesByDeviceId.values());
}

/**
 * Get all FCM tokens
 */
export function getAllTokens(): string[] {
  return Array.from(devicesByDeviceId.values()).map(d => d.fcmToken);
}

/**
 * Get device count
 */
export function getDeviceCount(): number {
  return devicesByDeviceId.size;
}

/**
 * Clear all devices (for testing)
 */
export function clearAllDevices(): void {
  devicesByDeviceId.clear();
  devicesByEmail.clear();
  console.log('🗑️  All devices cleared');
}
