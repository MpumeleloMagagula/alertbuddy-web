import { useState, useEffect } from 'react';
import { 
  Bell, 
  Users, 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  CheckCircle2, 
  Smartphone,
  UserCheck 
} from 'lucide-react';
import api from '../services/api';
import firebase from '../services/firebase';
import type { ServerStatus, Alert } from '../types';

export default function Dashboard() {
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
    
    // Subscribe to real-time alerts
    const unsubscribe = firebase.onAlertsChange((alerts) => {
      setRecentAlerts(alerts.slice(0, 5));
    }, 5);

    return () => unsubscribe();
  }, []);

  const loadDashboardData = async () => {
    try {
      const status = await api.getServerStatus();
      setServerStatus(status);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">System overview and statistics</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Alerts */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Alerts</p>
              <p className="text-3xl font-bold text-gray-900">--</p>
            </div>
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
              <Bell className="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </div>

        {/* Active Devices */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Active Devices</p>
              <p className="text-3xl font-bold text-gray-900">
                {serverStatus?.registeredDevices || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* On Standby */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">On Standby</p>
              <p className="text-lg font-semibold text-gray-900 truncate">
                {serverStatus?.standby?.onStandby 
                  ? serverStatus.standby.displayName 
                  : 'No one'}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <UserCheck className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        {/* Firebase Status */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Firebase</p>
              <p className="text-lg font-semibold text-gray-900 capitalize">
                {serverStatus?.firebase || 'Unknown'}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              serverStatus?.firebase === 'connected' 
                ? 'bg-green-100' 
                : 'bg-red-100'
            }`}>
              {serverStatus?.firebase === 'connected' ? (
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              ) : (
                <AlertCircle className="w-6 h-6 text-red-600" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Alerts */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Alerts</h2>
        
        {recentAlerts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Bell className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p>No recent alerts</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {/* Severity icon */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  alert.severity === 'CRITICAL' ? 'bg-red-100' :
                  alert.severity === 'WARNING' ? 'bg-orange-100' :
                  'bg-blue-100'
                }`}>
                  {alert.severity === 'CRITICAL' ? (
                    <AlertCircle className="w-4 h-4 text-red-600" />
                  ) : alert.severity === 'WARNING' ? (
                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                  ) : (
                    <Info className="w-4 h-4 text-blue-600" />
                  )}
                </div>

                {/* Alert content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{alert.title}</p>
                      <p className="text-sm text-gray-600 mt-1">{alert.body}</p>
                    </div>
                    <span className={`badge flex-shrink-0 ${
                      alert.severity === 'CRITICAL' ? 'badge-critical' :
                      alert.severity === 'WARNING' ? 'badge-warning' :
                      'badge-info'
                    }`}>
                      {alert.severity}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span>{alert.channelName}</span>
                    <span>•</span>
                    <span>{new Date(alert.timestamp).toLocaleString()}</span>
                    {alert.isRead && (
                      <>
                        <span>•</span>
                        <span className="text-green-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Acknowledged
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* System Status */}
      {serverStatus && (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">System Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Server Status</p>
              <p className="font-semibold text-gray-900 capitalize">{serverStatus.status}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Uptime</p>
              <p className="font-semibold text-gray-900">{serverStatus.uptime}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Token Resolved</p>
              <p className="font-semibold text-gray-900">
                {serverStatus.standby?.tokenResolved ? 'Yes' : 'No'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
