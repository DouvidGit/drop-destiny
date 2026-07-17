const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const asciiRoot = path.join(os.homedir(), 'dd_drop_destiny');
const sclang = process.env.SCLANG_PATH || 'C:\\Program Files\\SuperCollider-3.14.1\\sclang.exe';
const outputRoot = path.join(projectRoot, 'exports', 'collider-endings');
const captureRoot = path.join(outputRoot, 'captures');
const rawRoot = path.join(outputRoot, 'raw');
const mp3Root = path.join(outputRoot, 'mp3');
const spectrogramRoot = path.join(outputRoot, 'spectrograms');

const endings = [
  { id: 'riddim', genre: 'Riddim Dubstep', bpm: 140, arrangement: 'riddim-arrangement.scd', wav: '01-riddim-destiny.wav' },
  { id: 'brostep', genre: 'Brostep', bpm: 150, arrangement: 'brostep-arrangement.scd', wav: '02-brostep-destiny.wav' },
  { id: 'hybrid', genre: 'Hybrid Trap', bpm: 150, arrangement: 'hybrid-arrangement.scd', wav: '03-hybrid-trap-destiny.wav' },
  { id: 'house', genre: 'Bass House', bpm: 126, arrangement: 'house-arrangement.scd', wav: '04-bass-house-destiny.wav' },
  { id: 'melodic', genre: 'Melodic Dubstep', bpm: 150, arrangement: 'melodic-arrangement.scd', wav: '05-melodic-dubstep-destiny.wav' },
  { id: 'fusion', genre: 'Destiny Fusion', bpm: 145, arrangement: 'fusion-arrangement.scd', wav: '06-destiny-fusion.wav' }
];

const bands = [
  { id: 'sub', filter: 'highpass=f=25,lowpass=f=90' },
  { id: 'bass', filter: 'highpass=f=90,lowpass=f=250' },
  { id: 'lowMids', filter: 'highpass=f=250,lowpass=f=700' },
  { id: 'mids', filter: 'highpass=f=700,lowpass=f=2000' },
  { id: 'presence', filter: 'highpass=f=2000,lowpass=f=6000' },
  { id: 'air', filter: 'highpass=f=6000,lowpass=f=16000' }
];

function normalizePath(value) {
  return path.resolve(value).replace(/[\\/]+$/, '').toLowerCase();
}

function ensureAsciiJunction() {
  if (fs.existsSync(asciiRoot)) {
    const actual = fs.realpathSync.native(asciiRoot);
    if (normalizePath(actual) !== normalizePath(projectRoot)) {
      throw new Error(`ASCII helper path points elsewhere: ${asciiRoot} -> ${actual}`);
    }
    return;
  }
  fs.symlinkSync(projectRoot, asciiRoot, 'junction');
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || projectRoot,
    env: options.env || process.env,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true
  });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  if (result.status !== 0) {
    throw new Error(`${command} failed (${result.status}):\n${output}`);
  }
  return output;
}

function ffmpeg(args) {
  return run('ffmpeg', ['-hide_banner', '-nostats', ...args]);
}

function durationSeconds(file) {
  const output = run('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file
  ]).trim();
  return Number(output);
}

function parseLoudnorm(output) {
  const matches = [...output.matchAll(/\{[\s\S]*?"target_offset"\s*:\s*"[^"]+"[\s\S]*?\}/g)];
  if (!matches.length) throw new Error('Unable to parse ffmpeg loudnorm output.');
  return JSON.parse(matches[matches.length - 1][0]);
}

function measureLoudness(file, start = 0, duration = null) {
  const args = [];
  if (start > 0) args.push('-ss', start.toFixed(5));
  if (duration != null) args.push('-t', Math.max(0.05, duration).toFixed(5));
  args.push('-i', file, '-af', 'loudnorm=I=-12:TP=-1.2:LRA=8:print_format=json', '-f', 'null', 'NUL');
  const parsed = parseLoudnorm(ffmpeg(args));
  return {
    lufs: Number(parsed.input_i),
    truePeakDbfs: Number(parsed.input_tp),
    loudnessRange: Number(parsed.input_lra),
    threshold: Number(parsed.input_thresh)
  };
}

function measureBand(file, start, duration, filter) {
  const output = ffmpeg([
    '-ss', start.toFixed(5), '-t', Math.max(0.05, duration).toFixed(5), '-i', file,
    '-af', `${filter},volumedetect`, '-f', 'null', 'NUL'
  ]);
  const mean = [...output.matchAll(/mean_volume:\s*(-?[\d.]+) dB/g)];
  const peak = [...output.matchAll(/max_volume:\s*(-?[\d.]+) dB/g)];
  return {
    meanDb: mean.length ? Number(mean[mean.length - 1][1]) : null,
    peakDb: peak.length ? Number(peak[peak.length - 1][1]) : null
  };
}

function analyzeSection(file, start, duration) {
  const bandLevels = {};
  for (const band of bands) bandLevels[band.id] = measureBand(file, start, duration, band.filter);
  return { start, duration, ...measureLoudness(file, start, duration), bands: bandLevels };
}

function trimBoundaries(input, output) {
  // Reverse-pass trimming removes only boundary silence and preserves the intentional pre-drop vacuum.
  ffmpeg([
    '-y', '-i', input,
    '-af', [
      'silenceremove=start_periods=1:start_duration=0.03:start_threshold=-58dB',
      'areverse',
      'silenceremove=start_periods=1:start_duration=0.18:start_threshold=-58dB',
      'areverse'
    ].join(','),
    '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', output
  ]);
}

function encodeListeningMp3(input, output) {
  // MP3 can overshoot a safe WAV true peak by more than 1 dB. Dynamic
  // loudness normalization followed by a no-makeup safety limiter keeps the
  // listening copies punchy without creating codec clipping.
  const filter = [
    'loudnorm=I=-11:TP=-2:LRA=8:linear=false',
    'alimiter=limit=0.64:attack=5:release=80:level=false'
  ].join(',');
  ffmpeg(['-y', '-i', input, '-af', filter, '-codec:a', 'libmp3lame', '-b:a', '256k', output]);
}

function makeSpectrogram(input, output) {
  ffmpeg([
    '-y', '-i', input,
    '-lavfi', 'showspectrumpic=s=1800x720:legend=1:color=intensity:scale=log:fscale=log',
    '-frames:v', '1', output
  ]);
}

function findingsFor(item) {
  const findings = [];
  const { whole, sections } = item.analysis;
  const dropDelta = sections.dropB.lufs - sections.dropA.lufs;
  const buildToDrop = sections.dropA.lufs - sections.build.lufs;
  if (whole.truePeakDbfs > -0.5) findings.push('Peak headroom is tight; reduce source gain or limiting drive.');
  if (dropDelta < -1) findings.push('Drop B is materially weaker than Drop A; strengthen orchestration without adding random fills.');
  if (dropDelta > 2.5) findings.push('Drop B jump is abrupt; rebalance the added response layers.');
  if (buildToDrop < 2) findings.push('Build-to-drop loudness contrast is small; thin the build or reinforce the drop transient/low end.');
  const drop = sections.dropA.bands;
  if (drop.sub.meanDb < drop.mids.meanDb - 10) findings.push('Sub lane is comparatively light for a bass-music drop.');
  if (drop.presence.meanDb < drop.lowMids.meanDb - 12) findings.push('Presence band is recessed; lead/attack detail may not read clearly.');
  // Band-pass mean levels are bandwidth-dependent; require a clear 6 dB deficit
  // before calling a melodic drop bass-led. The separate low-mid/mid bands and
  // spectrogram are then used to confirm that the saw stack is actually absent.
  if (item.id === 'melodic' &&
      drop.mids.meanDb < drop.sub.meanDb - 6 &&
      drop.lowMids.meanDb < drop.sub.meanDb - 6) {
    findings.push('Melodic ending is too bass-led; lift supersaw/lead or reduce bass support.');
  }
  if (!findings.length) findings.push('Objective balance is within the target window; confirm musical character with the listening file.');
  return findings;
}

function renderEnding(ending) {
  const capture = path.join(captureRoot, ending.wav);
  const raw = path.join(rawRoot, ending.wav);
  const mp3 = path.join(mp3Root, ending.wav.replace(/\.wav$/i, '.mp3'));
  const spectrogram = path.join(spectrogramRoot, ending.wav.replace(/\.wav$/i, '.png'));
  for (const file of [capture, raw, mp3, spectrogram]) if (fs.existsSync(file)) fs.rmSync(file);

  const env = {
    ...process.env,
    DD_TAPE: path.join(asciiRoot, 'collider', 'drop-destiny-tape.scd'),
    DD_ARRANGEMENT: path.join(asciiRoot, 'collider', 'arrangements', ending.arrangement),
    DD_SAMPLE_DIR: path.join(asciiRoot, 'collider', 'samples'),
    DD_RECORDINGS_DIR: path.join(asciiRoot, 'exports', 'collider-endings', 'captures')
  };
  process.stdout.write(`Rendering ${ending.genre} (${ending.bpm} BPM)... `);
  const output = run(sclang, ['-D', path.join(asciiRoot, 'collider', 'render-one.scd')], { cwd: asciiRoot, env });
  if (!output.includes(`DROP_DESTINY_RENDER_OK:${ending.wav}`) || !fs.existsSync(capture)) {
    throw new Error(`Renderer did not produce ${ending.wav}.\n${output}`);
  }
  trimBoundaries(capture, raw);
  encodeListeningMp3(raw, mp3);
  makeSpectrogram(raw, spectrogram);
  console.log('done');

  const beat = 60 / ending.bpm;
  const bar = beat * 4;
  const audioDuration = durationSeconds(raw);
  const sections = {
    intro: analyzeSection(raw, 0, Math.min(2 * bar, audioDuration)),
    build: analyzeSection(raw, 2 * bar, Math.min(3 * bar, audioDuration - 2 * bar)),
    predrop: analyzeSection(raw, 5 * bar, Math.min(bar, audioDuration - 5 * bar)),
    dropA: analyzeSection(raw, 6 * bar, Math.min(4 * bar, audioDuration - 6 * bar)),
    dropB: analyzeSection(raw, 10 * bar, Math.min(3 * bar, audioDuration - 10 * bar)),
    final: analyzeSection(raw, 13 * bar, Math.min(bar, audioDuration - 13 * bar))
  };
  const result = {
    ...ending,
    files: {
      raw: path.relative(projectRoot, raw),
      mp3: path.relative(projectRoot, mp3),
      spectrogram: path.relative(projectRoot, spectrogram)
    },
    analysis: {
      durationSeconds: audioDuration,
      whole: measureLoudness(raw),
      sections
    }
  };
  result.findings = findingsFor(result);
  return result;
}

function writeMarkdownReport(results) {
  const lines = [
    '# Collider ending analysis',
    '',
    '| Ending | Duration | Whole LUFS | Peak | Drop A | Drop B | B-A | Build->Drop |',
    '|---|---:|---:|---:|---:|---:|---:|---:|'
  ];
  for (const item of results) {
    const a = item.analysis;
    lines.push(`| ${item.genre} | ${a.durationSeconds.toFixed(2)} s | ${a.whole.lufs.toFixed(1)} | ${a.whole.truePeakDbfs.toFixed(1)} dBTP | ${a.sections.dropA.lufs.toFixed(1)} | ${a.sections.dropB.lufs.toFixed(1)} | ${(a.sections.dropB.lufs - a.sections.dropA.lufs).toFixed(1)} | ${(a.sections.dropA.lufs - a.sections.build.lufs).toFixed(1)} |`);
  }
  for (const item of results) {
    lines.push('', `## ${item.genre}`, '', ...item.findings.map(value => `- ${value}`));
  }
  fs.writeFileSync(path.join(outputRoot, 'analysis.md'), `${lines.join('\n')}\n`);
}

function main() {
  if (!fs.existsSync(sclang)) throw new Error(`sclang not found: ${sclang}`);
  ensureAsciiJunction();
  for (const dir of [captureRoot, rawRoot, mp3Root, spectrogramRoot]) fs.mkdirSync(dir, { recursive: true });
  const only = process.argv.slice(2);
  const selected = only.length ? endings.filter(item => only.includes(item.id)) : endings;
  if (!selected.length) throw new Error(`Unknown ending id(s): ${only.join(', ')}`);
  const reportPath = path.join(outputRoot, 'analysis.json');
  const rendered = selected.map(renderEnding);
  let results = rendered;
  if (only.length && fs.existsSync(reportPath)) {
    const previous = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const byId = new Map(previous.map(item => [item.id, item]));
    for (const item of rendered) byId.set(item.id, item);
    results = endings.map(item => byId.get(item.id)).filter(Boolean);
  }
  fs.writeFileSync(reportPath, `${JSON.stringify(results, null, 2)}\n`);
  writeMarkdownReport(results);
  console.log(`Wrote ${reportPath}`);
}

main();
