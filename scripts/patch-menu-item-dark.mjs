import fs from 'node:fs';

const filePath = 'src/app/styles/index.css';
let css = fs.readFileSync(filePath, 'utf8');

const target = `.workspace-header__account-menu-item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.65rem;
  border-radius: 0.65rem;
  color: #3a3a3c;
  text-align: left;
}`;

const replacement = `.workspace-header__account-menu-item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.65rem;
  border-radius: 0.65rem;
  color: #3a3a3c;
  text-align: left;
}

.dark .workspace-header__account-menu-item {
  color: #f5f5f7;
}

.dark .workspace-header__account-menu-item:hover,
.dark .workspace-header__account-menu-item:focus-visible {
  background: rgba(255, 255, 255, 0.08);
}`;

css = css.replace(target.replace(/\r?\n/g, '\r\n'), replacement.replace(/\r?\n/g, '\r\n'));
css = css.replace(target.replace(/\r?\n/g, '\n'), replacement.replace(/\r?\n/g, '\n'));

fs.writeFileSync(filePath, css, 'utf8');
console.log('Added dark account-menu-item styles to index.css');
