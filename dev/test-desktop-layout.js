const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const depsRoot = process.env.DROP_DESTINY_NATIVE_RENDERER_NODE_MODULES ||
  path.join(os.tmpdir(), 'drop-destiny-native-renderer', 'node_modules');
const puppeteer = require(path.join(depsRoot, 'puppeteer-core'));
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const root = path.resolve(__dirname, '..');
const url = process.env.DROP_DESTINY_TEST_URL || pathToFileURL(path.join(root, 'index.html')).href;
const exportDir = path.join(root, 'exports');

const VIEWPORTS = [
  { width: 1366, height: 768 },
  { width: 1440, height: 768 },
  { width: 1440, height: 900 },
  { width: 1600, height: 1000 }
];

async function inspect(page, expectedPhase) {
  await new Promise(resolve => setTimeout(resolve, 120));
  return page.evaluate(expected => {
    const active = document.querySelector('.phase-section.active');
    const selectors = [
      '#workbench', '.phase-section.active', '.phase-section.active .nav-buttons',
      '#intro.active #introCanvas',
      '#bassForge.active .synth-header', '#bassForge.active .wavetable-rack',
      '#bassForge.active .synth-console-body', '#bassForge.active .macro-hint',
      '#result.active #resultContent'
    ];
    const important = selectors.map(selector => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      if (style.display === 'none' || rect.width === 0 || rect.height === 0) return null;
      return { selector, top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
    }).filter(Boolean);
    return {
      expected,
      active: active && active.id,
      viewport: { width: innerWidth, height: innerHeight },
      documentHeight: document.documentElement.scrollHeight,
      bodyHeight: document.body.scrollHeight,
      scrollY,
      mainScrollTop: document.getElementById('main').scrollTop,
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      important
    };
  }, expectedPhase);
}

function assertSingleScreen(metrics) {
  const label = `${metrics.viewport.width}x${metrics.viewport.height} ${metrics.expected}`;
  if (metrics.active !== metrics.expected) throw new Error(`${label}: active phase is ${metrics.active}`);
  if (metrics.documentHeight > metrics.viewport.height + 1 || metrics.bodyHeight > metrics.viewport.height + 1) {
    throw new Error(`${label}: page scrolls (${metrics.documentHeight}/${metrics.bodyHeight}px)`);
  }
  if (Math.abs(metrics.scrollY) > 1 || Math.abs(metrics.mainScrollTop) > 1) {
    throw new Error(`${label}: hidden scroll position detected (${metrics.scrollY}/${metrics.mainScrollTop})`);
  }
  if (metrics.horizontalOverflow > 1) throw new Error(`${label}: horizontal overflow ${metrics.horizontalOverflow}px`);
  const clipped = metrics.important.filter(item =>
    item.top < -1 || item.bottom > metrics.viewport.height + 1 || item.left < -1 || item.right > metrics.viewport.width + 1
  );
  if (clipped.length) throw new Error(`${label}: clipped elements ${JSON.stringify(clipped)}`);
}

async function runViewport(browser, viewport) {
  const page = await browser.newPage();
  const errors = [];
  try {
    await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
    page.on('pageerror', error => errors.push(error.stack || error.message));
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

    const reports = [];
    reports.push(await inspect(page, 'intro'));
    await page.click('#startBtn');
    await page.click('#soundWorldOptions .option-card[data-choice="neonCity"]');
    reports.push(await inspect(page, 'soundWorld'));
    if (viewport.width === 1440 && viewport.height === 768) {
      await page.screenshot({ path: path.join(exportDir, 'layout-qa-1440x768-sound-world.png'), fullPage: false });
    }

    await page.click('#soundWorld [data-next]');
    await page.click('#bassPersonalityOptions .option-card[data-choice="wobbly"]');
    reports.push(await inspect(page, 'bassCore'));

    await page.click('#bassCore [data-next]');
    await page.click('#rhythmOptions .option-card[data-choice="halfTime"]');
    reports.push(await inspect(page, 'rhythm'));

    await page.click('#rhythm [data-next]');
    await page.focus('#synthDrive');
    await page.keyboard.press('ArrowUp');
    reports.push(await inspect(page, 'bassForge'));

    if (viewport.width === 1366) {
      await page.screenshot({ path: path.join(exportDir, 'layout-qa-1366-bass-forge.png'), fullPage: false });
    }

    await page.click('#bassForge [data-next]');
    reports.push(await inspect(page, 'result'));

    if (viewport.width === 1366) {
      await page.screenshot({ path: path.join(exportDir, 'layout-qa-1366-result.png'), fullPage: false });
    }

    reports.forEach(assertSingleScreen);
    if (errors.length) throw new Error(errors.join('\n'));
    return reports;
  } finally {
    await page.close();
  }
}

async function main() {
  fs.mkdirSync(exportDir, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--no-first-run']
  });
  try {
    const reports = [];
    for (const viewport of VIEWPORTS) reports.push(...await runViewport(browser, viewport));
    console.log('DESKTOP_LAYOUT_OK');
    console.log(JSON.stringify(reports.map(report => ({
      viewport: report.viewport,
      phase: report.active,
      documentHeight: report.documentHeight,
      mainScrollTop: report.mainScrollTop
    })), null, 2));
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
