import React, { useState, useEffect, useCallback } from 'react';
import { stoatApi } from '../services/stoatApi';
import { Server, ServerBan, BannedUser, User } from '../types/stoat';
import {
  ShieldAlert,
  UserX,
  Search,
  UserMinus,
  Clock,
  AlertTriangle,
  RefreshCw,
  Plus,
  Send,
  CheckCircle2,
  FileText
} from 'lucide-react';

interface UserModerationViewProps {
  initialUserId?: string;
  initialServerId?: string;
}

export const UserModerationView: React.FC<UserModerationViewProps> = ({
  initialUserId,
  initialServerId,
}) => {
  const [selectedServerId, setSelectedServerId] = useState<string>(
    initialServerId || '01HJ2K9M88ABCDEFGHIJKLMN01'
  );
  const [server, setServer] = useState<Server | null>(null);
  const [bans, setBans] = useState<ServerBan[]>([]);
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [isLoadingBans, setIsLoadingBans] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Ban Modal Form
  const [showBanModal, setShowBanModal] = useState(false);
  const [banTargetId, setBanTargetId] = useState(initialUserId || '');
  const [banReason, setBanReason] = useState('');
  const [deleteMessageSeconds, setDeleteMessageSeconds] = useState<number>(0);
  const [banAuditReason, setBanAuditReason] = useState('');
  const [isSubmittingBan, setIsSubmittingBan] = useState(false);

  // Target preview
  const [previewUser, setPreviewUser] = useState<User | null>(null);

  // Member Quick Action State
  const [memberTargetId, setMemberTargetId] = useState('');
  const [timeoutDuration, setTimeoutDuration] = useState<string>('3600'); // 1 hour default
  const [memberAuditReason, setMemberAuditReason] = useState('');
  const [isProcessingMember, setIsProcessingMember] = useState(false);

  // Safety Report Modal State
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportType, setReportType] = useState<'User' | 'Server' | 'Message'>('User');
  const [reportTargetId, setReportTargetId] = useState('');
  const [reportReason, setReportReason] = useState('SpamAbuse');
  const [reportContext, setReportContext] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // Load server & bans
  const loadServerData = useCallback(async () => {
    if (!selectedServerId.trim()) return;
    setIsLoadingBans(true);
    setActionMessage(null);
    try {
      const serverData = await stoatApi.fetchServer(selectedServerId.trim());
      setServer(serverData);

      const banData = await stoatApi.fetchServerBans(selectedServerId.trim());
      setBans(banData.bans || []);
      setBannedUsers(banData.users || []);
    } catch (err: unknown) {
      console.warn('Failed to load server bans:', err);
      setActionMessage({
        type: 'error',
        text: `Error fetching bans for server ${selectedServerId}: ${(err as Error).message}`,
      });
    } finally {
      setIsLoadingBans(false);
    }
  }, [selectedServerId]);

  useEffect(() => {
    loadServerData();
  }, [loadServerData]);

  // Preview user when typing ban ID
  useEffect(() => {
    if (banTargetId.trim().length === 26) {
      stoatApi.fetchUser(banTargetId.trim())
        .then((u) => setPreviewUser(u))
        .catch(() => setPreviewUser(null));
    } else {
      setPreviewUser(null);
    }
  }, [banTargetId]);

  const handleExecuteBan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!banTargetId.trim()) return;

    setIsSubmittingBan(true);
    setActionMessage(null);
    try {
      await stoatApi.banUser(
        selectedServerId,
        banTargetId.trim(),
        banReason.trim() || 'Rule violation',
        deleteMessageSeconds,
        banAuditReason.trim() || undefined
      );

      setActionMessage({
        type: 'success',
        text: `User ${banTargetId} was banned from ${server?.name || 'server'}.`,
      });
      setShowBanModal(false);
      setBanTargetId('');
      setBanReason('');
      setBanAuditReason('');
      await loadServerData();
    } catch (err: unknown) {
      setActionMessage({
        type: 'error',
        text: `Failed to ban user: ${(err as Error).message}`,
      });
    } finally {
      setIsSubmittingBan(false);
    }
  };

  const handleUnban = async (targetUserId: string) => {
    if (!confirm(`Are you sure you want to unban user ${targetUserId}?`)) return;

    try {
      await stoatApi.unbanUser(selectedServerId, targetUserId, 'Unbanned via DawnChat Admin Console');
      setActionMessage({
        type: 'success',
        text: `User ${targetUserId} has been unbanned.`,
      });
      await loadServerData();
    } catch (err: unknown) {
      setActionMessage({
        type: 'error',
        text: `Failed to unban user: ${(err as Error).message}`,
      });
    }
  };

  const handleKickMember = async () => {
    if (!memberTargetId.trim()) return;
    if (!confirm(`Kick member ${memberTargetId} from server?`)) return;

    setIsProcessingMember(true);
    try {
      await stoatApi.kickMember(
        selectedServerId,
        memberTargetId.trim(),
        memberAuditReason || 'Kicked by DawnChat Moderator'
      );
      setActionMessage({
        type: 'success',
        text: `Member ${memberTargetId} kicked successfully.`,
      });
      setMemberTargetId('');
      setMemberAuditReason('');
    } catch (err: unknown) {
      setActionMessage({
        type: 'error',
        text: `Failed to kick member: ${(err as Error).message}`,
      });
    } finally {
      setIsProcessingMember(false);
    }
  };

  const handleTimeoutMember = async () => {
    if (!memberTargetId.trim()) return;
    setIsProcessingMember(true);

    let timeoutIso: string | null = null;
    const seconds = parseInt(timeoutDuration, 10);
    if (seconds > 0) {
      const untilDate = new Date(Date.now() + seconds * 1000);
      timeoutIso = untilDate.toISOString();
    }

    try {
      await stoatApi.timeoutMember(
        selectedServerId,
        memberTargetId.trim(),
        timeoutIso,
        memberAuditReason || 'Timed out via DawnChat Console'
      );
      setActionMessage({
        type: 'success',
        text: timeoutIso
          ? `Member ${memberTargetId} timed out until ${new Date(timeoutIso).toLocaleTimeString()}.`
          : `Timeout cleared for member ${memberTargetId}.`,
      });
    } catch (err: unknown) {
      setActionMessage({
        type: 'error',
        text: `Failed to update timeout: ${(err as Error).message}`,
      });
    } finally {
      setIsProcessingMember(false);
    }
  };

  const handleSubmitSafetyReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTargetId.trim()) return;
    setIsSubmittingReport(true);
    try {
      await stoatApi.reportContent({
        content: {
          type: reportType,
          id: reportTargetId.trim(),
          report_reason: reportReason,
        },
        additional_context: reportContext.trim(),
      });
      setActionMessage({
        type: 'success',
        text: `Safety report submitted successfully for ${reportType} ${reportTargetId}.`,
      });
      setShowReportModal(false);
      setReportTargetId('');
      setReportContext('');
    } catch (err: unknown) {
      setActionMessage({
        type: 'error',
        text: `Failed to submit report: ${(err as Error).message}`,
      });
    } finally {
      setIsSubmittingReport(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Server Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">User Bans & Member Moderation</h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Manage server bans, member timeouts, kicks, and platform safety reports.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowReportModal(true)}
            className="px-3 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            File Safety Report
          </button>

          <button
            onClick={() => setShowBanModal(true)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-lg shadow-rose-600/20"
          >
            <Plus className="w-4 h-4" />
            Ban User
          </button>
        </div>
      </div>

      {/* Target Server Input */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-center text-amber-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-neutral-200 block">
              Active Moderation Server:
            </span>
            <span className="text-xs text-neutral-400">
              {server?.name || 'DawnChat Server'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            value={selectedServerId}
            onChange={(e) => setSelectedServerId(e.target.value)}
            placeholder="Server ID (26 chars)..."
            className="w-full sm:w-72 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs font-mono text-neutral-200 focus:outline-none focus:border-amber-500"
          />
          <button
            onClick={loadServerData}
            title="Refresh bans"
            className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBans ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {actionMessage && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between border ${
            actionMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          }`}
        >
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage(null)} className="hover:underline">Dismiss</button>
        </div>
      )}

      {/* Grid: Active Bans + Quick Member Moderation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Ban List (2 Cols) */}
        <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserX className="w-4 h-4 text-rose-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Active Server Bans
              </h3>
              <span className="text-[11px] font-mono text-neutral-400">
                ({bans.length} {bans.length === 1 ? 'user' : 'users'})
              </span>
            </div>
          </div>

          {bans.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-xs font-medium text-neutral-200">No Active Bans</p>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                No users are currently banned from this server.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-800/80">
              {bans.map((ban) => {
                const userId = ban._id.user;
                const userObj = bannedUsers.find((u) => u._id === userId);

                return (
                  <div key={userId} className="p-4 hover:bg-neutral-800/20 transition-colors flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-neutral-950 border border-neutral-800 flex items-center justify-center text-xs font-semibold text-rose-400 shrink-0">
                        {userObj?.username ? userObj.username.slice(0, 2).toUpperCase() : 'U'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-neutral-100 truncate">
                            {userObj?.username || 'Unknown User'}
                          </span>
                          {userObj?.discriminator && (
                            <span className="text-[10px] font-mono text-neutral-400">
                              #{userObj.discriminator}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-neutral-400 truncate">
                          ID: {userId}
                        </div>
                        {ban.reason && (
                          <div className="text-xs text-neutral-400 mt-1 italic line-clamp-1">
                            &quot;{ban.reason}&quot;
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleUnban(userId)}
                      className="px-3 py-1.5 bg-neutral-800 hover:bg-emerald-500/20 hover:text-emerald-300 text-neutral-300 rounded-lg text-xs font-medium transition-colors shrink-0 border border-neutral-700/60"
                    >
                      Unban
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Member Moderation Toolbox (1 Col) */}
        <div className="space-y-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-neutral-800">
              <Clock className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Member Action Panel
              </h3>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                Target Member User ID:
              </label>
              <input
                type="text"
                value={memberTargetId}
                onChange={(e) => setMemberTargetId(e.target.value)}
                placeholder="26-character Stoat User ID..."
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono text-neutral-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                Timeout / Mute Duration:
              </label>
              <select
                value={timeoutDuration}
                onChange={(e) => setTimeoutDuration(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
              >
                <option value="900">15 Minutes</option>
                <option value="3600">1 Hour</option>
                <option value="86400">24 Hours (1 Day)</option>
                <option value="604800">7 Days (1 Week)</option>
                <option value="0">Clear Timeout (Unmute)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                Audit Reason:
              </label>
              <input
                type="text"
                value={memberAuditReason}
                onChange={(e) => setMemberAuditReason(e.target.value)}
                placeholder="e.g. Inappropriate language in general"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleTimeoutMember}
                disabled={isProcessingMember || !memberTargetId.trim()}
                className="py-2 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              >
                Apply Timeout
              </button>

              <button
                type="button"
                onClick={handleKickMember}
                disabled={isProcessingMember || !memberTargetId.trim()}
                className="py-2 px-3 bg-neutral-800 hover:bg-rose-500/20 hover:text-rose-300 text-neutral-300 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <UserMinus className="w-3.5 h-3.5" />
                Kick Member
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Ban User */}
      {showBanModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2.5">
                <UserX className="w-5 h-5 text-rose-500" />
                <h3 className="text-sm font-bold text-white">
                  Ban User from {server?.name || 'Server'}
                </h3>
              </div>
              <button
                onClick={() => setShowBanModal(false)}
                className="text-neutral-500 hover:text-neutral-300 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExecuteBan} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Target User ID:
                </label>
                <input
                  type="text"
                  required
                  value={banTargetId}
                  onChange={(e) => setBanTargetId(e.target.value)}
                  placeholder="01HJ3R9T89BCDEFGHIJKLMNOP34"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              {previewUser && (
                <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-xs text-white font-bold">
                    {previewUser.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">
                      {previewUser.display_name || previewUser.username}
                    </div>
                    <div className="text-[11px] font-mono text-neutral-400">
                      @{previewUser.username}#{previewUser.discriminator}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Ban Reason:
                </label>
                <textarea
                  rows={2}
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Violation of server safety guidelines..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Purge User Messages:
                </label>
                <select
                  value={deleteMessageSeconds}
                  onChange={(e) => setDeleteMessageSeconds(parseInt(e.target.value, 10))}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-rose-500"
                >
                  <option value="0">Do not delete recent messages</option>
                  <option value="86400">Delete messages from past 24 hours</option>
                  <option value="604800">Delete messages from past 7 days</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Audit Log Reason (Recorded in audit trail):
                </label>
                <input
                  type="text"
                  value={banAuditReason}
                  onChange={(e) => setBanAuditReason(e.target.value)}
                  placeholder="Admin moderation action"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowBanModal(false)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBan || !banTargetId.trim()}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors"
                >
                  {isSubmittingBan ? 'Banning...' : 'Confirm Server Ban'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: File Safety Report */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Submit Safety Report</h3>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-neutral-500 hover:text-neutral-300 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitSafetyReport} className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {(['User', 'Server', 'Message'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setReportType(t)}
                    className={`py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      reportType === t
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Reported {reportType} ID:
                </label>
                <input
                  type="text"
                  required
                  value={reportTargetId}
                  onChange={(e) => setReportTargetId(e.target.value)}
                  placeholder={`ID of the ${reportType}...`}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Violation Category:
                </label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="SpamAbuse">Spam or Platform Abuse</option>
                  <option value="Malware">Distribution of Malware / Phishing</option>
                  <option value="Harassment">Harassment or Targeted Abuse</option>
                  <option value="IllegalGoods">Selling or Facilitating Illegal Goods</option>
                  <option value="ScamsFraud">Scams or Fraudulent Activities</option>
                  <option value="Underage">Underage Account</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Additional Details / Context:
                </label>
                <textarea
                  rows={3}
                  value={reportContext}
                  onChange={(e) => setReportContext(e.target.value)}
                  placeholder="Provide timestamps or specific incident circumstances..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReport || !reportTargetId.trim()}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSubmittingReport ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
