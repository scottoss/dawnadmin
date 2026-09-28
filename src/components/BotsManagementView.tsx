import React, { useState, useEffect, useCallback } from 'react';
import { PlatformBot, User } from '../types/stoat';
import { stoatApi } from '../services/stoatApi';
import { getAutumnAvatarUrl } from '../utils/autumn';
import { Pagination } from './Pagination';
import {
  Bot,
  Key,
  Shield,
  Trash2,
  Edit3,
  RefreshCw,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  X,
  Plus,
  Loader2,
  Globe,
  Lock,
  Radio,
  Sparkles,
  Link as LinkIcon
} from 'lucide-react';

interface BotsManagementViewProps {
  onInspectUser?: (userId: string) => void;
  onNavigateToPlatformBan?: (userId: string) => void;
}

const PAGE_SIZE = 10;

export const BotsManagementView: React.FC<BotsManagementViewProps> = ({
  onInspectUser,
  onNavigateToPlatformBan,
}) => {
  const [bots, setBots] = useState<PlatformBot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Edit bot modal
  const [editingBot, setEditingBot] = useState<PlatformBot | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editIsPublic, setEditIsPublic] = useState(false);
  const [editInteractionsUrl, setEditInteractionsUrl] = useState('');
  const [isSavingBot, setIsSavingBot] = useState(false);

  // Reset token state / modal
  const [resetTokenResult, setResetTokenResult] = useState<{ botId: string; botName: string; token: string } | null>(null);
  const [isResettingTokenId, setIsResettingTokenId] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // Delete bot state
  const [deletingBotId, setDeletingBotId] = useState<string | null>(null);

  const loadBots = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await stoatApi.fetchBots();
      setBots(data);
    } catch (err: unknown) {
      setNotification({ type: 'error', text: `Failed to load bots: ${(err as Error).message}` });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBots();
  }, [loadBots]);

  // Open Edit Modal
  const openEditModal = (bot: PlatformBot) => {
    setEditingBot(bot);
    setEditUsername(bot.user?.username || '');
    setEditIsPublic(Boolean(bot.public));
    setEditInteractionsUrl(bot.interactions_url || '');
  };

  // Handle Save Edit
  const handleSaveBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBot) return;

    setIsSavingBot(true);
    try {
      await stoatApi.updateBot(editingBot._id, {
        username: editUsername.trim(),
        public: editIsPublic,
        interactions_url: editInteractionsUrl.trim() || null,
      });

      setNotification({
        type: 'success',
        text: `Bot @${editUsername.trim()} updated successfully in MongoDB.`,
      });
      setEditingBot(null);
      await loadBots();
    } catch (err: unknown) {
      setNotification({ type: 'error', text: `Failed to update bot: ${(err as Error).message}` });
    } finally {
      setIsSavingBot(false);
    }
  };

  // Handle Reset Token
  const handleResetToken = async (bot: PlatformBot) => {
    const botName = bot.user?.username || bot._id;
    if (!confirm(`Are you sure you want to reset authentication token for bot @${botName}? Any running bot instances using the old token will be disconnected immediately.`)) {
      return;
    }

    setIsResettingTokenId(bot._id);
    try {
      const newToken = await stoatApi.resetBotToken(bot._id);
      setResetTokenResult({
        botId: bot._id,
        botName: botName,
        token: newToken,
      });
      setNotification({
        type: 'success',
        text: `New authentication token generated for bot @${botName}.`,
      });
      await loadBots();
    } catch (err: unknown) {
      setNotification({ type: 'error', text: `Failed to reset bot token: ${(err as Error).message}` });
    } finally {
      setIsResettingTokenId(null);
    }
  };

  // Handle Delete Bot
  const handleDeleteBot = async (bot: PlatformBot) => {
    const botName = bot.user?.username || bot._id;
    if (!confirm(`WARNING: Are you sure you want to permanently delete bot @${botName} (${bot._id})? This will delete the bot record and bot user from MongoDB.`)) {
      return;
    }

    setDeletingBotId(bot._id);
    try {
      await stoatApi.deleteBot(bot._id, 'Deleted by administrator from Admin Console');
      setNotification({
        type: 'success',
        text: `Bot @${botName} was permanently deleted.`,
      });
      await loadBots();
    } catch (err: unknown) {
      setNotification({ type: 'error', text: `Failed to delete bot: ${(err as Error).message}` });
    } finally {
      setDeletingBotId(null);
    }
  };

  const handleCopyToken = () => {
    if (!resetTokenResult?.token) return;
    navigator.clipboard.writeText(resetTokenResult.token);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  // Filter bots
  const filteredBots = bots.filter((b) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = (b.user?.username || '').toLowerCase();
    const id = b._id.toLowerCase();
    const ownerName = (b.owner_user?.username || '').toLowerCase();
    const ownerId = (b.owner || '').toLowerCase();

    return name.includes(q) || id.includes(q) || ownerName.includes(q) || ownerId.includes(q);
  });

  const totalBots = bots.length;
  const publicBots = bots.filter((b) => b.public).length;
  const uniqueOwners = new Set(bots.map((b) => b.owner)).size;

  const totalPages = Math.max(1, Math.ceil(filteredBots.length / PAGE_SIZE));
  const paginatedBots = filteredBots.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400">
              <Bot className="w-5 h-5" />
            </div>
            <span>Platform Bots &amp; Integrations</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Inspect bots in MongoDB <code className="font-mono text-neutral-300">bots</code>, reset bot authentication tokens, modify public discoverability, and view bot owners.
          </p>
        </div>

        <button
          onClick={loadBots}
          disabled={isLoading}
          className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-semibold text-neutral-200 flex items-center gap-2 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Bots</span>
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase text-neutral-400">Total Registered Bots</span>
            <div className="text-2xl font-bold text-white mt-0.5">{totalBots}</div>
          </div>
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400">
            <Bot className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase text-emerald-400">Public Bots</span>
            <div className="text-2xl font-bold text-emerald-300 mt-0.5">{publicBots}</div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
            <Globe className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase text-amber-400">Active Bot Owners</span>
            <div className="text-2xl font-bold text-amber-300 mt-0.5">{uniqueOwners}</div>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400">
            <Shield className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          placeholder="Search by bot username, bot ID, owner username, or owner ID..."
          className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Bots Grid */}
      {isLoading && bots.length === 0 ? (
        <div className="p-16 text-center bg-neutral-900/40 border border-neutral-800 rounded-2xl">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-3" />
          <p className="text-xs text-neutral-300 font-medium">Loading platform bots from MongoDB...</p>
        </div>
      ) : filteredBots.length === 0 ? (
        <div className="p-16 text-center bg-neutral-900/40 border border-neutral-800 rounded-2xl">
          <Bot className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-neutral-200">No bots found</p>
          <p className="text-xs text-neutral-500 mt-1">
            {searchQuery ? `No matches for "${searchQuery}"` : 'No bots registered in this instance.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {paginatedBots.map((bot) => {
            const isResetting = isResettingTokenId === bot._id;
            const isDeleting = deletingBotId === bot._id;

            return (
              <div
                key={bot._id}
                className="p-5 bg-neutral-900/80 border border-neutral-800 hover:border-neutral-700 rounded-2xl flex flex-col justify-between gap-4 transition-all group"
              >
                <div>
                  {/* Top Bar: Bot Identity + Public Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {bot.user?.avatar ? (
                        <img
                          src={getAutumnAvatarUrl(bot.user.avatar._id, bot.user.avatar.filename)}
                          alt="Bot Avatar"
                          className="w-12 h-12 rounded-xl object-cover border-2 border-neutral-700 bg-neutral-800 shrink-0 shadow-md"
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border-2 border-neutral-700 text-indigo-400 font-bold text-base flex items-center justify-center uppercase shrink-0 shadow-md">
                          {(bot.user?.username || 'BOT').slice(0, 2)}
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors truncate">
                            {bot.user?.username || 'Bot User'}
                          </h3>
                          <span className="px-1.5 py-0.5 rounded bg-indigo-500 text-white font-bold text-[9px] font-mono tracking-wider">
                            BOT
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-neutral-500 block truncate">
                          ID: {bot._id}
                        </span>
                      </div>
                    </div>

                    <div>
                      {bot.public ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-semibold flex items-center gap-1">
                          <Globe className="w-3 h-3" /> Public
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-400 text-[10px] font-semibold flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Private
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Interactions URL or Info */}
                  {bot.interactions_url ? (
                    <div className="mt-3 p-2 bg-neutral-950 rounded-lg border border-neutral-800/80 flex items-center gap-2 text-[11px] text-neutral-400 font-mono truncate">
                      <LinkIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span className="truncate">{bot.interactions_url}</span>
                    </div>
                  ) : (
                    <div className="mt-3 text-[11px] text-neutral-500 italic">
                      No interactions webhook configured (Standard WebSocket bot)
                    </div>
                  )}

                  {/* Owner Section */}
                  <div className="mt-3.5 pt-3 border-t border-neutral-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      {bot.owner_user?.avatar ? (
                        <img
                          src={getAutumnAvatarUrl(bot.owner_user.avatar._id, bot.owner_user.avatar.filename)}
                          alt="Owner"
                          className="w-6 h-6 rounded-full object-cover border border-neutral-700 shrink-0"
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-neutral-800 border border-neutral-700 text-[10px] font-bold text-amber-400 flex items-center justify-center shrink-0 uppercase">
                          {(bot.owner_user?.username || bot.owner).slice(0, 2)}
                        </div>
                      )}

                      <div className="min-w-0">
                        <span className="text-[10px] text-neutral-500 uppercase font-mono block leading-none">Developer</span>
                        <span className="text-xs font-semibold text-neutral-200 truncate block">
                          @{bot.owner_user?.username || 'developer'}#{bot.owner_user?.discriminator || '0000'}
                        </span>
                      </div>
                    </div>

                    {onInspectUser && (
                      <button
                        onClick={() => onInspectUser(bot.owner)}
                        className="px-2 py-1 bg-neutral-950 hover:bg-neutral-800 text-amber-400 border border-neutral-800 rounded text-[11px] font-medium flex items-center gap-1 transition-colors shrink-0"
                        title="View developer profile in Admin Console"
                      >
                        <span>Profile</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Actions Toolbar */}
                <div className="pt-3 border-t border-neutral-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleResetToken(bot)}
                      disabled={isResetting}
                      className="px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      title="Regenerate Bot Token"
                    >
                      {isResetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                      <span>Reset Token</span>
                    </button>

                    <button
                      onClick={() => openEditModal(bot)}
                      className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      title="Edit Bot Information"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                  </div>

                  <button
                    onClick={() => handleDeleteBot(bot)}
                    disabled={isDeleting}
                    className="p-1.5 text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 rounded-lg transition-colors"
                    title="Delete Bot Record"
                  >
                    {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {filteredBots.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredBots.length}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
          itemName="bots"
        />
      )}

      {/* Edit Bot Modal */}
      {editingBot && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 bg-gradient-to-r from-neutral-900 to-neutral-950 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-indigo-400">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Edit Bot Information</h3>
                  <span className="text-[10px] font-mono text-neutral-500">ID: {editingBot._id}</span>
                </div>
              </div>

              <button
                onClick={() => setEditingBot(null)}
                className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBot} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Bot Username:
                </label>
                <input
                  type="text"
                  required
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Interactions Webhook URL (Optional):
                </label>
                <input
                  type="url"
                  value={editInteractionsUrl}
                  onChange={(e) => setEditInteractionsUrl(e.target.value)}
                  placeholder="https://your-bot.domain.com/interactions"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <label className="p-3 rounded-xl border border-neutral-800 bg-neutral-950 text-xs cursor-pointer flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={editIsPublic}
                  onChange={(e) => setEditIsPublic(e.target.checked)}
                  className="rounded border-neutral-700 bg-neutral-900 text-indigo-500 focus:ring-0"
                />
                <div>
                  <span className="font-bold text-white block">Public Bot</span>
                  <span className="text-[11px] text-neutral-400">
                    Allows any user across the platform to invite this bot to their servers.
                  </span>
                </div>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingBot(null)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingBot || !editUsername.trim()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 font-bold text-white rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                >
                  {isSavingBot ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Save Bot Details</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Token Modal Display */}
      {resetTokenResult && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Bot Token Regenerated</h3>
                  <span className="text-[10px] font-mono text-neutral-400">
                    Bot: @{resetTokenResult.botName} ({resetTokenResult.botId})
                  </span>
                </div>
              </div>

              <button
                onClick={() => setResetTokenResult(null)}
                className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-300">
              The previous token has been invalidated. Please provide this new token to the bot developer or update your environment variables.
            </p>

            <div>
              <label className="block text-[11px] font-semibold text-neutral-400 mb-1.5">
                New Bot Authentication Token (<code className="font-mono text-amber-400">x-bot-token</code>):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={resetTokenResult.token}
                  className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs font-mono text-amber-300 select-all"
                />
                <button
                  onClick={handleCopyToken}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors"
                >
                  {copiedToken ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedToken ? 'Copied' : 'Copy Token'}</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setResetTokenResult(null)}
                className="px-5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold rounded-xl text-xs"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
