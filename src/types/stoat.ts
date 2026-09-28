/**
 * Stoat / Revolt API Data Definitions & Models
 * Platform: DawnChat (api.dawn-chat.com)
 */

export enum UserBadges {
  Developer = 1,
  Translator = 2,
  Supporter = 4,
  ResponsibleDisclosure = 8,
  Founder = 16,
  PlatformModeration = 32,
  ActiveSupporter = 64,
  Paw = 128,
  EarlyAdopter = 256,
  ReservedRelevantJokeBadge1 = 512,
  ReservedRelevantJokeBadge2 = 1024,
}

export interface User {
  _id: string;
  username: string;
  discriminator: string;
  display_name?: string | null;
  pronouns?: string | null;
  avatar?: FileAttachment | null;
  relations?: Relationship[];
  badges?: number;
  status?: UserStatus | null;
  flags?: number;
  privileged?: boolean;
  disabled?: boolean;
  banned?: boolean;
  email?: string | null;
  banReason?: string | null;
  bot?: {
    owner: string;
  } | null;
  relationship?: 'None' | 'User' | 'Friend' | 'Outgoing' | 'Incoming' | 'Blocked' | 'BlockedOther';
  online?: boolean;
}

export interface UserImpersonateResult {
  success: boolean;
  token: string;
  session_id: string;
  session_name?: string;
  redirect_url?: string;
  user: {
    _id: string;
    username: string;
    discriminator: string;
    display_name?: string | null;
    avatar?: FileAttachment | null;
  };
}

export interface UserStatus {
  text?: string | null;
  presence?: 'Online' | 'Idle' | 'Focus' | 'Busy' | 'Invisible' | null;
}

export interface Relationship {
  _id: string;
  status: 'None' | 'User' | 'Friend' | 'Outgoing' | 'Incoming' | 'Blocked' | 'BlockedOther';
}

export interface UserProfile {
  content?: string | null;
  background?: FileAttachment | null;
}

export interface FileAttachment {
  _id: string;
  tag: string;
  filename: string;
  metadata: FileMetadata;
  content_type: string;
  size: number;
  deleted?: boolean | null;
  reported?: boolean | null;
  message_id?: string | null;
  user_id?: string | null;
  server_id?: string | null;
  object_id?: string | null;
}

export type FileMetadata =
  | { type: 'File' }
  | { type: 'Text' }
  | { type: 'Image'; width: number; height: number; thumbhash?: number[] | null; animated?: boolean | null }
  | { type: 'Video'; width: number; height: number }
  | { type: 'Audio' };

export enum ServerFlags {
  Official = 1,
  Verified = 2,
}

export interface Server {
  _id: string;
  owner: string;
  name: string;
  description?: string | null;
  channels: string[];
  categories?: Category[] | null;
  system_messages?: SystemMessageChannels | null;
  roles?: Record<string, Role>;
  default_permissions: number;
  icon?: FileAttachment | null;
  banner?: FileAttachment | null;
  flags?: number;
  nsfw?: boolean;
  analytics?: boolean;
  discoverable?: boolean;
  approximate_member_count?: number;
  owner_user?: User | null;
  channel_count?: number;
  member_count?: number;
  created_at?: string;
}

export interface EnrichedServer extends Server {
  owner_user?: User | null;
  channel_count?: number;
  member_count?: number;
}

export interface PlatformBot {
  _id: string; // Bot ID
  owner: string; // Owner User ID
  owner_user?: User | null;
  user?: User | null; // Bot user profile in users collection
  token?: string;
  public?: boolean;
  analytics?: boolean;
  interactions_url?: string | null;
  flags?: number;
  created_at?: string;
}

export interface CommunicationBroadcastRequest {
  bot_id: string;
  target_type: 'all' | 'users';
  target_user_ids?: string[];
  content: string;
  embed?: {
    title?: string;
    description?: string;
    colour?: string;
    url?: string;
  };
}

export interface CommunicationBroadcastResult {
  success: boolean;
  total_recipients: number;
  successful_deliveries: number;
  failed_deliveries: number;
  broadcast_id: string;
  timestamp: string;
}

export interface Category {
  id: string;
  title: string;
  channels: string[];
}

export interface SystemMessageChannels {
  user_joined?: string | null;
  user_left?: string | null;
  user_kicked?: string | null;
  user_banned?: string | null;
}

export interface Role {
  _id: string;
  name: string;
  permissions: {
    a: number;
    d: number;
  };
  colour?: string | null;
  hoist?: boolean;
  rank?: number;
  icon?: FileAttachment | null;
  owner?: string | null;
}

export interface Member {
  _id: {
    server: string;
    user: string;
  };
  joined_at: string;
  nickname?: string | null;
  pronouns?: string | null;
  avatar?: FileAttachment | null;
  roles?: string[];
  timeout?: string | null;
  can_publish?: boolean;
  can_receive?: boolean;
}

export type Channel =
  | {
      channel_type: 'SavedMessages';
      _id: string;
      user: string;
    }
  | {
      channel_type: 'DirectMessage';
      _id: string;
      active: boolean;
      recipients: string[];
      last_message_id?: string | null;
    }
  | {
      channel_type: 'Group';
      _id: string;
      name: string;
      owner: string;
      description?: string | null;
      recipients: string[];
      icon?: FileAttachment | null;
      last_message_id?: string | null;
      permissions?: number | null;
      nsfw?: boolean;
    }
  | {
      channel_type: 'TextChannel';
      _id: string;
      server: string;
      name: string;
      description?: string | null;
      icon?: FileAttachment | null;
      last_message_id?: string | null;
      default_permissions?: { a: number; d: number } | null;
      role_permissions?: Record<string, { a: number; d: number }>;
      nsfw?: boolean;
      voice?: { max_users?: number | null } | null;
      slowmode?: number | null;
    };

export interface Message {
  _id: string;
  nonce?: string | null;
  channel: string;
  author: string;
  user?: User | null;
  member?: Member | null;
  webhook?: { name: string; avatar?: string | null } | null;
  content?: string | null;
  system?: SystemMessageEvent | null;
  attachments?: FileAttachment[] | null;
  edited?: string | null;
  embeds?: Embed[] | null;
  mentions?: string[] | null;
  role_mentions?: string[] | null;
  replies?: string[] | null;
  reactions?: Record<string, string[]>;
  pinned?: boolean | null;
  flags?: number;
}

export interface SystemMessageEvent {
  type: string;
  content?: string;
  id?: string;
  by?: string;
  name?: string;
  from?: string;
  to?: string;
}

export interface Embed {
  type: 'Website' | 'Image' | 'Video' | 'Text' | 'None';
  url?: string | null;
  original_url?: string | null;
  title?: string | null;
  description?: string | null;
  image?: { url: string; width: number; height: number } | null;
  video?: { url: string; width: number; height: number } | null;
  site_name?: string | null;
  icon_url?: string | null;
  colour?: string | null;
}

export interface ServerBan {
  _id: {
    server: string;
    user: string;
  };
  reason?: string | null;
}

export interface BannedUser {
  _id: string;
  username: string;
  discriminator: string;
  avatar?: FileAttachment | null;
}

export interface BanListResult {
  bans: ServerBan[];
  users: BannedUser[];
}

export interface AuditLogEntry {
  _id: string;
  server: string;
  reason?: string | null;
  user: string;
  target?: string | null;
  action: {
    type: string;
    [key: string]: unknown;
  };
}

export interface AuditLogQueryResponse {
  audit_logs: AuditLogEntry[];
  users: User[];
  members: Member[];
}

export interface RevoltConfig {
  stoat: string;
  revolt: string;
  features: {
    captcha: { enabled: boolean; key: string };
    email: boolean;
    invite_only: boolean;
    autumn: { enabled: boolean; url: string };
    january: { enabled: boolean; url: string };
    livekit: { enabled: boolean; nodes: Array<{ name: string; lat: number; lon: number; public_url: string }> };
    limits: {
      global: {
        group_size: number;
        message_embeds: number;
        message_replies: number;
        message_reactions: number;
        server_emoji: number;
        server_roles: number;
        server_channels: number;
        body_limit_size: number;
        new_user_hours: number;
        max_invite_duration_days: number;
      };
      default: {
        outgoing_friend_requests: number;
        bots: number;
        message_length: number;
        message_attachments: number;
        servers: number;
        voice_quality: number;
        video: boolean;
      };
    };
  };
  ws: string;
  app: string;
  vapid: string;
}

export interface InviteInfo {
  type: 'Server' | 'Group';
  code: string;
  server_id?: string;
  server_name?: string;
  server_icon?: FileAttachment | null;
  channel_id: string;
  channel_name: string;
  channel_description?: string | null;
  user_name: string;
  user_avatar?: FileAttachment | null;
  member_count?: number;
}

export interface BotInfo {
  _id: string;
  owner: string;
  token?: string;
  public: boolean;
  analytics?: boolean;
  discoverable?: boolean;
}

export interface CustomEmoji {
  _id: string;
  name: string;
  creator_id: string;
  parent: { type: 'Server'; id: string } | { type: 'Detached' };
  animated?: boolean;
  nsfw?: boolean;
}

export interface PlatformBan {
  _id: string;
  user_id: string;
  reason?: string | null;
  created_at?: string;
  banned_by?: string | null;
  ip_address?: string | null;
  active: boolean;
  user?: User | null;
}

export interface SafetyAttachmentMetadata {
  type: string;
  width?: number;
  height?: number;
  thumbhash?: number[];
  animated?: boolean;
}

export interface SafetyAttachment {
  _id: string;
  tag: string;
  filename: string;
  hash: string;
  uploaded_at: number;
  uploader_id: string;
  content_type: string;
  size: number;
  metadata?: SafetyAttachmentMetadata;
}

export interface ContextMessage {
  _id: string;
  nonce?: string;
  channel: string;
  author: string;
  author_user?: User | null;
  content?: string;
  flags?: number;
  attachments?: SafetyAttachment[];
  system?: {
    type: string;
    by?: string;
    finished_at?: number | null;
    [key: string]: unknown;
  };
  mentions?: string[];
  replies?: string[];
}

export interface SafetySnapshotContent {
  _type: 'Message' | 'User' | 'Server';
  _id: string;
  channel?: string;
  channel_name?: string;
  author?: string;
  reported_user?: User | null;
  content?: string;
  nonce?: string;
  flags?: number;
  attachments?: SafetyAttachment[];
  _prior_context?: ContextMessage[];
  _leading_context?: ContextMessage[];
}

export interface SafetySnapshot {
  _id: string;
  report_id: string;
  content: SafetySnapshotContent;
}

export interface SafetyStrike {
  _id: string;
  user_id: string;
  report_id?: string | null;
  reason: string;
  severity: 'Warning' | 'Strike' | 'AccountSuspension' | 'PermanentBan';
  actor_id: string;
  actor?: User | null;
  created_at: string;
}

export interface PlatformReport {
  _id: string;
  author_id: string;
  content?: {
    type?: 'Message' | 'Server' | 'User';
    id?: string;
    report_reason?: string;
  };
  content_type?: 'Message' | 'Server' | 'User';
  content_id?: string;
  additional_context?: string;
  report_reason?: string;
  status: 'Created' | 'Open' | 'Triaged' | 'UnderReview' | 'Resolved' | 'Rejected' | 'Dismissed';
  notes?: string;
  created_at: string;
  resolved_at?: string | null;
  resolved_by?: string | null;
  resolver?: User | null;
  author?: User | null; // Reporter user
  reporter?: User | null; // Reporter user
  target_user?: User | null; // Reported user
  reported_user?: User | null; // Reported user
  is_reported_user_banned?: boolean;
  target_message?: Message | null;
  target_server?: Server | null;
  snapshot?: SafetySnapshot | null;
  strikes?: SafetyStrike[];
  channel_name?: string;
}

export interface PlatformAuditLog {
  _id: string;
  action: string;
  actor_id: string;
  actor?: User | null;
  target_id?: string | null;
  target_type?: 'User' | 'Message' | 'Server' | 'Channel' | 'Report';
  details?: Record<string, unknown>;
  reason?: string | null;
  created_at: string;
}

export interface WebhookInfo {
  id: string;
  name: string;
  creator_id: string;
  channel_id: string;
  permissions: number;
  token?: string | null;
}

export interface MongoDbStatus {
  connected: boolean;
  dbName: string;
  host?: string;
  collections?: { name: string; count: number }[];
  error?: string;
  isMock?: boolean;
}
