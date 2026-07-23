const STORAGE_KEY = 'alert-buddy-browser-notifications';

/**
 * Whether desktop notifications are both enabled in preferences AND
 * actually permitted by the browser — both must hold for a notification
 * to actually show.
 */
export const isBrowserNotificationsEnabled = (): boolean => {
  if (!('Notification' in window)) return false;
  return localStorage.getItem(STORAGE_KEY) === 'true' && Notification.permission === 'granted';
};

export const getBrowserNotificationPermission = (): NotificationPermission | 'unsupported' => {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
};

/**
 * Must be called from a user gesture (e.g. a button click in Settings) —
 * browsers block permission prompts triggered any other way.
 */
export const requestBrowserNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!('Notification' in window)) return 'denied';
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    localStorage.setItem(STORAGE_KEY, 'true');
  }
  return permission;
};

export const setBrowserNotificationsEnabled = (enabled: boolean): void => {
  localStorage.setItem(STORAGE_KEY, String(enabled));
};

export const showAlertNotification = (title: string, body: string): void => {
  if (!isBrowserNotificationsEnabled()) return;
  try {
    new Notification(title, { body, tag: 'alert-buddy' });
  } catch (error) {
    console.error('Failed to show browser notification:', error);
  }
};
