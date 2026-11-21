export const MAX_PLATE_LENGTH = 16;

const SPECIAL_PREFIXES =
  'PUTRAJAYA|MALAYSIA|PROTON|PERODUA|PERDANA|SUHAKAM|PATRIOT|RIMAU|RAPID|LOTUS|BAMBEE|TIGER|MADANI|GOLD|LANGKAWI|NAZA|TIARA|SATRIA|WAJA|KRISS|SUKOM|PERFECT|G1M|1M4U|K1M|T1M|NBOS|USM|UUM|UTM|UKM|UITM|IIUM|UM|UPM|UTEM|UMP|UNIMAS|UMS|UTAR|MMU|UNITEN|UNISEL';

const MALAYSIAN_PLATE_REGEX = new RegExp(
  `^(?:${SPECIAL_PREFIXES}|[A-Z]{1,3})\\s?[1-9]\\d{0,3}(?:\\s?[A-Z])?$`,
);

/** Collapse whitespace and uppercase a vehicle registration plate. */
export function normalizeVehiclePlate(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, ' ');
}

/**
 * Sanitize interactive plate input while typing: keep letters, digits, and
 * single spaces, strip leading spaces, uppercase, and enforce MAX_PLATE_LENGTH.
 */
export function sanitizePlateInput(raw: string): string {
  return raw
    .replace(/[^A-Za-z0-9\s]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/^\s+/, '')
    .slice(0, MAX_PLATE_LENGTH);
}

/**
 * Validate a Malaysian JPJ car plate format. Returns an error message or null
 * when valid. Empty input returns `'Number plate is required.'`.
 */
export function validateVehiclePlate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return 'Number plate is required.';
  }

  if (/[^A-Za-z0-9\s]/.test(trimmed)) {
    return 'Number plate may only contain letters, numbers, and spaces.';
  }

  const normalized = normalizeVehiclePlate(trimmed);
  if (normalized.length > MAX_PLATE_LENGTH) {
    return `Number plate must be ${MAX_PLATE_LENGTH} characters or fewer.`;
  }

  if (!MALAYSIAN_PLATE_REGEX.test(normalized)) {
    return 'Enter a valid Malaysian number plate (e.g. WXY 1234 or W 1234 A).';
  }

  return null;
}
