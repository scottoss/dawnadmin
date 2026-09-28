import { User, Server, Channel, Message, ServerBan, BannedUser, AuditLogEntry, RevoltConfig, PlatformBan, PlatformReport, PlatformAuditLog } from '../types/stoat';

export const MOCK_REVOLT_CONFIG: RevoltConfig = {
  stoat: '0.15.5',
  revolt: '0.7.2',
  features: {
    captcha: { enabled: false, key: '' },
    email: true,
    invite_only: false,
    autumn: { enabled: true, url: 'https://api.dawn-chat.com/autumn' },
    january: { enabled: true, url: 'https://january.dawn-chat.com' },
    livekit: {
      enabled: true,
      nodes: [
        { name: 'voice-eu-central', lat: 50.11, lon: 8.68, public_url: 'wss://voice.dawn-chat.com' }
      ]
    },
    limits: {
      global: {
        group_size: 50,
        message_embeds: 10,
        message_replies: 5,
        message_reactions: 20,
        server_emoji: 100,
        server_roles: 50,
        server_channels: 100,
        body_limit_size: 1048576,
        new_user_hours: 24,
        max_invite_duration_days: 30
      },
      default: {
        outgoing_friend_requests: 100,
        bots: 25,
        message_length: 2000,
        message_attachments: 5,
        servers: 100,
        voice_quality: 128,
        video: true
      }
    }
  },
  ws: 'wss://ws.dawn-chat.com',
  app: 'https://chat.dawn-chat.com',
  vapid: 'BOr7xL1Q63jN19iFvY3...'
};

export const MOCK_ADMIN_USER: User = {
  _id: '01HJ2N5X8K90PQRS7TUVWXYZ01',
  username: 'scott_admin',
  discriminator: '0001',
  display_name: 'Scott (Dawn Administrator)',
  pronouns: 'he/him',
  privileged: true,
  online: true,
  badges: 33, // Developer + Platform Moderator
  flags: 0,
  status: {
    text: 'Guarding DawnChat · Monitoring logs',
    presence: 'Online'
  },
  avatar: {
    _id: '01HJ2N8V89ABCDEF0123456789',
    tag: 'avatars',
    filename: 'avatar.png',
    metadata: { type: 'Image', width: 256, height: 256 },
    content_type: 'image/png',
    size: 42300
  }
};

export const MOCK_REGULAR_USER: User = {
  _id: '01HJ3M8Q79NOPQRSTUVWXYZ12',
  username: 'alice_member',
  discriminator: '4120',
  display_name: 'Alice',
  privileged: false, // NOT privileged!
  online: true,
  badges: 16, // Early Adopter
  flags: 0,
  status: {
    text: 'Just chatting',
    presence: 'Online'
  }
};

export const MOCK_USERS_MAP: Record<string, User> = {
  [MOCK_ADMIN_USER._id]: MOCK_ADMIN_USER,
  [MOCK_REGULAR_USER._id]: MOCK_REGULAR_USER,
  '01HJ3R9T89BCDEFGHIJKLMNOP34': {
    _id: '01HJ3R9T89BCDEFGHIJKLMNOP34',
    username: 'crypto_spammer',
    discriminator: '9921',
    display_name: 'Fast Money 100x',
    privileged: false,
    online: false,
    badges: 0,
    flags: 8, // Spam flag
    status: { text: 'DM me for signals', presence: 'Invisible' }
  },
  '01HJ4A1B23CDEFGHIJKLMNOP56': {
    _id: '01HJ4A1B23CDEFGHIJKLMNOP56',
    username: 'marcus_dev',
    discriminator: '1337',
    display_name: 'Marcus G.',
    privileged: false,
    online: true,
    badges: 1, // Developer
    flags: 0,
    status: { text: 'Shipping features 🚀', presence: 'Focus' }
  },
  '01HJ4X9Y88UVWXYZABCDEFG78': {
    _id: '01HJ4X9Y88UVWXYZABCDEFG78',
    username: 'dawn_moderation_bot',
    discriminator: '0000',
    display_name: 'Dawn Shield Bot',
    privileged: false,
    online: true,
    badges: 0,
    flags: 0,
    bot: { owner: MOCK_ADMIN_USER._id },
    status: { text: 'Listening to audit logs', presence: 'Online' }
  }
};

export const MOCK_SERVERS: Server[] = [
  {
    _id: '01HJ2K9M88ABCDEFGHIJKLMN01',
    owner: MOCK_ADMIN_USER._id,
    name: 'DawnChat Official Community',
    description: 'The official home server for DawnChat news, updates, and open discussions.',
    channels: [
      '01HJ2L1A01BCDEFGHIJKLMNO11',
      '01HJ2L2B02CDEFGHIJKLMNOP22',
      '01HJ2L3C03DEFGHIJKLMNOPQ33'
    ],
    categories: [
      { id: 'cat_welcome', title: 'WELCOME', channels: ['01HJ2L1A01BCDEFGHIJKLMNO11'] },
      { id: 'cat_community', title: 'TEXT CHANNELS', channels: ['01HJ2L2B02CDEFGHIJKLMNOP22', '01HJ2L3C03DEFGHIJKLMNOPQ33'] }
    ],
    default_permissions: 1048576,
    flags: 0,
    nsfw: false,
    discoverable: true,
    analytics: true,
    approximate_member_count: 1420
  },
  {
    _id: '01HJ5Z9P77MNOPQRSTUVWXY02',
    owner: '01HJ4A1B23CDEFGHIJKLMNOP56',
    name: 'Dawn Gaming & Tech',
    description: 'Gaming lounge, server hosting discussion, and community voice hangouts.',
    channels: ['01HJ5Y1A99BCDEFGHIJKLMNO99'],
    default_permissions: 1048576,
    flags: 0,
    nsfw: false,
    discoverable: false,
    approximate_member_count: 380
  }
];

export const MOCK_CHANNELS: Channel[] = [
  {
    channel_type: 'TextChannel',
    _id: '01HJ2L1A01BCDEFGHIJKLMNO11',
    server: '01HJ2K9M88ABCDEFGHIJKLMN01',
    name: 'announcements',
    description: 'Official platform news from the DawnChat team.',
    nsfw: false,
    slowmode: 0,
    last_message_id: '01HJ991M11NOPQRSTUVWXYZ99'
  },
  {
    channel_type: 'TextChannel',
    _id: '01HJ2L2B02CDEFGHIJKLMNOP22',
    server: '01HJ2K9M88ABCDEFGHIJKLMN01',
    name: 'general-chat',
    description: 'Friendly discussion and community hangout space.',
    nsfw: false,
    slowmode: 5,
    last_message_id: '01HJ992M22NOPQRSTUVWXYZ88'
  },
  {
    channel_type: 'TextChannel',
    _id: '01HJ2L3C03DEFGHIJKLMNOPQ33',
    server: '01HJ2K9M88ABCDEFGHIJKLMN01',
    name: 'bot-commands',
    description: 'Interact with community bots and music integrations.',
    nsfw: false,
    slowmode: 0
  }
];

export const MOCK_MESSAGES: Message[] = [
  {
    _id: '01HJ991M11NOPQRSTUVWXYZ99',
    channel: '01HJ2L1A01BCDEFGHIJKLMNO11',
    author: MOCK_ADMIN_USER._id,
    user: MOCK_ADMIN_USER,
    content: 'Welcome everyone to DawnChat! Our self-hosted Stoat instance is now updated with zero-downtime voice nodes and enhanced security filtering.',
    pinned: true,
    reactions: { '🎉': [MOCK_ADMIN_USER._id, MOCK_REGULAR_USER._id], '🚀': [MOCK_ADMIN_USER._id] }
  },
  {
    _id: '01HJ992M22NOPQRSTUVWXYZ88',
    channel: '01HJ2L2B02CDEFGHIJKLMNOP22',
    author: '01HJ4A1B23CDEFGHIJKLMNOP56',
    user: MOCK_USERS_MAP['01HJ4A1B23CDEFGHIJKLMNOP56'],
    content: 'Loving the fast latency on the web client! Is anyone else hosting custom bots using the REST API?',
    pinned: false,
    reactions: { '👍': [MOCK_ADMIN_USER._id] }
  },
  {
    _id: '01HJ993M33NOPQRSTUVWXYZ77',
    channel: '01HJ2L2B02CDEFGHIJKLMNOP22',
    author: '01HJ3R9T89BCDEFGHIJKLMNOP34',
    user: MOCK_USERS_MAP['01HJ3R9T89BCDEFGHIJKLMNOP34'],
    content: 'CLICK HERE TO WIN 5000 FREE TOKENS ON UNVERIFIED EXCHANGE HTTP://PHISHING-FAKE-URL.XYZ/CLAIM',
    pinned: false,
    reactions: { '⚠️': [MOCK_ADMIN_USER._id] },
    flags: 0
  },
  {
    _id: '01HJ994M44NOPQRSTUVWXYZ66',
    channel: '01HJ2L2B02CDEFGHIJKLMNOP22',
    author: MOCK_REGULAR_USER._id,
    user: MOCK_REGULAR_USER,
    content: 'Can an admin please look into the phishing message above? Looks like a malicious raid bot.',
    pinned: false
  }
];

export const MOCK_BANS: ServerBan[] = [
  {
    _id: {
      server: '01HJ2K9M88ABCDEFGHIJKLMN01',
      user: '01HJ3R9T89BCDEFGHIJKLMNOP34'
    },
    reason: 'Phishing attack, spamming unverified telegram & crypto links across general channels.'
  }
];

export const MOCK_BANNED_USERS: BannedUser[] = [
  {
    _id: '01HJ3R9T89BCDEFGHIJKLMNOP34',
    username: 'crypto_spammer',
    discriminator: '9921',
    avatar: null
  }
];

export const MOCK_PLATFORM_BANS: PlatformBan[] = [
  {
    _id: '01HJB11P99BCDEFGHIJKLMNOP01',
    user_id: '01HJ3R9T89BCDEFGHIJKLMNOP34',
    reason: 'Platform-wide ban: Coordinated phishing attack, malicious URL propagation across instances.',
    created_at: '2026-09-24T18:30:00.000Z',
    banned_by: MOCK_ADMIN_USER._id,
    ip_address: '198.51.100.42',
    active: true,
    user: MOCK_USERS_MAP['01HJ3R9T89BCDEFGHIJKLMNOP34']
  }
];

export const MOCK_PLATFORM_REPORTS: PlatformReport[] = [
  {
    _id: '01HJC22R88CDEFGHIJKLMNOP01',
    author_id: MOCK_REGULAR_USER._id,
    content_type: 'Message',
    content_id: '01HJ993M33NOPQRSTUVWXYZ77',
    additional_context: 'User posted malicious link offering free tokens, likely trying to compromise account credentials or session tokens.',
    report_reason: 'Malware / Phishing',
    status: 'Open',
    created_at: '2026-09-25T08:15:00.000Z',
    author: MOCK_REGULAR_USER,
    target_user: MOCK_USERS_MAP['01HJ3R9T89BCDEFGHIJKLMNOP34'],
    target_message: MOCK_MESSAGES[2]
  },
  {
    _id: '01HJC23R88CDEFGHIJKLMNOP02',
    author_id: '01HJ4A1B23CDEFGHIJKLMNOP56',
    content_type: 'User',
    content_id: '01HJ3R9T89BCDEFGHIJKLMNOP34',
    additional_context: 'Spamming mass DMs with unverified external trading discord bots.',
    report_reason: 'SpamAbuse',
    status: 'Triaged',
    created_at: '2026-09-25T07:40:00.000Z',
    author: MOCK_USERS_MAP['01HJ4A1B23CDEFGHIJKLMNOP56'],
    target_user: MOCK_USERS_MAP['01HJ3R9T89BCDEFGHIJKLMNOP34']
  },
  {
    _id: '01HJC24R88CDEFGHIJKLMNOP03',
    author_id: MOCK_ADMIN_USER._id,
    content_type: 'Server',
    content_id: '01HJ5Z9P77MNOPQRSTUVWXY02',
    additional_context: 'Routine platform compliance verification on discoverable channels.',
    report_reason: 'NoneSpecified',
    status: 'Resolved',
    notes: 'Reviewed and verified compliance with DawnChat safety standards.',
    created_at: '2026-09-24T14:20:00.000Z',
    resolved_at: '2026-09-24T15:00:00.000Z',
    resolved_by: MOCK_ADMIN_USER._id,
    author: MOCK_ADMIN_USER,
    target_server: MOCK_SERVERS[1]
  }
];

export const MOCK_PLATFORM_AUDIT_LOGS: PlatformAuditLog[] = [
  {
    _id: '01HJD31L99DEFGHIJKLMNOP01',
    action: 'PlatformBanCreate',
    actor_id: MOCK_ADMIN_USER._id,
    actor: MOCK_ADMIN_USER,
    target_id: '01HJ3R9T89BCDEFGHIJKLMNOP34',
    target_type: 'User',
    reason: 'Platform-wide ban: Coordinated phishing attack across public servers.',
    details: { ip_ban: true, flag_added: 4 },
    created_at: '2026-09-24T18:30:00.000Z'
  },
  {
    _id: '01HJD32L99DEFGHIJKLMNOP02',
    action: 'MessagePurge',
    actor_id: MOCK_ADMIN_USER._id,
    actor: MOCK_ADMIN_USER,
    target_id: '01HJ993M33NOPQRSTUVWXYZ77',
    target_type: 'Message',
    reason: 'Removed reported phishing link from #general-chat.',
    details: { channel_id: '01HJ2L2B02CDEFGHIJKLMNOP22' },
    created_at: '2026-09-25T08:20:00.000Z'
  },
  {
    _id: '01HJD33L99DEFGHIJKLMNOP03',
    action: 'UserPrivilegeUpdate',
    actor_id: MOCK_ADMIN_USER._id,
    actor: MOCK_ADMIN_USER,
    target_id: MOCK_ADMIN_USER._id,
    target_type: 'User',
    reason: 'Verified administrator permissions (privileged: true) in MongoDB users collection.',
    details: { collection: 'users', field: 'privileged', value: true },
    created_at: '2026-09-25T09:00:00.000Z'
  },
  {
    _id: '01HJD34L99DEFGHIJKLMNOP04',
    action: 'ReportStatusChange',
    actor_id: MOCK_ADMIN_USER._id,
    actor: MOCK_ADMIN_USER,
    target_id: '01HJC24R88CDEFGHIJKLMNOP03',
    target_type: 'Report',
    reason: 'Marked server compliance report as Resolved.',
    details: { previous: 'Open', new: 'Resolved' },
    created_at: '2026-09-24T15:00:00.000Z'
  }
];

export const MOCK_PLATFORM_BOTS: any[] = [
  {
    _id: '01HJ7BOT01ABCDEF0123456789',
    owner: MOCK_ADMIN_USER._id,
    token: 'bTKn_9xL1Q63jN19iFvY3_AdminSystemAnnouncementBotSecToken2026',
    public: true,
    analytics: true,
    interactions_url: 'https://bots.dawn-chat.com/announcements/interactions',
    flags: 1,
    created_at: '2026-09-01T12:00:00.000Z',
    user: {
      _id: '01HJ7BOT01ABCDEF0123456789',
      username: 'DawnAnnouncer',
      discriminator: '0000',
      display_name: 'DawnChat Official Announcer',
      bot: { owner: MOCK_ADMIN_USER._id },
      online: true,
      badges: 1, // Developer
    },
    owner_user: MOCK_ADMIN_USER,
  },
  {
    _id: '01HJ7BOT02ABCDEF0123456789',
    owner: '01HJ4A1B23CDEFGHIJKLMNOP56',
    token: 'bTKn_4yL2R74kO20jGwZ4_MusicAssistantBotToken2026',
    public: false,
    analytics: false,
    interactions_url: null,
    flags: 0,
    created_at: '2026-09-10T14:30:00.000Z',
    user: {
      _id: '01HJ7BOT02ABCDEF0123456789',
      username: 'DawnBeatsMusic',
      discriminator: '1234',
      display_name: 'DawnBeats Music Bot',
      bot: { owner: '01HJ4A1B23CDEFGHIJKLMNOP56' },
      online: true,
      badges: 0,
    },
    owner_user: MOCK_USERS_MAP['01HJ4A1B23CDEFGHIJKLMNOP56'],
  }
];

export const MOCK_AUDIT_LOGS: AuditLogEntry[] = [
  {
    _id: '01HJA11A99BCDEFGHIJKLMNO01',
    server: '01HJ2K9M88ABCDEFGHIJKLMN01',
    user: MOCK_ADMIN_USER._id,
    target: '01HJ3R9T89BCDEFGHIJKLMNOP34',
    reason: 'Automated Shield: High frequency phishing regex triggered.',
    action: {
      type: 'BanCreate',
      user: '01HJ3R9T89BCDEFGHIJKLMNOP34'
    }
  }
];
