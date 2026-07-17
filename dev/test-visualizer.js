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

async function main() {
  fs.mkdirSync(exportDir, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--no-first-run'
    ]
  });

  const errors = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 });
    page.on('pageerror', error => errors.push(error.stack || error.message));
    page.on('console', message => {
      if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(message.text());
    });
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.click('#startBtn');
    await page.waitForSelector('#workbench', { visible: true });
    await page.click('#soundWorldOptions .option-card[data-choice="neonCity"]');
    await new Promise(resolve => setTimeout(resolve, 1200));

    const creation = await page.evaluate(() => {
      const stage = document.getElementById('workbench').getBoundingClientRect();
      const main = document.getElementById('main').getBoundingClientRect();
      const canvas = document.getElementById('wbCanvas');
      const metrics = Visualizer.getMetrics();
      return {
        appActive: document.getElementById('app').classList.contains('visual-active'),
        stage: { width: stage.width, height: stage.height, left: stage.left, right: stage.right },
        main: { width: main.width, left: main.left, right: main.right },
        canvas: { width: canvas.width, height: canvas.height },
        metrics,
        bodyOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });
    await page.screenshot({ path: path.join(exportDir, 'visualizer-qa-creation.png'), fullPage: false });

    await page.click('#soundWorld .btn-next');
    await page.waitForSelector('#bassForge.active');
    await page.click('#bassPersonalityOptions .option-card[data-choice="wobbly"]');
    await new Promise(resolve => setTimeout(resolve, 500));
    const bassForge = await page.evaluate(() => {
      const main = document.getElementById('main');
      const macro = document.getElementById('macroPanel').getBoundingClientRect();
      return {
        macroVisible: macro.height > 0,
        mainOverflow: main.scrollWidth - main.clientWidth,
        knobCount: document.querySelectorAll('.synth-knob').length,
        sceneLabel: document.getElementById('visualSceneLabel').textContent
      };
    });
    await page.screenshot({ path: path.join(exportDir, 'visualizer-qa-bass-forge.png'), fullPage: false });

    const finalStarted = await page.evaluate(async () => {
      const state = {
        phase: 'result',
        choices: {
          soundWorld: 'organicForest', bassPersonality: 'melodic', rhythm: 'halfTime',
          structure: 'melodicNarrative', drop: 'overload', variation: 'lift'
        },
        bassMacros: { growl: 42, wobble: 62, body: 65, space: 72 },
        synthParams: {
          waveform: 'vocalGrowl', oscB: 'sawtooth', oscMix: 58, detune: 17,
          filterType: 'lowpass', filterEnv: 74, sub: 72, fm: 62, cutoff: 4200,
          resonance: 12, drive: 76, attack: 3, release: 95, rate: 3, depth: 64,
          lfoShape: 'triangle', lfoTarget: 'filter', space: 58
        },
        groove: { density: 1 },
        performance: { events: [{ pad: 'D', step: 1 }, { pad: 'K', step: 5 }] },
        dna: { rhythm: 68, aggression: 58, harmony: 90, movement: 74, space: 82, surprise: 62 },
        result: { primaryStyle: 'melodicDubstep', secondaryStyle: 'brostep', isHidden: false }
      };
      Visualizer.setTheme('organicForest');
      Visualizer.setExperienceState(state);
      await AudioEngine.preloadEnding('melodicDubstep');
      const started = await AudioEngine.playFinalSong(state, function () {});
      AudioEngine.getFinalSongPosition = function () {
        return { playing: true, progress: 0.74, section: 'dropB', duration: 40, elapsed: 29.6, remaining: 10.4 };
      };
      return started;
    });
    await new Promise(resolve => setTimeout(resolve, 1800));

    const final = await page.evaluate(() => {
      const canvas = document.getElementById('wbCanvas');
      const ctx = canvas.getContext('2d');
      const sample = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let lit = 0;
      let total = 0;
      for (let i = 0; i < sample.length; i += 256) {
        total++;
        if (sample[i] + sample[i + 1] + sample[i + 2] > 45) lit++;
      }
      return {
        sceneLabel: document.getElementById('visualSceneLabel').textContent,
        sectionLabel: document.getElementById('visualSectionLabel').textContent,
        metrics: Visualizer.getMetrics(),
        litRatio: total ? lit / total : 0
      };
    });
    await page.screenshot({ path: path.join(exportDir, 'visualizer-qa-drop.png'), fullPage: false });

    const styleScenes = await page.evaluate(async () => {
      const styles = ['riddimDubstep', 'brostep', 'hybridTrap', 'bassHouse', 'melodicDubstep', 'destinyFusion'];
      const scenes = {};
      for (const style of styles) {
        Visualizer.setExperienceState({
          phase: 'result',
          choices: { soundWorld: 'cosmicVoid', drop: 'overload' },
          synthParams: {}, dna: {},
          result: { primaryStyle: style, isHidden: style === 'destinyFusion' }
        });
        await new Promise(resolve => setTimeout(resolve, 80));
        scenes[style] = Visualizer.getMetrics().scene;
      }
      Visualizer.setTheme('organicForest');
      Visualizer.setExperienceState({
        phase: 'result', choices: { soundWorld: 'organicForest', drop: 'overload' },
        synthParams: {}, dna: {}, result: { primaryStyle: 'melodicDubstep', isHidden: false }
      });
      return scenes;
    });

    await page.click('#visualModeBtn');
    const modeAfterClick = await page.$eval('#visualModeBtn', node => node.textContent);

    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await new Promise(resolve => setTimeout(resolve, 350));
    const mobile = await page.evaluate(() => {
      const stage = document.getElementById('workbench').getBoundingClientRect();
      const main = document.getElementById('main').getBoundingClientRect();
      const canvas = document.getElementById('wbCanvas');
      return {
        stage: { width: stage.width, height: stage.height, top: stage.top },
        main: { width: main.width, top: main.top },
        canvas: { width: canvas.width, height: canvas.height, cssWidth: canvas.getBoundingClientRect().width, cssHeight: canvas.getBoundingClientRect().height },
        metrics: Visualizer.getMetrics(),
        horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });
    await page.screenshot({ path: path.join(exportDir, 'visualizer-qa-mobile.png'), fullPage: false });

    if (errors.length) throw new Error(errors.join('\n'));
    if (!creation.appActive || creation.stage.width <= creation.main.width) throw new Error('Desktop visual stage is not the primary region.');
    if (!bassForge.macroVisible || bassForge.mainOverflow > 1 || bassForge.knobCount < 10) throw new Error('Bass Forge side panel layout failed.');
    if (creation.bodyOverflow > 1 || mobile.horizontalOverflow > 1) throw new Error('Layout has horizontal overflow.');
    if (!finalStarted || !/SUPERSAW/.test(final.sceneLabel) || !/DROP B/.test(final.sectionLabel)) {
      throw new Error('Final style/section did not reach the visualizer HUD.');
    }
    if (final.litRatio < 0.04) throw new Error('Canvas appears visually empty.');
    if (new Set(Object.values(styleScenes)).size !== 6) throw new Error('Style visual scenes are not distinct.');
    if (modeAfterClick !== 'SCOPE') throw new Error('Manual visual mode did not cycle.');

    console.log('VISUALIZER_QA_OK');
    console.log(JSON.stringify({ creation, bassForge, finalStarted, final, styleScenes, modeAfterClick, mobile }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
