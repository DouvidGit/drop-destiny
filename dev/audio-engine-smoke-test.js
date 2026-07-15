const fs = require('fs');
const vm = require('vm');

class Param {
  constructor(value = 0) { this.value = value; }
  setTargetAtTime(value) { this.value = value; }
  setValueAtTime(value) { this.value = value; }
  linearRampToValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
  cancelScheduledValues() {}
}

class Node {
  constructor() {
    this.gain = new Param();
    this.frequency = new Param();
    this.detune = new Param();
    this.Q = new Param();
    this.delayTime = new Param();
    this.playbackRate = new Param(1);
  }
  connect() { return this; }
  disconnect() {}
  start() {}
  stop() {}
  setPeriodicWave() {}
}

class FakeContext {
  constructor() {
    this.currentTime = 1;
    this.sampleRate = 48000;
    this.state = 'running';
    this.destination = new Node();
  }
  createGain() { return new Node(); }
  createDynamicsCompressor() {
    const n = new Node();
    n.threshold = new Param(); n.knee = new Param(); n.ratio = new Param();
    n.attack = new Param(); n.release = new Param();
    return n;
  }
  createAnalyser() {
    const n = new Node();
    n.fftSize = 2048; n.frequencyBinCount = 1024;
    n.getByteFrequencyData = () => {}; n.getByteTimeDomainData = () => {};
    return n;
  }
  createOscillator() { return new Node(); }
  createBiquadFilter() { return new Node(); }
  createWaveShaper() { return new Node(); }
  createDelay() { return new Node(); }
  createBufferSource() { return new Node(); }
  createBuffer(channels, length) {
    return { duration: length / this.sampleRate, getChannelData: () => new Float32Array(length) };
  }
  createPeriodicWave() { return {}; }
  decodeAudioData() { return Promise.resolve({ duration: 1 }); }
  resume() { this.state = 'running'; return Promise.resolve(); }
}

const window = {
  AudioContext: FakeContext,
  atob: value => Buffer.from(value, 'base64').toString('binary'),
  setTimeout: () => 1,
  clearTimeout: () => {},
  Math,
  Promise
};
window.window = window;
window.global = window;

const context = vm.createContext(window);
for (const file of ['data.js', 'style-engine.js', 'wavetables.js', 'audio-assets.js', 'audio-engine.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
}

const data = window.DropDestinyData;
const state = {
  choices: {
    soundWorld: 'abyss', bassPersonality: 'brutal', rhythm: 'halfTime',
    structure: 'classicDrop', variation: 'mutate', drop: 'overload'
  },
  synthParams: { ...data.SYNTH_PRESETS.brutal, cutoff: 980 },
  bassMacros: { body: 78, growl: 86, wobble: 70, space: 22 },
  groove: { density: 2 },
  performance: { events: data.NEUTRAL_PATTERN.slice(), completed: true }
};
state.result = window.StyleEngine.evaluate(state);

async function run() {
  const audio = window.AudioEngine;
  audio.start(state);
  await Promise.resolve();
  await Promise.resolve();
  audio.applyState(state);
  audio.previewChoice('bassPersonality', 'brutal');
  audio.previewChoice('drop', 'overload');
  audio.playPattern(state.performance.events, 140, () => {}, () => {});
  audio.stopPattern();

  const genres = ['riddimDubstep', 'brostep', 'hybridTrap', 'bassHouse', 'melodicDubstep', 'destinyFusion'];
  const waveforms = ['distorted', 'fmRazor', 'granite', 'bitCore', 'vocal'];
  for (let i = 0; i < genres.length; i++) {
    state.result = { primaryStyle: genres[i] };
    state.synthParams.waveform = waveforms[i % waveforms.length];
    state.synthParams.fm = i % 2 ? 100 : 0;
    state.synthParams.depth = i % 2 ? 0 : 100;
    state.synthParams.cutoff = i % 2 ? 80 : 8000;
    audio.applyState(state);
    audio.playFinalSong(state, () => {});
    audio.stopFinalSong();
  }

  audio.setPaused(false);
  audio.setPaused(true);
  audio.stop();
  console.log('AUDIO_ENGINE_SMOKE_OK');
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
