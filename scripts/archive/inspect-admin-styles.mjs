import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Users\\Chun Jia\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe';
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  acceptInsecureCerts: true,
  args: ['--no-sandbox']
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

await page.setRequestInterception(true);
page.on('request', (req) => {
  const url = req.url();
  if (url.includes('/api/')) {
    req.respond({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 200, success: true, message: 'ok', data: [] })
    }).catch(() => {});
    return;
  }
  req.continue().catch(() => {});
});

await page.goto('https://localhost:3000', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.setItem('parkjom-theme', 'dark');
  localStorage.setItem('parkjom_user', JSON.stringify({
    userId: 1,
    email: 'admin@parkjom.my',
    firstName: 'Chun Jia',
    lastName: 'Admin',
    role: 'Admin',
    userType: 2,
    token: 'fake-admin-token',
    isProfileComplete: true,
    accountStatus: 'Active'
  }));
});

await page.goto('https://localhost:3000/admin', { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 2000));

console.log('Current URL:', page.url());

const styles = await page.evaluate(() => {
  const htmlClass = document.documentElement.className;
  const workspace = document.querySelector('.app-workspace');
  const workspaceBg = workspace ? getComputedStyle(workspace).backgroundColor : null;
  const workspaceColor = workspace ? getComputedStyle(workspace).color : null;
  const header = document.querySelector('.workspace-header');
  const headerBg = header ? getComputedStyle(header).backgroundColor : null;
  const sidebar = document.querySelector('[data-slot="sidebar-inner"]') || document.querySelector('[data-slot="sidebar"]');
  const sidebarBg = sidebar ? getComputedStyle(sidebar).backgroundColor : null;
  const cards = Array.from(document.querySelectorAll('.bg-white')).map(el => ({
    tag: el.tagName,
    classes: el.className.slice(0, 50),
    bg: getComputedStyle(el).backgroundColor,
    color: getComputedStyle(el).color
  }));

  return {
    htmlClass,
    workspaceFound: !!workspace,
    workspaceBg,
    workspaceColor,
    headerBg,
    sidebarBg,
    cardCount: cards.length,
    cardSamples: cards.slice(0, 3)
  };
});

console.log(JSON.stringify(styles, null, 2));
await page.screenshot({ path: '.tmp-shots/admin-inspected.png' });
await browser.close();
