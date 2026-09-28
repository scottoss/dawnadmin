import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ActiveTab } from './Header';
import {
  ShieldCheck,
  Search,
  UserX,
  Trash2,
  FileText,
  Activity,
  Server,
  Users,
  Radio,
  ExternalLink,
  ArrowRight,
  Globe,
  AlertTriangle,
  Database,
  Bot,
  Megaphone,
  Sparkles
} from 'lucide-react';

interface OverviewViewProps {
  setActiveTab: (tab: ActiveTab) => void;
  reportCount?: number;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ setActiveTab, reportCount = 0 }) => {
  const { currentUser, apiConfig } = useAuth();

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-900 to-amber-950/30 border border-neutral-800 rounded-2xl p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 z-10 relative">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[11px] font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                PRIVILEGED SESSION VERIFIED
              </span>
              <span className="text-xs text-neutral-500">·</span>
              <span className="text-xs text-neutral-400 font-mono">
                {apiConfig.baseUrl.replace(/^https?:\/\//, '')}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Welcome, {currentUser?.display_name || currentUser?.username}
            </h1>
            <p className="text-xs text-neutral-400 max-w-xl">
              DawnChat administrative suite active. Manage servers, bot tokens, broadcast system announcements, triage user safety reports, and inspect any entity ID.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={apiConfig.clientUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 bg-neutral-950 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <span>Open Web Chat</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={() => setActiveTab('lookup')}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-lg shadow-amber-500/10"
            >
              <Search className="w-3.5 h-3.5" />
              Universal ID Lookup
            </button>
          </div>
        </div>
      </div>

      {/* Quick Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
            <span>Core REST API</span>
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          </div>
          <span className="text-sm font-bold text-white font-mono block truncate">
            {apiConfig.baseUrl}
          </span>
          <span className="text-[10px] text-emerald-400 mt-1 block">Operational · Online</span>
        </div>

        <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
            <span>Primary Client</span>
            <ExternalLink className="w-3.5 h-3.5 text-neutral-500" />
          </div>
          <span className="text-sm font-bold text-white font-mono block truncate">
            {apiConfig.clientUrl}
          </span>
          <span className="text-[10px] text-neutral-400 mt-1 block">DawnChat Web UI</span>
        </div>

        <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
            <span>Open Safety Reports</span>
            <span className="text-amber-400 font-mono text-[10px]">QUEUE</span>
          </div>
          <span className="text-xl font-bold text-white font-mono block tabular-nums">
            {reportCount}
          </span>
          <span className="text-[10px] text-neutral-400 mt-1 block">
            Needs moderator triage
          </span>
        </div>

        <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
            <span>Main Stoat MongoDB</span>
            <Database className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <span className="text-sm font-bold text-white block">
            revolt Database
          </span>
          <span className="text-[10px] text-neutral-400 mt-1 block">Direct driver connection active</span>
        </div>
      </div>

      {/* Feature Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card: Servers Management */}
        <div
          onClick={() => setActiveTab('servers')}
          className="p-5 bg-neutral-900 border border-neutral-800 hover:border-amber-500/40 rounded-xl transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
                Servers &amp; Communities
              </h3>
              <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                List and edit all servers in MongoDB. Manage official and verified flags, view owner details, and inspect channel/member metrics.
              </p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs text-amber-400 font-medium">
            <span>Manage Servers</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Card: Bots Management */}
        <div
          onClick={() => setActiveTab('bots')}
          className="p-5 bg-neutral-900 border border-neutral-800 hover:border-indigo-500/40 rounded-xl transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">
                Bots &amp; API Integrations
              </h3>
              <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                Inspect registered bots in MongoDB. Reset bot authentication tokens, modify public discoverability, and view bot owners.
              </p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs text-indigo-400 font-medium">
            <span>Manage Bots</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Card: Announcements & Broadcast */}
        <div
          onClick={() => setActiveTab('communication')}
          className="p-5 bg-neutral-900 border border-neutral-800 hover:border-amber-500/40 rounded-xl transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
                Announcements &amp; Broadcast
              </h3>
              <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                Dispatch system messages to all platform users or select specific accounts using official instance bots.
              </p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs text-amber-400 font-medium">
            <span>Send Announcement</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Card: Universal ID Lookup */}
        <div
          onClick={() => setActiveTab('lookup')}
          className="p-5 bg-neutral-900 border border-neutral-800 hover:border-amber-500/40 rounded-xl transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
                Universal ID Inspector
              </h3>
              <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                Probe any 26-character Stoat ID. Detects Users, Servers, Channels, Messages, Invites, Emojis, and decodes exact millisecond creation timestamps.
              </p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs text-amber-400 font-medium">
            <span>Open Inspector</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Card: Platform Bans */}
        <div
          onClick={() => setActiveTab('bans')}
          className="p-5 bg-neutral-900 border border-neutral-800 hover:border-rose-500/40 rounded-xl transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 group-hover:scale-105 transition-transform">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white group-hover:text-rose-400 transition-colors">
                Platform-Wide Bans
              </h3>
              <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                Manage global platform bans in MongoDB. Permanently disable toxic users across the entire instance and all servers.
              </p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs text-rose-400 font-medium">
            <span>Manage Global Bans</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Card: Safety Reports */}
        <div
          onClick={() => setActiveTab('reports')}
          className="p-5 bg-neutral-900 border border-neutral-800 hover:border-amber-500/40 rounded-xl transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
                  Safety Reports Feed
                </h3>
                {reportCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-rose-500 text-[10px] text-white font-bold rounded-full">
                    {reportCount}
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                Review incoming abuse, spam, and malware reports filed by users via the DawnChat REST API. Triage and resolve tickets.
              </p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs text-amber-400 font-medium">
            <span>Triage Reports</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>
    </div>
  );
};
