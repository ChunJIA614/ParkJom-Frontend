import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Users\\Chun Jia\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, acceptInsecureCerts: true });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

await page.setRequestInterception(true);
page.on('request', (req) => {
  const parsed = new URL(req.url());
  if (parsed.pathname.startsWith('/api/')) {
    // Return sample listings so we have table rows to hover over
    req.respond({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 200,
        success: true,
        data: [
          {
            verificationRequestId: 24,
            propertyName: 'M Vertica Residences',
            propertyId: 32,
            parkingSpotId: 24,
            parkingLabel: '67/3',
            submittedByUserId: 2,
            submittedByName: 'JUN KANG OOI',
            submittedByEmail: 'ooijk-wm23@student.tarc.edu.my',
            status: 'approved',
            verificationStatus: 'Approved',
            verificationStatusLabel: 'Approved',
            submittedAt: '2026-08-01T01:50:00Z',
            documents: [{ mediaFileId: 1 }]
          },
          {
            verificationRequestId: 23,
            propertyName: 'PV128',
            propertyId: 34,
            parkingSpotId: 23,
            parkingLabel: '188/Level 8',
            submittedByUserId: 3,
            submittedByName: 'CHUN JIA CHAW',
            submittedByEmail: 'chawcj-wm23@student.tarc.edu.my',
            status: 'approved',
            verificationStatus: 'Approved',
            verificationStatusLabel: 'Approved',
            submittedAt: '2026-08-01T00:41:00Z',
            documents: [{ mediaFileId: 2 }]
          }
        ]
      })
    }).catch(() => {});
    return;
  }
  req.continue().catch(() => {});
});

await page.evaluateOnNewDocument(() => {
  localStorage.setItem('parkjom-theme', 'dark');
  localStorage.setItem('parkjom_user', JSON.stringify({
    userId: 1,
    email: 'chunjia@parkjom.my',
    firstName: 'Chun Jia',
    lastName: 'Khoo',
    role: 'Admin',
    userType: 1,
    token: 'fake',
    isProfileComplete: true,
    accountStatus: 'Active'
  }));
});

await page.goto('https://localhost:3000/admin', { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 1000));

// Click "Listings"
await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('button'));
  const listingsBtn = buttons.find(b => b.textContent?.trim().includes('Listings'));
  if (listingsBtn) listingsBtn.click();
});
await new Promise(r => setTimeout(r, 1000));

// Hover over the first row in the table
const rowSelector = 'tbody tr';
await page.waitForSelector(rowSelector);
await page.hover(rowSelector);
await new Promise(r => setTimeout(r, 300));

const hoverStyles = await page.evaluate(() => {
  const tr = document.querySelector('tbody tr');
  if (!tr) return null;
  const cs = getComputedStyle(tr);
  const td = tr.querySelector('td');
  const tdCs = td ? getComputedStyle(td) : null;
  return {
    trBg: cs.backgroundColor,
    tdBg: tdCs ? tdCs.backgroundColor : null,
    trClasses: tr.className
  };
});

console.log('Hover styles currently:', hoverStyles);
await page.screenshot({ path: '.tmp-shots/row-hover-current.png' });
await browser.close();
