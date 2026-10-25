import fs from 'node:fs';

const filePath = 'src/app/styles/index.css';
let css = fs.readFileSync(filePath, 'utf8');

const oldBlock = `.google-signin-shell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 320px;
  min-height: 44px;
}

.google-signin-shell iframe {
  max-width: 100% !important;
  border-radius: 9999px !important;
}`;

const newBlock = `.google-signin-shell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 44px;
}

.google-signin-shell iframe {
  max-width: 100% !important;
}`;

css = css.replace(oldBlock.replace(/\r?\n/g, '\r\n'), newBlock.replace(/\r?\n/g, '\r\n'));
css = css.replace(oldBlock.replace(/\r?\n/g, '\n'), newBlock.replace(/\r?\n/g, '\n'));

fs.writeFileSync(filePath, css, 'utf8');
console.log('Updated .google-signin-shell in index.css');
