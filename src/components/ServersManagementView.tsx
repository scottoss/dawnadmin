import React, { useState, useEffect, useCallback } from 'react';
import { EnrichedServer, Server, ServerFlags, User } from '../types/stoat';
import { stoatApi } from '../services/stoatApi';
import { getAutumnIconUrl, getAutumnAvatarUrl, getAutumnBannerUrl } from '../utils/autumn';
import { Pagination } from './Pagination';
import {
  Server as ServerIcon,
  Shield,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Search,
  RefreshCw,
  Hash,
  Users,
  ExternalLink,
  Edit3,
  Trash2,
  ArrowRightLeft,
  X,
  Plus,
  Loader2,
  Check,
  Radio,
  Eye,
  Info,
  Layers,
  Sparkles
} from 'lucide-react';

interface ServersManagementViewProps {
  onInspectUser?: (userId: string) => void;
  onNavigateToPlatformBan?: (userId: string) => void;
}

const PAGE_SIZE = 10;

export const ServersManagementView: React.FC<ServersManagementViewProps> = ({
  onInspectUser,
  onNavigateToPlatformBan,
}) => {
  const [servers, setServers] = useState<EnrichedServer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'official' | 'verified' | 'discoverable' | 'nsfw'>('all');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Selected server for editing modal
  const [activeServer, setActiveServer] = useState<EnrichedServer | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isOfficial, setIsOfficial] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isDiscoverable, setIsDiscoverable] = useState(false);
  const [isNsfw, setIsNsfw] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Transfer ownership state
  const [showTransferInput, setShowTransferInput] = useState(false);
  const [newOwnerId, setNewOwnerId] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  // Delete server state
  const [isDeleting, setIsDeleting] = useState(false);

  const loadServers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await stoatApi.fetchServers();
      setServers(data);
      if (activeServer) {
        const updated = data.find((s) => s._id === activeServer._id);
        if (updated) setActiveServer(updated);
      }
    } catch (err: unknown) {
      setNotification({ type: 'error', text: `Failed to load servers: ${(err as Error).message}` });
    } finally {
      setIsLoading(false);
    }
  }, [activeServer?._id]);

  useEffect(() => {
    loadServers();
  }, []);

  const openServerModal = (server: EnrichedServer) => {
    setActiveServer(server);
    setEditName(server.name || '');
    setEditDescription(server.description || '');
    const flags = server.flags || 0;
    setIsOfficial((flags & ServerFlags.Official) !== 0);
    setIsVerified((flags & ServerFlags.Verified) !== 0);
    setIsDiscoverable(Boolean(server.discoverable));
    setIsNsfw(Boolean(server.nsfw));
    setShowTransferInput(false);
    setNewOwnerId('');
  };

  const handleSaveServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeServer) return;

    setIsSaving(true);
    try {
      let calculatedFlags = 0;
      if (isOfficial) calculatedFlags |= ServerFlags.Official;
      if (isVerified) calculatedFlags |= ServerFlags.Verified;

      const updated = await stoatApi.updateServer(activeServer._id, {
        name: editName.trim(),
        description: editDescription.trim() || null,
        flags: calculatedFlags,
        discoverable: isDiscoverable,
        nsfw: isNsfw,
      });

      setNotification({ type: 'success', text: `Server "${updated.name}" updated successfully.` });
      await loadServers();
      setActiveServer((prev) => prev ? { ...prev, ...updated, flags: calculatedFlags, discoverable: isDiscoverable, nsfw: isNsfw } : null);
    } catch (err: unknown) {
      setNotification({ type: 'error', text: `Save failed: ${(err as Error).message}` });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTransferOwnership = async () => {
    if (!activeServer || !newOwnerId.trim()) return;
    if (!confirm(`Are you sure you want to transfer ownership of "${activeServer.name}" to user ${newOwnerId.trim()}?`)) return;

    setIsTransferring(true);
    try {
      await stoatApi.transferServerOwnership(activeServer._id, newOwnerId.trim());
      setNotification({ type: 'success', text: `Ownership transferred to ${newOwnerId.trim()}.` });
      setShowTransferInput(false);
      setNewOwnerId('');
      await loadServers();
    } catch (err: unknown) {
      setNotification({ type: 'error', text: `Transfer failed: ${(err as Error).message}` });
    } finally {
      setIsTransferring(false);
    }
  };

  const handleDeleteServer = async (serverId: string, serverName: string) => {
    if (!confirm(`WARNING: Are you sure you want to permanently delete server "${serverName}" (${serverId})? This will delete all its channels and membership data in MongoDB.`)) return;

    setIsDeleting(true);
    try {
      await stoatApi.deleteServer(serverId, 'Deleted by administrator from Admin Console');
      setNotification({ type: 'success', text: `Server "${serverName}" was deleted permanently.` });
      setActiveServer(null);
      await loadServers();
    } catch (err: unknown) {
      setNotification({ type: 'error', text: `Failed to delete server: ${(err as Error).message}` });
    } finally {
      setIsDeleting(false);
    }
  };

  // Quick toggle flag directly from list
  const handleQuickToggleFlag = async (server: EnrichedServer, flagBit: ServerFlags, flagName: string) => {
    const currentFlags = server.flags || 0;
    const newFlags = currentFlags ^ flagBit;
    try {
      await stoatApi.updateServer(server._id, { flags: newFlags });
      setNotification({
        type: 'success',
        text: `Server "${server.name}" marked as ${newFlags & flagBit ? flagName : 'Standard'}.`,
      });
      await loadServers();
    } catch (err: unknown) {
      setNotification({ type: 'error', text: `Failed to toggle flag: ${(err as Error).message}` });
    }
  };

  // Filtering
  const filteredServers = servers.filter((s) => {
    if (filterType === 'official' && !((s.flags || 0) & ServerFlags.Official)) return false;
    if (filterType === 'verified' && !((s.flags || 0) & ServerFlags.Verified)) return false;
    if (filterType === 'discoverable' && !s.discoverable) return false;
    if (filterType === 'nsfw' && !s.nsfw) return false;

    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = (s.name || '').toLowerCase();
    const desc = (s.description || '').toLowerCase();
    const id = s._id.toLowerCase();
    const ownerName = (s.owner_user?.username || '').toLowerCase();
    const ownerId = (s.owner || '').toLowerCase();

    return name.includes(q) || desc.includes(q) || id.includes(q) || ownerName.includes(q) || ownerId.includes(q);
  });

  // Metrics
  const totalServers = servers.length;
  const officialServers = servers.filter((s) => (s.flags || 0) & ServerFlags.Official).length;
  const verifiedServers = servers.filter((s) => (s.flags || 0) & ServerFlags.Verified).length;
  const totalMembers = servers.reduce((acc, s) => acc + (s.member_count || s.approximate_member_count || 1), 0);
  const totalChannels = servers.reduce((acc, s) => acc + (s.channel_count || s.channels?.length || 0), 0);

  const totalPages = Math.max(1, Math.ceil(filteredServers.length / PAGE_SIZE));
  const paginatedServers = filteredServers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
              <ServerIcon className="w-5 h-5" />
            </div>
            <span>Servers &amp; Communities</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Manage instances in MongoDB <code className="font-mono text-neutral-300">servers</code>, toggle official and verified status, inspect channel metrics, and manage server ownership.
          </p>
        </div>

        <button
          onClick={loadServers}
          disabled={isLoading}
          className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-semibold text-neutral-200 flex items-center gap-2 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Servers</span>
        </button>
      </div>

      {/* Notification */}
      {notification && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{notification.text}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl">
          <span className="text-[11px] font-mono uppercase text-neutral-400">Total Servers</span>
          <div className="text-xl font-bold text-white mt-0.5">{totalServers}</div>
        </div>
        <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl">
          <span className="text-[11px] font-mono uppercase text-purple-400 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> Official
          </span>
          <div className="text-xl font-bold text-purple-300 mt-0.5">{officialServers}</div>
        </div>
        <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl">
          <span className="text-[11px] font-mono uppercase text-sky-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Verified
          </span>
          <div className="text-xl font-bold text-sky-300 mt-0.5">{verifiedServers}</div>
        </div>
        <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl">
          <span className="text-[11px] font-mono uppercase text-neutral-400 flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> Total Members
          </span>
          <div className="text-xl font-bold text-neutral-200 mt-0.5">{totalMembers}</div>
        </div>
        <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl col-span-2 sm:col-span-1">
          <span className="text-[11px] font-mono uppercase text-neutral-400 flex items-center gap-1">
            <Hash className="w-3.5 h-3.5" /> Channels
          </span>
          <div className="text-xl font-bold text-neutral-200 mt-0.5">{totalChannels}</div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="p-4 bg-neutral-900/80 border border-neutral-800 rounded-2xl flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by server name, ULID, owner username or owner ID..."
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'official', 'verified', 'discoverable', 'nsfw'] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                setFilterType(t);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                filterType === t
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                  : 'bg-neutral-950 text-neutral-400 border border-neutral-800/80 hover:text-neutral-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Servers Cards Grid */}
      {isLoading && servers.length === 0 ? (
        <div className="p-16 text-center bg-neutral-900/40 border border-neutral-800 rounded-2xl">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin mx-auto mb-3" />
          <p className="text-xs text-neutral-300 font-medium">Loading platform servers from MongoDB...</p>
        </div>
      ) : filteredServers.length === 0 ? (
        <div className="p-16 text-center bg-neutral-900/40 border border-neutral-800 rounded-2xl">
          <ServerIcon className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-neutral-200">No servers found</p>
          <p className="text-xs text-neutral-500 mt-1">
            {searchQuery ? `No matches for query "${searchQuery}"` : 'No servers found with this filter.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {paginatedServers.map((s) => {
            const isOff = Boolean((s.flags || 0) & ServerFlags.Official);
            const isVer = Boolean((s.flags || 0) & ServerFlags.Verified);

            return (
              <div
                key={s._id}
                className="bg-neutral-900/70 border border-neutral-800 hover:border-neutral-700 rounded-2xl overflow-hidden flex flex-col transition-all duration-200 group hover:shadow-xl hover:shadow-black/40"
              >
                {/* Banner / Header */}
                <div className="h-20 bg-neutral-950 relative overflow-hidden">
                  {s.banner ? (
                    <img
                      src={getAutumnBannerUrl(s.banner._id, s.banner.filename)}
                      alt="Banner"
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-r from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-end px-4">
                      <Layers className="w-12 h-12 text-neutral-800/40" />
                    </div>
                  )}

                  {/* Flag Badges in Top Right */}
                  <div className="absolute top-2 right-2 flex items-center gap-1.5 flex-wrap">
                    {isOff && (
                      <span className="px-2 py-0.5 rounded bg-purple-500/90 text-white font-mono text-[10px] font-bold flex items-center gap-1 shadow">
                        <Sparkles className="w-3 h-3" /> OFFICIAL
                      </span>
                    )}
                    {isVer && (
                      <span className="px-2 py-0.5 rounded bg-sky-500/90 text-white font-mono text-[10px] font-bold flex items-center gap-1 shadow">
                        <ShieldCheck className="w-3 h-3" /> VERIFIED
                      </span>
                    )}
                    {s.discoverable && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/80 text-white font-mono text-[9px] font-semibold">
                        PUBLIC
                      </span>
                    )}
                    {s.nsfw && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/80 text-white font-mono text-[9px] font-semibold">
                        18+
                      </span>
                    )}
                  </div>
                </div>

                {/* Server Main Info */}
                <div className="p-4 pt-0 flex-1 flex flex-col -mt-6">
                  {/* Icon */}
                  <div className="flex items-end justify-between gap-3 mb-3">
                    <div className="relative">
                      {s.icon ? (
                        <img
                          src={getAutumnIconUrl(s.icon._id, s.icon.filename)}
                          alt={s.name}
                          className="w-14 h-14 rounded-2xl object-cover border-4 border-neutral-900 bg-neutral-800 shadow-md"
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border-4 border-neutral-900 text-amber-300 font-bold text-lg flex items-center justify-center uppercase shadow-md">
                          {s.name.slice(0, 2)}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleQuickToggleFlag(s, ServerFlags.Official, 'Official')}
                        title={isOff ? 'Remove Official Flag' : 'Make Official'}
                        className={`p-1.5 rounded-lg border text-xs transition-colors ${
                          isOff
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                            : 'bg-neutral-950 text-neutral-500 border-neutral-800 hover:text-purple-300'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleQuickToggleFlag(s, ServerFlags.Verified, 'Verified')}
                        title={isVer ? 'Remove Verified Flag' : 'Make Verified'}
                        className={`p-1.5 rounded-lg border text-xs transition-colors ${
                          isVer
                            ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                            : 'bg-neutral-950 text-neutral-500 border-neutral-800 hover:text-sky-300'
                        }`}
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openServerModal(s)}
                        className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    </div>
                  </div>

                  {/* Name & ID */}
                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors truncate">
                      {s.name}
                    </h3>
                    <span className="font-mono text-[10px] text-neutral-500 block truncate">
                      ID: {s._id}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-neutral-400 mt-2 line-clamp-2 min-h-[32px]">
                    {s.description || <span className="italic text-neutral-600">No description provided</span>}
                  </p>

                  {/* Stats Bar */}
                  <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-neutral-800/80 text-xs">
                    <div className="flex items-center gap-1.5 text-neutral-300">
                      <Users className="w-3.5 h-3.5 text-amber-400/80" />
                      <span className="font-semibold">{s.member_count ?? s.approximate_member_count ?? 1}</span>
                      <span className="text-[11px] text-neutral-500">members</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-neutral-300">
                      <Hash className="w-3.5 h-3.5 text-amber-400/80" />
                      <span className="font-semibold">{s.channel_count ?? s.channels?.length ?? 0}</span>
                      <span className="text-[11px] text-neutral-500">channels</span>
                    </div>
                  </div>

                  {/* Owner Card with Link to User Profile */}
                  <div className="mt-3 pt-3 border-t border-neutral-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      {s.owner_user?.avatar ? (
                        <img
                          src={getAutumnAvatarUrl(s.owner_user.avatar._id, s.owner_user.avatar.filename)}
                          alt="Owner"
                          className="w-6 h-6 rounded-full object-cover border border-neutral-700 shrink-0"
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-neutral-800 border border-neutral-700 text-[10px] font-bold text-amber-400 flex items-center justify-center shrink-0 uppercase">
                          {(s.owner_user?.username || s.owner).slice(0, 2)}
                        </div>
                      )}

                      <div className="min-w-0">
                        <span className="text-[10px] text-neutral-500 uppercase font-mono block leading-none">Owner</span>
                        <span className="text-xs font-semibold text-neutral-200 truncate block">
                          @{s.owner_user?.username || 'user'}#{s.owner_user?.discriminator || '0000'}
                        </span>
                      </div>
                    </div>

                    {onInspectUser && (
                      <button
                        onClick={() => onInspectUser(s.owner)}
                        className="px-2 py-1 bg-neutral-950 hover:bg-neutral-800 text-amber-400 border border-neutral-800 rounded text-[11px] font-medium flex items-center gap-1 transition-colors shrink-0"
                        title="View owner profile in Admin Console"
                      >
                        <span>Profile</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {filteredServers.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredServers.length}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
          itemName="servers"
        />
      )}

      {/* Detailed Server Edit Modal */}
      {activeServer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-neutral-900 via-neutral-900 to-neutral-950 border-b border-neutral-800 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
                  <ServerIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>{activeServer.name}</span>
                    {((activeServer.flags || 0) & ServerFlags.Official) !== 0 && (
                      <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-mono font-bold">
                        OFFICIAL
                      </span>
                    )}
                    {((activeServer.flags || 0) & ServerFlags.Verified) !== 0 && (
                      <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[10px] font-mono font-bold">
                        VERIFIED
                      </span>
                    )}
                  </h3>
                  <div className="text-xs text-neutral-400 font-mono mt-0.5">
                    ID: <span className="text-neutral-200 select-all">{activeServer._id}</span> · Created:{' '}
                    {activeServer.created_at ? new Date(activeServer.created_at).toLocaleDateString() : 'Active'}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setActiveServer(null)}
                className="p-1.5 rounded-lg bg-neutral-800/80 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Form 1: General Info & Flags */}
              <form onSubmit={handleSaveServer} className="space-y-4">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono">
                  Server Details &amp; Instance Flags
                </h4>

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">
                      Server Name:
                    </label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">
                      Server Description:
                    </label>
                    <textarea
                      rows={2}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Enter server description..."
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Flags Checkboxes */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-2">
                    Administrative Flags (Bitmask):
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Official */}
                    <label
                      className={`p-3 rounded-xl border text-xs cursor-pointer flex items-start gap-3 transition-colors ${
                        isOfficial
                          ? 'bg-purple-500/10 border-purple-500/40 text-purple-200'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isOfficial}
                        onChange={(e) => setIsOfficial(e.target.checked)}
                        className="mt-0.5 rounded border-neutral-700 bg-neutral-900 text-purple-500 focus:ring-0"
                      />
                      <div>
                        <div className="font-bold flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                          <span>Official Platform Server (1 &lt;&lt; 0)</span>
                        </div>
                        <span className="text-[11px] text-neutral-400 block mt-0.5">
                          Renders the official gold/purple platform badge and highlights server.
                        </span>
                      </div>
                    </label>

                    {/* Verified */}
                    <label
                      className={`p-3 rounded-xl border text-xs cursor-pointer flex items-start gap-3 transition-colors ${
                        isVerified
                          ? 'bg-sky-500/10 border-sky-500/40 text-sky-200'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isVerified}
                        onChange={(e) => setIsVerified(e.target.checked)}
                        className="mt-0.5 rounded border-neutral-700 bg-neutral-900 text-sky-500 focus:ring-0"
                      />
                      <div>
                        <div className="font-bold flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                          <span>Verified Server (1 &lt;&lt; 1)</span>
                        </div>
                        <span className="text-[11px] text-neutral-400 block mt-0.5">
                          Grants authenticated verified checkmark badge to the community.
                        </span>
                      </div>
                    </label>

                    {/* Discoverable */}
                    <label
                      className={`p-3 rounded-xl border text-xs cursor-pointer flex items-start gap-3 transition-colors ${
                        isDiscoverable
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isDiscoverable}
                        onChange={(e) => setIsDiscoverable(e.target.checked)}
                        className="mt-0.5 rounded border-neutral-700 bg-neutral-900 text-emerald-500 focus:ring-0"
                      />
                      <div>
                        <div className="font-bold flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Discoverable in Public Directory</span>
                        </div>
                        <span className="text-[11px] text-neutral-400 block mt-0.5">
                          Shows server in instance explore/discovery list.
                        </span>
                      </div>
                    </label>

                    {/* NSFW */}
                    <label
                      className={`p-3 rounded-xl border text-xs cursor-pointer flex items-start gap-3 transition-colors ${
                        isNsfw
                          ? 'bg-rose-500/10 border-rose-500/40 text-rose-200'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isNsfw}
                        onChange={(e) => setIsNsfw(e.target.checked)}
                        className="mt-0.5 rounded border-neutral-700 bg-neutral-900 text-rose-500 focus:ring-0"
                      />
                      <div>
                        <div className="font-bold flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                          <span>Age-Restricted (NSFW 18+)</span>
                        </div>
                        <span className="text-[11px] text-neutral-400 block mt-0.5">
                          Requires age gate confirmation before entering server.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-lg shadow-amber-500/20"
                  >
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Save Server Changes</span>
                  </button>
                </div>
              </form>

              {/* Owner & Transfer Section */}
              <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase font-mono">
                      Server Ownership
                    </h4>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Current owner has master administrative authority over roles and channels.
                    </p>
                  </div>

                  {onInspectUser && (
                    <button
                      onClick={() => onInspectUser(activeServer.owner)}
                      className="px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 rounded-lg text-amber-400 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <span>Inspect Owner</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="p-3 bg-neutral-900/80 rounded-lg flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    {activeServer.owner_user?.avatar ? (
                      <img
                        src={getAutumnAvatarUrl(activeServer.owner_user.avatar._id, activeServer.owner_user.avatar.filename)}
                        alt="Owner"
                        className="w-8 h-8 rounded-full object-cover border border-neutral-700"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 text-xs font-bold text-amber-400 flex items-center justify-center uppercase">
                        {(activeServer.owner_user?.username || activeServer.owner).slice(0, 2)}
                      </div>
                    )}
                    <div>
                      <span className="font-bold text-white block">
                        @{activeServer.owner_user?.username || 'user'}#{activeServer.owner_user?.discriminator || '0000'}
                      </span>
                      <span className="font-mono text-[10px] text-neutral-500">
                        ID: {activeServer.owner}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowTransferInput((prev) => !prev)}
                    className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
                    <span>{showTransferInput ? 'Cancel Transfer' : 'Transfer Ownership'}</span>
                  </button>
                </div>

                {showTransferInput && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg space-y-2">
                    <label className="block text-xs font-semibold text-amber-300">
                      Transfer Server to New Owner (User ID):
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newOwnerId}
                        onChange={(e) => setNewOwnerId(e.target.value)}
                        placeholder="Enter 26-char target User ULID..."
                        className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                      />
                      <button
                        onClick={handleTransferOwnership}
                        disabled={isTransferring || !newOwnerId.trim()}
                        className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 font-bold rounded-lg text-xs flex items-center gap-1.5 shrink-0 transition-colors"
                      >
                        {isTransferring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        <span>Confirm Transfer</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Danger Zone: Delete Server */}
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-rose-300 uppercase font-mono flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Danger Zone: Delete Server
                    </h4>
                    <p className="text-[11px] text-rose-300/80 mt-0.5">
                      Permanently wipes this server document, all its channels, and member records from MongoDB.
                    </p>
                  </div>

                  <button
                    onClick={() => handleDeleteServer(activeServer._id, activeServer.name)}
                    disabled={isDeleting}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-lg shadow-rose-600/20 shrink-0"
                  >
                    {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    <span>Delete Server</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
