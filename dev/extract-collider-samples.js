const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const target = path.join(root, 'collider', 'samples');
const sandbox = { window: {}, global: {} };
sandbox.window.window = sandbox.window;
sandbox.global = sandbox.window;
vm.runInNewContext(fs.readFileSync(path.join(root, 'audio-assets.js'), 'utf8'), sandbox.window);

const assets = sandbox.window.DropDestinyAudioAssets;
const wanted = [
  'kickClean', 'kickTearout', 'snareBeefy', 'snareWide', 'clapFat',
  'hatRiddim', 'hatBrostep', 'hatTrap', 'hatHouse', 'hatMelodic', 'hatFusion',
  'hatOpenHouse', 'hatOpenSoft', 'hatOpenTrap'
];

fs.mkdirSync(target, { recursive: true });
for (const id of wanted) {
  const asset = assets[id];
  if (!asset) throw new Error(`Missing embedded asset ${id}`);
  const source = path.join(target, `${id}.mp3`);
  const output = path.join(target, `${id}.wav`);
  fs.writeFileSync(source, Buffer.from(asset.base64, 'base64'));
  const result = spawnSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', source,
    '-ar', '48000', '-ac', '2', '-sample_fmt', 's16', output
  ], { encoding: 'utf8' });
  fs.rmSync(source);
  if (result.status !== 0) throw new Error(`ffmpeg failed for ${id}: ${result.stderr}`);
}

console.log(`Extracted ${wanted.length} CC0 samples to ${target}`);
