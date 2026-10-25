import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Users\\Chun Jia\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  acceptInsecureCerts: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb'],
});

const mobilePage = await browser.newPage();
await mobilePage.setViewport({ width: 375, height: 812, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await mobilePage.goto('https://localhost:3000/', { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 2000));

const btnMobile = await mobilePage.$('.google-signin-shell');
if (btnMobile) {
  await btnMobile.screenshot({ path: '.tmp-shots/google-button-mobile-test.png' });
  console.log('Saved .tmp-shots/google-button-mobile-test.png');
}

await browser.close();
