import fs from 'node:fs';

const filePath = 'src/app/styles/index.css';
let css = fs.readFileSync(filePath, 'utf8');

if (!css.includes('.theme-switch {')) {
  const newCss = `

/* Theme Switch Segmented Control */
.theme-switch {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.25rem;
  padding: 0.25rem;
  border-radius: 0.75rem;
  background-color: #f1f3f4;
  border: 1px solid rgba(0, 0, 0, 0.04);
}

.dark .theme-switch {
  background-color: #2c2c2e;
  border-color: rgba(255, 255, 255, 0.06);
}

.theme-switch__option {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.35rem 0.5rem;
  font-size: 0.6875rem;
  font-weight: 500;
  border-radius: 0.5rem;
  color: #6e6e73;
  transition: all 0.15s ease;
  cursor: pointer;
}

.dark .theme-switch__option {
  color: #a1a1a6;
}

.theme-switch__option.is-active {
  background-color: #ffffff;
  color: #1d1d1f;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
}

.dark .theme-switch__option.is-active {
  background-color: #3a3a3c;
  color: #f5f5f7;
}

.dark .workspace-header__account-menu {
  background: #1c1c1e;
  border-color: rgba(255, 255, 255, 0.12);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
}
`;

  css += newCss;
  fs.writeFileSync(filePath, css, 'utf8');
  console.log('Appended theme-switch and dark account-menu styles to index.css');
}
