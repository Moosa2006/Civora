const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 }); // iPhone 13
    console.log('Visiting live deployed site: https://civora-tau.vercel.app/...');
    await page.goto('https://civora-tau.vercel.app/', { waitUntil: 'networkidle2', timeout: 30000 });

    // Open hamburger button
    const hamburger = await page.$('button[aria-label="Open Navigation Menu"]');
    if (!hamburger) {
      console.error('ERROR: No hamburger found on live site!');
      return;
    }

    console.log('Clicking hamburger on live site...');
    await hamburger.click();
    await new Promise(r => setTimeout(r, 800));

    // Capture screenshot
    const screenshotPath = path.join(__dirname, '..', 'screenshots', 'live_deployed_drawer_390x844.png');
    await page.screenshot({ path: screenshotPath });
    console.log('Saved live screenshot to:', screenshotPath);

    // Analyze live drawer DOM
    const liveAnalysis = await page.evaluate(() => {
      const toObj = (r) => r ? ({ x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom) }) : null;
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return { found: false };

      const links = Array.from(dialog.querySelectorAll('a')).map(a => ({
        text: a.innerText.replace(/\s+/g, ' ').trim(),
        href: a.getAttribute('href'),
        visible: a.offsetParent !== null,
        rect: toObj(a.getBoundingClientRect())
      }));

      const topBar = dialog.children[0];
      const content = dialog.children[1];
      const bottomBar = dialog.children[2];

      return {
        found: true,
        dialogRect: toObj(dialog.getBoundingClientRect()),
        topBarRect: toObj(topBar ? topBar.getBoundingClientRect() : null),
        contentRect: toObj(content ? content.getBoundingClientRect() : null),
        bottomBarRect: toObj(bottomBar ? bottomBar.getBoundingClientRect() : null),
        linksCount: links.length,
        links: links
      };
    });

    console.log('LIVE DEPLOYED DRAWER ANALYSIS:\n', JSON.stringify(liveAnalysis, null, 2));

    // Also copy to brain artifact dir
    const brainDir = 'C:\\Users\\Asus\\.gemini\\antigravity\\brain\\326a91fe-d2fb-477c-94ed-b01e2cbc8313';
    fs.copyFileSync(screenshotPath, path.join(brainDir, 'live_deployed_drawer_390x844.png'));
    console.log('Copied live screenshot to brain artifact directory');

  } catch (err) {
    console.error('Live verification error:', err);
  } finally {
    await browser.close();
  }
})();

