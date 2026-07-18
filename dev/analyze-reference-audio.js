const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const reportPath = path.join(root, 'exports', 'reference-audio', 'render-report.json');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

const bands = [
  { id: 'sub', filter: 'highpass=f=25,lowpass=f=90' },
  { id: 'bass', filter: 'highpass=f=90,lowpass=f=250' },
  { id: 'mids', filter: 'highpass=f=250,lowpass=f=2000' },
  { id: 'presence', filter: 'highpass=f=2000,lowpass=f=6000' },
  { id: 'air', filter: 'highpass=f=6000,lowpass=f=16000' }
];

function runFfmpeg(args) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return `${result.stdout}\n${result.stderr}`;
}

function measureLoudness(file, start, duration) {
  const output = runFfmpeg([
    '-ss', String(start), '-t', String(duration), '-i', file,
    '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', 'NUL'
  ]);
  const matches = [...output.matchAll(/\{[\s\S]*?"target_offset"\s*:\s*"[^"]+"[\s\S]*?\}/g)];
  if (!matches.length) throw new Error(`Unable to parse loudness for ${file}`);
  const parsed = JSON.parse(matches[matches.length - 1][0]);
  return {
    lufs: Number(parsed.input_i),
    truePeakDbfs: Number(parsed.input_tp),
    loudnessRange: Number(parsed.input_lra)
  };
}

function measureBand(file, start, duration, filter) {
  const output = runFfmpeg([
    '-ss', String(start), '-t', String(duration), '-i', file,
    '-af', `${filter},volumedetect`, '-f', 'null', 'NUL'
  ]);
  const matches = [...output.matchAll(/mean_volume:\s*(-?[\d.]+) dB/g)];
  return matches.length ? Number(matches[matches.length - 1][1]) : null;
}

const analysis = report.map(item => {
  const file = path.resolve(root, item.wav);
  const beat = 60 / item.bpm;
  const dropStart = 0.15 + 24 * beat;
  const halfDuration = 16 * beat;
  const sections = {};
  for (const section of [
    { id: 'dropA', start: dropStart, duration: halfDuration },
    { id: 'dropB', start: dropStart + halfDuration, duration: halfDuration }
  ]) {
    const bandLevels = {};
    for (const band of bands) bandLevels[band.id] = measureBand(file, section.start, section.duration, band.filter);
    sections[section.id] = {
      ...measureLoudness(file, section.start, section.duration),
      bandMeanDb: bandLevels
    };
  }
  return { id: item.buildId || item.id, genre: item.genre, bpm: item.bpm, sections };
});

const outputPath = path.join(root, 'exports', 'reference-audio', 'mix-analysis.json');
fs.writeFileSync(outputPath, `${JSON.stringify(analysis, null, 2)}\n`);
console.log(JSON.stringify(analysis, null, 2));
console.log(`Wrote ${outputPath}`);
