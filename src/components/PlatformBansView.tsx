import React, { useState, useEffect, useCallback } from 'react';
import { stoatApi } from '../services/stoatApi';
import { PlatformBan, User } from '../types/stoat';
import { decodeStoatId } from '../utils/stoatId';
import { UserEditModal } from './UserEditModal';
import { Pagination } from './Pagination';
import {
  ShieldAlert,
  UserX,
  Plus,
  RefreshCw,
  Globe,
  Database,
  Search,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  Lock,
  Edit3,
  Loader2
} from 'lucide-react';

interface PlatformBansViewProps {
  initialUserId?: string;
}

const PAGE_SIZE = 10;

export const PlatformBansView: React.FC<PlatformBansViewProps> = ({ initialUserId }) => {
  const [bans, setBans] = useState<PlatformBan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [showBanModal, setShowBanModal] = useState(false);
  const [banUserId, setBanUserId] = useState(initialUserId || '');
  const [banReason, setBanReason] = useState('');
  const [banIp, setBanIp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [unbanningUserId, setUnbanningUserId] = useState<string | null>(null);
  const [previewUser, setPreviewUser] = useState<User | null>(null);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<User | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const loadBans = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await stoatApi.fetchPlatformBans();
      setBans(data);
    } catch (err) {
      setNotification({ type: 'error', text: `Failed to load platform bans: ${(err as Error).message}` });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBans();
  }, [loadBans]);

  useEffect(() => {
    if (banUserId.trim().length === 26) {
      stoatApi.fetchUser(banUserId.trim())
        .then((u) => setPreviewUser(u))
        .catch(() => setPreviewUser(null));
    } else {
      setPreviewUser(null);
    }
  }, [banUserId]);

  const handleCreateBan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!banUserId.trim()) return;
    setIsSubmitting(true);
    setNotification(null);
    try {
      await stoatApi.createPlatformBan(banUserId.trim(), banReason.trim(), banIp.trim() || undefined);
      setNotification({
        type: 'success',
        text: `Platform-wide ban applied to user ${banUserId}. Account changed to disabled: true.`
      });
      setShowBanModal(false);
      setBanUserId('');
      setBanReason('');
      setBanIp('');
      await loadBans();
    } catch (err) {
      setNotification({ type: 'error', text: `Failed to ban user: ${(err as Error).message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeBan = async (rawTargetId: string) => {
    const targetUserId = rawTargetId.startsWith('pban_') ? rawTargetId.split('_')[1] || rawTargetId : rawTargetId;
    if (!confirm(`Revoke platform-wide ban for user ${targetUserId}? This will re-enable their account (disabled: false) and restore global access to DawnChat.`)) return;

    setUnbanningUserId(rawTargetId);
    setNotification(null);
    try {
      await stoatApi.revokePlatformBan(targetUserId);
      setNotification({
        type: 'success',
        text: `Platform ban for user ${targetUserId} revoked successfully. Account set back to disabled: false.`
      });
      await loadBans();
    } catch (err) {
      setNotification({ type: 'error', text: `Failed to unban user: ${(err as Error).message}` });
    } finally {
      setUnbanningUserId(null);
    }
  };

  const filteredBans = bans.filter((b) => {
    const q = searchFilter.toLowerCase();
    return (
      b.user_id.toLowerCase().includes(q) ||
      b.reason?.toLowerCase().includes(q) ||
      b.user?.username?.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredBans.length / PAGE_SIZE));
  const paginatedBans = filteredBans.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 font-mono text-[10px] font-semibold flex items-center gap-1">
              <Globe className="w-3 h-3" />
              GLOBAL ENFORCEMENT
            </span>
            <span className="text-xs text-neutral-500">·</span>
            <span className="text-xs text-neutral-400 font-mono">MongoDB: platform_bans & users.flags: 4</span>
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight mt-1">Platform-Wide User Bans</h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Bans applied here completely terminate the user account across all servers, direct messages, and API endpoints on the DawnChat instance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadBans}
            className="p-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 rounded-lg text-xs font-medium transition-colors"
            title="Refresh bans"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowBanModal(true)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-lg shadow-rose-600/20"
          >
            <Plus className="w-4 h-4" />
            Issue Platform Ban
          </button>
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
          <button onClick={() => setNotification(null)} className="hover:underline">Dismiss</button>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => {
              setSearchFilter(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by User ID, username, or reason..."
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-amber-500 font-mono"
          />
        </div>

        <div className="text-xs text-neutral-400 font-mono tabular-nums shrink-0">
          {filteredBans.length} active platform {filteredBans.length === 1 ? 'ban' : 'bans'}
        </div>
      </div>

      {/* Bans Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden divide-y divide-neutral-800 shadow-sm">
        {filteredBans.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-xs font-medium text-neutral-200">No Active Platform Bans</p>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              The entire platform userbase is currently free of global administrative bans.
            </p>
          </div>
        ) : (
          paginatedBans.map((b) => {
            const decoded = decodeStoatId(b.user_id);

            return (
              <div
                key={b._id}
                className="p-4 hover:bg-neutral-800/20 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-neutral-950 border border-neutral-800 flex items-center justify-center text-rose-400 font-bold text-xs shrink-0 mt-0.5">
                    {b.user?.username ? b.user.username.slice(0, 2).toUpperCase() : 'U'}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-white">
                        {b.user?.display_name || b.user?.username || 'Banned User'}
                      </span>
                      {b.user?.discriminator && (
                        <span className="text-[10px] font-mono text-neutral-400">
                          #{b.user.discriminator}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/30 text-rose-300 text-[10px] font-mono font-semibold">
                        disabled: true
                      </span>
                      <span className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-mono">
                        PLATFORM BANNED
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-neutral-400 flex items-center gap-2">
                      <span>User ID: <code className="text-neutral-200">{b.user_id}</code></span>
                      {b.ip_address && (
                        <span>· IP: <code className="text-neutral-300">{b.ip_address}</code></span>
                      )}
                    </div>

                    {b.reason && (
                      <p className="text-xs text-neutral-300 bg-neutral-950 px-2.5 py-1 rounded border border-neutral-800/80 inline-block font-sans">
                        Reason: <span className="text-neutral-400 italic">&quot;{b.reason}&quot;</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 self-end md:self-center shrink-0">
                  <div className="text-right text-[11px] font-mono text-neutral-500 hidden sm:block mr-1">
                    <div>Enforced: {new Date(b.created_at || '').toLocaleDateString()}</div>
                    <div>{decoded.isValid ? decoded.timeAgo : ''}</div>
                  </div>

                  {b.user && (
                    <button
                      onClick={() => setSelectedUserForEdit(b.user || null)}
                      className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                      title="Manage username, avatar, badges"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                      Edit User
                    </button>
                  )}

                  <button
                    onClick={() => handleRevokeBan(b.user_id || b.user?._id || b._id)}
                    disabled={unbanningUserId === (b.user_id || b._id)}
                    className="px-3.5 py-1.5 bg-neutral-950 hover:bg-emerald-500/20 hover:text-emerald-300 disabled:opacity-50 text-neutral-300 rounded-lg text-xs font-semibold border border-neutral-800 transition-colors flex items-center gap-1.5"
                  >
                    {unbanningUserId === (b.user_id || b._id) ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    Unban User (disabled: false)
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      {filteredBans.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredBans.length}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
          itemName="bans"
        />
      )}

      {/* User Edit Modal */}
      {selectedUserForEdit && (
        <UserEditModal
          user={selectedUserForEdit}
          isOpen={Boolean(selectedUserForEdit)}
          onClose={() => setSelectedUserForEdit(null)}
          onUserUpdated={async () => {
            await loadBans();
          }}
        />
      )}

      {/* Modal: Issue Platform Ban */}
      {showBanModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-rose-500" />
                <h3 className="text-sm font-bold text-white">Issue Platform-Wide Ban</h3>
              </div>
              <button onClick={() => setShowBanModal(false)} className="text-neutral-500 hover:text-neutral-300">
                ✕
              </button>
            </div>

            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Warning: Platform bans write directly to MongoDB <code className="font-mono">platform_bans</code>, update account status from <code className="font-mono">disabled: false</code> to <code className="font-mono">disabled: true</code>, purge active sessions, and set flag 4 on the user account.
              </span>
            </div>

            <form onSubmit={handleCreateBan} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Target User ID:
                </label>
                <input
                  type="text"
                  required
                  value={banUserId}
                  onChange={(e) => setBanUserId(e.target.value)}
                  placeholder="01HJ3R9T89BCDEFGHIJKLMNOP34"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              {previewUser && (
                <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-bold text-white">
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
                  Reason for Platform Ban:
                </label>
                <textarea
                  rows={3}
                  required
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Severe safety violation, mass spam propagation, malicious exploit..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  IP Address (Optional IP ban rule):
                </label>
                <input
                  type="text"
                  value={banIp}
                  onChange={(e) => setBanIp(e.target.value)}
                  placeholder="e.g. 198.51.100.42"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowBanModal(false)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !banUserId.trim()}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {isSubmitting ? 'Banning Platform-Wide...' : 'Confirm Global Ban'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
