import React, { useState } from 'react';
import { stoatApi } from '../services/stoatApi';
import { decodeStoatId, parseUserBadges, parseUserFlags, formatBytes } from '../utils/stoatId';
import { User, Server, Channel, Message, InviteInfo } from '../types/stoat';
import { UserEditModal } from './UserEditModal';
import {
  Search,
  Clock,
  User as UserIcon,
  Server as ServerIcon,
  Hash,
  MessageSquare,
  Ticket,
  Bot,
  Smile,
  ShieldAlert,
  Copy,
  Check,
  ExternalLink,
  Code2,
  Trash2,
  Pin,
  Edit3,
  LogIn,
  RefreshCw
} from 'lucide-react';

interface UniversalIdLookupProps {
  onNavigateToModeration?: (targetUserId?: string, targetServerId?: string) => void;
  onNavigateToContent?: (targetChannelId?: string) => void;
  onNavigateToPlatformBan?: (targetUserId: string) => void;
}

export const UniversalIdLookup: React.FC<UniversalIdLookupProps> = ({
  onNavigateToModeration,
  onNavigateToContent,
  onNavigateToPlatformBan,
}) => {
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('auto');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    query: string;
    decoded: ReturnType<typeof decodeStoatId>;
    matchedType: string;
    data: unknown;
    subData?: Record<string, unknown>;
    errors?: string[];
  } | null>(null);
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<User | null>(null);

  const sampleIds = [
    { label: 'Sample User', id: '01HJ3R9T89BCDEFGHIJKLMNOP34', type: 'User' },
    { label: 'Sample Server', id: '01HJ2K9M88ABCDEFGHIJKLMN01', type: 'Server' },
    { label: 'Sample Channel', id: '01HJ2L2B02CDEFGHIJKLMNOP22', type: 'Channel' },
    { label: 'Sample Message', id: '01HJ993M33NOPQRSTUVWXYZ77', type: 'Message' },
  ];

  const handleSearch = async (overrideId?: string) => {
    const targetId = (overrideId || query).trim();
    if (!targetId) return;

    setIsLoading(true);
    setActionSuccess(null);
    try {
      const res = await stoatApi.universalLookup(targetId);
      setResult(res);
    } catch (err: unknown) {
      setResult({
        query: targetId,
        decoded: decodeStoatId(targetId),
        matchedType: 'Error',
        data: null,
        errors: [err instanceof Error ? err.message : String(err)],
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyJson = () => {
    if (!result?.data) return;
    navigator.clipboard.writeText(JSON.stringify(result.data, null, 2));
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  const handleDeleteMessage = async (channelId: string, messageId: string) => {
    if (!confirm('Are you sure you want to delete this message?')) return;
    try {
      await stoatApi.deleteMessage(channelId, messageId, 'Deleted via Universal ID Lookup');
      setActionSuccess('Message deleted successfully.');
      handleSearch(messageId);
    } catch (err) {
      alert(`Failed to delete message: ${(err as Error).message}`);
    }
  };

  const handleTogglePin = async (channelId: string, messageId: string, currentPin?: boolean | null) => {
    try {
      if (currentPin) {
        await stoatApi.unpinMessage(channelId, messageId);
        setActionSuccess('Message unpinned.');
      } else {
        await stoatApi.pinMessage(channelId, messageId);
        setActionSuccess('Message pinned.');
      }
      handleSearch(messageId);
    } catch (err) {
      alert(`Failed to toggle pin: ${(err as Error).message}`);
    }
  };

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'User': return <UserIcon className="w-4 h-4 text-sky-400" />;
      case 'Server': return <ServerIcon className="w-4 h-4 text-emerald-400" />;
      case 'Channel': return <Hash className="w-4 h-4 text-purple-400" />;
      case 'Message': return <MessageSquare className="w-4 h-4 text-amber-400" />;
      case 'Invite': return <Ticket className="w-4 h-4 text-pink-400" />;
      case 'Bot': return <Bot className="w-4 h-4 text-indigo-400" />;
      case 'Emoji': return <Smile className="w-4 h-4 text-yellow-400" />;
      default: return <Search className="w-4 h-4 text-neutral-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Introduction */}
      <div>
        <h2 className="text-lg font-bold text-white tracking-tight">Universal ID Inspector</h2>
        <p className="text-xs text-neutral-400 mt-0.5">
          Look up any Stoat/Revolt entity: Users, Servers, Channels, Messages, Invites, Bots, and decoded ULID creation timestamps.
        </p>
      </div>

      {/* Search Bar & Filter Options */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 shadow-sm space-y-3">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Paste any 26-character Stoat ID or Invite code (e.g. 01HJ3R9T89BCDEFGHIJKLMNOP34)..."
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-9 pr-4 py-2.5 text-xs text-white placeholder:text-neutral-500 font-mono focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-neutral-800 disabled:text-neutral-500 text-neutral-950 font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5 shrink-0"
          >
            {isLoading ? 'Inspecting...' : 'Lookup Entity'}
          </button>
        </form>

        {/* Quick Sample Links */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <span className="text-neutral-400 text-[11px]">Quick samples:</span>
          {sampleIds.map((sample) => (
            <button
              key={sample.id}
              onClick={() => {
                setQuery(sample.id);
                handleSearch(sample.id);
              }}
              className="px-2 py-0.5 rounded bg-neutral-950 border border-neutral-800 text-[11px] text-neutral-300 hover:text-white hover:border-neutral-700 font-mono transition-colors"
            >
              {sample.label}
            </button>
          ))}
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-lg flex items-center justify-between">
          <span>{actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="text-xs hover:underline">Dismiss</button>
        </div>
      )}

      {/* Result Card */}
      {result && (
        <div className="space-y-4">
          {/* ULID Timestamp Information Header */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-center">
                {getEntityIcon(result.matchedType)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-neutral-200">
                    Entity Type:
                  </span>
                  <span className="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-xs font-medium text-white">
                    {result.matchedType}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-neutral-400 mt-0.5">
                  ID: <span className="text-neutral-200">{result.query}</span>
                </div>
              </div>
            </div>

            {/* Decoded ULID Timestamp */}
            {result.decoded.isValid && (
              <div className="flex items-center gap-3 px-3 py-2 bg-neutral-950 rounded-lg border border-neutral-800/80 text-xs">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">
                    ULID Timestamp Decoded
                  </span>
                  <span className="font-mono text-neutral-200 text-xs tabular-nums">
                    {result.decoded.formattedDate} ({result.decoded.timeAgo})
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Type Specific Visual Cards */}
          {result.matchedType === 'User' && Boolean(result.data) && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
              {(() => {
                const user = result.data as User;
                const badges = parseUserBadges(user.badges);
                const flags = parseUserFlags(user.flags);

                return (
                  <div className="space-y-5">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <div className="w-14 h-14 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-lg font-bold text-neutral-200 overflow-hidden">
                          {user.username.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-white">
                              {user.display_name || user.username}
                            </h3>
                            {user.disabled || user.banned || ((user.flags || 0) & 4) ? (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono font-semibold">
                                disabled: true
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                                disabled: false
                              </span>
                            )}
                            {user.privileged && (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono">
                                privileged: true
                              </span>
                            )}
                            {user.bot && (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-mono">
                                BOT
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-neutral-400 font-mono">
                            @{user.username}#{user.discriminator}
                          </div>
                        </div>
                      </div>

                      {/* Quick Moderation Actions */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => setSelectedUserForEdit(user)}
                          className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                          title="Change username, discriminator, delete avatar, change badges, or impersonate"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                          Edit User &amp; Badges
                        </button>

                        <button
                          onClick={() => setSelectedUserForEdit(user)}
                          className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                          title="Generate session and log in as user"
                        >
                          <LogIn className="w-3.5 h-3.5" />
                          Log In as User
                        </button>

                        {onNavigateToPlatformBan && (
                          <button
                            onClick={() => onNavigateToPlatformBan(user._id)}
                            className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                            Platform Ban...
                          </button>
                        )}

                        <button
                          onClick={handleCopyJson}
                          className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                        >
                          {copiedRaw ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          Copy JSON
                        </button>
                      </div>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-neutral-800 text-xs">
                      <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800">
                        <span className="text-neutral-400 block text-[11px]">Online Presence</span>
                        <span className="text-neutral-200 font-medium capitalize mt-0.5 block">
                          {user.status?.presence || (user.online ? 'Online' : 'Offline')}
                        </span>
                        {user.status?.text && (
                          <span className="text-neutral-400 text-[11px] mt-1 block truncate">
                            &quot;{user.status.text}&quot;
                          </span>
                        )}
                      </div>

                      <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800">
                        <span className="text-neutral-400 block text-[11px]">Badges</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {badges.length > 0 ? (
                            badges.map((b) => (
                              <span key={b} className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300">
                                {b}
                              </span>
                            ))
                          ) : (
                            <span className="text-neutral-400">None</span>
                          )}
                        </div>
                      </div>

                      <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800">
                        <span className="text-neutral-400 block text-[11px]">Flags & Safety</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {flags.length > 0 ? (
                            flags.map((f) => (
                              <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300">
                                {f}
                              </span>
                            ))
                          ) : (
                            <span className="text-emerald-400 font-medium">Clean (No Flags)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Server Result */}
          {result.matchedType === 'Server' && Boolean(result.data) && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
              {(() => {
                const s = result.data as Server;
                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-emerald-400 font-bold text-lg">
                          <ServerIcon className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-white">{s.name}</h3>
                          <p className="text-xs text-neutral-400">{s.description || 'No description provided.'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {onNavigateToModeration && (
                          <button
                            onClick={() => onNavigateToModeration(undefined, s._id)}
                            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium transition-colors"
                          >
                            Manage Bans & Members
                          </button>
                        )}
                        <button
                          onClick={handleCopyJson}
                          className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Copy JSON
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-neutral-800 text-xs">
                      <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800">
                        <span className="text-neutral-400 block text-[11px]">Member Count</span>
                        <span className="text-base font-bold text-white mt-0.5 block tabular-nums">
                          {s.approximate_member_count || s.channels.length * 15}
                        </span>
                      </div>
                      <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800">
                        <span className="text-neutral-400 block text-[11px]">Channels</span>
                        <span className="text-base font-bold text-white mt-0.5 block tabular-nums">
                          {s.channels?.length || 0}
                        </span>
                      </div>
                      <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800">
                        <span className="text-neutral-400 block text-[11px]">Owner User ID</span>
                        <span className="text-xs font-mono text-neutral-300 mt-1 block truncate">
                          {s.owner}
                        </span>
                      </div>
                      <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800">
                        <span className="text-neutral-400 block text-[11px]">Discoverable</span>
                        <span className="text-xs font-medium text-neutral-200 mt-1 block">
                          {s.discoverable ? 'Public on Discover' : 'Private'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Channel Result */}
          {result.matchedType === 'Channel' && Boolean(result.data) && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
              {(() => {
                const c = result.data as Channel;
                const name = 'name' in c ? c.name : c.channel_type;
                const description = 'description' in c ? c.description : null;
                const serverId = 'server' in c ? c.server : null;

                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-center text-purple-400">
                          <Hash className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-white">#{name}</h3>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                              {c.channel_type}
                            </span>
                          </div>
                          {description && <p className="text-xs text-neutral-400 mt-0.5">{description}</p>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {onNavigateToContent && (
                          <button
                            onClick={() => onNavigateToContent(c._id)}
                            className="px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg text-xs font-medium transition-colors"
                          >
                            Open in Content Moderation
                          </button>
                        )}
                        <button
                          onClick={handleCopyJson}
                          className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Copy JSON
                        </button>
                      </div>
                    </div>

                    {serverId && (
                      <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800 text-xs flex items-center justify-between">
                        <span className="text-neutral-400">Parent Server ID:</span>
                        <code className="font-mono text-neutral-300">{serverId}</code>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Message Result */}
          {result.matchedType === 'Message' && Boolean(result.data) && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
              {(() => {
                const m = result.data as Message;
                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-neutral-400">
                        <span>Author ID: <code className="text-neutral-200 font-mono">{m.author}</code></span>
                        <span>·</span>
                        <span>Channel ID: <code className="text-neutral-200 font-mono">{m.channel}</code></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleTogglePin(m.channel, m._id, m.pinned)}
                          className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-xs flex items-center gap-1"
                        >
                          <Pin className="w-3.5 h-3.5" />
                          {m.pinned ? 'Unpin' : 'Pin'}
                        </button>
                        <button
                          onClick={() => handleDeleteMessage(m.channel, m._id)}
                          className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded text-xs flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete Message
                        </button>
                      </div>
                    </div>

                    <div className="p-3.5 bg-neutral-950 rounded-lg border border-neutral-800 text-sm text-neutral-100 font-sans leading-relaxed">
                      {m.content || <span className="italic text-neutral-400">Empty message content</span>}
                    </div>

                    {m.reactions && Object.keys(m.reactions).length > 0 && (
                      <div className="flex flex-wrap gap-2 text-xs">
                        {Object.entries(m.reactions).map(([emoji, users]) => (
                          <span key={emoji} className="px-2 py-0.5 rounded bg-neutral-950 border border-neutral-800 text-neutral-300 flex items-center gap-1">
                            <span>{emoji}</span>
                            <span className="font-mono text-[11px] text-neutral-400">{users.length}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Unknown / Not Found State */}
          {result.matchedType === 'Unknown' && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-8 text-center">
              <div className="w-12 h-12 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-center mx-auto text-neutral-500 mb-3">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-neutral-200">No Entity Found</h3>
              <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                No active records matched this ID across users, channels, servers, invites, bots, or custom emojis on this DawnChat instance.
              </p>
              {result.decoded.isValid && (
                <div className="mt-4 p-3 bg-neutral-950 rounded-lg border border-neutral-800 inline-block text-xs font-mono text-neutral-300 text-left">
                  <div>ULID Timestamp is valid:</div>
                  <div className="text-amber-400">{result.decoded.formattedDate}</div>
                </div>
              )}
            </div>
          )}

          {/* Raw JSON Inspector Accordion */}
          {Boolean(result.data) && (
            <details className="bg-neutral-900/60 border border-neutral-800 rounded-xl overflow-hidden group">
              <summary className="px-4 py-3 cursor-pointer text-xs font-semibold text-neutral-400 hover:text-neutral-200 flex items-center justify-between select-none">
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-amber-400" />
                  <span>Inspect Raw Database Document (MongoDB / JSON)</span>
                </div>
                <span className="text-[11px] text-neutral-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="p-4 bg-neutral-950 border-t border-neutral-800">
                <pre className="text-[11px] font-mono text-neutral-300 overflow-x-auto max-h-96 selection:bg-amber-500/20">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </div>
            </details>
          )}
        </div>
      )}

      {/* User Edit Modal */}
      {selectedUserForEdit && (
        <UserEditModal
          user={selectedUserForEdit}
          isOpen={Boolean(selectedUserForEdit)}
          onClose={() => setSelectedUserForEdit(null)}
          onNavigateToPlatformBan={onNavigateToPlatformBan}
          onUserUpdated={(updatedUser) => {
            setSelectedUserForEdit(updatedUser);
            if (result && result.matchedType === 'User') {
              setResult({ ...result, data: updatedUser });
            }
          }}
        />
      )}
    </div>
  );
};
