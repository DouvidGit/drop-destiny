const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const outputRoot = path.join(root, 'exports', 'reference-audio');
const wavRoot = path.join(outputRoot, 'wav');
const mp3Root = path.join(outputRoot, 'mp3');
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const depsRoot = process.env.DROP_DESTINY_NATIVE_RENDERER_NODE_MODULES ||
  path.join(os.tmpdir(), 'drop-destiny-native-renderer', 'node_modules');
const puppeteer = require(path.join(depsRoot, 'puppeteer-core'));

const buildIds = [
  '01-riddim-dubstep',
  '02-brostep',
  '03-hybrid-trap-breakbeat',
  '04-bass-house',
  '05-melodic-dubstep',
  '06-destiny-fusion'
];

function waitForDownload(file, timeoutMs = 60000) {
  const started = Date.now();
  let previousSize = -1;
  let stableChecks = 0;
  return new Promise((resolve, reject) => {
    const poll = () => {
      if (fs.existsSync(file)) {
        const size = fs.statSync(file).size;
        if (size > 44 && size === previousSize) stableChecks++;
        else stableChecks = 0;
        previousSize = size;
        if (stableChecks >= 2) return resolve(size);
      }
      if (Date.now() - started > timeoutMs) return reject(new Error(`Timed out waiting for ${file}`));
      setTimeout(poll, 250);
    };
    poll();
  });
}

function encodeNormalizedMp3(wavPath, mp3Path) {
  const firstPass = spawnSync('ffmpeg', [
    '-hide_banner', '-nostats', '-i', wavPath,
    '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', 'NUL'
  ], { encoding: 'utf8' });
  if (firstPass.status !== 0) throw new Error(`ffmpeg loudness scan failed: ${firstPass.stderr}`);
  const matches = [...firstPass.stderr.matchAll(/\{[\s\S]*?"target_offset"\s*:\s*"[^"]+"[\s\S]*?\}/g)];
  if (!matches.length) throw new Error(`Unable to parse loudness scan for ${wavPath}`);
  const measured = JSON.parse(matches[matches.length - 1][0]);
  const filter = [
    'loudnorm=I=-14:TP=-1.5:LRA=11',
    `measured_I=${measured.input_i}`,
    `measured_LRA=${measured.input_lra}`,
    `measured_TP=${measured.input_tp}`,
    `measured_thresh=${measured.input_thresh}`,
    `offset=${measured.target_offset}`,
    'linear=true:print_format=summary'
  ].join(':');
  const secondPass = spawnSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', wavPath,
    '-af', filter, '-codec:a', 'libmp3lame', '-b:a', '256k', mp3Path
  ], { encoding: 'utf8' });
  if (secondPass.status !== 0) throw new Error(`ffmpeg encode failed: ${secondPass.stderr}`);
}

async function main() {
  if (!fs.existsSync(chromePath)) throw new Error(`Chrome not found: ${chromePath}`);
  fs.mkdirSync(wavRoot, { recursive: true });
  fs.mkdirSync(mp3Root, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: [
      '--allow-file-access-from-files',
      '--autoplay-policy=no-user-gesture-required',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--no-first-run'
    ]
  });

  const report = [];
  try {
    for (const buildId of buildIds) {
      const wavPath = path.join(wavRoot, `${buildId}.wav`);
      const partialPath = `${wavPath}.crdownload`;
      if (fs.existsSync(wavPath)) fs.rmSync(wavPath);
      if (fs.existsSync(partialPath)) fs.rmSync(partialPath);

      const page = await browser.newPage();
      const cdp = await page.createCDPSession();
      await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: wavRoot });
      page.on('console', message => console.log(`[chrome:${buildId}] ${message.text()}`));
      page.on('pageerror', error => console.error(`[chrome:${buildId}] ${error.stack || error.message}`));

      const url = `${pathToFileURL(path.join(__dirname, 'native-audio-export.html')).href}?build=${encodeURIComponent(buildId)}`;
      process.stdout.write(`Rendering ${buildId} in native Chrome… `);
      await page.goto(url, { waitUntil: 'load', timeout: 30000 });
      await page.waitForFunction(() => ['done', 'error'].includes(document.body.dataset.status), { timeout: 90000 });
      const status = await page.evaluate(() => ({
        state: document.body.dataset.status,
        result: window.__dropDestinyExportResult || null,
        error: window.__dropDestinyExportError || null
      }));
      if (status.state === 'error') throw new Error(`${buildId}: ${status.error}`);
      await waitForDownload(wavPath);
      await page.close();

      const mp3Path = path.join(mp3Root, `${buildId}.mp3`);
      encodeNormalizedMp3(wavPath, mp3Path);
      const result = Object.assign({}, status.result, {
        renderer: 'Chrome OfflineAudioContext',
        wav: path.relative(root, wavPath),
        mp3: path.relative(root, mp3Path)
      });
      report.push(result);
      console.log(`${result.peakDbfs.toFixed(2)} dBFS peak, ${result.rmsDbfs.toFixed(2)} dBFS RMS`);
    }
  } finally {
    await browser.close();
  }

  fs.writeFileSync(path.join(outputRoot, 'render-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Exported ${report.length} native Chrome renders to ${outputRoot}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
