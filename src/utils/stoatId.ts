/**
 * Stoat ULID / Crockford Base32 ID Decoder & Helpers
 * Stoat IDs are 26 characters: 10 chars (48-bit timestamp) + 16 chars randomness.
 */

import { UserBadges } from '../types/stoat';

const CROCKFORD_CHARS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CROCKFORD_LOOKUP: Record<string, number> = {};
for (let i = 0; i < CROCKFORD_CHARS.length; i++) {
  CROCKFORD_LOOKUP[CROCKFORD_CHARS[i]] = i;
}

export interface DecodedIdInfo {
  id: string;
  isValid: boolean;
  timestampMs?: number;
  date?: Date;
  isoString?: string;
  formattedDate?: string;
  timeAgo?: string;
}

export function isValidStoatId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  const clean = id.trim().toUpperCase();
  if (clean.length !== 26) return false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (CROCKFORD_LOOKUP[c] === undefined && c !== 'O' && c !== 'I' && c !== 'L') {
      return false;
    }
  }
  return true;
}

export function decodeStoatId(id: string): DecodedIdInfo {
  if (!id || typeof id !== 'string') {
    return { id: '', isValid: false };
  }

  const clean = id.trim().toUpperCase()
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');

  if (clean.length !== 26) {
    return { id, isValid: false };
  }

  try {
    let timestampMs = 0;
    for (let i = 0; i < 10; i++) {
      const char = clean[i];
      const val = CROCKFORD_LOOKUP[char];
      if (val === undefined) {
        return { id, isValid: false };
      }
      timestampMs = timestampMs * 32 + val;
    }

    // Sanity check timestamp range (year 2020 to 2040)
    if (timestampMs < 1577836800000 || timestampMs > 2208988800000) {
      return { id, isValid: false, timestampMs };
    }

    const date = new Date(timestampMs);
    const isoString = date.toISOString();
    const formattedDate = date.toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'medium',
      timeZone: 'UTC',
    }) + ' UTC';

    const timeAgo = formatTimeAgo(timestampMs);

    return {
      id,
      isValid: true,
      timestampMs,
      date,
      isoString,
      formattedDate,
      timeAgo,
    };
  } catch {
    return { id, isValid: false };
  }
}

function formatTimeAgo(timestampMs: number): string {
  const diffSec = Math.floor((Date.now() - timestampMs) / 1000);
  if (diffSec < 0) return 'in the future';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears}y ago`;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function parseUserBadges(badges?: number): string[] {
  if (!badges) return [];
  const list: string[] = [];
  if (badges & UserBadges.Developer) list.push('Developer');
  if (badges & UserBadges.Translator) list.push('Translator');
  if (badges & UserBadges.Supporter) list.push('Supporter');
  if (badges & UserBadges.ResponsibleDisclosure) list.push('Responsible Disclosure');
  if (badges & UserBadges.Founder) list.push('Founder');
  if (badges & UserBadges.PlatformModeration) list.push('Platform Moderation');
  if (badges & UserBadges.ActiveSupporter) list.push('Active Supporter');
  if (badges & UserBadges.Paw) list.push('Paw');
  if (badges & UserBadges.EarlyAdopter) list.push('Early Adopter');
  if (badges & UserBadges.ReservedRelevantJokeBadge1) list.push('Reserved Relevant Joke Badge 1');
  if (badges & UserBadges.ReservedRelevantJokeBadge2) list.push('Reserved Relevant Joke Badge 2');
  return list;
}

export function parseUserFlags(flags?: number): string[] {
  if (!flags) return [];
  const list: string[] = [];
  if (flags & 1) list.push('Suspended');
  if (flags & 2) list.push('Deleted');
  if (flags & 4) list.push('Banned');
  if (flags & 8) list.push('Spam');
  return list;
}
