/**
 * Backend routes for Direct MongoDB Stoat management
 */
import type { Request, Response } from 'express';
import crypto from 'crypto';
import { getMongoDb, checkMongoStatus, setMongoConnectionConfig, getMongoConfig } from './mongo.ts';
import { getOrInitBotClient, sendAnnouncementViaRevoltJs, getBotClientStatus } from './botClient.ts';

const CROCKFORD_BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function generateCrockfordUlid(timestamp = Date.now()): string {
  let timeStr = '';
  let time = timestamp;
  for (let i = 9; i >= 0; i--) {
    const power = Math.pow(32, i);
    const digit = Math.floor(time / power) % 32;
    timeStr += CROCKFORD_BASE32[digit];
    time = time % power;
  }

  let randStr = '';
  const randBytes = crypto.randomBytes(16);
  for (let i = 0; i < 16; i++) {
    randStr += CROCKFORD_BASE32[randBytes[i] % 32];
  }

  return timeStr + randStr;
}

export async function handleMongoStatus(req: Request, res: Response) {
  try {
    const status = await checkMongoStatus();
    res.json(status);
  } catch (err: unknown) {
    res.status(500).json({ connected: false, error: err instanceof Error ? err.message : String(err) });
  }
}

export async function handleMongoConfig(req: Request, res: Response) {
  if (req.method === 'POST') {
    const { uri, dbName } = req.body || {};
    if (!uri) {
      res.status(400).json({ error: 'Missing uri parameter' });
      return;
    }
    setMongoConnectionConfig(uri, dbName);
    const status = await checkMongoStatus();
    res.json(status);
    return;
  }
  res.json(getMongoConfig());
}

// 1. Platform Bans (/api/mongo/bans)
export async function handlePlatformBans(req: Request, res: Response) {
  const conn = await getMongoDb();
  if (!conn) {
    res.status(503).json({ error: 'MongoDB connection not active', fallback: true });
    return;
  }

  const { db } = conn;
  const bansColl = db.collection<any>('platform_bans');
  const usersColl = db.collection<any>('users');
  const accountsColl = db.collection<any>('accounts');
  const sessionsColl = db.collection<any>('sessions');

  if (req.method === 'GET') {
    try {
      const bans = await bansColl.find({ active: { $ne: false } }).sort({ created_at: -1 }).toArray();
      // Join users
      const userIds = bans.map((b) => b.user_id || b._id);
      const users = await usersColl.find({ _id: { $in: userIds } }).toArray();
      const userMap = new Map(users.map((u) => [u._id, u]));

      // Also fetch account disabled status
      const accounts = await accountsColl.find({
        $or: [{ _id: { $in: userIds } }, { user_id: { $in: userIds } }]
      }).toArray().catch(() => []);
      const accountDisabledMap = new Map();
      accounts.forEach((acc) => {
        if (acc._id) accountDisabledMap.set(acc._id, acc.disabled);
        if (acc.user_id) accountDisabledMap.set(acc.user_id, acc.disabled);
      });

      const enriched = bans.map((b) => {
        const u = userMap.get(b.user_id || b._id) || null;
        const isDisabled = accountDisabledMap.get(b.user_id || b._id) ?? u?.disabled ?? true;
        return {
          ...b,
          user: u ? { ...u, disabled: isDisabled } : null,
          disabled: isDisabled,
        };
      });

      res.json({ bans: enriched });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  if (req.method === 'POST') {
    // Create platform-wide ban
    try {
      const { user_id, reason, banned_by, ip_address } = req.body || {};
      if (!user_id) {
        res.status(400).json({ error: 'Missing user_id' });
        return;
      }

      const cleanUserId = String(user_id).trim();
      const now = new Date().toISOString();
      const banDoc = {
        _id: `pban_${cleanUserId}_${Date.now()}`,
        user_id: cleanUserId,
        reason: reason || 'Platform Terms of Service violation',
        banned_by: banned_by || 'admin',
        ip_address: ip_address || null,
        created_at: now,
        active: true,
      };

      await bansColl.updateOne(
        { user_id: cleanUserId },
        { $set: banDoc },
        { upsert: true }
      );

      // Also upsert into native 'bans' collection if present
      await db.collection<any>('bans').updateOne(
        { user_id: cleanUserId },
        { $set: banDoc },
        { upsert: true }
      ).catch(() => {});

      // 1. In Stoat/Revolt: change disabled: false to disabled: true in their account
      await accountsColl.updateMany(
        { $or: [{ _id: cleanUserId }, { user_id: cleanUserId }] },
        { $set: { disabled: true } }
      ).catch(() => {});

      // 2. In users collection: set disabled: true, banned: true, flags bit 4 (Banned)
      await usersColl.updateOne(
        { _id: cleanUserId },
        {
          $bit: { flags: { or: 4 } }, // UserFlags::Banned
          $set: { disabled: true, banned: true, 'status.presence': 'Invisible' }
        }
      );

      // 3. Immediately invalidate and purge active login sessions for this banned user
      await sessionsColl.deleteMany({
        $or: [{ user_id: cleanUserId }, { account_id: cleanUserId }]
      }).catch(() => {});

      // Record in platform audit log
      await db.collection<any>('platform_audit_logs').insertOne({
        _id: `pal_${Date.now()}`,
        action: 'PlatformBanCreate',
        actor_id: banned_by || 'admin',
        target_id: cleanUserId,
        target_type: 'User',
        reason: reason || 'Platform Terms of Service violation',
        details: { ip_address, disabled: true, account_disabled: true, report_id: req.body.report_id || null },
        created_at: now,
      });

      // 4. Record strike in safety_strikes if requested or linked to a report
      const reportId = req.body?.report_id ? String(req.body.report_id).trim() : null;
      if (req.body?.record_strike !== false) {
        const strikeId = generateCrockfordUlid();
        await db.collection<any>('safety_strikes').insertOne({
          _id: strikeId,
          user_id: cleanUserId,
          report_id: reportId,
          reason: reason || 'Platform-wide ban issued for Terms of Service violation',
          severity: 'PermanentBan',
          actor_id: banned_by || 'admin',
          created_at: now,
        }).catch(() => {});
      }

      // 5. If this ban resolves a specific safety report, mark it Resolved
      if (reportId && req.body?.resolve_report !== false) {
        await db.collection<any>('safety_reports').updateOne(
          { _id: reportId },
          {
            $set: {
              status: 'Resolved',
              notes: `Offender banned platform-wide by ${banned_by || 'admin'}. Reason: ${reason || 'Terms of Service violation'}`,
              resolved_at: now,
              resolved_by: banned_by || 'admin',
            }
          }
        ).catch(() => {});
      }

      res.status(201).json({ ...banDoc, disabled: true, success: true });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  if (req.method === 'DELETE') {
    // Unban user platform-wide
    return performUnban(req, res);
  }
}

// Helper to perform unban robustly
async function performUnban(req: Request, res: Response) {
  const conn = await getMongoDb();
  if (!conn) {
    res.status(503).json({ error: 'MongoDB connection not active', fallback: true });
    return;
  }

  const { db } = conn;
  const bansColl = db.collection<any>('platform_bans');
  const usersColl = db.collection<any>('users');
  const accountsColl = db.collection<any>('accounts');

  try {
    const rawUserId = (req.query.user_id as string) || (req.body?.user_id as string) || (req.body?.ban_id as string) || '';
    if (!rawUserId) {
      res.status(400).json({ error: 'Missing user_id parameter' });
      return;
    }

    // Clean user ID if a ban ID like pban_01HJ..._timestamp was passed
    let cleanUserId = rawUserId.trim();
    if (cleanUserId.startsWith('pban_')) {
      const parts = cleanUserId.split('_');
      if (parts.length >= 2) {
        cleanUserId = parts[1];
      }
    }

    // 1. Remove ban from platform_bans collection
    await bansColl.deleteMany({
      $or: [
        { user_id: cleanUserId },
        { _id: cleanUserId },
        { _id: `pban_${cleanUserId}` },
        { user_id: { $regex: `^${cleanUserId}$`, $options: 'i' } }
      ]
    });

    // Also update any lingering documents with active: false
    await bansColl.updateMany(
      { $or: [{ user_id: cleanUserId }, { _id: cleanUserId }] },
      { $set: { active: false, unbanned_at: new Date().toISOString() } }
    ).catch(() => {});

    // Also remove from native 'bans' collection if present
    await db.collection<any>('bans').deleteMany({
      $or: [{ user_id: cleanUserId }, { _id: cleanUserId }]
    }).catch(() => {});

    // 2. Change disabled: true back to disabled: false in their account
    await accountsColl.updateMany(
      { $or: [{ _id: cleanUserId }, { user_id: cleanUserId }] },
      { $set: { disabled: false } }
    ).catch(() => {});

    // 3. Remove banned flag and disabled: true from users collection
    await usersColl.updateOne(
      { _id: cleanUserId },
      {
        $bit: { flags: { and: ~4 } },
        $set: { disabled: false },
        $unset: { banned: '' }
      }
    );

    const actor = (req.query.actor as string) || (req.body?.actor as string) || 'admin';

    // Record in platform audit log
    await db.collection<any>('platform_audit_logs').insertOne({
      _id: `pal_${Date.now()}`,
      action: 'PlatformBanDelete',
      actor_id: actor,
      target_id: cleanUserId,
      target_type: 'User',
      reason: 'Platform ban revoked by admin, account restored (disabled: false)',
      created_at: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: `Platform ban for user ${cleanUserId} revoked. Account restored to disabled: false.`,
      user_id: cleanUserId
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

// Dedicated unban endpoint: POST /api/mongo/unban
export async function handlePlatformUnban(req: Request, res: Response) {
  return performUnban(req, res);
}

// 2. Platform Users (/api/mongo/users)
export async function handleMongoUsers(req: Request, res: Response) {
  const conn = await getMongoDb();
  if (!conn) {
    res.status(503).json({ error: 'MongoDB connection not active', fallback: true });
    return;
  }

  const { db } = conn;
  const usersColl = db.collection<any>('users');
  const accountsColl = db.collection<any>('accounts');
  const bansColl = db.collection<any>('platform_bans');

  if (req.method === 'GET') {
    try {
      const q = (req.query.q as string || '').trim();
      const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 200);

      const query: Record<string, unknown> = {};
      if (q) {
        query.$or = [
          { _id: q },
          { username: { $regex: q, $options: 'i' } },
          { discriminator: q },
          { display_name: { $regex: q, $options: 'i' } },
        ];
      }

      const users = await usersColl.find(query).limit(limit).toArray();
      const userIds = users.map((u) => u._id);

      // Join accounts to get disabled status
      const accounts = await accountsColl.find({
        $or: [{ _id: { $in: userIds } }, { user_id: { $in: userIds } }]
      }).toArray().catch(() => []);
      const accountMap = new Map();
      accounts.forEach((acc) => {
        if (acc._id) accountMap.set(acc._id, acc);
        if (acc.user_id) accountMap.set(acc.user_id, acc);
      });

      // Join platform bans
      const activeBans = await bansColl.find({
        user_id: { $in: userIds },
        active: { $ne: false }
      }).toArray().catch(() => []);
      const banMap = new Map(activeBans.map((b) => [b.user_id, b]));

      const enriched = users.map((u) => {
        const acc = accountMap.get(u._id);
        const ban = banMap.get(u._id);
        const isDisabled = acc?.disabled ?? u.disabled ?? Boolean(ban) ?? false;
        return {
          ...u,
          disabled: isDisabled,
          banned: Boolean(ban || u.banned || ((u.flags || 0) & 4)),
          email: acc?.email || null,
          banReason: ban?.reason || null,
        };
      });

      res.json({ users: enriched });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
    return;
  }
}

// 3. Edit User Username & Discriminator (/api/mongo/user/edit-identity)
export async function handleUserEditIdentity(req: Request, res: Response) {
  const conn = await getMongoDb();
  if (!conn) {
    res.status(503).json({ error: 'MongoDB connection not active', fallback: true });
    return;
  }

  const { db } = conn;
  const usersColl = db.collection<any>('users');
  const accountsColl = db.collection<any>('accounts');

  try {
    const { user_id, username, discriminator, actor_id } = req.body || {};
    if (!user_id) {
      res.status(400).json({ error: 'Missing user_id parameter' });
      return;
    }

    const cleanUserId = String(user_id).trim();
    const updateFields: Record<string, string> = {};

    if (username !== undefined) {
      const cleanUsername = String(username).trim();
      if (cleanUsername.length < 1 || cleanUsername.length > 32) {
        res.status(400).json({ error: 'Username must be between 1 and 32 characters' });
        return;
      }
      updateFields.username = cleanUsername;
    }

    if (discriminator !== undefined) {
      const cleanDisc = String(discriminator).trim().padStart(4, '0').slice(-4);
      updateFields.discriminator = cleanDisc;
    }

    if (Object.keys(updateFields).length === 0) {
      res.status(400).json({ error: 'No fields to update provided' });
      return;
    }

    // Get old user state for audit log
    const oldUser = await usersColl.findOne({ _id: cleanUserId });

    // Update in users collection
    await usersColl.updateOne(
      { _id: cleanUserId },
      { $set: updateFields }
    );

    // Update in accounts collection if username changed
    if (updateFields.username) {
      await accountsColl.updateMany(
        { $or: [{ _id: cleanUserId }, { user_id: cleanUserId }] },
        { $set: { username: updateFields.username } }
      ).catch(() => {});
    }

    // Audit log
    await db.collection<any>('platform_audit_logs').insertOne({
      _id: `pal_${Date.now()}`,
      action: 'UserIdentityChange',
      actor_id: actor_id || 'admin',
      target_id: cleanUserId,
      target_type: 'User',
      reason: 'Username / Discriminator updated via DawnChat Admin Console',
      details: {
        old_username: oldUser?.username,
        new_username: updateFields.username || oldUser?.username,
        old_discriminator: oldUser?.discriminator,
        new_discriminator: updateFields.discriminator || oldUser?.discriminator,
      },
      created_at: new Date().toISOString(),
    });

    const updatedUser = await usersColl.findOne({ _id: cleanUserId });
    res.json({ success: true, user: updatedUser });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

// 4. Delete Profile Image / Avatar (/api/mongo/user/delete-avatar)
export async function handleUserDeleteAvatar(req: Request, res: Response) {
  const conn = await getMongoDb();
  if (!conn) {
    res.status(503).json({ error: 'MongoDB connection not active', fallback: true });
    return;
  }

  const { db } = conn;
  const usersColl = db.collection<any>('users');

  try {
    const { user_id, actor_id } = req.body || {};
    if (!user_id) {
      res.status(400).json({ error: 'Missing user_id parameter' });
      return;
    }

    const cleanUserId = String(user_id).trim();

    // Remove avatar from users document
    await usersColl.updateOne(
      { _id: cleanUserId },
      {
        $unset: { avatar: '' },
        $set: { avatar: null }
      }
    );

    // Record audit log
    await db.collection<any>('platform_audit_logs').insertOne({
      _id: `pal_${Date.now()}`,
      action: 'UserAvatarDelete',
      actor_id: actor_id || 'admin',
      target_id: cleanUserId,
      target_type: 'User',
      reason: 'Profile avatar removed by administrator',
      created_at: new Date().toISOString(),
    });

    const updatedUser = await usersColl.findOne({ _id: cleanUserId });
    res.json({ success: true, message: 'Profile image deleted.', user: updatedUser });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

// 5. Change Badges (/api/mongo/user/badges)
export async function handleUserBadges(req: Request, res: Response) {
  const conn = await getMongoDb();
  if (!conn) {
    res.status(503).json({ error: 'MongoDB connection not active', fallback: true });
    return;
  }

  const { db } = conn;
  const usersColl = db.collection<any>('users');

  try {
    const { user_id, badges, actor_id } = req.body || {};
    if (!user_id || badges === undefined) {
      res.status(400).json({ error: 'Missing user_id or badges parameter' });
      return;
    }

    const cleanUserId = String(user_id).trim();
    const badgesNum = parseInt(String(badges), 10);
    if (isNaN(badgesNum) || badgesNum < 0) {
      res.status(400).json({ error: 'Badges must be a non-negative integer bitfield' });
      return;
    }

    const oldUser = await usersColl.findOne({ _id: cleanUserId });

    await usersColl.updateOne(
      { _id: cleanUserId },
      { $set: { badges: badgesNum } }
    );

    // Audit log
    await db.collection<any>('platform_audit_logs').insertOne({
      _id: `pal_${Date.now()}`,
      action: 'UserBadgesChange',
      actor_id: actor_id || 'admin',
      target_id: cleanUserId,
      target_type: 'User',
      reason: 'Badges modified via DawnChat Admin Console',
      details: {
        old_badges: oldUser?.badges || 0,
        new_badges: badgesNum,
      },
      created_at: new Date().toISOString(),
    });

    const updatedUser = await usersColl.findOne({ _id: cleanUserId });
    res.json({ success: true, badges: badgesNum, user: updatedUser });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

// 6. Impersonate / Log in as User (/api/mongo/user/impersonate)
export async function handleUserImpersonate(req: Request, res: Response) {
  const conn = await getMongoDb();
  if (!conn) {
    res.status(503).json({ error: 'MongoDB connection not active', fallback: true });
    return;
  }

  const { db } = conn;
  const usersColl = db.collection<any>('users');
  const accountsColl = db.collection<any>('accounts');
  const sessionsColl = db.collection<any>('sessions');

  try {
    const { user_id, actor_id } = req.body || {};
    if (!user_id) {
      res.status(400).json({ error: 'Missing user_id parameter' });
      return;
    }

    const cleanUserId = String(user_id).trim();
    const user = await usersColl.findOne({ _id: cleanUserId });
    if (!user) {
      res.status(404).json({ error: `User with ID ${cleanUserId} not found in database` });
      return;
    }

    // Find linked account
    const account = await accountsColl.findOne({
      $or: [{ _id: cleanUserId }, { user_id: cleanUserId }]
    }).catch(() => null);

    // Generate authentic Revolt/Stoat 64-char base64url crypto session token (e.g. cZDL91d-5XUMry5JumsmNitCFYrud4C_4460i2k8jTPm09Yqr0NP7sX7Ia2dEvji)
    const sessionToken = crypto.randomBytes(48).toString('base64url');
    const sessionId = generateCrockfordUlid();
    const timeString = new Date().toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    // Exact Revolt/Stoat session schema with dynamic timestamped impersonation name
    const sessionDoc = {
      _id: sessionId,
      last_seen: new Date().toISOString(),
      name: `DawnChat Admin Impersonation (${timeString})`,
      origin: 'dev',
      token: sessionToken,
      user_id: cleanUserId,
    };

    await sessionsColl.insertOne(sessionDoc);

    // Audit log
    await db.collection<any>('platform_audit_logs').insertOne({
      _id: `pal_${Date.now()}`,
      action: 'AdminUserImpersonation',
      actor_id: actor_id || 'admin',
      target_id: cleanUserId,
      target_type: 'User',
      reason: 'Administrator generated impersonation session to log in as user',
      details: { session_id: sessionId, token_preview: `${sessionToken.slice(0, 10)}...` },
      created_at: new Date().toISOString(),
    });

    const redirectUrl = `https://chat.dawn-chat.com/login/token?token=${encodeURIComponent(sessionToken)}`;

    res.json({
      success: true,
      token: sessionToken,
      session_id: sessionId,
      session_name: sessionDoc.name,
      redirect_url: redirectUrl,
      user: {
        _id: user._id,
        username: user.username,
        discriminator: user.discriminator,
        display_name: user.display_name,
        avatar: user.avatar,
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

// 7. Platform Reports (/api/mongo/reports)
export async function handlePlatformReports(req: Request, res: Response) {
  const conn = await getMongoDb();
  if (!conn) {
    res.status(503).json({ error: 'MongoDB connection not active', fallback: true });
    return;
  }

  const { db } = conn;
  const reportsColl = db.collection<any>('safety_reports');
  const snapshotsColl = db.collection<any>('safety_snapshots');
  const strikesColl = db.collection<any>('safety_strikes');
  const bansColl = db.collection<any>('platform_bans');
  const usersColl = db.collection<any>('users');
  const channelsColl = db.collection<any>('channels');

  if (req.method === 'GET') {
    try {
      const statusFilter = req.query.status as string;
      const query: Record<string, unknown> = {};
      if (statusFilter && statusFilter !== 'all') {
        query.status = statusFilter;
      }

      // Fetch reports from MongoDB safety_reports
      const reports = await reportsColl.find(query).sort({ _id: -1 }).limit(100).toArray();
      const reportIds = reports.map((r) => r._id);

      // Fetch matching safety_snapshots
      const snapshots = await snapshotsColl.find({
        $or: [
          { report_id: { $in: reportIds } },
          { _id: { $in: reportIds } }
        ]
      }).toArray();
      const snapshotMap = new Map<string, any>();
      snapshots.forEach((s) => {
        if (s.report_id) snapshotMap.set(s.report_id, s);
        if (s._id) snapshotMap.set(s._id, s);
      });

      // Collect all user IDs and channel IDs
      const userIds = new Set<string>();
      const channelIds = new Set<string>();

      reports.forEach((r) => {
        if (r.author_id) userIds.add(r.author_id);
        if (r.resolved_by) userIds.add(r.resolved_by);
        if (r.content?.type === 'User' && r.content?.id) userIds.add(r.content.id);
        if (r.content_type === 'User' && r.content_id) userIds.add(r.content_id);

        const snap = snapshotMap.get(r._id);
        if (snap?.content) {
          if (snap.content.author) userIds.add(snap.content.author);
          if (snap.content.channel) channelIds.add(snap.content.channel);

          if (Array.isArray(snap.content._prior_context)) {
            snap.content._prior_context.forEach((m: any) => {
              if (m.author) userIds.add(m.author);
              if (m.channel) channelIds.add(m.channel);
            });
          }
          if (Array.isArray(snap.content._leading_context)) {
            snap.content._leading_context.forEach((m: any) => {
              if (m.author) userIds.add(m.author);
              if (m.channel) channelIds.add(m.channel);
            });
          }
        }
      });

      // Batch fetch users & channels
      const [usersList, channelsList] = await Promise.all([
        usersColl.find({ _id: { $in: Array.from(userIds) } }).toArray(),
        channelsColl.find({ _id: { $in: Array.from(channelIds) } }).toArray(),
      ]);

      const userMap = new Map<string, any>(usersList.map((u) => [u._id, u]));
      const channelMap = new Map<string, any>(channelsList.map((c) => [c._id, c]));

      // Active bans lookup
      const activeBans = await bansColl.find({
        user_id: { $in: Array.from(userIds) },
        active: { $ne: false }
      }).toArray().catch(() => []);
      const banSet = new Set<string>(activeBans.map((b) => b.user_id));

      // Safety strikes lookup
      const strikes = await strikesColl.find({
        $or: [
          { report_id: { $in: reportIds } },
          { user_id: { $in: Array.from(userIds) } }
        ]
      }).sort({ created_at: -1 }).toArray().catch(() => []);

      const strikesByReport = new Map<string, any[]>();
      const strikesByUser = new Map<string, any[]>();
      strikes.forEach((s) => {
        if (s.report_id) {
          const list = strikesByReport.get(s.report_id) || [];
          list.push(s);
          strikesByReport.set(s.report_id, list);
        }
        if (s.user_id) {
          const list = strikesByUser.get(s.user_id) || [];
          list.push(s);
          strikesByUser.set(s.user_id, list);
        }
      });

      // Context message enricher
      const enrichContextMsg = (msg: any) => {
        const ch = msg.channel ? channelMap.get(msg.channel) : null;
        return {
          ...msg,
          author_user: msg.author ? userMap.get(msg.author) || null : null,
          channel_name: ch?.name || (ch?.type === 'DirectMessage' || ch?.channel_type === 'DirectMessage' ? 'Direct Message' : msg.channel),
        };
      };

      const enriched = reports.map((r) => {
        const snap = snapshotMap.get(r._id) || null;
        let enrichedSnap = null;
        let reportedUserId: string | null = null;

        if (snap?.content) {
          reportedUserId = snap.content.author || null;
          const ch = snap.content.channel ? channelMap.get(snap.content.channel) : null;

          enrichedSnap = {
            ...snap,
            content: {
              ...snap.content,
              channel_name: ch?.name || (ch?.type === 'DirectMessage' || ch?.channel_type === 'DirectMessage' ? 'Direct Message' : snap.content.channel),
              reported_user: snap.content.author ? userMap.get(snap.content.author) || null : null,
              _prior_context: Array.isArray(snap.content._prior_context)
                ? snap.content._prior_context.map(enrichContextMsg)
                : [],
              _leading_context: Array.isArray(snap.content._leading_context)
                ? snap.content._leading_context.map(enrichContextMsg)
                : [],
            }
          };
        } else if (r.content?.type === 'User') {
          reportedUserId = r.content.id;
        } else if (r.content_type === 'User') {
          reportedUserId = r.content_id;
        }

        const reportedUser = reportedUserId ? userMap.get(reportedUserId) || null : null;
        const reporterUser = r.author_id ? userMap.get(r.author_id) || null : null;
        const isBanned = reportedUserId
          ? banSet.has(reportedUserId) || Boolean(reportedUser?.banned) || Boolean((reportedUser?.flags || 0) & 4)
          : false;

        const reportStrikes = (strikesByReport.get(r._id) || []).concat(
          reportedUserId ? strikesByUser.get(reportedUserId) || [] : []
        );
        const uniqueStrikes = Array.from(new Map(reportStrikes.map((s) => [s._id, s])).values());

        const contentType = r.content?.type || r.content_type || 'Message';
        const contentId = r.content?.id || r.content_id || (snap?.content?._id || '');
        const reportReason = r.content?.report_reason || r.report_reason || 'SafetyViolation';

        return {
          ...r,
          content_type: contentType,
          content_id: contentId,
          report_reason: reportReason,
          reporter: reporterUser,
          author: reporterUser,
          reported_user: reportedUser,
          target_user: reportedUser,
          is_reported_user_banned: isBanned,
          snapshot: enrichedSnap,
          strikes: uniqueStrikes,
          resolver: r.resolved_by ? userMap.get(r.resolved_by) || null : null,
        };
      });

      res.json({ reports: enriched });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  if (req.method === 'PATCH') {
    try {
      const { report_id, status, notes, resolved_by } = req.body || {};
      if (!report_id || !status) {
        res.status(400).json({ error: 'Missing report_id or status' });
        return;
      }

      const updateData: Record<string, unknown> = { status };
      if (notes !== undefined) updateData.notes = notes;
      if (['Resolved', 'Dismissed', 'Rejected'].includes(status)) {
        updateData.resolved_at = new Date().toISOString();
        updateData.resolved_by = resolved_by || 'admin';
      } else if (['Open', 'Triaged', 'UnderReview', 'Created'].includes(status)) {
        updateData.resolved_at = null;
        updateData.resolved_by = null;
      }

      await reportsColl.updateOne(
        { _id: report_id },
        { $set: updateData }
      );

      // Audit log
      await db.collection<any>('platform_audit_logs').insertOne({
        _id: `pal_${Date.now()}`,
        action: 'ReportStatusChange',
        actor_id: resolved_by || 'admin',
        target_id: report_id,
        target_type: 'Report',
        reason: `Report marked as ${status}`,
        details: { status, notes },
        created_at: new Date().toISOString(),
      });

      res.json({ success: true, status, updateData });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
    return;
  }
}

// 7b. Safety Strikes (/api/mongo/safety/strikes)
export async function handleSafetyStrikes(req: Request, res: Response) {
  const conn = await getMongoDb();
  if (!conn) {
    res.status(503).json({ error: 'MongoDB connection not active', fallback: true });
    return;
  }

  const { db } = conn;
  const strikesColl = db.collection<any>('safety_strikes');
  const usersColl = db.collection<any>('users');

  if (req.method === 'GET') {
    try {
      const userId = req.query.user_id as string;
      const reportId = req.query.report_id as string;
      const query: Record<string, unknown> = {};
      if (userId) query.user_id = userId;
      if (reportId) query.report_id = reportId;

      const strikes = await strikesColl.find(query).sort({ created_at: -1 }).toArray();
      const actorIds = Array.from(new Set(strikes.map((s) => s.actor_id).filter(Boolean)));
      const actors = await usersColl.find({ _id: { $in: actorIds } }).toArray();
      const actorMap = new Map(actors.map((u) => [u._id, u]));

      const enriched = strikes.map((s) => ({
        ...s,
        actor: actorMap.get(s.actor_id) || null,
      }));

      res.json({ strikes: enriched });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      const { user_id, report_id, reason, severity, actor_id } = req.body || {};
      if (!user_id || !reason) {
        res.status(400).json({ error: 'Missing user_id or reason' });
        return;
      }

      const strikeId = generateCrockfordUlid();
      const strikeDoc = {
        _id: strikeId,
        user_id: String(user_id).trim(),
        report_id: report_id ? String(report_id).trim() : null,
        reason: String(reason).trim(),
        severity: severity || 'Strike',
        actor_id: actor_id || 'admin',
        created_at: new Date().toISOString(),
      };

      await strikesColl.insertOne(strikeDoc);

      // Audit log
      await db.collection<any>('platform_audit_logs').insertOne({
        _id: `pal_${Date.now()}`,
        action: 'SafetyStrikeIssued',
        actor_id: actor_id || 'admin',
        target_id: strikeDoc.user_id,
        target_type: 'User',
        reason: strikeDoc.reason,
        details: { strike_id: strikeId, severity: strikeDoc.severity, report_id },
        created_at: strikeDoc.created_at,
      });

      res.status(201).json({ success: true, strike: strikeDoc });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  if (req.method === 'DELETE') {
    try {
      const strikeId = (req.query.id as string) || (req.body?.id as string);
      if (!strikeId) {
        res.status(400).json({ error: 'Missing strike id' });
        return;
      }

      // 1. Fetch strike record before deletion for audit record
      const existingStrike = await strikesColl.findOne({ _id: strikeId });

      // 2. Delete strike from safety_strikes collection
      const deleteResult = await strikesColl.deleteOne({ _id: strikeId });

      // 3. Log strike deletion / revocation in platform_audit_logs
      const actorId = (req.query.actor_id as string) || req.body?.actor_id || 'admin';
      await db.collection<any>('platform_audit_logs').insertOne({
        _id: `pal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        action: 'SafetyStrikeRevoked',
        actor_id: actorId,
        target_id: existingStrike?.user_id || 'unknown',
        target_type: 'User',
        reason: (req.query.reason as string) || req.body?.reason || 'Safety strike deleted/revoked by administrator',
        details: {
          strike_id: strikeId,
          deleted_strike: existingStrike || null,
        },
        created_at: new Date().toISOString(),
      });

      res.json({
        success: true,
        message: 'Safety strike successfully deleted/revoked from platform database.',
        deletedCount: deleteResult.deletedCount,
        strike_id: strikeId,
      });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
    return;
  }
}

// 8. Platform Audit Logs (/api/mongo/audit-logs)
export async function handlePlatformAuditLogs(req: Request, res: Response) {
  const conn = await getMongoDb();
  if (!conn) {
    res.status(503).json({ error: 'MongoDB connection not active', fallback: true });
    return;
  }

  const { db } = conn;
  const auditColl = db.collection<any>('platform_audit_logs');
  const usersColl = db.collection<any>('users');

  try {
    const actionFilter = req.query.action as string;
    const query: Record<string, unknown> = {};
    if (actionFilter && actionFilter !== 'all') {
      query.action = actionFilter;
    }

    const logs = await auditColl.find(query).sort({ created_at: -1 }).limit(100).toArray();
    const actorIds = Array.from(new Set(logs.map((l) => l.actor_id).filter(Boolean)));
    const actors = await usersColl.find({ _id: { $in: actorIds } }).toArray();
    const actorMap = new Map(actors.map((u) => [u._id, u]));

    const enriched = logs.map((l) => ({
      ...l,
      actor: actorMap.get(l.actor_id) || null,
    }));

    res.json({ logs: enriched });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

// 9. Servers Management (/api/mongo/servers)
export async function handleMongoServers(req: Request, res: Response) {
  const conn = await getMongoDb();
  if (!conn) {
    res.status(503).json({ error: 'MongoDB connection not active', fallback: true });
    return;
  }

  const { db } = conn;
  const serversColl = db.collection<any>('servers');
  const channelsColl = db.collection<any>('channels');
  const membersColl = db.collection<any>('server_members');
  const usersColl = db.collection<any>('users');
  const auditColl = db.collection<any>('platform_audit_logs');

  if (req.method === 'GET') {
    try {
      const serverId = req.query.id as string;
      if (serverId) {
        const server = await serversColl.findOne({ _id: serverId });
        if (!server) {
          res.status(404).json({ error: 'Server not found' });
          return;
        }
        const [ownerUser, channelDocs, memberCount] = await Promise.all([
          usersColl.findOne({ _id: server.owner }),
          channelsColl.find({ server: server._id }).toArray(),
          membersColl.countDocuments({ $or: [{ server: server._id }, { '_id.server': server._id }] }),
        ]);

        res.json({
          server: {
            ...server,
            owner_user: ownerUser || null,
            channel_count: channelDocs.length,
            member_count: memberCount,
            channel_details: channelDocs,
          },
        });
        return;
      }

      const servers = await serversColl.find({}).sort({ _id: -1 }).limit(100).toArray();
      const ownerIds = Array.from(new Set(servers.map((s) => s.owner).filter(Boolean)));
      const owners = await usersColl.find({ _id: { $in: ownerIds } }).toArray();
      const ownerMap = new Map(owners.map((u) => [u._id, u]));

      // Aggregate channel counts & member counts per server
      const serverIds = servers.map((s) => s._id);
      const [channelCounts, memberCounts] = await Promise.all([
        channelsColl.aggregate([
          { $match: { server: { $in: serverIds } } },
          { $group: { _id: '$server', count: { $sum: 1 } } }
        ]).toArray().catch(() => []),
        membersColl.aggregate([
          { $match: { $or: [{ server: { $in: serverIds } }, { '_id.server': { $in: serverIds } }] } },
          { $group: { _id: { $ifNull: ['$server', '$_id.server'] }, count: { $sum: 1 } } }
        ]).toArray().catch(() => []),
      ]);

      const channelCountMap = new Map(channelCounts.map((c: any) => [c._id, c.count]));
      const memberCountMap = new Map(memberCounts.map((m: any) => [m._id, m.count]));

      const enriched = servers.map((s) => ({
        ...s,
        owner_user: ownerMap.get(s.owner) || null,
        channel_count: channelCountMap.get(s._id) ?? (Array.isArray(s.channels) ? s.channels.length : 0),
        member_count: memberCountMap.get(s._id) ?? 1,
      }));

      res.json({ servers: enriched });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  if (req.method === 'PATCH' || req.path.endsWith('/edit')) {
    try {
      const { id, name, description, flags, nsfw, discoverable, analytics, default_permissions, actor_id } = req.body || {};
      if (!id) {
        res.status(400).json({ error: 'Missing server id' });
        return;
      }

      const updateFields: Record<string, any> = {};
      if (typeof name === 'string') updateFields.name = name.trim();
      if (description !== undefined) updateFields.description = description ? description.trim() : null;
      if (typeof flags === 'number') updateFields.flags = flags;
      if (typeof nsfw === 'boolean') updateFields.nsfw = nsfw;
      if (typeof discoverable === 'boolean') updateFields.discoverable = discoverable;
      if (typeof analytics === 'boolean') updateFields.analytics = analytics;
      if (typeof default_permissions === 'number') updateFields.default_permissions = default_permissions;

      const existingServer = await serversColl.findOne({ _id: id });
      if (!existingServer) {
        res.status(404).json({ error: 'Server not found' });
        return;
      }

      await serversColl.updateOne({ _id: id }, { $set: updateFields });
      const updatedServer = await serversColl.findOne({ _id: id });

      await auditColl.insertOne({
        _id: `pal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        action: 'ServerUpdated',
        actor_id: actor_id || 'admin',
        target_id: id,
        target_type: 'Server',
        reason: 'Server metadata/flags updated via admin console',
        details: { updated_fields: updateFields, previous: existingServer },
        created_at: new Date().toISOString(),
      });

      res.json({ success: true, server: updatedServer });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  if (req.method === 'DELETE' || req.path.endsWith('/delete')) {
    try {
      const serverId = (req.query.id as string) || req.body?.id;
      const actorId = req.body?.actor_id || 'admin';
      if (!serverId) {
        res.status(400).json({ error: 'Missing server id' });
        return;
      }

      const existingServer = await serversColl.findOne({ _id: serverId });
      if (!existingServer) {
        res.status(404).json({ error: 'Server not found' });
        return;
      }

      await Promise.all([
        serversColl.deleteOne({ _id: serverId }),
        channelsColl.deleteMany({ server: serverId }),
        membersColl.deleteMany({ $or: [{ server: serverId }, { '_id.server': serverId }] }),
      ]);

      await auditColl.insertOne({
        _id: `pal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        action: 'ServerDeleted',
        actor_id: actorId,
        target_id: serverId,
        target_type: 'Server',
        reason: req.body?.reason || 'Server permanently deleted by administrator',
        details: { server_name: existingServer.name, owner: existingServer.owner },
        created_at: new Date().toISOString(),
      });

      res.json({ success: true, message: `Server ${existingServer.name} deleted successfully.` });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  if (req.method === 'POST' && req.path.endsWith('/transfer')) {
    try {
      const { id, new_owner_id, actor_id } = req.body || {};
      if (!id || !new_owner_id) {
        res.status(400).json({ error: 'Missing server id or new_owner_id' });
        return;
      }

      const [server, newOwner] = await Promise.all([
        serversColl.findOne({ _id: id }),
        usersColl.findOne({ _id: new_owner_id }),
      ]);

      if (!server) {
        res.status(404).json({ error: 'Server not found' });
        return;
      }
      if (!newOwner) {
        res.status(404).json({ error: 'Target owner user not found' });
        return;
      }

      await serversColl.updateOne({ _id: id }, { $set: { owner: new_owner_id } });

      await auditColl.insertOne({
        _id: `pal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        action: 'ServerOwnershipTransferred',
        actor_id: actor_id || 'admin',
        target_id: id,
        target_type: 'Server',
        reason: `Ownership transferred from ${server.owner} to ${new_owner_id} (@${newOwner.username})`,
        details: { old_owner: server.owner, new_owner: new_owner_id },
        created_at: new Date().toISOString(),
      });

      res.json({ success: true, message: `Server ownership transferred to @${newOwner.username}.` });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
    return;
  }
}

// 10. Bots Management (/api/mongo/bots)
export async function handleMongoBots(req: Request, res: Response) {
  const conn = await getMongoDb();
  if (!conn) {
    res.status(503).json({ error: 'MongoDB connection not active', fallback: true });
    return;
  }

  const { db } = conn;
  const botsColl = db.collection<any>('bots');
  const usersColl = db.collection<any>('users');
  const auditColl = db.collection<any>('platform_audit_logs');

  if (req.method === 'GET') {
    try {
      const bots = await botsColl.find({}).sort({ _id: -1 }).toArray();
      const botUserIds = bots.map((b) => b._id || b.user_id);
      const ownerIds = bots.map((b) => b.owner);
      const allUserIds = Array.from(new Set([...botUserIds, ...ownerIds].filter(Boolean)));

      const users = await usersColl.find({ _id: { $in: allUserIds } }).toArray();
      const userMap = new Map(users.map((u) => [u._id, u]));

      const enriched = bots.map((b) => ({
        ...b,
        user: userMap.get(b._id || b.user_id) || null,
        owner_user: userMap.get(b.owner) || null,
      }));

      res.json({ bots: enriched });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  if (req.method === 'POST' && (req.path.endsWith('/reset-token') || req.body?.action === 'reset_token')) {
    try {
      const botId = req.body?.id || req.body?.bot_id;
      const actorId = req.body?.actor_id || 'admin';
      if (!botId) {
        res.status(400).json({ error: 'Missing bot id' });
        return;
      }

      const bot = await botsColl.findOne({ $or: [{ _id: botId }, { user_id: botId }] });
      if (!bot) {
        res.status(404).json({ error: 'Bot record not found in MongoDB' });
        return;
      }

      // Generate 64-char URL-safe crypto token
      const newToken = crypto.randomBytes(48).toString('base64url');
      await botsColl.updateOne(
        { $or: [{ _id: botId }, { user_id: botId }] },
        { $set: { token: newToken, updated_at: new Date().toISOString() } }
      );

      await auditColl.insertOne({
        _id: `pal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        action: 'BotTokenReset',
        actor_id: actorId,
        target_id: botId,
        target_type: 'User',
        reason: 'Bot authentication token reset by administrator',
        details: { bot_id: botId, token_preview: `${newToken.slice(0, 10)}...` },
        created_at: new Date().toISOString(),
      });

      res.json({ success: true, token: newToken, message: 'Bot token regenerated successfully.' });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  if (req.method === 'PATCH' || req.path.endsWith('/edit')) {
    try {
      const { id, username, public: isPublic, interactions_url, flags, actor_id } = req.body || {};
      if (!id) {
        res.status(400).json({ error: 'Missing bot id' });
        return;
      }

      const updateBotFields: Record<string, any> = {};
      if (typeof isPublic === 'boolean') updateBotFields.public = isPublic;
      if (interactions_url !== undefined) updateBotFields.interactions_url = interactions_url ? interactions_url.trim() : null;
      if (typeof flags === 'number') updateBotFields.flags = flags;

      if (Object.keys(updateBotFields).length > 0) {
        await botsColl.updateOne({ $or: [{ _id: id }, { user_id: id }] }, { $set: updateBotFields });
      }

      if (typeof username === 'string' && username.trim()) {
        await usersColl.updateOne({ _id: id }, { $set: { username: username.trim() } });
      }

      await auditColl.insertOne({
        _id: `pal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        action: 'BotUpdated',
        actor_id: actor_id || 'admin',
        target_id: id,
        target_type: 'User',
        reason: 'Bot information updated by administrator',
        details: { ...updateBotFields, username },
        created_at: new Date().toISOString(),
      });

      res.json({ success: true, message: 'Bot information updated successfully.' });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  if (req.method === 'DELETE' || req.path.endsWith('/delete')) {
    try {
      const botId = (req.query.id as string) || req.body?.id;
      const actorId = req.body?.actor_id || 'admin';
      if (!botId) {
        res.status(400).json({ error: 'Missing bot id' });
        return;
      }

      const bot = await botsColl.findOne({ $or: [{ _id: botId }, { user_id: botId }] });
      const botUser = await usersColl.findOne({ _id: botId });

      await Promise.all([
        botsColl.deleteOne({ $or: [{ _id: botId }, { user_id: botId }] }),
        usersColl.deleteOne({ _id: botId }),
      ]);

      await auditColl.insertOne({
        _id: `pal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        action: 'BotDeleted',
        actor_id: actorId,
        target_id: botId,
        target_type: 'User',
        reason: req.body?.reason || 'Bot and bot user record deleted by administrator',
        details: { bot_owner: bot?.owner, username: botUser?.username },
        created_at: new Date().toISOString(),
      });

      res.json({ success: true, message: 'Bot deleted successfully.' });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
    return;
  }
}

// 11. Communication & Announcements (/api/mongo/communication)
export async function handleMongoCommunication(req: Request, res: Response) {
  const conn = await getMongoDb();
  if (!conn) {
    res.status(503).json({ error: 'MongoDB connection not active', fallback: true });
    return;
  }

  const { db } = conn;
  const usersColl = db.collection<any>('users');
  const botsColl = db.collection<any>('bots');
  const channelsColl = db.collection<any>('channels');
  const messagesColl = db.collection<any>('messages');
  const auditColl = db.collection<any>('platform_audit_logs');

  if (req.method === 'GET' && (req.path.endsWith('/bot') || req.path.endsWith('/config'))) {
    try {
      const envBotId = (process.env.ANNOUNCEMENT_BOT_ID || process.env.VITE_ANNOUNCEMENT_BOT_ID || process.env.BOT_ID || '').trim();
      let resolvedBotId = envBotId;

      // If not configured in env, find the first bot in bots collection or fallback
      if (!resolvedBotId) {
        const firstBot = await botsColl.findOne({});
        if (firstBot) {
          resolvedBotId = firstBot._id || firstBot.user_id;
        } else {
          resolvedBotId = '01HQBOT0000000000000000000';
        }
      }

      // Check for bot token in env or bots collection
      let botToken = (process.env.ANNOUNCEMENT_BOT_TOKEN || process.env.BOT_TOKEN || '').trim();
      const botDoc = await botsColl.findOne({ $or: [{ _id: resolvedBotId }, { user_id: resolvedBotId }] }).catch(() => null);
      if (!botToken && botDoc?.token) {
        botToken = botDoc.token;
      }

      const apiUrl = (process.env.STOAT_API_URL || process.env.REVOLT_API_URL || process.env.VITE_STOAT_API_URL || process.env.API_URL || 'https://api.dawn-chat.com').replace(/\/+$/, '');

      // Proactively initialize / verify revolt.js bot client if token is present
      if (botToken) {
        getOrInitBotClient(botToken, apiUrl).catch((err) => {
          console.warn('[revolt.js] Background login attempt failed:', err);
        });
      }

      let botUser = await usersColl.findOne({ _id: resolvedBotId });
      if (!botUser && botDoc) {
        botUser = await usersColl.findOne({ _id: botDoc._id || botDoc.user_id });
      }

      if (!botUser) {
        botUser = {
          _id: resolvedBotId,
          username: 'DawnAnnouncer',
          discriminator: '0000',
          display_name: 'DawnChat Announcement Bot',
          bot: { owner: '01ADMIN0000000000000000000' },
        };
      }

      const clientStatus = getBotClientStatus();

      res.json({
        configured: Boolean(envBotId),
        env_var: 'ANNOUNCEMENT_BOT_ID',
        bot_id: resolvedBotId,
        has_token: Boolean(botToken),
        api_url: apiUrl,
        revolt_client: clientStatus,
        bot: {
          _id: resolvedBotId,
          user: botUser,
          public: true,
        },
      });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  if (req.method === 'GET' && req.path.endsWith('/history')) {
    try {
      const logs = await auditColl
        .find({ action: { $in: ['AnnouncementBroadcast', 'SystemBroadcast'] } })
        .sort({ created_at: -1 })
        .limit(50)
        .toArray();

      res.json({ history: logs });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      const {
        bot_id,
        target_type,
        target_user_ids,
        content,
        embed,
        actor_id
      } = req.body || {};

      if (!content || typeof content !== 'string' || !content.trim()) {
        res.status(400).json({ error: 'Message content cannot be empty' });
        return;
      }

      // Priority: 1. ANNOUNCEMENT_BOT_ID from env, 2. payload bot_id, 3. fallback system bot
      const envBotId = (process.env.ANNOUNCEMENT_BOT_ID || process.env.VITE_ANNOUNCEMENT_BOT_ID || process.env.BOT_ID || '').trim();
      const effectiveBotId = envBotId || bot_id || '01HQBOT0000000000000000000';

      // Lookup bot token from env or database
      let effectiveBotToken = (process.env.ANNOUNCEMENT_BOT_TOKEN || process.env.BOT_TOKEN || '').trim();
      const botDoc = await botsColl.findOne({ $or: [{ _id: effectiveBotId }, { user_id: effectiveBotId }] }).catch(() => null);
      if (!effectiveBotToken && botDoc?.token) {
        effectiveBotToken = botDoc.token;
      }

      const apiUrl = (process.env.STOAT_API_URL || process.env.REVOLT_API_URL || process.env.VITE_STOAT_API_URL || process.env.API_URL || 'https://api.dawn-chat.com').replace(/\/+$/, '');

      // Ensure revolt.js bot client is logged in
      if (effectiveBotToken) {
        await getOrInitBotClient(effectiveBotToken, apiUrl).catch((e) => {
          console.warn('[revolt.js] Pre-broadcast login failed:', e);
        });
      }

      // Verify sender bot exists in users or bots collection
      let senderBotUser = await usersColl.findOne({ _id: effectiveBotId });
      if (!senderBotUser) {
        if (botDoc) {
          senderBotUser = await usersColl.findOne({ _id: botDoc._id || botDoc.user_id }) || {
            _id: effectiveBotId,
            username: 'DawnBot',
            discriminator: '0000',
          };
        } else {
          // Allow system default fallback bot
          senderBotUser = {
            _id: effectiveBotId,
            username: 'DawnAnnouncer',
            discriminator: '0000',
          };
        }
      }

      // Resolve recipient user IDs
      let recipientUserIds: string[] = [];
      if (target_type === 'all') {
        const allUsers = await usersColl
          .find({
            _id: { $ne: effectiveBotId },
            disabled: { $ne: true },
          })
          .project({ _id: 1, bot: 1 })
          .toArray();

        // Filter out bots if bot property exists
        const nonBotUsers = allUsers.filter((u) => !u.bot || !u.bot.owner);
        recipientUserIds = (nonBotUsers.length > 0 ? nonBotUsers : allUsers).map((u) => u._id);
      } else if (Array.isArray(target_user_ids) && target_user_ids.length > 0) {
        recipientUserIds = Array.from(new Set(target_user_ids.filter((id) => id && id !== effectiveBotId)));
      } else {
        res.status(400).json({ error: 'No recipients selected' });
        return;
      }

      if (recipientUserIds.length === 0) {
        // In case there are no extra users yet, send to the actor/current admin as test recipient
        if (actor_id && actor_id !== effectiveBotId) {
          recipientUserIds = [actor_id];
        } else {
          res.status(400).json({ error: 'No eligible recipients found' });
          return;
        }
      }

      let successCount = 0;
      let failCount = 0;
      let apiDeliveredCount = 0;

      const embedsArray = (embed && (embed.title || embed.description)) ? [{
        title: embed.title || null,
        description: embed.description || null,
        colour: embed.colour || '#f59e0b',
        url: embed.url || null,
      }] : [];

      // Broadcast message to each recipient via official stoat.js / revolt.js Bot client so real-time WebSocket events fire
      for (const targetUserId of recipientUserIds) {
        let deliveredViaApi = false;

        // 1. Try sending through revolt.js authenticated bot client
        if (effectiveBotToken) {
          try {
            const sendResult = await sendAnnouncementViaRevoltJs(
              targetUserId,
              content,
              embedsArray,
              effectiveBotToken,
              apiUrl
            );

            if (sendResult.success) {
              deliveredViaApi = true;
              apiDeliveredCount++;
              successCount++;
            }
          } catch {
            // Handled via DB fallback below
          }
        }

        // 2. Fallback to direct DB insert if Bot API was unreachable or no token available
        if (!deliveredViaApi) {
          try {
            let dmChannel = await channelsColl.findOne({
              channel_type: 'DirectMessage',
              recipients: { $all: [effectiveBotId, targetUserId] }
            });

            if (!dmChannel) {
              const newChannelId = generateCrockfordUlid();
              dmChannel = {
                _id: newChannelId,
                channel_type: 'DirectMessage',
                active: true,
                recipients: [effectiveBotId, targetUserId],
                last_message_id: null,
              };
              await channelsColl.insertOne(dmChannel);
            }

            const messageId = generateCrockfordUlid();
            const messageDoc = {
              _id: messageId,
              channel: dmChannel._id,
              author: effectiveBotId,
              content: content.trim(),
              embeds: embedsArray.map((e) => ({
                type: 'Text',
                title: e.title,
                description: e.description,
                colour: e.colour,
                url: e.url,
              })),
              created_at: new Date().toISOString(),
            };

            await messagesColl.insertOne(messageDoc);
            await channelsColl.updateOne(
              { _id: dmChannel._id },
              { $set: { last_message_id: messageId, active: true } }
            );

            successCount++;
          } catch (e) {
            console.warn(`Failed to deliver fallback broadcast to ${targetUserId}:`, e);
            failCount++;
          }
        }
      }

      const broadcastId = `bcast_${Date.now()}`;
      await auditColl.insertOne({
        _id: `pal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        action: 'AnnouncementBroadcast',
        actor_id: actor_id || 'admin',
        target_id: effectiveBotId,
        target_type: 'User',
        reason: `Broadcast sent via bot @${senderBotUser.username} (${apiDeliveredCount > 0 ? 'Bot API Events' : 'Direct DB'}) to ${successCount} user(s)`,
        details: {
          broadcast_id: broadcastId,
          bot_id: effectiveBotId,
          bot_username: senderBotUser.username,
          target_type,
          recipient_count: recipientUserIds.length,
          delivered_count: successCount,
          api_delivered_count: apiDeliveredCount,
          failed_count: failCount,
          dispatch_mode: apiDeliveredCount > 0 ? 'BotApiWithEvents' : (effectiveBotToken ? 'HybridWithFallback' : 'DirectDbOnly'),
          content_preview: content.length > 80 ? `${content.slice(0, 80)}...` : content,
          has_embed: Boolean(embed?.title || embed?.description),
        },
        created_at: new Date().toISOString(),
      });

      res.json({
        success: true,
        broadcast_id: broadcastId,
        total_recipients: recipientUserIds.length,
        successful_deliveries: successCount,
        api_deliveries: apiDeliveredCount,
        failed_deliveries: failCount,
        dispatch_mode: apiDeliveredCount > 0 ? 'BotApiWithEvents' : 'DirectDbFallback',
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
    return;
  }
}

