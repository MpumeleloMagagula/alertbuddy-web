import { useState, FormEvent } from 'react';
import { Mail, Lock, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import firebase from '../services/firebase';
import logo from '../assets/alert_buddy.png';
import type { MultiFactorResolver } from 'firebase/auth';


export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Second-factor challenge state — set only when the account has TOTP MFA enrolled
  const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error('Please enter email and password');
      return;
    }

    try {
      setIsLoading(true);
      await firebase.login(email, password);
      toast.success('Login successful');
    } catch (error: any) {
      if (firebase.isMfaRequiredError(error)) {
        const resolver = firebase.getMfaResolver(error);
        if (firebase.hasTotpHint(resolver)) {
          setMfaResolver(resolver);
        } else {
          toast.error('This account requires a second factor that this portal does not support yet');
        }
        return;
      }
      console.error('Login error:', error);
      const errorMessage = error.code === 'auth/invalid-credential'
        ? 'Invalid email or password'
        : error.message || 'Failed to login';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!mfaResolver || mfaCode.length !== 6) return;

    try {
      setIsVerifying(true);
      await firebase.resolveTotpSignIn(mfaResolver, mfaCode);
      toast.success('Login successful');
    } catch (error: any) {
      console.error('MFA verification error:', error);
      toast.error(error.code === 'auth/invalid-verification-code' ? 'Invalid code — try again' : 'Verification failed');
      setMfaCode('');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary-800/20 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo and branding */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-28 h-28 bg-white rounded-2xl border border-white/10 shadow-2xl mb-6 overflow-hidden">
            <img src={logo} alt="Alert Buddy Logo" className="w-full h-full object-cover scale-110" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight mb-2">
            Alert <span className="text-primary-500">Buddy</span>
          </h1>
          <p className="text-gray-400 font-medium">Critical Alert Management Portal</p>
        </div>

        {/* Login card */}
        <div className="bg-white/10 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] p-8 md:p-10">
          {mfaResolver ? (
            <>
              <h2 className="text-2xl font-bold text-white mb-2">Two-Factor Verification</h2>
              <p className="text-gray-400 text-sm mb-8">Enter the 6-digit code from your authenticator app</p>

              <form onSubmit={handleVerifyCode} className="space-y-6">
                <div>
                  <label htmlFor="mfa-code" className="block text-sm font-semibold text-gray-300 mb-2 ml-1">
                    Authentication Code
                  </label>
                  <div className="relative group">
                    <KeyRound className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-primary-400 transition-colors" />
                    <input
                      id="mfa-code"
                      type="text"
                      inputMode="numeric"
                      autoFocus
                      maxLength={6}
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                      className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all tracking-[0.3em] text-center text-lg"
                      placeholder="000000"
                      disabled={isVerifying}
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isVerifying || mfaCode.length !== 6}
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white py-4 rounded-xl text-lg font-bold shadow-lg shadow-primary-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
                >
                  {isVerifying ? 'Verifying...' : 'Verify'}
                </button>

                <button
                  type="button"
                  onClick={() => { setMfaResolver(null); setMfaCode(''); }}
                  className="w-full text-sm text-gray-400 hover:text-white transition-colors"
                >
                  ‹ Back to login
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-white mb-8">System Access</h2>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Email input */}
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-300 mb-2 ml-1">
                    Corporate Email
                  </label>
                  <div className="relative group">
                    <Mail className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-primary-400 transition-colors" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
                      placeholder="name@alertbuddy.com"
                      disabled={isLoading}
                      required
                    />
                  </div>
                </div>

                {/* Password input */}
                <div>
                  <label htmlFor="password" className="block text-sm font-semibold text-gray-300 mb-2 ml-1">
                    Access Token
                  </label>
                  <div className="relative group">
                    <Lock className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-primary-400 transition-colors" />
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
                      placeholder="••••••••"
                      disabled={isLoading}
                      required
                    />
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white py-4 rounded-xl text-lg font-bold shadow-lg shadow-primary-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Authenticating...' : 'Authorize Access'}
                </button>
              </form>
            </>
          )}

          {/* Additional info */}
          <div className="mt-10 pt-8 border-t border-white/5 text-center">
            <p className="text-gray-500 text-sm font-medium">Internal Alert Network Only</p>
            <p className="text-gray-600 text-xs mt-2 uppercase tracking-widest">Secured by Alert Buddy Ops</p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-10 text-gray-600 text-xs">
          <p>© 2026 Alert Buddy Infrastructure. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
