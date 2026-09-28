import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { stoatApi } from '../services/stoatApi';
import { Settings, Check, Copy, Activity, Shield, KeyRound, ExternalLink } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { apiConfig, updateApiConfig, sessionToken } = useAuth();
  const [baseUrl, setBaseUrl] = useState(apiConfig.baseUrl);
  const [clientUrl, setClientUrl] = useState(apiConfig.clientUrl);
  const [useProxy, setUseProxy] = useState(apiConfig.useProxy);
  const [isDemo, setIsDemo] = useState(apiConfig.isDemo);
  const [testResult, setTestResult] = useState<{ status: 'idle' | 'testing' | 'success' | 'error'; message?: string }>({ status: 'idle' });
  const [copiedToken, setCopiedToken] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    updateApiConfig({
      baseUrl: baseUrl.trim(),
      clientUrl: clientUrl.trim(),
      useProxy,
      isDemo,
    });
    onClose();
  };

  const handleTestConnection = async () => {
    setTestResult({ status: 'testing' });
    try {
      // Temporary test with typed baseUrl
      stoatApi.setBaseUrl(baseUrl.trim());
      stoatApi.setProxy(useProxy);
      const start = performance.now();
      const node = await stoatApi.queryNode();
      const latency = Math.round(performance.now() - start);

      setTestResult({
        status: 'success',
        message: `Successfully connected to Stoat v${node.stoat} (Revolt v${node.revolt}) in ${latency}ms!`,
      });
    } catch (err) {
      setTestResult({
        status: 'error',
        message: `Connection failed: ${(err as Error).message}`,
      });
    }
  };

  const handleCopyToken = () => {
    if (!sessionToken) return;
    navigator.clipboard.writeText(sessionToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Console & Instance Configuration</h3>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-300">
            ✕
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* Base URL */}
          <div>
            <label className="block text-neutral-300 font-medium mb-1">
              DawnChat Core REST API URL:
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.dawn-chat.com"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
            />
            <span className="text-[11px] text-neutral-500 mt-0.5 block">
              Default for your instance is <code className="text-neutral-300">https://api.dawn-chat.com</code>
            </span>
          </div>

          {/* Client Web URL */}
          <div>
            <label className="block text-neutral-300 font-medium mb-1">
              DawnChat Web Client URL:
            </label>
            <input
              type="text"
              value={clientUrl}
              onChange={(e) => setClientUrl(e.target.value)}
              placeholder="https://chat.dawn-chat.com"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* CORS Proxy toggle */}
          <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800 flex items-center justify-between">
            <div>
              <span className="text-neutral-200 font-medium block">CORS Relay Proxy</span>
              <span className="text-[11px] text-neutral-500">
                Routes API requests through server proxy to bypass strict browser origin headers.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={useProxy}
                onChange={(e) => setUseProxy(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          {/* Connection Test */}
          <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-neutral-200 font-medium">Test API Reachability</span>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testResult.status === 'testing'}
                className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-[11px] font-medium transition-colors"
              >
                {testResult.status === 'testing' ? 'Pinging...' : 'Test Connection'}
              </button>
            </div>
            {testResult.message && (
              <div
                className={`text-[11px] p-2 rounded ${
                  testResult.status === 'success'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                {testResult.message}
              </div>
            )}
          </div>

          {/* MongoDB Direct Settings */}
          <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800 space-y-2">
            <span className="text-neutral-200 font-medium block">Stoat Main MongoDB Target</span>
            <p className="text-[11px] text-neutral-400">
              Platform-wide bans and abuse reports write directly to MongoDB <code className="text-neutral-300">platform_bans</code>, <code className="text-neutral-300">safety_reports</code>, and update <code className="text-neutral-300">users.flags</code>.
            </p>
            <div className="text-[11px] text-neutral-400 font-mono">
              Database: <span className="text-amber-400">revolt</span>
            </div>
          </div>

          {/* Session Token Info */}
          {sessionToken && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-neutral-300 font-medium flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-neutral-400" />
                  Active Session Token:
                </label>
                <button
                  type="button"
                  onClick={handleCopyToken}
                  className="text-[11px] text-amber-400 hover:underline flex items-center gap-1"
                >
                  {copiedToken ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedToken ? 'Copied' : 'Copy Token'}</span>
                </button>
              </div>
              <input
                type="password"
                readOnly
                value={sessionToken}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-neutral-400 font-mono text-[11px] cursor-not-allowed select-all"
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 rounded-lg text-xs font-semibold"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};
