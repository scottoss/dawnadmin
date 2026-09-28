import React, { useState, useEffect, useCallback } from 'react';
import { stoatApi } from '../services/stoatApi';
import { User } from '../types/stoat';
import { parseUserBadges } from '../utils/stoatId';
import { getAutumnAvatarUrl } from '../utils/autumn';
import { UserEditModal } from './UserEditModal';
import { Pagination } from './Pagination';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  Search,
  RefreshCw,
  Edit3,
  Trash2,
  Award,
  LogIn,
  ShieldAlert,
  ShieldCheck,
  Globe,
  Database,
  CheckCircle2,
  Key,
  ExternalLink
} from 'lucide-react';

interface PlatformUsersViewProps {
  onNavigateToPlatformBan?: (userId: string) => void;
}

const PAGE_SIZE = 10;

export const PlatformUsersView: React.FC<PlatformUsersViewProps> = ({ onNavigateToPlatformBan }) => {
  const { startImpersonation } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const loadUsers = useCallback(async (query = '') => {
    setIsLoading(true);
    try {
      const data = await stoatApi.fetchMongoUsers(query, 100);
      setUsers(data);
      setCurrentPage(1);
    } catch (err: unknown) {
      setActionNotice({ type: 'error', text: `Failed to load users: ${(err as Error).message}` });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadUsers(searchQuery);
  };

  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const paginatedUsers = users.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleOpenEdit = (user: User) => {
    setSelectedUser(user);
    setIsEditModalOpen(true);
  };

  const handleQuickDeleteAvatar = async (user: User) => {
    if (!user.avatar) return;
    if (!confirm(`Delete profile image for @${user.username}?`)) return;

    try {
      const updated = await stoatApi.deleteUserAvatar(user._id);
      setUsers((prev) => prev.map((u) => (u._id === user._id ? updated : u)));
      setActionNotice({ type: 'success', text: `Profile image deleted for @${user.username}` });
    } catch (err: unknown) {
      setActionNotice({ type: 'error', text: `Failed to delete avatar: ${(err as Error).message}` });
    }
  };

  const handleQuickImpersonate = async (user: User) => {
    try {
      const session = await stoatApi.impersonateUser(user._id);
      const redirectUrl = session.redirect_url || `https://chat.dawn-chat.com/login/token?token=${encodeURIComponent(session.token)}`;
      window.open(redirectUrl, '_blank');
      setActionNotice({ type: 'success', text: `Generated session for @${user.username}. Redirecting to DawnChat...` });
    } catch (err: unknown) {
      setActionNotice({ type: 'error', text: `Failed to impersonate: ${(err as Error).message}` });
    }
  };

  const handleQuickUnban = async (user: User) => {
    if (!confirm(`Unban @${user.username} and restore account (disabled: false)?`)) return;
    try {
      await stoatApi.revokePlatformBan(user._id);
      setUsers((prev) =>
        prev.map((u) =>
          u._id === user._id ? { ...u, disabled: false, banned: false, flags: (u.flags || 0) & ~4 } : u
        )
      );
      setActionNotice({ type: 'success', text: `User @${user.username} unbanned (disabled: false restored).` });
    } catch (err: unknown) {
      setActionNotice({ type: 'error', text: `Failed to unban user: ${(err as Error).message}` });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[10px] font-semibold flex items-center gap-1">
              <Database className="w-3 h-3" />
              MONGODB USERS &amp; ACCOUNTS
            </span>
            <span className="text-xs text-neutral-500">·</span>
            <span className="text-xs text-neutral-400 font-mono">Platform Identity Management</span>
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight mt-1">Platform User Accounts</h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Change usernames &amp; discriminators, delete profile images, configure badges, log in as any user, or ban/unban across DawnChat.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadUsers(searchQuery)}
            className="p-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 rounded-lg text-xs font-medium transition-colors"
            title="Refresh users"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {actionNotice && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between border ${
            actionNotice.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <span>{actionNotice.text}</span>
          <button onClick={() => setActionNotice(null)} className="text-[11px] hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by username, discriminator, user ID, or email..."
            className="w-full pl-9 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 font-mono"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium transition-colors"
        >
          Search
        </button>
      </form>

      {/* Users Grid / List */}
      <div className="space-y-3">
        {users.length === 0 && !isLoading ? (
          <div className="p-8 text-center bg-neutral-900/40 rounded-xl border border-neutral-800/60">
            <Users className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
            <p className="text-xs text-neutral-400">No users found matching query.</p>
          </div>
        ) : (
          paginatedUsers.map((u) => {
            const isBanned = Boolean(u.disabled || u.banned || ((u.flags || 0) & 4));

            return (
              <div
                key={u._id}
                className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700/80 rounded-xl p-4 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                {/* User Identity Info */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="relative shrink-0">
                    {u.avatar ? (
                      <img
                        src={getAutumnAvatarUrl(u.avatar._id, u.avatar.filename)}
                        alt={u.username}
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                        className="w-11 h-11 rounded-full object-cover border border-neutral-700 bg-neutral-800"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-sm font-bold text-neutral-300 uppercase">
                        {u.username.slice(0, 2)}
                      </div>
                    )}
                    {isBanned && (
                      <span
                        title="disabled: true"
                        className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-rose-600 border border-neutral-900 flex items-center justify-center text-[8px] text-white font-bold"
                      >
                        !
                      </span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white truncate">
                        {u.display_name || u.username}
                      </span>
                      <span className="text-xs text-neutral-400 font-mono">
                        @{u.username}#{u.discriminator}
                      </span>

                      {isBanned ? (
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono font-semibold">
                          disabled: true
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                          disabled: false
                        </span>
                      )}

                      {u.privileged && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                          privileged: true
                        </span>
                      )}

                      {u.badges ? (
                        <span
                          className="px-1.5 py-0.2 rounded text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono"
                          title={parseUserBadges(u.badges).join(', ')}
                        >
                          badges: {u.badges}
                          {parseUserBadges(u.badges).length > 0 && (
                            <span className="text-indigo-400 font-sans ml-1">
                              ({parseUserBadges(u.badges).slice(0, 2).join(', ')}
                              {parseUserBadges(u.badges).length > 2 ? '…' : ''})
                            </span>
                          )}
                        </span>
                      ) : null}
                    </div>

                    <div className="text-[11px] font-mono text-neutral-500 truncate mt-0.5">
                      ID: <span className="text-neutral-400">{u._id}</span>
                      {u.email && <span> · {u.email}</span>}
                      {u.status?.text && <span className="text-neutral-400"> · &quot;{u.status.text}&quot;</span>}
                    </div>
                  </div>
                </div>

                {/* Direct Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {/* Edit User Button */}
                  <button
                    onClick={() => handleOpenEdit(u)}
                    className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                    title="Change username, discriminator, badges, or avatar"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                    Edit User
                  </button>

                  {/* Delete Profile Image Button */}
                  {u.avatar && (
                    <button
                      onClick={() => handleQuickDeleteAvatar(u)}
                      className="px-2.5 py-1.5 bg-neutral-950 hover:bg-rose-500/20 text-neutral-400 hover:text-rose-300 border border-neutral-800 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                      title="Delete profile image"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Delete Avatar</span>
                    </button>
                  )}

                  {/* Log in as User Button */}
                  <button
                    onClick={() => handleQuickImpersonate(u)}
                    className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                    title="Create session and switch to this user"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    Log In as User
                  </button>

                  {/* Unban or Ban Button */}
                  {isBanned ? (
                    <button
                      onClick={() => handleQuickUnban(u)}
                      className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Unban
                    </button>
                  ) : (
                    <button
                      onClick={() => handleOpenEdit(u)}
                      className="px-3 py-1.5 bg-neutral-950 hover:bg-rose-500/10 text-neutral-400 hover:text-rose-300 border border-neutral-800 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Ban
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      {users.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={users.length}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
          itemName="users"
        />
      )}

      {/* User Edit Modal */}
      {selectedUser && (
        <UserEditModal
          user={selectedUser}
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedUser(null);
          }}
          onUserUpdated={(updated) => {
            setSelectedUser(updated);
            setUsers((prev) => prev.map((u) => (u._id === updated._id ? updated : u)));
          }}
        />
      )}
    </div>
  );
};
