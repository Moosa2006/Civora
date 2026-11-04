const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const ROLES = [
  { role: 'ADMIN', name: 'System Administrator', email: 'admin@civora.gov' },
  { role: 'GOVERNMENT_OFFICIAL', name: 'Official Officer', email: 'official@civora.gov' },
  { role: 'CONTRACTOR', name: 'Apex Builders', email: 'contractor@civora.gov' },
  { role: 'CITIZEN', name: 'Jane Citizen', email: 'citizen@civora.gov' },
  { role: 'GUEST', name: 'Unauthenticated Guest', email: null }
];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  for (const roleTest of ROLES) {
    console.log(`\n--- Testing Role: ${roleTest.role} ---`);
    const page = await browser.newPage();
    await page.setViewport({ width: 375, height: 667 });
    
    // Visit site
    await page.goto('https://civora-tau.vercel.app/', { waitUntil: 'domcontentloaded' });

    // Set localStorage if authenticated
    if (roleTest.role !== 'GUEST') {
      await page.evaluate((u) => {
        localStorage.setItem('civora_token', 'test_mock_token');
        localStorage.setItem('civora_user', JSON.stringify({
          id: 'mock-id-1',
          name: u.name,
          email: u.email,
          role: u.role,
          accountStatus: 'ACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));
      }, roleTest);
      // Reload to let AuthProvider pick up the cached user
      await page.reload({ waitUntil: 'networkidle2' });
    } else {
      await page.evaluate(() => {
        localStorage.clear();
      });
      await page.reload({ waitUntil: 'networkidle2' });
    }

    // Wait a brief moment
    await new Promise(r => setTimeout(r, 500));

    // Check auth state in frontend
    const authState = await page.evaluate(() => {
      const u = localStorage.getItem('civora_user');
      return {
        storedUser: u ? JSON.parse(u) : null,
        token: localStorage.getItem('civora_token'),
      };
    });
    console.log('Stored authState in page:', authState);

    // Find hamburger button
    const hamburger = await page.$('button[aria-label="Open Navigation Menu"]');
    if (!hamburger) {
      console.log('ERROR: No hamburger button found for role', roleTest.role);
      continue;
    }

    await hamburger.click();
    await new Promise(r => setTimeout(r, 500));

    const drawerData = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return { found: false };
      const links = Array.from(dialog.querySelectorAll('a')).map(a => ({
        text: a.innerText.replace(/\n+/g, ' ').trim(),
        href: a.getAttribute('href')
      }));
      return {
        found: true,
        linksCount: links.length,
        links: links,
        textSnippet: dialog.innerText.slice(0, 300)
      };
    });

    console.log('Drawer result for', roleTest.role, ':', drawerData);
    await page.close();
  }

  await browser.close();
})();

