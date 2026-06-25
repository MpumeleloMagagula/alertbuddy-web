import { useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { X, Download, AlertCircle, AlertTriangle, Info, BarChart2, Loader2 } from 'lucide-react';
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

async function captureChartImage(el: HTMLElement | null): Promise<string | null> {
  if (!el) return null;
  try {
    const canvas = await html2canvas(el, {
      backgroundColor: '#ffffff',
      scale: 2,
      logging: false,
      useCORS: true,
    });
    return canvas.toDataURL('image/png').split(',')[1];
  } catch {
    return null;
  }
}

export default function AlertExportModal({ alerts, onClose }: Props) {
  const [exporting, setExporting] = useState(false);
  const pieRef  = useRef<HTMLDivElement>(null);
  const barRef  = useRef<HTMLDivElement>(null);

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
      .map(([name, count]) => ({
        name: name
          .replace(' Monitoring', '').replace(' Alerts', '')
          .replace(' Cluster', '').replace(' Gateway', '').replace(' Response', ''),
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [alerts]);

  const stats = useMemo(() => ({
    total:        alerts.length,
    critical:     alerts.filter(a => a.severity === 'CRITICAL').length,
    warning:      alerts.filter(a => a.severity === 'WARNING').length,
    info:         alerts.filter(a => a.severity === 'INFO').length,
    unread:       alerts.filter(a => !a.isRead).length,
    acknowledged: alerts.filter(a => a.isRead).length,
  }), [alerts]);

  const handleExportExcel = async () => {
    setExporting(true);
    toast.info('Capturing charts…');

    try {
      const [pieBase64, barBase64] = await Promise.all([
        captureChartImage(pieRef.current),
        captureChartImage(barRef.current),
      ]);

      const wb = new ExcelJS.Workbook();
      wb.creator = 'Alert Buddy';
      wb.created = new Date();

      // ── Dashboard sheet ──────────────────────────────────────────────
      const dash = wb.addWorksheet('Dashboard', {
        pageSetup: { paperSize: 9, orientation: 'landscape' },
      });

      const headerFill: ExcelJS.Fill = {
        type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' },
      };
      const whiteFg: ExcelJS.Fill = {
        type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' },
      };

      dash.mergeCells('A1:P1');
      const title = dash.getCell('A1');
      title.value = `Alert Buddy — Export Report  ·  ${new Date().toLocaleString()}`;
      title.font  = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
      title.fill  = headerFill;
      title.alignment = { vertical: 'middle', horizontal: 'center' };
      dash.getRow(1).height = 28;

      // Summary labels
      const summaryRows = [
        ['Total Alerts',   stats.total,        'FF374151'],
        ['Critical',       stats.critical,      'FFEF4444'],
        ['Warning',        stats.warning,       'FFF97316'],
        ['Info',           stats.info,          'FF3B82F6'],
        ['Acknowledged',   stats.acknowledged,  'FF22C55E'],
        ['Unread',         stats.unread,        'FFF97316'],
      ] as const;

      summaryRows.forEach(([label, value, argb], i) => {
        const row = i + 3;
        const lCell = dash.getCell(`A${row}`);
        const vCell = dash.getCell(`B${row}`);
        lCell.value = label;
        lCell.font  = { bold: true, size: 11 };
        lCell.fill  = whiteFg;
        vCell.value = value;
        vCell.font  = { bold: true, size: 13, color: { argb } };
        vCell.fill  = whiteFg;
        vCell.alignment = { horizontal: 'right' };
        dash.getRow(row).height = 18;
      });

      dash.getColumn('A').width = 18;
      dash.getColumn('B').width = 10;

      // Embed charts
      if (pieBase64) {
        const pieId = wb.addImage({ base64: pieBase64, extension: 'png' });
        dash.addImage(pieId, { tl: { col: 2.5, row: 1.5 }, ext: { width: 400, height: 250 } });
      }
      if (barBase64) {
        const barId = wb.addImage({ base64: barBase64, extension: 'png' });
        dash.addImage(barId, { tl: { col: 10, row: 1.5 }, ext: { width: 400, height: 250 } });
      }

      // Reserve row height for images
      for (let r = 2; r <= 20; r++) dash.getRow(r).height = 15;

      // ── Alert History sheet ──────────────────────────────────────────
      const history = wb.addWorksheet('Alert History');
      history.columns = [
        { header: 'Timestamp',  key: 'ts',       width: 22 },
        { header: 'Title',      key: 'title',     width: 36 },
        { header: 'Message',    key: 'body',      width: 50 },
        { header: 'Severity',   key: 'severity',  width: 12 },
        { header: 'Channel',    key: 'channel',   width: 30 },
        { header: 'Status',     key: 'status',    width: 15 },
        { header: 'Source',     key: 'source',    width: 12 },
      ];

      const hRow = history.getRow(1);
      hRow.font   = { bold: true, color: { argb: 'FFFFFFFF' } };
      hRow.fill   = headerFill;
      hRow.height = 18;
      hRow.alignment = { vertical: 'middle' };

      const severityArgb: Record<string, string> = {
        CRITICAL: 'FFEF4444',
        WARNING:  'FFF97316',
        INFO:     'FF3B82F6',
      };

      alerts.forEach((a, idx) => {
        const row = history.addRow({
          ts:       new Date(a.timestamp).toLocaleString(),
          title:    a.title,
          body:     a.body,
          severity: a.severity,
          channel:  a.channelName,
          status:   a.isRead ? 'Acknowledged' : 'Unread',
          source:   a.source,
        });

        // Alternate row shading
        if (idx % 2 === 0) {
          row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
        }

        const sevCell = row.getCell('severity');
        sevCell.font = { bold: true, color: { argb: severityArgb[a.severity] || 'FF374151' } };

        const statusCell = row.getCell('status');
        statusCell.font = {
          bold: true,
          color: { argb: a.isRead ? 'FF22C55E' : 'FFF97316' },
        };
      });

      // ── By Severity sheet ────────────────────────────────────────────
      const sevSheet = wb.addWorksheet('By Severity');
      sevSheet.columns = [
        { header: 'Severity',   key: 'sev', width: 14 },
        { header: 'Count',      key: 'cnt', width: 10 },
        { header: 'Percentage', key: 'pct', width: 14 },
      ];
      const sevHRow = sevSheet.getRow(1);
      sevHRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sevHRow.fill = headerFill;
      sevHRow.height = 18;

      const pct = (n: number) => `${alerts.length ? Math.round((n / alerts.length) * 100) : 0}%`;
      [
        { sev: 'CRITICAL', cnt: stats.critical, pct: pct(stats.critical) },
        { sev: 'WARNING',  cnt: stats.warning,  pct: pct(stats.warning)  },
        { sev: 'INFO',     cnt: stats.info,     pct: pct(stats.info)     },
        { sev: 'TOTAL',    cnt: stats.total,    pct: '100%'               },
      ].forEach((r, i) => {
        const row = sevSheet.addRow(r);
        if (i === 3) row.font = { bold: true };
        const c = row.getCell('sev');
        c.font = { bold: true, color: { argb: severityArgb[r.sev] || 'FF374151' } };
      });

      // ── By Channel sheet ─────────────────────────────────────────────
      const chanSheet = wb.addWorksheet('By Channel');
      chanSheet.columns = [
        { header: 'Channel',    key: 'ch',  width: 34 },
        { header: 'Count',      key: 'cnt', width: 10 },
        { header: 'Percentage', key: 'pct', width: 14 },
      ];
      const chHRow = chanSheet.getRow(1);
      chHRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      chHRow.fill = headerFill;
      chHRow.height = 18;

      Object.entries(
        alerts.reduce<Record<string, number>>((acc, a) => {
          const key = a.channelName || a.channelId || 'Unknown';
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {})
      )
        .sort(([, a], [, b]) => b - a)
        .forEach(([ch, cnt], i) => {
          const row = chanSheet.addRow({ ch, cnt, pct: `${Math.round((cnt / alerts.length) * 100)}%` });
          if (i % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
        });

      // ── Download ─────────────────────────────────────────────────────
      const buffer = await wb.xlsx.writeBuffer();
      const blob   = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `alert-buddy-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Report downloaded with charts');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Export failed — please try again');
    } finally {
      setExporting(false);
    }
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
              disabled={exporting}
              className="btn-primary flex items-center gap-2 text-sm disabled:opacity-60"
            >
              {exporting
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Download className="w-4 h-4" />}
              {exporting ? 'Generating…' : 'Export to Excel'}
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
            <SummaryCard label="Total"    value={stats.total}        color="text-gray-900 dark:text-white"          bg="bg-gray-100 dark:bg-gray-800" />
            <SummaryCard label="Critical" value={stats.critical}     color="text-red-600 dark:text-red-400"         bg="bg-red-50 dark:bg-red-900/20"    icon={<AlertCircle   className="w-4 h-4 text-red-500"    />} />
            <SummaryCard label="Warning"  value={stats.warning}      color="text-orange-600 dark:text-orange-400"   bg="bg-orange-50 dark:bg-orange-900/20" icon={<AlertTriangle className="w-4 h-4 text-orange-500" />} />
            <SummaryCard label="Info"     value={stats.info}         color="text-blue-600 dark:text-blue-400"       bg="bg-blue-50 dark:bg-blue-900/20"  icon={<Info          className="w-4 h-4 text-blue-500"    />} />
          </div>

          {/* Charts — these are the elements we capture */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div ref={pieRef} className="bg-white rounded-xl p-4 border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Alerts by Severity</h3>
              {severityData.length === 0 ? (
                <p className="text-center text-gray-400 py-10 text-sm">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={severityData}
                      cx="50%" cy="50%"
                      innerRadius={55} outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`}
                      labelLine={false}
                    >
                      {severityData.map((entry) => (
                        <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name] || '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number, name: string) => [value, name]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div ref={barRef} className="bg-white rounded-xl p-4 border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Alerts by Channel</h3>
              {channelData.length === 0 ? (
                <p className="text-center text-gray-400 py-10 text-sm">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={channelData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} allowDecimals={false} />
                    <Tooltip />
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
                          a.severity === 'WARNING'  ? 'text-orange-500' : 'text-blue-500'
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
