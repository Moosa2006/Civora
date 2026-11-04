const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 375, height: 667 });
    console.log('Navigating to https://civora-tau.vercel.app/...');
    await page.goto('https://civora-tau.vercel.app/', { waitUntil: 'networkidle2', timeout: 30000 });

    const hamburger = await page.$('button[aria-label="Open Navigation Menu"]');
    console.log('Hamburger found:', !!hamburger);
    if (hamburger) {
      console.log('Clicking hamburger...');
      await hamburger.click();
      await new Promise(r => setTimeout(r, 1000));
      await page.screenshot({ path: path.join(__dirname, '..', 'deployed_mobile_open.png') });
      
      const details = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        const linksInDrawer = dialog ? Array.from(dialog.querySelectorAll('a')).map(a => ({
          text: a.innerText.trim(),
          href: a.getAttribute('href'),
          offsetParent: !!a.offsetParent,
          rect: a.getBoundingClientRect(),
        })) : [];

        return {
          drawerFound: !!dialog,
          drawerHTML: dialog ? dialog.outerHTML : null,
          linksInDrawer
        };
      });
      console.log('Drawer details:', JSON.stringify(details, null, 2));
    }
  } catch (err) {
    console.error('Error during inspection:', err);
  } finally {
    await browser.close();
  }
})();
