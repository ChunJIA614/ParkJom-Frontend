export const MAX_PLATE_LENGTH = 16;

/**
 * Known Malaysian JPJ special / commemorative registration prefixes that go
 * beyond the standard 1–3 letter `[A-Z]{1,3}` prefix rule.
 */
export const SPECIAL_PLATE_PREFIXES: readonly string[] = [
  // National, commemorative & recent JPJeBid series
  'PUTRAJAYA',
  'MALAYSIA',
  'MADANI',
  'GOLD',
  'PETRA',
  'ANSARA',
  'VIPS',
  'WCEC',
  'FFFF',
  'PATRIOT',
  'SUKOM',
  'SUHAKAM',
  'RIMAU',
  'HARIMAU',
  'RAPID',
  'BAMBEE',
  'TIGER',
  'LANGKAWI',
  'PERFECT',
  'NBOS',
  'MERDEKA',
  'ASEAN',
  'CYBERJAYA',
  'ISKANDAR',
  'KLIA',
  'WAWASAN',
  'CHANCELLOR',
  'PUTRA',
  // 1Malaysia & alphanumeric special series
  'G1M',
  '1M4U',
  'IM4U',
  '1MCY',
  'A1M',
  'K1M',
  'T1M',
  'E1M',
  'U1M',
  'Y1M',
  // Automotive commemorative series
  'PROTON',
  'PERODUA',
  'PERDANA',
  'NAZA',
  'LOTUS',
  'TIARA',
  'SATRIA',
  'WAJA',
  'KRISS',
  'JAGUH',
  'SAGA',
  'WIRA',
  'GEN2',
  'PERSONA',
  'MYVI',
  'EXORA',
  'ALZA',
  'INSPIRA',
  'PREVE',
  'SUPRIMA',
  'IRIZ',
  'AXIA',
  'BEZZA',
  'ATIVA',
  'ARUZ',
  // Malaysian university special series (2–3 letter codes match [A-Z]{1,3})
  'UITM',
  'IIUM',
  'UIAM',
  'UTEM',
  'UNIMAS',
  'UTAR',
  'UNITEN',
  'UNISEL',
  'UNISZA',
  'UNIMAP',
  'UTHM',
  'UPSI',
  'USIM',
  'UPNM',
  'UNIKL',
  'UCSI',
  'INTI',
  'HELP',
  'SUNWAY',
  'TAYLORS',
  // 4+ letter Roman numeral JPJ series
  'XIII',
  'XVII',
  'XVIII',
  'XIX',
];

const SPECIAL_PREFIX_PATTERN = [...SPECIAL_PLATE_PREFIXES]
  .sort((a, b) => b.length - a.length)
  .join('|');

// Standard JPJ plates, 1–3 letter special series (FF, FFF, EV, GM, FH, SIS, SMJ, VIP, VMY),
// and single-letter framed series (e.g. M 888 M, A 9 A, P 80 P, H 1 H).
const STANDARD_AND_FRAMED_REGEX = /^[A-Z]{1,3}\s?[1-9]\d{0,3}(?:\s?[A-Z])?$/;

// Special word / alphanumeric prefix series (e.g. MADANI 88, PUTRAJAYA 1234, GOLD 1, G1M 88).
const SPECIAL_SERIES_REGEX = new RegExp(`^(?:${SPECIAL_PREFIX_PATTERN})\\s?[1-9]\\d{0,3}$`);

// Visit Malaysia 2026 framed series (e.g. V 2026 MY, V2026MY).
const VISIT_MALAYSIA_REGEX = /^V\s?[1-9]\d{0,3}\s?MY$/;

const VALID_PLATE_PATTERNS = [
  STANDARD_AND_FRAMED_REGEX,
  SPECIAL_SERIES_REGEX,
  VISIT_MALAYSIA_REGEX,
];

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

  if (!VALID_PLATE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return 'Enter a valid Malaysian number plate (e.g. WXY 1234, W 1234 A, MADANI 88, or PUTRAJAYA 1234).';
  }

  return null;
}
