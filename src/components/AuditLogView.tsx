import React, { useState, useEffect, useCallback } from 'react';
import { stoatApi } from '../services/stoatApi';
import { PlatformAuditLog, AuditLogEntry, User } from '../types/stoat';
import { decodeStoatId } from '../utils/stoatId';
import {
  FileText,
  RefreshCw,
  Filter,
  Shield,
  Trash2,
  UserX,
  Globe,
  Database,
  CheckCircle,
  Hash,
  Pin,
  Smile,
  AlertTriangle
} from 'lucide-react';

export const AuditLogView: React.FC = () => {
  const [platformLogs, setPlatformLogs] = useState<PlatformAuditLog[]>([]);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const logs = await stoatApi.fetchPlatformAuditLogs(actionFilter);
      setPlatformLogs(logs);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [actionFilter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'PlatformBanCreate':
        return (
          <span className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 font-mono text-[10px] font-bold flex items-center gap-1">
            <Globe className="w-3 h-3" /> Platform Ban Applied
          </span>
        );
      case 'PlatformBanDelete':
        return (
          <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-bold">
            Platform Ban Revoked
          </span>
        );
      case 'MessagePurge':
      case 'MessageDelete':
        return (
          <span className="px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 text-purple-400 font-mono text-[10px] font-bold flex items-center gap-1">
            <Trash2 className="w-3 h-3" /> Message Purged
          </span>
        );
      case 'UserPrivilegeUpdate':
        return (
          <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[10px] font-bold flex items-center gap-1">
            <Shield className="w-3 h-3" /> Privilege Elevation
          </span>
        );
      case 'ReportStatusChange':
        return (
          <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono text-[10px] font-bold flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Report Triaged / Resolved
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono text-[10px]">
            {action}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono text-[10px] font-semibold flex items-center gap-1">
              <Database className="w-3 h-3" />
              PLATFORM-WIDE AUDIT TRAIL
            </span>
            <span className="text-xs text-neutral-500">·</span>
            <span className="text-xs text-neutral-400 font-mono">MongoDB platform_audit_logs</span>
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight mt-1">Platform Audit Trail & Action Logs</h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Immutable log of all global administrative events: platform bans, user privilege elevations, safety report resolutions, and message purges.
          </p>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-2">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
          >
            <option value="all">All Platform Actions</option>
            <option value="PlatformBanCreate">Platform Bans Created</option>
            <option value="PlatformBanDelete">Platform Bans Revoked</option>
            <option value="MessagePurge">Message Purges</option>
            <option value="UserPrivilegeUpdate">Privilege Changes</option>
            <option value="ReportStatusChange">Report Status Changes</option>
          </select>

          <button
            onClick={loadLogs}
            className="p-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 rounded-lg text-xs transition-colors"
            title="Refresh logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg">
          Failed to load platform audit logs: {error}
        </div>
      )}

      {/* Audit Log Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden divide-y divide-neutral-800 shadow-sm">
        {platformLogs.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
            <p className="text-xs font-medium text-neutral-300">No Platform Audit Logs Found</p>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              No actions have been recorded yet or matched the selected action filter.
            </p>
          </div>
        ) : (
          platformLogs.map((entry) => {
            const decoded = decodeStoatId(entry._id);

            return (
              <div
                key={entry._id}
                className="p-4 hover:bg-neutral-800/20 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getActionBadge(entry.action)}
                    <span className="text-xs font-semibold text-neutral-200">
                      {entry.actor?.username || entry.actor_id}
                    </span>
                    {entry.actor?.discriminator && (
                      <span className="text-[10px] font-mono text-neutral-400">
                        #{entry.actor.discriminator}
                      </span>
                    )}
                    <span className="text-[11px] text-neutral-400 font-mono">
                      executed <code className="text-neutral-200">{entry.action}</code>
                    </span>
                  </div>

                  {entry.reason && (
                    <p className="text-xs text-neutral-300 bg-neutral-950 px-2.5 py-1 rounded border border-neutral-800/80 inline-block font-sans">
                      Reason: <span className="text-neutral-400 italic">&quot;{entry.reason}&quot;</span>
                    </p>
                  )}

                  {entry.target_id && (
                    <div className="text-[11px] font-mono text-neutral-400">
                      Target {entry.target_type || 'Entity'}: <code className="text-neutral-300">{entry.target_id}</code>
                    </div>
                  )}

                  {entry.details && Object.keys(entry.details).length > 0 && (
                    <div className="text-[10px] font-mono text-neutral-500">
                      Metadata: {JSON.stringify(entry.details)}
                    </div>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-mono text-neutral-300 tabular-nums">
                    {decoded.isValid ? decoded.formattedDate : new Date(entry.created_at).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-neutral-500 font-mono">
                    {decoded.isValid ? decoded.timeAgo : ''}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
