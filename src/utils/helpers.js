/**
 * StegaVault – Utility Helpers
 */

/** Format bytes to human-readable string */
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Format bit count to human-readable string */
export function formatBits(bits) {
  if (bits < 1000) return `${bits} bits`;
  if (bits < 1_000_000) return `${(bits / 1000).toFixed(1)} Kbits`;
  return `${(bits / 1_000_000).toFixed(2)} Mbits`;
}

/** Format a timestamp ISO string to "Mar 29, 2024 · 14:33" */
export function formatTimestamp(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).replace(',', ' ·');
}

/** Trigger a file download from a Blob */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Copy text to clipboard, returns true on success */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Validate accepted image MIME types */
export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/bmp'];
export function isAcceptedImageType(type) {
  return ACCEPTED_IMAGE_TYPES.includes(type);
}

/** Returns a stem filename appended with "_stego.png" */
export function stegoFilename(originalName) {
  const stem = originalName.replace(/\.[^.]+$/, '');
  return `${stem}_stego.png`;
}

/** Clamp a value to [min, max] */
export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/** Produce a short truncated filename for display */
export function truncateFilename(name, maxLen = 28) {
  if (name.length <= maxLen) return name;
  const ext   = name.lastIndexOf('.') > 0 ? name.slice(name.lastIndexOf('.')) : '';
  const stem  = name.slice(0, maxLen - ext.length - 3);
  return `${stem}...${ext}`;
}

/** Sleep for ms milliseconds (useful for yielding to the UI) */
export function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/** Simple classnames helper – joins truthy strings */
export function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}
