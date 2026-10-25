import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME = 'C:\\Users\\Chun Jia\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\Chun Jia\\.gemini\\antigravity\\brain\\d1a7e1ac-8ab6-4201-8da1-453438b458e8';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    acceptInsecureCerts: true,
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 }
  });

  const setupApiMocks = async (page) => {
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      const parsed = new URL(url);

      if (parsed.pathname.startsWith('/api/')) {
        // User support context
        if (parsed.pathname.includes('/support/user-context') || parsed.pathname.includes('/support/context')) {
          req.respond({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              code: 200,
              success: true,
              data: {
                activeBookingId: 'BK-2026-9921',
                activeSession: {
                  bookingId: 'BK-2026-9921',
                  status: 'CONFIRMED',
                  parkingLabel: 'Bay A-12',
                  propertyName: 'KL Gateway Tower 1',
                  stationName: 'Universiti LRT',
                  startTime: new Date(Date.now() - 3600000).toISOString(),
                  endTime: new Date(Date.now() + 7200000).toISOString()
                },
                recentBookings: [],
                openDisputeCount: 1,
                lastKnownLocation: {
                  latitude: 3.1189,
                  longitude: 101.6669
                }
              }
            })
          }).catch(() => {});
          return;
        }

        // Admin dashboard metrics
        if (parsed.pathname.includes('/admin/support/dashboard')) {
          req.respond({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              code: 200,
              success: true,
              data: {
                openTicketsCount: 16,
                actionRequiredTicketsCount: 3,
                activeIncidentsCount: 2,
                openDisputesCount: 4,
                slaRiskTicketsCount: 1,
                recentTickets: [
                  {
                    ticketId: 1,
                    ticketReference: 'TKT-2026-49198',
                    subject: 'Gate not opening at exit',
                    status: 'InProgress',
                    priority: 'P0',
                    customerName: 'Commuter Driver',
                    customerEmail: 'driver@parkjom.my',
                    category: 'GATE_STUCK'
                  },
                  {
                    ticketId: 2,
                    ticketReference: 'TKT-2026-21266',
                    subject: 'Overcharged for parking session',
                    status: 'Resolved',
                    priority: 'P2',
                    customerName: 'Sarah Tan',
                    category: 'REFUND_REQUEST'
                  }
                ],
                recentIncidents: [
                  {
                    incidentId: 101,
                    incidentReference: 'INC-2026-8801',
                    title: 'Exit Boom Barrier Hardware Failure',
                    status: 'Active',
                    priority: 'P0',
                    assignedTeam: 'ParkingOperations',
                    affectedCustomerCount: 5
                  }
                ]
              }
            })
          }).catch(() => {});
          return;
        }

        // List tickets (both user and admin endpoints)
        if (parsed.pathname.includes('/support/tickets')) {
          if (parsed.pathname.match(/\/support\/tickets\/[0-9TKT]+/)) {
            // Ticket detail
            req.respond({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                code: 200,
                success: true,
                data: {
                  ticketId: 1,
                  ticketReference: 'TKT-2026-49198',
                  subject: 'Gate not opening at exit',
                  status: 'InProgress',
                  priority: 'P0',
                  customerName: 'Commuter Driver',
                  customerEmail: 'driver@parkjom.my',
                  category: 'GATE_STUCK',
                  department: 'ParkingOperations',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  messages: [
                    {
                      messageId: 1,
                      senderId: 2,
                      senderName: 'Commuter Driver',
                      senderRole: 'Customer',
                      body: 'I am stuck at the exit gate, the barrier did not lift automatically when my plate was scanned.',
                      createdAt: new Date(Date.now() - 600000).toISOString()
                    },
                    {
                      messageId: 2,
                      senderId: 1,
                      senderName: 'Operations Lead',
                      senderRole: 'Agent',
                      body: 'Looking into this now. Remote barrier override is being dispatched.',
                      createdAt: new Date(Date.now() - 300000).toISOString()
                    }
                  ],
                  linkedDispute: {
                    disputeId: 44,
                    disputeReference: 'DSP-2026-0044',
                    disputeStatus: 'UnderReview',
                    claimedAmount: 12.00,
                    approvedAmount: 12.00,
                    currency: 'MYR'
                  }
                }
              })
            }).catch(() => {});
            return;
          }

          // List tickets
          req.respond({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              code: 200,
              success: true,
              data: [
                {
                  ticketId: 1,
                  ticketReference: 'TKT-2026-49198',
                  subject: 'Gate not opening at exit',
                  status: 'InProgress',
                  priority: 'P0',
                  customerName: 'Commuter Driver',
                  customerEmail: 'driver@parkjom.my',
                  category: 'GATE_STUCK',
                  department: 'ParkingOperations',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                },
                {
                  ticketId: 2,
                  ticketReference: 'TKT-2026-21266',
                  subject: 'Overcharged for parking session',
                  status: 'Resolved',
                  priority: 'P2',
                  customerName: 'Sarah Tan',
                  category: 'REFUND_REQUEST',
                  department: 'Payments',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                },
                {
                  ticketId: 3,
                  ticketReference: 'TKT-2026-78508',
                  subject: 'App disconnected during session',
                  status: 'Closed',
                  priority: 'P3',
                  customerName: 'Ahmad Razak',
                  category: 'OTHER',
                  department: 'CustomerSupport',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                }
              ]
            })
          }).catch(() => {});
          return;
        }

        // Default 200 for other APIs
        req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ code: 200, success: true, message: 'ok', data: [] })
        }).catch(() => {});
        return;
      }
      req.continue().catch(() => {});
    });
  };

  // ─────────────────────────────────────────────────────────────
  // 1. Commuter Dashboard: Stepper, Map Popup, and Support Page
  // ─────────────────────────────────────────────────────────────
  const page1 = await browser.newPage();
  await setupApiMocks(page1);
  await page1.evaluateOnNewDocument(() => {
    localStorage.setItem('parkjom-theme', 'dark');
    localStorage.setItem('parkjom_user', JSON.stringify({
      userId: 2,
      email: 'driver@parkjom.my',
      firstName: 'Commuter',
      lastName: 'Driver',
      role: 'Commuter',
      userType: 3,
      token: 'fake-token-commuter',
      isProfileComplete: true,
      accountStatus: 'Active'
    }));

    // Pre-seed active journey session so JourneyStrip renders
    localStorage.setItem('parkjom_journey_2', JSON.stringify({
      userId: 2,
      booking: {
        id: 'BK-2026-9921',
        spotId: 501,
        propertyName: 'KL Gateway Tower 1',
        parkingLabel: 'Bay A-12',
        stationName: 'Universiti LRT',
        address: 'Jalan Kerinchi, Bangsar South, 59200 Kuala Lumpur',
        startTime: new Date(Date.now() - 3600000).toISOString(),
        endTime: new Date(Date.now() + 7200000).toISOString(),
        totalAmount: 12.00,
        vehiclePlate: 'VEE 8821'
      },
      stage: 'reserved'
    }));
  });

  console.log('Navigating to Commuter Dashboard...');
  await page1.goto('https://localhost:3000/commuter', { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(1500);

  // Click "My Pass" to view Active Session and JourneyStrip Stepper
  console.log('Clicking My Pass in sidebar...');
  await page1.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, a'));
    const passBtn = buttons.find(b => b.textContent?.trim().includes('My Pass'));
    if (passBtn) passBtn.click();
  });
  await sleep(1500);

  await page1.screenshot({ path: path.join(ARTIFACT_DIR, 'audit-commuter-active-session-dark.png') });
  console.log('✓ audit-commuter-active-session-dark.png');

  // Click Support on the left sidebar
  console.log('Clicking Support in commuter sidebar...');
  await page1.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, a'));
    const supportBtn = buttons.find(b => b.textContent?.trim() === 'Support');
    if (supportBtn) supportBtn.click();
  });
  await sleep(1500);

  await page1.screenshot({ path: path.join(ARTIFACT_DIR, 'audit-commuter-support-screen-dark.png') });
  console.log('✓ audit-commuter-support-screen-dark.png');
  await page1.close();

  // ─────────────────────────────────────────────────────────────
  // 2. Admin Command Center & Support Tickets Split-View
  // ─────────────────────────────────────────────────────────────
  const page2 = await browser.newPage();
  await setupApiMocks(page2);
  await page2.evaluateOnNewDocument(() => {
    localStorage.setItem('parkjom-theme', 'dark');
    localStorage.setItem('parkjom_user', JSON.stringify({
      userId: 1,
      email: 'admin@parkjom.my',
      firstName: 'System',
      lastName: 'Admin',
      role: 'Admin',
      userType: 1,
      token: 'fake-token-admin',
      isProfileComplete: true,
      accountStatus: 'Active'
    }));
  });

  console.log('Navigating to Admin Dashboard...');
  await page2.goto('https://localhost:3000/admin', { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(1500);

  console.log('Clicking Disputes & Tickets in admin sidebar...');
  await page2.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, a'));
    const ticketsBtn = buttons.find(b => b.textContent?.trim().includes('Disputes & Tickets'));
    if (ticketsBtn) ticketsBtn.click();
  });
  await sleep(2000);

  // Capture Command Center view
  await page2.screenshot({ path: path.join(ARTIFACT_DIR, 'audit-admin-command-center-dark.png') });
  console.log('✓ audit-admin-command-center-dark.png');

  // Click "Support Tickets" tab in the persistent segmented navigation bar
  console.log('Clicking Support Tickets tab in segmented bar...');
  await page2.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const ticketsTab = buttons.find(b => b.textContent?.trim().includes('Support Tickets'));
    if (ticketsTab) ticketsTab.click();
  });
  await sleep(2500);

  // Capture Support Tickets Split-View
  await page2.screenshot({ path: path.join(ARTIFACT_DIR, 'audit-admin-support-splitview-dark.png') });
  console.log('✓ audit-admin-support-splitview-dark.png');
  await page2.close();

  await browser.close();
  console.log('Finished capturing all audit screens successfully!');
}

run().catch(console.error);
