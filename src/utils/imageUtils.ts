export const DEFAULT_PLACEHOLDER = 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?q=80&w=1000';

/**
 * Extracts Google Drive File ID from various URL formats.
 */
export const extractDriveId = (url: string): string | null => {
  if (!url || !url.includes('drive.google.com')) return null;

  // Handle /file/d/ID/... or /d/ID
  let match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return match[1];

  // Handle ?id=ID or &id=ID
  match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return match[1];

  return null;
};

/**
 * Converts any Google Drive link to a direct-viewable thumbnail URL.
 */
export const getDirectImageUrl = (url: string | undefined): string => {
  if (!url) return DEFAULT_PLACEHOLDER;

  const driveId = extractDriveId(url);
  if (driveId) {
    return `https://drive.google.com/thumbnail?id=${driveId}&sz=w1000`;
  }

  // Handle Google Photos direct links (if provided by user from specific tools)
  if (url.includes('googleusercontent.com') && !url.includes('drive.google.com')) {
    return url;
  }

  // Handle relative paths
  if (url.startsWith('/')) return url;

  return url;
};

/**
 * Get a small thumbnail for preview purposes
 */
export const getPreviewThumbnail = (url: string): string => {
  if (!url) return '';
  const driveId = extractDriveId(url);
  if (driveId) {
    return `https://drive.google.com/thumbnail?id=${driveId}&sz=w400`;
  }
  return url;
};

/**
 * Validates whether a URL looks like a valid Google Drive sharing link
 */
export const isValidDriveUrl = (url: string): boolean => {
  if (!url) return false;
  return url.includes('drive.google.com') && extractDriveId(url) !== null;
};

/**
 * Validates whether a URL looks like a valid Google Photos album or image link
 */
export const isGooglePhotosUrl = (url: string): boolean => {
  if (!url) return false;
  return url.includes('photos.app.goo.gl') || url.includes('photos.google.com/share');
};

/**
 * Gets a preview URL for Google Drive files
 */
export const getDrivePreviewUrl = (url: string): string => {
  if (!url) return '';
  const driveId = extractDriveId(url);
  if (driveId) {
    return `https://drive.google.com/file/d/${driveId}/preview`;
  }
  return url;
};
