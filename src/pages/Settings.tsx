import { useState, useEffect, FormEvent } from 'react';
import {
  User as UserIcon, Shield, Bell, Palette, KeyRound, Monitor,
  Sun, Moon, Check, Loader2, Trash2, Volume2, Mail, ShieldCheck, Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import firebase from '../services/firebase';
import api from '../services/api';
import { useTheme, type ThemeMode } from '../contexts/ThemeContext';
import { isSoundEnabled, toggleSound } from '../utils/soundAlerts';
import {
  getBrowserNotificationPermission,
  isBrowserNotificationsEnabled,
  requestBrowserNotificationPermission,
  setBrowserNotificationsEnabled,
} from '../utils/browserNotifications';
import type { User, NotificationPreferences } from '../types';
import type { MultiFactorInfo, TotpSecret } from 'firebase/auth';

type Tab = 'profile' | 'security' | 'notifications' | 'appearance';

const TABS: { id: Tab; label: string; icon: typeof UserIcon }[] = [
  { id: 'profile',       label: 'Profile',       icon: UserIcon },
  { id: 'security',      label: 'Security',      icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'appearance',    label: 'Appearance',     icon: Palette },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const currentUser = firebase.getCurrentUser();
  const [profile, setProfile] = useState<User | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  useEffect(() => {
    if (!currentUser) { setIsLoadingProfile(false); return; }
    firebase.getUserById(currentUser.uid)
      .then(setProfile)
      .catch(() => {})
      .finally(() => setIsLoadingProfile(false));
  }, [currentUser?.uid]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Manage your profile, security, notifications, and appearance</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Tab list */}
        <nav className="md:w-56 flex-shrink-0">
          <ul className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
            {TABS.map(tab => (
              <li key={tab.id} className="flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Tab content */}
        <div className="flex-1 min-w-0">
          {activeTab === 'profile' && (
            <ProfileTab profile={profile} isLoading={isLoadingProfile} onSaved={setProfile} />
          )}
          {activeTab === 'security' && <SecurityTab />}
          {activeTab === 'notifications' && (
            <NotificationsTab profile={profile} onSaved={setProfile} />
          )}
          {activeTab === 'appearance' && <AppearanceTab />}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Profile
// ══════════════════════════════════════════════════════════════════════════

function ProfileTab({ profile, isLoading, onSaved }: {
  profile: User | null;
  isLoading: boolean;
  onSaved: (p: User) => void;
}) {
  const currentUser = firebase.getCurrentUser();
  const [displayName, setDisplayName] = useState('');
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.displayName ?? currentUser?.displayName ?? '');
    setDepartment(profile?.department ?? '');
    setPosition(profile?.position ?? '');
  }, [profile]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!displayName.trim()) { toast.error('Display name is required'); return; }

    try {
      setIsSaving(true);
      await api.updateUser(currentUser.uid, { displayName, department, position }, currentUser.email ?? undefined);
      onSaved({
        ...(profile ?? { id: currentUser.uid, email: currentUser.email ?? '', role: 'USER' as any, createdAt: Date.now(), isActive: true }),
        displayName, department, position,
      } as User);
      toast.success('Profile updated');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="card flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Profile</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Your personal details, as shown to other admins</p>

      <form onSubmit={handleSave} className="space-y-4 max-w-md">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
          <input type="email" value={currentUser?.email ?? ''} disabled className="input w-full opacity-60 cursor-not-allowed" />
        </div>

        {profile?.role && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Role</label>
            <span className="badge bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">{profile.role}</span>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Display Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            className="input w-full"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Department</label>
          <input type="text" value={department} onChange={e => setDepartment(e.target.value)} className="input w-full" placeholder="e.g. Infrastructure" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Position</label>
          <input type="text" value={position} onChange={e => setPosition(e.target.value)} className="input w-full" placeholder="e.g. Site Reliability Engineer" />
        </div>

        <button type="submit" disabled={isSaving} className="btn-primary flex items-center gap-2 disabled:opacity-50">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {isSaving ? 'Saving…' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Security — password + TOTP MFA
// ══════════════════════════════════════════════════════════════════════════

function SecurityTab() {
  return (
    <div className="space-y-6">
      <ChangePasswordCard />
      <MfaCard />
    </div>
  );
}

function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { toast.error('New password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }

    try {
      setIsSaving(true);
      await firebase.reauthenticate(currentPassword);
      await firebase.changePassword(newPassword);
      toast.success('Password updated');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.code === 'auth/invalid-credential' ? 'Current password is incorrect' : 'Failed to update password');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="card">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
        <KeyRound className="w-5 h-5 text-gray-500" /> Change Password
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Requires your current password to confirm the change</p>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Current Password</label>
          <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="input w-full" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">New Password</label>
          <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="input w-full" required minLength={6} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Confirm New Password</label>
          <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="input w-full" required minLength={6} />
        </div>
        <button type="submit" disabled={isSaving} className="btn-primary flex items-center gap-2 disabled:opacity-50">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {isSaving ? 'Updating…' : 'Update Password'}
        </button>
      </form>
    </div>
  );
}

function MfaCard() {
  const [factors, setFactors] = useState<MultiFactorInfo[]>([]);
  const [step, setStep] = useState<'idle' | 'confirm-password' | 'scan'>('idle');
  const [password, setPassword] = useState('');
  const [secret, setSecret] = useState<TotpSecret | null>(null);
  const [code, setCode] = useState('');
  const [removeTarget, setRemoveTarget] = useState<MultiFactorInfo | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => setFactors(firebase.getEnrolledFactors());
  useEffect(refresh, []);

  const beginEnroll = () => { setStep('confirm-password'); setPassword(''); };
  const beginRemove = (factor: MultiFactorInfo) => { setRemoveTarget(factor); setStep('confirm-password'); setPassword(''); };
  const cancel = () => { setStep('idle'); setPassword(''); setCode(''); setSecret(null); setRemoveTarget(null); };

  const handleConfirmPassword = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setBusy(true);
      await firebase.reauthenticate(password);

      if (removeTarget) {
        await firebase.unenrollFactor(removeTarget.uid);
        toast.success('Authenticator app removed');
        refresh();
        cancel();
        return;
      }

      const newSecret = await firebase.startTotpEnrollment();
      setSecret(newSecret);
      setStep('scan');
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        toast.error('Multi-factor authentication is not enabled for this project yet');
      } else if (err.code === 'auth/invalid-credential') {
        toast.error('Incorrect password');
      } else {
        toast.error('Failed to continue — please try again');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!secret || code.length !== 6) return;
    try {
      setBusy(true);
      await firebase.finishTotpEnrollment(secret, code, 'Authenticator app');
      toast.success('Authenticator app enabled');
      refresh();
      cancel();
    } catch (err: any) {
      toast.error(err.code === 'auth/invalid-verification-code' ? 'Invalid code — try again' : 'Verification failed');
    } finally {
      setBusy(false);
    }
  };

  const copySecret = async () => {
    if (!secret) return;
    await navigator.clipboard.writeText(secret.secretKey);
    toast.success('Secret key copied');
  };

  return (
    <div className="card">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-gray-500" /> Two-Factor Authentication
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Add an authenticator app (Google Authenticator, Authy, 1Password, etc.) as a second sign-in factor
      </p>

      {step === 'idle' && (
        <>
          {factors.length === 0 ? (
            <button type="button" onClick={beginEnroll} className="btn-primary text-sm">
              Enable Authenticator App
            </button>
          ) : (
            <div className="space-y-2">
              {factors.map(f => (
                <div key={f.uid} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{f.displayName || 'Authenticator app'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Enrolled {new Date(f.enrollmentTime).toLocaleDateString()}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => beginRemove(f)}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
            Requires TOTP multi-factor authentication to be enabled in your Firebase project
            (Console → Authentication → Sign-in method → Multi-factor authentication).
          </p>
        </>
      )}

      {step === 'confirm-password' && (
        <form onSubmit={handleConfirmPassword} className="space-y-3 max-w-sm">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {removeTarget ? 'Confirm your password to remove this authenticator.' : 'Confirm your password to continue.'}
          </p>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Current password"
            className="input w-full"
            required
          />
          <div className="flex gap-2">
            <button type="button" onClick={cancel} className="btn-secondary text-sm flex-1">Cancel</button>
            <button type="submit" disabled={busy} className="btn-primary text-sm flex-1 disabled:opacity-50">
              {busy ? 'Checking…' : 'Continue'}
            </button>
          </div>
        </form>
      )}

      {step === 'scan' && secret && (
        <form onSubmit={handleVerifyCode} className="space-y-4 max-w-sm">
          <div>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
              In your authenticator app, choose <strong>"Enter a setup key"</strong> and enter:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg break-all">{secret.secretKey}</code>
              <button type="button" onClick={copySecret} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" title="Copy">
                <Copy className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Enter the 6-digit code from the app
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              className="input w-full text-center tracking-[0.3em]"
              placeholder="000000"
              required
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={cancel} className="btn-secondary text-sm flex-1">Cancel</button>
            <button type="submit" disabled={busy || code.length !== 6} className="btn-primary text-sm flex-1 disabled:opacity-50">
              {busy ? 'Verifying…' : 'Verify & Enable'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Notifications
// ══════════════════════════════════════════════════════════════════════════

function NotificationsTab({ profile, onSaved }: { profile: User | null; onSaved: (p: User) => void }) {
  const currentUser = firebase.getCurrentUser();
  const [soundEnabled, setSoundEnabled] = useState(isSoundEnabled());
  const [browserPermission, setBrowserPermission] = useState(getBrowserNotificationPermission());
  const [browserEnabled, setBrowserEnabled] = useState(isBrowserNotificationsEnabled());
  const [emailOnStandby, setEmailOnStandby] = useState(profile?.notificationPreferences?.emailOnStandbyAssigned ?? true);
  const [isSavingEmailPref, setIsSavingEmailPref] = useState(false);

  useEffect(() => {
    setEmailOnStandby(profile?.notificationPreferences?.emailOnStandbyAssigned ?? true);
  }, [profile]);

  const handleToggleSound = () => setSoundEnabled(toggleSound());

  const handleToggleBrowser = async () => {
    if (browserPermission !== 'granted') {
      const permission = await requestBrowserNotificationPermission();
      setBrowserPermission(permission);
      setBrowserEnabled(permission === 'granted');
      if (permission === 'denied') {
        toast.error('Notifications blocked — enable them for this site in your browser settings');
      }
      return;
    }
    const next = !browserEnabled;
    setBrowserNotificationsEnabled(next);
    setBrowserEnabled(next);
  };

  const handleToggleEmailOnStandby = async () => {
    if (!currentUser) return;
    const next = !emailOnStandby;
    setEmailOnStandby(next);
    try {
      setIsSavingEmailPref(true);
      const prefs: NotificationPreferences = { emailOnStandbyAssigned: next };
      await api.updateUser(currentUser.uid, { notificationPreferences: prefs }, currentUser.email ?? undefined);
      onSaved({ ...(profile as User), notificationPreferences: prefs });
    } catch {
      setEmailOnStandby(!next);
      toast.error('Failed to save preference');
    } finally {
      setIsSavingEmailPref(false);
    }
  };

  return (
    <div className="card space-y-1">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Notifications</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Control how this portal gets your attention</p>

      <ToggleRow
        icon={Volume2}
        label="Sound Alerts"
        description="Play a tone in this tab when a new alert arrives"
        enabled={soundEnabled}
        onToggle={handleToggleSound}
      />

      <ToggleRow
        icon={Monitor}
        label="Desktop Notifications"
        description={
          browserPermission === 'denied'
            ? 'Blocked by your browser — enable notifications for this site to use this'
            : browserPermission === 'unsupported'
            ? 'Not supported in this browser'
            : 'Show a system notification when a new alert arrives while this tab is open'
        }
        enabled={browserEnabled}
        onToggle={handleToggleBrowser}
        disabled={browserPermission === 'denied' || browserPermission === 'unsupported'}
      />

      <ToggleRow
        icon={Mail}
        label="Email Me When Assigned to Standby"
        description="Get an email whenever you're put on standby"
        enabled={emailOnStandby}
        onToggle={handleToggleEmailOnStandby}
        disabled={isSavingEmailPref}
      />
    </div>
  );
}

function ToggleRow({ icon: Icon, label, description, enabled, onToggle, disabled }: {
  icon: typeof Bell;
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <div className="flex items-start gap-3 min-w-0">
        <Icon className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={disabled}
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
          enabled ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`} />
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Appearance
// ══════════════════════════════════════════════════════════════════════════

function AppearanceTab() {
  const { themeMode, setThemeMode } = useTheme();

  const options: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
    { mode: 'light',  label: 'Light',  icon: Sun },
    { mode: 'dark',   label: 'Dark',   icon: Moon },
    { mode: 'system', label: 'System', icon: Monitor },
  ];

  return (
    <div className="card">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Appearance</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Choose how Alert Buddy looks on this device</p>

      <div className="grid grid-cols-3 gap-3 max-w-md">
        {options.map(opt => (
          <button
            key={opt.mode}
            type="button"
            onClick={() => setThemeMode(opt.mode)}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
              themeMode === opt.mode
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700'
            }`}
          >
            <opt.icon className={`w-6 h-6 ${themeMode === opt.mode ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`} />
            <span className={`text-sm font-medium ${themeMode === opt.mode ? 'text-primary-700 dark:text-primary-400' : 'text-gray-600 dark:text-gray-400'}`}>
              {opt.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
