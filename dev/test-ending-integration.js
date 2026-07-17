const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const depsRoot = process.env.DROP_DESTINY_NATIVE_RENDERER_NODE_MODULES ||
  path.join(os.tmpdir(), 'drop-destiny-native-renderer', 'node_modules');
const puppeteer = require(path.join(depsRoot, 'puppeteer-core'));
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const root = path.resolve(__dirname, '..');
const url = process.env.DROP_DESTINY_TEST_URL || pathToFileURL(path.join(root, 'index.html')).href;

async function main() {
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
    page.on('pageerror', error => errors.push(error.stack || error.message));
    page.on('console', message => {
      if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(message.text());
    });
    page.on('response', response => {
      if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) {
        errors.push(`${response.status()} ${response.url()}`);
      }
    });
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

    const result = await page.evaluate(async () => {
      const embedded = window.DropDestinyEndingAssets || {};
      const sizes = Object.keys(embedded).sort().map(key => embedded[key].base64.length);

      function makeState(genre, cutoff, waveform, performanceEvents) {
        return {
          phase: 'result',
          choices: {
            soundWorld: genre === 'melodicDubstep' ? 'organicForest' : 'abyss',
            bassPersonality: genre === 'melodicDubstep' ? 'melodic' : 'brutal',
            rhythm: genre === 'bassHouse' ? 'fourOnFloor' : 'halfTime',
            structure: 'classicDrop',
            drop: 'overload',
            variation: 'mutate'
          },
          bassMacros: { growl: 78, wobble: 64, body: 72, space: 32 },
          synthParams: {
            waveform,
            oscB: 'sawtooth', oscMix: 58, detune: 17,
            filterType: 'lowpass', filterEnv: 74,
            sub: 72, fm: 78, cutoff, resonance: 12, drive: 76,
            attack: 3, release: 95, rate: 3, depth: 64,
            lfoShape: 'triangle', lfoTarget: 'filter', space: 32
          },
          groove: { density: 1 },
          performance: { events: performanceEvents || [] },
          result: { primaryStyle: genre, secondaryStyle: 'brostep', isHidden: genre === 'destinyFusion' }
        };
      }

      const melodic = makeState('melodicDubstep', 4200, 'vocalGrowl', [
        { pad: 'D', step: 1 }, { pad: 'F', step: 5 }
      ]);
      AudioEngine.start(melodic);
      await AudioEngine.preloadEnding('melodicDubstep');
      const melodicStarted = await AudioEngine.playFinalSong(melodic, function () {});
      const melodicDebug = AudioEngine._getDebugState();
      await new Promise(resolve => setTimeout(resolve, 350));
      AudioEngine.stopFinalSong();

      const brostep = makeState('brostep', 1350, 'metallic', [{ pad: 'D', step: 3 }]);
      await AudioEngine.preloadEnding('brostep');
      const brostepStarted = await AudioEngine.playFinalSong(brostep, function () {});
      const brostepDebug = AudioEngine._getDebugState();
      AudioEngine.stopFinalSong();

      const additional = {};
      const remainingGenres = ['riddimDubstep', 'hybridTrap', 'bassHouse', 'destinyFusion'];
      for (let index = 0; index < remainingGenres.length; index++) {
        const genre = remainingGenres[index];
        const state = makeState(genre, 1800 + index * 250, 'distorted', []);
        await AudioEngine.preloadEnding(genre);
        const started = await AudioEngine.playFinalSong(state, function () {});
        additional[genre] = { started, debug: AudioEngine._getDebugState() };
        AudioEngine.stopFinalSong();
      }

      return { sizes, melodicStarted, melodicDebug, brostepStarted, brostepDebug, additional };
    });

    if (errors.length) throw new Error(`Browser errors:\n${errors.join('\n')}`);
    if (result.sizes.length !== 6 || result.sizes.some(size => size < 500000)) {
      throw new Error(`Embedded backing asset missing or too small: ${result.sizes}`);
    }
    if (!result.melodicStarted || result.melodicDebug.finalMode !== 'collider-backing+user-bass') {
      throw new Error(`Melodic did not use Collider backing: ${JSON.stringify(result.melodicDebug)}`);
    }
    if (result.melodicDebug.finalGenre !== 'melodicDubstep' || result.melodicDebug.bpm !== 150) {
      throw new Error(`Melodic metadata mismatch: ${JSON.stringify(result.melodicDebug)}`);
    }
    if (!result.melodicDebug.synthParams || result.melodicDebug.synthParams.cutoff !== 4200) {
      throw new Error(`Melodic user bass params were not applied: ${JSON.stringify(result.melodicDebug)}`);
    }
    if (!result.brostepStarted || result.brostepDebug.finalGenre !== 'brostep' ||
        !result.brostepDebug.synthParams || result.brostepDebug.synthParams.cutoff !== 1350) {
      throw new Error(`Brostep user bass params were not applied: ${JSON.stringify(result.brostepDebug)}`);
    }
    for (const [genre, value] of Object.entries(result.additional)) {
      if (!value.started || value.debug.finalMode !== 'collider-backing+user-bass' || value.debug.finalGenre !== genre) {
        throw new Error(`${genre} did not use its Collider backing: ${JSON.stringify(value)}`);
      }
    }
    console.log('ENDING_INTEGRATION_OK');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
