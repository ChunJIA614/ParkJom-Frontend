/**
 * Colour-contrast helpers.
 *
 * Transit line badges paint their background from live GTFS data (`#FFCD00`
 * yellow, `#E57200` orange, …) but hard-code white text. On the lighter line
 * colours that lands near 1.6:1 — illegible. These helpers pick the label
 * colour from the fill's relative luminance instead.
 */

const WHITE = '#ffffff';
const INK = '#0b0b0d';

/** Parses `#rgb`, `#rrggbb`, or `rgb()/rgba()` into an [r, g, b] triple. */
export function parseColor(input: string | undefined | null): [number, number, number] | null {
  if (!input) return null;
  const value = input.trim();

  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const raw = hex[1];
    if (raw.length === 3) {
      return [
        parseInt(raw[0] + raw[0], 16),
        parseInt(raw[1] + raw[1], 16),
        parseInt(raw[2] + raw[2], 16),
      ];
    }
    return [
      parseInt(raw.slice(0, 2), 16),
      parseInt(raw.slice(2, 4), 16),
      parseInt(raw.slice(4, 6), 16),
    ];
  }

  const rgb = value.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];

  return null;
}

/** WCAG relative luminance. */
export function relativeLuminance(color: string | undefined | null): number {
  const rgb = parseColor(color);
  if (!rgb) return 0;
  const channel = (value: number) => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

/** WCAG contrast ratio between two opaque colours (1–21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Returns the label colour with the better contrast against `background`.
 * Used for data-driven badges so yellow/green lines get dark ink instead of
 * white.
 */
export function readableTextOn(background: string | undefined | null): string {
  const bg = background || '#007AFF';
  return contrastRatio(bg, WHITE) >= contrastRatio(bg, INK) ? WHITE : INK;
}
