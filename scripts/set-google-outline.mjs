import fs from 'node:fs';

const path = 'src/features/auth/components/GoogleLoginButton.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  "theme={isDark ? 'filled_black' : 'outline'}",
  "theme=\"outline\""
);

fs.writeFileSync(path, content, 'utf8');
console.log('Set GoogleLogin theme to outline');
