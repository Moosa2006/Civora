const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.resolve(__dirname, '..', 'screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const VIEWPORTS = [
  { width: 320, height: 600, name: '320_mobile_narrow' },
  { width: 375, height: 667, name: '375_iphone_se' },
  { width: 390, height: 844, name: '390_iphone_13' },
  { width: 430, height: 932, name: '430_iphone_promax' },
  { width: 768, height: 1024, name: '768_tablet_portrait' },
  { width: 820, height: 1180, name: '820_ipad_air' },
  { width: 1024, height: 768, name: '1024_desktop_standard' },
  { width: 1280, height: 800, name: '1280_macbook_standard' },
  { width: 1366, height: 768, name: '1366_hd_laptop' },
  { width: 1440, height: 900, name: '1440_desktop_large' },
  { width: 1512, height: 982, name: '1512_macbook_pro_14' },
  { width: 1728, height: 1117, name: '1728_macbook_pro_16' },
  { width: 1920, height: 1080, name: '1920_full_hd' },
];

async function runTests() {
  console.log('Starting Navbar Responsive Validation with Admin Session...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // Set mock admin user in localStorage before loading
  await page.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const adminUser = {
      id: 'admin-001',
      name: 'System Administrator',
      email: 'admin@civora.gov',
      role: 'ADMIN',
      accountStatus: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    localStorage.setItem('civora_user', JSON.stringify(adminUser));
    localStorage.setItem('civora_token', 'mock_admin_jwt_token');
    document.documentElement.classList.add('dark');
    document.documentElement.setAttribute('data-theme', 'dark');
  });

  // Reload to apply mock session & dark mode
  await page.reload({ waitUntil: 'networkidle0' });

  const results = [];

  for (const vp of VIEWPORTS) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await new Promise((r) => setTimeout(r, 200));

    // Measure bounding boxes and layout invariants
    const metrics = await page.evaluate(() => {
      const scrollWidth = document.documentElement.scrollWidth;
      const innerWidth = window.innerWidth;
      const hasHorizontalScroll = scrollWidth > innerWidth + 1; // 1px rounding tolerance

      const logo = document.querySelector('header img[alt="Civora"]');
      const logoBox = logo ? logo.getBoundingClientRect() : null;

      const navContainer = document.querySelector('header nav');
      const navDisplay = navContainer ? window.getComputedStyle(navContainer).display : 'none';
      const isNavVisible = navDisplay !== 'none';

      // Primary links in center section (excluding dropdown menu contents)
      let navBoxes = [];
      if (isNavVisible && navContainer) {
        const navLinks = Array.from(navContainer.children[0]?.children || []).filter((el) => {
          if (el.tagName !== 'A') return false;
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden' && el.getBoundingClientRect().width > 0;
        });

        navBoxes = navLinks.map((el) => {
          const b = el.getBoundingClientRect();
          return { text: el.textContent?.trim(), left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width, height: b.height };
        });
      }

      // Check overlap between logo and first visible nav link
      let logoOverlapsNav = false;
      let overlapGap = null;
      if (logoBox && navBoxes.length > 0) {
        const firstNav = navBoxes[0];
        overlapGap = Math.round(firstNav.left - logoBox.right);
        if (logoBox.right > firstNav.left) {
          logoOverlapsNav = true;
        }
      }

      // Check overlap among nav links
      let navLinkCollisions = [];
      for (let i = 0; i < navBoxes.length - 1; i++) {
        if (navBoxes[i].right > navBoxes[i + 1].left + 1) {
          navLinkCollisions.push(`${navBoxes[i].text} overlaps ${navBoxes[i + 1].text}`);
        }
      }

      // Check right section utility controls bounding boxes
      const rightControls = Array.from(document.querySelectorAll('header > div > div > div:last-child > *')).filter((el) => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && el.getBoundingClientRect().width > 0;
      });

      const rightBoxes = rightControls.map((el) => {
        const b = el.getBoundingClientRect();
        return { tag: el.tagName, left: b.left, right: b.right, width: b.width };
      });

      let utilityCollisions = [];
      for (let i = 0; i < rightBoxes.length - 1; i++) {
        if (rightBoxes[i].right > rightBoxes[i + 1].left + 1) {
          utilityCollisions.push(`Control ${i} overlaps Control ${i + 1}`);
        }
      }

      const hamburger = document.querySelector('header button[aria-label*="menu" i], header button[aria-label*="Menu"]');
      const hamburgerVisible = hamburger ? window.getComputedStyle(hamburger).display !== 'none' : false;

      return {
        innerWidth,
        scrollWidth,
        hasHorizontalScroll,
        logoBox: logoBox ? { left: logoBox.left, right: logoBox.right, width: logoBox.width, height: logoBox.height } : null,
        navCount: navBoxes.length,
        navLinks: navBoxes.map((n) => n.text),
        logoOverlapsNav,
        overlapGap,
        navLinkCollisions,
        utilityCollisions,
        hamburgerVisible,
      };
    });

    const screenshotFile = path.join(SCREENSHOT_DIR, `navbar_${vp.width}x${vp.height}_${vp.name}.png`);
    await page.screenshot({ path: screenshotFile, fullPage: false });

    results.push({
      viewport: `${vp.width}x${vp.height} (${vp.name})`,
      horizontalScroll: metrics.hasHorizontalScroll ? 'FAILED (overflow)' : 'PASSED (0 overflow)',
      logoOverlap: metrics.navCount === 0 ? 'N/A (mobile drawer mode)' : (metrics.logoOverlapsNav ? 'FAILED (overlaps!)' : `PASSED (gap: +${metrics.overlapGap}px)`),
      navCollisions: metrics.navLinkCollisions.length === 0 ? 'PASSED (0 collisions)' : `FAILED: ${metrics.navLinkCollisions.join(', ')}`,
      utilityCollisions: metrics.utilityCollisions.length === 0 ? 'PASSED (0 collisions)' : `FAILED: ${metrics.utilityCollisions.join(', ')}`,
      navItemsVisible: metrics.navCount,
      hamburgerVisible: metrics.hamburgerVisible,
      screenshot: path.basename(screenshotFile),
    });
  }

  // Test Mobile Drawer Interaction (at 390px)
  await page.setViewport({ width: 390, height: 844 });
  await page.evaluate(() => {
    const btn = document.querySelector('header button[aria-label*="menu" i], header button[aria-label*="Menu"]');
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 250));

  const drawerState = await page.evaluate(() => {
    const drawer = document.querySelector('[role="dialog"][aria-label="Civora Mobile Navigation"]');
    const drawerLinks = Array.from(document.querySelectorAll('[role="dialog"] nav a')).map((a) => a.textContent?.trim());
    const userRoleBadge = document.querySelector('[role="dialog"] span.uppercase')?.textContent?.trim();
    const signOutBtn = Array.from(document.querySelectorAll('[role="dialog"] button')).find((b) => b.textContent?.includes('Sign Out'));
    return {
      isOpen: !!drawer,
      linkCount: drawerLinks.length,
      links: drawerLinks,
      userRoleBadge,
      hasSignOut: !!signOutBtn,
    };
  });

  const drawerScreenshot = path.join(SCREENSHOT_DIR, 'navbar_drawer_390x844.png');
  await page.screenshot({ path: drawerScreenshot });

  // Test Escape key closes drawer
  await page.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 250));
  const drawerClosedOnEsc = await page.evaluate(() => {
    return !document.querySelector('[role="dialog"][aria-label="Civora Mobile Navigation"]');
  });

  // Test Desktop Dropdown at 1024px
  await page.setViewport({ width: 1024, height: 768 });
  await page.evaluate(() => {
    const dropdownBtn = document.querySelector('header nav [aria-haspopup="true"]');
    if (dropdownBtn) dropdownBtn.click();
  });
  await new Promise((r) => setTimeout(r, 250));

  const dropdownState = await page.evaluate(() => {
    const menu = document.querySelector('header nav [role="menu"]');
    const menuItems = Array.from(document.querySelectorAll('header nav [role="menu"] a')).map((a) => a.textContent?.trim());
    return {
      isOpen: !!menu,
      items: menuItems,
    };
  });

  const dropdownScreenshot = path.join(SCREENSHOT_DIR, 'navbar_dropdown_1024x768.png');
  await page.screenshot({ path: dropdownScreenshot });

  await browser.close();

  console.log('\n================== VALIDATION REPORT ==================');
  console.table(results);
  console.log('\nDrawer Test:');
  console.log('  Drawer Opened:', drawerState.isOpen);
  console.log('  Admin Role Badge in Drawer:', drawerState.userRoleBadge);
  console.log('  Drawer Links count:', drawerState.linkCount, drawerState.links);
  console.log('  Has Sign Out Button:', drawerState.hasSignOut);
  console.log('  Drawer Closed on Escape:', drawerClosedOnEsc);
  console.log('\n1024px Dropdown Test:');
  console.log('  Dropdown Opened:', dropdownState.isOpen);
  console.log('  Dropdown Items in Menu:', dropdownState.items);
  console.log('=======================================================\n');
}

runTests().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
