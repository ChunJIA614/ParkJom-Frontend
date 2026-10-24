/**
 * formatUtils.ts
 * Utility functions for formatting and truncating parking spot names, station names, and addresses.
 */

/**
 * Shortens a parking spot name or geocoded address.
 * If the string contains comma-separated address segments, extracts the primary building/spot name.
 * If the resulting string exceeds maxChars, truncates cleanly with ellipsis '...'.
 */
export function formatShortSpotName(name?: string | null, maxChars = 26): string {
  if (!name || !name.trim()) return 'Parking Bay';
  const trimmed = name.trim();
  // Extract primary name before comma (e.g., "USJ One Avenue Condominium, USJ 1..." -> "USJ One Avenue Condominium")
  const primary = trimmed.split(',')[0].trim();
  if (primary.length <= maxChars) {
    return primary;
  }
  return `${primary.slice(0, maxChars).trim()}...`;
}

/**
 * Shortens a full street address for compact mobile / preview chips.
 */
export function formatShortAddress(address?: string | null, maxChars = 36): string {
  if (!address || !address.trim()) return '';
  const trimmed = address.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxChars).trim()}...`;
}
