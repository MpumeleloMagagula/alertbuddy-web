import { useState, useEffect } from 'react';
import { Smartphone, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';
import type { Device } from '../types';

export default function Devices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadDevices();
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

  const handleUnregister = async (deviceId: string) => {
    if (!confirm('Are you sure you want to unregister this device?')) {
      return;
    }

    try {
      setIsDeletingId(deviceId);
      await api.unregisterDevice(deviceId);
      toast.success('Device unregistered successfully');
      await loadDevices();
    } catch (error) {
      console.error('Failed to unregister device:', error);
      toast.error('Failed to unregister device');
    } finally {
      setIsDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading devices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Devices</h1>
          <p className="text-gray-600 mt-2">Manage registered Android devices</p>
        </div>
        <button onClick={loadDevices} className="btn-secondary flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="card">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
            <Smartphone className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Registered Devices</p>
            <p className="text-2xl font-bold text-gray-900">{devices.length}</p>
          </div>
        </div>
      </div>

      {/* Devices table */}
      <div className="card">
        {devices.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Smartphone className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p>No devices registered yet</p>
            <p className="text-sm mt-2">Devices will appear here when users log in to the mobile app</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Email</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Device ID</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">FCM Token</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Registered</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Last Seen</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => (
                  <tr
                    key={device.deviceId}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">{device.email}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-gray-600 font-mono">{device.deviceId.slice(0, 16)}...</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-gray-600 font-mono max-w-xs truncate">
                        {device.fcmToken.slice(0, 24)}...
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-gray-600">
                        {new Date(device.registeredAt).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-gray-600">
                        {new Date(device.lastSeen).toLocaleString()}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleUnregister(device.deviceId)}
                        disabled={isDeletingId === device.deviceId}
                        className="text-red-600 hover:text-red-700 disabled:opacity-50 p-2 rounded-lg hover:bg-red-50 transition-colors"
                        title="Unregister device"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="card bg-blue-50 border-blue-200">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <Smartphone className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">About Device Management</p>
            <ul className="space-y-1 list-disc list-inside text-blue-800">
              <li>Devices automatically register when users log in to the mobile app</li>
              <li>Each device has a unique FCM token used for push notifications</li>
              <li>Unregistering a device will prevent it from receiving alerts until the user logs in again</li>
              <li>Last seen timestamp updates whenever the device receives an alert or syncs with the backend</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
