import fs from 'node:fs';

const filePath = 'src/app/styles/index.css';
let css = fs.readFileSync(filePath, 'utf8');

css = css.replace(
  `.google-signin-shell iframe {
  max-width: 100% !important;
}`,
  ''
);

css = css.replace(
  `.google-signin-shell iframe {\r\n  max-width: 100% !important;\r\n}`,
  ''
);

fs.writeFileSync(filePath, css, 'utf8');
console.log('Removed iframe max-width rule from index.css');
