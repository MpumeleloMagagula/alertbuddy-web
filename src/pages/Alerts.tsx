import { useState, useEffect, useMemo } from 'react';
import {
  Bell,
  Send,
  TestTube,
  Clock,
  AlertCircle,
  AlertTriangle,
  Info,
  Search,
  Filter,
  CheckSquare,
  Square,
  Trash2,
  CheckCircle2,
  XCircle,
  UserCheck,
  FileBarChart,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';
import firebase from '../services/firebase';
import type { Alert, TestAlertFormData, Severity } from '../types';
import AlertExportModal from '../components/AlertExportModal';

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filteredAlerts, setFilteredAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [standbyInfo, setStandbyInfo] = useState<{ onStandby: boolean; displayName?: string; email?: string; tokenResolved?: boolean } | null>(null);

  // Validation state
  const [fieldErrors, setFieldErrors] = useState({ title: false, message: false });

  // Filter and search state
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showExport, setShowExport] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Form state
  const [testAlert, setTestAlert] = useState<TestAlertFormData>({
    title: '',
    message: '',
    severity: 'WARNING' as Severity,
    channelId: 'core-monitoring',
    channelName: 'Core Services Monitoring',
  });

  const channels = [
    { id: 'core-monitoring', name: 'Core Services Monitoring' },
    { id: 'infra-alerts', name: 'Cloud Infrastructure Alerts' },
    { id: 'api-gateway', name: 'External API Gateway' },
    { id: 'db-health', name: 'Database Health Cluster' },
    { id: 'crisis-response', name: 'Urgent Crisis Response' },
  ];

  useEffect(() => {
    const timeout = setTimeout(() => setIsLoading(false), 5000);

    const unsubAlerts = firebase.onAlertsChange((updatedAlerts: Alert[]) => {
      setAlerts(updatedAlerts);
      setIsLoading(false);
      clearTimeout(timeout);
    }, 100);

    const unsubStandby = firebase.onStandbyChange((info) => setStandbyInfo(info));

    return () => { unsubAlerts(); unsubStandby(); clearTimeout(timeout); };
  }, []);

  useEffect(() => {
    applyFilters();
    setCurrentPage(1);
  }, [alerts, searchQuery, severityFilter, statusFilter]);

  const applyFilters = () => {
    let filtered = [...alerts];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(a => 
        a.title.toLowerCase().includes(query) || 
        a.body.toLowerCase().includes(query) ||
        a.channelName.toLowerCase().includes(query)
      );
    }

    if (severityFilter !== 'ALL') {
      filtered = filtered.filter(a => a.severity === severityFilter);
    }

    if (statusFilter === 'READ') {
      filtered = filtered.filter(a => a.isRead);
    } else if (statusFilter === 'UNREAD') {
      filtered = filtered.filter(a => !a.isRead);
    }

    setFilteredAlerts(filtered);
  };

  const totalPages = Math.max(1, Math.ceil(filteredAlerts.length / pageSize));
  const paginatedAlerts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAlerts.slice(start, start + pageSize);
  }, [filteredAlerts, currentPage, pageSize]);

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

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredAlerts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAlerts.map(a => a.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkMarkRead = async () => {
    if (selectedIds.size === 0) return;

    try {
      setIsSending(true);
      const currentUserEmail = firebase.getCurrentUser()?.email ?? undefined;
      await api.bulkMarkAlertsRead(Array.from(selectedIds), undefined, currentUserEmail);
      toast.success(`Marked ${selectedIds.size} alerts as acknowledged`);
      setSelectedIds(new Set());
    } catch (error) {
      toast.error('Failed to update alerts');
    } finally {
      setIsSending(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} alerts?`)) return;

    try {
      setIsSending(true);
      await api.bulkDeleteAlerts(Array.from(selectedIds));
      toast.success(`Deleted ${selectedIds.size} alerts`);
      setSelectedIds(new Set());
    } catch (error) {
      toast.error('Failed to delete alerts');
    } finally {
      setIsSending(false);
    }
  };

  const validateForm = () => {
    const errors = { title: !testAlert.title.trim(), message: !testAlert.message.trim() };
    setFieldErrors(errors);
    if (errors.title || errors.message) {
      toast.error(`Please fill in ${[errors.title && 'title', errors.message && 'message'].filter(Boolean).join(' and ')}`);
      return false;
    }
    return true;
  };

  const resetForm = () => {
    setTestAlert({ title: '', message: '', severity: 'WARNING' as Severity, channelId: 'core-monitoring', channelName: 'Core Services Monitoring' });
    setFieldErrors({ title: false, message: false });
  };

  const handleSendToAll = async () => {
    if (!validateForm()) return;
    try {
      setIsSending(true);
      const result = await api.sendTestAlert(testAlert);
      if (result.success === false) throw new Error((result as any).error ?? 'No registered devices');
      toast.success('Alert sent to all devices');
      resetForm();
    } catch (error: any) {
      toast.error(error.message ?? 'Failed to send alert');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendToStandby = async () => {
    if (!validateForm()) return;

    if (!standbyInfo?.onStandby) {
      toast.error('Nobody is on standby right now. Assign someone on the Standby page first.');
      return;
    }
    if (!standbyInfo.tokenResolved) {
      toast.error(`${standbyInfo.displayName ?? 'Standby person'} hasn't opened the app yet — their device token is pending.`);
      return;
    }

    try {
      setIsSending(true);
      const result = await api.sendStandbyAlert(testAlert);
      if (result.success === false) throw new Error((result as any).error ?? 'Failed to send');
      toast.success(`Alert sent to ${standbyInfo.displayName ?? 'standby person'}`);
      resetForm();
    } catch (error: any) {
      toast.error(error.message ?? 'Failed to send alert to standby');
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
      toast.error('Failed to test Grafana webhook');
    } finally {
      setIsSending(false);
    }
  };

  const getSeverityIcon = (severity: Severity) => {
    switch (severity) {
      case 'CRITICAL': return <AlertCircle className="w-4 h-4" />;
      case 'WARNING': return <AlertTriangle className="w-4 h-4" />;
      case 'INFO': return <Info className="w-4 h-4" />;
    }
  };

  const getSeverityColor = (severity: Severity) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
      case 'WARNING': return 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400';
      case 'INFO': return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading alerts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showExport && (
        <AlertExportModal alerts={alerts} onClose={() => setShowExport(false)} />
      )}

      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Alerts</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Test alert delivery and manage alert history</p>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Form and Stats */}
        <div className="lg:col-span-1 space-y-6">
          {/* Send Test Alert */}
          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Send Test Alert</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={testAlert.title}
                  onChange={(e) => { setTestAlert({ ...testAlert, title: e.target.value }); setFieldErrors(f => ({ ...f, title: false })); }}
                  className={`input ${fieldErrors.title ? 'border-red-500 dark:border-red-500 focus:ring-red-500' : ''}`}
                  placeholder="e.g., CPU Usage Critical"
                  disabled={isSending}
                />
                {fieldErrors.title && <p className="text-xs text-red-500 mt-1">Title is required</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={testAlert.message}
                  onChange={(e) => { setTestAlert({ ...testAlert, message: e.target.value }); setFieldErrors(f => ({ ...f, message: false })); }}
                  className={`input min-h-[80px] resize-none ${fieldErrors.message ? 'border-red-500 dark:border-red-500 focus:ring-red-500' : ''}`}
                  placeholder="Alert details..."
                  disabled={isSending}
                />
                {fieldErrors.message && <p className="text-xs text-red-500 mt-1">Message is required</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Severity</label>
                  <select
                    value={testAlert.severity}
                    onChange={(e) => setTestAlert({ ...testAlert, severity: e.target.value as Severity })}
                    title="Severity"
                    className="input"
                    disabled={isSending}
                  >
                    <option value="CRITICAL">Critical</option>
                    <option value="WARNING">Warning</option>
                    <option value="INFO">Info</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Channel</label>
                  <select
                    value={testAlert.channelId}
                    onChange={(e) => {
                      const channel = channels.find(c => c.id === e.target.value);
                      setTestAlert({ ...testAlert, channelId: e.target.value, channelName: channel?.name || '' });
                    }}
                    title="Channel"
                    className="input"
                    disabled={isSending}
                  >
                    {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button type="button" onClick={handleSendToAll} disabled={isSending} className="btn-primary w-full flex items-center justify-center gap-2">
                  <Send className="w-4 h-4" />
                  {isSending ? 'Sending...' : 'Send to All'}
                </button>
                <button
                  type="button"
                  onClick={handleSendToStandby}
                  disabled={isSending || !standbyInfo?.onStandby}
                  title={!standbyInfo?.onStandby ? 'No one is on standby — assign someone first' : undefined}
                  className="btn-secondary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <UserCheck className="w-4 h-4" />
                  {isSending ? 'Sending...' : 'Send to Standby'}
                </button>
                <button type="button" onClick={handleTestGrafanaWebhook} disabled={isSending} className="btn-secondary w-full flex items-center justify-center gap-2">
                  <TestTube className="w-4 h-4" /> Test Webhook
                </button>
              </div>

              {/* Standby status pill */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
                standbyInfo?.onStandby
                  ? standbyInfo.tokenResolved
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                    : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
              }`}>
                <UserCheck className="w-3.5 h-3.5 flex-shrink-0" />
                {standbyInfo === null
                  ? 'Loading standby...'
                  : standbyInfo.onStandby
                    ? standbyInfo.tokenResolved
                      ? `On standby: ${standbyInfo.displayName}`
                      : `On standby: ${standbyInfo.displayName} (app not connected yet)`
                    : 'No one on standby — Send to Standby is disabled'
                }
              </div>
            </div>
          </div>

          {/* Alert Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="card p-4">
              <p className="text-xs text-gray-500 uppercase font-bold mb-1">Total</p>
              <p className="text-2xl font-bold dark:text-white">{alerts.length}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-red-500 uppercase font-bold mb-1">Critical</p>
              <p className="text-2xl font-bold text-red-600">{alerts.filter(a => a.severity === 'CRITICAL').length}</p>
            </div>
          </div>
        </div>

        {/* Right Column - History and Management */}
        <div className="lg:col-span-2 space-y-6">
          {/* Filters and Search */}
          <div className="card">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search alerts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input pl-10"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} title="Filter by severity" className="input w-32">
                  <option value="ALL">All Sev</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="WARNING">Warning</option>
                  <option value="INFO">Info</option>
                </select>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} title="Filter by status" className="input w-32">
                  <option value="ALL">All Status</option>
                  <option value="READ">Read</option>
                  <option value="UNREAD">Unread</option>
                </select>
              </div>
            </div>

            {/* Bulk Actions Bar */}
            {selectedIds.size > 0 && (
              <div className="mt-4 p-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 rounded-lg flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-primary-700 dark:text-primary-400">
                    {selectedIds.size} selected
                  </span>
                  <button type="button" onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-500 hover:text-gray-700">
                    Deselect all
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={handleBulkMarkRead} className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Mark Read
                  </button>
                  <button type="button" onClick={handleBulkDelete} className="bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 py-1.5 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Alert List */}
          <div className="card min-h-[400px]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Alert History</h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowExport(true)}
                  className="btn-secondary text-sm flex items-center gap-2"
                >
                  <FileBarChart className="w-4 h-4" />
                  Export Report
                </button>
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                >
                  {selectedIds.size === filteredAlerts.length && filteredAlerts.length > 0 ? (
                    <><XCircle className="w-4 h-4" /> Deselect All</>
                  ) : (
                    <><CheckSquare className="w-4 h-4" /> Select All</>
                  )}
                </button>
              </div>
            </div>

            {filteredAlerts.length === 0 ? (
              <div className="text-center py-20 text-gray-500 dark:text-gray-400">
                <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-700" />
                <p>No alerts found matching filters</p>
              </div>
            ) : (
              <div className="space-y-3">
                {paginatedAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    onClick={() => toggleSelect(alert.id)}
                    className={`flex items-start gap-3 p-4 rounded-lg border-2 transition-all cursor-pointer ${
                      selectedIds.has(alert.id) 
                        ? 'bg-primary-50 dark:bg-primary-900/10 border-primary-500' 
                        : 'bg-gray-50 dark:bg-gray-800 border-transparent hover:border-gray-200 dark:hover:border-gray-700'
                    }`}
                  >
                    {/* Checkbox */}
                    <div className="pt-1">
                      {selectedIds.has(alert.id) ? (
                        <CheckSquare className="w-5 h-5 text-primary-600" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                      )}
                    </div>

                    {/* Severity icon */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${getSeverityColor(alert.severity)}`}>
                      {getSeverityIcon(alert.severity)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold dark:text-white ${alert.isRead ? 'text-gray-600 opacity-70' : 'text-gray-900'}`}>
                            {alert.title}
                          </p>
                          <p className={`text-sm mt-1 line-clamp-2 ${alert.isRead ? 'text-gray-500 opacity-70' : 'text-gray-600 dark:text-gray-400'}`}>
                            {alert.body}
                          </p>
                        </div>
                        <span className={`badge flex-shrink-0 ${
                          alert.severity === 'CRITICAL' ? 'badge-critical' :
                          alert.severity === 'WARNING' ? 'badge-warning' :
                          'badge-info'
                        }`}>
                          {alert.severity}
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-medium bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-700 dark:text-gray-300">
                          {alert.channelName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(alert.timestamp).toLocaleString()}
                        </span>
                        {alert.isRead && (
                          <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                            <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                            <span>
                              {alert.acknowledgedBy
                                ? <>Ack&apos;d by <strong>{alert.acknowledgedBy.split('@')[0]}</strong></>
                                : 'Acknowledged'}
                              {alert.acknowledgedAt && (
                                <span className="font-normal opacity-70 ml-1">
                                  · {new Date(alert.acknowledgedAt).toLocaleString([], {
                                    month: 'short', day: 'numeric',
                                    hour: '2-digit', minute: '2-digit',
                                  })}
                                </span>
                              )}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {filteredAlerts.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-5 pt-4 border-t border-gray-100 dark:border-gray-800">
                {/* Left: count + page size */}
                <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                  <span>
                    Showing{' '}
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredAlerts.length)}
                    </span>{' '}
                    of{' '}
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{filteredAlerts.length}</span>{' '}
                    alerts
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
                      <span key={`ellipsis-${i < pageNumbers.indexOf('ellipsis') ? 'start' : 'end'}`} className="px-2 text-gray-400 text-sm select-none">…</span>
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
        </div>
      </div>
    </div>
  );
}
