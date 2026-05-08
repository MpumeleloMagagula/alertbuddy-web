import { useState, useEffect } from 'react';
import {
  Bell,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  Smartphone,
  UserCheck,
  TrendingUp,
  Activity
} from 'lucide-react';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '../services/api';
import firebase from '../services/firebase';
import type { ServerStatus, Alert } from '../types';

export default function Dashboard() {
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const [allAlerts, setAllAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();

    // Subscribe to real-time alerts
    const unsubscribe = firebase.onAlertsChange((alerts) => {
      setRecentAlerts(alerts.slice(0, 5));
      setAllAlerts(alerts);
    }, 100);

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

  // Calculate statistics
  const stats = {
    total: allAlerts.length,
    critical: allAlerts.filter(a => a.severity === 'CRITICAL').length,
    warning: allAlerts.filter(a => a.severity === 'WARNING').length,
    info: allAlerts.filter(a => a.severity === 'INFO').length,
    acknowledged: allAlerts.filter(a => a.isRead).length,
    unread: allAlerts.filter(a => !a.isRead).length,
  };

  // Severity breakdown for pie chart
  const severityData = [
    { name: 'Critical', value: stats.critical, color: '#ef4444' },
    { name: 'Warning', value: stats.warning, color: '#f97316' },
    { name: 'Info', value: stats.info, color: '#3b82f6' },
  ].filter(d => d.value > 0);

  // Alert trends (last 7 days)
  const getLast7Days = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        timestamp: date.setHours(0, 0, 0, 0),
      });
    }
    return days;
  };

  const trendData = getLast7Days().map(day => {
    const dayAlerts = allAlerts.filter(alert => {
      const alertDate = new Date(alert.timestamp);
      alertDate.setHours(0, 0, 0, 0);
      return alertDate.getTime() === day.timestamp;
    });

    return {
      date: day.date,
      total: dayAlerts.length,
      critical: dayAlerts.filter(a => a.severity === 'CRITICAL').length,
      warning: dayAlerts.filter(a => a.severity === 'WARNING').length,
      info: dayAlerts.filter(a => a.severity === 'INFO').length,
    };
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto shadow-sm"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Alert Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">System overview and analytics</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Alerts */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Alerts</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{stats.unread} unread</p>
            </div>
            <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center">
              <Bell className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
          </div>
        </div>

        {/* Active Devices */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Active Devices</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {serverStatus?.registeredDevices || 0}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Registered</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        {/* On Standby */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">On Standby</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                {serverStatus?.standby?.onStandby
                  ? serverStatus.standby.displayName
                  : 'No one'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {serverStatus?.standby?.tokenResolved ? 'Token resolved' : 'Pending'}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
              <UserCheck className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        {/* Critical Alerts */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Critical Alerts</p>
              <p className="text-3xl font-bold text-red-600 dark:text-red-500">{stats.critical}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Last 24h</p>
            </div>
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Severity Breakdown Pie Chart */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Severity Breakdown</h2>
          </div>

          {severityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={severityData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {severityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Bell className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>No alerts to display</p>
              </div>
            </div>
          )}
        </div>

        {/* Alert Trends Line Chart */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Alert Trends (7 Days)</h2>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="critical" stroke="#ef4444" strokeWidth={2} name="Critical" />
              <Line type="monotone" dataKey="warning" stroke="#f97316" strokeWidth={2} name="Warning" />
              <Line type="monotone" dataKey="info" stroke="#3b82f6" strokeWidth={2} name="Info" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Alerts */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Recent Alerts</h2>

        {recentAlerts.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Bell className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-600" />
            <p>No recent alerts</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-surface transition-colors"
              >
                {/* Severity icon */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${alert.severity === 'CRITICAL' ? 'bg-red-100 dark:bg-red-900/30' :
                    alert.severity === 'WARNING' ? 'bg-orange-100 dark:bg-orange-900/30' :
                      'bg-blue-100 dark:bg-blue-900/30'
                  }`}>
                  {alert.severity === 'CRITICAL' ? (
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  ) : alert.severity === 'WARNING' ? (
                    <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  ) : (
                    <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  )}
                </div>

                {/* Alert content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">{alert.title}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{alert.body}</p>
                    </div>
                    <span className={`badge flex-shrink-0 ${alert.severity === 'CRITICAL' ? 'badge-critical' :
                        alert.severity === 'WARNING' ? 'badge-warning' :
                          'badge-info'
                      }`}>
                      {alert.severity}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>{alert.channelName}</span>
                    <span>•</span>
                    <span>{new Date(alert.timestamp).toLocaleString()}</span>
                    {alert.isRead && (
                      <>
                        <span>•</span>
                        <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
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
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">System Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Server Status</p>
              <p className="font-semibold text-gray-900 dark:text-white capitalize flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                {serverStatus.status}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Firebase</p>
              <p className="font-semibold text-gray-900 dark:text-white capitalize flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${serverStatus.firebase === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                {serverStatus.firebase}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Uptime</p>
              <p className="font-semibold text-gray-900 dark:text-white">{serverStatus.uptime}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Acknowledgment Rate</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {stats.total > 0 ? ((stats.acknowledged / stats.total) * 100).toFixed(1) : 0}%
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
