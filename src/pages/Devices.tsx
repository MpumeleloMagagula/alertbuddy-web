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
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';
import firebase from '../services/firebase';
import type { Device, Severity } from '../types';
import { Severity as SeverityEnum } from '../types';


export default function Devices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDevices();

    // Subscribe to real-time device updates
    const unsubscribe = firebase.onDevicesChange?.((updatedDevices) => {
      setDevices(updatedDevices);
    });

    return () => unsubscribe?.();
  }, []);

  const loadDevices = async () => {
    try {
      setIsLoading(true);
      const data = await api.getDevices();
      setDevices(data);
    } catch (error) {
      console.error('Failed to load devices:', error);
      toast.error('Failed to load devices');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    if (!confirm('Are you sure you want to unregister this device?')) {
      return;
    }

    try {
      await api.unregisterDevice(deviceId);
      toast.success('Device unregistered successfully');
      loadDevices();
    } catch (error) {
      console.error('Failed to delete device:', error);
      toast.error('Failed to unregister device');
    }
  };

  const handleTestDevice = async (device: Device) => {
    try {
      await api.sendTestAlert({
        title: 'Device Test',
        message: `Testing notification delivery to ${device.deviceModel || 'device'}`,
        severity: Severity.INFO,
        channelId: 'test',
        channelName: 'Test',
      });
      toast.success(`Test alert sent to ${device.email}`);
    } catch (error) {
      console.error('Failed to test device:', error);
      toast.error('Failed to send test alert');
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
          onClick={loadDevices}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
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

              return (
                <div
                  key={device.id}
                  className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-surface transition-colors"
                >
                  {/* Device icon */}
                  <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Smartphone className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                  </div>

                  {/* Device info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
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
                          {/* Battery */}
                          {device.batteryLevel !== undefined && (
                            <div className="flex items-center gap-2 text-sm">
                              <BatteryIcon className={`w-4 h-4 ${batteryColor}`} />
                              <span className={batteryColor}>
                                {device.batteryLevel}%
                                {device.isCharging && ' (Charging)'}
                              </span>
                            </div>
                          )}

                          {/* Last seen */}
                          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <Clock className="w-4 h-4" />
                            <span>Last seen: {getLastSeenText(device.lastSeen)}</span>
                          </div>

                          {/* Registration date */}
                          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Registered: {new Date(device.registeredAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* FCM Token (truncated) */}
                    <div className="mt-3 p-2 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">FCM Token</p>
                      <p className="text-xs font-mono text-gray-600 dark:text-gray-300 truncate">
                        {device.fcmToken}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleTestDevice(device)}
                        className="btn-secondary text-sm"
                      >
                        <AlertCircle className="w-4 h-4 mr-1" />
                        Test Alert
                      </button>

                      <button
                        onClick={() => handleDeleteDevice(device.id)}
                        className="btn-danger text-sm"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Unregister
                      </button>
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
