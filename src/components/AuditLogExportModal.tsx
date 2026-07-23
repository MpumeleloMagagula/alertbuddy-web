import { useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { X, Download, Users as UsersIcon, ClipboardList, BarChart2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { AuditLogEntry } from '../types';

const ACTION_COLORS: Record<string, string> = {
  ALERT_SENT:          '#3b82f6',
  ALERT_UPDATED:       '#eab308',
  ALERT_DELETED:       '#ef4444',
  STANDBY_UPDATE:      '#22c55e',
  USER_CREATED:        '#8b5cf6',
  USER_UPDATED:        '#8b5cf6',
  USER_DELETED:        '#ef4444',
  DEVICE_REGISTERED:   '#f97316',
  DEVICE_UNREGISTERED: '#f97316',
  SETTINGS_CHANGED:    '#6b7280',
};

const DAY_COLOR = '#0ea5e9';

interface Props {
  logs: AuditLogEntry[];
  onClose: () => void;
}

function formatActionName(action: string): string {
  return action.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
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

export default function AuditLogExportModal({ logs, onClose }: Props) {
  const [exporting, setExporting] = useState(false);
  const pieRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const actionData = useMemo(() => {
    const counts: Record<string, number> = {};
    logs.forEach(l => { counts[l.action] = (counts[l.action] || 0) + 1; });
    return Object.entries(counts)
      .map(([name, value]) => ({ name: formatActionName(name), rawName: name, value }))
      .sort((a, b) => b.value - a.value);
  }, [logs]);

  const dayData = useMemo(() => {
    const counts: Record<string, number> = {};
    const days: string[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      days.push(key);
      counts[key] = 0;
    }
    logs.forEach(l => {
      const key = new Date(l.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
      if (key in counts) counts[key] += 1;
    });
    return days.map(name => ({ name, count: counts[name] }));
  }, [logs]);

  const actorData = useMemo(() => {
    const counts: Record<string, number> = {};
    logs.forEach(l => {
      const key = l.performedByEmail || l.performedBy || 'unknown';
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).sort(([, a], [, b]) => b - a);
  }, [logs]);

  const stats = useMemo(() => {
    const now = Date.now();
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    return {
      total: logs.length,
      today: logs.filter(l => l.timestamp >= todayStart).length,
      thisWeek: logs.filter(l => l.timestamp >= weekAgo).length,
      uniqueActors: actorData.length,
    };
  }, [logs, actorData]);

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
      title.value = `Alert Buddy — Audit Log Report  ·  ${new Date().toLocaleString()}`;
      title.font  = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
      title.fill  = headerFill;
      title.alignment = { vertical: 'middle', horizontal: 'center' };
      dash.getRow(1).height = 28;

      const summaryRows = [
        ['Total Entries',   stats.total,        'FF374151'],
        ['Today',           stats.today,        'FF0EA5E9'],
        ['This Week',       stats.thisWeek,     'FF22C55E'],
        ['Unique Actors',   stats.uniqueActors, 'FF8B5CF6'],
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

      if (pieBase64) {
        const pieId = wb.addImage({ base64: pieBase64, extension: 'png' });
        dash.addImage(pieId, { tl: { col: 2.5, row: 1.5 }, ext: { width: 400, height: 250 } });
      }
      if (barBase64) {
        const barId = wb.addImage({ base64: barBase64, extension: 'png' });
        dash.addImage(barId, { tl: { col: 10, row: 1.5 }, ext: { width: 400, height: 250 } });
      }

      for (let r = 2; r <= 20; r++) dash.getRow(r).height = 15;

      // ── Log History sheet ─────────────────────────────────────────────
      const history = wb.addWorksheet('Log History');
      history.columns = [
        { header: 'Timestamp',       key: 'ts',       width: 22 },
        { header: 'Action',          key: 'action',   width: 20 },
        { header: 'Performed By',    key: 'by',        width: 26 },
        { header: 'Email',           key: 'email',     width: 30 },
        { header: 'Description',     key: 'desc',      width: 50 },
        { header: 'Metadata',        key: 'meta',      width: 40 },
      ];

      const hRow = history.getRow(1);
      hRow.font   = { bold: true, color: { argb: 'FFFFFFFF' } };
      hRow.fill   = headerFill;
      hRow.height = 18;
      hRow.alignment = { vertical: 'middle' };

      logs.forEach((l, idx) => {
        const row = history.addRow({
          ts:     new Date(l.timestamp).toLocaleString(),
          action: formatActionName(l.action),
          by:     l.performedBy,
          email:  l.performedByEmail,
          desc:   l.description,
          meta:   l.metadata ? JSON.stringify(l.metadata) : '',
        });
        if (idx % 2 === 0) {
          row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
        }
        row.getCell('action').font = { bold: true, color: { argb: (ACTION_COLORS[l.action] || '#374151').replace('#', 'FF') } };
      });

      // ── By Action sheet ────────────────────────────────────────────────
      const actionSheet = wb.addWorksheet('By Action');
      actionSheet.columns = [
        { header: 'Action',     key: 'action', width: 22 },
        { header: 'Count',      key: 'cnt',    width: 10 },
        { header: 'Percentage', key: 'pct',    width: 14 },
      ];
      const actHRow = actionSheet.getRow(1);
      actHRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      actHRow.fill = headerFill;
      actHRow.height = 18;

      actionData.forEach((a, i) => {
        const row = actionSheet.addRow({
          action: a.name,
          cnt: a.value,
          pct: `${logs.length ? Math.round((a.value / logs.length) * 100) : 0}%`,
        });
        if (i % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
        row.getCell('action').font = { bold: true, color: { argb: (ACTION_COLORS[a.rawName] || '#374151').replace('#', 'FF') } };
      });

      // ── By Actor sheet ─────────────────────────────────────────────────
      const actorSheet = wb.addWorksheet('By Actor');
      actorSheet.columns = [
        { header: 'Performed By', key: 'actor', width: 34 },
        { header: 'Count',        key: 'cnt',   width: 10 },
        { header: 'Percentage',   key: 'pct',   width: 14 },
      ];
      const actorHRow = actorSheet.getRow(1);
      actorHRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      actorHRow.fill = headerFill;
      actorHRow.height = 18;

      actorData.forEach(([actor, cnt], i) => {
        const row = actorSheet.addRow({ actor, cnt, pct: `${logs.length ? Math.round((cnt / logs.length) * 100) : 0}%` });
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
      a.download = `audit-log-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
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
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Audit Log Report</h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">— {logs.length} entries</span>
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
            <SummaryCard label="Total"         value={stats.total}        color="text-gray-900 dark:text-white"        bg="bg-gray-100 dark:bg-gray-800" icon={<ClipboardList className="w-4 h-4 text-gray-500" />} />
            <SummaryCard label="Today"         value={stats.today}        color="text-sky-600 dark:text-sky-400"       bg="bg-sky-50 dark:bg-sky-900/20" />
            <SummaryCard label="This Week"     value={stats.thisWeek}     color="text-green-600 dark:text-green-400"   bg="bg-green-50 dark:bg-green-900/20" />
            <SummaryCard label="Unique Actors" value={stats.uniqueActors} color="text-purple-600 dark:text-purple-400" bg="bg-purple-50 dark:bg-purple-900/20" icon={<UsersIcon className="w-4 h-4 text-purple-500" />} />
          </div>

          {/* Charts — these are the elements we capture */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div ref={pieRef} className="bg-white rounded-xl p-4 border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Actions by Type</h3>
              {actionData.length === 0 ? (
                <p className="text-center text-gray-400 py-10 text-sm">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={actionData}
                      cx="50%" cy="50%"
                      innerRadius={55} outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`}
                      labelLine={false}
                    >
                      {actionData.map((entry) => (
                        <Cell key={entry.rawName} fill={ACTION_COLORS[entry.rawName] || '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number, name: string) => [value, name]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div ref={barRef} className="bg-white rounded-xl p-4 border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Activity (Last 14 Days)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dayData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#6b7280' }} interval={1} />
                  <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} fill={DAY_COLOR} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent entry preview table */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Recent Entries (preview)</h3>
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    {['Timestamp', 'Action', 'Performed By', 'Description'].map(h => (
                      <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
                  {logs.slice(0, 8).map(l => (
                    <tr key={l.id}>
                      <td className="py-2 px-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{new Date(l.timestamp).toLocaleString()}</td>
                      <td className="py-2 px-3">
                        <span className="text-xs font-semibold" style={{ color: ACTION_COLORS[l.action] || '#374151' }}>
                          {formatActionName(l.action)}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-gray-500 dark:text-gray-400 text-xs">{l.performedBy}</td>
                      <td className="py-2 px-3 text-gray-900 dark:text-white max-w-[240px] truncate">{l.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {logs.length > 8 && (
                <p className="text-center text-xs text-gray-400 py-2 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
                  +{logs.length - 8} more rows in the exported Excel file
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
