import { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  Bell,
  User,
  UserCheck,
  Smartphone,
  Trash2,
  Edit,
  FileBarChart,
  Clock,
  Filter,
  Search
} from 'lucide-react';
import firebase from '../services/firebase';
import api from '../services/api';
import type { AuditLogEntry } from '../types';
import AuditLogExportModal from '../components/AuditLogExportModal';

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');
  const [showExport, setShowExport] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    loadAuditLogs();

    // Subscribe to real-time updates
    const unsubscribe = firebase.onAuditLogsChange((updatedLogs) => {
      setLogs(updatedLogs);
    }, 500);

    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [logs, searchQuery, actionFilter, dateRange]);

  useEffect(() => {
    setCurrentPage(1);
  }, [logs, searchQuery, actionFilter, dateRange]);

  const loadAuditLogs = async () => {
    try {
      setIsLoading(true);
      const fetchedLogs = await api.getAuditLogs({ limit: 500 });
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

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  const pageNumbers = useMemo(() => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  }, [currentPage, totalPages]);

  const getActionIcon = (action: AuditLogEntry['action']) => {
    switch (action) {
      case 'ALERT_SENT':
        return Bell;
      case 'STANDBY_UPDATE':
        return UserCheck;
      case 'USER_CREATED':
      case 'USER_UPDATED':
        return User;
      case 'USER_DELETED':
        return Trash2;
      case 'DEVICE_REGISTERED':
      case 'DEVICE_UNREGISTERED':
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
      case 'USER_UPDATED':
        return 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300';
      case 'USER_DELETED':
        return 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300';
      case 'DEVICE_REGISTERED':
      case 'DEVICE_UNREGISTERED':
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

  return (
    <div className="space-y-6">
      {showExport && (
        <AuditLogExportModal logs={logs} onClose={() => setShowExport(false)} />
      )}

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
              <option value="ALERT_UPDATED">Alert Updated</option>
              <option value="ALERT_DELETED">Alert Deleted</option>
              <option value="STANDBY_UPDATE">Standby Update</option>
              <option value="USER_CREATED">User Created</option>
              <option value="USER_UPDATED">User Updated</option>
              <option value="USER_DELETED">User Deleted</option>
              <option value="DEVICE_REGISTERED">Device Registered</option>
              <option value="DEVICE_UNREGISTERED">Device Unregistered</option>
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
            {paginatedLogs.map((log) => {
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
                          {log.performedByEmail && log.performedByEmail !== log.performedBy && (
                            <span>({log.performedByEmail})</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Metadata — omit null/undefined/empty entries so this doesn't fill up with noise */}
                    {(() => {
                      const entries = Object.entries(log.metadata ?? {}).filter(
                        ([, value]) => value !== null && value !== undefined && value !== ''
                      );
                      if (entries.length === 0) return null;
                      return (
                        <div className="mt-3 p-3 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Additional Details</p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {entries.map(([key, value]) => (
                              <div key={key}>
                                <span className="text-gray-500 dark:text-gray-400">{key}: </span>
                                <span className="text-gray-900 dark:text-white font-medium">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {filteredLogs.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-5 pt-4 border-t border-gray-100 dark:border-gray-800">
            {/* Left: count + page size */}
            <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
              <span>
                Showing{' '}
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredLogs.length)}
                </span>{' '}
                of{' '}
                <span className="font-semibold text-gray-700 dark:text-gray-300">{filteredLogs.length}</span>{' '}
                entries
              </span>
              <select
                value={pageSize}
                title="Rows per page"
                onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="input py-1 px-2 text-xs w-20"
              >
                {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n} / page</option>)}
              </select>
            </div>

            {/* Right: page buttons */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1.5 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ‹ Prev
              </button>

              {pageNumbers.map((page, i) =>
                page === 'ellipsis' ? (
                  <span key={`ellipsis-${pageNumbers[i - 1]}`} className="px-2 text-gray-400 text-sm select-none">…</span>
                ) : (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      page === currentPage
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    {page}
                  </button>
                )
              )}

              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1.5 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next ›
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Export option */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Export Report</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Generate a visual report with charts, breakdowns, and the full log history for compliance and record-keeping
        </p>
        <button
          type="button"
          onClick={() => setShowExport(true)}
          disabled={logs.length === 0}
          className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FileBarChart className="w-4 h-4" />
          Export Report
        </button>
      </div>
    </div>
  );
}
