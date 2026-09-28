import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldX, RefreshCw, LogOut, Copy, Check, Terminal, ExternalLink } from 'lucide-react';

export const AccessDeniedScreen: React.FC = () => {
  const { currentUser, recheckPermissions, logout, isLoading } = useAuth();
  const [copied, setCopied] = useState(false);

  const mongoCommand = currentUser
    ? `db.users.updateOne({ _id: "${currentUser._id}" }, { $set: { privileged: true } })`
    : `db.users.updateOne({ username: "YOUR_USERNAME" }, { $set: { privileged: true } })`;

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(mongoCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        {/* Visual Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
            <ShieldX className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Access Restricted: Privileged Account Required
            </h1>
            <p className="text-xs text-neutral-400 mt-0.5">
              Permission verification failed for DawnChat Admin Console
            </p>
          </div>
        </div>

        {/* User Card */}
        {currentUser && (
          <div className="p-4 bg-neutral-950/80 rounded-xl border border-neutral-800/80 mb-6">
            <div className="flex items-center justify-between text-xs mb-3">
              <span className="text-neutral-400">Authenticated Account:</span>
              <span className="font-mono text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 text-[11px]">
                privileged: false
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-sm font-semibold text-neutral-200">
                {currentUser.username.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white truncate">
                  {currentUser.display_name || currentUser.username}
                </div>
                <div className="text-xs text-neutral-400 font-mono">
                  @{currentUser.username}#{currentUser.discriminator}
                </div>
              </div>
              <div className="text-right text-[11px] font-mono text-neutral-400">
                ID: <span className="text-neutral-300">{currentUser._id}</span>
              </div>
            </div>
          </div>
        )}

        {/* Technical Explanation */}
        <div className="space-y-4 text-xs text-neutral-300 mb-6">
          <p>
            Your account was successfully authenticated with the DawnChat REST API (<code className="font-mono text-neutral-200">api.dawn-chat.com</code>), but this management console is strictly restricted to platform administrators.
          </p>
          <p>
            In the Stoat / Revolt architecture, administrative privileges are governed by the{' '}
            <code className="px-1.5 py-0.5 bg-neutral-950 border border-neutral-800 rounded text-amber-300 font-mono">
              privileged: true
            </code>{' '}
            boolean field in the MongoDB <code className="text-neutral-200">users</code> collection.
          </p>
        </div>

        {/* MongoDB Command Helper */}
        <div className="mb-6 p-4 rounded-xl bg-neutral-950 border border-neutral-800">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-neutral-200">
              <Terminal className="w-3.5 h-3.5 text-amber-400" />
              Instance Host Fix (MongoDB Query)
            </div>
            <button
              onClick={handleCopyCommand}
              className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy Command</span>
                </>
              )}
            </button>
          </div>
          <div className="p-3 bg-black/60 rounded-lg border border-neutral-900 overflow-x-auto">
            <code className="text-[11px] font-mono text-amber-300 select-all">
              {mongoCommand}
            </code>
          </div>
          <p className="text-[10px] text-neutral-400 mt-2">
            Run this in your MongoDB shell on your host server to elevate your user account to administrator.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={recheckPermissions}
            disabled={isLoading}
            className="w-full sm:flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 disabled:bg-neutral-800 disabled:text-neutral-500 text-neutral-950 font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Checking MongoDB...' : 'Re-verify Privileges'}
          </button>

          <button
            onClick={logout}
            className="w-full sm:w-auto py-2.5 px-4 bg-neutral-950 hover:bg-neutral-800 text-neutral-300 hover:text-rose-400 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 border border-neutral-800"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>

        <div className="mt-6 pt-4 border-t border-neutral-800/80 text-center">
          <a
            href="https://chat.dawn-chat.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-300"
          >
            <span>Return to DawnChat Web Client (chat.dawn-chat.com)</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
