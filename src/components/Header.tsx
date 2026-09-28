import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, LogOut, Settings, Radio, AlertTriangle, Key } from 'lucide-react';
import { getAutumnAvatarUrl } from '../utils/autumn';

export type ActiveTab = 'overview' | 'users' | 'servers' | 'bots' | 'communication' | 'lookup' | 'bans' | 'reports' | 'content' | 'audit' | 'node';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenSettings: () => void;
  reportCount?: number;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, onOpenSettings, reportCount = 0 }) => {
  const { currentUser, isPrivileged, logout, apiConfig, isImpersonating, stopImpersonating } = useAuth();

  const navItems: { id: ActiveTab; label: string; badge?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'users', label: 'Users & Badges' },
    { id: 'servers', label: 'Servers' },
    { id: 'bots', label: 'Bots' },
    { id: 'communication', label: 'Announcements' },
    { id: 'lookup', label: 'Universal Lookup' },
    { id: 'bans', label: 'Platform Bans' },
    { id: 'reports', label: 'Safety Reports', badge: reportCount },
    { id: 'content', label: 'Content' },
    { id: 'audit', label: 'Platform Audit Logs' },
    { id: 'node', label: 'MongoDB & Node' },
  ];

  return (
    <>
      {isImpersonating && (
        <div className="bg-amber-500 text-neutral-950 px-6 py-2 text-xs font-semibold flex flex-wrap items-center justify-between gap-3 shadow-md z-40 sticky top-0">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 shrink-0 text-neutral-950" />
            <span>
              <strong>Active Impersonation:</strong> Operating as user{' '}
              <strong className="font-mono">@{currentUser?.username}#{currentUser?.discriminator}</strong>{' '}
              ({currentUser?._id}). All platform actions reflect this user.
            </span>
          </div>
          <button
            onClick={() => stopImpersonating()}
            className="px-3 py-1 bg-neutral-950 text-white rounded text-[11px] font-bold hover:bg-neutral-900 transition-colors shadow"
          >
            Exit Impersonation &amp; Return to Administrator
          </button>
        </div>
      )}

      <header className={`sticky ${isImpersonating ? 'top-8' : 'top-0'} z-30 flex items-center justify-between px-6 py-3 border-b border-neutral-800 bg-neutral-950/90 backdrop-blur-md`}>
        {/* Zone 1: Single text element wordmark with brand identity */}
      <div className="flex items-center gap-4 shrink-0">
        <a
          href="#dashboard"
          onClick={(e) => { e.preventDefault(); setActiveTab('overview'); }}
          className="flex items-center gap-2.5 text-slate-100 group"
        >
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-base transition-colors group-hover:bg-amber-500/20 group-hover:border-amber-500/50">
            D
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight text-white leading-tight">
              DawnChat <span className="text-amber-400 font-normal">Console</span>
            </span>
            <span className="text-[10px] text-neutral-400 leading-none">
              Stoat Instance Admin
            </span>
          </div>
        </a>
      </div>

      {/* Zone 2: Navigation Links */}
      <nav className="hidden md:flex items-center gap-1 bg-neutral-900/60 p-1 rounded-lg border border-neutral-800">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === item.id
                ? 'bg-neutral-800 text-white shadow-sm border border-neutral-700/60'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
            }`}
          >
            <span>{item.label}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-[10px] text-white font-bold leading-none">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Zone 3: Primary Actions, Instance Info & User Profile */}
      <div className="flex items-center gap-3">
        <div className="hidden lg:flex items-center gap-2 text-xs text-neutral-400 px-2.5 py-1 rounded-md bg-neutral-900 border border-neutral-800/80">
          <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span className="font-mono text-[11px] text-neutral-300 truncate max-w-[140px]" title={apiConfig.baseUrl}>
            {apiConfig.baseUrl.replace(/^https?:\/\//, '')}
          </span>
          {apiConfig.isDemo && (
            <span className="text-[10px] text-amber-400 font-mono">DEMO</span>
          )}
        </div>

        {currentUser && (
          <div className="flex items-center gap-2 pl-2 border-l border-neutral-800">
            <div className="flex items-center gap-2 text-right">
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-neutral-200 truncate max-w-[120px]">
                    {currentUser.display_name || currentUser.username}
                  </span>
                  {isPrivileged && (
                    <span title="Administrator (privileged: true)" className="text-amber-400">
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-mono text-neutral-400">
                  @{currentUser.username}#{currentUser.discriminator}
                </span>
              </div>
              <div className="w-7 h-7 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-xs font-medium text-neutral-300 overflow-hidden">
                {currentUser.avatar ? (
                  <img
                    src={getAutumnAvatarUrl(currentUser.avatar._id, currentUser.avatar.filename)}
                    alt={currentUser.username}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback to initial
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  currentUser.username.slice(0, 2).toUpperCase()
                )}
              </div>
            </div>

            <button
              onClick={onOpenSettings}
              title="API & Instance Settings"
              className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/80 rounded-md transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
    </>
  );
};
