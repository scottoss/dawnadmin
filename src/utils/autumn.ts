/**
 * Autumn / Authum File Server URL Resolver
 * Autumn lives at https://api.dawn-chat.com/autumn
 */

export const AUTUMN_BASE_URL = 'https://api.dawn-chat.com/autumn';

/**
 * Returns the public Autumn URL for an attachment
 */
export function getAutumnAttachmentUrl(attachmentId: string, filename?: string): string {
  if (!attachmentId) return '';
  const safeFilename = filename ? `/${encodeURIComponent(filename)}` : '';
  return `${AUTUMN_BASE_URL}/attachments/${attachmentId}${safeFilename}`;
}

/**
 * Returns the public Autumn URL for an avatar
 */
export function getAutumnAvatarUrl(avatarId: string, filename?: string): string {
  if (!avatarId) return '';
  const safeFilename = filename ? `/${encodeURIComponent(filename)}` : '';
  return `${AUTUMN_BASE_URL}/avatars/${avatarId}${safeFilename}`;
}

/**
 * Returns the public Autumn URL for a banner
 */
export function getAutumnBannerUrl(bannerId: string, filename?: string): string {
  if (!bannerId) return '';
  const safeFilename = filename ? `/${encodeURIComponent(filename)}` : '';
  return `${AUTUMN_BASE_URL}/banners/${bannerId}${safeFilename}`;
}

/**
 * Returns the public Autumn URL for an icon / server icon
 */
export function getAutumnIconUrl(iconId: string, filename?: string): string {
  if (!iconId) return '';
  const safeFilename = filename ? `/${encodeURIComponent(filename)}` : '';
  return `${AUTUMN_BASE_URL}/icons/${iconId}${safeFilename}`;
}
