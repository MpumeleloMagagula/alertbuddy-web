import { useState, useEffect } from 'react';
import { Bell, Send, TestTube, Clock, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';
import firebase from '../services/firebase';
import type { Alert, TestAlertFormData, Severity } from '../types';

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  
  // Form state
  const [testAlert, setTestAlert] = useState<TestAlertFormData>({
    title: '',
    message: '',
    severity: 'WARNING' as Severity,
    channelId: 'test-channel',
    channelName: 'Test Channel',
  });

  const channels = [
    { id: 'infinity-dal-ms', name: 'Infinity DAL MS' },
    { id: 'infinity-online', name: 'Infinity Online' },
    { id: 'nemo', name: 'Nemo' },
    { id: 'online-dal', name: 'Online DAL' },
    { id: 'vsa-crisis', name: 'VSA IT Crisis War Room' },
    { id: 'test-channel', name: 'Test Channel' },
  ];

  useEffect(() => {
    // Fallback timeout in case Firebase is blocked by an adblocker (ERR_BLOCKED_BY_CLIENT)
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 5000);

    // Subscribe to real-time alerts
    const unsubscribe = firebase.onAlertsChange((updatedAlerts) => {
      setAlerts(updatedAlerts);
      setIsLoading(false);
      clearTimeout(timeout);
    }, 20);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSendToAll = async () => {
    if (!testAlert.title || !testAlert.message) {
      toast.error('Please fill in title and message');
      return;
    }

    try {
      setIsSending(true);
      await api.sendTestAlert(testAlert);
      toast.success('Alert sent to all devices');
      
      // Reset form
      setTestAlert({
        title: '',
        message: '',
        severity: 'WARNING' as Severity,
        channelId: 'test-channel',
        channelName: 'Test Channel',
      });
    } catch (error) {
      console.error('Failed to send alert:', error);
      toast.error('Failed to send alert');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendToStandby = async () => {
    if (!testAlert.title || !testAlert.message) {
      toast.error('Please fill in title and message');
      return;
    }

    try {
      setIsSending(true);
      await api.sendStandbyAlert(testAlert);
      toast.success('Alert sent to standby person');
      
      // Reset form
      setTestAlert({
        title: '',
        message: '',
        severity: 'WARNING' as Severity,
        channelId: 'test-channel',
        channelName: 'Test Channel',
      });
    } catch (error) {
      console.error('Failed to send alert:', error);
      toast.error('Failed to send alert to standby');
    } finally {
      setIsSending(false);
    }
  };

  const handleTestGrafanaWebhook = async () => {
    const grafanaPayload = {
      receiver: "alert-buddy",
      status: "firing",
      alerts: [
        {
          status: "firing",
          labels: {
            alertname: "High CPU Usage",
            severity: "critical",
            instance: "prod-server-01",
            grafana_folder: testAlert.channelId,
          },
          annotations: {
            summary: testAlert.title,
            description: testAlert.message,
          },
        },
      ],
    };

    try {
      setIsSending(true);
      await api.sendGrafanaWebhook(grafanaPayload);
      toast.success('Grafana webhook test successful');
    } catch (error) {
      console.error('Failed to test Grafana webhook:', error);
      toast.error('Failed to test Grafana webhook');
    } finally {
      setIsSending(false);
    }
  };

  const getSeverityIcon = (severity: Severity) => {
    switch (severity) {
      case 'CRITICAL':
        return <AlertCircle className="w-4 h-4" />;
      case 'WARNING':
        return <AlertTriangle className="w-4 h-4" />;
      case 'INFO':
        return <Info className="w-4 h-4" />;
    }
  };

  const getSeverityColor = (severity: Severity) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-600';
      case 'WARNING':
        return 'bg-orange-100 text-orange-600';
      case 'INFO':
        return 'bg-blue-100 text-blue-600';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading alerts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Alerts</h1>
        <p className="text-gray-600 mt-2">Test alert delivery and view alert history</p>
      </div>

      {/* Test Alert Form */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Send Test Alert</h2>
        
        <div className="space-y-4">
          {/* Alert Title */}
          <div>
            <label htmlFor="alert-title" className="block text-sm font-medium text-gray-700 mb-2">
              Alert Title
            </label>
            <input
              id="alert-title"
              type="text"
              value={testAlert.title}
              onChange={(e) => setTestAlert({ ...testAlert, title: e.target.value })}
              className="input"
              placeholder="e.g., CPU Usage Critical"
              disabled={isSending}
            />
          </div>

          {/* Alert Message */}
          <div>
            <label htmlFor="alert-message" className="block text-sm font-medium text-gray-700 mb-2">
              Alert Message
            </label>
            <textarea
              id="alert-message"
              value={testAlert.message}
              onChange={(e) => setTestAlert({ ...testAlert, message: e.target.value })}
              className="input min-h-[100px] resize-none"
              placeholder="e.g., CPU has been above 90% for 5 minutes. Current: 97%"
              disabled={isSending}
            />
          </div>

          {/* Severity and Channel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Severity */}
            <div>
              <label htmlFor="alert-severity" className="block text-sm font-medium text-gray-700 mb-2">
                Severity
              </label>
              <select
                id="alert-severity"
                value={testAlert.severity}
                onChange={(e) => setTestAlert({ ...testAlert, severity: e.target.value as Severity })}
                className="input"
                disabled={isSending}
              >
                <option value="CRITICAL">Critical</option>
                <option value="WARNING">Warning</option>
                <option value="INFO">Info</option>
              </select>
            </div>

            {/* Channel */}
            <div>
              <label htmlFor="alert-channel" className="block text-sm font-medium text-gray-700 mb-2">
                Channel
              </label>
              <select
                id="alert-channel"
                value={testAlert.channelId}
                onChange={(e) => {
                  const channel = channels.find(c => c.id === e.target.value);
                  setTestAlert({
                    ...testAlert,
                    channelId: e.target.value,
                    channelName: channel?.name || 'Test Channel',
                  });
                }}
                className="input"
                disabled={isSending}
              >
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleSendToAll}
              disabled={isSending}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              Send to All Devices
            </button>
            
            <button
              onClick={handleSendToStandby}
              disabled={isSending}
              className="btn-secondary flex items-center gap-2 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              Send to Standby Only
            </button>
            
            <button
              onClick={handleTestGrafanaWebhook}
              disabled={isSending}
              className="btn-secondary flex items-center gap-2 disabled:opacity-50"
            >
              <TestTube className="w-4 h-4" />
              Test Grafana Webhook
            </button>
          </div>
        </div>
      </div>

      {/* Alert Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Alerts</p>
              <p className="text-xl font-bold text-gray-900">{alerts.length}</p>
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Critical</p>
              <p className="text-xl font-bold text-gray-900">
                {alerts.filter(a => a.severity === 'CRITICAL').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Warning</p>
              <p className="text-xl font-bold text-gray-900">
                {alerts.filter(a => a.severity === 'WARNING').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Info className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Info</p>
              <p className="text-xl font-bold text-gray-900">
                {alerts.filter(a => a.severity === 'INFO').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Alert History */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Alert History</h2>
        
        {alerts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Clock className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p>No alerts yet</p>
            <p className="text-sm mt-2">Send a test alert above to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {/* Severity icon */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${getSeverityColor(alert.severity)}`}>
                  {getSeverityIcon(alert.severity)}
                </div>

                {/* Alert content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">{alert.title}</p>
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
                  
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500">
                    <span className="font-medium">{alert.channelName}</span>
                    <span>•</span>
                    <span>{new Date(alert.timestamp).toLocaleString()}</span>
                    <span>•</span>
                    <span>Source: {alert.source}</span>
                    {alert.acknowledgedBy && (
                      <>
                        <span>•</span>
                        <span className="text-green-600">
                          Acked by {alert.acknowledgedBy}
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

      {/* Info box */}
      <div className="card bg-blue-50 border-blue-200">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <TestTube className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Testing Alerts</p>
            <ul className="space-y-1 list-disc list-inside text-blue-800">
              <li><strong>Send to All:</strong> Broadcasts alert to every registered device</li>
              <li><strong>Send to Standby:</strong> Only sends to the current on-call person</li>
              <li><strong>Test Grafana:</strong> Simulates a real Grafana webhook payload</li>
              <li>Alerts appear in real-time in the mobile app</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
