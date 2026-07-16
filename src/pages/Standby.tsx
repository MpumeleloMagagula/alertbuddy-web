import { useState, useEffect, useMemo } from 'react';
import { UserCheck, Clock, ArrowRight, AlertCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';
import firebase from '../services/firebase';
import type { StandbyInfo, HandoverLog } from '../types';

interface RegisteredUser {
  email: string;
  displayName: string;  // derived from email or deviceName
  deviceLabel: string;  // e.g. "Pixel 8 · Samsung"
  lastSeen: number;
}

function nameFromEmail(email: string): string {
  const local = email.split('@')[0];
  return local
    .replace(/[._-]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export default function Standby() {
  const [standbyInfo, setStandbyInfo] = useState<StandbyInfo | null>(null);
  const [handoverLogs, setHandoverLogs] = useState<HandoverLog[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [selectedEmail, setSelectedEmail] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    // API calls on mount so the page has data immediately, even when
    // Firestore client-side listeners are blocked (e.g. by an ad blocker)
    api.getCurrentStandby().then(s => setStandbyInfo(s)).catch(() => {
      setStandbyInfo({ onStandby: false, tokenResolved: false, updatedAt: 0 });
    });
    api.getDevices().then(devs => setDevices(devs)).catch(() => {});
    api.getHandoverHistory(15).then(logs => setHandoverLogs(logs)).catch(() => {});

    // Real-time Firestore listeners — will override the API data when they connect
    const unsubStandby = firebase.onStandbyChange((info) => {
      setStandbyInfo(info as StandbyInfo);
    });
    const unsubLogs = firebase.onHandoverLogsChange((logs) => {
      setHandoverLogs(logs);
    }, 15);
    const unsubDevices = firebase.onDevicesChange((devs) => {
      setDevices(devs);
    });

    return () => { unsubStandby(); unsubLogs(); unsubDevices(); };
  }, []);

  // Deduplicate by email — one entry per person, most recently seen device
  const registeredUsers = useMemo<RegisteredUser[]>(() => {
    const byEmail = new Map<string, RegisteredUser>();
    devices.forEach(d => {
      const email = d.email as string;
      if (!email) return;
      const existing = byEmail.get(email);
      const lastSeen = (d.lastSeen as number) ?? 0;
      if (!existing || lastSeen > existing.lastSeen) {
        const parts = [d.deviceName, d.manufacturer].filter(Boolean);
        byEmail.set(email, {
          email,
          displayName: nameFromEmail(email),
          deviceLabel: parts.length ? parts.join(' · ') : 'Unknown device',
          lastSeen,
        });
      }
    });
    return Array.from(byEmail.values()).sort((a, b) => b.lastSeen - a.lastSeen);
  }, [devices]);

  const handleAssign = async () => {
    if (!selectedEmail) { toast.error('Select a team member first'); return; }
    const user = registeredUsers.find(u => u.email === selectedEmail);
    if (!user) return;

    try {
      setIsAssigning(true);
      const result = await api.updateStandby(user.email, user.displayName, firebase.getCurrentUser()?.email ?? '', handoverNotes || undefined);
      // Optimistic update so UI reflects assignment immediately, even if onSnapshot is slow
      setStandbyInfo({
        onStandby: true,
        email: user.email,
        displayName: user.displayName,
        tokenResolved: (result as any)?.tokenResolved ?? false,
        updatedAt: Date.now(),
      });
      // Re-fetch from backend after a short delay to confirm the Firestore write landed
      setTimeout(() => { api.getCurrentStandby().then(s => setStandbyInfo(s)).catch(() => {}); }, 1500);
      toast.success(`${user.displayName} is now on standby`);
      setSelectedEmail('');
      setHandoverNotes('');
    } catch {
      toast.error('Failed to assign standby');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleClear = async () => {
    if (!confirm('Remove the current standby assignment?')) return;
    try {
      setIsClearing(true);
      await api.clearStandby();
      // Optimistic update
      setStandbyInfo({ onStandby: false, tokenResolved: false, updatedAt: Date.now() });
      toast.success('Standby cleared');
    } catch {
      toast.error('Failed to clear standby');
    } finally {
      setIsClearing(false);
    }
  };

  const standbyUser = standbyInfo?.onStandby
    ? registeredUsers.find(u => u.email === standbyInfo.email)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Standby Management</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Manage who is on call, updates in real time</p>
      </div>

      {/* Current standby */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Currently On Standby</h2>

        {standbyInfo === null ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : standbyInfo.onStandby ? (
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                <UserCheck className="w-7 h-7 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {standbyInfo.displayName}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{standbyInfo.email}</p>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <span className={`badge ${standbyInfo.tokenResolved ? 'badge-success' : 'badge-warning'}`}>
                    {standbyInfo.tokenResolved ? '✓ App connected' : '⏳ Waiting for app'}
                  </span>
                  {standbyUser && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                      {standbyUser.deviceLabel}
                    </span>
                  )}
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    Since {new Date(standbyInfo.updatedAt).toLocaleString([], {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
                {!standbyInfo.tokenResolved && (
                  <p className="mt-2 text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Ask {standbyInfo.displayName} to open the Alert Buddy app to resolve their token
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleClear}
              disabled={isClearing}
              className="btn-secondary text-sm flex items-center gap-1.5 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0"
            >
              <X className="w-4 h-4" />
              {isClearing ? 'Clearing…' : 'Clear'}
            </button>
          </div>
        ) : (
          <div className="text-center py-10">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserCheck className="w-8 h-8 text-gray-400 dark:text-gray-600" />
            </div>
            <p className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Nobody on standby</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Alerts will broadcast to all devices until someone is assigned
            </p>
          </div>
        )}
      </div>

      {/* Assign / handover */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
          {standbyInfo?.onStandby ? 'Hand Over To' : 'Assign Standby'}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Only team members who have the app installed and signed in appear here
        </p>

        {registeredUsers.length === 0 ? (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-800 dark:text-yellow-300">
            No registered devices yet. Team members need to install the Alert Buddy app and sign in, they'll appear here automatically.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-2">
              {registeredUsers.map(user => (
                <button
                  key={user.email}
                  type="button"
                  onClick={() => setSelectedEmail(selectedEmail === user.email ? '' : user.email)}
                  disabled={standbyInfo?.onStandby && standbyInfo.email === user.email}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    selectedEmail === user.email
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                      {user.displayName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{user.displayName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{user.deviceLabel}</p>
                  </div>
                  {standbyInfo?.onStandby && standbyInfo.email === user.email && (
                    <span className="badge badge-success text-xs flex-shrink-0">On standby</span>
                  )}
                  {selectedEmail === user.email && (
                    <span className="w-4 h-4 rounded-full bg-primary-600 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={handoverNotes}
              onChange={e => setHandoverNotes(e.target.value)}
              placeholder="Handover notes (optional)"
              className="input text-sm"
            />

            <button
              type="button"
              onClick={handleAssign}
              disabled={!selectedEmail || isAssigning}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAssigning
                ? 'Assigning…'
                : standbyInfo?.onStandby
                  ? `Hand over to ${registeredUsers.find(u => u.email === selectedEmail)?.displayName ?? 'selected'}`
                  : `Assign ${registeredUsers.find(u => u.email === selectedEmail)?.displayName ?? 'selected'} to standby`}
            </button>
          </div>
        )}
      </div>

      {/* Handover history */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Handover History</h2>

        {handoverLogs.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Clock className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-700" />
            <p className="text-sm">No handovers yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {handoverLogs.map(log => (
              <div
                key={log.id}
                className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold text-gray-900 dark:text-white">{log.fromUserName}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="font-semibold text-gray-900 dark:text-white">{log.toUserName}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                    <span>{new Date(log.handoverAt).toLocaleString()}</span>
                    {log.notes && <><span>·</span><span>{log.notes}</span></>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="card bg-primary-50 dark:bg-primary-900/10 border-primary-200 dark:border-primary-800/50">
        <div className="flex gap-3 text-sm text-primary-900 dark:text-primary-300">
          <UserCheck className="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-1 text-primary-950 dark:text-primary-200">How standby works</p>
            <ul className="space-y-1 list-disc list-inside text-primary-800 dark:text-primary-400">
              <li>Only the standby person receives alerts, everyone else's phone stays quiet</li>
              <li>If nobody is on standby, alerts broadcast to all registered devices</li>
              <li>Team members appear here automatically once they sign into the app</li>
              <li>Every handover is logged for accountability</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
