import { useState, useEffect } from 'react';
import {
  Smartphone,
  Battery,
  BatteryLow,
  BatteryMedium,
  BatteryFull,
  Wifi,
  Clock,
  AlertCircle,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Send,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';
import firebase from '../services/firebase';
import { Device } from '../types';

const CHANNELS = [
  { id: 'core-monitoring', name: 'Core Services Monitoring' },
  { id: 'infra-alerts', name: 'Cloud Infrastructure Alerts' },
  { id: 'api-gateway', name: 'External API Gateway' },
  { id: 'db-health', name: 'Database Health Cluster' },
  { id: 'crisis-response', name: 'Urgent Crisis Response' },
];

const SEVERITIES = ['INFO', 'WARNING', 'CRITICAL'];

interface NotifyForm {
  title: string;
  message: string;
  channelId: string;
  channelName: string;
  severity: string;
}

const defaultForm = (): NotifyForm => ({
  title: '',
  message: '',
  channelId: 'core-monitoring',
  channelName: 'Core Services Monitoring',
  severity: 'WARNING',
});

export default function Devices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedDeviceId, setExpandedDeviceId] = useState<string | null>(null);
  const [notifyForm, setNotifyForm] = useState<NotifyForm>(defaultForm());
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    const unsubscribe = firebase.onDevicesChange((updatedDevices) => {
      setDevices(updatedDevices as Device[]);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const toggleNotifyForm = (deviceId: string) => {
    if (expandedDeviceId === deviceId) {
      setExpandedDeviceId(null);
    } else {
      setExpandedDeviceId(deviceId);
      setNotifyForm(defaultForm());
    }
  };

  const handleChannelChange = (channelId: string) => {
    const channel = CHANNELS.find(c => c.id === channelId);
    if (channel) {
      setNotifyForm(f => ({ ...f, channelId: channel.id, channelName: channel.name }));
    }
  };

  const handleSendNotification = async (device: Device) => {
    if (!notifyForm.title.trim() || !notifyForm.message.trim()) {
      toast.error('Title and message are required');
      return;
    }

    setIsSending(true);
    try {
      await api.sendToDevice(device.fcmToken, {
        title: notifyForm.title,
        message: notifyForm.message,
        severity: notifyForm.severity as any,
        channelId: notifyForm.channelId,
        channelName: notifyForm.channelName,
      });
      toast.success(`Notification sent to ${device.email}`);
      setExpandedDeviceId(null);
      setNotifyForm(defaultForm());
    } catch (error) {
      console.error('Failed to send notification:', error);
      toast.error('Failed to send notification');
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    if (!confirm('Are you sure you want to unregister this device?')) {
      return;
    }

    try {
      await api.unregisterDevice(deviceId);
      toast.success('Device unregistered successfully');
    } catch (error) {
      console.error('Failed to delete device:', error);
      toast.error('Failed to unregister device');
    }
  };

  const getBatteryIcon = (level?: number, isCharging?: boolean) => {
    if (!level) return Battery;

    if (isCharging) {
      return BatteryFull;
    }

    if (level < 20) {
      return BatteryLow;
    } else if (level < 50) {
      return BatteryMedium;
    } else {
      return BatteryFull;
    }
  };

  const getBatteryColor = (level?: number) => {
    if (!level) return 'text-gray-400';

    if (level < 20) {
      return 'text-red-600';
    } else if (level < 50) {
      return 'text-orange-500';
    } else {
      return 'text-green-600';
    }
  };

  const getOnlineStatus = (lastSeen: number) => {
    const minutesSinceLastSeen = (Date.now() - lastSeen) / 1000 / 60;

    if (minutesSinceLastSeen < 5) {
      return { status: 'online', color: 'bg-green-500', text: 'Online' };
    } else if (minutesSinceLastSeen < 30) {
      return { status: 'away', color: 'bg-yellow-500', text: 'Away' };
    } else {
      return { status: 'offline', color: 'bg-gray-400', text: 'Offline' };
    }
  };

  const getLastSeenText = (lastSeen: number) => {
    const minutesAgo = Math.floor((Date.now() - lastSeen) / 1000 / 60);

    if (minutesAgo < 1) {
      return 'Just now';
    } else if (minutesAgo < 60) {
      return `${minutesAgo} minute${minutesAgo !== 1 ? 's' : ''} ago`;
    } else {
      const hoursAgo = Math.floor(minutesAgo / 60);
      if (hoursAgo < 24) {
        return `${hoursAgo} hour${hoursAgo !== 1 ? 's' : ''} ago`;
      } else {
        const daysAgo = Math.floor(hoursAgo / 24);
        return `${daysAgo} day${daysAgo !== 1 ? 's' : ''} ago`;
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto shadow-sm"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading devices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Devices</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage registered devices and monitor their health
          </p>
        </div>
        <button
          type="button"
          onClick={() => toast.info('Device list is synced in real-time')}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Live
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Devices</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{devices.length}</p>
            </div>
            <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-lg flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Online Now</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-500">
                {devices.filter(d => getOnlineStatus(d.lastSeen).status === 'online').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <Wifi className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Low Battery</p>
              <p className="text-3xl font-bold text-orange-600 dark:text-orange-500">
                {devices.filter(d => d.batteryLevel && d.batteryLevel < 20).length}
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
              <BatteryLow className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Device list */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Registered Devices</h2>

        {devices.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Smartphone className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p>No devices registered yet</p>
            <p className="text-sm mt-2">Devices will appear here once users log in to the mobile app</p>
          </div>
        ) : (
          <div className="space-y-3">
            {devices.map((device) => {
              const onlineStatus = getOnlineStatus(device.lastSeen);
              const BatteryIcon = getBatteryIcon(device.batteryLevel, device.isCharging);
              const batteryColor = getBatteryColor(device.batteryLevel);
              const isExpanded = expandedDeviceId === device.id;

              return (
                <div
                  key={device.id}
                  className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div className="flex items-start gap-4">
                    {/* Device icon */}
                    <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Smartphone className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                    </div>

                    {/* Device info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-gray-900 dark:text-white truncate">
                          {device.email}
                        </p>
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${onlineStatus.color}`}></span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {onlineStatus.text}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                        {device.deviceModel && (
                          <span className="flex items-center gap-1">
                            <Smartphone className="w-3 h-3" />
                            {device.deviceModel}
                          </span>
                        )}
                        {device.osVersion && (
                          <span>OS: {device.osVersion}</span>
                        )}
                        {device.appVersion && (
                          <span>App: v{device.appVersion}</span>
                        )}
                      </div>

                      {/* Health indicators */}
                      <div className="flex flex-wrap items-center gap-4 mt-3">
                        {device.batteryLevel !== undefined && (
                          <div className="flex items-center gap-2 text-sm">
                            <BatteryIcon className={`w-4 h-4 ${batteryColor}`} />
                            <span className={batteryColor}>
                              {device.batteryLevel}%
                              {device.isCharging && ' (Charging)'}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                          <Clock className="w-4 h-4" />
                          <span>Last seen: {getLastSeenText(device.lastSeen)}</span>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Registered: {new Date(device.registeredAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {/* FCM Token */}
                      <div className="mt-3 p-2 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">FCM Token</p>
                        <p className="text-xs font-mono text-gray-600 dark:text-gray-300 truncate">
                          {device.fcmToken}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 mt-3">
                        <button
                          type="button"
                          onClick={() => toggleNotifyForm(device.id)}
                          className="btn-secondary text-sm flex items-center gap-1"
                        >
                          <Send className="w-4 h-4" />
                          Send Notification
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteDevice(device.id)}
                          className="btn-danger text-sm flex items-center gap-1"
                        >
                          <Trash2 className="w-4 h-4" />
                          Unregister
                        </button>
                      </div>

                      {/* Inline notification form */}
                      {isExpanded && (
                        <div className="mt-4 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
                          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                            Send notification to {device.email}
                          </p>

                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                              Title
                            </label>
                            <input
                              type="text"
                              value={notifyForm.title}
                              onChange={e => setNotifyForm(f => ({ ...f, title: e.target.value }))}
                              placeholder="Notification title"
                              className="input w-full text-sm"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                              Message
                            </label>
                            <textarea
                              value={notifyForm.message}
                              onChange={e => setNotifyForm(f => ({ ...f, message: e.target.value }))}
                              placeholder="Notification message"
                              rows={2}
                              className="input w-full text-sm resize-none"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                Channel
                              </label>
                              <select
                                value={notifyForm.channelId}
                                onChange={e => handleChannelChange(e.target.value)}
                                title="Channel"
                                className="input w-full text-sm"
                              >
                                {CHANNELS.map(ch => (
                                  <option key={ch.id} value={ch.id}>{ch.name}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                Severity
                              </label>
                              <select
                                value={notifyForm.severity}
                                onChange={e => setNotifyForm(f => ({ ...f, severity: e.target.value }))}
                                title="Severity"
                                className="input w-full text-sm"
                              >
                                {SEVERITIES.map(s => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleSendNotification(device)}
                              disabled={isSending}
                              className="btn-primary text-sm flex items-center gap-2"
                            >
                              <Send className="w-4 h-4" />
                              {isSending ? 'Sending...' : 'Send'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setExpandedDeviceId(null)}
                              className="btn-secondary text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Device health warnings */}
      {devices.some(d => d.batteryLevel && d.batteryLevel < 20) && (
        <div className="card bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-orange-900 dark:text-orange-300">
                Low Battery Warning
              </p>
              <p className="text-sm text-orange-700 dark:text-orange-400 mt-1">
                {devices.filter(d => d.batteryLevel && d.batteryLevel < 20).length} device(s) have low battery.
                They may not receive alerts reliably. Users should charge their devices.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
