import fs from 'node:fs';

const filePath = 'src/app/styles/index.css';
let css = fs.readFileSync(filePath, 'utf8');

// 1. Add .google-signin-shell if not present
if (!css.includes('.google-signin-shell')) {
  const target = '.dark .apple-floating-pill {';
  const index = css.indexOf(target);
  if (index !== -1) {
    const closeBrace = css.indexOf('}', index);
    if (closeBrace !== -1) {
      const insertion = `\n\n/* Google Sign-in shell (responsive, no clipped icon) */\n.google-signin-shell {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  width: 100%;\n  max-width: 320px;\n  min-height: 44px;\n}\n\n.google-signin-shell iframe {\n  max-width: 100% !important;\n  border-radius: 9999px !important;\n}`;
      css = css.slice(0, closeBrace + 1) + insertion + css.slice(closeBrace + 1);
      console.log('Inserted .google-signin-shell');
    }
  }
}

// 2. Add dark surface tokens to .dark block
if (!css.includes('--bg-surface: #090a0f')) {
  // Find `.dark {`
  const darkTarget = '.dark {';
  const darkIndex = css.lastIndexOf(darkTarget);
  if (darkIndex !== -1) {
    const insertion = `\n  /* Apple HIG & Interactive Dot Wave Surface Tokens (Dark) */\n  --bg-surface: #090a0f;\n  --dot-base: rgba(255, 255, 255, 0.16);\n  --system-primary: #0a84ff;\n  --system-primary-rgb: 10, 132, 255;\n  --system-secondary: #5e5ce6;\n  --system-secondary-rgb: 94, 92, 230;\n`;
    css = css.slice(0, darkIndex + darkTarget.length) + insertion + css.slice(darkIndex + darkTarget.length);
    console.log('Inserted dark surface tokens into .dark');
  }
}

fs.writeFileSync(filePath, css, 'utf8');
console.log('Successfully updated index.css');
