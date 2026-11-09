import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Users\\Chun Jia\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, acceptInsecureCerts: true });

async function testRole(role, userType, path) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const parsed = new URL(req.url());
    if (parsed.pathname.startsWith('/api/')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 200, success: true, message: 'ok', data: [] })
      }).catch(() => {});
      return;
    }
    req.continue().catch(() => {});
  });

  await page.evaluateOnNewDocument((role, userType) => {
    localStorage.setItem('parkjom-theme', 'dark');
    localStorage.setItem('parkjom_user', JSON.stringify({
      userId: 2,
      email: `${role.toLowerCase()}@parkjom.my`,
      firstName: role,
      lastName: 'User',
      role,
      userType,
      token: 'fake',
      isProfileComplete: true,
      accountStatus: 'Active'
    }));
  }, role, userType);

  await page.goto(`https://localhost:3000${path}`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));

  const styles = await page.evaluate(() => {
    const ws = document.querySelector('.app-workspace');
    const header = document.querySelector('.workspace-header');
    return {
      url: window.location.pathname,
      workspaceBg: ws ? getComputedStyle(ws).backgroundColor : null,
      workspaceColor: ws ? getComputedStyle(ws).color : null,
      headerBg: header ? getComputedStyle(header).backgroundColor : null
    };
  });

  console.log(`${role} (${path}):`, JSON.stringify(styles));
  await page.screenshot({ path: `.tmp-shots/${role.toLowerCase()}-dark.png` });
  await page.close();
}

await testRole('Owner', 2, '/owner');
await testRole('Commuter', 3, '/commuter');

await browser.close();
