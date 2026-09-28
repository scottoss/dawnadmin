/**
 * Revolt.js / Stoat.js Bot Client Instance for DawnChat Announcements & Real-Time Events
 */
import { Client } from 'revolt.js';

interface BotClientStatus {
  connected: boolean;
  loggingIn: boolean;
  user: {
    _id: string;
    username: string;
    discriminator?: string;
  } | null;
  apiUrl: string;
  error?: string | null;
  lastConnected?: string | null;
}

let botClientInstance: Client | null = null;
let currentToken: string | null = null;
let currentApiUrl: string = 'https://api.dawn-chat.com';
let isLoggingIn = false;
let lastError: string | null = null;
let lastConnectedTime: string | null = null;

function isClientReady(client: Client | null): boolean {
  if (!client) return false;
  try {
    if (typeof (client as any).ready === 'function') {
      return Boolean((client as any).ready());
    }
    return Boolean((client as any).ready || client.user);
  } catch {
    return Boolean(client.user);
  }
}

export function getBotClientStatus(): BotClientStatus {
  const isReady = isClientReady(botClientInstance);
  const user = botClientInstance?.user as any;

  return {
    connected: isReady,
    loggingIn: isLoggingIn,
    user: user
      ? {
          _id: user.id || user._id || '',
          username: user.username || 'DawnAnnouncer',
          discriminator: user.discriminator,
        }
      : null,
    apiUrl: currentApiUrl,
    error: lastError,
    lastConnected: lastConnectedTime,
  };
}

export async function getOrInitBotClient(
  token?: string,
  apiUrl?: string
): Promise<Client | null> {
  const targetApiUrl = (apiUrl || process.env.STOAT_API_URL || process.env.REVOLT_API_URL || process.env.VITE_STOAT_API_URL || 'https://api.dawn-chat.com').replace(/\/+$/, '');
  const targetToken = (token || process.env.ANNOUNCEMENT_BOT_TOKEN || process.env.BOT_TOKEN || '').trim();

  currentApiUrl = targetApiUrl;

  if (!targetToken) {
    lastError = 'No bot token provided or configured in environment';
    return null;
  }

  // If already logged in with same token and apiUrl and client is ready
  if (botClientInstance && isClientReady(botClientInstance) && currentToken === targetToken) {
    return botClientInstance;
  }

  if (isLoggingIn) {
    let attempts = 0;
    while (isLoggingIn && attempts < 20) {
      await new Promise((r) => setTimeout(r, 250));
      attempts++;
    }
    if (botClientInstance && isClientReady(botClientInstance)) {
      return botClientInstance;
    }
  }

  isLoggingIn = true;
  lastError = null;

  try {
    // Disconnect old client if present
    if (botClientInstance) {
      try {
        if (typeof (botClientInstance as any).disconnect === 'function') {
          (botClientInstance as any).disconnect();
        } else if (typeof (botClientInstance as any).destroy === 'function') {
          (botClientInstance as any).destroy();
        }
      } catch {}
    }

    const client = new Client({
      baseURL: targetApiUrl,
    });

    client.on('ready', () => {
      const user = client.user as any;
      console.log(`[stoat.js / revolt.js] Bot connected as @${user?.username || 'DawnAnnouncer'} (${user?.id || user?._id || ''})`);
      lastConnectedTime = new Date().toISOString();
      lastError = null;
    });

    client.on('error', (err: any) => {
      lastError = err?.message || String(err);
    });

    await client.loginBot(targetToken);
    botClientInstance = client;
    currentToken = targetToken;
    lastConnectedTime = new Date().toISOString();
    return client;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    lastError = msg;
    return null;
  } finally {
    isLoggingIn = false;
  }
}

/**
 * Helper to safely parse JSON response without throwing SyntaxError on HTML errors
 */
async function safeParseJson(res: globalThis.Response): Promise<{ ok: boolean; status: number; data: any; text?: string }> {
  const status = res.status;
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text().catch(() => '');

  if (contentType.includes('application/json') || (text.startsWith('{') || text.startsWith('['))) {
    try {
      const data = JSON.parse(text);
      return { ok: res.ok, status, data, text };
    } catch {
      return { ok: false, status, data: null, text };
    }
  }
  return { ok: false, status, data: null, text: text.slice(0, 300) };
}

/**
 * Sends announcement message directly via revolt.js / stoat.js client so all real-time events fire
 */
export async function sendAnnouncementViaRevoltJs(
  targetUserId: string,
  content: string,
  embeds?: Array<{ title?: string | null; description?: string | null; colour?: string | null; url?: string | null }>,
  token?: string,
  apiUrl?: string
): Promise<{ success: boolean; message_id?: string; channel_id?: string; error?: string }> {
  const targetApiUrl = (apiUrl || process.env.STOAT_API_URL || process.env.REVOLT_API_URL || process.env.VITE_STOAT_API_URL || 'https://api.dawn-chat.com').replace(/\/+$/, '');
  const targetToken = (token || process.env.ANNOUNCEMENT_BOT_TOKEN || process.env.BOT_TOKEN || '').trim();

  // Format embeds for Revolt
  const formattedEmbeds = embeds && embeds.length > 0
    ? embeds.map((e) => ({
        type: 'Text' as const,
        title: e.title || undefined,
        description: e.description || undefined,
        colour: e.colour || undefined,
        url: e.url || undefined,
      }))
    : undefined;

  // 1. Try using active revolt.js Client instance
  try {
    const client = await getOrInitBotClient(targetToken, targetApiUrl);

    if (client && isClientReady(client)) {
      // Try high level User.openDM()
      try {
        let userObj: any = null;
        if (typeof (client as any).users?.fetch === 'function') {
          userObj = await (client as any).users.fetch(targetUserId).catch(() => null);
        } else if (typeof (client as any).users?.get === 'function') {
          userObj = (client as any).users.get(targetUserId);
        }

        if (userObj && typeof userObj.openDM === 'function') {
          const dmChannel = await userObj.openDM();
          if (dmChannel && typeof dmChannel.sendMessage === 'function') {
            const sentMsg = await dmChannel.sendMessage({
              content: content.trim(),
              embeds: formattedEmbeds,
            });
            return {
              success: true,
              message_id: sentMsg?.id || sentMsg?._id,
              channel_id: dmChannel.id || dmChannel._id,
            };
          }
        }
      } catch (clientObjErr) {
        // High-level object method didn't succeed, proceed to safe REST fallback
      }
    }
  } catch (initErr) {
    // Client login attempt failed
  }

  // 2. Safe REST HTTP call with headers & safe JSON parsing
  if (targetToken) {
    try {
      const headers: Record<string, string> = {
        'x-bot-token': targetToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'DawnChat-Announcer/1.0',
      };

      // Step A: Open / Fetch DM Channel
      let dmRes = await fetch(`${targetApiUrl}/users/${encodeURIComponent(targetUserId)}/dm`, {
        method: 'GET',
        headers,
      }).catch(() => null);

      if (!dmRes || !dmRes.ok) {
        dmRes = await fetch(`${targetApiUrl}/users/${encodeURIComponent(targetUserId)}/dm`, {
          method: 'POST',
          headers,
        }).catch(() => null);
      }

      if (dmRes) {
        const parsedDm = await safeParseJson(dmRes);
        const channelId = parsedDm.data?.id || parsedDm.data?._id;

        if (channelId) {
          const sendRes = await fetch(`${targetApiUrl}/channels/${encodeURIComponent(channelId)}/messages`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              content: content.trim(),
              embeds: formattedEmbeds,
            }),
          }).catch(() => null);

          if (sendRes) {
            const parsedSend = await safeParseJson(sendRes);
            if (parsedSend.ok) {
              return {
                success: true,
                message_id: parsedSend.data?.id || parsedSend.data?._id,
                channel_id: channelId,
              };
            }
          }
        }
      }
    } catch (restErr: unknown) {
      const msg = restErr instanceof Error ? restErr.message : String(restErr);
      return { success: false, error: msg };
    }
  }

  return {
    success: false,
    error: lastError || 'API endpoint not reachable; fallback to direct DB delivery',
  };
}
