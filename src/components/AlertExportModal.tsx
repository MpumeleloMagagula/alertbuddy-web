import { useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { X, Download, AlertCircle, AlertTriangle, Info, BarChart2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Alert } from '../types';

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: '#ef4444',
  WARNING:  '#f97316',
  INFO:     '#3b82f6',
};

const CHANNEL_COLORS = ['#0ea5e9', '#8b5cf6', '#22c55e', '#f97316', '#ef4444'];

interface Props {
  alerts: Alert[];
  onClose: () => void;
}

export default function AlertExportModal({ alerts, onClose }: Props) {
  const severityData = useMemo(() => {
    const counts: Record<string, number> = { CRITICAL: 0, WARNING: 0, INFO: 0 };
    alerts.forEach(a => { counts[a.severity] = (counts[a.severity] || 0) + 1; });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .filter(d => d.value > 0);
  }, [alerts]);

  const channelData = useMemo(() => {
    const counts: Record<string, number> = {};
    alerts.forEach(a => {
      const label = a.channelName || a.channelId || 'Unknown';
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name: name.replace(' Monitoring', '').replace(' Alerts', '').replace(' Cluster', '').replace(' Gateway', '').replace(' Response', ''), count }))
      .sort((a, b) => b.count - a.count);
  }, [alerts]);

  const stats = useMemo(() => ({
    total: alerts.length,
    critical: alerts.filter(a => a.severity === 'CRITICAL').length,
    warning: alerts.filter(a => a.severity === 'WARNING').length,
    info: alerts.filter(a => a.severity === 'INFO').length,
    unread: alerts.filter(a => !a.isRead).length,
    acknowledged: alerts.filter(a => a.isRead).length,
  }), [alerts]);

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1 — Alert History
    const historyRows = alerts.map(a => ({
      'Timestamp': new Date(a.timestamp).toLocaleString(),
      'Title': a.title,
      'Message': a.body,
      'Severity': a.severity,
      'Channel': a.channelName,
      'Status': a.isRead ? 'Acknowledged' : 'Unread',
      'Source': a.source,
    }));
    const wsHistory = XLSX.utils.json_to_sheet(historyRows);
    wsHistory['!cols'] = [
      { wch: 22 }, { wch: 35 }, { wch: 50 }, { wch: 10 },
      { wch: 28 }, { wch: 14 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, wsHistory, 'Alert History');

    // Sheet 2 — Severity Summary
    const severityRows = [
      { Severity: 'CRITICAL', Count: stats.critical, Percentage: `${alerts.length ? Math.round((stats.critical / alerts.length) * 100) : 0}%` },
      { Severity: 'WARNING',  Count: stats.warning,  Percentage: `${alerts.length ? Math.round((stats.warning  / alerts.length) * 100) : 0}%` },
      { Severity: 'INFO',     Count: stats.info,     Percentage: `${alerts.length ? Math.round((stats.info     / alerts.length) * 100) : 0}%` },
      { Severity: 'TOTAL',    Count: stats.total,    Percentage: '100%' },
    ];
    const wsSeverity = XLSX.utils.json_to_sheet(severityRows);
    wsSeverity['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsSeverity, 'By Severity');

    // Sheet 3 — Channel Summary
    const channelRows = Object.entries(
      alerts.reduce<Record<string, number>>((acc, a) => {
        const key = a.channelName || a.channelId || 'Unknown';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {})
    )
      .sort((a, b) => b[1] - a[1])
      .map(([channel, count]) => ({
        Channel: channel,
        Count: count,
        Percentage: `${Math.round((count / alerts.length) * 100)}%`,
      }));
    const wsChannel = XLSX.utils.json_to_sheet(channelRows);
    wsChannel['!cols'] = [{ wch: 30 }, { wch: 8 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsChannel, 'By Channel');

    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `alert-buddy-report-${date}.xlsx`);
    toast.success('Report downloaded');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <BarChart2 className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Alert Report</h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">— {alerts.length} alerts</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <Download className="w-4 h-4" />
              Export to Excel
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-6">

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard label="Total" value={stats.total} color="text-gray-900 dark:text-white" bg="bg-gray-100 dark:bg-gray-800" />
            <SummaryCard label="Critical" value={stats.critical} color="text-red-600 dark:text-red-400" bg="bg-red-50 dark:bg-red-900/20" icon={<AlertCircle className="w-4 h-4 text-red-500" />} />
            <SummaryCard label="Warning" value={stats.warning} color="text-orange-600 dark:text-orange-400" bg="bg-orange-50 dark:bg-orange-900/20" icon={<AlertTriangle className="w-4 h-4 text-orange-500" />} />
            <SummaryCard label="Info" value={stats.info} color="text-blue-600 dark:text-blue-400" bg="bg-blue-50 dark:bg-blue-900/20" icon={<Info className="w-4 h-4 text-blue-500" />} />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pie chart */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Alerts by Severity</h3>
              {severityData.length === 0 ? (
                <p className="text-center text-gray-400 py-10 text-sm">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={severityData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`}
                      labelLine={false}
                    >
                      {severityData.map((entry) => (
                        <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name] || '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string) => [value, name]}
                      contentStyle={{ background: 'var(--card)', border: '1px solid #374151', borderRadius: 8 }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Bar chart */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Alerts by Channel</h3>
              {channelData.length === 0 ? (
                <p className="text-center text-gray-400 py-10 text-sm">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={channelData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: 'var(--card)', border: '1px solid #374151', borderRadius: 8 }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {channelData.map((_, i) => (
                        <Cell key={i} fill={CHANNEL_COLORS[i % CHANNEL_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Acknowledgment breakdown */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Acknowledgment Status</h3>
            <div className="flex items-center gap-4">
              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: stats.total ? `${(stats.acknowledged / stats.total) * 100}%` : '0%' }}
                />
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400 flex-shrink-0">
                <span className="font-semibold text-green-600">{stats.acknowledged}</span> acknowledged,{' '}
                <span className="font-semibold text-orange-500">{stats.unread}</span> unread
              </span>
            </div>
          </div>

          {/* Recent alert preview table */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Recent Alerts (preview)</h3>
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    {['Timestamp', 'Title', 'Severity', 'Channel', 'Status'].map(h => (
                      <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
                  {alerts.slice(0, 8).map(a => (
                    <tr key={a.id}>
                      <td className="py-2 px-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{new Date(a.timestamp).toLocaleString()}</td>
                      <td className="py-2 px-3 text-gray-900 dark:text-white font-medium max-w-[180px] truncate">{a.title}</td>
                      <td className="py-2 px-3">
                        <span className={`text-xs font-semibold ${
                          a.severity === 'CRITICAL' ? 'text-red-600' :
                          a.severity === 'WARNING' ? 'text-orange-500' : 'text-blue-500'
                        }`}>{a.severity}</span>
                      </td>
                      <td className="py-2 px-3 text-gray-500 dark:text-gray-400 text-xs">{a.channelName}</td>
                      <td className="py-2 px-3">
                        <span className={`text-xs font-medium ${a.isRead ? 'text-green-600' : 'text-orange-500'}`}>
                          {a.isRead ? 'Acknowledged' : 'Unread'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {alerts.length > 8 && (
                <p className="text-center text-xs text-gray-400 py-2 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
                  +{alerts.length - 8} more rows in the exported Excel file
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color, bg, icon }: {
  label: string; value: number; color: string; bg: string; icon?: React.ReactNode;
}) {
  return (
    <div className={`${bg} rounded-xl p-4 flex items-center gap-3`}>
      {icon && <div>{icon}</div>}
      <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
      </div>
    </div>
  );
}
