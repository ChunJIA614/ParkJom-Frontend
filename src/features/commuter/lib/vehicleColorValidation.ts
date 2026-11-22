export const MAX_VEHICLE_COLOR_LENGTH = 30;

const colors = new Set([
  'amber', 'aqua', 'beige', 'black', 'blue', 'bronze', 'brown', 'burgundy', 'champagne', 'charcoal',
  'copper', 'cream', 'cyan', 'gold', 'gray', 'green', 'grey', 'gunmetal', 'indigo', 'ivory', 'khaki',
  'lavender', 'lime', 'magenta', 'maroon', 'mint', 'navy', 'olive', 'orange', 'pink', 'purple',
  'red', 'silver', 'tan', 'teal', 'turquoise', 'violet', 'white', 'yellow',
  'biru', 'coklat', 'emas', 'hijau', 'hitam', 'jingga', 'kelabu', 'kuning', 'merah', 'oren', 'perak',
  'putih', 'ungu',
]);

const modifiers = new Set([
  'ash', 'bright', 'dark', 'deep', 'forest', 'gloss', 'glossy', 'light', 'matte', 'metallic', 'midnight',
  'off', 'pale', 'pearl', 'pearlescent', 'rose', 'royal', 'satin', 'sky', 'soft', 'solid', 'steel',
  'cerah', 'gelap', 'jambu', 'metalik', 'muda', 'mutiara', 'tua',
]);

export function validateVehicleColor(value: string): string | null {
  const color = value.trim();
  if (!color) return 'Enter a vehicle color.';
  if (color.length > MAX_VEHICLE_COLOR_LENGTH) {
    return 'Use 30 characters or fewer for the color.';
  }

  const parts = color.toLowerCase().split(/[,/&+]|\b(?:and|dan)\b/);
  const isRecognized = parts.every(part => {
    const words = part.trim().split(/[\s-]+/);
    return words.some(word => colors.has(word)) && words.every(word => colors.has(word) || modifiers.has(word));
  });

  return isRecognized ? null : 'Enter a color such as Black, Pearl White, or Silver.';
}
