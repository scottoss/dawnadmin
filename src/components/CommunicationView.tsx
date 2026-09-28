import React, { useState, useEffect, useCallback } from 'react';
import { PlatformBot, User, PlatformAuditLog, CommunicationBroadcastResult } from '../types/stoat';
import { stoatApi } from '../services/stoatApi';
import { getAutumnAvatarUrl } from '../utils/autumn';
import {
  Megaphone,
  Bot,
  Users,
  Send,
  CheckCircle2,
  AlertTriangle,
  Search,
  RefreshCw,
  Clock,
  Sparkles,
  ExternalLink,
  X,
  Plus,
  Loader2,
  Check,
  Radio,
  FileText,
  Layers,
  Palette,
  Eye,
  MessageSquare
} from 'lucide-react';

interface CommunicationViewProps {
  onInspectUser?: (userId: string) => void;
}

export const CommunicationView: React.FC<CommunicationViewProps> = ({ onInspectUser }) => {
  const [announcementBot, setAnnouncementBot] = useState<{
    configured: boolean;
    env_var: string;
    bot_id: string;
    bot: PlatformBot;
  } | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [history, setHistory] = useState<PlatformAuditLog[]>([]);
  const [isLoadingInitial, setIsLoadingInitial] = useState(false);

  // Form State
  const [targetType, setTargetType] = useState<'all' | 'users'>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  
  // Message Content & Embed
  const [messageContent, setMessageContent] = useState('');
  const [embedTitle, setEmbedTitle] = useState('');
  const [embedDescription, setEmbedDescription] = useState('');
  const [embedColour, setEmbedColour] = useState('#f59e0b');
  const [embedUrl, setEmbedUrl] = useState('');
  const [showEmbedOptions, setShowEmbedOptions] = useState(false);

  // Sending state
  const [isSending, setIsSending] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<CommunicationBroadcastResult | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Active subtab
  const [activeSubTab, setActiveSubTab] = useState<'compose' | 'history'>('compose');

  const loadData = useCallback(async () => {
    setIsLoadingInitial(true);
    try {
      const [fetchedBotInfo, fetchedUsers, fetchedHistory] = await Promise.all([
        stoatApi.fetchAnnouncementBot(),
        stoatApi.fetchMongoUsers(),
        stoatApi.fetchAnnouncementHistory(),
      ]);

      setAnnouncementBot(fetchedBotInfo);
      setUsers(fetchedUsers);
      setHistory(fetchedHistory);
    } catch (err: unknown) {
      setNotification({ type: 'error', text: `Failed to load data: ${(err as Error).message}` });
    } finally {
      setIsLoadingInitial(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Active Sender Bot profile
  const senderBot = announcementBot?.bot || null;
  const senderBotId = announcementBot?.bot_id || '01HQBOT0000000000000000000';

  // Toggle user selection
  const handleToggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  // Filter users for selection
  const filteredUsers = users.filter((u) => {
    if (u.bot) return false;
    if (u.disabled) return false;
    if (!userSearchQuery) return true;
    const q = userSearchQuery.toLowerCase();
    const username = (u.username || '').toLowerCase();
    const id = u._id.toLowerCase();
    return username.includes(q) || id.includes(q);
  });

  // Calculate total targets
  const totalRecipientsCount = targetType === 'all'
    ? users.filter((u) => !u.bot && !u.disabled).length
    : selectedUserIds.length;

  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Send Broadcast
  const handleInitiateSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageContent.trim()) {
      setNotification({ type: 'error', text: 'Message content cannot be empty.' });
      return;
    }
    if (targetType === 'users' && selectedUserIds.length === 0) {
      setNotification({ type: 'error', text: 'Please select at least one recipient user.' });
      return;
    }

    // Open confirmation modal
    setShowConfirmModal(true);
  };

  const handleConfirmAndBroadcast = async () => {
    setShowConfirmModal(false);
    setIsSending(true);
    setBroadcastResult(null);
    try {
      const result = await stoatApi.sendAnnouncement({
        bot_id: senderBotId,
        target_type: targetType,
        target_user_ids: targetType === 'users' ? selectedUserIds : undefined,
        content: messageContent.trim(),
        embed: (embedTitle.trim() || embedDescription.trim()) ? {
          title: embedTitle.trim() || undefined,
          description: embedDescription.trim() || undefined,
          colour: embedColour,
          url: embedUrl.trim() || undefined,
        } : undefined,
      });

      setBroadcastResult(result);
      setNotification({
        type: 'success',
        text: `Announcement successfully broadcasted via @${senderBot?.user?.username || 'DawnBot'}! Delivered to ${result.successful_deliveries} user(s).`,
      });

      // Clear message content upon successful broadcast
      setMessageContent('');
      setEmbedTitle('');
      setEmbedDescription('');
      setEmbedUrl('');
      setShowEmbedOptions(false);
      
      // Refresh history
      const updatedHistory = await stoatApi.fetchAnnouncementHistory();
      setHistory(updatedHistory);
    } catch (err: unknown) {
      setNotification({ type: 'error', text: `Broadcast failed: ${(err as Error).message}` });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
              <Megaphone className="w-5 h-5" />
            </div>
            <span>Platform Announcements &amp; Broadcasts</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Dispatch announcements and direct messages to users via registered platform bots. Broadcast globally to all instance members or target specific users.
          </p>
        </div>

        {/* Sub-tab Switcher */}
        <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 p-1 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setActiveSubTab('compose')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeSubTab === 'compose'
                ? 'bg-amber-500 text-neutral-950 shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Compose Announcement</span>
          </button>
          <button
            onClick={() => setActiveSubTab('history')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeSubTab === 'history'
                ? 'bg-amber-500 text-neutral-950 shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Broadcast History ({history.length})</span>
          </button>
        </div>
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

      {/* SUBTAB 1: COMPOSE ANNOUNCEMENT */}
      {activeSubTab === 'compose' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Form Settings & Composer (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            <form onSubmit={handleInitiateSend} className="p-6 bg-neutral-900/80 border border-neutral-800 rounded-2xl space-y-5">
              {/* Announcement Sender Bot (Configured in Env) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-white uppercase tracking-wider font-mono">
                    Announcement Sender Bot
                  </label>
                  <span className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-mono text-[10px] font-semibold flex items-center gap-1">
                    <Bot className="w-3 h-3" />
                    ENV: ANNOUNCEMENT_BOT_ID
                  </span>
                </div>

                <div className="p-3.5 bg-neutral-950 border border-neutral-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      {senderBot?.user?.avatar ? (
                        <img
                          src={getAutumnAvatarUrl(senderBot.user.avatar._id, senderBot.user.avatar.filename)}
                          alt="Bot"
                          className="w-10 h-10 rounded-xl object-cover border border-neutral-700"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 font-bold flex items-center justify-center text-sm">
                          {(senderBot?.user?.username || 'BOT').slice(0, 2)}
                        </div>
                      )}
                      <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-neutral-950 rounded-full" title="Active sender bot" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-white truncate">
                          @{senderBot?.user?.username || 'DawnAnnouncer'}
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-indigo-500 text-white font-mono text-[9px] font-bold">
                          BOT
                        </span>
                        {announcementBot?.configured ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[10px] font-mono">
                            Configured in .env
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700 text-[10px] font-mono">
                            System Default Bot
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-neutral-400 mt-0.5 flex items-center gap-2 truncate">
                        <span>Bot ID: <code className="text-neutral-300">{senderBotId}</code></span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-mono text-neutral-500 block uppercase">Mode</span>
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 justify-end">
                      <Check className="w-3.5 h-3.5" /> Locked to Env
                    </span>
                  </div>
                </div>
              </div>

              {/* 1. Target Recipients Mode */}
              <div className="pt-2 border-t border-neutral-800">
                <label className="block text-xs font-bold text-white uppercase tracking-wider font-mono mb-2">
                  1. Select Recipients
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <label
                    className={`p-3.5 rounded-xl border text-xs cursor-pointer flex items-start gap-3 transition-colors ${
                      targetType === 'all'
                        ? 'bg-amber-500/10 border-amber-500/40 text-white'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="targetType"
                      checked={targetType === 'all'}
                      onChange={() => setTargetType('all')}
                      className="mt-0.5 text-amber-500 focus:ring-0"
                    />
                    <div>
                      <span className="font-bold text-white block flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-amber-400" />
                        <span>All Platform Users ({users.filter((u) => !u.bot && !u.disabled).length})</span>
                      </span>
                      <span className="text-[11px] text-neutral-400 block mt-0.5">
                        Broadcast direct message to every active non-banned account in MongoDB.
                      </span>
                    </div>
                  </label>

                  <label
                    className={`p-3.5 rounded-xl border text-xs cursor-pointer flex items-start gap-3 transition-colors ${
                      targetType === 'users'
                        ? 'bg-amber-500/10 border-amber-500/40 text-white'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="targetType"
                      checked={targetType === 'users'}
                      onChange={() => setTargetType('users')}
                      className="mt-0.5 text-amber-500 focus:ring-0"
                    />
                    <div>
                      <span className="font-bold text-white block flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                        <span>Select Specific Users ({selectedUserIds.length})</span>
                      </span>
                      <span className="text-[11px] text-neutral-400 block mt-0.5">
                        Choose individual recipients from user directory or search.
                      </span>
                    </div>
                  </label>
                </div>

                {/* Specific Users Picker */}
                {targetType === 'users' && (
                  <div className="p-3.5 bg-neutral-950 border border-neutral-800 rounded-xl space-y-3">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        placeholder="Search users to add..."
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    {/* Selected Users Chips */}
                    {selectedUserIds.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {selectedUserIds.map((id) => {
                          const u = users.find((usr) => usr._id === id);
                          return (
                            <span
                              key={id}
                              className="px-2 py-1 bg-neutral-900 border border-neutral-800 rounded-lg text-[11px] text-neutral-200 flex items-center gap-1.5 font-mono"
                            >
                              <span>@{u?.username || id}</span>
                              <button
                                type="button"
                                onClick={() => handleToggleUser(id)}
                                className="text-neutral-500 hover:text-rose-400"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* User Select List */}
                    <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                      {filteredUsers.slice(0, 30).map((u) => {
                        const isChecked = selectedUserIds.includes(u._id);
                        return (
                          <div
                            key={u._id}
                            onClick={() => handleToggleUser(u._id)}
                            className={`p-2 rounded-lg text-xs cursor-pointer flex items-center justify-between transition-colors ${
                              isChecked
                                ? 'bg-amber-500/10 border border-amber-500/30 text-white'
                                : 'hover:bg-neutral-900 text-neutral-300'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}}
                                className="rounded border-neutral-700 bg-neutral-900 text-amber-500 focus:ring-0"
                              />
                              <span className="font-semibold">@{u.username}#{u.discriminator}</span>
                              <span className="font-mono text-[10px] text-neutral-500">{u._id}</span>
                            </div>

                            {u.privileged && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-mono">
                                privileged
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Message Content */}
              <div className="pt-2 border-t border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-white uppercase tracking-wider font-mono">
                    3. Announcement Message Content
                  </label>
                  <span className="text-[11px] text-neutral-500 font-mono">
                    {messageContent.length} chars
                  </span>
                </div>

                <textarea
                  rows={4}
                  required
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  placeholder="Type your official announcement here (supports markdown, emojis, links)..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 leading-relaxed font-sans"
                />

                {/* Optional Embed Designer Toggle */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowEmbedOptions((prev) => !prev)}
                    className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1.5"
                  >
                    <Palette className="w-3.5 h-3.5" />
                    <span>{showEmbedOptions ? 'Hide Rich Embed' : '+ Add Announcement Rich Card Embed'}</span>
                  </button>

                  {showEmbedOptions && (
                    <div className="mt-3 p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-3 animate-in fade-in">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
                            Embed Title:
                          </label>
                          <input
                            type="text"
                            value={embedTitle}
                            onChange={(e) => setEmbedTitle(e.target.value)}
                            placeholder="e.g. Platform Maintenance Notice"
                            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
                            Target Action URL (Optional):
                          </label>
                          <input
                            type="url"
                            value={embedUrl}
                            onChange={(e) => setEmbedUrl(e.target.value)}
                            placeholder="https://dawn-chat.com/changelog"
                            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
                          Embed Description:
                        </label>
                        <textarea
                          rows={2}
                          value={embedDescription}
                          onChange={(e) => setEmbedDescription(e.target.value)}
                          placeholder="Detailed announcement card explanation..."
                          className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      {/* Brand Colour Picker */}
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
                          Embed Accent Color:
                        </label>
                        <div className="flex items-center gap-2">
                          {['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444'].map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setEmbedColour(color)}
                              className={`w-6 h-6 rounded-full border-2 transition-transform ${
                                embedColour === color ? 'scale-110 border-white' : 'border-transparent'
                              }`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                          <input
                            type="text"
                            value={embedColour}
                            onChange={(e) => setEmbedColour(e.target.value)}
                            className="w-24 bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs font-mono text-white text-center"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-3 border-t border-neutral-800 flex items-center justify-between">
                <span className="text-xs text-neutral-400">
                  Total Delivery Targets: <strong className="text-amber-400 font-mono font-bold">{totalRecipientsCount} user(s)</strong>
                </span>

                <button
                  type="submit"
                  disabled={isSending || !messageContent.trim() || totalRecipientsCount === 0}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 font-bold rounded-xl text-xs flex items-center gap-2 transition-colors shadow-lg shadow-amber-500/20"
                >
                  {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>Broadcast Announcement Now</span>
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Live Message Preview (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-300 uppercase font-mono flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  Live DawnChat DM Preview
                </span>
                <span className="text-[10px] text-neutral-500 font-mono">Recipient View</span>
              </div>

              {/* Mock Chat Window */}
              <div className="p-4 bg-neutral-950 border border-neutral-800/80 rounded-xl space-y-3 font-sans">
                <div className="flex items-start gap-3">
                  {/* Bot Avatar */}
                  <div className="relative shrink-0 mt-0.5">
                    {senderBot?.user?.avatar ? (
                      <img
                        src={getAutumnAvatarUrl(senderBot.user.avatar._id, senderBot.user.avatar.filename)}
                        alt="Bot"
                        className="w-9 h-9 rounded-xl object-cover border border-neutral-700"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-xs">
                        {(senderBot?.user?.username || 'BOT').slice(0, 2)}
                      </div>
                    )}
                  </div>

                  {/* Message Bubble Body */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs text-white">
                        {senderBot?.user?.username || 'DawnAnnouncer'}
                      </span>
                      <span className="px-1 py-0.2 rounded bg-indigo-500 text-white font-mono text-[8px] font-bold">
                        BOT
                      </span>
                      <span className="text-[10px] font-mono text-neutral-500">
                        Today at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Content Text */}
                    <div className="text-xs text-neutral-200 whitespace-pre-wrap leading-relaxed">
                      {messageContent || (
                        <span className="text-neutral-500 italic">
                          Announcement message text will appear here...
                        </span>
                      )}
                    </div>

                    {/* Rich Embed Preview */}
                    {(embedTitle || embedDescription) && (
                      <div
                        className="mt-2 p-3 bg-neutral-900 border-l-4 rounded-r-lg space-y-1"
                        style={{ borderLeftColor: embedColour || '#f59e0b' }}
                      >
                        {embedTitle && (
                          <div className="font-bold text-xs text-white flex items-center gap-1">
                            <span>{embedTitle}</span>
                            {embedUrl && <ExternalLink className="w-3 h-3 text-neutral-400" />}
                          </div>
                        )}
                        {embedDescription && (
                          <div className="text-[11px] text-neutral-300 whitespace-pre-wrap">
                            {embedDescription}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-neutral-900/40 border border-neutral-800/60 rounded-xl text-[11px] text-neutral-400 space-y-1">
                <div className="font-semibold text-neutral-300 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Direct Delivery Mechanism:</span>
                </div>
                <p>
                  This will insert authentic messages directly into MongoDB <code className="font-mono text-neutral-300">messages</code> and create/activate <code className="font-mono text-neutral-300">DirectMessage</code> channels for every selected recipient.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: BROADCAST HISTORY */}
      {activeSubTab === 'history' && (
        <div className="space-y-4">
          <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-2xl flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Broadcast Audit Records</h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Archived logs from MongoDB <code className="font-mono text-neutral-300">platform_audit_logs</code>.
              </p>
            </div>

            <button
              onClick={loadData}
              className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          {history.length === 0 ? (
            <div className="p-16 text-center bg-neutral-900/40 border border-neutral-800 rounded-2xl">
              <Megaphone className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-neutral-200">No broadcast history recorded</p>
              <p className="text-xs text-neutral-500 mt-1">
                Broadcast announcements sent through this dashboard will be permanently logged here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((log) => {
                const details = (log.details || {}) as Record<string, any>;
                return (
                  <div
                    key={log._id}
                    className="p-4 bg-neutral-900/80 border border-neutral-800 rounded-2xl space-y-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-[10px] font-bold">
                          {log.action}
                        </span>
                        <span className="font-bold text-white">
                          Via @{details.bot_username || log.target_id}
                        </span>
                        <span className="text-neutral-500">·</span>
                        <span className="text-neutral-400">
                          {details.delivered_count ?? details.recipient_count ?? 1} delivered
                        </span>
                      </div>

                      <span className="font-mono text-[10px] text-neutral-500">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>

                    <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 font-sans text-neutral-300 whitespace-pre-wrap">
                      {details.content_preview || log.reason || 'Announcement content'}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-neutral-500 font-mono">
                      <span>Broadcast ID: {details.broadcast_id || log._id}</span>
                      <span>Target: {details.target_type === 'all' ? 'All Instance Users' : 'Selected Users'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Confirm Announcement Broadcast</h3>
                  <span className="text-[10px] font-mono text-neutral-400">Platform System Notification</span>
                </div>
              </div>

              <button
                onClick={() => setShowConfirmModal(false)}
                className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 bg-neutral-950 rounded-xl border border-neutral-800 space-y-2">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Sender Bot:</span>
                  <span className="text-white font-bold">@{senderBot?.user?.username || 'DawnAnnouncer'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Recipients:</span>
                  <span className="text-amber-400 font-bold font-mono">
                    {targetType === 'all' ? `All Active Users (${totalRecipientsCount})` : `${selectedUserIds.length} Selected Users`}
                  </span>
                </div>
                {embedTitle && (
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Embed Card:</span>
                    <span className="text-neutral-200 font-semibold truncate max-w-[180px]">&quot;{embedTitle}&quot;</span>
                  </div>
                )}
              </div>

              <div className="p-3 bg-neutral-950/60 rounded-xl border border-neutral-800/80 text-neutral-300 text-[11px] whitespace-pre-wrap max-h-24 overflow-y-auto">
                {messageContent}
              </div>

              <p className="text-[11px] text-neutral-400 leading-relaxed">
                This will create and activate direct message channels in MongoDB and send this announcement to all selected recipients immediately.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAndBroadcast}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-lg shadow-amber-500/20"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Confirm &amp; Broadcast</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
