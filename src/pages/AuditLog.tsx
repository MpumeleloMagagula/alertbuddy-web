import { useState, useEffect } from 'react';
import { 
  Activity, 
  Bell, 
  User, 
  UserCheck, 
  Smartphone, 
  Trash2, 
  Edit, 
  Send,
  Clock,
  Filter,
  Search
} from 'lucide-react';
import firebase from '../services/firebase';
import api from '../services/api';

interface AuditLogEntry {
  id: string;
  action: 'ALERT_SENT' | 'STANDBY_UPDATE' | 'USER_CREATED' | 'DEVICE_REGISTERED' | 'ALERT_DELETED' | 'ALERT_UPDATED' | 'SETTINGS_CHANGED';
  performedBy: string;
  performedByEmail: string;
  description: string;
  timestamp: number;
  metadata?: any;
}

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');

  useEffect(() => {
    loadAuditLogs();
    
    // Subscribe to real-time updates
    const unsubscribe = firebase.onAuditLogsChange((updatedLogs) => {
      setLogs(updatedLogs);
    });

    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [logs, searchQuery, actionFilter, dateRange]);

  const loadAuditLogs = async () => {
    try {
      setIsLoading(true);
      const fetchedLogs = await api.getAuditLogs();
      setLogs(fetchedLogs);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...logs];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(log => 
        log.description.toLowerCase().includes(query) ||
        log.performedBy.toLowerCase().includes(query) ||
        log.performedByEmail.toLowerCase().includes(query)
      );
    }

    // Action filter
    if (actionFilter !== 'ALL') {
      filtered = filtered.filter(log => log.action === actionFilter);
    }

    // Date range filter
    const now = Date.now();
    if (dateRange === 'TODAY') {
      const todayStart = new Date().setHours(0, 0, 0, 0);
      filtered = filtered.filter(log => log.timestamp >= todayStart);
    } else if (dateRange === 'WEEK') {
      const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(log => log.timestamp >= weekAgo);
    } else if (dateRange === 'MONTH') {
      const monthAgo = now - (30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(log => log.timestamp >= monthAgo);
    }

    setFilteredLogs(filtered);
  };

  const getActionIcon = (action: AuditLogEntry['action']) => {
    switch (action) {
      case 'ALERT_SENT':
        return Bell;
      case 'STANDBY_UPDATE':
        return UserCheck;
      case 'USER_CREATED':
        return User;
      case 'DEVICE_REGISTERED':
        return Smartphone;
      case 'ALERT_DELETED':
        return Trash2;
      case 'ALERT_UPDATED':
        return Edit;
      case 'SETTINGS_CHANGED':
        return Activity;
      default:
        return Activity;
    }
  };

  const getActionColor = (action: AuditLogEntry['action']) => {
    switch (action) {
      case 'ALERT_SENT':
        return 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300';
      case 'STANDBY_UPDATE':
        return 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300';
      case 'USER_CREATED':
        return 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300';
      case 'DEVICE_REGISTERED':
        return 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300';
      case 'ALERT_DELETED':
        return 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300';
      case 'ALERT_UPDATED':
        return 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-300';
      case 'SETTINGS_CHANGED':
        return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const formatActionName = (action: AuditLogEntry['action']) => {
    return action.split('_').map(word => 
      word.charAt(0) + word.slice(1).toLowerCase()
    ).join(' ');
  };

  const clearFilters = () => {
    setSearchQuery('');
    setActionFilter('ALL');
    setDateRange('ALL');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto shadow-sm"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading audit logs...</p>
        </div>
      </div>
    );
  }

  const exportToCSV = () => {
    if (filteredLogs.length === 0) return;

    const headers = ['ID', 'Action', 'Performed By', 'Email', 'Description', 'Timestamp', 'Metadata'];
    const csvRows = [
      headers.join(','),
      ...filteredLogs.map(log => [
        log.id,
        log.action,
        `"${log.performedBy}"`,
        log.performedByEmail,
        `"${log.description}"`,
        new Date(log.timestamp).toISOString(),
        `"${JSON.stringify(log.metadata || {}).replace(/"/g, '""')}"`
      ].join(','))
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Audit Log</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Track all administrative actions and system events</p>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Filters</h2>
          {(searchQuery || actionFilter !== 'ALL' || dateRange !== 'ALL') && (
            <button onClick={clearFilters} className="text-sm text-primary-600 hover:text-primary-700 ml-auto">
              Clear all
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-10"
                placeholder="Search logs..."
              />
            </div>
          </div>

          {/* Action Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Action Type</label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="input"
            >
              <option value="ALL">All Actions</option>
              <option value="ALERT_SENT">Alert Sent</option>
              <option value="STANDBY_UPDATE">Standby Update</option>
              <option value="USER_CREATED">User Created</option>
              <option value="DEVICE_REGISTERED">Device Registered</option>
              <option value="ALERT_DELETED">Alert Deleted</option>
              <option value="SETTINGS_CHANGED">Settings Changed</option>
            </select>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Date Range</label>
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

        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          Showing {filteredLogs.length} of {logs.length} log entries
        </div>
      </div>

      {/* Audit Log Entries */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Activity Timeline</h2>
        
        {filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Clock className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p>No audit logs found</p>
            {(searchQuery || actionFilter !== 'ALL' || dateRange !== 'ALL') && (
              <button onClick={clearFilters} className="text-primary-600 hover:text-primary-700 text-sm mt-2">
                Clear filters to see all logs
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredLogs.map((log) => {
              const Icon = getActionIcon(log.action);
              
              return (
                <div
                  key={log.id}
                  className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-surface transition-colors"
                >
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${getActionColor(log.action)}`}>
                    <Icon className="w-5 h-5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            {formatActionName(log.action)}
                          </span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-gray-900 dark:text-white font-medium">{log.description}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-600 dark:text-gray-400">
                          <User className="w-3 h-3" />
                          <span>{log.performedBy}</span>
                          <span>({log.performedByEmail})</span>
                        </div>
                      </div>
                    </div>

                    {/* Metadata */}
                    {log.metadata && (
                      <div className="mt-3 p-3 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Additional Details</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {Object.entries(log.metadata).map(([key, value]) => (
                            <div key={key}>
                              <span className="text-gray-500 dark:text-gray-400">{key}: </span>
                              <span className="text-gray-900 dark:text-white font-medium">{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Export option */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Export Logs</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Download audit logs for compliance and record-keeping purposes
        </p>
        <button 
          onClick={exportToCSV}
          disabled={filteredLogs.length === 0}
          className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4 mr-2" />
          Export to CSV
        </button>
      </div>
    </div>
  );
}
