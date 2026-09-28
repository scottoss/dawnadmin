import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, KeyRound, Mail, Lock, Server, ArrowRight, ShieldAlert, Sparkles } from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const {
    loginWithCredentials,
    loginWithToken,
    submitMfa,
    mfaTicket,
    isLoading,
    error,
    apiConfig,
    updateApiConfig
  } = useAuth();

  const [authMode, setAuthMode] = useState<'credentials' | 'token'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [customBaseUrl, setCustomBaseUrl] = useState(apiConfig.baseUrl);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mfaTicket) {
      await submitMfa(mfaCode);
      return;
    }

    if (authMode === 'credentials') {
      if (!email.trim() || !password.trim()) return;
      await loginWithCredentials(email.trim(), password.trim());
    } else {
      if (!sessionToken.trim()) return;
      await loginWithToken(sessionToken.trim());
    }
  };

  const handleSaveEndpoint = () => {
    updateApiConfig({ baseUrl: customBaseUrl.trim() });
    setShowConfig(false);
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background visual accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md z-10">
        {/* Brand identity header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-3 shadow-lg shadow-amber-500/5">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            DawnChat <span className="text-amber-400 font-normal">Admin Console</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1 max-w-xs mx-auto">
            Management & moderation dashboard for self-hosted StoatChat instance
          </p>

          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-neutral-400">
            <span className="font-mono text-neutral-300">{apiConfig.baseUrl}</span>
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="text-amber-400 hover:text-amber-300 underline underline-offset-2 text-[11px]"
            >
              Change
            </button>
          </div>
        </div>

        {/* Custom Endpoint Drawer */}
        {showConfig && (
          <div className="mb-4 p-3 bg-neutral-900 border border-neutral-800 rounded-lg text-xs">
            <label className="block text-neutral-300 font-medium mb-1">
              DawnChat API Base URL:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customBaseUrl}
                onChange={(e) => setCustomBaseUrl(e.target.value)}
                placeholder="https://api.dawn-chat.com"
                className="flex-1 bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-amber-500 font-mono"
              />
              <button
                onClick={handleSaveEndpoint}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded text-xs transition-colors"
              >
                Apply
              </button>
            </div>
            <p className="text-[10px] text-neutral-400 mt-1.5">
              Client web app is hosted at: <span className="font-mono text-neutral-300">https://chat.dawn-chat.com</span>
            </p>
          </div>
        )}

        {/* Main Card */}
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-6 shadow-2xl backdrop-blur-sm">
          {/* Permission Requirement Notice */}
          <div className="mb-5 p-3 rounded-lg bg-neutral-950/80 border border-amber-500/20 flex gap-3 text-xs text-neutral-300">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-amber-300">Privileged Access Only: </span>
              Access requires your user document in MongoDB to have{' '}
              <code className="px-1 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-amber-300 font-mono text-[11px]">
                privileged: true
              </code>.
            </div>
          </div>

          {/* MFA Challenge Mode */}
          {mfaTicket ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800">
                <span className="text-xs font-semibold text-neutral-200 block mb-1">
                  Two-Factor Authentication Required
                </span>
                <p className="text-xs text-neutral-400 mb-3">
                  Enter the 6-digit TOTP verification code from your authenticator app.
                </p>
                <input
                  type="text"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  placeholder="000000"
                  maxLength={10}
                  autoFocus
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-center text-lg font-mono tracking-widest text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {error && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !mfaCode.trim()}
                className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 disabled:bg-neutral-800 disabled:text-neutral-500 text-neutral-950 font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? 'Verifying Ticket...' : 'Verify MFA & Continue'}
              </button>
            </form>
          ) : (
            <>
              {/* Method Switcher */}
              <div className="flex items-center gap-1 p-1 bg-neutral-950 rounded-lg border border-neutral-800 mb-5">
                <button
                  type="button"
                  onClick={() => setAuthMode('credentials')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                    authMode === 'credentials'
                      ? 'bg-neutral-800 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  Account Login
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('token')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                    authMode === 'token'
                      ? 'bg-neutral-800 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  Session Token
                </button>
              </div>

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {authMode === 'credentials' ? (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="admin@dawn-chat.com"
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                        Password
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
                        <input
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                      Session Token (x-session-token)
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
                      <input
                        type="password"
                        required
                        value={sessionToken}
                        onChange={(e) => setSessionToken(e.target.value)}
                        placeholder="Paste existing Stoat token..."
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-white placeholder:text-neutral-600 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <p className="text-[11px] text-neutral-500 mt-1">
                      Token can be retrieved from existing DawnChat client session headers.
                    </p>
                  </div>
                )}

                {error && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 disabled:bg-neutral-800 disabled:text-neutral-500 text-neutral-950 font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-2 mt-2 shadow-lg shadow-amber-500/10"
                >
                  {isLoading ? (
                    'Verifying Privileges...'
                  ) : (
                    <>
                      Verify Permissions & Sign In
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Footer info */}
        <div className="text-center mt-6 text-xs text-neutral-400">
          DawnChat Console · Connected to <span className="font-mono text-neutral-400">api.dawn-chat.com</span>
        </div>
      </div>
    </div>
  );
};
