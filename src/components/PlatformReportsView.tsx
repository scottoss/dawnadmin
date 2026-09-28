import React, { useState, useEffect, useCallback } from 'react';
import { stoatApi } from '../services/stoatApi';
import {
  PlatformReport,
  SafetySnapshot,
  SafetyStrike,
  SafetyAttachment,
  ContextMessage,
  User
} from '../types/stoat';
import { decodeStoatId, formatBytes, parseUserBadges } from '../utils/stoatId';
import { getAutumnAttachmentUrl, getAutumnAvatarUrl } from '../utils/autumn';
import {
  AlertTriangle,
  RefreshCw,
  Filter,
  CheckCircle,
  XCircle,
  Eye,
  MessageSquare,
  User as UserIcon,
  Server as ServerIcon,
  Clock,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  Shield,
  Ban,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Hash,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  UserX,
  AlertOctagon,
  Calendar,
  Code,
  Search,
  CheckCircle2,
  Trash2,
  Maximize2,
  ZoomIn,
  ZoomOut,
  X
} from 'lucide-react';

interface PlatformReportsViewProps {
  onBanUser?: (userId: string) => void;
  onInspectId?: (id: string) => void;
}

export const PlatformReportsView: React.FC<PlatformReportsViewProps> = ({ onBanUser, onInspectId }) => {
  const [reports, setReports] = useState<PlatformReport[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('Open');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Active Report Investigation Modal
  const [activeReport, setActiveReport] = useState<PlatformReport | null>(null);
  const [modalTab, setModalTab] = useState<'context' | 'strikes' | 'meta' | 'json'>('context');
  const [adminNotes, setAdminNotes] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Ban Modal State
  const [banModalOffender, setBanModalOffender] = useState<{
    user: User | null;
    userId: string;
    report: PlatformReport;
  } | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banResolveReport, setBanResolveReport] = useState(true);
  const [banRecordStrike, setBanRecordStrike] = useState(true);
  const [isBanning, setIsBanning] = useState(false);

  // New Strike Modal State
  const [strikeModalUser, setStrikeModalUser] = useState<{
    userId: string;
    reportId?: string;
  } | null>(null);
  const [strikeReason, setStrikeReason] = useState('');
  const [strikeSeverity, setStrikeSeverity] = useState<'Warning' | 'Strike' | 'AccountSuspension' | 'PermanentBan'>('Strike');
  const [isIssuingStrike, setIsIssuingStrike] = useState(false);

  // Copy helper
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Load Reports
  const loadReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await stoatApi.fetchPlatformReports('all');
      setReports(data);
      // If modal is open, refresh activeReport with updated data
      if (activeReport) {
        const updated = data.find((r) => r._id === activeReport._id);
        if (updated) setActiveReport(updated);
      }
    } catch (err) {
      setNotification({ type: 'error', text: `Failed to load reports: ${(err as Error).message}` });
    } finally {
      setIsLoading(false);
    }
  }, [activeReport?._id]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Update Status handler
  const handleUpdateStatus = async (
    reportId: string,
    newStatus: 'Open' | 'Triaged' | 'UnderReview' | 'Resolved' | 'Rejected' | 'Dismissed'
  ) => {
    setIsUpdatingStatus(true);
    try {
      await stoatApi.updatePlatformReportStatus(reportId, newStatus, adminNotes || undefined);
      setNotification({ type: 'success', text: `Report status updated to ${newStatus}.` });
      if (activeReport && activeReport._id === reportId) {
        setActiveReport({ ...activeReport, status: newStatus, notes: adminNotes || activeReport.notes });
      }
      await loadReports();
    } catch (err) {
      setNotification({ type: 'error', text: `Failed to update status: ${(err as Error).message}` });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Handle Ban Submit
  const handleConfirmBan = async () => {
    if (!banModalOffender) return;
    setIsBanning(true);
    try {
      const targetId = banModalOffender.userId;
      const rId = banModalOffender.report._id;
      const reason = banReason || `Violation of platform terms filed in report #${rId}`;

      await stoatApi.createPlatformBan(
        targetId,
        reason,
        undefined,
        rId,
        banResolveReport,
        banRecordStrike
      );

      setNotification({
        type: 'success',
        text: `User ${targetId} has been successfully banned platform-wide and account disabled.`
      });

      setBanModalOffender(null);
      await loadReports();
    } catch (err) {
      setNotification({ type: 'error', text: `Ban failed: ${(err as Error).message}` });
    } finally {
      setIsBanning(false);
    }
  };

  // Handle Unban
  const handleUnbanUser = async (userId: string) => {
    if (!confirm(`Are you sure you want to lift the platform ban for user ${userId}?`)) return;
    try {
      await stoatApi.revokePlatformBan(userId);
      setNotification({ type: 'success', text: `User ${userId} unbanned successfully.` });
      await loadReports();
    } catch (err) {
      setNotification({ type: 'error', text: `Unban failed: ${(err as Error).message}` });
    }
  };

  // Handle Issue Strike Submit
  const handleConfirmStrike = async () => {
    if (!strikeModalUser) return;
    setIsIssuingStrike(true);
    try {
      const newStrike = await stoatApi.issueSafetyStrike(
        strikeModalUser.userId,
        strikeReason || 'Platform safety guidelines violation',
        strikeSeverity,
        strikeModalUser.reportId
      );

      setNotification({
        type: 'success',
        text: `Safety ${strikeSeverity} recorded against user ${strikeModalUser.userId}.`
      });

      if (activeReport && activeReport._id === strikeModalUser.reportId) {
        const existing = activeReport.strikes || [];
        setActiveReport({
          ...activeReport,
          strikes: [newStrike, ...existing],
        });
      }

      setStrikeModalUser(null);
      setStrikeReason('');
      await loadReports();
    } catch (err) {
      setNotification({ type: 'error', text: `Failed to issue strike: ${(err as Error).message}` });
    } finally {
      setIsIssuingStrike(false);
    }
  };

  // Handle Delete Strike
  const handleDeleteStrike = async (strikeId: string) => {
    if (!confirm(`Are you sure you want to permanently delete and revoke safety strike #${strikeId}?`)) return;
    try {
      await stoatApi.deleteSafetyStrike(strikeId);
      setNotification({ type: 'success', text: `Safety strike #${strikeId} was permanently deleted from database.` });

      if (activeReport && activeReport.strikes) {
        setActiveReport({
          ...activeReport,
          strikes: activeReport.strikes.filter((s) => s._id !== strikeId),
        });
      }

      await loadReports();
    } catch (err) {
      setNotification({ type: 'error', text: `Failed to delete strike: ${(err as Error).message}` });
    }
  };

  // Status badges
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Open':
      case 'Created':
        return <span className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 font-mono text-[10px] font-bold">OPEN</span>;
      case 'Triaged':
      case 'UnderReview':
        return <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[10px] font-bold">UNDER REVIEW</span>;
      case 'Resolved':
        return <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-bold">RESOLVED</span>;
      case 'Dismissed':
      case 'Rejected':
        return <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono text-[10px]">REJECTED</span>;
      default:
        return <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono text-[10px]">{status}</span>;
    }
  };

  // Open & total counts across all reports
  const totalCount = reports.length;
  const openCount = reports.filter((r) => r.status === 'Open' || r.status === 'Created').length;
  const underReviewCount = reports.filter((r) => r.status === 'Triaged' || r.status === 'UnderReview').length;
  const resolvedCount = reports.filter((r) => r.status === 'Resolved').length;
  const dismissedCount = reports.filter((r) => r.status === 'Dismissed' || r.status === 'Rejected').length;

  // Filtered reports
  const filteredReports = reports.filter((r) => {
    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'Open' && r.status !== 'Open' && r.status !== 'Created') return false;
      if (statusFilter === 'Triaged' && r.status !== 'Triaged' && r.status !== 'UnderReview') return false;
      if (statusFilter === 'Resolved' && r.status !== 'Resolved') return false;
      if (statusFilter === 'Dismissed' && r.status !== 'Dismissed' && r.status !== 'Rejected') return false;
    }

    // Search filter
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const repName = r.reporter?.username?.toLowerCase() || '';
    const tgtName = r.reported_user?.username?.toLowerCase() || '';
    const contentText = r.snapshot?.content?.content?.toLowerCase() || '';
    const reason = (r.content?.report_reason || r.report_reason || '').toLowerCase();
    const additional = (r.additional_context || '').toLowerCase();
    const id = r._id.toLowerCase();
    return (
      id.includes(q) ||
      repName.includes(q) ||
      tgtName.includes(q) ||
      contentText.includes(q) ||
      reason.includes(q) ||
      additional.includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Title & Pipeline Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[10px] font-semibold flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              TRI-COLLECTION SAFETY ENGINE
            </span>
            <span className="text-xs text-neutral-500">·</span>
            <span className="text-xs text-neutral-400 font-mono">
              safety_reports · safety_snapshots · safety_strikes
            </span>
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight mt-1">Platform Abuse & Safety Reports</h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Full forensic moderation pipeline with chronological prior &amp; leading context, media attachments, reporter/offender dossiers, and platform ban actions.
          </p>
        </div>

        {/* Action & Filter Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="Search reports or users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-neutral-900 border border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-amber-500 w-44 sm:w-56"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-amber-500 font-medium"
          >
            <option value="Open">Open ({openCount})</option>
            <option value="all">All Reports ({totalCount})</option>
            <option value="Triaged">Under Review ({underReviewCount})</option>
            <option value="Resolved">Resolved ({resolvedCount})</option>
            <option value="Dismissed">Dismissed / Rejected ({dismissedCount})</option>
          </select>

          <button
            onClick={loadReports}
            className="p-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 rounded-lg text-xs transition-colors"
            title="Refresh reports"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-neutral-900 border border-neutral-800/80 rounded-xl">
          <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold block">Total Reports</span>
          <div className="text-xl font-mono font-bold text-white mt-0.5">{totalCount}</div>
          <span className="text-[10px] text-neutral-400 font-mono">safety_reports</span>
        </div>
        <div className="p-3 bg-neutral-900 border border-neutral-800/80 rounded-xl">
          <span className="text-[10px] text-rose-400 uppercase tracking-wider font-semibold block">Pending Action</span>
          <div className="text-xl font-mono font-bold text-rose-400 mt-0.5">{openCount}</div>
          <span className="text-[10px] text-neutral-400 font-mono">Requires triage</span>
        </div>
        <div className="p-3 bg-neutral-900 border border-neutral-800/80 rounded-xl">
          <span className="text-[10px] text-emerald-400 uppercase tracking-wider font-semibold block">Resolved</span>
          <div className="text-xl font-mono font-bold text-emerald-400 mt-0.5">{resolvedCount}</div>
          <span className="text-[10px] text-neutral-400 font-mono">Actioned / closed</span>
        </div>
        <div className="p-3 bg-neutral-900 border border-neutral-800/80 rounded-xl">
          <span className="text-[10px] text-amber-400 uppercase tracking-wider font-semibold block">Live Snapshots</span>
          <div className="text-xl font-mono font-bold text-amber-400 mt-0.5">
            {reports.filter((r) => r.snapshot).length}
          </div>
          <span className="text-[10px] text-neutral-400 font-mono">safety_snapshots matched</span>
        </div>
      </div>

      {notification && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between border ${
            notification.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          }`}
        >
          <span>{notification.text}</span>
          <button onClick={() => setNotification(null)} className="hover:underline font-mono text-[11px]">
            Dismiss
          </button>
        </div>
      )}

      {/* Reports Feed */}
      <div className="space-y-4">
        {filteredReports.length === 0 ? (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-12 text-center">
            <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-xs font-medium text-neutral-200">No Reports in Queue</p>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              {searchQuery
                ? `No reports matched search query "${searchQuery}".`
                : 'There are currently no reports in this filter category.'}
            </p>
          </div>
        ) : (
          filteredReports.map((report) => {
            const decoded = decodeStoatId(report._id);
            const snapshot = report.snapshot;
            const reportedUser = report.reported_user || snapshot?.content?.reported_user || null;
            const reporter = report.reporter || report.author || null;
            const targetUserId = reportedUser?._id || snapshot?.content?.author || report.content_id;
            const attachmentsCount = snapshot?.content?.attachments?.length || 0;
            const priorCount = snapshot?.content?._prior_context?.length || 0;
            const leadingCount = snapshot?.content?._leading_context?.length || 0;
            const strikesCount = report.strikes?.length || 0;
            const isOffenderBanned = report.is_reported_user_banned;

            return (
              <div
                key={report._id}
                className={`bg-neutral-900 border rounded-xl overflow-hidden transition-all shadow-sm ${
                  isOffenderBanned
                    ? 'border-neutral-800/90'
                    : report.status === 'Open' || report.status === 'Created'
                    ? 'border-rose-500/30'
                    : 'border-neutral-800'
                }`}
              >
                {/* Header Strip */}
                <div className="px-4 py-3 bg-neutral-950/60 border-b border-neutral-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getStatusBadge(report.status)}

                    <span className="font-mono text-[11px] text-neutral-400">
                      ID: <span className="text-neutral-200">{report._id}</span>
                    </span>

                    <span className="text-neutral-600">·</span>

                    <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300">
                      {report.report_reason || report.content?.report_reason}
                    </span>

                    {snapshot?.content?.channel_name && (
                      <span className="text-[11px] font-mono text-neutral-400 px-2 py-0.5 rounded bg-neutral-800/70">
                        #{snapshot.content.channel_name}
                      </span>
                    )}

                    {isOffenderBanned && (
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 font-mono text-[10px] font-bold flex items-center gap-1">
                        <Ban className="w-3 h-3 text-rose-400" />
                        OFFENDER BANNED
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] font-mono text-neutral-400 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-neutral-500" />
                    <span>{decoded.isValid ? decoded.formattedDate : new Date(report.created_at).toLocaleString()}</span>
                    {decoded.isValid && <span className="text-neutral-500">({decoded.timeAgo})</span>}
                  </div>
                </div>

                {/* Main Card Body */}
                <div className="p-4 space-y-4">
                  {/* Reporter vs Reported User Dual Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* 1. Reporter Box */}
                    <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1 font-mono">
                          <UserIcon className="w-3 h-3" />
                          Reporter (Filed Complaint)
                        </span>
                        {reporter?._id && (
                          <button
                            onClick={() => copyToClipboard(reporter._id, `rep_${report._id}`)}
                            className="text-[10px] font-mono text-neutral-500 hover:text-neutral-300 flex items-center gap-1"
                          >
                            {copiedId === `rep_${report._id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>Copy ID</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5">
                        {reporter?.avatar ? (
                          <img
                            src={getAutumnAvatarUrl(reporter.avatar._id, reporter.avatar.filename)}
                            alt={reporter.username}
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                            className="w-9 h-9 rounded-full object-cover border border-sky-500/30 bg-neutral-900 shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-sky-500/10 border border-sky-500/30 flex items-center justify-center font-bold text-xs text-sky-300 shrink-0">
                            {reporter?.username?.slice(0, 2).toUpperCase() || 'RP'}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                            <span>{reporter?.display_name || reporter?.username || report.author_id}</span>
                            {reporter?.discriminator && (
                              <span className="text-[10px] font-mono text-neutral-500">#{reporter.discriminator}</span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-neutral-400 truncate">
                            ID: <span className="text-neutral-300">{report.author_id}</span>
                          </div>
                        </div>
                      </div>

                      {report.additional_context && (
                        <div className="mt-2 text-xs bg-neutral-900/80 border border-neutral-800 p-2 rounded text-neutral-300">
                          <span className="text-[10px] text-neutral-500 block uppercase font-mono mb-0.5">Reporter Context Note:</span>
                          &quot;{report.additional_context}&quot;
                        </div>
                      )}
                    </div>

                    {/* 2. Reported Offender Box */}
                    <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1 font-mono">
                          <AlertOctagon className="w-3 h-3" />
                          Reported User (Accused Offender)
                        </span>
                        {targetUserId && (
                          <button
                            onClick={() => copyToClipboard(targetUserId, `tgt_${report._id}`)}
                            className="text-[10px] font-mono text-neutral-500 hover:text-neutral-300 flex items-center gap-1"
                          >
                            {copiedId === `tgt_${report._id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>Copy ID</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5">
                        {reportedUser?.avatar ? (
                          <img
                            src={getAutumnAvatarUrl(reportedUser.avatar._id, reportedUser.avatar.filename)}
                            alt={reportedUser.username}
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                            className="w-9 h-9 rounded-full object-cover border border-rose-500/30 bg-neutral-900 shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center font-bold text-xs text-rose-300 shrink-0">
                            {reportedUser?.username?.slice(0, 2).toUpperCase() || 'TG'}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                            <span>{reportedUser?.display_name || reportedUser?.username || targetUserId || 'Unknown User'}</span>
                            {reportedUser?.discriminator && (
                              <span className="text-[10px] font-mono text-neutral-500">#{reportedUser.discriminator}</span>
                            )}
                            {isOffenderBanned && (
                              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                BANNED
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-neutral-400 truncate">
                            ID: <span className="text-neutral-300">{targetUserId}</span>
                          </div>
                        </div>
                      </div>

                      {/* Strikes count & status */}
                      <div className="flex items-center justify-between pt-1 text-[11px] font-mono">
                        <span className="text-neutral-500">
                          Safety Strikes: <strong className="text-amber-400">{strikesCount}</strong>
                        </span>
                        {reportedUser?.badges !== undefined && (
                          <span className="text-neutral-500">
                            Badges: {parseUserBadges(reportedUser.badges).length || 'None'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Offense Message Preview */}
                  {snapshot?.content && (
                    <div className="p-3 bg-neutral-950/70 border border-neutral-800 rounded-lg space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500">
                        <span className="text-rose-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          Reported Message Content
                        </span>
                        <div className="flex items-center gap-2">
                          {attachmentsCount > 0 && (
                            <span className="text-amber-400 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 flex items-center gap-1">
                              <Paperclip className="w-3 h-3" />
                              {attachmentsCount} {attachmentsCount === 1 ? 'Attachment' : 'Attachments'}
                            </span>
                          )}
                          <span className="text-neutral-500">
                            Context: {priorCount} prior · {leadingCount} leading
                          </span>
                        </div>
                      </div>

                      {/* Text content */}
                      {snapshot.content.content ? (
                        <div className="text-xs text-neutral-200 bg-neutral-900/90 border border-neutral-800 p-2.5 rounded font-sans leading-relaxed">
                          {snapshot.content.content}
                        </div>
                      ) : attachmentsCount > 0 ? (
                        <div className="text-xs text-neutral-400 italic bg-neutral-900/60 p-2 rounded">
                          (Message contains no text, see attached media below)
                        </div>
                      ) : (
                        <div className="text-xs text-neutral-400 italic bg-neutral-900/60 p-2 rounded">
                          (Empty content)
                        </div>
                      )}

                      {/* Attachments preview */}
                      {snapshot.content.attachments && snapshot.content.attachments.length > 0 && (
                        <div className="space-y-2 pt-1">
                          {snapshot.content.attachments.map((att) => (
                            <AttachmentCard key={att._id} attachment={att} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Moderator notes display if present */}
                  {report.notes && (
                    <div className="text-xs p-2.5 rounded bg-neutral-950 border border-neutral-800 text-neutral-400 font-mono">
                      <span className="text-amber-400 font-semibold block text-[10px] uppercase">Moderator Notes:</span>
                      {report.notes}
                      {report.resolved_at && (
                        <span className="text-[10px] text-neutral-600 block mt-1">
                          Resolved: {new Date(report.resolved_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Action Toolbar */}
                  <div className="flex items-center justify-between pt-3 border-t border-neutral-800/80 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      {/* Review / Inspect Context Button */}
                      <button
                        onClick={() => {
                          setActiveReport(report);
                          setAdminNotes(report.notes || '');
                          setModalTab('context');
                        }}
                        className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect Full Dossier &amp; Context ({priorCount + leadingCount + 1})</span>
                      </button>

                      {/* Quick Inspect ID */}
                      {onInspectId && targetUserId && (
                        <button
                          onClick={() => onInspectId(targetUserId)}
                          className="px-3 py-1.5 bg-neutral-950 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 rounded-lg text-xs font-medium transition-colors"
                          title="Open in Universal ID Inspector"
                        >
                          Inspect ID
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Issue Strike Button */}
                      {targetUserId && (
                        <button
                          onClick={() => {
                            setStrikeModalUser({ userId: targetUserId, reportId: report._id });
                            setStrikeReason(`Violation reported in safety report #${report._id}: ${report.report_reason}`);
                          }}
                          className="px-3 py-1.5 bg-neutral-950 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                          title="Issue strike against reported user"
                        >
                          <ShieldAlert className="w-3.5 h-3.5" />
                          <span>Issue Strike</span>
                        </button>
                      )}

                      {/* Direct Platform Ban Action Button */}
                      {targetUserId && (
                        isOffenderBanned ? (
                          <button
                            onClick={() => handleUnbanUser(targetUserId)}
                            className="px-3 py-1.5 bg-neutral-950 hover:bg-neutral-800 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                            title="Unban this user"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Unban User</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setBanModalOffender({
                                user: reportedUser,
                                userId: targetUserId,
                                report,
                              });
                              setBanReason(`Abuse / Safety violation reported in #${report._id} (${report.report_reason})`);
                              setBanResolveReport(true);
                              setBanRecordStrike(true);
                            }}
                            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                            title="Ban user platform-wide"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>Ban Offender</span>
                          </button>
                        )
                      )}

                      {/* Quick Status toggle */}
                      {report.status !== 'Resolved' ? (
                        <button
                          onClick={() => handleUpdateStatus(report._id, 'Resolved')}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors"
                        >
                          Resolve
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUpdateStatus(report._id, 'Open')}
                          className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-medium transition-colors"
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* FULL FORENSIC INVESTIGATION MODAL */}
      {activeReport && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="w-full max-w-4xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-white tracking-tight">
                      Safety Investigation · Report #{activeReport._id}
                    </h3>
                    {getStatusBadge(activeReport.status)}
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300">
                      {activeReport.report_reason || activeReport.content?.report_reason}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-neutral-400 flex items-center gap-2 mt-0.5">
                    <span>Target: {activeReport.content_type || 'Message'}</span>
                    <span>·</span>
                    <span>Snapshot: {activeReport.snapshot?._id || 'None'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveReport(null)}
                  className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Sub-tab Navigation */}
            <div className="px-5 border-b border-neutral-800 bg-neutral-950/40 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setModalTab('context')}
                  className={`px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                    modalTab === 'context'
                      ? 'border-amber-400 text-amber-400'
                      : 'border-transparent text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Timeline &amp; Context</span>
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-neutral-800 text-neutral-300 font-mono">
                    {(activeReport.snapshot?.content?._prior_context?.length || 0) +
                      (activeReport.snapshot?.content?._leading_context?.length || 0) +
                      1}
                  </span>
                </button>

                <button
                  onClick={() => setModalTab('strikes')}
                  className={`px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                    modalTab === 'strikes'
                      ? 'border-amber-400 text-amber-400'
                      : 'border-transparent text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Safety Strikes</span>
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-neutral-800 text-neutral-300 font-mono">
                    {activeReport.strikes?.length || 0}
                  </span>
                </button>

                <button
                  onClick={() => setModalTab('meta')}
                  className={`px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                    modalTab === 'meta'
                      ? 'border-amber-400 text-amber-400'
                      : 'border-transparent text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Report Metadata &amp; Notes</span>
                </button>

                <button
                  onClick={() => setModalTab('json')}
                  className={`px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                    modalTab === 'json'
                      ? 'border-amber-400 text-amber-400'
                      : 'border-transparent text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <Code className="w-3.5 h-3.5" />
                  <span>Raw Forensic JSON</span>
                </button>
              </div>

              {/* Primary Direct Action: Ban or Unban */}
              <div className="py-2 flex items-center gap-2">
                {activeReport.reported_user?._id && (
                  activeReport.is_reported_user_banned ? (
                    <button
                      onClick={() => handleUnbanUser(activeReport.reported_user!._id)}
                      className="px-3 py-1 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 rounded-lg text-xs font-semibold flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Lift Ban</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setBanModalOffender({
                          user: activeReport.reported_user || null,
                          userId: activeReport.reported_user?._id || activeReport.content_id || '',
                          report: activeReport,
                        });
                        setBanReason(`Abuse / Safety violation in report #${activeReport._id}`);
                      }}
                      className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm"
                    >
                      <Ban className="w-3 h-3" />
                      <span>Ban Offender Platform-Wide</span>
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              {/* Dual Dossier Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Reporter Dossier */}
                <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1 font-mono">
                      <UserIcon className="w-3 h-3" />
                      Complainant (Reporter)
                    </span>
                    <button
                      onClick={() => copyToClipboard(activeReport.author_id, 'rep_dossier')}
                      className="text-[10px] font-mono text-neutral-500 hover:text-neutral-300 flex items-center gap-1"
                    >
                      {copiedId === 'rep_dossier' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{activeReport.author_id}</span>
                    </button>
                  </div>

                  <div className="flex items-start gap-3">
                    {activeReport.reporter?.avatar ? (
                      <img
                        src={getAutumnAvatarUrl(activeReport.reporter.avatar._id, activeReport.reporter.avatar.filename)}
                        alt={activeReport.reporter.username}
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                        className="w-10 h-10 rounded-full object-cover border border-sky-500/30 bg-neutral-900 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-sky-500/10 border border-sky-500/30 flex items-center justify-center font-bold text-sm text-sky-300 shrink-0">
                        {activeReport.reporter?.username?.slice(0, 2).toUpperCase() || 'RP'}
                      </div>
                    )}
                    <div className="min-w-0 flex-1 text-xs">
                      <div className="font-bold text-white truncate">
                        {activeReport.reporter?.display_name || activeReport.reporter?.username || activeReport.author_id}
                        {activeReport.reporter?.discriminator && (
                          <span className="text-neutral-500 font-mono text-[10px] ml-1">#{activeReport.reporter.discriminator}</span>
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-400 font-mono mt-0.5">
                        Status: <span className="text-neutral-300">{activeReport.reporter?.status?.presence || 'Unknown'}</span>
                      </div>
                      {activeReport.reporter?.badges !== undefined && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {parseUserBadges(activeReport.reporter.badges).map((b) => (
                            <span key={b} className="text-[9px] px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-300 font-mono">
                              {b}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {activeReport.additional_context && (
                    <div className="text-xs bg-neutral-900 border border-neutral-800/80 p-2.5 rounded-lg text-neutral-200 mt-2">
                      <span className="text-[10px] text-neutral-400 block font-mono uppercase mb-0.5">Context submitted:</span>
                      &quot;{activeReport.additional_context}&quot;
                    </div>
                  )}
                </div>

                {/* Offender Dossier */}
                <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1 font-mono">
                      <AlertOctagon className="w-3 h-3" />
                      Reported Offender
                    </span>
                    {activeReport.reported_user?._id && (
                      <button
                        onClick={() => copyToClipboard(activeReport.reported_user!._id, 'off_dossier')}
                        className="text-[10px] font-mono text-neutral-500 hover:text-neutral-300 flex items-center gap-1"
                      >
                        {copiedId === 'off_dossier' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{activeReport.reported_user._id}</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-start gap-3">
                    {activeReport.reported_user?.avatar ? (
                      <img
                        src={getAutumnAvatarUrl(activeReport.reported_user.avatar._id, activeReport.reported_user.avatar.filename)}
                        alt={activeReport.reported_user.username}
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                        className="w-10 h-10 rounded-full object-cover border border-rose-500/30 bg-neutral-900 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center font-bold text-sm text-rose-300 shrink-0">
                        {activeReport.reported_user?.username?.slice(0, 2).toUpperCase() || 'TG'}
                      </div>
                    )}
                    <div className="min-w-0 flex-1 text-xs">
                      <div className="font-bold text-white truncate flex items-center gap-1.5">
                        <span>{activeReport.reported_user?.display_name || activeReport.reported_user?.username || activeReport.content_id}</span>
                        {activeReport.reported_user?.discriminator && (
                          <span className="text-neutral-500 font-mono text-[10px]">#{activeReport.reported_user.discriminator}</span>
                        )}
                        {activeReport.is_reported_user_banned ? (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            BANNED
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-400 font-mono mt-0.5">
                        Strikes Count: <strong className="text-amber-400">{activeReport.strikes?.length || 0}</strong>
                        {activeReport.reported_user?.disabled && <span className="text-rose-400 ml-2">· Account Disabled</span>}
                      </div>
                      {activeReport.reported_user?.badges !== undefined && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {parseUserBadges(activeReport.reported_user.badges).map((b) => (
                            <span key={b} className="text-[9px] px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-300 font-mono">
                              {b}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* TAB 1: CONTEXT & TIMELINE */}
              {modalTab === 'context' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs pb-1 border-b border-neutral-800">
                    <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-amber-400" />
                      Chronological Message Stream Snapshot
                    </span>
                    <span className="text-neutral-500 font-mono text-[11px]">
                      Channel: #{activeReport.snapshot?.content?.channel_name || activeReport.snapshot?.content?.channel || 'Unknown'}
                    </span>
                  </div>

                  {/* Prior Context Section */}
                  {activeReport.snapshot?.content?._prior_context && activeReport.snapshot.content._prior_context.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[11px] font-mono text-neutral-400">
                        <span className="w-2 h-2 rounded-full bg-neutral-600"></span>
                        <span className="uppercase font-semibold text-neutral-400">
                          Prior Context ({activeReport.snapshot.content._prior_context.length} earlier messages)
                        </span>
                      </div>

                      <div className="space-y-2 pl-3 border-l-2 border-neutral-800">
                        {activeReport.snapshot.content._prior_context.map((msg, i) => (
                          <ContextMessageItem key={msg._id || i} message={msg} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* OFFENDING REPORTED MESSAGE (HIGHLIGHTED) */}
                  <div className="p-4 rounded-xl bg-rose-500/5 border-2 border-rose-500/40 space-y-2.5 relative">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold font-mono uppercase flex items-center gap-1">
                        <AlertOctagon className="w-3 h-3 text-rose-400" />
                        REPORTED OFFENSE MESSAGE
                      </span>
                      <span className="text-[11px] font-mono text-neutral-400">
                        ID: {activeReport.snapshot?.content?._id || activeReport.content_id}
                      </span>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center justify-center font-bold text-xs shrink-0">
                        {activeReport.reported_user?.username?.slice(0, 2).toUpperCase() || 'TG'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">
                            {activeReport.reported_user?.username || activeReport.snapshot?.content?.author || 'Offender'}
                          </span>
                          <span className="text-[10px] font-mono text-neutral-500">
                            {activeReport.snapshot?.content?.nonce ? `nonce: ${activeReport.snapshot.content.nonce}` : ''}
                          </span>
                        </div>

                        {activeReport.snapshot?.content?.content ? (
                          <div className="text-xs text-rose-100 font-sans mt-1 bg-neutral-950/80 p-3 rounded-lg border border-rose-500/20 select-text">
                            {activeReport.snapshot.content.content}
                          </div>
                        ) : (
                          <div className="text-xs text-neutral-400 italic mt-1 bg-neutral-950/50 p-2 rounded">
                            (No text content in reported message)
                          </div>
                        )}

                        {/* Attachments for reported message */}
                        {activeReport.snapshot?.content?.attachments && activeReport.snapshot.content.attachments.length > 0 && (
                          <div className="space-y-2 mt-2">
                            <span className="text-[10px] uppercase font-mono text-neutral-400 font-semibold block">
                              Attached Evidence Files ({activeReport.snapshot.content.attachments.length}):
                            </span>
                            {activeReport.snapshot.content.attachments.map((att) => (
                              <AttachmentCard key={att._id} attachment={att} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Leading Context Section */}
                  {activeReport.snapshot?.content?._leading_context && activeReport.snapshot.content._leading_context.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[11px] font-mono text-neutral-400">
                        <span className="w-2 h-2 rounded-full bg-neutral-600"></span>
                        <span className="uppercase font-semibold text-neutral-400">
                          Leading Context ({activeReport.snapshot.content._leading_context.length} subsequent messages)
                        </span>
                      </div>

                      <div className="space-y-2 pl-3 border-l-2 border-neutral-800">
                        {activeReport.snapshot.content._leading_context.map((msg, i) => (
                          <ContextMessageItem key={msg._id || i} message={msg} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: SAFETY STRIKES */}
              {modalTab === 'strikes' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-1 border-b border-neutral-800">
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Disciplinary Record &amp; Strikes (safety_strikes)
                      </h4>
                      <p className="text-[11px] text-neutral-400 mt-0.5">
                        Track formal warnings, point strikes, and suspension history logged in MongoDB.
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setStrikeModalUser({
                          userId: activeReport.reported_user?._id || activeReport.content_id || '',
                          reportId: activeReport._id,
                        });
                        setStrikeReason(`Disciplinary strike for report #${activeReport._id}`);
                      }}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold rounded-lg text-xs flex items-center gap-1.5"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Issue New Strike</span>
                    </button>
                  </div>

                  {(!activeReport.strikes || activeReport.strikes.length === 0) ? (
                    <div className="p-8 text-center bg-neutral-950 rounded-xl border border-neutral-800">
                      <CheckCircle className="w-7 h-7 text-emerald-500 mx-auto mb-2" />
                      <p className="text-xs text-neutral-200 font-medium">Clean Strike Record</p>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        No previous strikes or warnings have been recorded in MongoDB <code className="font-mono text-neutral-400">safety_strikes</code> for this user.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activeReport.strikes.map((s) => (
                        <div
                          key={s._id}
                          className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl flex items-start justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                                s.severity === 'PermanentBan'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                  : s.severity === 'AccountSuspension'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                              }`}>
                                {s.severity}
                              </span>
                              <span className="font-mono text-[11px] text-neutral-400">
                                ID: <span className="text-neutral-200">{s._id}</span>
                              </span>
                              {s.report_id && (
                                <span className="font-mono text-[10px] text-neutral-500">
                                  Ref: #{s.report_id}
                                </span>
                              )}
                            </div>
                            <div className="text-white font-medium">{s.reason}</div>
                            <div className="text-[10px] font-mono text-neutral-500">
                              Issued by <span className="text-neutral-300">{s.actor?.username || s.actor_id}</span> on{' '}
                              {new Date(s.created_at).toLocaleString()}
                            </div>
                          </div>

                          <button
                            onClick={() => handleDeleteStrike(s._id)}
                            className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                            title="Delete / Revoke strike"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                            <span>Delete Strike</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: METADATA & INVESTIGATION NOTES */}
              {modalTab === 'meta' && (
                <div className="space-y-4">
                  <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 space-y-2.5 text-xs">
                    <h4 className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider font-mono">
                      Database Document Registry
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] font-mono">
                      <div className="p-2.5 bg-neutral-900/60 rounded border border-neutral-800/60">
                        <span className="text-neutral-500 block text-[10px]">Report ID:</span>
                        <span className="text-neutral-200 select-all">{activeReport._id}</span>
                      </div>
                      <div className="p-2.5 bg-neutral-900/60 rounded border border-neutral-800/60">
                        <span className="text-neutral-500 block text-[10px]">Snapshot ID:</span>
                        <span className="text-neutral-200 select-all">{activeReport.snapshot?._id || 'None'}</span>
                      </div>
                      <div className="p-2.5 bg-neutral-900/60 rounded border border-neutral-800/60">
                        <span className="text-neutral-500 block text-[10px]">Reported Entity Type:</span>
                        <span className="text-amber-400">{activeReport.content_type || 'Message'}</span>
                      </div>
                      <div className="p-2.5 bg-neutral-900/60 rounded border border-neutral-800/60">
                        <span className="text-neutral-500 block text-[10px]">Reported Entity ID:</span>
                        <span className="text-neutral-200 select-all">{activeReport.content_id}</span>
                      </div>
                      <div className="p-2.5 bg-neutral-900/60 rounded border border-neutral-800/60">
                        <span className="text-neutral-500 block text-[10px]">Channel ID:</span>
                        <span className="text-neutral-200 select-all">{activeReport.snapshot?.content?.channel || 'N/A'}</span>
                      </div>
                      <div className="p-2.5 bg-neutral-900/60 rounded border border-neutral-800/60">
                        <span className="text-neutral-500 block text-[10px]">Current Status:</span>
                        <span className="text-emerald-400 font-bold">{activeReport.status}</span>
                      </div>
                    </div>
                  </div>

                  {/* Notes form */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-neutral-300">
                      Moderator Investigation Log &amp; Resolution Notes:
                    </label>
                    <textarea
                      rows={3}
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Add investigation findings, rationale, evidence verification..."
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-amber-500 font-sans"
                    />
                  </div>
                </div>
              )}

              {/* TAB 4: RAW FORENSIC JSON */}
              {modalTab === 'json' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-neutral-400 font-mono">
                    <span>Unedited MongoDB Documents Payload</span>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(activeReport, null, 2), 'raw_json')}
                      className="text-amber-400 hover:text-amber-300 flex items-center gap-1 text-[11px]"
                    >
                      {copiedId === 'raw_json' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>Copy Full JSON</span>
                    </button>
                  </div>
                  <pre className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl text-[11px] font-mono text-neutral-300 overflow-x-auto max-h-96 select-all">
                    {JSON.stringify(activeReport, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="px-5 py-3.5 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between flex-wrap gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-neutral-400 font-mono">Set Status:</span>
                {(['Open', 'Triaged', 'Resolved', 'Dismissed'] as const).map((st) => (
                  <button
                    key={st}
                    disabled={isUpdatingStatus || activeReport.status === st}
                    onClick={() => handleUpdateStatus(activeReport._id, st)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      activeReport.status === st
                        ? 'bg-amber-500 text-neutral-950 font-bold'
                        : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveReport(null)}
                  className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BAN CONFIRMATION MODAL */}
      {banModalOffender && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-neutral-900 border border-rose-500/40 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-neutral-800">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <Ban className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Platform-Wide Ban Enforcement</h3>
                <p className="text-xs text-neutral-400">
                  Target: <span className="text-white font-semibold">{banModalOffender.user?.username || banModalOffender.userId}</span>
                  {banModalOffender.user?.discriminator && ` #${banModalOffender.user.discriminator}`}
                </p>
              </div>
            </div>

            <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-2 text-xs font-mono text-neutral-300">
              <div className="flex justify-between">
                <span className="text-neutral-500">Offender ID:</span>
                <span className="text-neutral-200 select-all">{banModalOffender.userId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Associated Report:</span>
                <span className="text-amber-400 select-all">#{banModalOffender.report._id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Violation:</span>
                <span className="text-rose-400 font-bold">{banModalOffender.report.report_reason}</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-neutral-300">
                Enforcement Reason (Public / Audit Log):
              </label>
              <textarea
                rows={2}
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-rose-500 font-sans"
              />
            </div>

            {/* Options */}
            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-neutral-300">
                <input
                  type="checkbox"
                  checked={banResolveReport}
                  onChange={(e) => setBanResolveReport(e.target.checked)}
                  className="rounded border-neutral-700 bg-neutral-900 text-rose-500 focus:ring-0"
                />
                <span>Automatically mark safety report #{banModalOffender.report._id} as <strong>Resolved</strong></span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-neutral-300">
                <input
                  type="checkbox"
                  checked={banRecordStrike}
                  onChange={(e) => setBanRecordStrike(e.target.checked)}
                  className="rounded border-neutral-700 bg-neutral-900 text-rose-500 focus:ring-0"
                />
                <span>Log Permanent Ban in <code className="font-mono text-amber-400">safety_strikes</code> collection</span>
              </label>
            </div>

            <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300">
              Enforcing this ban will immediately invalidate user sessions, set <code className="font-mono">accounts.disabled = true</code>, and mark user flags with bit 4 (Banned).
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setBanModalOffender(null)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isBanning}
                onClick={handleConfirmBan}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-lg shadow-rose-600/20"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>{isBanning ? 'Enforcing Platform Ban...' : 'Confirm Platform Ban'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ISSUE STRIKE MODAL */}
      {strikeModalUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-900 border border-amber-500/40 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-neutral-800">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Log Safety Strike</h3>
                <p className="text-xs text-neutral-400 font-mono">Target: {strikeModalUser.userId}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-300 font-semibold mb-1">Severity Level:</label>
                <select
                  value={strikeSeverity}
                  onChange={(e) => setStrikeSeverity(e.target.value as any)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 font-mono"
                >
                  <option value="Warning">Warning (No restriction)</option>
                  <option value="Strike">Strike (Point penalty)</option>
                  <option value="AccountSuspension">Account Suspension</option>
                  <option value="PermanentBan">Permanent Ban</option>
                </select>
              </div>

              <div>
                <label className="block text-neutral-300 font-semibold mb-1">Disciplinary Reason:</label>
                <textarea
                  rows={3}
                  value={strikeReason}
                  onChange={(e) => setStrikeReason(e.target.value)}
                  placeholder="State the observed offense or violation..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-sans"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setStrikeModalUser(null)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isIssuingStrike}
                onClick={handleConfirmStrike}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 rounded-lg text-xs font-bold transition-colors"
              >
                {isIssuingStrike ? 'Logging Strike...' : 'Issue Strike'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Context Message Item (renders prior & leading messages)
// ---------------------------------------------------------------------------
const ContextMessageItem: React.FC<{ message: ContextMessage }> = ({ message }) => {
  const authorName = message.author_user?.username || message.author;
  const isSystem = Boolean(message.system);
  const avatarUrl = message.author_user?.avatar
    ? getAutumnAvatarUrl(message.author_user.avatar._id, message.author_user.avatar.filename)
    : undefined;

  if (isSystem) {
    return (
      <div className="p-2 rounded bg-neutral-950/60 border border-neutral-800/60 text-[11px] font-mono text-neutral-400 flex items-center gap-2">
        <span className="px-1.5 py-0.2 rounded bg-neutral-800 text-[10px] text-neutral-300">SYSTEM</span>
        <span>Event: {message.system?.type || 'system_event'}</span>
        {message.system?.by && <span>by <code className="text-neutral-300">{message.system.by}</code></span>}
      </div>
    );
  }

  return (
    <div className="p-2.5 rounded-lg bg-neutral-950/80 border border-neutral-800/80 space-y-1.5 text-xs hover:border-neutral-700 transition-colors">
      <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={authorName}
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
              className="w-5 h-5 rounded-full object-cover border border-neutral-700 bg-neutral-800 shrink-0"
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-neutral-800 flex items-center justify-center font-bold text-[10px] text-neutral-300 shrink-0">
              {authorName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <span className="font-semibold text-neutral-200">{authorName}</span>
          {message.author_user?.discriminator && (
            <span className="text-[10px] font-mono text-neutral-500">#{message.author_user.discriminator}</span>
          )}
        </div>
        <span className="font-mono text-[10px] text-neutral-500">
          ID: {message._id}
        </span>
      </div>

      {message.content && (
        <div className="text-neutral-300 font-sans pl-6 whitespace-pre-wrap leading-relaxed select-text">
          {message.content}
        </div>
      )}

      {/* Attachments inside context messages */}
      {message.attachments && message.attachments.length > 0 && (
        <div className="pl-6 space-y-2 pt-1">
          {message.attachments.map((att) => (
            <AttachmentCard key={att._id} attachment={att} />
          ))}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Attachment Preview Card (handles image, video, file, hash & Autumn links)
// ---------------------------------------------------------------------------
const AttachmentCard: React.FC<{ attachment: SafetyAttachment; compact?: boolean }> = ({ attachment, compact }) => {
  const [copiedHash, setCopiedHash] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [useProxyFallback, setUseProxyFallback] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Autumn asset URL
  const primaryAutumnUrl = getAutumnAttachmentUrl(attachment._id, attachment.filename);
  const proxyAutumnUrl = `/autumn/attachments/${attachment._id}/${encodeURIComponent(attachment.filename || 'attachment')}`;
  const effectiveImageUrl = useProxyFallback ? proxyAutumnUrl : primaryAutumnUrl;

  const isImage = Boolean(
    attachment.content_type?.startsWith('image/') ||
    attachment.metadata?.type === 'Image' ||
    /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(attachment.filename || '')
  );

  const copyHash = () => {
    navigator.clipboard.writeText(attachment.hash || attachment._id);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleImageError = () => {
    if (!useProxyFallback) {
      setUseProxyFallback(true);
    } else {
      setImageError(true);
    }
  };

  return (
    <>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/90 overflow-hidden p-3 shadow-md hover:border-neutral-700 transition-colors">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-center text-amber-400 shrink-0">
              {isImage ? <ImageIcon className="w-4 h-4" /> : <Paperclip className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white truncate max-w-md" title={attachment.filename}>
                {attachment.filename || 'untitled_attachment'}
              </div>
              <div className="text-[10px] font-mono text-neutral-400 flex items-center gap-1.5 mt-0.5">
                <span>{formatBytes(attachment.size)}</span>
                <span>·</span>
                <span>{attachment.content_type || 'image/png'}</span>
                {attachment.metadata?.width && attachment.metadata?.height && (
                  <>
                    <span>·</span>
                    <span className="text-neutral-300">{attachment.metadata.width}×{attachment.metadata.height}px</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
            <button
              onClick={copyHash}
              className="text-[10px] font-mono text-neutral-400 hover:text-neutral-200 px-2 py-1 rounded bg-neutral-950 border border-neutral-800 flex items-center gap-1 transition-colors"
              title={`SHA256: ${attachment.hash || attachment._id}`}
            >
              {copiedHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Hash className="w-3 h-3" />}
              <span>{copiedHash ? 'Copied' : 'SHA256'}</span>
            </button>

            {isImage && !imageError && (
              <button
                onClick={() => {
                  setZoomLevel(1);
                  setIsLightboxOpen(true);
                }}
                className="text-[10px] font-mono text-neutral-300 hover:text-white px-2 py-1 rounded bg-neutral-950 border border-neutral-800 flex items-center gap-1 transition-colors"
                title="Expand image in lightbox viewer"
              >
                <Maximize2 className="w-3 h-3 text-sky-400" />
                <span>Inspect</span>
              </button>
            )}

            <a
              href={primaryAutumnUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] font-mono text-amber-400 hover:text-amber-300 px-2 py-1 rounded bg-neutral-950 border border-neutral-800 flex items-center gap-1 transition-colors"
              title="Open direct Autumn image in new browser tab"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Autumn Link</span>
            </a>
          </div>
        </div>

        {/* Visual Inline Image Display */}
        {isImage && !imageError && (
          <div className="mt-3 relative rounded-lg overflow-hidden bg-black/80 border border-neutral-800/80 group">
            <div
              className="w-full flex items-center justify-center p-2 min-h-[140px] max-h-80 cursor-zoom-in bg-[radial-gradient(#1f1f1f_1px,transparent_1px)] [background-size:16px_16px]"
              onClick={() => {
                setZoomLevel(1);
                setIsLightboxOpen(true);
              }}
            >
              <img
                src={effectiveImageUrl}
                alt={attachment.filename || 'attachment'}
                onError={handleImageError}
                className="max-h-72 w-auto max-w-full object-contain rounded transition-transform duration-200 group-hover:scale-[1.01]"
                loading="lazy"
              />
            </div>

            {/* Hover overlay hint */}
            <div
              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 pointer-events-none"
            >
              <span className="px-3 py-1.5 bg-neutral-950/90 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-neutral-700 shadow-xl pointer-events-auto cursor-pointer"
                onClick={() => {
                  setZoomLevel(1);
                  setIsLightboxOpen(true);
                }}
              >
                <ZoomIn className="w-3.5 h-3.5 text-amber-400" />
                <span>Click to Expand & Inspect</span>
              </span>
            </div>
          </div>
        )}

        {/* Fallback metadata display if image cannot be rendered */}
        {isImage && imageError && (
          <div className="mt-2.5 p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-[11px] font-mono text-neutral-400 space-y-1.5">
            <div className="flex items-center justify-between text-neutral-300">
              <span>Autumn Storage Asset ID:</span>
              <span className="text-amber-400 select-all font-semibold">{attachment._id}</span>
            </div>
            <div className="text-[10px] text-neutral-500 truncate select-all">
              Hash: {attachment.hash || 'None'}
            </div>
            <div className="pt-1 flex items-center gap-2">
              <a
                href={primaryAutumnUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-sky-400 hover:underline flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Open URL directly ({primaryAutumnUrl})</span>
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox / Full-Screen High-Res Image Inspector Modal */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col p-4 animate-in fade-in duration-150"
          onClick={() => setIsLightboxOpen(false)}
        >
          {/* Top Bar */}
          <div
            className="flex items-center justify-between pb-3 border-b border-neutral-800/80 text-white shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-amber-400">
                <ImageIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold truncate text-white">
                  {attachment.filename || 'attachment'}
                </div>
                <div className="text-xs font-mono text-neutral-400 flex items-center gap-2">
                  <span>{formatBytes(attachment.size)}</span>
                  <span>·</span>
                  <span>{attachment.content_type || 'image'}</span>
                  {attachment.metadata?.width && (
                    <>
                      <span>·</span>
                      <span className="text-amber-400">{attachment.metadata.width}×{attachment.metadata.height}px</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-lg p-1 text-xs">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                  className="p-1.5 hover:bg-neutral-800 rounded text-neutral-300 hover:text-white"
                  title="Zoom out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="px-2 font-mono text-neutral-300 text-xs">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                  className="p-1.5 hover:bg-neutral-800 rounded text-neutral-300 hover:text-white"
                  title="Zoom in"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>

              <a
                href={primaryAutumnUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-xs font-semibold text-amber-400 flex items-center gap-1.5 transition-colors"
                title="Open in new browser tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Original</span>
              </a>

              <button
                onClick={() => setIsLightboxOpen(false)}
                className="p-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-colors"
                title="Close Viewer (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Centered Image Container */}
          <div
            className="flex-1 flex items-center justify-center overflow-auto p-4"
            onClick={() => setIsLightboxOpen(false)}
          >
            <img
              src={effectiveImageUrl}
              alt={attachment.filename || 'attachment'}
              style={{ transform: `scale(${zoomLevel})` }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[82vh] max-w-[92vw] object-contain rounded-lg shadow-2xl border border-neutral-800/80 transition-transform duration-150"
            />
          </div>

          {/* Bottom details footnote */}
          <div
            className="pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[11px] font-mono text-neutral-500 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="truncate">
              Autumn ID: <span className="text-neutral-400 select-all">{attachment._id}</span>
            </div>
            {attachment.hash && (
              <div className="truncate hidden sm:block">
                SHA256: <span className="text-neutral-400 select-all">{attachment.hash}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
