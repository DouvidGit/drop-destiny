const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const audit = { paramEvents: 0, nodes: 0, starts: 0, stops: 0, maxFinalStarts: 0 };

class Param {
  constructor(value = 0) { this.value = value; }
  check(value, time) {
    assert(Number.isFinite(value), `Non-finite AudioParam value: ${value}`);
    if (time != null) assert(Number.isFinite(time) && time >= 0, `Invalid AudioParam time: ${time}`);
    audit.paramEvents++;
    this.value = value;
  }
  setTargetAtTime(value, time) { this.check(value, time); }
  setValueAtTime(value, time) { this.check(value, time); }
  linearRampToValueAtTime(value, time) { this.check(value, time); }
  exponentialRampToValueAtTime(value, time) {
    assert(value > 0, `Exponential ramp target must be positive: ${value}`);
    this.check(value, time);
  }
  cancelScheduledValues(time) {
    if (time != null) assert(Number.isFinite(time) && time >= 0, `Invalid cancellation time: ${time}`);
  }
}

class Node {
  constructor() {
    audit.nodes++;
    this.gain = new Param();
    this.frequency = new Param();
    this.detune = new Param();
    this.Q = new Param();
    this.delayTime = new Param();
    this.playbackRate = new Param(1);
    this.startedAt = null;
  }
  connect() { return this; }
  disconnect() {}
  start(time, offset, duration) {
    if (time != null) assert(Number.isFinite(time) && time >= 0, `Invalid node start time: ${time}`);
    if (offset != null) assert(Number.isFinite(offset) && offset >= 0, `Invalid source offset: ${offset}`);
    if (duration != null) assert(Number.isFinite(duration) && duration > 0, `Invalid source duration: ${duration}`);
    this.startedAt = time == null ? 0 : time;
    audit.starts++;
  }
  stop(time) {
    if (time != null) {
      assert(Number.isFinite(time) && time >= 0, `Invalid node stop time: ${time}`);
      assert(this.startedAt == null || time >= this.startedAt, `Node stops before it starts: ${time} < ${this.startedAt}`);
    }
    audit.stops++;
  }
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
  startRendering() { return Promise.resolve(this.createBuffer(2, this.sampleRate)); }
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
  const oscBTypes = ['sawtooth', 'square', 'triangle', 'sine'];
  const lfoShapes = ['sine', 'triangle', 'sawtooth', 'square'];
  const lfoTargets = ['filter', 'pitch', 'fm'];
  const structures = ['classicDrop', 'melodicNarrative', 'minimalTech', 'epicJourney'];
  for (let i = 0; i < genres.length; i++) {
    state.result = { primaryStyle: genres[i] };
    state.choices.structure = structures[i % structures.length];
    state.choices.variation = ['repeat', 'mutate', 'lift'][i % 3];
    state.synthParams.waveform = waveforms[i % waveforms.length];
    state.synthParams.fm = i % 2 ? 100 : 0;
    state.synthParams.depth = i % 2 ? 0 : 100;
    state.synthParams.cutoff = i % 2 ? 80 : 8000;
    state.synthParams.oscB = oscBTypes[i % oscBTypes.length];
    state.synthParams.oscMix = i % 2 ? 0 : 100;
    state.synthParams.detune = i % 2 ? 0 : 36;
    state.synthParams.attack = i % 2 ? 1 : 180;
    state.synthParams.release = i % 2 ? 30 : 500;
    state.synthParams.filterEnv = i % 2 ? 0 : 100;
    state.synthParams.lfoShape = lfoShapes[i % lfoShapes.length];
    state.synthParams.lfoTarget = lfoTargets[i % lfoTargets.length];
    audio.applyState(state);
    for (const events of [[], data.NEUTRAL_PATTERN.slice()]) {
      state.performance.events = events;
      const startsBefore = audit.starts;
      audio.playFinalSong(state, () => {});
      const scheduledStarts = audit.starts - startsBefore;
      audit.maxFinalStarts = Math.max(audit.maxFinalStarts, scheduledStarts);
      assert(scheduledStarts > 40, `${genres[i]} scheduled too few audio nodes`);
      assert(scheduledStarts < 1800, `${genres[i]} scheduled too many audio nodes: ${scheduledStarts}`);
      audio.stopFinalSong();
    }
  }

  audio.setPaused(false);
  audio.setPaused(true);
  audio.stop();
  assert(audit.paramEvents > 1000, 'Expected substantial parameter automation coverage');
  console.log('AUDIO_ENGINE_SMOKE_OK');
  console.log(JSON.stringify(audit));
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
