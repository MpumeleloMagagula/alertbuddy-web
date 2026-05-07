import { useState, useEffect } from 'react';
import { UserCheck, Clock, ArrowRight, Calendar, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';
import firebase from '../services/firebase';
import type { StandbyInfo, HandoverLog, TeamMember } from '../types';

export default function Standby() {
  const [standbyInfo, setStandbyInfo] = useState<StandbyInfo | null>(null);
  const [handoverLogs, setHandoverLogs] = useState<HandoverLog[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPerformingHandover, setIsPerformingHandover] = useState(false);
  const [selectedMember, setSelectedMember] = useState<string>('');

  useEffect(() => {
    loadStandbyData();
    
    // Subscribe to real-time updates
    const unsubscribeTeam = firebase.onTeamMembersChange((members) => {
      setTeamMembers(members);
    });

    const unsubscribeLogs = firebase.onHandoverLogsChange((logs) => {
      setHandoverLogs(logs);
    }, 10);

    return () => {
      unsubscribeTeam();
      unsubscribeLogs();
    };
  }, []);

  const loadStandbyData = async () => {
    try {
      setIsLoading(true);
      const standby = await api.getCurrentStandby();
      setStandbyInfo(standby);
    } catch (error) {
      console.error('Failed to load standby data:', error);
      toast.error('Failed to load standby data');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePerformHandover = async () => {
    if (!selectedMember) {
      toast.error('Please select a team member');
      return;
    }

    const member = teamMembers.find(m => m.id === selectedMember);
    if (!member) {
      toast.error('Selected member not found');
      return;
    }

    try {
      setIsPerformingHandover(true);
      const currentUser = firebase.getCurrentUser();
      await api.updateStandby(
        member.email,
        member.displayName,
        currentUser?.email || 'admin'
      );
      toast.success(`Standby handed over to ${member.displayName}`);
      setSelectedMember('');
      await loadStandbyData();
    } catch (error) {
      console.error('Failed to perform handover:', error);
      toast.error('Failed to perform handover');
    } finally {
      setIsPerformingHandover(false);
    }
  };

  const handleClearStandby = async () => {
    if (!confirm('Are you sure you want to clear the standby assignment?')) {
      return;
    }

    try {
      await api.clearStandby();
      toast.success('Standby cleared');
      await loadStandbyData();
    } catch (error) {
      console.error('Failed to clear standby:', error);
      toast.error('Failed to clear standby');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading standby information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Altron Standby Management</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Manage on-call rotation and handovers</p>
        </div>
        <button onClick={loadStandbyData} className="btn-secondary flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Current Standby Status */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Current Standby</h2>
        
        {standbyInfo?.onStandby ? (
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <UserCheck className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{standbyInfo.displayName}</p>
                <p className="text-gray-600 dark:text-gray-400 mt-1">{standbyInfo.email}</p>
                <div className="flex items-center gap-4 mt-3 text-sm">
                  <span className={`badge ${standbyInfo.tokenResolved ? 'badge-success' : 'badge-warning'}`}>
                    Token: {standbyInfo.tokenResolved ? 'Resolved' : 'Pending'}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    Updated {new Date(standbyInfo.updatedAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={handleClearStandby}
              className="btn-danger"
            >
              Clear Standby
            </button>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserCheck className="w-8 h-8 text-gray-400 dark:text-gray-600" />
            </div>
            <p className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No one on standby</p>
            <p className="text-gray-600 dark:text-gray-400">Assign someone below to start receiving alerts</p>
          </div>
        )}
      </div>

      {/* Perform Handover */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Perform Handover</h2>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="member-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Team Member
            </label>
            <select
              id="member-select"
              value={selectedMember}
              onChange={(e) => setSelectedMember(e.target.value)}
              className="input"
              disabled={isPerformingHandover}
            >
              <option value="">-- Choose a team member --</option>
              {teamMembers
                .filter(m => m.standbyStatus === 'AVAILABLE')
                .map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.displayName} ({member.email}) - {member.role}
                  </option>
                ))}
            </select>
          </div>

          <button
            onClick={handlePerformHandover}
            disabled={!selectedMember || isPerformingHandover}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPerformingHandover ? 'Processing...' : 'Perform Handover'}
          </button>
        </div>

        {teamMembers.filter(m => m.standbyStatus === 'AVAILABLE').length === 0 && (
          <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              No team members available for standby. Make sure team members are added in Firebase.
            </p>
          </div>
        )}
      </div>

      {/* Handover History */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Recent Handovers</h2>
        
        {handoverLogs.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Clock className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-600" />
            <p>No handover history yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {handoverLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-900 dark:text-white">{log.fromUserName}</span>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                    <span className="font-semibold text-gray-900 dark:text-white">{log.toUserName}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                    <span>{new Date(log.handoverAt).toLocaleString()}</span>
                    {log.notes && (
                      <>
                        <span>•</span>
                        <span>{log.notes}</span>
                      </>
                    )}
                    {log.pendingAlertsCount > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-orange-600">
                          {log.pendingAlertsCount} pending alerts
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

      {/* Shift Schedule */}
      <div className="card bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/50">
        <div className="flex items-start gap-3">
          <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-1" />
          <div>
            <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">Shift Scheduling</h3>
            <p className="text-sm text-blue-800 dark:text-blue-400 mb-3">
              Automate standby assignments by creating a weekly rotation schedule.
            </p>
            <button className="btn-secondary text-sm">
              Manage Shifts
            </button>
          </div>
        </div>
      </div>

      {/* Info box */}
      <div className="card bg-primary-50 dark:bg-primary-900/10 border-primary-200 dark:border-primary-800/50">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <UserCheck className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div className="text-sm text-primary-900 dark:text-primary-300">
            <p className="font-semibold mb-1 text-primary-950 dark:text-primary-200">How Standby Works</p>
            <ul className="space-y-1 list-disc list-inside text-primary-800 dark:text-primary-400">
              <li>Only one person can be on standby at a time</li>
              <li>All critical alerts are routed to the on-standby person</li>
              <li>If no one is on standby, alerts broadcast to all devices</li>
              <li>Token must be resolved (user must have opened the app) to receive alerts</li>
              <li>Handover history is tracked for accountability</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
