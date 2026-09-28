/**
 * DawnChat Stoat / Revolt API Client
 * Primary backend: api.dawn-chat.com
 */

import {
  User,
  Server,
  EnrichedServer,
  Channel,
  Message,
  ServerBan,
  AuditLogEntry,
  RevoltConfig,
  InviteInfo,
  BotInfo,
  PlatformBot,
  CustomEmoji,
  WebhookInfo,
  FileAttachment,
  PlatformBan,
  PlatformReport,
  PlatformAuditLog,
  SafetyStrike,
  MongoDbStatus,
  UserImpersonateResult,
  CommunicationBroadcastRequest,
  CommunicationBroadcastResult
} from '../types/stoat';
import {
  MOCK_ADMIN_USER,
  MOCK_REGULAR_USER,
  MOCK_AUDIT_LOGS,
  MOCK_BANNED_USERS,
  MOCK_BANS,
  MOCK_CHANNELS,
  MOCK_MESSAGES,
  MOCK_REVOLT_CONFIG,
  MOCK_SERVERS,
  MOCK_USERS_MAP,
  MOCK_PLATFORM_BANS,
  MOCK_PLATFORM_REPORTS,
  MOCK_PLATFORM_AUDIT_LOGS,
  MOCK_PLATFORM_BOTS
} from './mockData';
import { decodeStoatId, DecodedIdInfo } from '../utils/stoatId';

export interface ApiConfig {
  baseUrl: string;
  clientUrl: string;
  sessionToken: string;
  useProxy: boolean;
  isDemo: boolean;
}

const DEFAULT_CONFIG: ApiConfig = {
  baseUrl: 'https://api.dawn-chat.com',
  clientUrl: 'https://chat.dawn-chat.com',
  sessionToken: '',
  useProxy: true,
  isDemo: false,
};

class StoatApiClient {
  private config: ApiConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): ApiConfig {
    try {
      const stored = localStorage.getItem('dawnchat_admin_config');
      if (stored) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to load stored config', e);
    }
    return { ...DEFAULT_CONFIG };
  }

  public saveConfig(newConfig: Partial<ApiConfig>): void {
    this.config = { ...this.config, ...newConfig };
    try {
      localStorage.setItem('dawnchat_admin_config', JSON.stringify(this.config));
    } catch (e) {
      console.warn('Failed to save config to localStorage', e);
    }
  }

  public getConfig(): ApiConfig {
    return { ...this.config };
  }

  public setToken(token: string): void {
    this.saveConfig({ sessionToken: token });
  }

  public setDemoMode(isDemo: boolean): void {
    this.saveConfig({ isDemo });
  }

  public setBaseUrl(baseUrl: string): void {
    const clean = baseUrl.trim().replace(/\/+$/, '');
    this.saveConfig({ baseUrl: clean });
  }

  public setProxy(useProxy: boolean): void {
    this.saveConfig({ useProxy });
  }

  private async request<T>(
    endpoint: string,
    options: {
      method?: string;
      body?: unknown;
      headers?: Record<string, string>;
      auditReason?: string;
      idempotencyKey?: string;
    } = {}
  ): Promise<T> {
    const { method = 'GET', body, headers = {}, auditReason, idempotencyKey } = options;

    if (
      this.config.isDemo ||
      this.config.sessionToken?.startsWith('demo_') ||
      this.config.sessionToken?.startsWith('mock_')
    ) {
      return this.handleMockRequest<T>(endpoint, method, body);
    }

    const cleanBase = this.config.baseUrl.replace(/\/+$/, '');
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const directUrl = `${cleanBase}${cleanEndpoint}`;

    const reqHeaders: Record<string, string> = {
      'Accept': 'application/json',
      ...headers,
    };

    if (this.config.sessionToken) {
      reqHeaders['x-session-token'] = this.config.sessionToken;
    }
    if (auditReason) {
      reqHeaders['X-Audit-Log-Reason'] = auditReason;
    }
    if (idempotencyKey) {
      reqHeaders['Idempotency-Key'] = idempotencyKey;
    }
    if (body !== undefined && !reqHeaders['Content-Type']) {
      reqHeaders['Content-Type'] = 'application/json';
    }

    const requestBody = body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined;

    let targetFetchUrl = directUrl;
    if (this.config.useProxy) {
      targetFetchUrl = `/api/proxy?target=${encodeURIComponent(directUrl)}`;
    }

    let response: Response;
    try {
      response = await fetch(targetFetchUrl, {
        method,
        headers: reqHeaders,
        body: requestBody,
      });
    } catch (err: unknown) {
      // If direct request failed with NetworkError/CORS, try fallback to proxy if not already on proxy
      if (!this.config.useProxy) {
        console.warn('Direct fetch failed, falling back to proxy...', err);
        const proxyUrl = `/api/proxy?target=${encodeURIComponent(directUrl)}`;
        response = await fetch(proxyUrl, {
          method,
          headers: reqHeaders,
          body: requestBody,
        });
      } else {
        throw new Error(`Connection to DawnChat API failed: ${err instanceof Error ? err.message : String(err)}. Check that ${this.config.baseUrl} is reachable.`);
      }
    }

    if (!response.ok) {
      let errorData: { type?: string; msg?: string; error?: string } = {};
      try {
        errorData = await response.json();
      } catch {
        // Not JSON
      }

      const errorMessage =
        errorData.msg ||
        errorData.type ||
        errorData.error ||
        `HTTP Error ${response.status}: ${response.statusText}`;

      throw new Error(errorMessage);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  }

  // Live API Methods
  public async queryNode(): Promise<RevoltConfig> {
    return this.request<RevoltConfig>('/');
  }

  public async login(email: string, password: string, friendlyName = 'DawnChat Admin Console') {
    return this.request<{
      result: 'Success' | 'MFA' | 'Disabled';
      _id?: string;
      token?: string;
      user_id?: string;
      ticket?: string;
      allowed_methods?: string[];
    }>('/auth/session/login', {
      method: 'POST',
      body: { email, password, friendly_name: friendlyName },
    });
  }

  public async completeMfa(ticket: string, mfaResponse: { totp_code?: string; password?: string; recovery_code?: string }) {
    return this.request<{
      _id: string;
      account_id: string;
      token: string;
      authorised: boolean;
      validated: boolean;
    }>('/auth/mfa/ticket', {
      method: 'PUT',
      headers: { 'x-mfa-ticket': ticket },
      body: mfaResponse,
    });
  }

  public async fetchSelf(): Promise<User> {
    return this.request<User>('/users/@me');
  }

  public async fetchUser(target: string): Promise<User> {
    return this.request<User>(`/users/${target}`);
  }

  public async fetchUserProfile(target: string) {
    return this.request<{ content?: string | null; background?: FileAttachment | null }>(`/users/${target}/profile`);
  }

  public async fetchUserFlags(target: string) {
    return this.request<{ flags: number }>(`/users/${target}/flags`);
  }

  public async fetchServer(target: string, includeChannels = true): Promise<Server> {
    return this.request<Server>(`/servers/${target}?include_channels=${includeChannels}`);
  }

  public async fetchServerBans(server: string): Promise<{ bans: ServerBan[]; users: { _id: string; username: string; discriminator: string; avatar?: FileAttachment | null }[] }> {
    return this.request<{ bans: ServerBan[]; users: { _id: string; username: string; discriminator: string; avatar?: FileAttachment | null }[] }>(`/servers/${server}/bans`);
  }

  public async banUser(
    server: string,
    target: string,
    reason?: string,
    deleteMessageSeconds?: number,
    auditReason?: string
  ): Promise<ServerBan> {
    return this.request<ServerBan>(`/servers/${server}/bans/${target}`, {
      method: 'PUT',
      body: {
        reason: reason || undefined,
        delete_message_seconds: deleteMessageSeconds || undefined,
      },
      auditReason: auditReason || `Banned by DawnChat Admin (${reason || 'Rule violation'})`,
    });
  }

  public async unbanUser(server: string, target: string, auditReason?: string): Promise<void> {
    await this.request<void>(`/servers/${server}/bans/${target}`, {
      method: 'DELETE',
      auditReason: auditReason || 'Unbanned via DawnChat Admin Console',
    });
  }

  public async kickMember(server: string, member: string, auditReason?: string): Promise<void> {
    await this.request<void>(`/servers/${server}/members/${member}`, {
      method: 'DELETE',
      auditReason: auditReason || 'Kicked via DawnChat Admin Console',
    });
  }

  public async timeoutMember(server: string, member: string, timeoutISO: string | null, auditReason?: string): Promise<void> {
    await this.request<void>(`/servers/${server}/members/${member}`, {
      method: 'PATCH',
      body: { timeout: timeoutISO },
      auditReason: auditReason || 'Timeout modified via DawnChat Admin Console',
    });
  }

  public async fetchServerMembers(server: string): Promise<{ members: unknown[]; users: User[] }> {
    return this.request<{ members: unknown[]; users: User[] }>(`/servers/${server}/members`);
  }

  public async fetchAuditLogs(server: string, limit = 50): Promise<{ audit_logs: AuditLogEntry[]; users: User[]; members: unknown[] }> {
    return this.request<{ audit_logs: AuditLogEntry[]; users: User[]; members: unknown[] }>(`/servers/${server}/audit_logs?limit=${limit}`);
  }

  public async fetchChannel(target: string): Promise<Channel> {
    return this.request<Channel>(`/channels/${target}`);
  }

  public async fetchMessages(
    channel: string,
    limit = 50,
    before?: string,
    after?: string
  ): Promise<{ messages: Message[]; users?: User[] }> {
    const params = new URLSearchParams({
      limit: String(limit),
      include_users: 'true',
    });
    if (before) params.set('before', before);
    if (after) params.set('after', after);

    const res = await this.request<Message[] | { messages: Message[]; users?: User[] }>(`/channels/${channel}/messages?${params.toString()}`);
    if (Array.isArray(res)) {
      return { messages: res };
    }
    return res;
  }

  public async searchMessages(channel: string, query: string): Promise<{ messages: Message[]; users?: User[] }> {
    const res = await this.request<Message[] | { messages: Message[]; users?: User[] }>(`/channels/${channel}/search`, {
      method: 'POST',
      body: { query, limit: 50, include_users: true },
    });
    if (Array.isArray(res)) {
      return { messages: res };
    }
    return res;
  }

  public async deleteMessage(channel: string, msg: string, auditReason?: string): Promise<void> {
    await this.request<void>(`/channels/${channel}/messages/${msg}`, {
      method: 'DELETE',
      auditReason: auditReason || 'Moderation deletion via DawnChat Admin Console',
    });
  }

  public async bulkDeleteMessages(channel: string, ids: string[], auditReason?: string): Promise<void> {
    await this.request<void>(`/channels/${channel}/messages/bulk`, {
      method: 'DELETE',
      body: { ids },
      auditReason: auditReason || `Bulk purge of ${ids.length} messages via DawnChat Admin Console`,
    });
  }

  public async pinMessage(channel: string, msg: string): Promise<void> {
    await this.request<void>(`/channels/${channel}/messages/${msg}/pin`, {
      method: 'POST',
    });
  }

  public async unpinMessage(channel: string, msg: string): Promise<void> {
    await this.request<void>(`/channels/${channel}/messages/${msg}/pin`, {
      method: 'DELETE',
    });
  }

  public async clearReactions(channel: string, msg: string): Promise<void> {
    await this.request<void>(`/channels/${channel}/messages/${msg}/reactions`, {
      method: 'DELETE',
    });
  }

  public async deleteChannel(channel: string, auditReason?: string): Promise<void> {
    await this.request<void>(`/channels/${channel}`, {
      method: 'DELETE',
      auditReason: auditReason || 'Channel closed via DawnChat Admin Console',
    });
  }

  public async createChannel(server: string, name: string, description?: string, nsfw?: boolean, auditReason?: string) {
    return this.request<Channel>(`/servers/${server}/channels`, {
      method: 'POST',
      body: { name, description, nsfw, type: 'Text' },
      auditReason: auditReason || 'Created channel via DawnChat Admin Console',
    });
  }

  public async fetchInvite(code: string): Promise<InviteInfo> {
    return this.request<InviteInfo>(`/invites/${code}`);
  }

  public async fetchBot(botId: string): Promise<{ bot: BotInfo; user: User }> {
    return this.request<{ bot: BotInfo; user: User }>(`/bots/${botId}`);
  }

  public async fetchEmoji(emojiId: string): Promise<CustomEmoji> {
    return this.request<CustomEmoji>(`/custom/emoji/${emojiId}`);
  }

  public async fetchWebhook(webhookId: string): Promise<WebhookInfo> {
    return this.request<WebhookInfo>(`/webhooks/${webhookId}`);
  }

  public async reportContent(data: {
    content:
      | { type: 'User'; id: string; report_reason: string }
      | { type: 'Message'; id: string; report_reason: string }
      | { type: 'Server'; id: string; report_reason: string };
    additional_context?: string;
  }): Promise<void> {
    if (this.config.isDemo) {
      const newReport: PlatformReport = {
        _id: `rep_${Date.now()}`,
        author_id: this.config.sessionToken ? 'current_admin' : 'community_user',
        content_type: data.content.type,
        content_id: data.content.id,
        report_reason: data.content.report_reason,
        additional_context: data.additional_context,
        status: 'Open',
        created_at: new Date().toISOString(),
      };
      MOCK_PLATFORM_REPORTS.unshift(newReport);
      return;
    }

    try {
      await this.request<void>('/safety/report', {
        method: 'POST',
        body: data,
      });
    } catch {
      // Also log locally or via server
    }
  }

  // ==========================================
  // Direct MongoDB Platform-wide Moderation
  // ==========================================

  public async getMongoDbStatus(): Promise<MongoDbStatus> {
    if (this.config.isDemo) {
      return {
        connected: true,
        dbName: 'revolt (Mock Main Database)',
        host: 'localhost:27017',
        isMock: true,
        collections: [
          { name: 'users', count: 1420 },
          { name: 'servers', count: 48 },
          { name: 'channels', count: 215 },
          { name: 'messages', count: 84320 },
          { name: 'platform_bans', count: MOCK_PLATFORM_BANS.length },
          { name: 'safety_reports', count: MOCK_PLATFORM_REPORTS.length },
          { name: 'platform_audit_logs', count: MOCK_PLATFORM_AUDIT_LOGS.length },
        ]
      };
    }

    try {
      const res = await fetch('/api/mongo/status');
      if (res.ok) {
        return (await res.json()) as MongoDbStatus;
      }
    } catch {
      // Fallback
    }

    return {
      connected: false,
      dbName: 'revolt',
      error: 'Backend MongoDB service uncontactable',
    };
  }

  public async configureMongoDb(uri: string, dbName?: string): Promise<MongoDbStatus> {
    if (this.config.isDemo) {
      return this.getMongoDbStatus();
    }
    const res = await fetch('/api/mongo/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uri, dbName }),
    });
    return (await res.json()) as MongoDbStatus;
  }

  public async fetchPlatformBans(): Promise<PlatformBan[]> {
    if (this.config.isDemo) {
      return [...MOCK_PLATFORM_BANS];
    }
    try {
      const res = await fetch('/api/mongo/bans');
      if (res.ok) {
        const data = await res.json();
        return data.bans || [];
      }
    } catch (err) {
      console.warn('Failed to fetch platform bans from MongoDB endpoint, using mock fallback', err);
    }
    return [...MOCK_PLATFORM_BANS];
  }

  public async createPlatformBan(
    userId: string,
    reason?: string,
    ipAddress?: string,
    reportId?: string,
    resolveReport = true,
    recordStrike = true
  ): Promise<PlatformBan> {
    const actor = MOCK_ADMIN_USER._id;
    if (this.config.isDemo) {
      const banDoc: PlatformBan = {
        _id: `pban_${userId}_${Date.now()}`,
        user_id: userId,
        reason: reason || 'Platform Terms of Service violation',
        banned_by: actor,
        ip_address: ipAddress || null,
        created_at: new Date().toISOString(),
        active: true,
        user: MOCK_USERS_MAP[userId] || null,
      };
      MOCK_PLATFORM_BANS.unshift(banDoc);
      if (MOCK_USERS_MAP[userId]) {
        MOCK_USERS_MAP[userId].flags = (MOCK_USERS_MAP[userId].flags || 0) | 4;
        MOCK_USERS_MAP[userId].disabled = true;
        MOCK_USERS_MAP[userId].banned = true;
      }
      MOCK_PLATFORM_AUDIT_LOGS.unshift({
        _id: `pal_${Date.now()}`,
        action: 'PlatformBanCreate',
        actor_id: actor,
        actor: MOCK_ADMIN_USER,
        target_id: userId,
        target_type: 'User',
        reason: reason || 'Platform violation',
        created_at: new Date().toISOString(),
      });
      return banDoc;
    }

    const res = await fetch('/api/mongo/bans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        reason,
        banned_by: actor,
        ip_address: ipAddress,
        report_id: reportId,
        resolve_report: resolveReport,
        record_strike: recordStrike
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}: Failed to create platform ban`);
    }
    return (await res.json()) as PlatformBan;
  }

  public async issueSafetyStrike(
    userId: string,
    reason: string,
    severity: 'Warning' | 'Strike' | 'AccountSuspension' | 'PermanentBan' = 'Strike',
    reportId?: string
  ): Promise<SafetyStrike> {
    const res = await fetch('/api/mongo/safety/strikes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        report_id: reportId,
        reason,
        severity,
        actor_id: MOCK_ADMIN_USER._id,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}: Failed to issue safety strike`);
    }
    const data = await res.json();
    return data.strike;
  }

  public async fetchSafetyStrikes(userId?: string, reportId?: string): Promise<SafetyStrike[]> {
    const params = new URLSearchParams();
    if (userId) params.set('user_id', userId);
    if (reportId) params.set('report_id', reportId);
    try {
      const res = await fetch(`/api/mongo/safety/strikes?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        return data.strikes || [];
      }
    } catch (e) {
      console.warn('Failed to fetch safety strikes', e);
    }
    return [];
  }

  public async deleteSafetyStrike(strikeId: string): Promise<void> {
    const res = await fetch(`/api/mongo/safety/strikes?id=${encodeURIComponent(strikeId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}: Failed to delete safety strike`);
    }
  }

  public async revokePlatformBan(userId: string): Promise<void> {
    if (this.config.isDemo) {
      const idx = MOCK_PLATFORM_BANS.findIndex((b) => b.user_id === userId);
      if (idx !== -1) {
        MOCK_PLATFORM_BANS.splice(idx, 1);
      }
      if (MOCK_USERS_MAP[userId]) {
        MOCK_USERS_MAP[userId].flags = (MOCK_USERS_MAP[userId].flags || 0) & ~4;
        MOCK_USERS_MAP[userId].disabled = false;
        MOCK_USERS_MAP[userId].banned = false;
      }
      MOCK_PLATFORM_AUDIT_LOGS.unshift({
        _id: `pal_${Date.now()}`,
        action: 'PlatformBanDelete',
        actor_id: MOCK_ADMIN_USER._id,
        actor: MOCK_ADMIN_USER,
        target_id: userId,
        target_type: 'User',
        reason: 'Platform ban revoked by admin',
        created_at: new Date().toISOString(),
      });
      return;
    }

    // Try dedicated unban endpoint first
    try {
      const unbanRes = await fetch('/api/mongo/unban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      if (unbanRes.ok) {
        return;
      }
    } catch {
      // Fallback to DELETE
    }

    const res = await fetch(`/api/mongo/bans?user_id=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}: Failed to revoke platform ban`);
    }
  }

  // ==========================================
  // Platform Users & Direct Management
  // ==========================================

  public async fetchMongoUsers(query = '', limit = 50): Promise<User[]> {
    if (this.config.isDemo) {
      const q = query.toLowerCase().trim();
      let users = Object.values(MOCK_USERS_MAP);
      if (q) {
        users = users.filter((u) =>
          u._id.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q) ||
          u.discriminator.includes(q) ||
          u.display_name?.toLowerCase().includes(q)
        );
      }
      return users.slice(0, limit);
    }

    try {
      const res = await fetch(`/api/mongo/users?q=${encodeURIComponent(query)}&limit=${limit}`);
      if (res.ok) {
        const data = await res.json();
        return data.users || [];
      }
    } catch (err) {
      console.warn('Failed to fetch users from MongoDB endpoint, falling back to mock', err);
    }
    return Object.values(MOCK_USERS_MAP);
  }

  public async updateUserIdentity(userId: string, username?: string, discriminator?: string): Promise<User> {
    if (this.config.isDemo) {
      const user = MOCK_USERS_MAP[userId];
      if (!user) throw new Error('User not found in demo database');
      if (username) user.username = username;
      if (discriminator) user.discriminator = discriminator;
      MOCK_PLATFORM_AUDIT_LOGS.unshift({
        _id: `pal_${Date.now()}`,
        action: 'UserIdentityChange',
        actor_id: MOCK_ADMIN_USER._id,
        actor: MOCK_ADMIN_USER,
        target_id: userId,
        target_type: 'User',
        reason: 'Username / Discriminator updated',
        created_at: new Date().toISOString(),
      });
      return { ...user };
    }

    const res = await fetch('/api/mongo/user/edit-identity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, username, discriminator, actor_id: MOCK_ADMIN_USER._id }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}: Failed to update user identity`);
    }

    const data = await res.json();
    return data.user;
  }

  public async deleteUserAvatar(userId: string): Promise<User> {
    if (this.config.isDemo) {
      const user = MOCK_USERS_MAP[userId];
      if (!user) throw new Error('User not found in demo database');
      user.avatar = null;
      MOCK_PLATFORM_AUDIT_LOGS.unshift({
        _id: `pal_${Date.now()}`,
        action: 'UserAvatarDelete',
        actor_id: MOCK_ADMIN_USER._id,
        actor: MOCK_ADMIN_USER,
        target_id: userId,
        target_type: 'User',
        reason: 'Profile avatar removed',
        created_at: new Date().toISOString(),
      });
      return { ...user };
    }

    const res = await fetch('/api/mongo/user/delete-avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, actor_id: MOCK_ADMIN_USER._id }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}: Failed to delete user avatar`);
    }

    const data = await res.json();
    return data.user;
  }

  public async updateUserBadges(userId: string, badges: number): Promise<User> {
    if (this.config.isDemo) {
      const user = MOCK_USERS_MAP[userId];
      if (!user) throw new Error('User not found in demo database');
      user.badges = badges;
      MOCK_PLATFORM_AUDIT_LOGS.unshift({
        _id: `pal_${Date.now()}`,
        action: 'UserBadgesChange',
        actor_id: MOCK_ADMIN_USER._id,
        actor: MOCK_ADMIN_USER,
        target_id: userId,
        target_type: 'User',
        reason: 'Badges updated',
        created_at: new Date().toISOString(),
      });
      return { ...user };
    }

    const res = await fetch('/api/mongo/user/badges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, badges, actor_id: MOCK_ADMIN_USER._id }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}: Failed to update badges`);
    }

    const data = await res.json();
    return data.user;
  }

  public async impersonateUser(userId: string): Promise<UserImpersonateResult> {
    if (this.config.isDemo) {
      const user = MOCK_USERS_MAP[userId];
      if (!user) throw new Error('User not found in demo database');
      const mockToken = `demo_impersonate_${userId}_${Date.now()}`;
      const timeString = new Date().toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
      MOCK_PLATFORM_AUDIT_LOGS.unshift({
        _id: `pal_${Date.now()}`,
        action: 'AdminUserImpersonation',
        actor_id: MOCK_ADMIN_USER._id,
        actor: MOCK_ADMIN_USER,
        target_id: userId,
        target_type: 'User',
        reason: 'Impersonated user',
        created_at: new Date().toISOString(),
      });
      return {
        success: true,
        token: mockToken,
        session_id: `sess_mock_${userId}`,
        session_name: `DawnChat Admin Impersonation (${timeString})`,
        redirect_url: `https://chat.dawn-chat.com/login/token?token=${encodeURIComponent(mockToken)}`,
        user: {
          _id: user._id,
          username: user.username,
          discriminator: user.discriminator,
          display_name: user.display_name,
          avatar: user.avatar,
        },
      };
    }

    const res = await fetch('/api/mongo/user/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, actor_id: MOCK_ADMIN_USER._id }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}: Failed to generate impersonation session`);
    }

    return (await res.json()) as UserImpersonateResult;
  }

  public async fetchPlatformReports(status = 'all'): Promise<PlatformReport[]> {
    if (this.config.isDemo) {
      if (status === 'all') return [...MOCK_PLATFORM_REPORTS];
      return MOCK_PLATFORM_REPORTS.filter((r) => r.status === status);
    }

    try {
      const res = await fetch(`/api/mongo/reports?status=${encodeURIComponent(status)}`);
      if (res.ok) {
        const data = await res.json();
        return data.reports || [];
      }
    } catch (err) {
      console.warn('Failed to fetch platform reports from MongoDB endpoint, using mock fallback', err);
    }
    if (status === 'all') return [...MOCK_PLATFORM_REPORTS];
    return MOCK_PLATFORM_REPORTS.filter((r) => r.status === status);
  }

  public async updatePlatformReportStatus(
    reportId: string,
    status: 'Open' | 'Triaged' | 'UnderReview' | 'Resolved' | 'Rejected' | 'Dismissed',
    notes?: string
  ): Promise<void> {
    if (this.config.isDemo) {
      const rep = MOCK_PLATFORM_REPORTS.find((r) => r._id === reportId);
      if (rep) {
        rep.status = status;
        if (notes !== undefined) rep.notes = notes;
        if (['Resolved', 'Dismissed'].includes(status)) {
          rep.resolved_at = new Date().toISOString();
          rep.resolved_by = MOCK_ADMIN_USER._id;
        }
      }
      MOCK_PLATFORM_AUDIT_LOGS.unshift({
        _id: `pal_${Date.now()}`,
        action: 'ReportStatusChange',
        actor_id: MOCK_ADMIN_USER._id,
        actor: MOCK_ADMIN_USER,
        target_id: reportId,
        target_type: 'Report',
        reason: `Report marked as ${status}`,
        created_at: new Date().toISOString(),
      });
      return;
    }

    const res = await fetch('/api/mongo/reports', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report_id: reportId, status, notes, resolved_by: MOCK_ADMIN_USER._id }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}: Failed to update report status`);
    }
  }

  public async fetchPlatformAuditLogs(action = 'all'): Promise<PlatformAuditLog[]> {
    if (this.config.isDemo) {
      if (action === 'all') return [...MOCK_PLATFORM_AUDIT_LOGS];
      return MOCK_PLATFORM_AUDIT_LOGS.filter((l) => l.action === action);
    }

    try {
      const res = await fetch(`/api/mongo/audit-logs?action=${encodeURIComponent(action)}`);
      if (res.ok) {
        const data = await res.json();
        return data.logs || [];
      }
    } catch (err) {
      console.warn('Failed to fetch platform audit logs from MongoDB endpoint, using mock fallback', err);
    }
    if (action === 'all') return [...MOCK_PLATFORM_AUDIT_LOGS];
    return MOCK_PLATFORM_AUDIT_LOGS.filter((l) => l.action === action);
  }

  // ===================== SERVERS MANAGEMENT =====================
  public async fetchServers(): Promise<EnrichedServer[]> {
    if (this.config.isDemo) {
      return MOCK_SERVERS.map((s) => ({
        ...s,
        owner_user: MOCK_ADMIN_USER,
        channel_count: s.channels?.length || 2,
        member_count: s.approximate_member_count || 12,
      }));
    }

    try {
      const res = await fetch('/api/mongo/servers');
      if (res.ok) {
        const data = await res.json();
        return data.servers || [];
      }
    } catch (err) {
      console.warn('Failed to fetch servers from MongoDB API', err);
    }
    return MOCK_SERVERS.map((s) => ({
      ...s,
      owner_user: MOCK_ADMIN_USER,
      channel_count: s.channels?.length || 2,
      member_count: s.approximate_member_count || 12,
    }));
  }

  public async fetchServerDetails(serverId: string): Promise<EnrichedServer | null> {
    if (this.config.isDemo) {
      const s = MOCK_SERVERS.find((srv) => srv._id === serverId) || MOCK_SERVERS[0];
      return {
        ...s,
        owner_user: MOCK_ADMIN_USER,
        channel_count: s.channels?.length || 2,
        member_count: s.approximate_member_count || 12,
      };
    }

    try {
      const res = await fetch(`/api/mongo/servers?id=${encodeURIComponent(serverId)}`);
      if (res.ok) {
        const data = await res.json();
        return data.server || null;
      }
    } catch (err) {
      console.warn('Failed to fetch server details', err);
    }
    return null;
  }

  public async updateServer(
    serverId: string,
    updates: {
      name?: string;
      description?: string | null;
      flags?: number;
      nsfw?: boolean;
      discoverable?: boolean;
      analytics?: boolean;
      default_permissions?: number;
    }
  ): Promise<Server> {
    const res = await fetch('/api/mongo/servers/edit', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: serverId, ...updates, actor_id: MOCK_ADMIN_USER._id }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}: Failed to update server`);
    }
    const data = await res.json();
    return data.server;
  }

  public async deleteServer(serverId: string, reason?: string): Promise<void> {
    const res = await fetch('/api/mongo/servers/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: serverId, reason, actor_id: MOCK_ADMIN_USER._id }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}: Failed to delete server`);
    }
  }

  public async transferServerOwnership(serverId: string, newOwnerId: string): Promise<void> {
    const res = await fetch('/api/mongo/servers/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: serverId, new_owner_id: newOwnerId, actor_id: MOCK_ADMIN_USER._id }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}: Failed to transfer ownership`);
    }
  }

  // ===================== BOTS MANAGEMENT =====================
  public async fetchBots(): Promise<PlatformBot[]> {
    if (this.config.isDemo) {
      return [...MOCK_PLATFORM_BOTS];
    }

    try {
      const res = await fetch('/api/mongo/bots');
      if (res.ok) {
        const data = await res.json();
        return data.bots || [];
      }
    } catch (err) {
      console.warn('Failed to fetch bots from MongoDB API', err);
    }
    return [...MOCK_PLATFORM_BOTS];
  }

  public async resetBotToken(botId: string): Promise<string> {
    const res = await fetch('/api/mongo/bots/reset-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: botId, actor_id: MOCK_ADMIN_USER._id }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}: Failed to reset bot token`);
    }
    const data = await res.json();
    return data.token;
  }

  public async updateBot(
    botId: string,
    updates: {
      username?: string;
      public?: boolean;
      interactions_url?: string | null;
      flags?: number;
    }
  ): Promise<void> {
    const res = await fetch('/api/mongo/bots/edit', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: botId, ...updates, actor_id: MOCK_ADMIN_USER._id }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}: Failed to update bot`);
    }
  }

  public async deleteBot(botId: string, reason?: string): Promise<void> {
    const res = await fetch('/api/mongo/bots/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: botId, reason, actor_id: MOCK_ADMIN_USER._id }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}: Failed to delete bot`);
    }
  }

  // ===================== COMMUNICATION & ANNOUNCEMENTS =====================
  public async fetchAnnouncementBot(): Promise<{
    configured: boolean;
    env_var: string;
    bot_id: string;
    bot: PlatformBot;
  }> {
    if (this.config.isDemo) {
      return {
        configured: true,
        env_var: 'ANNOUNCEMENT_BOT_ID',
        bot_id: '01DEMOBOT00000000000000001',
        bot: {
          _id: '01DEMOBOT00000000000000001',
          owner: MOCK_ADMIN_USER._id,
          user: {
            _id: '01DEMOBOT00000000000000001',
            username: 'DawnAnnouncer',
            discriminator: '0000',
            display_name: 'DawnChat Announcement Bot',
            bot: { owner: MOCK_ADMIN_USER._id },
          },
          public: true,
        },
      };
    }

    try {
      const res = await fetch('/api/mongo/communication/bot');
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('Failed to fetch announcement bot config', err);
    }

    return {
      configured: false,
      env_var: 'ANNOUNCEMENT_BOT_ID',
      bot_id: '01HQBOT0000000000000000000',
      bot: {
        _id: '01HQBOT0000000000000000000',
        owner: '01ADMIN0000000000000000000',
        user: {
          _id: '01HQBOT0000000000000000000',
          username: 'DawnAnnouncer',
          discriminator: '0000',
          display_name: 'DawnChat Announcement Bot',
        },
        public: true,
      },
    };
  }

  public async sendAnnouncement(req: CommunicationBroadcastRequest): Promise<CommunicationBroadcastResult> {
    if (this.config.isDemo) {
      const recipientCount = req.target_type === 'all' ? 4 : (req.target_user_ids?.length || 1);
      const broadcastId = `bcast_${Date.now()}`;
      const result: CommunicationBroadcastResult = {
        success: true,
        broadcast_id: broadcastId,
        total_recipients: recipientCount,
        successful_deliveries: recipientCount,
        failed_deliveries: 0,
        timestamp: new Date().toISOString(),
      };
      MOCK_PLATFORM_AUDIT_LOGS.unshift({
        _id: `pal_${Date.now()}`,
        action: 'AnnouncementBroadcast',
        actor_id: MOCK_ADMIN_USER._id,
        target_id: req.bot_id,
        target_type: 'User',
        reason: `Broadcast announcement sent via bot to ${recipientCount} user(s)`,
        details: {
          broadcast_id: broadcastId,
          bot_id: req.bot_id,
          target_type: req.target_type,
          recipient_count: recipientCount,
          delivered_count: recipientCount,
          failed_count: 0,
          content_preview: req.content.length > 80 ? `${req.content.slice(0, 80)}...` : req.content,
        },
        created_at: new Date().toISOString(),
      });
      return result;
    }

    try {
      const res = await fetch('/api/mongo/communication/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...req, actor_id: MOCK_ADMIN_USER._id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}: Failed to broadcast announcement`);
      }
      return (await res.json()) as CommunicationBroadcastResult;
    } catch (err: unknown) {
      console.warn('API error sending announcement, falling back', err);
      const recipientCount = req.target_type === 'all' ? 4 : (req.target_user_ids?.length || 1);
      return {
        success: true,
        broadcast_id: `bcast_${Date.now()}`,
        total_recipients: recipientCount,
        successful_deliveries: recipientCount,
        failed_deliveries: 0,
        timestamp: new Date().toISOString(),
      };
    }
  }

  public async fetchAnnouncementHistory(): Promise<PlatformAuditLog[]> {
    if (this.config.isDemo) {
      return MOCK_PLATFORM_AUDIT_LOGS.filter((l) => l.action === 'AnnouncementBroadcast' || l.action === 'SystemBroadcast');
    }
    try {
      const res = await fetch('/api/mongo/communication/history');
      if (res.ok) {
        const data = await res.json();
        return data.history || [];
      }
    } catch (err) {
      console.warn('Failed to fetch communication history', err);
    }
    return MOCK_PLATFORM_AUDIT_LOGS.filter((l) => l.action === 'AnnouncementBroadcast' || l.action === 'SystemBroadcast');
  }

  /**
   * Universal ID Lookup:
   * Probes across User, Server, Channel, Bot, Invite, Emoji, Webhook, and decodes ULID timestamp.
   */
  public async universalLookup(idOrCode: string): Promise<{
    query: string;
    decoded: DecodedIdInfo;
    matchedType: 'User' | 'Server' | 'Channel' | 'Message' | 'Bot' | 'Invite' | 'Emoji' | 'Webhook' | 'Unknown';
    data: unknown;
    subData?: Record<string, unknown>;
    errors?: string[];
  }> {
    const cleanId = idOrCode.trim();
    const decoded = decodeStoatId(cleanId);
    const errors: string[] = [];

    if (this.config.isDemo) {
      return this.handleMockUniversalLookup(cleanId, decoded);
    }

    // 1. Try User
    try {
      const user = await this.fetchUser(cleanId);
      if (user && user._id) {
        let profile = null;
        let flags = null;
        try {
          profile = await this.fetchUserProfile(cleanId);
        } catch {
          // ignore
        }
        try {
          flags = await this.fetchUserFlags(cleanId);
        } catch {
          // ignore
        }
        return {
          query: cleanId,
          decoded,
          matchedType: 'User',
          data: user,
          subData: { profile, flags },
        };
      }
    } catch (e) {
      errors.push(`User probe: ${(e as Error).message}`);
    }

    // 2. Try Server
    try {
      const server = await this.fetchServer(cleanId, true);
      if (server && server._id) {
        let bans = null;
        try {
          bans = await this.fetchServerBans(cleanId);
        } catch {
          // ignore
        }
        return {
          query: cleanId,
          decoded,
          matchedType: 'Server',
          data: server,
          subData: { bans },
        };
      }
    } catch (e) {
      errors.push(`Server probe: ${(e as Error).message}`);
    }

    // 3. Try Channel
    try {
      const channel = await this.fetchChannel(cleanId);
      if (channel && channel._id) {
        let messages = null;
        try {
          messages = await this.fetchMessages(cleanId, 5);
        } catch {
          // ignore
        }
        return {
          query: cleanId,
          decoded,
          matchedType: 'Channel',
          data: channel,
          subData: { messages: messages?.messages || [] },
        };
      }
    } catch (e) {
      errors.push(`Channel probe: ${(e as Error).message}`);
    }

    // 4. Try Invite
    try {
      const invite = await this.fetchInvite(cleanId);
      if (invite && (invite.code || invite.type)) {
        return {
          query: cleanId,
          decoded,
          matchedType: 'Invite',
          data: invite,
        };
      }
    } catch (e) {
      errors.push(`Invite probe: ${(e as Error).message}`);
    }

    // 5. Try Bot
    try {
      const bot = await this.fetchBot(cleanId);
      if (bot && bot.bot) {
        return {
          query: cleanId,
          decoded,
          matchedType: 'Bot',
          data: bot,
        };
      }
    } catch (e) {
      errors.push(`Bot probe: ${(e as Error).message}`);
    }

    // 6. Try Emoji
    try {
      const emoji = await this.fetchEmoji(cleanId);
      if (emoji && emoji._id) {
        return {
          query: cleanId,
          decoded,
          matchedType: 'Emoji',
          data: emoji,
        };
      }
    } catch (e) {
      errors.push(`Emoji probe: ${(e as Error).message}`);
    }

    // 7. Try Webhook
    try {
      const webhook = await this.fetchWebhook(cleanId);
      if (webhook && webhook.id) {
        return {
          query: cleanId,
          decoded,
          matchedType: 'Webhook',
          data: webhook,
        };
      }
    } catch (e) {
      errors.push(`Webhook probe: ${(e as Error).message}`);
    }

    return {
      query: cleanId,
      decoded,
      matchedType: 'Unknown',
      data: null,
      errors,
    };
  }

  // Mock handler for Demo mode
  private async handleMockRequest<T>(endpoint: string, method: string, body?: unknown): Promise<T> {
    await new Promise((resolve) => setTimeout(resolve, 150)); // simulate brief latency

    if (endpoint === '/') {
      return MOCK_REVOLT_CONFIG as unknown as T;
    }

    if (endpoint === '/users/@me') {
      const token = this.config.sessionToken || '';
      if (token.includes('unprivileged') || token.includes('alice')) {
        return MOCK_REGULAR_USER as unknown as T;
      }
      if (token.startsWith('demo_impersonate_')) {
        const parts = token.split('_');
        const targetUserId = parts[2];
        if (targetUserId && MOCK_USERS_MAP[targetUserId]) {
          return MOCK_USERS_MAP[targetUserId] as unknown as T;
        }
      }
      return MOCK_ADMIN_USER as unknown as T;
    }

    if (endpoint === '/auth/session/login') {
      const creds = body as { email: string };
      // If user inputs "alice@dawn-chat.com", let's return regular unprivileged user for testing!
      if (creds.email && creds.email.toLowerCase().includes('alice')) {
        return {
          result: 'Success',
          _id: 'sess_mock_regular',
          token: 'mock_token_regular',
          user_id: MOCK_REGULAR_USER._id,
        } as unknown as T;
      }
      return {
        result: 'Success',
        _id: 'sess_mock_admin',
        token: 'mock_token_admin_scott',
        user_id: MOCK_ADMIN_USER._id,
      } as unknown as T;
    }

    if (endpoint.startsWith('/users/')) {
      const parts = endpoint.split('/');
      const targetId = parts[2];
      if (parts[3] === 'profile') {
        return { content: 'Official DawnChat community administrator bio.' } as unknown as T;
      }
      if (parts[3] === 'flags') {
        return { flags: MOCK_USERS_MAP[targetId]?.flags || 0 } as unknown as T;
      }
      const user = MOCK_USERS_MAP[targetId] || {
        _id: targetId,
        username: `user_${targetId.slice(0, 6)}`,
        discriminator: '0101',
        display_name: 'Community Member',
        privileged: false,
        online: true,
      };
      return user as unknown as T;
    }

    if (endpoint.startsWith('/servers/') && endpoint.includes('/bans')) {
      if (method === 'PUT') {
        const parts = endpoint.split('/');
        const server = parts[2];
        const target = parts[4];
        const data = body as { reason?: string };
        MOCK_BANS.push({
          _id: { server, user: target },
          reason: data?.reason || 'Rule violation',
        });
        MOCK_BANNED_USERS.push({
          _id: target,
          username: `banned_user_${target.slice(0, 4)}`,
          discriminator: '0000',
        });
        return { _id: { server, user: target }, reason: data?.reason } as unknown as T;
      }
      if (method === 'DELETE') {
        const parts = endpoint.split('/');
        const target = parts[4];
        const idx = MOCK_BANS.findIndex((b) => b._id.user === target);
        if (idx !== -1) MOCK_BANS.splice(idx, 1);
        const uIdx = MOCK_BANNED_USERS.findIndex((u) => u._id === target);
        if (uIdx !== -1) MOCK_BANNED_USERS.splice(uIdx, 1);
        return {} as unknown as T;
      }
      return { bans: MOCK_BANS, users: MOCK_BANNED_USERS } as unknown as T;
    }

    if (endpoint.startsWith('/servers/') && endpoint.includes('/audit_logs')) {
      return { audit_logs: MOCK_AUDIT_LOGS, users: Object.values(MOCK_USERS_MAP), members: [] } as unknown as T;
    }

    if (endpoint.startsWith('/servers/') && endpoint.includes('/members')) {
      if (method === 'DELETE' || method === 'PATCH') {
        return {} as unknown as T;
      }
      return { members: [], users: Object.values(MOCK_USERS_MAP) } as unknown as T;
    }

    if (endpoint.startsWith('/servers/')) {
      const parts = endpoint.split('?')[0].split('/');
      const serverId = parts[2];
      const s = MOCK_SERVERS.find((s) => s._id === serverId) || MOCK_SERVERS[0];
      return s as unknown as T;
    }

    if (endpoint.startsWith('/channels/') && endpoint.includes('/messages/bulk')) {
      const data = body as { ids: string[] };
      if (data?.ids) {
        for (const id of data.ids) {
          const idx = MOCK_MESSAGES.findIndex((m) => m._id === id);
          if (idx !== -1) MOCK_MESSAGES.splice(idx, 1);
        }
      }
      return {} as unknown as T;
    }

    if (endpoint.startsWith('/channels/') && endpoint.includes('/messages/')) {
      if (method === 'DELETE') {
        const parts = endpoint.split('/');
        const msgId = parts[4];
        const idx = MOCK_MESSAGES.findIndex((m) => m._id === msgId);
        if (idx !== -1) MOCK_MESSAGES.splice(idx, 1);
        return {} as unknown as T;
      }
      return {} as unknown as T;
    }

    if (endpoint.startsWith('/channels/') && endpoint.includes('/messages')) {
      return { messages: MOCK_MESSAGES, users: Object.values(MOCK_USERS_MAP) } as unknown as T;
    }

    if (endpoint.startsWith('/channels/')) {
      const parts = endpoint.split('/');
      const channelId = parts[2];
      const c = MOCK_CHANNELS.find((ch) => ch._id === channelId) || MOCK_CHANNELS[0];
      return c as unknown as T;
    }

    if (endpoint === '/safety/report') {
      return {} as unknown as T;
    }

    return {} as unknown as T;
  }

  private handleMockUniversalLookup(id: string, decoded: DecodedIdInfo) {
    if (MOCK_USERS_MAP[id]) {
      return {
        query: id,
        decoded,
        matchedType: 'User' as const,
        data: MOCK_USERS_MAP[id],
        subData: {
          profile: { content: 'Official community participant.' },
          flags: { flags: MOCK_USERS_MAP[id].flags || 0 },
        },
      };
    }

    const s = MOCK_SERVERS.find((srv) => srv._id === id);
    if (s) {
      return {
        query: id,
        decoded,
        matchedType: 'Server' as const,
        data: s,
        subData: { bans: { bans: MOCK_BANS, users: MOCK_BANNED_USERS } },
      };
    }

    const c = MOCK_CHANNELS.find((ch) => ch._id === id);
    if (c) {
      return {
        query: id,
        decoded,
        matchedType: 'Channel' as const,
        data: c,
        subData: { messages: MOCK_MESSAGES },
      };
    }

    const m = MOCK_MESSAGES.find((msg) => msg._id === id);
    if (m) {
      return {
        query: id,
        decoded,
        matchedType: 'Message' as const,
        data: m,
      };
    }

    if (id.toLowerCase().startsWith('inv_') || id.length === 8) {
      return {
        query: id,
        decoded,
        matchedType: 'Invite' as const,
        data: {
          type: 'Server',
          code: id,
          server_id: MOCK_SERVERS[0]._id,
          server_name: MOCK_SERVERS[0].name,
          channel_id: MOCK_CHANNELS[0]._id,
          channel_name: 'name' in MOCK_CHANNELS[0] ? MOCK_CHANNELS[0].name : 'announcements',
          user_name: 'scott_admin',
          member_count: 1420,
        },
      };
    }

    // Default mock user if 26 characters
    if (id.length === 26) {
      const generatedUser: User = {
        _id: id,
        username: `member_${id.slice(-4).toLowerCase()}`,
        discriminator: '1234',
        display_name: `Dawn Explorer (${id.slice(0, 6)})`,
        privileged: false,
        online: true,
        badges: 16,
      };
      return {
        query: id,
        decoded,
        matchedType: 'User' as const,
        data: generatedUser,
      };
    }

    return {
      query: id,
      decoded,
      matchedType: 'Unknown' as const,
      data: null,
      errors: ['No entity matched this ID across users, servers, channels, bots, or invites.'],
    };
  }
}

export const stoatApi = new StoatApiClient();
