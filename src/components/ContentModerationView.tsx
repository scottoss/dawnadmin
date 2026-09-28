import React, { useState, useEffect, useCallback } from 'react';
import { stoatApi } from '../services/stoatApi';
import { Channel, Message } from '../types/stoat';
import { decodeStoatId, formatBytes } from '../utils/stoatId';
import {
  MessageSquare,
  Trash2,
  Pin,
  Search,
  RefreshCw,
  Hash,
  AlertOctagon,
  Image,
  Paperclip,
  CheckSquare,
  Square,
  SmilePlus,
  Flame,
  Plus
} from 'lucide-react';

interface ContentModerationViewProps {
  initialChannelId?: string;
}

export const ContentModerationView: React.FC<ContentModerationViewProps> = ({
  initialChannelId,
}) => {
  const [channelId, setChannelId] = useState(
    initialChannelId || '01HJ2L2B02CDEFGHIJKLMNOP22'
  );
  const [channel, setChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // New channel modal
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [newChannelServer, setNewChannelServer] = useState('01HJ2K9M88ABCDEFGHIJKLMN01');
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);

  const loadChannelAndMessages = useCallback(async () => {
    if (!channelId.trim()) return;
    setIsLoading(true);
    setStatusMessage(null);
    setSelectedMsgIds(new Set());
    try {
      const ch = await stoatApi.fetchChannel(channelId.trim());
      setChannel(ch);

      if (searchQuery.trim()) {
        const searchRes = await stoatApi.searchMessages(channelId.trim(), searchQuery.trim());
        setMessages(searchRes.messages || []);
      } else {
        const msgsRes = await stoatApi.fetchMessages(channelId.trim(), 50);
        setMessages(msgsRes.messages || []);
      }
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: `Error loading channel ${channelId}: ${(err as Error).message}`,
      });
    } finally {
      setIsLoading(false);
    }
  }, [channelId, searchQuery]);

  useEffect(() => {
    loadChannelAndMessages();
  }, [loadChannelAndMessages]);

  const handleDeleteSingle = async (msgId: string) => {
    if (!confirm('Permanently delete this message?')) return;
    try {
      await stoatApi.deleteMessage(channelId, msgId, 'Moderation deletion via DawnChat Console');
      setMessages((prev) => prev.filter((m) => m._id !== msgId));
      setStatusMessage({ type: 'success', text: `Message ${msgId} deleted.` });
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Failed to delete message: ${(err as Error).message}` });
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedMsgIds);
    if (ids.length === 0) return;
    if (!confirm(`Purge ${ids.length} selected messages from #${'name' in (channel || {}) ? (channel as { name: string }).name : 'channel'}?`)) return;

    setIsBulkDeleting(true);
    try {
      await stoatApi.bulkDeleteMessages(channelId, ids, `Bulk purge of ${ids.length} messages`);
      setMessages((prev) => prev.filter((m) => !selectedMsgIds.has(m._id)));
      setSelectedMsgIds(new Set());
      setStatusMessage({ type: 'success', text: `Successfully purged ${ids.length} messages.` });
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Bulk delete failed: ${(err as Error).message}` });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleTogglePin = async (msgId: string, currentPinned?: boolean | null) => {
    try {
      if (currentPinned) {
        await stoatApi.unpinMessage(channelId, msgId);
        setStatusMessage({ type: 'success', text: 'Message unpinned.' });
      } else {
        await stoatApi.pinMessage(channelId, msgId);
        setStatusMessage({ type: 'success', text: 'Message pinned.' });
      }
      setMessages((prev) =>
        prev.map((m) => (m._id === msgId ? { ...m, pinned: !currentPinned } : m))
      );
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Pin action failed: ${(err as Error).message}` });
    }
  };

  const handleClearReactions = async (msgId: string) => {
    try {
      await stoatApi.clearReactions(channelId, msgId);
      setStatusMessage({ type: 'success', text: 'Reactions cleared from message.' });
      setMessages((prev) =>
        prev.map((m) => (m._id === msgId ? { ...m, reactions: {} } : m))
      );
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Clear reactions failed: ${(err as Error).message}` });
    }
  };

  const toggleSelectMessage = (msgId: string) => {
    const next = new Set(selectedMsgIds);
    if (next.has(msgId)) {
      next.delete(msgId);
    } else {
      next.add(msgId);
    }
    setSelectedMsgIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedMsgIds.size === messages.length) {
      setSelectedMsgIds(new Set());
    } else {
      setSelectedMsgIds(new Set(messages.map((m) => m._id)));
    }
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    setIsCreatingChannel(true);
    try {
      const created = await stoatApi.createChannel(
        newChannelServer.trim(),
        newChannelName.trim(),
        newChannelDesc.trim() || undefined
      );
      setStatusMessage({ type: 'success', text: `Channel #${newChannelName} created.` });
      setShowCreateChannelModal(false);
      setNewChannelName('');
      setNewChannelDesc('');
      if (created && created._id) {
        setChannelId(created._id);
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Failed to create channel: ${(err as Error).message}` });
    } finally {
      setIsCreatingChannel(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Title & Quick Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Content Moderation & Message Purge</h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Inspect channel messages, bulk purge spam, remove malicious attachments, and manage pinned items.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedMsgIds.size > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-lg shadow-rose-600/20"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {isBulkDeleting ? 'Purging...' : `Bulk Purge (${selectedMsgIds.size})`}
            </button>
          )}

          <button
            onClick={() => setShowCreateChannelModal(true)}
            className="px-3 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            Create Server Channel
          </button>
        </div>
      </div>

      {/* Target Channel & Filter Bar */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Channel selector */}
          <div className="flex items-center gap-2 flex-1">
            <div className="w-8 h-8 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-center text-purple-400 shrink-0">
              <Hash className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              placeholder="Channel ID (e.g. 01HJ2L2B02CDEFGHIJKLMNOP22)..."
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs font-mono text-neutral-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Search within channel */}
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search messages in channel..."
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
              />
            </div>
            <button
              onClick={loadChannelAndMessages}
              className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors shrink-0"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Channel Details Header */}
        {channel && (
          <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between text-xs text-neutral-400">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-neutral-200">
                #{'name' in channel ? channel.name : channel.channel_type}
              </span>
              {'description' in channel && channel.description && (
                <span className="hidden sm:inline text-neutral-400">
                  · {channel.description}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSelectAll}
                className="text-[11px] text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1"
              >
                {selectedMsgIds.size === messages.length && messages.length > 0 ? (
                  <CheckSquare className="w-3.5 h-3.5" />
                ) : (
                  <Square className="w-3.5 h-3.5" />
                )}
                <span>{selectedMsgIds.size === messages.length ? 'Deselect All' : 'Select All'}</span>
              </button>
              <span className="text-neutral-400">·</span>
              <span className="tabular-nums font-mono">{messages.length} messages</span>
            </div>
          </div>
        )}
      </div>

      {statusMessage && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="hover:underline">Dismiss</button>
        </div>
      )}

      {/* Messages Stream */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden divide-y divide-neutral-800/80">
        {messages.length === 0 ? (
          <div className="p-12 text-center">
            <MessageSquare className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
            <p className="text-xs font-medium text-neutral-300">No Messages Found</p>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              This channel has no recent messages or no results matched your search.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isSelected = selectedMsgIds.has(msg._id);
            const decodedTime = decodeStoatId(msg._id);

            return (
              <div
                key={msg._id}
                className={`p-4 transition-colors flex items-start gap-3.5 group ${
                  isSelected ? 'bg-amber-500/5' : 'hover:bg-neutral-800/25'
                }`}
              >
                {/* Checkbox */}
                <button
                  onClick={() => toggleSelectMessage(msg._id)}
                  className="mt-1 text-neutral-500 hover:text-amber-400 transition-colors shrink-0"
                >
                  {isSelected ? (
                    <CheckSquare className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Square className="w-4 h-4 text-neutral-600 group-hover:text-neutral-400" />
                  )}
                </button>

                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-neutral-950 border border-neutral-800 flex items-center justify-center text-xs font-bold text-neutral-300 shrink-0 mt-0.5">
                  {msg.user?.username ? msg.user.username.slice(0, 2).toUpperCase() : 'U'}
                </div>

                {/* Message Body */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-neutral-100">
                      {msg.user?.display_name || msg.user?.username || msg.author}
                    </span>
                    {msg.user?.discriminator && (
                      <span className="text-[10px] font-mono text-neutral-400">
                        #{msg.user.discriminator}
                      </span>
                    )}
                    {msg.pinned && (
                      <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.2 rounded border border-amber-500/20 font-medium">
                        PINNED
                      </span>
                    )}
                    <span className="text-[10px] text-neutral-400 font-mono tabular-nums">
                      {decodedTime.isValid ? decodedTime.formattedDate : ''}
                    </span>
                  </div>

                  {/* Content Text */}
                  <div className="text-xs text-neutral-200 mt-1 leading-relaxed break-words font-sans selection:bg-amber-500/20">
                    {msg.content || <span className="italic text-neutral-400">Empty text content</span>}
                  </div>

                  {/* Attachments preview */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {msg.attachments.map((att) => (
                        <div
                          key={att._id}
                          className="p-2 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center gap-2 text-xs text-neutral-300 max-w-sm"
                        >
                          {att.metadata.type === 'Image' ? (
                            <Image className="w-4 h-4 text-amber-400 shrink-0" />
                          ) : (
                            <Paperclip className="w-4 h-4 text-neutral-400 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <span className="block truncate font-medium text-[11px]">{att.filename}</span>
                            <span className="text-[10px] text-neutral-400 font-mono">
                              {formatBytes(att.size)} · {att.content_type}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reactions */}
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      {Object.entries(msg.reactions).map(([emoji, users]) => (
                        <span
                          key={emoji}
                          className="px-2 py-0.5 rounded bg-neutral-950 border border-neutral-800 text-[11px] text-neutral-300 flex items-center gap-1 font-mono"
                        >
                          <span>{emoji}</span>
                          <span>{users.length}</span>
                        </span>
                      ))}
                      <button
                        onClick={() => handleClearReactions(msg._id)}
                        className="text-[10px] text-neutral-400 hover:text-rose-400 ml-1 transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                {/* Hover Quick Action Buttons */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleTogglePin(msg._id, msg.pinned)}
                    title={msg.pinned ? 'Unpin message' : 'Pin message'}
                    className="p-1.5 text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 rounded transition-colors"
                  >
                    <Pin className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDeleteSingle(msg._id)}
                    title="Delete message"
                    className="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Create Channel */}
      {showCreateChannelModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h3 className="text-sm font-bold text-white">Create New Channel</h3>
              <button
                onClick={() => setShowCreateChannelModal(false)}
                className="text-neutral-500 hover:text-neutral-300"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateChannel} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Server ID:
                </label>
                <input
                  type="text"
                  required
                  value={newChannelServer}
                  onChange={(e) => setNewChannelServer(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Channel Name:
                </label>
                <input
                  type="text"
                  required
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="mod-logs"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Description / Topic:
                </label>
                <textarea
                  rows={2}
                  value={newChannelDesc}
                  onChange={(e) => setNewChannelDesc(e.target.value)}
                  placeholder="Administrative discussion and bot notifications..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowCreateChannelModal(false)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingChannel || !newChannelName.trim()}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {isCreatingChannel ? 'Creating...' : 'Create Channel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
