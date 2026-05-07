import { useState, useEffect } from 'react';
import { Bell, Send, TestTube, Clock, AlertCircle, AlertTriangle, Info, Search, Filter, CheckCircle2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';
import firebase from '../services/firebase';
import type { Alert, TestAlertFormData, Severity } from '../types';

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filteredAlerts, setFilteredAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [selectedAlerts, setSelectedAlerts] = useState<Set<string>>(new Set());
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | Severity>('ALL');
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'READ' | 'UNREAD'>('ALL');
  const [dateRange, setDateRange] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');
  
  // Form state
  const [testAlert, setTestAlert] = useState<TestAlertFormData>({
    title: '',
    message: '',
    severity: 'WARNING',
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
    loadAlerts();
    
    // Subscribe to real-time alerts
    const unsubscribe = firebase.onAlertsChange((updatedAlerts) => {
      setAlerts(updatedAlerts);
    }, 100);

    return () => unsubscribe();
  }, []);

  // Apply filters whenever alerts or filters change
  useEffect(() => {
    applyFilters();
  }, [alerts, searchQuery, severityFilter, channelFilter, statusFilter, dateRange]);

  const loadAlerts = async () => {
    try {
      setIsLoading(true);
      const data = await firebase.getAlerts(100);
      setAlerts(data);
    } catch (error) {
      console.error('Failed to load alerts:', error);
      toast.error('Failed to load alerts');
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...alerts];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(alert => 
        alert.title.toLowerCase().includes(query) ||
        alert.body.toLowerCase().includes(query)
      );
    }

    // Severity filter
    if (severityFilter !== 'ALL') {
      filtered = filtered.filter(alert => alert.severity === severityFilter);
    }

    // Channel filter
    if (channelFilter !== 'ALL') {
      filtered = filtered.filter(alert => alert.channelId === channelFilter);
    }

    // Status filter
    if (statusFilter === 'READ') {
      filtered = filtered.filter(alert => alert.isRead);
    } else if (statusFilter === 'UNREAD') {
      filtered = filtered.filter(alert => !alert.isRead);
    }

    // Date range filter
    const now = Date.now();
    if (dateRange === 'TODAY') {
      const todayStart = new Date().setHours(0, 0, 0, 0);
      filtered = filtered.filter(alert => alert.timestamp >= todayStart);
    } else if (dateRange === 'WEEK') {
      const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(alert => alert.timestamp >= weekAgo);
    } else if (dateRange === 'MONTH') {
      const monthAgo = now - (30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(alert => alert.timestamp >= monthAgo);
    }

    setFilteredAlerts(filtered);
  };

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
        severity: 'WARNING',
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
        severity: 'WARNING',
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
            severity: testAlert.severity.toLowerCase(),
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

  const toggleSelectAlert = (alertId: string) => {
    const newSelected = new Set(selectedAlerts);
    if (newSelected.has(alertId)) {
      newSelected.delete(alertId);
    } else {
      newSelected.add(alertId);
    }
    setSelectedAlerts(newSelected);
  };

  const selectAllAlerts = () => {
    if (selectedAlerts.size === filteredAlerts.length) {
      setSelectedAlerts(new Set());
    } else {
      setSelectedAlerts(new Set(filteredAlerts.map(a => a.id)));
    }
  };

  const bulkMarkAsRead = async () => {
    // This would need backend implementation
    toast.info('Bulk mark as read - Backend implementation pending');
    setSelectedAlerts(new Set());
  };

  const bulkDelete = async () => {
    if (!confirm(`Delete ${selectedAlerts.size} selected alerts?`)) {
      return;
    }
    // This would need backend implementation
    toast.info('Bulk delete - Backend implementation pending');
    setSelectedAlerts(new Set());
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSeverityFilter('ALL');
    setChannelFilter('ALL');
    setStatusFilter('ALL');
    setDateRange('ALL');
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

      {/* Filters */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-700" />
          <h2 className="text-xl font-bold text-gray-900">Filters</h2>
          {(searchQuery || severityFilter !== 'ALL' || channelFilter !== 'ALL' || statusFilter !== 'ALL' || dateRange !== 'ALL') && (
            <button onClick={clearFilters} className="text-sm text-primary-600 hover:text-primary-700 ml-auto">
              Clear all
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-10"
                placeholder="Search alerts..."
              />
            </div>
          </div>

          {/* Severity Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Severity</label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as any)}
              className="input"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="WARNING">Warning</option>
              <option value="INFO">Info</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="input"
            >
              <option value="ALL">All Status</option>
              <option value="READ">Acknowledged</option>
              <option value="UNREAD">Unread</option>
            </select>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="input"
            >
              <option value="ALL">All Time</option>
              <option value="TODAY">Today</option>
              <option value="WEEK">Last 7 Days</option>
              <option value="MONTH">Last 30 Days</option>
            </select>
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          Showing {filteredAlerts.length} of {alerts.length} alerts
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedAlerts.size > 0 && (
        <div className="card bg-primary-50 border-primary-200">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900">
              {selectedAlerts.size} alert{selectedAlerts.size !== 1 ? 's' : ''} selected
            </p>
            <div className="flex gap-2">
              <button onClick={bulkMarkAsRead} className="btn-secondary text-sm">
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Mark as Read
              </button>
              <button onClick={bulkDelete} className="btn-danger text-sm">
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert History */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Alert History</h2>
          {filteredAlerts.length > 0 && (
            <button
              onClick={selectAllAlerts}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              {selectedAlerts.size === filteredAlerts.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
        </div>
        
        {filteredAlerts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Clock className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p>No alerts found</p>
            {(searchQuery || severityFilter !== 'ALL' || channelFilter !== 'ALL' || statusFilter !== 'ALL' || dateRange !== 'ALL') && (
              <button onClick={clearFilters} className="text-primary-600 hover:text-primary-700 text-sm mt-2">
                Clear filters to see all alerts
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`flex items-start gap-3 p-4 rounded-lg hover:bg-gray-100 transition-colors ${
                  selectedAlerts.has(alert.id) ? 'bg-primary-50 border border-primary-200' : 'bg-gray-50'
                }`}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={selectedAlerts.has(alert.id)}
                  onChange={() => toggleSelectAlert(alert.id)}
                  className="mt-1 w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />

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
                        <span className="text-green-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
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
    </div>
  );
}
