const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const TEST_USERS = [
  {
    role: 'ADMIN',
    name: 'System Administrator',
    email: 'admin@civora.gov',
    description: 'System Administrator with complete platform control'
  },
  {
    role: 'GOVERNMENT_OFFICIAL',
    name: 'Rajesh Kumar',
    email: 'rajesh.kumar@civora.gov',
    description: 'PWD Department Official / Field Officer'
  },
  {
    role: 'CONTRACTOR',
    name: 'Apex Infrastructure Ltd',
    email: 'sanjay.hegde@apexinfra.in',
    description: 'Verified Civic Works Contractor'
  },
  {
    role: 'CITIZEN',
    name: 'Ananya Sharma',
    email: 'ananya@citizen.in',
    description: 'Verified Resident Citizen'
  },
  {
    role: 'GUEST',
    name: 'Guest Visitor',
    email: null,
    description: 'Unauthenticated Public Visitor'
  }
];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  for (const tu of TEST_USERS) {
    console.log(`\n=== Testing Role: ${tu.role} ===`);
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 }); // iPhone 13

    // First go to localhost to establish origin
    await page.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded' });

    if (tu.role !== 'GUEST') {
      await page.evaluate((u) => {
        const userData = {
          id: 'user-' + u.role.toLowerCase(),
          name: u.name,
          email: u.email,
          role: u.role,
          accountStatus: 'ACTIVE',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z'
        };
        localStorage.setItem('civora_token', 'mock_jwt_token_for_' + u.role);
        localStorage.setItem('civora_user', JSON.stringify(userData));
      }, tu);
      await page.reload({ waitUntil: 'networkidle2' });
    } else {
      await page.evaluate(() => {
        localStorage.removeItem('civora_token');
        localStorage.removeItem('civora_user');
      });
      await page.reload({ waitUntil: 'networkidle2' });
    }

    // Wait a brief moment
    await new Promise(r => setTimeout(r, 600));

    // Check what Navbar renders
    const navbarInfo = await page.evaluate(() => {
      const u = localStorage.getItem('civora_user');
      const header = document.querySelector('header');
      return {
        storedUser: u ? JSON.parse(u) : null,
        headerExists: !!header,
        headerButtons: Array.from(header.querySelectorAll('button')).map(b => ({
          ariaLabel: b.getAttribute('aria-label'),
          text: b.innerText.trim(),
          offsetParent: !!b.offsetParent
        }))
      };
    });
    console.log('Navbar info:', navbarInfo);

    // Open hamburger
    const hamburger = await page.$('button[aria-label="Open Navigation Menu"]');
    if (!hamburger) {
      console.log('ERROR: Hamburger button NOT found for', tu.role);
      await page.close();
      continue;
    }

    await hamburger.click();
    await new Promise(r => setTimeout(r, 600));

    // Inspect drawer content
    const drawerInfo = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return { found: false };

      const links = Array.from(dialog.querySelectorAll('a')).map(a => ({
        text: a.innerText.replace(/\n+/g, ' ').trim(),
        href: a.getAttribute('href'),
        visible: a.offsetParent !== null,
        box: a.getBoundingClientRect()
      }));

      return {
        found: true,
        linksCount: links.length,
        links: links,
        dialogHTML: dialog.innerHTML.slice(0, 500)
      };
    });

    console.log(`Drawer for ${tu.role}:`, {
      found: drawerInfo.found,
      linksCount: drawerInfo.linksCount,
      links: drawerInfo.links
    });

    const screenshotPath = path.join(__dirname, '..', 'screenshots', `drawer_${tu.role.toLowerCase()}_390x844.png`);
    await page.screenshot({ path: screenshotPath });
    console.log(`Screenshot saved to ${screenshotPath}`);

    await page.close();
  }

  await browser.close();
})();
