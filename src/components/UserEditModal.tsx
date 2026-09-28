import React, { useState, useEffect, useCallback } from 'react';
import { User, UserImpersonateResult, UserBadges, SafetyStrike } from '../types/stoat';
import { stoatApi } from '../services/stoatApi';
import { useAuth } from '../context/AuthContext';
import { getAutumnAvatarUrl } from '../utils/autumn';
import {
  X,
  User as UserIcon,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Key,
  Copy,
  Check,
  ExternalLink,
  Edit3,
  Award,
  AlertTriangle,
  Loader2,
  RefreshCw,
  LogIn,
  CheckCircle,
  Plus
} from 'lucide-react';

interface UserEditModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated?: (user: User) => void;
  onNavigateToPlatformBan?: (userId: string) => void;
}

// Official Stoat / Revolt Badges Bitmask (pub enum UserBadges)
export const BADGE_DEFINITIONS: { bit: number; name: string; key: keyof typeof UserBadges; description: string }[] = [
  { bit: UserBadges.Developer, name: 'Developer', key: 'Developer', description: 'Platform Core Developer' },
  { bit: UserBadges.Translator, name: 'Translator', key: 'Translator', description: 'Language Localization Contributor' },
  { bit: UserBadges.Supporter, name: 'Supporter', key: 'Supporter', description: 'Platform Financial Supporter' },
  { bit: UserBadges.ResponsibleDisclosure, name: 'Responsible Disclosure', key: 'ResponsibleDisclosure', description: 'Security Vulnerability Researcher' },
  { bit: UserBadges.Founder, name: 'Founder', key: 'Founder', description: 'Platform Founder & Genesis Contributor' },
  { bit: UserBadges.PlatformModeration, name: 'Platform Moderation', key: 'PlatformModeration', description: 'Global Instance Moderation Team' },
  { bit: UserBadges.ActiveSupporter, name: 'Active Supporter', key: 'ActiveSupporter', description: 'Recurring Active Supporter / Subscriber' },
  { bit: UserBadges.Paw, name: 'Paw', key: 'Paw', description: 'Paw Community Badge' },
  { bit: UserBadges.EarlyAdopter, name: 'Early Adopter', key: 'EarlyAdopter', description: 'Early Platform Adopter' },
  { bit: UserBadges.ReservedRelevantJokeBadge1, name: 'Reserved Relevant Joke Badge 1', key: 'ReservedRelevantJokeBadge1', description: 'Reserved Relevant Joke Badge 1' },
  { bit: UserBadges.ReservedRelevantJokeBadge2, name: 'Reserved Relevant Joke Badge 2', key: 'ReservedRelevantJokeBadge2', description: 'Reserved Relevant Joke Badge 2' },
];

export const UserEditModal: React.FC<UserEditModalProps> = ({
  user,
  isOpen,
  onClose,
  onUserUpdated,
  onNavigateToPlatformBan,
}) => {
  const { startImpersonation } = useAuth();

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<'identity' | 'avatar' | 'badges' | 'strikes' | 'login' | 'ban'>('identity');

  // Identity Form
  const [username, setUsername] = useState('');
  const [discriminator, setDiscriminator] = useState('');
  const [isSavingIdentity, setIsSavingIdentity] = useState(false);

  // Avatar State
  const [isDeletingAvatar, setIsDeletingAvatar] = useState(false);

  // Badges Form
  const [badgeMask, setBadgeMask] = useState<number>(0);
  const [isSavingBadges, setIsSavingBadges] = useState(false);

  // Strikes State
  const [strikes, setStrikes] = useState<SafetyStrike[]>([]);
  const [isLoadingStrikes, setIsLoadingStrikes] = useState(false);
  const [deletingStrikeId, setDeletingStrikeId] = useState<string | null>(null);
  const [strikeReason, setStrikeReason] = useState('');
  const [strikeSeverity, setStrikeSeverity] = useState<'Warning' | 'Strike' | 'AccountSuspension' | 'PermanentBan'>('Strike');
  const [isIssuingStrike, setIsIssuingStrike] = useState(false);
  const [showIssueStrikeForm, setShowIssueStrikeForm] = useState(false);

  // Impersonation State
  const [isGeneratingSession, setIsGeneratingSession] = useState(false);
  const [impersonateResult, setImpersonateResult] = useState<UserImpersonateResult | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // Ban / Unban State
  const [banReason, setBanReason] = useState('Terms of Service violation');
  const [isTogglingBan, setIsTogglingBan] = useState(false);

  // Notification feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadUserStrikes = useCallback(async (userId: string) => {
    setIsLoadingStrikes(true);
    try {
      const data = await stoatApi.fetchSafetyStrikes(userId);
      setStrikes(data);
    } catch (e) {
      console.warn('Failed to load user strikes', e);
    } finally {
      setIsLoadingStrikes(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setDiscriminator(user.discriminator || '0001');
      setBadgeMask(user.badges || 0);
      setFeedback(null);
      setImpersonateResult(null);
      loadUserStrikes(user._id);
    }
  }, [user, loadUserStrikes]);

  if (!isOpen || !user) return null;

  const isUserBannedOrDisabled = Boolean(user.disabled || user.banned || ((user.flags || 0) & 4));

  // 1. Handle Username & Discriminator Update
  const handleSaveIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setIsSavingIdentity(true);
    setFeedback(null);
    try {
      const updatedUser = await stoatApi.updateUserIdentity(user._id, username.trim(), discriminator.trim());
      setFeedback({ type: 'success', message: `Username updated to @${updatedUser.username}#${updatedUser.discriminator}` });
      if (onUserUpdated) onUserUpdated(updatedUser);
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setIsSavingIdentity(false);
    }
  };

  // 2. Handle Profile Avatar Deletion
  const handleDeleteAvatar = async () => {
    if (!confirm(`Are you sure you want to delete profile image for @${user.username}?`)) return;

    setIsDeletingAvatar(true);
    setFeedback(null);
    try {
      const updatedUser = await stoatApi.deleteUserAvatar(user._id);
      setFeedback({ type: 'success', message: 'Profile avatar removed successfully.' });
      if (onUserUpdated) onUserUpdated(updatedUser);
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setIsDeletingAvatar(false);
    }
  };

  // 3. Handle Badges Update
  const handleToggleBadge = (bit: number) => {
    setBadgeMask((prev) => (prev & bit ? prev & ~bit : prev | bit));
  };

  const handleSaveBadges = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingBadges(true);
    setFeedback(null);
    try {
      const updatedUser = await stoatApi.updateUserBadges(user._id, badgeMask);
      setFeedback({ type: 'success', message: `Badges updated (bitmask: ${badgeMask}).` });
      if (onUserUpdated) onUserUpdated(updatedUser);
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setIsSavingBadges(false);
    }
  };

  // 4. Handle Impersonation ("Log in as User")
  const [copiedUrl, setCopiedUrl] = useState(false);

  const handleGenerateImpersonation = async (autoRedirect = true) => {
    setIsGeneratingSession(true);
    setFeedback(null);
    try {
      const result = await stoatApi.impersonateUser(user._id);
      setImpersonateResult(result);
      const redirectUrl = result.redirect_url || `https://chat.dawn-chat.com/login/token?token=${encodeURIComponent(result.token)}`;
      if (autoRedirect) {
        window.open(redirectUrl, '_blank');
        setFeedback({
          type: 'success',
          message: `Session created in MongoDB sessions collection. Opened ${redirectUrl}`,
        });
      } else {
        setFeedback({
          type: 'success',
          message: 'Impersonation session generated successfully in MongoDB sessions collection!',
        });
      }
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setIsGeneratingSession(false);
    }
  };

  const handleSwitchConsoleToUser = async () => {
    if (!impersonateResult?.token) return;
    try {
      await startImpersonation(impersonateResult.token, { ...user, ...impersonateResult.user });
      onClose();
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  };

  const handleCopyToken = () => {
    if (!impersonateResult?.token) return;
    navigator.clipboard.writeText(impersonateResult.token);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleCopyLoginUrl = () => {
    if (!impersonateResult?.token) return;
    const url = impersonateResult.redirect_url || `https://chat.dawn-chat.com/login/token?token=${encodeURIComponent(impersonateResult.token)}`;
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  // 5. Handle Strikes (View, Issue, Revoke/Delete)
  const handleDeleteStrike = async (strikeId: string) => {
    if (!confirm(`Are you sure you want to delete and revoke safety strike #${strikeId}?`)) return;
    setDeletingStrikeId(strikeId);
    setFeedback(null);
    try {
      await stoatApi.deleteSafetyStrike(strikeId);
      setStrikes((prev) => prev.filter((s) => s._id !== strikeId));
      setFeedback({
        type: 'success',
        message: `Safety strike #${strikeId} was permanently deleted from MongoDB safety_strikes.`,
      });
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setDeletingStrikeId(null);
    }
  };

  const handleIssueStrike = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!strikeReason.trim()) return;
    setIsIssuingStrike(true);
    setFeedback(null);
    try {
      const newStrike = await stoatApi.issueSafetyStrike(user._id, strikeReason.trim(), strikeSeverity);
      setStrikes((prev) => [newStrike, ...prev]);
      setStrikeReason('');
      setShowIssueStrikeForm(false);
      setFeedback({
        type: 'success',
        message: `Safety ${strikeSeverity} successfully issued against @${user.username}.`,
      });
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setIsIssuingStrike(false);
    }
  };

  // 6. Handle Ban / Unban
  const handleUnbanUser = async () => {
    setIsTogglingBan(true);
    setFeedback(null);
    try {
      await stoatApi.revokePlatformBan(user._id);
      const updated: User = { ...user, disabled: false, banned: false, flags: (user.flags || 0) & ~4 };
      setFeedback({ type: 'success', message: `User @${user.username} unbanned. Account set to disabled: false.` });
      if (onUserUpdated) onUserUpdated(updated);
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setIsTogglingBan(false);
    }
  };

  const handleBanUser = async () => {
    setIsTogglingBan(true);
    setFeedback(null);
    try {
      await stoatApi.createPlatformBan(user._id, banReason);
      const updated: User = { ...user, disabled: true, banned: true, flags: (user.flags || 0) | 4 };
      setFeedback({ type: 'success', message: `User @${user.username} banned platform-wide. Account changed to disabled: true.` });
      if (onUserUpdated) onUserUpdated(updated);
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setIsTogglingBan(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header Profile Bar */}
        <div className="p-6 bg-gradient-to-r from-neutral-900 via-neutral-900 to-neutral-950 border-b border-neutral-800 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              {user.avatar ? (
                <img
                  src={getAutumnAvatarUrl(user.avatar._id, user.avatar.filename)}
                  alt={user.username}
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                  className="w-14 h-14 rounded-full object-cover border-2 border-neutral-700 bg-neutral-800"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-neutral-800 border-2 border-neutral-700 flex items-center justify-center text-lg font-bold text-white uppercase">
                  {user.username.slice(0, 2)}
                </div>
              )}
              {isUserBannedOrDisabled && (
                <div
                  title="Platform Banned / Disabled"
                  className="absolute -bottom-1 -right-1 p-1 bg-rose-600 rounded-full text-white text-[10px]"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-white">
                  {user.display_name || user.username}
                </h3>
                {isUserBannedOrDisabled ? (
                  <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono font-semibold">
                    disabled: true
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono font-semibold">
                    disabled: false
                  </span>
                )}
                {user.privileged && (
                  <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                    privileged: true
                  </span>
                )}
              </div>
              <div className="text-xs text-neutral-400 font-mono mt-0.5">
                @{user.username}#{user.discriminator} · <span className="text-neutral-500">{user._id}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-neutral-800/80 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center border-b border-neutral-800 bg-neutral-950/60 px-4 text-xs font-medium overflow-x-auto">
          <button
            onClick={() => setActiveTab('identity')}
            className={`px-3 py-2.5 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'identity'
                ? 'border-amber-400 text-amber-400 font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            Username & Discriminator
          </button>

          <button
            onClick={() => setActiveTab('avatar')}
            className={`px-3 py-2.5 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'avatar'
                ? 'border-amber-400 text-amber-400 font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Profile Image
          </button>

          <button
            onClick={() => setActiveTab('badges')}
            className={`px-3 py-2.5 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'badges'
                ? 'border-amber-400 text-amber-400 font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            Badges ({badgeMask})
          </button>

          <button
            onClick={() => setActiveTab('strikes')}
            className={`px-3 py-2.5 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'strikes'
                ? 'border-amber-400 text-amber-400 font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Safety Strikes ({strikes.length})
          </button>

          <button
            onClick={() => setActiveTab('login')}
            className={`px-3 py-2.5 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'login'
                ? 'border-indigo-400 text-indigo-400 font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            Log In as User
          </button>

          <button
            onClick={() => setActiveTab('ban')}
            className={`px-3 py-2.5 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'ban'
                ? 'border-rose-400 text-rose-400 font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Platform Ban / Unban
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {feedback && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center justify-between border ${
                feedback.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              <span>{feedback.message}</span>
              <button onClick={() => setFeedback(null)} className="text-[11px] hover:underline">
                Dismiss
              </button>
            </div>
          )}

          {/* TAB 1: Edit Username and Discriminator */}
          {activeTab === 'identity' && (
            <form onSubmit={handleSaveIdentity} className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                  Update Account Handle & Discriminator
                </h4>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Directly modifies the user&apos;s username and discriminator tag in MongoDB <code className="font-mono text-neutral-300">users</code> and <code className="font-mono text-neutral-300">accounts</code> collections.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Username:
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. alice"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Discriminator:
                  </label>
                  <div className="flex items-center">
                    <span className="px-2 py-2 bg-neutral-800 border border-r-0 border-neutral-700 text-neutral-400 text-xs font-mono rounded-l-lg">
                      #
                    </span>
                    <input
                      type="text"
                      required
                      maxLength={4}
                      value={discriminator}
                      onChange={(e) => setDiscriminator(e.target.value.replace(/\D/g, ''))}
                      placeholder="0001"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-r-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-neutral-800">
                <span className="text-[11px] text-neutral-500">
                  Audit action: <code className="text-neutral-400">UserIdentityChange</code>
                </span>
                <button
                  type="submit"
                  disabled={isSavingIdentity || !username.trim()}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  {isSavingIdentity ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save Handle
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: Delete Profile Images */}
          {activeTab === 'avatar' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                  Profile Image Moderation
                </h4>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Allows administrators to delete inappropriate, copyright-infringing, or offensive profile pictures directly from the user&apos;s record in MongoDB.
                </p>
              </div>

              <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {user.avatar ? (
                    <div className="w-16 h-16 rounded-full overflow-hidden border border-neutral-700 bg-neutral-800">
                      <img
                        src={getAutumnAvatarUrl(user.avatar._id, user.avatar.filename)}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-xs text-neutral-400 font-mono">
                      No Avatar
                    </div>
                  )}

                  <div>
                    <span className="text-xs font-semibold text-white block">
                      {user.avatar ? user.avatar.filename || 'Active Profile Picture' : 'Default Generic Avatar'}
                    </span>
                    <span className="text-[11px] font-mono text-neutral-500 block">
                      {user.avatar ? `ID: ${user.avatar._id} · ${user.avatar.size ? (user.avatar.size / 1024).toFixed(1) + ' KB' : ''}` : 'User has no custom uploaded avatar'}
                    </span>
                  </div>
                </div>

                {user.avatar && (
                  <button
                    onClick={handleDeleteAvatar}
                    disabled={isDeletingAvatar}
                    className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                  >
                    {isDeletingAvatar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Delete Profile Image
                  </button>
                )}
              </div>

              {!user.avatar && (
                <div className="p-3 bg-neutral-950 border border-neutral-800 text-neutral-400 text-xs rounded-lg flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>This user currently has no custom avatar to remove.</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Change Badges */}
          {activeTab === 'badges' && (
            <form onSubmit={handleSaveBadges} className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                    User Badges Bitmask
                  </h4>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Toggle official badges or enter a custom bitmask integer in the MongoDB <code className="font-mono text-neutral-300">users.badges</code> field.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-neutral-500 uppercase font-mono block">Bitmask Value</span>
                  <input
                    type="number"
                    min={0}
                    value={badgeMask}
                    onChange={(e) => setBadgeMask(parseInt(e.target.value || '0', 10))}
                    className="w-24 bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs font-mono text-amber-400 text-right font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {BADGE_DEFINITIONS.map((badge) => {
                  const isChecked = (badgeMask & badge.bit) !== 0;
                  return (
                    <label
                      key={badge.bit}
                      className={`p-3 rounded-lg border text-xs cursor-pointer flex items-start gap-3 transition-colors ${
                        isChecked
                          ? 'bg-amber-500/10 border-amber-500/40 text-neutral-200'
                          : 'bg-neutral-950 border-neutral-800/80 text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleBadge(badge.bit)}
                        className="mt-0.5 rounded border-neutral-700 bg-neutral-900 text-amber-500 focus:ring-0 focus:ring-offset-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={`font-semibold ${isChecked ? 'text-amber-300' : 'text-neutral-200'}`}>
                            {badge.name}
                          </span>
                          <span className="text-[10px] font-mono text-neutral-500">
                            1 &lt;&lt; {Math.log2(badge.bit)} ({badge.bit})
                          </span>
                        </div>
                        <span className="text-[11px] text-neutral-400 block truncate">
                          {badge.description}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-neutral-800">
                <span className="text-[11px] text-neutral-500">
                  Total calculated badges: <strong className="text-amber-400 font-mono">{badgeMask}</strong>
                </span>
                <button
                  type="submit"
                  disabled={isSavingBadges}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  {isSavingBadges ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Award className="w-3.5 h-3.5" />}
                  Save Badges
                </button>
              </div>
            </form>
          )}

          {/* TAB: Safety Strikes & Disciplinary Record */}
          {activeTab === 'strikes' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                <div>
                  <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    Safety Strikes &amp; Disciplinary Record
                  </h4>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Logged in MongoDB <code className="font-mono text-neutral-300">safety_strikes</code>. Administrators can issue, inspect, and permanently delete/revoke strikes.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => loadUserStrikes(user._id)}
                    disabled={isLoadingStrikes}
                    className="p-1.5 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-neutral-400 hover:text-white text-xs transition-colors"
                    title="Refresh strikes"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStrikes ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => setShowIssueStrikeForm((prev) => !prev)}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{showIssueStrikeForm ? 'Hide Form' : 'Issue Strike'}</span>
                  </button>
                </div>
              </div>

              {/* Issue Strike Form */}
              {showIssueStrikeForm && (
                <form onSubmit={handleIssueStrike} className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                      Issue Formal Safety Strike
                    </span>
                    <span className="text-[10px] font-mono text-neutral-500">
                      Target: @{user.username} ({user._id})
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-neutral-400 mb-1">
                        Severity Level:
                      </label>
                      <select
                        value={strikeSeverity}
                        onChange={(e) => setStrikeSeverity(e.target.value as any)}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                      >
                        <option value="Warning">Warning (Informational)</option>
                        <option value="Strike">Strike (Disciplinary Point)</option>
                        <option value="AccountSuspension">AccountSuspension (Temporary Lock)</option>
                        <option value="PermanentBan">PermanentBan (Global Revocation)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-neutral-400 mb-1">
                        Violation Reason:
                      </label>
                      <input
                        type="text"
                        required
                        value={strikeReason}
                        onChange={(e) => setStrikeReason(e.target.value)}
                        placeholder="e.g., Harassment or spam in community channels"
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowIssueStrikeForm(false)}
                      className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isIssuingStrike || !strikeReason.trim()}
                      className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-lg text-xs flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isIssuingStrike ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                      <span>Confirm &amp; Record Strike</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Strikes List */}
              {isLoadingStrikes ? (
                <div className="p-8 text-center bg-neutral-950 rounded-xl border border-neutral-800 text-neutral-400 text-xs flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Loading safety strikes from database...</span>
                </div>
              ) : strikes.length === 0 ? (
                <div className="p-8 text-center bg-neutral-950 rounded-xl border border-neutral-800">
                  <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-xs text-neutral-200 font-semibold">Clean Disciplinary Record</p>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    This account has 0 safety strikes or warnings recorded in MongoDB.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                  {strikes.map((s) => {
                    const isDeletingThis = deletingStrikeId === s._id;
                    return (
                      <div
                        key={s._id}
                        className="p-3.5 bg-neutral-950 border border-neutral-800 hover:border-neutral-700 rounded-xl flex items-start justify-between gap-3 text-xs transition-colors"
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                                s.severity === 'PermanentBan'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                  : s.severity === 'AccountSuspension'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                              }`}
                            >
                              {s.severity}
                            </span>
                            <span className="font-mono text-[11px] text-neutral-400">
                              ID: <span className="text-neutral-200 select-all font-semibold">{s._id}</span>
                            </span>
                            {s.report_id && (
                              <span className="font-mono text-[10px] text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">
                                Report #{s.report_id}
                              </span>
                            )}
                          </div>

                          <div className="text-white font-medium text-xs break-words">
                            {s.reason}
                          </div>

                          <div className="text-[10px] font-mono text-neutral-500 flex items-center gap-2 flex-wrap">
                            <span>
                              Issued by <strong className="text-neutral-300">{s.actor?.username || s.actor_id}</strong>
                            </span>
                            <span>·</span>
                            <span>{new Date(s.created_at).toLocaleString()}</span>
                          </div>
                        </div>

                        {/* DELETE / REVOKE STRIKE BUTTON */}
                        <button
                          onClick={() => handleDeleteStrike(s._id)}
                          disabled={isDeletingThis}
                          className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 disabled:opacity-50"
                          title="Delete / Revoke this strike from database"
                        >
                          {isDeletingThis ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                          )}
                          <span>Delete Strike</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Log In as User (Impersonation) */}
          {activeTab === 'login' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                  <Key className="w-4 h-4 text-indigo-400" />
                  Impersonate &amp; Log In as User
                </h4>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Generates an authorized session directly inside the Stoat MongoDB <code className="font-mono text-neutral-300">sessions</code> collection, permitting administrative impersonation to verify permissions, inspect DMs, or reproduce reported issues.
                </p>
              </div>

              {!impersonateResult ? (
                <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                      <LogIn className="w-5 h-5" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-indigo-200">
                        Ready to impersonate @{user.username}
                      </h5>
                      <p className="text-[11px] text-indigo-300/80">
                        Generates a session in MongoDB <code className="font-mono">sessions</code> and redirects directly to <code className="font-mono text-indigo-200">https://chat.dawn-chat.com/login/token?token=...</code>
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleGenerateImpersonation(true)}
                    disabled={isGeneratingSession}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
                  >
                    {isGeneratingSession ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <LogIn className="w-4 h-4" />
                    )}
                    Generate Session &amp; Redirect to DawnChat as @{user.username}
                  </button>
                </div>
              ) : (
                <div className="space-y-3.5 p-4 bg-neutral-950 rounded-xl border border-neutral-800">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs pb-2 border-b border-neutral-800 gap-1">
                    <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                      <Check className="w-4 h-4" /> {impersonateResult.session_name || 'Session Created in MongoDB (sessions)'}
                    </span>
                    <span className="font-mono text-[10px] text-neutral-500">
                      ULID: {impersonateResult.session_id}
                    </span>
                  </div>

                  {/* Direct Token URL Redirect Card */}
                  <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg space-y-2">
                    <label className="block text-[11px] font-semibold text-indigo-300">
                      Direct Token Login URL:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={impersonateResult.redirect_url || `https://chat.dawn-chat.com/login/token?token=${encodeURIComponent(impersonateResult.token)}`}
                        className="flex-1 bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 text-xs font-mono text-indigo-300 select-all"
                      />
                      <button
                        onClick={handleCopyLoginUrl}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium flex items-center gap-1.5 shrink-0 transition-colors"
                      >
                        {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedUrl ? 'Copied' : 'Copy URL'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">
                      Raw Session Token (<code className="font-mono text-emerald-400">x-session-token</code>):
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={impersonateResult.token}
                        className="flex-1 bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 text-xs font-mono text-emerald-400 select-all"
                      />
                      <button
                        onClick={handleCopyToken}
                        className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-xs font-medium flex items-center gap-1.5 shrink-0"
                      >
                        {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedToken ? 'Copied' : 'Copy Token'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                    <a
                      href={impersonateResult.redirect_url || `https://chat.dawn-chat.com/login/token?token=${encodeURIComponent(impersonateResult.token)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/20"
                      title="Open DawnChat Web Client and Login Automatically"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open DawnChat Client as @{user.username}
                    </a>

                    <button
                      onClick={handleSwitchConsoleToUser}
                      className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                    >
                      <LogIn className="w-3.5 h-3.5 text-amber-400" />
                      Switch Console to This User
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: Ban / Unban */}
          {activeTab === 'ban' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                  Platform Ban &amp; Account Disablement
                </h4>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Banning toggles <code className="font-mono text-rose-400">disabled: true</code> on the account, purges active sessions, and applies global platform enforcement. Unbanning restores <code className="font-mono text-emerald-400">disabled: false</code>.
                </p>
              </div>

              <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-300">
                    Current Account Status:
                  </span>
                  {isUserBannedOrDisabled ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      BANNED (disabled: true)
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      ACTIVE (disabled: false)
                    </span>
                  )}
                </div>

                {isUserBannedOrDisabled ? (
                  <div className="space-y-3">
                    <p className="text-xs text-neutral-400">
                      This user cannot log in or interact with the platform. Click below to revoke the platform ban, delete the ban record, and restore their account access (<code className="font-mono text-emerald-400">disabled: false</code>).
                    </p>

                    <button
                      onClick={handleUnbanUser}
                      disabled={isTogglingBan}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
                    >
                      {isTogglingBan ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      Unban User &amp; Restore Account (disabled: false)
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1">
                        Reason for Platform Ban:
                      </label>
                      <input
                        type="text"
                        value={banReason}
                        onChange={(e) => setBanReason(e.target.value)}
                        placeholder="Severe violation of instance terms..."
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                      />
                    </div>

                    <button
                      onClick={handleBanUser}
                      disabled={isTogglingBan}
                      className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20"
                    >
                      {isTogglingBan ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                      Issue Platform Ban (Sets disabled: true)
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
