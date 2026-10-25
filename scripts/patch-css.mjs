import fs from 'node:fs';

let css = fs.readFileSync('src/app/styles/index.css', 'utf8');

// 1. Root variables
if (!css.includes('--bg-surface:')) {
  css = css.replace(
    ':root {\r\n  --accent-blue:',
    ':root {\r\n  /* Apple HIG & Interactive Dot Wave Surface Tokens (Light) */\r\n  --bg-surface: #f5f5f7;\r\n  --dot-base: rgba(0, 0, 0, 0.14);\r\n  --system-primary: #0071e3;\r\n  --system-primary-rgb: 0, 113, 227;\r\n  --system-secondary: #5e5ce6;\r\n  --system-secondary-rgb: 94, 92, 230;\r\n\r\n  --accent-blue:'
  );
}

// 2. Dark variables
if (!css.includes('--bg-surface: #090a0f')) {
  css = css.replace(
    '.dark {\r\n  color-scheme: dark;\r\n\r\n  /* ParkJom dark palette */',
    '.dark {\r\n  /* Apple HIG & Interactive Dot Wave Surface Tokens (Dark) */\r\n  --bg-surface: #090a0f;\r\n  --dot-base: rgba(255, 255, 255, 0.16);\r\n  --system-primary: #0a84ff;\r\n  --system-primary-rgb: 10, 132, 255;\r\n  --system-secondary: #5e5ce6;\r\n  --system-secondary-rgb: 94, 92, 230;\r\n\r\n  color-scheme: dark;\r\n\r\n  /* ParkJom dark palette */'
  );
}

// 3. Apple Glass Card & Pill
if (!css.includes('.apple-glass-card')) {
  const glassCard = [
    '/* Apple Human Interface Guidelines Frosted Glass Card */',
    '.apple-glass-card {',
    '  background: rgba(255, 255, 255, 0.72);',
    '  backdrop-filter: blur(24px) saturate(180%);',
    '  -webkit-backdrop-filter: blur(24px) saturate(180%);',
    '  border: 1px solid rgba(0, 0, 0, 0.08);',
    '  border-radius: 24px;',
    '  box-shadow:',
    '    0 24px 60px -12px rgba(0, 0, 0, 0.08),',
    '    0 8px 24px -4px rgba(0, 0, 0, 0.04),',
    '    inset 0 1px 1px 0 rgba(255, 255, 255, 0.85);',
    '}',
    '',
    '.dark .apple-glass-card {',
    '  background: rgba(22, 22, 26, 0.72);',
    '  backdrop-filter: blur(24px) saturate(180%);',
    '  -webkit-backdrop-filter: blur(24px) saturate(180%);',
    '  border: 1px solid rgba(255, 255, 255, 0.12);',
    '  box-shadow:',
    '    0 32px 72px -16px rgba(0, 0, 0, 0.65),',
    '    0 12px 32px -4px rgba(0, 0, 0, 0.45),',
    '    inset 0 1px 1px 0 rgba(255, 255, 255, 0.14);',
    '}',
    '',
    '.apple-floating-pill {',
    '  background: rgba(255, 255, 255, 0.82);',
    '  backdrop-filter: blur(20px) saturate(180%);',
    '  -webkit-backdrop-filter: blur(20px) saturate(180%);',
    '  border: 1px solid rgba(0, 0, 0, 0.08);',
    '  border-radius: 9999px;',
    '  box-shadow: 0 10px 30px -6px rgba(0, 0, 0, 0.1), 0 2px 8px -2px rgba(0, 0, 0, 0.05);',
    '}',
    '',
    '.dark .apple-floating-pill {',
    '  background: rgba(28, 28, 32, 0.82);',
    '  backdrop-filter: blur(20px) saturate(180%);',
    '  -webkit-backdrop-filter: blur(20px) saturate(180%);',
    '  border: 1px solid rgba(255, 255, 255, 0.14);',
    '  box-shadow: 0 12px 36px -6px rgba(0, 0, 0, 0.6), 0 4px 12px -2px rgba(0, 0, 0, 0.4);',
    '}',
    '',
    '.glass-dark {',
  ].join('\r\n');

  css = css.replace('.glass-dark {', glassCard);
}

// 4. Update .google-signin-shell to support flexible width and no clipped icon
const oldGsi = [
  '.google-signin-shell {',
  '  display: flex;',
  '  align-items: center;',
  '  justify-content: center;',
  '  width: 260px;',
  '  max-width: 100%;',
  '  height: 40px;',
  '  border-radius: 9999px;',
  '  overflow: hidden;',
  '}',
].join('\r\n');

const newGsi = [
  '.google-signin-shell {',
  '  display: flex;',
  '  align-items: center;',
  '  justify-content: center;',
  '  width: 100%;',
  '  max-width: 330px;',
  '  min-height: 44px;',
  '  border-radius: 9999px;',
  '  overflow: visible;',
  '}',
  '',
  '.google-signin-shell iframe {',
  '  border-radius: 9999px;',
  '  max-width: 100% !important;',
  '}',
].join('\r\n');

if (css.includes(oldGsi)) {
  css = css.replace(oldGsi, newGsi);
}

fs.writeFileSync('src/app/styles/index.css', css, 'utf8');
console.log('Successfully patched index.css');
