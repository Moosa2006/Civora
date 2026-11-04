const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 667 });
  await page.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded' });

  // Set Admin user
  await page.evaluate(() => {
    localStorage.setItem('civora_token', 'mock_token');
    localStorage.setItem('civora_user', JSON.stringify({
      id: 'admin-1',
      name: 'System Administrator',
      email: 'admin@civora.gov',
      role: 'ADMIN',
      accountStatus: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    }));
  });
  await page.reload({ waitUntil: 'networkidle2' });

  // Open drawer
  const hamburger = await page.$('button[aria-label="Open Navigation Menu"]');
  await hamburger.click();
  await new Promise(r => setTimeout(r, 500));

  const layout = await page.evaluate(() => {
    const toObj = (r) => r ? ({ x: r.x, y: r.y, width: r.width, height: r.height, top: r.top, bottom: r.bottom }) : null;
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return 'No dialog';
    const topBar = dialog.children[0];
    const content = dialog.children[1];
    const bottomBar = dialog.children[2];

    const nav = content ? content.querySelector('nav') : null;
    const navLinks = nav ? Array.from(nav.querySelectorAll('a')).map(a => ({
      text: a.innerText,
      rect: toObj(a.getBoundingClientRect()),
      computedColor: window.getComputedStyle(a).color,
      computedBg: window.getComputedStyle(a).backgroundColor,
      computedDisplay: window.getComputedStyle(a).display
    })) : [];

    return {
      windowHeight: window.innerHeight,
      dialogRect: toObj(dialog.getBoundingClientRect()),
      topBarRect: toObj(topBar.getBoundingClientRect()),
      contentRect: toObj(content.getBoundingClientRect()),
      bottomBarRect: toObj(bottomBar.getBoundingClientRect()),
      navRect: toObj(nav.getBoundingClientRect()),
      navLinks
    };
  });

  console.log('Layout Analysis:', JSON.stringify(layout, null, 2));
  await browser.close();
})();
