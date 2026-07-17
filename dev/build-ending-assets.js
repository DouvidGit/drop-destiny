const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const asciiRoot = path.join(os.homedir(), 'dd_drop_destiny');
const sclang = process.env.SCLANG_PATH || 'C:\\Program Files\\SuperCollider-3.14.1\\sclang.exe';
const captureRoot = path.join(root, 'exports', 'collider-web-captures');
const outputRoot = path.join(root, 'assets', 'endings');

const endings = [
  { id: 'riddimDubstep', arrangement: 'riddim-arrangement.scd', file: 'riddim-dubstep-backing.wav' },
  { id: 'brostep', arrangement: 'brostep-arrangement.scd', file: 'brostep-backing.wav' },
  { id: 'hybridTrap', arrangement: 'hybrid-arrangement.scd', file: 'hybrid-trap-backing.wav' },
  { id: 'bassHouse', arrangement: 'house-arrangement.scd', file: 'bass-house-backing.wav' },
  { id: 'melodicDubstep', arrangement: 'melodic-arrangement.scd', file: 'melodic-dubstep-backing.wav' },
  { id: 'destinyFusion', arrangement: 'fusion-arrangement.scd', file: 'destiny-fusion-backing.wav' }
];

function normalize(value) {
  return path.resolve(value).replace(/[\\/]+$/, '').toLowerCase();
}

function ensureJunction() {
  if (fs.existsSync(asciiRoot)) {
    const actual = fs.realpathSync.native(asciiRoot);
    if (normalize(actual) !== normalize(root)) throw new Error(`${asciiRoot} points to ${actual}`);
  } else {
    fs.symlinkSync(root, asciiRoot, 'junction');
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || root,
    env: options.env || process.env,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true
  });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  if (result.status !== 0) throw new Error(`${command} failed:\n${output}`);
  return output;
}

function ffmpeg(args) {
  return run('ffmpeg', ['-hide_banner', '-nostats', ...args]);
}

function render(item) {
  const capture = path.join(captureRoot, item.file);
  const output = path.join(outputRoot, item.file);
  if (fs.existsSync(capture)) fs.rmSync(capture);
  if (fs.existsSync(output)) fs.rmSync(output);

  const env = {
    ...process.env,
    DD_TAPE: path.join(asciiRoot, 'collider', 'drop-destiny-tape.scd'),
    DD_ARRANGEMENT: path.join(asciiRoot, 'collider', 'arrangements', item.arrangement),
    DD_SAMPLE_DIR: path.join(asciiRoot, 'collider', 'samples'),
    DD_RECORDINGS_DIR: path.join(asciiRoot, 'exports', 'collider-web-captures'),
    DD_BACKING_NAME: item.file
  };

  process.stdout.write(`Building ${item.id} backing... `);
  const log = run(sclang, ['-D', path.join(asciiRoot, 'collider', 'render-backing.scd')], {
    cwd: asciiRoot,
    env
  });
  if (!log.includes(`DROP_DESTINY_BACKING_OK:${item.file}`) || !fs.existsSync(capture)) {
    throw new Error(`Missing backing capture for ${item.id}.\n${log}`);
  }

  // Boundary trim preserves the intentional pre-drop vacuum. The web stem is
  // normalized conservatively so the live user bass has real headroom.
  ffmpeg([
    '-y', '-i', capture,
    '-af', [
      'silenceremove=start_periods=1:start_duration=0.03:start_threshold=-58dB',
      'areverse',
      'silenceremove=start_periods=1:start_duration=0.18:start_threshold=-58dB',
      'areverse',
      'loudnorm=I=-15:TP=-3:LRA=9:linear=false',
      'alimiter=limit=0.68:attack=5:release=80:level=false'
    ].join(','),
    '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', output
  ]);
  console.log('done');
}

function main() {
  if (!fs.existsSync(sclang)) throw new Error(`sclang not found: ${sclang}`);
  ensureJunction();
  fs.mkdirSync(captureRoot, { recursive: true });
  fs.mkdirSync(outputRoot, { recursive: true });
  endings.forEach(render);
  console.log(`Built ${endings.length} backing stems in ${outputRoot}`);
}

main();
