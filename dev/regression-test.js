const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const fail = message => { throw new Error(message); };

const sandbox = { window: {}, global: {}, console, Math, JSON };
sandbox.window.window = sandbox.window;
sandbox.global = sandbox.window;
const context = vm.createContext(sandbox.window);
for (const file of ['data.js', 'style-engine.js', 'wavetables.js', 'audio-assets.js']) {
  vm.runInContext(read(file), context, { filename: file });
}

const D = sandbox.window.DropDestinyData;
const SE = sandbox.window.StyleEngine;
const WT = sandbox.window.DropDestinyWavetables;
const assets = sandbox.window.DropDestinyAudioAssets;

// Style-engine distribution must remain balanced across all 2304 card paths.
const paths = SE.enumerateCardPaths();
if (paths.length !== 2304) fail(`Expected 2304 style paths, got ${paths.length}`);
const counts = Object.fromEntries(SE.STYLE_IDS.concat('destinyFusion').map(id => [id, 0]));
for (const choices of paths) {
  const preset = D.BASS_PRESETS[choices.bassPersonality];
  const state = {
    choices,
    bassMacros: { ...preset },
    groove: { density: 1, fillPreference: 1 },
    performance: { events: D.NEUTRAL_PATTERN.slice(), completed: true }
  };
  counts[SE.evaluate(state).primaryStyle]++;
}
for (const id of SE.STYLE_IDS) {
  const pct = counts[id] / paths.length * 100;
  if (pct < 5 || pct > 45) fail(`${id} distribution out of range: ${pct.toFixed(2)}%`);
}
const fusionPct = counts.destinyFusion / paths.length * 100;
if (fusionPct < 1 || fusionPct > 8) fail(`Destiny Fusion distribution out of range: ${fusionPct.toFixed(2)}%`);

// The shipped UI now derives arrangement/drop intent from Bass Forge parameters.
const simplifiedCounts = Object.fromEntries(SE.STYLE_IDS.concat('destinyFusion').map(id => [id, 0]));
let simplifiedPaths = 0;
for (const soundWorld of Object.keys(D.CHOICES.soundWorld)) {
  for (const bassPersonality of Object.keys(D.CHOICES.bassPersonality)) {
    for (const rhythm of Object.keys(D.CHOICES.rhythm)) {
      for (const drive of [18, 48, 82, 96]) {
        const synthParams = { ...D.SYNTH_PRESETS[bassPersonality], drive };
        if (drive >= 82) { synthParams.fm = Math.max(synthParams.fm, 76); synthParams.cutoff = Math.max(synthParams.cutoff, 2600); }
        if (drive <= 18) synthParams.space = Math.max(synthParams.space, 78);
        const choices = { soundWorld, bassPersonality, rhythm };
        Object.assign(choices, SE.deriveBassDrivenChoices({ choices, synthParams }));
        const state = {
          choices,
          synthParams,
          bassMacros: { ...D.BASS_PRESETS[bassPersonality] },
          groove: { density: 1, fillPreference: 1 },
          performance: { events: [], completed: true }
        };
        simplifiedCounts[SE.evaluate(state).primaryStyle]++;
        simplifiedPaths++;
      }
    }
  }
}
for (const id of SE.STYLE_IDS) {
  if (!simplifiedCounts[id]) fail(`Simplified Bass-first flow cannot reach ${id}`);
}

// Every synth preset must be complete and reference an embedded wavetable.
const synthKeys = ['waveform', 'oscB', 'oscMix', 'detune', 'filterType', 'filterEnv',
  'sub', 'fm', 'cutoff', 'resonance', 'drive', 'attack', 'release',
  'rate', 'depth', 'lfoShape', 'lfoTarget', 'space'];
for (const [id, preset] of Object.entries(D.SYNTH_PRESETS)) {
  for (const key of synthKeys) {
    if (preset[key] == null) fail(`Synth preset ${id} is missing ${key}`);
  }
  if (!WT.tables[preset.waveform]) fail(`Synth preset ${id} references missing wavetable ${preset.waveform}`);
}
if (Object.keys(WT.tables).length < 5) fail('Expected at least five wavetables');

// Embedded CC0 samples must be present and contain decodable base64 bytes.
const requiredAssets = ['kickClean', 'kickTearout', 'snareBeefy', 'snareWide',
  'hatRiddim', 'hatBrostep', 'hatTrap', 'hatHouse', 'hatMelodic', 'hatFusion',
  'hatOpenHouse', 'hatOpenSoft', 'hatOpenTrap', 'clapFat', 'impactDeep', 'riser140'];
for (const id of requiredAssets) {
  if (!assets[id] || !assets[id].base64) fail(`Missing embedded audio asset ${id}`);
  if (Buffer.from(assets[id].base64, 'base64').length < 1000) fail(`Audio asset ${id} is unexpectedly small`);
}

// Static DOM references and classic script resources must resolve offline.
const html = read('index.html');
const app = read('app.js');
const staticIds = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const duplicateIds = staticIds.filter((id, index) => staticIds.indexOf(id) !== index);
if (duplicateIds.length) fail(`Duplicate HTML ids: ${[...new Set(duplicateIds)].join(', ')}`);
const generatedIds = [...app.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
const knownIds = new Set(staticIds.concat(generatedIds));
const referencedIds = [...app.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map(match => match[1]);
const missingIds = [...new Set(referencedIds.filter(id => !knownIds.has(id)))];
if (missingIds.length) fail(`Missing DOM ids: ${missingIds.join(', ')}`);

const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1]);
for (const src of scripts) {
  if (!fs.existsSync(path.join(root, src))) fail(`Missing script resource ${src}`);
}
const waveIndex = scripts.indexOf('wavetables.js');
const assetIndex = scripts.indexOf('audio-assets.js');
const endingAssetIndex = scripts.indexOf('ending-assets.js');
const engineIndex = scripts.indexOf('audio-engine.js');
if (waveIndex < 0 || assetIndex < 0 || endingAssetIndex < 0 || engineIndex < 0 ||
    waveIndex > engineIndex || assetIndex > engineIndex || endingAssetIndex > engineIndex) {
  fail('Audio data scripts must load before audio-engine.js');
}

console.log('REGRESSION_OK');
console.log(JSON.stringify({
  paths: paths.length,
  distribution: counts,
  fusionPct: Number(fusionPct.toFixed(2)),
  simplifiedPaths,
  simplifiedDistribution: simplifiedCounts,
  scripts
}, null, 2));
