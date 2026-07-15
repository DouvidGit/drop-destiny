/**
 * DROP//DESTINY — audio-engine.js
 * Music Workbench Vertical Slice：持续 Loop + 实时参数映射。
 *
 * 公共接口（不变）：
 *   start / applyState / previewChoice / playPattern / playFinalSong
 *   stop / setMuted / getAnalyser / getIsPlaying / getPosition
 *
 * 音频图：
 *   [kick/snare/hihat]  ──────────────────────────────────────┐
 *   [bassOsc]→[bassFilter]→[bassShaper]→[bassGate]→[bassOut] ─┤
 *   [subOsc]→[subGain] ────────────────────────────────────────┤
 *   [padOsc1]                                            ┐    ┤
 *   [padOsc2]→[padGain] ─→ [delaySend]→[delay]→[fb]→[wet]─┘    ┤
 *                                                                ↓
 *                                                          [sumGain]
 *                                                               ↓
 *                                                       [compressor]
 *                                                               ↓
 *                                                          [analyser]
 *                                                               ↓
 *                                                        [masterGain]  ← mute
 *                                                               ↓
 *                                                        [destination]
 *
 *   [lfo]→[lfoDepth]→ bassFilter.frequency  (wobble 调制)
 */
(function (global) {
  'use strict';

  // ── AudioContext 与主节点 ──────────────────────────
  var ctx = null;
  var sumGain = null;
  var musicBusGain = null;
  var compressor = null;
  var analyser = null;
  var masterGain = null;
  var muted = false;

  // ── 持久 Bass 节点 ─────────────────────────────────
  var bassOsc = null;
  var bassOsc2 = null;
  var fmOsc = null;
  var fmGain = null;
  var subOsc = null;
  var bassFilter = null;
  var bassShaper = null;
  var bassGate = null;     // 音符包络
  var bassOutGain = null;   // bass 总音量
  var subGate = null;       // sub 音符包络（与主 Bass 同步）
  var subGain = null;       // sub 音量

  // ── LFO (Wobble) ───────────────────────────────────
  var lfo = null;
  var lfoDepth = null;

  // ── Pad 节点 ───────────────────────────────────────
  var padOsc1 = null;
  var padOsc2 = null;
  var padGain = null;
  var padTargetGain = 0.05;

  // ── 效果 (Space: delay + feedback) ─────────────────
  var delaySend = null;
  var delayNode = null;
  var feedbackGain = null;
  var delayWet = null;

  // ── 调度器 ─────────────────────────────────────────
  var isLooping = false;
  var isPaused = false;
  var timerID = null;
  var nextNoteTime = 0;
  var stepIndex = 0;          // 0-31 (2 小节 × 16 步)
  var currentBpm = 140;
  var stepDuration = 0.1071;   // 60/140/4
  var loopStartTime = 0;
  var lookahead = 25;          // ms
  var scheduleAhead = 0.12;    // seconds

  // ── 当前模式数据 ───────────────────────────────────
  var currentKickPat = [];
  var currentSnarePat = [];
  var currentHihatPat = [];
  var currentBassPat = [];
  var currentBassFreq = 55;
  var currentPadFreqs = [110, 165];
  var currentBassType = 'sawtooth';
  var currentWaveformId = 'distorted';
  var currentSynthParams = null;
  var currentGrowlVal = 0.5;   // 0-1, 用于 playBassOneShot 复用
  var currentBodyVal = 0.5;    // 0-1, 用于 Pattern one-shot 音量
  var periodicWaveCache = {};
  var sampleBank = {};
  var sampleLoadPromise = null;
  var noiseBufferCache = {};
  var currentKickSample = 'kickClean';
  var currentSnareSample = 'snareBeefy';
  var currentDrumKitId = 'brostep';
  var currentBassGatePeak = 0.56;
  var currentSubGatePeak = 0.58;

  // ── 最终歌曲播放状态 ───────────────────────────────
  var isFinalSongPlaying = false;
  var finalSongNodes = [];    // 跟踪所有一次性节点
  var finalSongEndTime = 0;
  var finalSongCompleteCb = null;
  var finalSongTimerId = null;
  var finalSongState = null;

  // ── Pattern 试听状态 ───────────────────────────────
  var isPatternPlaying = false;
  var patternNodes = [];
  var patternPlayheadCb = null;
  var patternCompleteCb = null;
  var patternTimers = [];
  var patternEndTime = 0;

  // ── 节点跟踪（用于最终歌曲和 Pattern 的清理）────────
  var currentTracking = null;
  var previewNodes = [];

  // ── 鼓组 Pattern（32 步 = 2 小节 16 分音符）────────
  var DRUM_PATTERNS = {
    halfTime: {
      bpm: 140,
      kick:  [1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0,
              1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      snare: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0,
              0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
      hihat: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0,
              0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0]
    },
    fourOnFloor: {
      bpm: 124,
      kick:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0,
              1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0,
              0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hihat: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0,
              0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0]
    },
    syncopated: {
      bpm: 145,
      kick:  [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0,
              1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0,
              0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hihat: [0,1,0,1, 0,1,0,1, 0,1,0,1, 0,1,0,1,
              0,1,0,1, 0,1,0,1, 0,1,0,1, 0,1,0,1]
    },
    breakbeat: {
      bpm: 165,
      kick:  [1,0,0,0, 0,0,0,1, 0,0,0,0, 1,0,0,0,
              1,0,0,0, 0,1,0,0, 0,0,0,0, 1,0,0,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,1,0, 0,0,0,0,
              0,0,0,0, 1,0,0,0, 0,0,1,0, 0,0,0,0],
      hihat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0,
              1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0]
    }
  };

  // Bass 节奏 Pattern（32 步，1=触发音符）
  var BASS_PATTERNS = {
    default: [
      1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0,
      1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0
    ],
    melodic: [
      1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,1,
      1,0,0,0, 0,0,1,0, 0,1,0,0, 1,0,0,0
    ]
  };

  // 每种结局使用真正不同的 2-bar Bass 语句（16 分音符网格）
  var GENRE_BASS_PHRASES = {
    riddimDubstep: {
      a: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0],
      b: [1,0,0,1, 0,0,1,0, 0,0,1,0, 0,1,0,0, 1,0,0,0, 0,1,0,0, 1,0,0,1, 0,0,1,0]
    },
    brostep: {
      a: [1,0,1,0, 0,1,0,0, 1,0,0,1, 0,0,1,0, 1,0,0,1, 0,1,0,1, 0,0,1,0, 1,0,0,1],
      b: [1,1,0,1, 0,0,1,1, 0,1,0,0, 1,0,1,0, 1,0,1,0, 1,0,0,1, 0,1,1,0, 1,0,0,1]
    },
    hybridTrap: {
      a: [1,0,0,0, 0,1,0,1, 0,0,1,0, 0,0,0,1, 1,0,0,0, 0,0,1,0, 0,1,0,0, 1,0,0,0],
      b: [1,0,0,1, 0,0,0,0, 1,0,1,0, 0,1,0,0, 1,0,0,0, 1,0,0,1, 0,0,1,0, 0,0,1,0]
    },
    bassHouse: {
      a: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
      b: [0,0,1,0, 0,1,0,0, 0,0,1,0, 0,0,0,1, 0,0,1,0, 0,0,1,0, 0,1,0,0, 0,0,1,0]
    },
    melodicDubstep: {
      a: [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,1,0],
      b: [1,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,1,0]
    },
    destinyFusion: {
      a: [1,0,0,1, 0,1,0,0, 1,0,0,0, 0,1,0,1, 1,0,0,0, 1,0,1,0, 0,0,1,0, 1,0,0,1],
      b: [1,1,0,0, 0,0,1,0, 0,1,0,1, 0,0,1,0, 1,0,1,0, 0,1,0,0, 1,0,0,1, 0,1,0,0]
    }
  };

  // 主 Bass 之外的配器层：每种结局都有不同的第二 Bass 与乐器性格。
  var GENRE_INSTRUMENTATION = {
    riddimDubstep: { bassLayer: 'vowel', chord: 'dark', lead: 'hollow' },
    brostep: { bassLayer: 'metallic', chord: 'dark', lead: 'screech' },
    hybridTrap: { bassLayer: '808', chord: 'haze', lead: 'pluck' },
    bassHouse: { bassLayer: 'donk', chord: 'stab', lead: 'pluck' },
    melodicDubstep: { bassLayer: 'reese', chord: 'supersaw', lead: 'sawLead' },
    destinyFusion: { bassLayer: 'fusion', chord: 'wide', lead: 'hollow' }
  };

  var DRUM_KITS = {
    riddimDubstep: {
      kick: 'kickTearout', kickGain: 0.62, kickRate: 0.90, kickClick: 0.018, sidechain: 0.48,
      snare: 'snareWide', snareGain: 0.52, snareRate: 0.91, snareBody: 155, clap: 0,
      hatMode: 'industrial', hatGain: 0.078, openHatGain: 0.052
    },
    brostep: {
      kick: 'kickTearout', kickGain: 0.70, kickRate: 1.03, kickClick: 0.032, sidechain: 0.54,
      snare: 'snareWide', snareGain: 0.58, snareRate: 1.04, snareBody: 205, clap: 0.07,
      hatMode: 'bright', hatGain: 0.082, openHatGain: 0.055
    },
    hybridTrap: {
      kick: 'kickClean', kickGain: 0.68, kickRate: 0.86, kickClick: 0.014, sidechain: 0.46,
      snare: 'snareBeefy', snareGain: 0.56, snareRate: 0.92, snareBody: 175, clap: 0.18,
      hatMode: 'trap', hatGain: 0.092, openHatGain: 0.058
    },
    bassHouse: {
      kick: 'kickClean', kickGain: 0.74, kickRate: 1.05, kickClick: 0.026, sidechain: 0.50,
      snare: 'snareBeefy', snareGain: 0.48, snareRate: 1.10, snareBody: 225, clap: 0.15,
      hatMode: 'house', hatGain: 0.084, openHatGain: 0.068
    },
    melodicDubstep: {
      kick: 'kickClean', kickGain: 0.58, kickRate: 0.96, kickClick: 0.012, sidechain: 0.42,
      snare: 'snareWide', snareGain: 0.46, snareRate: 0.98, snareBody: 185, clap: 0.10,
      hatMode: 'airy', hatGain: 0.072, openHatGain: 0.060
    },
    destinyFusion: {
      kick: 'kickTearout', kickGain: 0.64, kickRate: 0.98, kickClick: 0.025, sidechain: 0.50,
      kickLayer: 'kickClean', kickLayerGain: 0.20,
      snare: 'snareWide', snareGain: 0.52, snareRate: 1.00, snareBody: 190, clap: 0.09,
      snareLayer: 'snareBeefy', snareLayerGain: 0.18,
      hatMode: 'fusion', hatGain: 0.082, openHatGain: 0.060
    }
  };

  var GENRE_DRUM_GRIDS = {
    riddimDubstep: {
      kick:  [1,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,1,0],
      snare: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0], blend: false
    },
    brostep: {
      kick:  [1,0,1,0, 0,1,0,0, 0,0,1,0, 0,0,1,0],
      snare: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,1], blend: true
    },
    hybridTrap: {
      kick:  [1,0,0,0, 0,0,1,0, 0,0,0,1, 0,0,0,0],
      snare: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0], blend: true
    },
    bassHouse: {
      kick:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], blend: false
    },
    melodicDubstep: {
      kick:  [1,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,1,0],
      snare: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0], blend: false
    },
    destinyFusion: {
      kick:  [1,0,0,0, 0,0,0,1, 0,0,0,0, 1,0,0,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,1,0, 0,0,0,0], blend: true
    }
  };

  // Sound World → 频率映射
  var SW_FREQS = {
    abyss:         { bass: 55,   pad: [110, 165]    },
    neonCity:      { bass: 65.4, pad: [130.8, 196]  },
    organicForest: { bass: 73.4, pad: [146.8, 220]  },
    cosmicVoid:    { bass: 49,   pad: [98, 147]     }
  };

  // Bass Personality → 振荡器类型
  var PERSONALITY_OSC = {
    brutal: 'sawtooth',
    wobbly: 'square',
    melodic: 'triangle',
    mechanical: 'sawtooth'
  };

  // Pattern Pad 频率（用于 playPattern / previewChoice）
  var PAD_FREQS = { D: 55, F: 82.4, J: 110, K: 164.8 };
  var PAD_TYPES = { D: 'sawtooth', F: 'square', J: 'triangle', K: 'sine' };

  // ── 工具函数 ───────────────────────────────────────

  function smoothSet(param, value, tc, atTime) {
    if (!param || !ctx) return;
    param.setTargetAtTime(value, atTime || ctx.currentTime, tc || 0.015);
  }

  // 安全读取宏观参数：null/undefined → 50，但 0 保留为 0
  function macroVal(state, key) {
    if (!state || !state.bassMacros || state.bassMacros[key] == null) return 50;
    return state.bassMacros[key];
  }

  function getSynthParams(state) {
    if (state && state.synthParams) return state.synthParams;
    return {
      waveform: 'distorted', filterType: 'lowpass',
      sub: macroVal(state, 'body'), fm: macroVal(state, 'growl'),
      cutoff: 1800, resonance: 6, drive: macroVal(state, 'growl'),
      rate: 2, depth: macroVal(state, 'wobble'), space: macroVal(state, 'space')
    };
  }

  function decodeBase64(base64) {
    var binary = global.atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  function loadSampleBank() {
    if (!ctx || sampleLoadPromise || !global.DropDestinyAudioAssets) return sampleLoadPromise;
    var assets = global.DropDestinyAudioAssets;
    sampleLoadPromise = Promise.all(Object.keys(assets).map(function (id) {
      return ctx.decodeAudioData(decodeBase64(assets[id].base64).slice(0)).then(function (buffer) {
        sampleBank[id] = buffer;
      }).catch(function () {});
    }));
    return sampleLoadPromise;
  }

  function createPeriodicWaveFromSamples(id) {
    if (!ctx || !global.DropDestinyWavetables || !global.DropDestinyWavetables.tables[id]) return null;
    if (periodicWaveCache[id]) return periodicWaveCache[id];
    var samples = global.DropDestinyWavetables.tables[id];
    var harmonics = Math.min(96, Math.floor(samples.length / 2));
    var real = new Float32Array(harmonics + 1);
    var imag = new Float32Array(harmonics + 1);
    for (var harmonic = 1; harmonic <= harmonics; harmonic++) {
      var re = 0, im = 0;
      for (var i = 0; i < samples.length; i++) {
        var phase = 2 * Math.PI * harmonic * i / samples.length;
        re += samples[i] * Math.cos(phase);
        im -= samples[i] * Math.sin(phase);
      }
      real[harmonic] = re / samples.length;
      imag[harmonic] = im / samples.length;
    }
    periodicWaveCache[id] = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
    return periodicWaveCache[id];
  }

  function applyWavetable(id) {
    var wave = createPeriodicWaveFromSamples(id);
    if (!wave) return;
    currentWaveformId = id;
    if (bassOsc) bassOsc.setPeriodicWave(wave);
    if (bassOsc2) bassOsc2.setPeriodicWave(wave);
  }

  function makeDistortionCurve(amount) {
    var k = Math.max(0, amount) * 80;
    var n = 512;
    var curve = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var x = (i * 2) / n - 1;
      curve[i] = (1 + k) * x / (1 + k * Math.abs(x));
    }
    return curve;
  }

  function getBpmFromState(state) {
    var r = state.choices.rhythm;
    if (r && DRUM_PATTERNS[r]) return DRUM_PATTERNS[r].bpm;
    return 140;
  }

  function getRhythmId(state) {
    return state.choices.rhythm || 'halfTime';
  }

  // ── 初始化 AudioContext ────────────────────────────

  function ensureContext() {
    if (ctx) return ctx;
    try {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch (e) {
      return null;
    }
    return ctx;
  }

  // ── 创建持久音频图 ─────────────────────────────────

  function createGraph() {
    if (sumGain) return; // 已创建

    // 主链路：sumGain → compressor → analyser → masterGain → destination
    sumGain = ctx.createGain();
    sumGain.gain.value = 1.0;

    musicBusGain = ctx.createGain();
    musicBusGain.gain.value = 1.0;
    musicBusGain.connect(sumGain);

    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -8;
    compressor.knee.value = 18;
    compressor.ratio.value = 4.5;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.13;

    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;

    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : 0.35;

    sumGain.connect(compressor);
    compressor.connect(analyser);
    analyser.connect(masterGain);
    masterGain.connect(ctx.destination);

    // ── Bass 链 ──
    bassOsc = ctx.createOscillator();
    bassOsc.type = 'sawtooth';
    bassOsc.frequency.value = 55;

    bassOsc2 = ctx.createOscillator();
    bassOsc2.type = 'sawtooth';
    bassOsc2.frequency.value = 55;
    bassOsc2.detune.value = -7;

    fmOsc = ctx.createOscillator();
    fmOsc.type = 'sine';
    fmOsc.frequency.value = 110;

    fmGain = ctx.createGain();
    fmGain.gain.value = 0;
    fmOsc.connect(fmGain);
    fmGain.connect(bassOsc.frequency);
    fmGain.connect(bassOsc2.frequency);

    bassFilter = ctx.createBiquadFilter();
    bassFilter.type = 'lowpass';
    bassFilter.frequency.value = 1200;
    bassFilter.Q.value = 3;

    bassShaper = ctx.createWaveShaper();
    bassShaper.curve = makeDistortionCurve(0.5);
    bassShaper.oversample = '2x';

    bassGate = ctx.createGain();
    bassGate.gain.value = 0;

    bassOutGain = ctx.createGain();
    bassOutGain.gain.value = 0.075;

    bassOsc.connect(bassFilter);
    bassOsc2.connect(bassFilter);
    bassFilter.connect(bassShaper);
    bassShaper.connect(bassGate);
    bassGate.connect(bassOutGain);
    bassOutGain.connect(musicBusGain);

    // ── Sub 链 ──
    subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.value = 27.5; // 比 bass 低八度

    subGate = ctx.createGain();
    subGate.gain.value = 0;

    subGain = ctx.createGain();
    subGain.gain.value = 0.075;

    subOsc.connect(subGate);
    subGate.connect(subGain);
    subGain.connect(musicBusGain);

    // ── LFO (Wobble) ──
    lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 2.33; // ~140 BPM 四分音符

    lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0; // 默认无调制

    lfo.connect(lfoDepth);
    lfoDepth.connect(bassFilter.frequency);

    // ── Pad 链 ──
    padOsc1 = ctx.createOscillator();
    padOsc1.type = 'sine';
    padOsc1.frequency.value = 110;

    padOsc2 = ctx.createOscillator();
    padOsc2.type = 'triangle';
    padOsc2.frequency.value = 165;

    padGain = ctx.createGain();
    padGain.gain.value = 0;

    padOsc1.connect(padGain);
    padOsc2.connect(padGain);
    padGain.connect(musicBusGain);

    // ── Delay / Feedback (Space) ──
    delaySend = ctx.createGain();
    delaySend.gain.value = 0;

    delayNode = ctx.createDelay(1.0);
    delayNode.delayTime.value = 0.3;

    feedbackGain = ctx.createGain();
    feedbackGain.gain.value = 0.3;

    delayWet = ctx.createGain();
    delayWet.gain.value = 0.6;

    padGain.connect(delaySend);
    bassOutGain.connect(delaySend);
    delaySend.connect(delayNode);
    delayNode.connect(feedbackGain);
    feedbackGain.connect(delayNode); // 反馈回路
    delayNode.connect(delayWet);
    delayWet.connect(musicBusGain);

    // 启动持久振荡器
    bassOsc.start();
    bassOsc2.start();
    fmOsc.start();
    subOsc.start();
    lfo.start();
    padOsc1.start();
    padOsc2.start();
    applyWavetable(currentWaveformId);
    loadSampleBank();
  }

  // ── 销毁持久音频图 ─────────────────────────────────

  function destroyGraph() {
    var persistentNodes = [
      bassOsc, bassOsc2, fmOsc, subOsc, lfo, padOsc1, padOsc2
    ];
    var allNodes = [
      bassOsc, bassOsc2, fmOsc, fmGain, bassFilter, bassShaper, bassGate, bassOutGain,
      subOsc, subGate, subGain,
      lfo, lfoDepth,
      padOsc1, padOsc2, padGain,
      delaySend, delayNode, feedbackGain, delayWet,
      musicBusGain, sumGain, compressor, analyser, masterGain
    ];

    for (var i = 0; i < persistentNodes.length; i++) {
      var n = persistentNodes[i];
      if (n) { try { n.stop(); } catch (e) {} }
    }
    for (var j = 0; j < allNodes.length; j++) {
      var m = allNodes[j];
      if (m) { try { m.disconnect(); } catch (e) {} }
    }

    bassOsc = null; bassOsc2 = null; fmOsc = null; fmGain = null;
    bassFilter = null; bassShaper = null;
    bassGate = null; bassOutGain = null;
    subOsc = null; subGate = null; subGain = null;
    lfo = null; lfoDepth = null;
    padOsc1 = null; padOsc2 = null; padGain = null;
    delaySend = null; delayNode = null; feedbackGain = null; delayWet = null;
    musicBusGain = null; sumGain = null; compressor = null; analyser = null; masterGain = null;
    periodicWaveCache = {};
    sampleBank = {};
    sampleLoadPromise = null;
    noiseBufferCache = {};
  }

  // ── 鼓组采样 + 合成回退 ────────────────────────────

  function playSample(id, time, gainValue, playbackRate, offset, duration) {
    if (!ctx || !sumGain || !sampleBank[id]) return null;
    var source = ctx.createBufferSource();
    var gain = ctx.createGain();
    source.buffer = sampleBank[id];
    source.playbackRate.value = playbackRate || 1;
    gain.gain.value = gainValue == null ? 0.7 : gainValue;
    source.connect(gain);
    gain.connect(sumGain);
    if (duration != null) source.start(time, offset || 0, duration);
    else source.start(time, offset || 0);
    if (currentTracking) currentTracking.push(source, gain);
    return source;
  }

  function sidechainAt(time, amount) {
    if (!musicBusGain) return;
    var floor = Math.max(0.32, 1 - (amount || 0.5));
    if (time <= ctx.currentTime + 0.2) musicBusGain.gain.cancelScheduledValues(time);
    musicBusGain.gain.setValueAtTime(1, time);
    musicBusGain.gain.linearRampToValueAtTime(floor, time + 0.008);
    musicBusGain.gain.exponentialRampToValueAtTime(1, time + 0.17);
  }

  function getDrumKit() {
    return DRUM_KITS[currentDrumKitId] || DRUM_KITS.brostep;
  }

  function playKick(time) {
    if (!ctx || !sumGain) return;
    var t = time || ctx.currentTime;
    var kit = getDrumKit();
    var kickId = kit.kick || currentKickSample;
    if (sampleBank[kickId]) {
      playSample(kickId, t, kit.kickGain, kit.kickRate || 1);
      if (kit.kickLayer && sampleBank[kit.kickLayer]) {
        playSample(kit.kickLayer, t, kit.kickLayerGain || 0.18, 1.04);
      }
    } else {
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(0.01, t + 0.3);
      g.gain.setValueAtTime(0.42, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(g);
      g.connect(sumGain);
      osc.start(t);
      osc.stop(t + 0.35);
      if (currentTracking) currentTracking.push(osc, g);
    }

    if (kit.kickClick) {
      var click = ctx.createOscillator();
      var clickGain = ctx.createGain();
      click.type = 'sine';
      click.frequency.setValueAtTime(currentDrumKitId === 'bassHouse' ? 2100 : 1550, t);
      click.frequency.exponentialRampToValueAtTime(180, t + 0.028);
      clickGain.gain.setValueAtTime(kit.kickClick, t);
      clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
      click.connect(clickGain); clickGain.connect(sumGain);
      click.start(t); click.stop(t + 0.045);
      if (currentTracking) currentTracking.push(click, clickGain);
    }
    sidechainAt(t, kit.sidechain == null ? 0.48 : kit.sidechain);
  }

  function playSnare(time) {
    if (!ctx || !sumGain) return;
    var t = time || ctx.currentTime;
    var kit = getDrumKit();
    var snareId = kit.snare || currentSnareSample;
    if (sampleBank[snareId]) {
      playSample(snareId, t, kit.snareGain, kit.snareRate || 1);
      if (kit.snareLayer && sampleBank[kit.snareLayer]) {
        playSample(kit.snareLayer, t + 0.006, kit.snareLayerGain || 0.16, 1.03);
      }
      if (kit.clap && sampleBank.clapFat) playSample('clapFat', t + 0.009, kit.clap, 1.02);
    } else {
      var dur = 0.15;
      var src = ctx.createBufferSource();
      src.buffer = getNoiseBuffer(dur);
      var noiseGain = ctx.createGain();
      var noiseFilter = ctx.createBiquadFilter();
      noiseGain.gain.setValueAtTime(0.18, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      noiseFilter.type = 'highpass'; noiseFilter.frequency.value = 1000;
      src.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(sumGain);
      src.start(t); src.stop(t + dur + 0.02);
      if (currentTracking) currentTracking.push(src, noiseGain, noiseFilter);
    }

    var body = ctx.createOscillator();
    var bodyGain = ctx.createGain();
    body.type = 'triangle';
    body.frequency.setValueAtTime(kit.snareBody || 185, t);
    body.frequency.exponentialRampToValueAtTime(Math.max(90, (kit.snareBody || 185) * 0.68), t + 0.11);
    bodyGain.gain.setValueAtTime(currentDrumKitId === 'melodicDubstep' ? 0.025 : 0.04, t);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    body.connect(bodyGain); bodyGain.connect(sumGain);
    body.start(t); body.stop(t + 0.16);
    if (currentTracking) currentTracking.push(body, bodyGain);
  }

  function playHihat(time, gainVal) {
    if (!ctx || !sumGain) return;
    var t = time || ctx.currentTime;
    var kit = getDrumKit();
    var mode = kit.hatMode || 'bright';
    var dur = mode === 'airy' ? 0.12 : (mode === 'house' ? 0.085 : (mode === 'trap' ? 0.042 : 0.06));
    var src = ctx.createBufferSource();
    var highpass = ctx.createBiquadFilter();
    var bandpass = ctx.createBiquadFilter();
    var gain = ctx.createGain();
    var peak = gainVal == null ? kit.hatGain : Math.max(kit.hatGain * 0.72, gainVal);
    src.buffer = getNoiseBuffer(dur);
    highpass.type = 'highpass';
    highpass.frequency.value = mode === 'airy' ? 4700 : (mode === 'house' ? 5400 : 6800);
    bandpass.type = 'bandpass';
    bandpass.frequency.value = mode === 'trap' ? 10800 : (mode === 'industrial' ? 8800 : 7600);
    bandpass.Q.value = mode === 'airy' ? 0.7 : 1.25;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(highpass); highpass.connect(bandpass); bandpass.connect(gain); gain.connect(sumGain);
    src.start(t);
    src.stop(t + dur + 0.015);

    var nodes = [src, highpass, bandpass, gain];
    if (mode === 'industrial' || mode === 'fusion') {
      var metal1 = ctx.createOscillator();
      var metal2 = ctx.createOscillator();
      var metalGain = ctx.createGain();
      metal1.type = 'square'; metal2.type = 'square';
      metal1.frequency.value = mode === 'industrial' ? 6700 : 5900;
      metal2.frequency.value = mode === 'industrial' ? 9300 : 10400;
      metalGain.gain.value = 0.10;
      metal1.connect(metalGain); metal2.connect(metalGain); metalGain.connect(highpass);
      metal1.start(t); metal2.start(t);
      metal1.stop(t + dur); metal2.stop(t + dur);
      nodes.push(metal1, metal2, metalGain);
    }
    if (currentTracking) Array.prototype.push.apply(currentTracking, nodes);
  }

  function playImpact(time, gainValue) {
    if (sampleBank.impactDeep) playSample('impactDeep', time, gainValue == null ? 0.92 : gainValue, 1);
    else {
      playTom(time, 48, 0.19);
      playCrash(time, 0.055);
    }
  }

  function playRiser(startTime, targetDuration) {
    var buffer = sampleBank.riser140;
    if (!buffer) {
      playReverseSwell(startTime, targetDuration, 0.06);
      return;
    }
    var sourceSegment = Math.min(6.86, buffer.duration);
    var rate = sourceSegment / Math.max(0.25, targetDuration);
    playSample('riser140', startTime, 0.28, rate, Math.max(0, buffer.duration - sourceSegment), sourceSegment);
  }

  function getNoiseBuffer(duration) {
    if (!ctx) return null;
    var key = Math.max(1, Math.round(duration * 1000));
    if (noiseBufferCache[key]) return noiseBufferCache[key];
    var length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    var buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    var channel = buffer.getChannelData(0);
    for (var i = 0; i < length; i++) channel[i] = Math.random() * 2 - 1;
    noiseBufferCache[key] = buffer;
    return buffer;
  }

  function playOpenHat(time, gainValue) {
    if (!ctx || !sumGain) return;
    var t = time || ctx.currentTime;
    var kit = getDrumKit();
    var duration = currentDrumKitId === 'melodicDubstep' ? 0.46 : (currentDrumKitId === 'bassHouse' ? 0.34 : 0.28);
    var source = ctx.createBufferSource();
    var highpass = ctx.createBiquadFilter();
    var bandpass = ctx.createBiquadFilter();
    var gain = ctx.createGain();
    source.buffer = getNoiseBuffer(duration);
    highpass.type = 'highpass';
    highpass.frequency.value = currentDrumKitId === 'melodicDubstep' ? 4500 : 5600;
    highpass.Q.value = 0.8;
    bandpass.type = 'bandpass';
    bandpass.frequency.value = currentDrumKitId === 'bassHouse' ? 7200 : 8400;
    bandpass.Q.value = 0.75;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(gainValue == null ? kit.openHatGain : Math.max(gainValue, kit.openHatGain * 0.78), t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    source.connect(highpass);
    highpass.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(sumGain);
    source.start(t);
    source.stop(t + duration + 0.02);
    if (currentTracking) currentTracking.push(source, highpass, bandpass, gain);
  }

  function playCrash(time, gainValue) {
    if (!ctx || !sumGain) return;
    var t = time || ctx.currentTime;
    var duration = 1.15;
    var source = ctx.createBufferSource();
    var highpass = ctx.createBiquadFilter();
    var bandpass = ctx.createBiquadFilter();
    var gain = ctx.createGain();
    source.buffer = getNoiseBuffer(duration);
    highpass.type = 'highpass';
    highpass.frequency.value = 3400;
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(8200, t);
    bandpass.frequency.exponentialRampToValueAtTime(4700, t + duration);
    bandpass.Q.value = 0.45;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(gainValue == null ? 0.085 : gainValue, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    source.connect(highpass);
    highpass.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(sumGain);
    source.start(t);
    source.stop(t + duration + 0.03);
    if (currentTracking) currentTracking.push(source, highpass, bandpass, gain);
  }

  function playTom(time, frequency, gainValue) {
    if (!ctx || !sumGain) return;
    var t = time || ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    var freq = Math.max(55, frequency || 110);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.9, t);
    osc.frequency.exponentialRampToValueAtTime(freq, t + 0.11);
    gain.gain.setValueAtTime(gainValue == null ? 0.16 : gainValue, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(gain);
    gain.connect(sumGain);
    osc.start(t);
    osc.stop(t + 0.32);
    if (currentTracking) currentTracking.push(osc, gain);
  }

  function playReverseSwell(startTime, duration, gainValue) {
    if (!ctx || !musicBusGain) return;
    var t = startTime || ctx.currentTime;
    var d = Math.max(0.2, duration || 0.8);
    var source = ctx.createBufferSource();
    var bandpass = ctx.createBiquadFilter();
    var gain = ctx.createGain();
    source.buffer = getNoiseBuffer(d);
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(500, t);
    bandpass.frequency.exponentialRampToValueAtTime(6500, t + d);
    bandpass.Q.value = 1.2;
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(gainValue == null ? 0.075 : gainValue, t + d * 0.88);
    gain.gain.linearRampToValueAtTime(0, t + d);
    source.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(musicBusGain);
    source.start(t);
    source.stop(t + d + 0.02);
    if (currentTracking) currentTracking.push(source, bandpass, gain);
  }

  // ── Bass 音符触发 ──────────────────────────────────

  function triggerBassNote(time, duration) {
    if (!bassGate || !ctx) return;
    var d = Math.max(0.03, duration);
    scheduleGateEnvelope(bassGate.gain, time, d, currentBassGatePeak);
    if (subGate) scheduleGateEnvelope(subGate.gain, time, d, currentSubGatePeak);
  }

  function scheduleBassPitch(freq, time) {
    if (bassOsc) smoothSet(bassOsc.frequency, freq, 0.004, time);
    if (bassOsc2) smoothSet(bassOsc2.frequency, freq, 0.004, time);
    if (subOsc) smoothSet(subOsc.frequency, Math.max(24.5, freq / 2), 0.004, time);
    if (fmOsc) smoothSet(fmOsc.frequency, freq * 2, 0.004, time);
  }

  function scheduleGateEnvelope(param, time, duration, peak) {
    param.cancelScheduledValues(time);
    param.setValueAtTime(0, time);
    param.linearRampToValueAtTime(peak, time + 0.005);
    param.setValueAtTime(peak, time + duration - 0.015);
    param.linearRampToValueAtTime(0, time + duration);
  }

  // ── 调度器 ─────────────────────────────────────────

  function scheduler() {
    if (!ctx || !isLooping || isPaused) return;
    while (nextNoteTime < ctx.currentTime + scheduleAhead) {
      scheduleStep(stepIndex, nextNoteTime);
      nextNoteTime += stepDuration;
      stepIndex = (stepIndex + 1) % 32;
    }
    timerID = setTimeout(scheduler, lookahead);
  }

  function scheduleStep(step, time) {
    // Kick
    if (currentKickPat[step]) {
      playKick(time);
    }
    // Snare
    if (currentSnarePat[step]) {
      playSnare(time);
    }
    // Hi-hat
    var hh = currentHihatPat[step];
    if (hh) {
      var loopHatGain = getDrumKit().hatGain;
      playHihat(time, hh >= 1 ? loopHatGain : loopHatGain * (0.45 + hh));
    }
    // Bass
    if (currentBassPat[step]) {
      triggerBassNote(time, stepDuration * 2);
    }
  }

  function startLoop(state) {
    if (isLooping) return;
    createGraph();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    // 初始化模式
    updateDrumPattern(state);
    updateBassParams(state);
    updatePadParams(state);
    updateEffects(state);

    // 启动调度器
    currentBpm = getBpmFromState(state);
    stepDuration = (60 / currentBpm) / 4;
    nextNoteTime = ctx.currentTime + 0.1;
    loopStartTime = nextNoteTime;
    stepIndex = 0;
    isLooping = true;
    isPaused = false;

    // Pad 淡入
    smoothSet(padGain.gain, padTargetGain, 0.1);

    scheduler();
  }

  function stopLoop() {
    if (timerID) { clearTimeout(timerID); timerID = null; }
    isLooping = false;
    isPaused = false;
    // 淡出持久声音
    if (padGain) smoothSet(padGain.gain, 0, 0.05);
    if (bassGate) smoothSet(bassGate.gain, 0, 0.02);
    if (subGate) smoothSet(subGate.gain, 0, 0.02);
  }

  // ── applyState：实时参数映射 ───────────────────────

  function applyState(state) {
    if (!ctx || !isLooping) return;
    if (!state) return;

    // BPM 变化
    var newBpm = getBpmFromState(state);
    if (newBpm !== currentBpm) {
      currentBpm = newBpm;
      stepDuration = (60 / currentBpm) / 4;
      // 更新 LFO 速率
      updateLfoRate(state);
    }

    updateDrumPattern(state);
    updateBassParams(state);
    updatePadParams(state);
    updateEffects(state);
  }

  // ── 鼓组 Pattern 更新 ──────────────────────────────

  function updateDrumPattern(state) {
    var rId = getRhythmId(state);
    var pat = DRUM_PATTERNS[rId] || DRUM_PATTERNS.halfTime;

    currentKickPat = pat.kick.slice();
    currentSnarePat = pat.snare.slice();

    // 密度影响 Hi-hat — 每种密度对每种节奏都产生稳定可听的差异
    var density = (state.groove && state.groove.density != null) ? state.groove.density : 1;
    currentHihatPat = applyHihatDensity(pat.hihat, density, rId);

    // Bass Pattern
    var personality = state.choices.bassPersonality;
    currentDrumKitId = rId === 'fourOnFloor' ? 'bassHouse' :
      (rId === 'syncopated' ? 'hybridTrap' : (rId === 'breakbeat' ? 'destinyFusion' :
        (personality === 'melodic' ? 'melodicDubstep' : (personality === 'mechanical' ? 'riddimDubstep' : 'brostep'))));
    var loopKit = getDrumKit();
    currentKickSample = loopKit.kick;
    currentSnareSample = loopKit.snare;
    currentBassGatePeak = personality === 'melodic' ? 0.40 : 0.50;
    currentSubGatePeak = personality === 'melodic' ? 0.43 : 0.52;
    if (personality === 'melodic') {
      currentBassPat = BASS_PATTERNS.melodic;
    } else {
      currentBassPat = BASS_PATTERNS.default;
    }
  }

  // 在任何节奏中都保持可听差异：Sparse 从原 hits 抽样，Busy 向空位添加 ghost hits。
  function applyHihatDensity(baseHihat, density, rhythmId) {
    var base = baseHihat.slice();
    if (density === 1) return base;

    var active = [];
    for (var i = 0; i < base.length; i++) {
      if (base[i]) active.push(i);
    }

    if (density === 0) {
      var sparse = new Array(base.length).fill(0);
      if (active.length === 0) {
        sparse[2] = sparse[10] = sparse[18] = sparse[26] = 1;
        return sparse;
      }
      var keepCount = Math.min(active.length, Math.max(4, Math.ceil(active.length * 0.35)));
      for (var k = 0; k < keepCount; k++) {
        var activeIndex = Math.min(active.length - 1, Math.floor(k * active.length / keepCount));
        var step = active[activeIndex];
        sparse[step] = base[step];
      }
      return sparse;
    }

    var busy = base.slice();
    var candidates = [];
    var preferredParity = rhythmId === 'syncopated' ? 0 : 1;
    for (var c = 0; c < busy.length; c++) {
      if (!busy[c] && c % 2 === preferredParity) candidates.push(c);
    }
    for (var c2 = 0; c2 < busy.length; c2++) {
      if (!busy[c2] && candidates.indexOf(c2) < 0) candidates.push(c2);
    }
    var addCount = Math.min(candidates.length, Math.max(4, Math.ceil(active.length * 0.5)));
    for (var g = 0; g < addCount; g++) {
      var candidateIndex = Math.min(candidates.length - 1, Math.floor(g * candidates.length / addCount));
      busy[candidates[candidateIndex]] = g % 2 === 0 ? 0.28 : 0.18;
    }
    return busy;
  }

  // ── Bass 参数更新 ──────────────────────────────────

  function updateBassParams(state) {
    if (!bassOsc || !ctx) return;

    var synth = getSynthParams(state);
    currentSynthParams = Object.assign({}, synth);
    var sub = synth.sub / 100;
    var fm = synth.fm / 100;
    var drive = synth.drive / 100;
    var depth = synth.depth / 100;

    // 振荡器频率
    var sw = state.choices.soundWorld;
    var freqs = SW_FREQS[sw] || SW_FREQS.abyss;
    currentPadFreqs = freqs.pad.slice();
    // 始终恢复基准音高：最终编排会自动化到不同和弦根音，缓存值不足以判断实际 AudioParam。
    currentBassFreq = freqs.bass;
    smoothSet(bassOsc.frequency, currentBassFreq, 0.01);
    smoothSet(bassOsc2.frequency, currentBassFreq, 0.01);
    smoothSet(subOsc.frequency, Math.max(24.5, currentBassFreq / 2), 0.01);
    smoothSet(fmOsc.frequency, currentBassFreq * 2, 0.01);

    if (synth.waveform !== currentWaveformId) applyWavetable(synth.waveform);

    // Sub 与中频层独立控制
    currentBodyVal = sub;
    smoothSet(subGain.gain, 0.012 + sub * 0.16, 0.02);
    smoothSet(bassOutGain.gain, 0.055 + drive * 0.045, 0.02);

    // Wavetable FM + Filter + Drive
    currentGrowlVal = Math.min(1, fm * 0.45 + drive * 0.55);
    smoothSet(fmGain.gain, Math.pow(fm, 1.35) * currentBassFreq * 16, 0.025);
    bassFilter.type = synth.filterType || 'lowpass';
    smoothSet(bassFilter.frequency, synth.cutoff, 0.025);
    smoothSet(bassFilter.Q, synth.resonance, 0.025);
    bassShaper.curve = makeDistortionCurve(drive * 1.25);

    // BPM 同步 Wobble
    updateLfoRate(state);
    smoothSet(lfoDepth.gain, Math.pow(depth, 1.35) * Math.min(3600, synth.cutoff * 0.88), 0.02);
  }

  function updateLfoRate(state) {
    if (!lfo || !ctx) return;
    var synth = getSynthParams(state);
    var beatRate = currentBpm / 60;
    var multipliers = [0.5, 1, 2, 3, 4];
    var lfoRate = beatRate * multipliers[Math.max(0, Math.min(4, Math.round(synth.rate)))];
    smoothSet(lfo.frequency, lfoRate, 0.03);
  }

  // ── Pad 参数更新 ───────────────────────────────────

  function updatePadParams(state) {
    if (!padOsc1 || !ctx) return;

    var sw = state.choices.soundWorld;
    var freqs = SW_FREQS[sw] || SW_FREQS.abyss;

    // 最终编排会让 Pad 跟随和弦，因此每次应用状态都明确恢复 Sound World 基准音高。
    smoothSet(padOsc1.frequency, freqs.pad[0], 0.05);
    smoothSet(padOsc2.frequency, freqs.pad[1], 0.05);

    // Space 影响 pad 音量
    var space = getSynthParams(state).space / 100;
    padTargetGain = 0.02 + space * 0.06;
    if (!isPaused) {
      smoothSet(padGain.gain, padTargetGain, 0.05);
    }
  }

  // ── 效果参数更新 ───────────────────────────────────

  function updateEffects(state) {
    if (!delaySend || !ctx) return;

    var space = getSynthParams(state).space / 100;

    // Space → Delay send + feedback
    smoothSet(delaySend.gain, space * 0.32, 0.03);
    smoothSet(feedbackGain.gain, 0.12 + space * 0.32, 0.03);

    // Delay time 同步到 BPM
    var beatDur = 60 / currentBpm;
    smoothSet(delayNode.delayTime, beatDur * 0.75, 0.05);
  }

  // ── 公共接口 ───────────────────────────────────────

  function start(state) {
    ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    // 只有选择了 Sound World 后才启动 Loop
    if (!state || !state.choices || !state.choices.soundWorld) {
      return;
    }

    if (!isLooping) {
      startLoop(state);
    } else if (isPaused) {
      // 从暂停中恢复
      setPaused(false);
      applyState(state);
    } else {
      applyState(state);
    }
  }

  function previewChoice(phase, optionId) {
    ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    stopPreview();
    var previousTracking = currentTracking;
    currentTracking = previewNodes;

    if (phase === 'rhythm') {
      // 节奏预览：播放 2 拍 kick/snare
      currentDrumKitId = optionId === 'fourOnFloor' ? 'bassHouse' :
        (optionId === 'syncopated' ? 'hybridTrap' : (optionId === 'breakbeat' ? 'destinyFusion' : 'brostep'));
      var bpm = (DRUM_PATTERNS[optionId] || DRUM_PATTERNS.halfTime).bpm;
      var beatDur = 60 / bpm;
      var t = ctx.currentTime;
      playKick(t);
      playKick(t + beatDur);
      playSnare(t + beatDur * 0.5);
      playHihat(t + beatDur * 0.25);
      playHihat(t + beatDur * 0.75);
    } else if (phase === 'drop') {
      previewDropIntensity(optionId);
    } else if (phase === 'soundWorld' || phase === 'bassPersonality') {
      var freqMap = {
        soundWorld: { abyss: 55, neonCity: 440, organicForest: 220, cosmicVoid: 110 },
        bassPersonality: { brutal: 82, wobbly: 110, melodic: 165, mechanical: 138 }
      };
      var f = (freqMap[phase] && freqMap[phase][optionId]) || 220;
      if (phase === 'bassPersonality' && bassShaper) {
        playBassOneShot(f, 0.42, 0.14);
        var previewModes = { brutal: 'metallic', wobbly: 'vowel', melodic: 'reese', mechanical: 'donk' };
        playBassLayer(f * (optionId === 'brutal' ? 0.75 : 0.5), 0.36, previewModes[optionId] || 'reese', 0.032, ctx.currentTime + 0.04);
      } else playOneShot(f, 0.3, 'sine', 0.15);
    }
    currentTracking = previousTracking;
  }

  function stopPreview() {
    for (var i = 0; i < previewNodes.length; i++) {
      var node = previewNodes[i];
      try { if (node.stop) node.stop(); } catch (e) {}
      try { node.disconnect(); } catch (e) {}
    }
    previewNodes = [];
  }

  function playOneShot(freq, duration, type, gainVal, startTime) {
    if (!ctx || !sumGain) return;
    var t = startTime || ctx.currentTime;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gainVal == null ? 0.15 : gainVal, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(g);
    g.connect(musicBusGain || sumGain);
    osc.start(t);
    osc.stop(t + duration + 0.05);
    if (currentTracking) { currentTracking.push(osc, g); }
  }

  function playChord(root, time, duration, gainValue, quality, character) {
    if (!ctx || !musicBusGain) return;
    var t = time || ctx.currentTime;
    var d = Math.max(0.08, duration || 0.5);
    var tone = character || 'haze';
    var semitones = quality === 'major' ? [0, 4, 7, 12, 14] : [0, 3, 7, 10, 14];
    if (tone === 'dark') semitones = semitones.slice(0, 4);
    if (tone === 'stab') semitones = semitones.slice(0, 4);

    var filter = ctx.createBiquadFilter();
    var chordGain = ctx.createGain();
    var voiceCount = semitones.length * (tone === 'supersaw' ? 2 : 1);
    var peak = (gainValue == null ? 0.04 : gainValue) / Math.max(2.4, voiceCount);
    var attack = tone === 'stab' ? 0.004 : (tone === 'supersaw' ? 0.055 : (tone === 'wide' ? 0.045 : 0.025));
    var releaseStart = Math.max(t + attack + 0.01, t + d * (tone === 'stab' ? 0.42 : 0.82));
    var cutoff = tone === 'supersaw' ? 6800 : (tone === 'wide' ? 5200 : (tone === 'stab' ? 3100 : (tone === 'dark' ? 1250 : 2400)));

    filter.type = 'lowpass';
    filter.Q.value = tone === 'stab' ? 3.2 : (tone === 'supersaw' ? 0.75 : 1.1);
    filter.frequency.setValueAtTime(tone === 'stab' ? Math.min(7000, cutoff * 1.8) : cutoff, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(320, cutoff * (tone === 'stab' ? 0.34 : 0.72)), t + d);
    chordGain.gain.setValueAtTime(0.0001, t);
    chordGain.gain.linearRampToValueAtTime(peak, t + attack);
    chordGain.gain.setValueAtTime(peak, releaseStart);
    chordGain.gain.exponentialRampToValueAtTime(0.001, t + d);
    filter.connect(chordGain);
    chordGain.connect(musicBusGain);
    if (delaySend && tone !== 'dark') chordGain.connect(delaySend);

    var detunes = [-8, 6, -3, 9, 0];
    var nodes = [filter, chordGain];
    for (var i = 0; i < semitones.length; i++) {
      var copies = tone === 'supersaw' ? 2 : 1;
      for (var copy = 0; copy < copies; copy++) {
        var osc = ctx.createOscillator();
        if (tone === 'supersaw') osc.type = 'sawtooth';
        else if (tone === 'dark') osc.type = i < 2 ? 'triangle' : 'sine';
        else if (tone === 'stab') osc.type = i % 2 ? 'square' : 'sawtooth';
        else osc.type = i % 2 ? 'triangle' : 'sawtooth';
        osc.frequency.value = root * Math.pow(2, semitones[i] / 12);
        osc.detune.value = tone === 'supersaw' ? (copy ? 13 + i : -13 - i) : detunes[i % detunes.length];
        osc.connect(filter);
        osc.start(t);
        osc.stop(t + d + 0.06);
        nodes.push(osc);
      }
    }
    if (currentTracking) Array.prototype.push.apply(currentTracking, nodes);
  }

  function playLeadNote(freq, time, duration, gainValue, character) {
    if (!ctx || !musicBusGain) return;
    var t = time || ctx.currentTime;
    var d = Math.max(0.06, duration || 0.25);
    var tone = character || 'anthem';
    var filter = ctx.createBiquadFilter();
    var gain = ctx.createGain();
    var osc1 = ctx.createOscillator();
    var osc2 = ctx.createOscillator();
    var osc3 = null;
    var peak = gainValue == null ? 0.04 : gainValue;
    if (tone === 'sawLead') peak *= 0.72;
    var attack = tone === 'pluck' || tone === 'screech' ? 0.004 : 0.018;

    if (tone === 'hollow') {
      osc1.type = 'triangle'; osc2.type = 'sine';
      filter.type = 'bandpass'; filter.frequency.value = Math.max(700, Math.min(2600, freq * 3.2)); filter.Q.value = 3.5;
    } else if (tone === 'screech') {
      osc1.type = 'sawtooth'; osc2.type = 'square';
      filter.type = 'bandpass'; filter.frequency.value = Math.max(1600, Math.min(5600, freq * 4.5)); filter.Q.value = 5.5;
    } else if (tone === 'sawLead') {
      osc1.type = 'sawtooth'; osc2.type = 'sawtooth';
      osc3 = ctx.createOscillator(); osc3.type = 'sawtooth';
      filter.type = 'lowpass'; filter.frequency.value = 7200; filter.Q.value = 1.1;
    } else {
      osc1.type = tone === 'pluck' ? 'triangle' : 'sawtooth';
      osc2.type = tone === 'pluck' ? 'sine' : 'triangle';
      filter.type = 'lowpass'; filter.frequency.value = tone === 'pluck' ? 3600 : 6200; filter.Q.value = tone === 'pluck' ? 2.6 : 1.2;
    }
    osc1.frequency.value = freq;
    osc2.frequency.value = tone === 'screech' ? freq * 2 : freq;
    osc1.detune.value = tone === 'sawLead' ? -8 : -5;
    osc2.detune.value = tone === 'sawLead' ? 8 : 7;
    if (osc3) { osc3.frequency.value = freq; osc3.detune.value = 0; }
    filter.frequency.setValueAtTime(filter.frequency.value, t);
    if (tone === 'pluck') filter.frequency.exponentialRampToValueAtTime(650, t + d);
    if (tone === 'screech') filter.frequency.exponentialRampToValueAtTime(Math.max(900, freq * 2), t + d);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peak, t + attack);
    if (tone === 'pluck' || tone === 'screech') {
      gain.gain.exponentialRampToValueAtTime(0.001, t + Math.min(d, tone === 'pluck' ? 0.42 : 0.28));
    } else {
      gain.gain.setValueAtTime(peak * 0.78, t + d * 0.7);
      gain.gain.exponentialRampToValueAtTime(0.001, t + d);
    }
    osc1.connect(filter);
    osc2.connect(filter);
    if (osc3) osc3.connect(filter);
    filter.connect(gain);
    gain.connect(musicBusGain);
    if (delaySend && tone !== 'screech') gain.connect(delaySend);
    osc1.start(t); osc2.start(t);
    if (osc3) osc3.start(t);
    osc1.stop(t + d + 0.05); osc2.stop(t + d + 0.05);
    if (osc3) osc3.stop(t + d + 0.05);
    if (currentTracking) {
      currentTracking.push(osc1, osc2, filter, gain);
      if (osc3) currentTracking.push(osc3);
    }
  }

  function playBassLayer(freq, duration, mode, gainValue, startTime, glideTo) {
    if (!ctx || !musicBusGain) return;
    var t = startTime || ctx.currentTime;
    var d = Math.max(0.08, duration || 0.3);
    var tone = mode || 'reese';
    var filter = ctx.createBiquadFilter();
    var shaper = ctx.createWaveShaper();
    var gain = ctx.createGain();
    var osc1 = ctx.createOscillator();
    var osc2 = ctx.createOscillator();
    var mod = null;
    var modGain = null;
    var peak = gainValue == null ? 0.052 : gainValue;
    var targetFreq = Math.max(20, glideTo || freq);

    if (tone === 'metallic') {
      var fmWave = createPeriodicWaveFromSamples('fmRazor');
      if (fmWave) osc1.setPeriodicWave(fmWave); else osc1.type = 'sawtooth';
      osc2.type = 'square';
      osc1.frequency.value = freq; osc2.frequency.value = freq * 1.5;
      osc2.detune.value = 11;
      mod = ctx.createOscillator(); modGain = ctx.createGain();
      mod.type = 'sine'; mod.frequency.value = freq * 3;
      modGain.gain.value = freq * 7.5;
      mod.connect(modGain); modGain.connect(osc1.frequency);
      filter.type = 'bandpass'; filter.Q.value = 7.5;
      filter.frequency.setValueAtTime(Math.max(620, freq * 7), t);
      filter.frequency.exponentialRampToValueAtTime(Math.max(1500, freq * 17), t + d);
      shaper.curve = makeDistortionCurve(0.78);
    } else if (tone === 'vowel') {
      var vocalWave = createPeriodicWaveFromSamples('vocal');
      if (vocalWave) { osc1.setPeriodicWave(vocalWave); osc2.setPeriodicWave(vocalWave); }
      else { osc1.type = 'sawtooth'; osc2.type = 'square'; }
      osc1.frequency.value = freq; osc2.frequency.value = freq * 2;
      osc2.detune.value = -9;
      filter.type = 'bandpass'; filter.Q.value = 9;
      filter.frequency.setValueAtTime(620, t);
      filter.frequency.exponentialRampToValueAtTime(1380, t + d * 0.58);
      filter.frequency.exponentialRampToValueAtTime(820, t + d);
      shaper.curve = makeDistortionCurve(0.62);
    } else if (tone === 'donk') {
      osc1.type = 'sine'; osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(freq * 2.35, t); osc2.frequency.setValueAtTime(freq * 1.18, t);
      osc1.frequency.exponentialRampToValueAtTime(freq, t + Math.min(0.09, d * 0.55));
      osc2.frequency.exponentialRampToValueAtTime(freq, t + Math.min(0.11, d * 0.65));
      filter.type = 'lowpass'; filter.frequency.value = 520; filter.Q.value = 4.2;
      shaper.curve = makeDistortionCurve(0.28);
    } else if (tone === '808') {
      osc1.type = 'sine'; osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(freq * 1.035, t); osc2.frequency.setValueAtTime(freq * 2, t);
      osc1.frequency.exponentialRampToValueAtTime(targetFreq, t + d * 0.72);
      osc2.frequency.exponentialRampToValueAtTime(targetFreq * 2, t + d * 0.72);
      filter.type = 'lowpass'; filter.frequency.value = 360; filter.Q.value = 1.4;
      shaper.curve = makeDistortionCurve(0.22);
    } else {
      osc1.type = 'sawtooth'; osc2.type = 'sawtooth';
      osc1.frequency.value = freq; osc2.frequency.value = freq;
      osc1.detune.value = -12; osc2.detune.value = 12;
      filter.type = 'lowpass'; filter.Q.value = 1.8;
      filter.frequency.setValueAtTime(Math.max(420, freq * 8), t);
      filter.frequency.exponentialRampToValueAtTime(Math.max(880, freq * 15), t + d * 0.55);
      filter.frequency.exponentialRampToValueAtTime(Math.max(520, freq * 9), t + d);
      shaper.curve = makeDistortionCurve(0.42);
    }
    shaper.oversample = '2x';
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.005);
    if (tone === '808') gain.gain.setValueAtTime(peak * 0.82, t + d * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, t + d);
    osc1.connect(filter); osc2.connect(filter);
    filter.connect(shaper); shaper.connect(gain); gain.connect(musicBusGain);
    if (delaySend && (tone === 'reese' || tone === 'vowel')) gain.connect(delaySend);
    osc1.start(t); osc2.start(t);
    osc1.stop(t + d + 0.05); osc2.stop(t + d + 0.05);
    var nodes = [osc1, osc2, filter, shaper, gain];
    if (mod) { mod.start(t); mod.stop(t + d + 0.05); nodes.push(mod, modGain); }
    if (currentTracking) Array.prototype.push.apply(currentTracking, nodes);
  }

  function scheduleGenreBassLayer(genre, freq, time, stepDur, absoluteStep, phraseStep) {
    var configuredMode = (GENRE_INSTRUMENTATION[genre] || GENRE_INSTRUMENTATION.brostep).bassLayer;
    if (genre === 'riddimDubstep' && [6, 14, 22, 30].indexOf(phraseStep) >= 0) {
      playBassLayer(freq * 1.5, stepDur * 2.1, configuredMode, 0.060, time);
    } else if (genre === 'brostep' && [2, 11, 19, 26].indexOf(phraseStep) >= 0) {
      playBassLayer(freq * 1.5, stepDur * 1.45, configuredMode, 0.058, time);
    } else if (genre === 'hybridTrap' && (absoluteStep % 16 === 0 || phraseStep === 15)) {
      var glideTarget = phraseStep === 15 ? freq * 0.75 : freq;
      playBassLayer(freq, stepDur * 5.2, configuredMode, 0.070, time, glideTarget);
    } else if (genre === 'bassHouse' && phraseStep % 8 === 2) {
      playBassLayer(freq * 2, stepDur * 1.2, configuredMode, 0.062, time);
    } else if (genre === 'melodicDubstep' && (absoluteStep % 16 === 0 || phraseStep === 22)) {
      playBassLayer(freq, stepDur * 3.4, configuredMode, 0.050, time);
    } else if (genre === 'destinyFusion' && [0, 6, 14, 23].indexOf(phraseStep) >= 0) {
      var fusionModes = ['reese', 'metallic', 'vowel'];
      var fusionMode = fusionModes[Math.floor(absoluteStep / 16) % fusionModes.length];
      playBassLayer(fusionMode === 'metallic' ? freq * 1.5 : freq, stepDur * (fusionMode === 'reese' ? 3.4 : 1.8),
        fusionMode, fusionMode === 'reese' ? 0.050 : 0.055, time);
    }
  }

  function getBassArticulation(genre, phraseStep, absoluteStep, variation) {
    var group = Math.floor(phraseStep / 4) % 8;
    var secondHalf = absoluteStep >= 64;
    var sequences = {
      riddimDubstep: [0, 0, 7, 0, 12, 0, 7, 12],
      brostep: [0, 12, 7, 3, 0, 10, 5, 12],
      hybridTrap: [0, 0, 12, 7, 0, 3, 10, 12],
      bassHouse: [0, 7, 12, 3, 0, 10, 7, 12],
      melodicDubstep: [0, 7, 3, 12, 0, 7, 10, 12],
      destinyFusion: [0, 12, 3, 7, 10, 5, 12, 7]
    };
    var sequence = sequences[genre] || sequences.brostep;
    var index = variation === 'mutate' && secondHalf ? (7 - group) : group;
    var semitones = sequence[index];
    var duration = 1.2;
    var cutoff = 1;
    var fm = 1;
    var extraMode = null;
    var extraGain = 0.042;

    if (genre === 'riddimDubstep') {
      duration = group % 2 === 0 ? 2.5 : 0.72;
      cutoff = group % 2 === 0 ? 0.72 : 1.30;
      fm = group % 3 === 0 ? 0.72 : 1.18;
      if (group === 0 || group === 4) extraMode = 'reese';
    } else if (genre === 'brostep') {
      duration = [0.65, 1.4, 0.72, 1.8, 0.58, 1.2, 0.7, 1.55][group];
      cutoff = [1.25, 0.68, 1.42, 0.82, 1.12, 0.62, 1.5, 0.92][group];
      fm = [1.15, 1.45, 0.85, 1.30, 0.72, 1.52, 1.05, 1.35][group];
      if (group === 3 || group === 5) extraMode = 'vowel';
      extraGain = 0.052;
    } else if (genre === 'hybridTrap') {
      duration = group % 4 === 0 ? 4.2 : (group % 2 ? 0.75 : 1.35);
      cutoff = group % 2 ? 1.35 : 0.78;
      fm = group % 3 === 2 ? 1.35 : 0.72;
      if (group === 2 || group === 6) extraMode = 'metallic';
      extraGain = 0.045;
    } else if (genre === 'bassHouse') {
      duration = group % 2 ? 0.62 : 0.86;
      cutoff = group % 4 === 3 ? 1.38 : 0.92 + (group % 2) * 0.18;
      fm = group % 2 ? 0.75 : 1.05;
      if (group === 3 || group === 7) extraMode = 'reese';
      extraGain = 0.040;
    } else if (genre === 'melodicDubstep') {
      duration = group % 2 === 0 ? 1.65 : 0.92;
      cutoff = group % 2 === 0 ? 0.74 : 1.08;
      fm = 0.64;
      semitones = [0, 7, 3, 12, 0, 7, 10, 12][group];
    } else if (genre === 'destinyFusion') {
      duration = [1.8, 0.65, 1.15, 0.72, 2.1, 0.62, 1.35, 0.8][group];
      cutoff = [0.70, 1.42, 0.92, 1.30, 0.62, 1.50, 0.82, 1.22][group];
      fm = [0.75, 1.40, 1.10, 0.82, 1.35, 0.68, 1.48, 1.02][group];
      if (group === 2 || group === 6) extraMode = group === 2 ? 'metallic' : 'vowel';
      extraGain = 0.050;
    }

    var microStep = phraseStep % 4;
    if (genre === 'riddimDubstep' && microStep === 2) {
      semitones += 12; duration *= 0.58; cutoff *= 1.18;
    } else if (genre === 'brostep') {
      if (microStep === 2) { semitones += 12; duration *= 0.52; cutoff *= 1.16; }
      else if (microStep === 3) { semitones += 7; duration *= 0.68; fm *= 1.12; }
    } else if (genre === 'hybridTrap' && microStep === 3) {
      semitones += 12; duration *= 0.62; cutoff *= 1.20;
    } else if (genre === 'destinyFusion' && microStep === 1) {
      semitones += 7; duration *= 0.66; fm *= 1.15;
    }

    return { semitones: semitones, duration: duration, cutoff: cutoff, fm: fm,
      extraMode: extraMode, extraGain: extraGain };
  }

  function scheduleBassColor(synth, baseFreq, time, duration, articulation) {
    if (!bassFilter || !fmGain || !lfoDepth) return;
    var cutoff = Math.max(80, Math.min(8000, synth.cutoff * articulation.cutoff));
    var fmBase = Math.pow(synth.fm / 100, 1.35) * baseFreq * 16;
    var wobbleBase = Math.pow(synth.depth / 100, 1.35) * Math.min(3600, synth.cutoff * 0.88);
    smoothSet(bassFilter.frequency, cutoff, 0.012, time);
    smoothSet(fmGain.gain, fmBase * articulation.fm, 0.014, time);
    smoothSet(lfoDepth.gain, wobbleBase * (articulation.duration < 1 ? 0.55 : 1.08), 0.014, time);
  }

  // ── 创建使用当前 Bass 音色的一次性振荡器 ─────────────
  // 用于 Pattern 试听和最终歌曲中的 D/F Pad

  function playBassOneShot(freq, duration, gainVal, startTime, extraDistort) {
    if (!ctx || !sumGain || !bassShaper) return;
    var t = startTime || ctx.currentTime;
    var osc = ctx.createOscillator();
    var mod = ctx.createOscillator();
    var modGain = ctx.createGain();
    var sub = ctx.createOscillator();
    var subOneShotGain = ctx.createGain();
    var shaper = ctx.createWaveShaper();
    var filter = ctx.createBiquadFilter();
    var g = ctx.createGain();

    var wave = createPeriodicWaveFromSamples(currentWaveformId);
    if (wave) osc.setPeriodicWave(wave); else osc.type = currentBassType || 'sawtooth';
    osc.frequency.value = freq;
    mod.type = 'sine';
    mod.frequency.value = freq * 2;
    modGain.gain.value = Math.pow((currentSynthParams ? currentSynthParams.fm : 50) / 100, 1.35) * freq * 12;
    mod.connect(modGain);
    modGain.connect(osc.frequency);

    sub.type = 'sine';
    sub.frequency.value = freq / 2;
    subOneShotGain.gain.setValueAtTime(0, t);
    subOneShotGain.gain.linearRampToValueAtTime(0.04 + currentBodyVal * 0.12, t + 0.006);
    subOneShotGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    // 复制当前 bass 的滤波器设置
    filter.type = currentSynthParams ? currentSynthParams.filterType : 'lowpass';
    filter.frequency.value = bassFilter ? bassFilter.frequency.value : 1200;
    filter.Q.value = bassFilter ? bassFilter.Q.value : 3;

    // 使用用户当前的 Growl 值 + 额外失真
    var growlAmount = currentGrowlVal + (extraDistort == null ? 0 : extraDistort);
    shaper.curve = makeDistortionCurve(Math.min(1, Math.max(0, growlAmount)));
    shaper.oversample = '2x';

    var baseGain = gainVal == null ? 0.18 : gainVal;
    var bodyAdjustedGain = baseGain * (0.65 + currentBodyVal * 0.7);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(bodyAdjustedGain, t + 0.005);
    g.gain.setValueAtTime(bodyAdjustedGain, t + duration * 0.7);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(filter);
    filter.connect(shaper);
    shaper.connect(g);
    g.connect(musicBusGain || sumGain);
    sub.connect(subOneShotGain);
    subOneShotGain.connect(musicBusGain || sumGain);
    osc.start(t);
    mod.start(t);
    sub.start(t);
    osc.stop(t + duration + 0.05);
    mod.stop(t + duration + 0.05);
    sub.stop(t + duration + 0.05);
    if (currentTracking) { currentTracking.push(osc, mod, modGain, sub, subOneShotGain, g, filter, shaper); }
  }

  // ── Drop 强度预览（gentle/standard/overload 各有不同音色）──

  function previewDropIntensity(optionId) {
    if (!ctx) return;
    var t = ctx.currentTime;
    var bassFreq = currentBassFreq || 55;

    if (optionId === 'gentle') {
      // Gentle: 柔和 sub sine + 轻 kick
      playOneShot(bassFreq, 0.6, 'sine', 0.15, t);
      playKick(t);
    } else if (optionId === 'overload') {
      // Overload: 失真 bass + kick + snare + hihat
      playBassOneShot(bassFreq, 0.4, 0.25, t, 0.4);
      playKick(t);
      playSnare(t + 0.15);
      playHihat(t + 0.075, 0.06);
      playHihat(t + 0.225, 0.06);
    } else {
      // Standard: 正常 bass + kick + snare
      playBassOneShot(bassFreq, 0.4, 0.2, t);
      playKick(t);
      playSnare(t + 0.15);
    }
  }

  // ── Pattern 试听 ──────────────────────────────────

  function playPattern(events, bpm, playheadCb, completeCb) {
    ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    stopPreview();

    // 停止上一次的 Pattern 试听（防止叠加）
    stopPattern();

    if (!events || events.length === 0) return;

    isPatternPlaying = true;
    patternPlayheadCb = playheadCb || null;
    patternCompleteCb = completeCb || null;
    patternNodes = [];
    patternTimers = [];

    var useBpm = bpm || currentBpm || 140;
    var stepDur = (60 / useBpm) / 2; // 八分音符
    var t0 = ctx.currentTime + 0.1;
    patternEndTime = t0 + 8 * stepDur;

    currentTracking = patternNodes;

    var sw = currentBassFreq > 0 ? null : null;
    var bassFreq = currentBassFreq || 55;
    var padFreqs = currentPadFreqs || [110, 165];

    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      var t = t0 + ev.step * stepDur;

      if (ev.pad === 'D') {
        // D = Main Bass: 使用当前 Bass 音色
        playBassOneShot(bassFreq, stepDur * 0.9, 0.2, t);
        playKick(t);
      } else if (ev.pad === 'F') {
        // F = Growl: 使用当前 Bass 音色但升五度 + 额外失真
        playBassOneShot(bassFreq * 1.5, stepDur * 0.9, 0.18, t, 0.85);
      } else if (ev.pad === 'J') {
        // J = Drum Fill: 军鼓连击
        playSnare(t);
        playHihat(t + stepDur * 0.25, 0.05);
        playSnare(t + stepDur * 0.5);
      } else if (ev.pad === 'K') {
        // K = Chord: 使用当前 Pad 频率的和弦
        playOneShot(padFreqs[0], stepDur * 0.9, 'sine', 0.12, t);
        playOneShot(padFreqs[1], stepDur * 0.9, 'triangle', 0.10, t);
        playOneShot(padFreqs[0] * 1.5, stepDur * 0.9, 'sine', 0.08, t);
      }
    }

    currentTracking = null;

    // Playhead 定时器
    if (patternPlayheadCb) {
      for (var s = 0; s < 8; s++) {
        var stepTime = t0 + s * stepDur;
        var delay = (stepTime - ctx.currentTime) * 1000;
        if (delay < 0) delay = 0;
        patternTimers.push(setTimeout(makePlayheadCb(s), delay));
      }
    }

    // 结束定时器
    var endDelay = (patternEndTime - ctx.currentTime) * 1000 + 200;
    patternTimers.push(setTimeout(function () {
      isPatternPlaying = false;
      patternNodes = [];
      patternTimers = [];
      patternPlayheadCb = null;
      if (patternCompleteCb) {
        var cb = patternCompleteCb;
        patternCompleteCb = null;
        cb();
      }
    }, endDelay));
  }

  function makePlayheadCb(step) {
    return function () {
      if (patternPlayheadCb && isPatternPlaying) {
        patternPlayheadCb(step);
      }
    };
  }

  function stopPattern() {
    isPatternPlaying = false;
    patternPlayheadCb = null;
    patternCompleteCb = null;
    for (var i = 0; i < patternTimers.length; i++) {
      clearTimeout(patternTimers[i]);
    }
    patternTimers = [];
    for (var j = 0; j < patternNodes.length; j++) {
      var n = patternNodes[j];
      try { if (n.stop) n.stop(); } catch (e) {}
      try { n.disconnect(); } catch (e) {}
    }
    patternNodes = [];
  }

  function getIsPatternPlaying() {
    return isPatternPlaying;
  }

  // ── 最终歌曲：编排计划 ─────────────────────────────
  // 统一框架：2 bars 引入 + 4 bars Build-up + 8 bars Drop = 14 bars
  // Structure 影响 Build-up 和 Drop 的编排方式
  // Variation 影响 Drop 后半段（第 5-8 小节）

  function buildSongPlan(state) {
    var structure = state.choices.structure;
    var variation = state.choices.variation;
    var drop = state.choices.drop;
    var result = state.result || (global.StyleEngine && global.StyleEngine.evaluate ? global.StyleEngine.evaluate(state) : null);
    var genre = result ? result.primaryStyle : 'brostep';

    // Drop 强度 → 混音参数
    var intensity;
    if (drop === 'gentle') {
      intensity = { distortMult: 0.45, gainMult: 0.72, drumDensity: 0, spaceMult: 1.6 };
    } else if (drop === 'overload') {
      intensity = { distortMult: 1.62, gainMult: 1.16, drumDensity: 2, spaceMult: 0.6 };
    } else {
      intensity = { distortMult: 1.0, gainMult: 1.0, drumDensity: 1, spaceMult: 1.0 };
    }

    // 基础计划：2+4+8=14 小节
    var plan = {
      intro: { bars: 2, pad: true, drums: false, bass: false, melody: false },
      build: { bars: 4, pad: true, drums: 'gradual', bass: 'default', melody: false },
      drop:  { bars: 8, pad: true, drums: 'full', bass: 'default', melody: false },
      totalBars: 14,
      genre: genre,
      preDropSilenceSteps: 2,
      intensity: intensity,
      variation: variation,
      structure: structure
    };

    if (structure === 'classicDrop') {
      // 明显停顿后重拍进入
      plan.drop.pauseBefore = true;
      plan.preDropSilenceSteps = 8;
    } else if (structure === 'melodicNarrative') {
      // Build-up 保留旋律，Drop 中旋律与 Bass 共同出现
      plan.intro.melody = true;
      plan.build.melody = true;
      plan.build.bass = 'melodic';
      plan.drop.melody = true;
      plan.preDropSilenceSteps = 2;
    } else if (structure === 'minimalTech') {
      // 元素更少，靠节奏和滤波推进
      plan.intro.pad = false;
      plan.intro.filter = true;
      plan.build.pad = false;
      plan.build.drums = 'sparse';
      plan.build.filter = true;
      plan.drop.pad = false;
      plan.drop.drums = 'lean';
      plan.preDropSilenceSteps = 1;
    } else if (structure === 'epicJourney') {
      // Build-up 更宽、更有上升感，Drop 更有冲击力
      plan.build.drums = 'rising';
      plan.build.rising = true;
      plan.drop.extraSub = true;
      plan.preDropSilenceSteps = 4;
    }

    // Melodic Dubstep 的身份由 Supersaw 和弦与 Saw Lead 主导，Bass 只做重拍/句尾点缀。
    if (genre === 'melodicDubstep') {
      plan.intro.pad = true;
      plan.build.pad = true;
      plan.drop.pad = true;
      plan.intro.melody = true;
      plan.build.melody = true;
      plan.drop.melody = true;
      plan.build.bass = 'melodic';
    }

    return plan;
  }

  // ── 静音并恢复持久参数（用于 stop 和自然结束）────────
  // 取消所有未来自动化事件，立即安全淡出，恢复正常用户参数

  function silenceAndRestoreParams(state) {
    if (!ctx) return;
    var now = ctx.currentTime;

    // 取消所有持久参数的自动化事件
    var params = [
      bassGate ? bassGate.gain : null,
      subGate ? subGate.gain : null,
      bassOsc ? bassOsc.frequency : null,
      bassOsc2 ? bassOsc2.frequency : null,
      fmOsc ? fmOsc.frequency : null,
      fmGain ? fmGain.gain : null,
      bassFilter ? bassFilter.frequency : null,
      bassFilter ? bassFilter.Q : null,
      bassOutGain ? bassOutGain.gain : null,
      subGain ? subGain.gain : null,
      padGain ? padGain.gain : null,
      padOsc1 ? padOsc1.frequency : null,
      padOsc2 ? padOsc2.frequency : null,
      lfoDepth ? lfoDepth.gain : null,
      delaySend ? delaySend.gain : null,
      feedbackGain ? feedbackGain.gain : null,
      musicBusGain ? musicBusGain.gain : null
    ];
    for (var i = 0; i < params.length; i++) {
      if (params[i]) {
        try { params[i].cancelScheduledValues(now); } catch (e) {}
      }
    }

    // 立即安全淡出到静音
    if (bassGate) smoothSet(bassGate.gain, 0, 0.02, now);
    if (subGate) smoothSet(subGate.gain, 0, 0.02, now);
    if (padGain) smoothSet(padGain.gain, 0, 0.05, now);
    if (lfoDepth) smoothSet(lfoDepth.gain, 0, 0.02, now);
    if (musicBusGain) smoothSet(musicBusGain.gain, 1, 0.02, now);

    // 恢复用户正常参数
    if (state) {
      updateBassParams(state);
      updateEffects(state);
      var restoreWorld = state.choices && state.choices.soundWorld;
      var restoreFreqs = SW_FREQS[restoreWorld] || SW_FREQS.abyss;
      if (padOsc1) smoothSet(padOsc1.frequency, restoreFreqs.pad[0], 0.05, now);
      if (padOsc2) smoothSet(padOsc2.frequency, restoreFreqs.pad[1], 0.05, now);
    }
  }

  // ── 最终歌曲：调度 ─────────────────────────────────

  function playFinalSong(state, completeCb) {
    ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    stopPreview();

    // 如果上一次最终歌曲还在播放，先停止
    if (isFinalSongPlaying) {
      stopFinalSong();
    }

    // 停止 Pattern 试听
    stopPattern();

    // 暂停 Loop（不销毁，可恢复）
    if (isLooping && !isPaused) {
      setPaused(true);
    }

    isFinalSongPlaying = true;
    finalSongNodes = [];
    finalSongCompleteCb = completeCb || null;
    finalSongState = state;

    // 应用用户 Bass 参数到持久链
    updateBassParams(state);
    updatePadParams(state);
    updateEffects(state);

    var bpm = getBpmFromState(state);
    var beatDur = 60 / bpm;
    var stepDur = beatDur / 4; // 16 分音符
    var t0 = ctx.currentTime + 0.15;

    var plan = buildSongPlan(state);
    var genrePhrases = GENRE_BASS_PHRASES[plan.genre] || GENRE_BASS_PHRASES.brostep;
    var instrumentation = GENRE_INSTRUMENTATION[plan.genre] || GENRE_INSTRUMENTATION.brostep;
    currentDrumKitId = plan.genre;
    var drumKit = getDrumKit();
    currentKickSample = drumKit.kick;
    currentSnareSample = drumKit.snare;
    if (plan.genre === 'melodicDubstep') {
      currentBassGatePeak = 0.36; currentSubGatePeak = 0.40;
    } else if (plan.genre === 'bassHouse') {
      currentBassGatePeak = 0.45; currentSubGatePeak = 0.46;
    } else if (plan.genre === 'hybridTrap') {
      currentBassGatePeak = 0.48; currentSubGatePeak = 0.52;
    } else {
      currentBassGatePeak = 0.53; currentSubGatePeak = 0.54;
    }
    var rId = getRhythmId(state);
    var basePat = DRUM_PATTERNS[rId] || DRUM_PATTERNS.halfTime;

    var sw = state.choices.soundWorld;
    var freqs = SW_FREQS[sw] || SW_FREQS.abyss;
    var bassFreq = freqs.bass;
    var padFreqs = freqs.pad;

    var bassPat = genrePhrases.a;

    var synth = getSynthParams(state);
    var origDrive = synth.drive;
    var origSub = synth.sub;
    var origSpace = synth.space;

    var intensity = plan.intensity;
    // Groove Density 是独立维度，不与 Drop Intensity 混淆
    var grooveDensity = (state.groove && state.groove.density != null) ? state.groove.density : 1;
    var grooveHihatPat = applyHihatDensity(basePat.hihat, grooveDensity, rId);
    var dropHihatPat = applyHihatDensity(grooveHihatPat, intensity.drumDensity, rId);
    var leanHihatPat = applyHihatDensity(dropHihatPat, 0, rId);
    currentTracking = finalSongNodes;

    // ── 计算各段时间 ──
    var introStart = t0;
    var introSteps = plan.intro.bars * 16;
    var introEnd = introStart + introSteps * stepDur;

    var buildStart = introEnd;
    var buildSteps = plan.build.bars * 16;
    var buildEnd = buildStart + buildSteps * stepDur;

    var dropStart = buildEnd;
    var dropSteps = plan.drop.bars * 16;
    var dropHalfSteps = dropSteps / 2; // 4 bars = 64 steps
    var dropEnd = dropStart + dropSteps * stepDur;
    var preDropSilenceStart = buildEnd - plan.preDropSilenceSteps * stepDur;
    // i–VI–III–VII：Bass Music / melodic dubstep 中常见且稳定的 minor progression
    var chordProgression = [
      { ratio: 1, quality: 'minor' },
      { ratio: Math.pow(2, -4 / 12), quality: 'major' },
      { ratio: Math.pow(2, 3 / 12), quality: 'major' },
      { ratio: Math.pow(2, -2 / 12), quality: 'major' }
    ];
    var minorScale = [1, Math.pow(2, 3 / 12), Math.pow(2, 5 / 12), Math.pow(2, 7 / 12), Math.pow(2, 10 / 12), 2];

    // ── Minimal Tech: 滤波器扫频 ──
    if (plan.intro.filter && bassFilter) {
      bassFilter.frequency.cancelScheduledValues(t0);
      bassFilter.frequency.setValueAtTime(200, t0);
      bassFilter.frequency.setValueAtTime(200, buildStart);
      bassFilter.frequency.linearRampToValueAtTime(1800, buildEnd);
      bassFilter.frequency.setValueAtTime(1800, dropStart);
    }

    // ════════════════════════════════════════════════
    // 1. Intro (2 bars)
    // ════════════════════════════════════════════════
    if (plan.intro.pad) {
      smoothSet(padGain.gain, 0.02 + (origSpace / 100) * 0.04, 0.1, introStart);
      smoothSet(padOsc1.frequency, padFreqs[0], 0.1, introStart);
      smoothSet(padOsc2.frequency, padFreqs[1], 0.1, introStart);
    } else {
      smoothSet(padGain.gain, 0, 0.05, introStart);
    }

    // Intro 和声：每小节一个真正变化的和弦，而不是持续单音 Pad
    if (plan.structure !== 'minimalTech') {
      for (var ic = 0; ic < plan.intro.bars; ic++) {
        var introChord = chordProgression[ic % chordProgression.length];
        var introChordTime = introStart + ic * 16 * stepDur;
        var introChordRoot = padFreqs[0] * introChord.ratio;
        if (plan.intro.pad) {
          smoothSet(padOsc1.frequency, introChordRoot, 0.08, introChordTime);
          smoothSet(padOsc2.frequency, introChordRoot * Math.pow(2, 7 / 12), 0.08, introChordTime);
        }
        playChord(introChordRoot, introChordTime,
          15.5 * stepDur, plan.genre === 'melodicDubstep' ? 0.076 : 0.025, introChord.quality,
          instrumentation.chord === 'stab' ? 'haze' : instrumentation.chord);
      }
    }

    // Intro 旋律 (melodicNarrative)
    if (plan.intro.melody) {
      var introMelody = [
        { step: 0, note: 0, dur: 3 }, { step: 4, note: 2, dur: 3 },
        { step: 8, note: 1, dur: 2 }, { step: 12, note: 4, dur: 3 },
        { step: 16, note: 3, dur: 3 }, { step: 20, note: 2, dur: 2 },
        { step: 24, note: 4, dur: 3 }, { step: 29, note: 1, dur: 2 }
      ];
      for (var im = 0; im < introMelody.length; im++) {
        var introEvent = introMelody[im];
        playLeadNote(padFreqs[0] * 2 * minorScale[introEvent.note], introStart + introEvent.step * stepDur,
          introEvent.dur * stepDur, plan.genre === 'melodicDubstep' ? 0.050 : 0.038, instrumentation.lead);
      }
    }

    // 不同结局的前景乐器：稀疏 Arp / Pluck 让非旋律结构也保留可辨识的调性线索。
    if (plan.structure !== 'minimalTech' &&
        (plan.genre === 'melodicDubstep' || plan.genre === 'hybridTrap' || plan.genre === 'destinyFusion')) {
      for (var arpBar = 0; arpBar < plan.intro.bars; arpBar++) {
        var arpChord = chordProgression[arpBar % chordProgression.length];
        var arpTones = arpChord.quality === 'major' ? [0, 7, 12, 16] : [0, 7, 10, 15];
        for (var arpNote = 0; arpNote < arpTones.length; arpNote++) {
          playLeadNote(padFreqs[0] * arpChord.ratio * 2 * Math.pow(2, arpTones[arpNote] / 12),
            introStart + (arpBar * 16 + 2 + arpNote * 4) * stepDur, stepDur * 1.25,
            plan.genre === 'melodicDubstep' ? 0.018 : 0.013, 'pluck');
        }
      }
    }

    // ════════════════════════════════════════════════
    // 2. Build-up (4 bars)
    // ════════════════════════════════════════════════
    if (plan.build.pad) {
      smoothSet(padGain.gain, 0.02 + (origSpace / 100) * 0.05, 0.1, buildStart);
    }
    playRiser(buildStart, buildEnd - buildStart);
    playReverseSwell(dropStart - beatDur, beatDur, 0.062);

    for (var bc = 0; bc < plan.build.bars; bc++) {
      var buildChord = chordProgression[(bc + 2) % chordProgression.length];
      var buildChordTime = buildStart + bc * 16 * stepDur;
      var buildChordRoot = padFreqs[0] * buildChord.ratio;
      if (plan.build.pad) {
        smoothSet(padOsc1.frequency, buildChordRoot, 0.08, buildChordTime);
        smoothSet(padOsc2.frequency, buildChordRoot * Math.pow(2, 7 / 12), 0.08, buildChordTime);
      }
      playChord(buildChordRoot, buildChordTime,
        15 * stepDur, plan.genre === 'melodicDubstep' ? 0.070 : 0.018, buildChord.quality,
        instrumentation.chord === 'stab' ? 'haze' : instrumentation.chord);
    }

    // Build-up 鼓组
    if (plan.build.drums) {
      var bDrumMode = plan.build.drums;
      for (var bs = 0; bs < buildSteps; bs++) {
        var bsTime = buildStart + bs * stepDur;
        var bpi = bs % 32;
        var bProg = bs / buildSteps;

        var bKick = false, bSnare = false, bHat = false;
        if (bsTime >= preDropSilenceStart) continue;

        if (bDrumMode === 'gradual') {
          // 逐渐增加：前 1/4 只有 kick，1/4-1/2 加 hi-hat，1/2 后加 snare
          bKick = basePat.kick[bpi] && bProg > 0.1;
          bHat = grooveHihatPat[bpi] && bProg > 0.3;
          bSnare = basePat.snare[bpi] && bProg > 0.5;
        } else if (bDrumMode === 'sparse') {
          // Minimal Tech: kick + snare + 按 groove density 决定 hi-hat
          bKick = basePat.kick[bpi];
          bSnare = basePat.snare[bpi] && (bpi % 16 === 8);
          bHat = grooveHihatPat[bpi] && (bProg > 0.45 || grooveDensity === 2);
        } else if (bDrumMode === 'rising') {
          // Epic Journey: 逐渐加密 + 上升感
          bKick = basePat.kick[bpi] && bProg > 0.05;
          bSnare = basePat.snare[bpi] && bProg > 0.3;
          bHat = grooveHihatPat[bpi] && bProg > 0.2;
          // 最后 1/4 加 snare roll
          if (bProg > 0.75 && bs % 4 === 3) {
            playSnare(bsTime);
          }
        }

        if (bKick) playKick(bsTime);
        if (bSnare) playSnare(bsTime);
        if (bHat) playHihat(bsTime, 0.06);
      }
    }

    // Build-up 最后一小节渐密 Snare Roll，停顿区域前结束
    for (var roll = Math.max(0, buildSteps - 16); roll < buildSteps - plan.preDropSilenceSteps; roll++) {
      var rollLocal = roll - (buildSteps - 16);
      var shouldHit = rollLocal < 8 ? rollLocal % 4 === 0 : (rollLocal < 12 ? rollLocal % 2 === 0 : true);
      if (shouldHit) {
        var rollTime = buildStart + roll * stepDur;
        if (sampleBank[currentSnareSample]) playSample(currentSnareSample, rollTime,
          (0.14 + rollLocal / 16 * 0.16) * (drumKit.snareGain / 0.52),
          (drumKit.snareRate || 1) * (0.97 + rollLocal * 0.008));
        else playSnare(rollTime);
      }
    }

    // Build-up bass — 后半段进入
    if (plan.build.bass) {
      var bBassMode = plan.build.bass;
      var bBassPat = bBassMode === 'melodic' ? GENRE_BASS_PHRASES.melodicDubstep.a : BASS_PATTERNS.default;
      for (var bb = 0; bb < buildSteps; bb++) {
        var bbProg = bb / buildSteps;
        if (bbProg > 0.4 && bBassPat[bb % 32] && buildStart + bb * stepDur < preDropSilenceStart) {
          var bbFreq = bassFreq;
          if (plan.build.rising) {
            var riseSemitones = Math.min(4, Math.floor(bbProg * 5));
            bbFreq = bassFreq * Math.pow(2, riseSemitones / 12);
          }
          var bbTime = buildStart + bb * stepDur;
          scheduleBassPitch(bbFreq, bbTime);
          triggerBassNote(bbTime, stepDur * 1.2);
          if (bbProg > 0.68 && bbTime + stepDur * 5.3 < preDropSilenceStart) {
            scheduleGenreBassLayer(plan.genre, bbFreq, bbTime, stepDur, bb, bb % 32);
          }
        }
      }
    }

    // Build-up 旋律 (melodicNarrative)
    if (plan.build.melody) {
      var buildMotif = [
        { step: 0, note: 0 }, { step: 4, note: 1 }, { step: 7, note: 2 },
        { step: 10, note: 3 }, { step: 12, note: 4 }, { step: 14, note: 5 }
      ];
      for (var buildBar = 0; buildBar < plan.build.bars; buildBar++) {
        for (var bm = 0; bm < buildMotif.length; bm++) {
          var buildEvent = buildMotif[bm];
          var melodyStep = buildBar * 16 + buildEvent.step;
          var melodyTime = buildStart + melodyStep * stepDur;
          if (melodyTime < preDropSilenceStart) {
            var buildLift = (buildBar === plan.build.bars - 1 && buildEvent.note >= 4) ? 2 : 1;
            playLeadNote(padFreqs[0] * 2 * minorScale[buildEvent.note] * buildLift, melodyTime,
              stepDur * (buildEvent.step >= 12 ? 1.2 : 2.1),
              plan.genre === 'melodicDubstep' ? 0.044 + buildBar * 0.002 : 0.032 + buildBar * 0.003, instrumentation.lead);
          }
        }
      }
    }

    // ════════════════════════════════════════════════
    // 3. Drop (8 bars) — 单次 Drop
    // ════════════════════════════════════════════════

    // Drop 强度调整
    var distortMult = intensity.distortMult;
    var gainMult = intensity.gainMult;
    var drumDensity = intensity.drumDensity;
    var spaceMult = intensity.spaceMult;

    bassShaper.curve = makeDistortionCurve(Math.min(1.25, Math.max(0, (origDrive / 100) * distortMult)));
    smoothSet(bassOutGain.gain, (0.055 + (origDrive / 100) * 0.045) * gainMult, 0.05, dropStart);

    // Drop pad
    if (plan.drop.pad) {
      smoothSet(padGain.gain, (0.02 + (origSpace / 100) * 0.06) * spaceMult, 0.1, dropStart);
    } else {
      smoothSet(padGain.gain, 0, 0.05, dropStart);
    }

    // Epic Journey: 额外 sub 增强冲击力
    if (plan.drop.extraSub && subGain) {
      smoothSet(subGain.gain, 0.025 + (origSub / 100) * 0.18, 0.05, dropStart);
    }

    playImpact(dropStart, plan.drop.extraSub ? 1.08 : 0.9);
    playCrash(dropStart, plan.drop.extraSub ? 0.10 : 0.078);
    var dropMidpoint = dropStart + dropHalfSteps * stepDur;
    playReverseSwell(dropMidpoint - beatDur, beatDur, 0.045);
    playCrash(dropMidpoint, 0.052);

    // Drop 音色编排：每小节改变 Filter / FM / Wobble，形成 call-and-response。
    // 用户旋钮仍是中心值；这里仅做围绕中心值的小幅音乐性变化。
    var cutoffShapes = {
      riddimDubstep: [0.72, 0.96, 0.78, 1.08, 0.68, 1.02, 0.82, 1.16],
      brostep: [1.02, 0.74, 1.18, 0.86, 1.12, 0.70, 1.24, 0.92],
      hybridTrap: [0.82, 1.10, 0.76, 1.22, 0.88, 1.18, 0.72, 1.28],
      bassHouse: [0.92, 1.08, 0.96, 1.14, 0.94, 1.12, 0.98, 1.18],
      melodicDubstep: [0.86, 1.02, 1.14, 0.94, 0.90, 1.08, 1.20, 1.00],
      destinyFusion: [0.78, 1.12, 0.88, 1.22, 0.72, 1.18, 0.94, 1.28]
    };
    var timbreShape = cutoffShapes[plan.genre] || cutoffShapes.brostep;
    var baseFmDepth = Math.pow(synth.fm / 100, 1.35) * bassFreq * 16;
    var baseWobbleDepth = Math.pow(synth.depth / 100, 1.35) * Math.min(3600, synth.cutoff * 0.88);
    for (var colorBar = 0; colorBar < plan.drop.bars; colorBar++) {
      var colorTime = dropStart + colorBar * 16 * stepDur;
      var color = timbreShape[colorBar % timbreShape.length];
      if (plan.variation === 'mutate' && colorBar >= plan.drop.bars / 2) color *= 1.08;
      smoothSet(bassFilter.frequency, Math.max(80, Math.min(8000, synth.cutoff * color)), 0.055, colorTime);
      smoothSet(fmGain.gain, baseFmDepth * (0.82 + (colorBar % 3) * 0.11), 0.045, colorTime);
      smoothSet(lfoDepth.gain, baseWobbleDepth * (colorBar % 2 ? 1.08 : 0.82), 0.045, colorTime);
    }

    // Classic Drop: 停顿后重拍 — 第一拍强 kick
    if (plan.drop.pauseBefore) {
      playKick(dropStart);
    }

    // Drop 鼓组
    var dDrumMode = plan.drop.drums;
    for (var ds = 0; ds < dropSteps; ds++) {
      var dsTime = dropStart + ds * stepDur;
      var dpi = ds % 32;
      var dKick = false, dSnare = false, dHat = false;
      var dHatGain = drumKit.hatGain;
      var rawHat = 0;

      if (dDrumMode === 'full') {
        dKick = !!basePat.kick[dpi];
        dSnare = !!basePat.snare[dpi];
        rawHat = dropHihatPat[dpi];
        dHat = !!rawHat;
      } else if (dDrumMode === 'lean') {
        // Minimal Tech: kick + snare + 按 groove density 调整 hi-hat
        dKick = !!basePat.kick[dpi];
        dSnare = !!basePat.snare[dpi];
        rawHat = leanHihatPat[dpi];
        dHat = !!rawHat;
      }
      var genreGrid = GENRE_DRUM_GRIDS[plan.genre];
      if (genreGrid) {
        var gridStep = ds % 16;
        if (genreGrid.blend && dDrumMode === 'full') {
          dKick = dKick || !!genreGrid.kick[gridStep];
          dSnare = dSnare || !!genreGrid.snare[gridStep];
        } else {
          dKick = !!genreGrid.kick[gridStep];
          dSnare = !!genreGrid.snare[gridStep];
        }
      }
      if (dHat) dHatGain = rawHat >= 1 ? drumKit.hatGain : drumKit.hatGain * (0.45 + rawHat);
      if (drumDensity === 2) dHatGain *= 0.88;

      // Classic Drop: 跳过第一拍（已用强 kick 覆盖）
      if (plan.drop.pauseBefore && ds === 0) {
        dKick = false;
      }

      if (dKick) playKick(dsTime);
      if (dSnare) {
        playSnare(dsTime);
      }
      if (dHat) playHihat(dsTime, dHatGain);

      // 分流派鼓组细节：House offbeat open hat、Trap rolls、Dubstep tom fills。
      if (plan.genre === 'bassHouse' && ds % 4 === 2) {
        playOpenHat(dsTime, 0.038);
      } else if (plan.genre === 'melodicDubstep' && ds % 16 === 14) {
        playOpenHat(dsTime, 0.028);
      } else if (plan.genre === 'hybridTrap' && ds % 16 === 15 && (grooveDensity > 0 || drumDensity === 2)) {
        playHihat(dsTime, 0.038);
        playHihat(dsTime + stepDur * 0.34, 0.032);
        playHihat(dsTime + stepDur * 0.68, 0.026);
      } else if (plan.genre === 'destinyFusion' && ds % 16 === 14) {
        playOpenHat(dsTime, 0.026);
      }

      if (ds % 32 === 28 && (plan.genre === 'brostep' || plan.genre === 'riddimDubstep' ||
          (plan.genre === 'destinyFusion' && ds >= dropHalfSteps))) {
        playTom(dsTime, bassFreq * 2.5, 0.085);
        playTom(dsTime + stepDur, bassFreq * 2, 0.075);
        playTom(dsTime + stepDur * 2, bassFreq * 1.5, 0.07);
      }

      // Overload + Busy: 额外 fill（两个维度都高时才加 fill）
      if (drumDensity === 2 && grooveDensity >= 1 && ds % 16 === 14) {
        playSnare(dsTime);
        playHihat(dsTime + stepDur * 0.5, 0.05);
      }
      // Busy groove: 每 8 步加 ghost fill
      if (grooveDensity === 2 && ds % 8 === 6 && !dHat) {
        playHihat(dsTime, 0.04);
      }
      // 每两小节末尾加入真实鼓过门，Brostep/Hybrid 更激进
      if (ds % 32 === 29 && (plan.genre === 'brostep' || plan.genre === 'hybridTrap' || plan.variation === 'mutate')) {
        playSnare(dsTime);
        playHihat(dsTime + stepDur * 0.5, 0.045);
        playSnare(dsTime + stepDur);
      }
    }

    // Drop bass — Variation 影响后半段（第 5-8 小节）。
    // 若用户写了 Pattern，它会明确接管后半段 Bass，而不是靠自动化事件相互覆盖。
    var dropBassPatA = genrePhrases.a;
    var dropBassPatB = plan.variation === 'repeat' ? genrePhrases.a : genrePhrases.b;
    var dropBassFreqB = bassFreq;   // 后半段频率

    if (plan.variation === 'mutate') {
      dropBassPatB = genrePhrases.b;
    } else if (plan.variation === 'lift') {
      // Lift: 后半段提高音区
      dropBassFreqB = bassFreq * 1.5; // 上行五度
    }

    var hasUserPattern = !!(state.performance && state.performance.events && state.performance.events.length);
    for (var db = 0; db < dropSteps; db++) {
      var dbTime = dropStart + db * stepDur;
      var isSecondHalf = db >= dropHalfSteps;
      if (isSecondHalf && hasUserPattern) continue;
      var bassBlock = Math.floor(db / 32);
      var usePat;
      if (bassBlock === 0) usePat = dropBassPatA;
      else if (bassBlock === 1) usePat = genrePhrases.b;
      else if (plan.variation === 'mutate') usePat = bassBlock === 2 ? dropBassPatB : dropBassPatA;
      else usePat = bassBlock % 2 ? dropBassPatB : dropBassPatA;
      var useFreq = isSecondHalf ? dropBassFreqB : bassFreq;

      if (usePat[db % 32]) {
        var phraseStep = db % 32;
        var harmonicBar = Math.floor(db / 16) % chordProgression.length;
        if (plan.genre === 'melodicDubstep' || plan.genre === 'bassHouse' ||
            plan.genre === 'hybridTrap' || plan.genre === 'destinyFusion') {
          useFreq *= chordProgression[harmonicBar].ratio;
        }
        var articulation = getBassArticulation(plan.genre, phraseStep, db, plan.variation);
        if (chordProgression[harmonicBar].quality === 'major' && articulation.semitones % 12 === 3) {
          articulation.semitones += 1;
        }
        var arrangedBassFreq = useFreq * Math.pow(2, articulation.semitones / 12);
        var arrangedDuration = stepDur * articulation.duration;
        scheduleBassPitch(arrangedBassFreq, dbTime);
        scheduleBassColor(synth, arrangedBassFreq, dbTime, arrangedDuration, articulation);
        triggerBassNote(dbTime, arrangedDuration);
        scheduleGenreBassLayer(plan.genre, arrangedBassFreq, dbTime, stepDur, db, phraseStep);
        if (articulation.extraMode) {
          playBassLayer(arrangedBassFreq, Math.max(stepDur * 0.7, arrangedDuration * 0.82),
            articulation.extraMode, articulation.extraGain, dbTime);
        }
      }
    }

    // Drop 和弦与旋律分层；旋律流派更宽，其余流派只保留低声部锚点
    for (var dc = 0; dc < plan.drop.bars; dc++) {
      var chordGain = plan.genre === 'melodicDubstep' ? 0.082 : (plan.genre === 'destinyFusion' ? 0.055 : 0.014);
      var dropChord = chordProgression[dc % chordProgression.length];
      var dropChordTime = dropStart + dc * 16 * stepDur;
      var dropChordRoot = padFreqs[0] * dropChord.ratio;
      if (plan.drop.pad) {
        smoothSet(padOsc1.frequency, dropChordRoot, 0.055, dropChordTime);
        smoothSet(padOsc2.frequency, dropChordRoot * Math.pow(2, 7 / 12), 0.055, dropChordTime);
      }
      playChord(dropChordRoot, dropChordTime,
        15 * stepDur, chordGain, dropChord.quality, instrumentation.chord === 'stab' ? 'haze' : instrumentation.chord);
    }

    // 结局专属的额外乐器层：House chord stab、Melodic arp、Trap bell、Dubstep screech。
    for (var layerBar = 0; layerBar < plan.drop.bars; layerBar++) {
      var layerChord = chordProgression[layerBar % chordProgression.length];
      var layerRoot = padFreqs[0] * layerChord.ratio;
      if (plan.genre === 'bassHouse') {
        for (var stab = 0; stab < 4; stab++) {
          playChord(layerRoot * 2, dropStart + (layerBar * 16 + 2 + stab * 4) * stepDur,
            stepDur * 1.3, 0.038, layerChord.quality, 'stab');
        }
      } else if (plan.genre === 'melodicDubstep' || plan.genre === 'destinyFusion') {
        var layerTones = layerChord.quality === 'major' ? [0, 7, 12, 16] : [0, 7, 10, 15];
        for (var pluck = 0; pluck < layerTones.length; pluck++) {
          playLeadNote(layerRoot * 2 * Math.pow(2, layerTones[(pluck + layerBar) % layerTones.length] / 12),
            dropStart + (layerBar * 16 + 2 + pluck * 4) * stepDur, stepDur * 1.1,
            plan.genre === 'melodicDubstep' ? 0.014 : 0.011, 'pluck');
        }
      } else if (plan.genre === 'hybridTrap' && layerBar % 2 === 0) {
        playLeadNote(layerRoot * 4 * minorScale[(layerBar + 1) % minorScale.length],
          dropStart + (layerBar * 16 + 10) * stepDur, stepDur * 2.3, 0.017, 'pluck');
      } else if (plan.genre === 'brostep' && layerBar % 2 === 1) {
        playLeadNote(layerRoot * 4 * minorScale[4], dropStart + (layerBar * 16 + 12) * stepDur,
          stepDur * 1.7, 0.016, 'screech');
      } else if (plan.genre === 'riddimDubstep' && layerBar % 2 === 1) {
        playLeadNote(layerRoot * 2 * minorScale[1], dropStart + (layerBar * 16 + 14) * stepDur,
          stepDur * 1.4, 0.014, 'hollow');
      }
    }

    // Drop 旋律：有留白的两小节 A/B 乐句；Variation 决定后半段如何发展。
    if (plan.drop.melody) {
      var dropMelodyA = [
        { step: 0, note: 0, dur: 3 }, { step: 4, note: 2, dur: 2 }, { step: 7, note: 4, dur: 3 },
        { step: 12, note: 3, dur: 2 }, { step: 16, note: 1, dur: 3 }, { step: 21, note: 3, dur: 2 },
        { step: 24, note: 5, dur: 3 }, { step: 29, note: 4, dur: 2 }
      ];
      var dropMelodyB = [
        { step: 0, note: 0, dur: 2 }, { step: 3, note: 3, dur: 2 }, { step: 6, note: 2, dur: 2 },
        { step: 10, note: 4, dur: 3 }, { step: 15, note: 1, dur: 2 }, { step: 18, note: 2, dur: 2 },
        { step: 22, note: 5, dur: 3 }, { step: 27, note: 3, dur: 2 }, { step: 30, note: 4, dur: 2 }
      ];
      for (var melodyBlock = 0; melodyBlock < plan.drop.bars / 2; melodyBlock++) {
        var motif = melodyBlock % 2 ? dropMelodyB : dropMelodyA;
        if (plan.variation === 'mutate' && melodyBlock >= 2) motif = melodyBlock % 2 ? dropMelodyA : dropMelodyB;
        var melodyTranspose = (plan.variation === 'lift' && melodyBlock >= 2) ? 1.5 : 1;
        for (var dm = 0; dm < motif.length; dm++) {
          var dropEvent = motif[dm];
          var dropMelodyTime = dropStart + (melodyBlock * 32 + dropEvent.step) * stepDur;
          playLeadNote(padFreqs[0] * 2 * minorScale[dropEvent.note] * melodyTranspose,
            dropMelodyTime, dropEvent.dur * stepDur,
            plan.genre === 'melodicDubstep' ? 0.056 : 0.042, instrumentation.lead);
        }
      }

      // 后半段回应旋律：比主旋律更稀疏，构成问答而不是简单加倍。
      var responseMelody = [
        { step: 68, note: 4, dur: 3 }, { step: 76, note: 2, dur: 2 },
        { step: 84, note: 3, dur: 3 }, { step: 94, note: 1, dur: 2 },
        { step: 101, note: 5, dur: 3 }, { step: 110, note: 3, dur: 2 },
        { step: 120, note: 2, dur: 3 }, { step: 125, note: 0, dur: 2 }
      ];
      for (var rm = 0; rm < responseMelody.length; rm++) {
        var responseEvent = responseMelody[rm];
        playLeadNote(padFreqs[0] * minorScale[responseEvent.note] * 4,
          dropStart + responseEvent.step * stepDur, responseEvent.dur * stepDur,
          plan.genre === 'melodicDubstep' ? 0.018 : 0.013, 'hollow');
      }
    }

    // Drop: 用户 Pattern 接管后半段 Bass，并可追加鼓 Fill / 和弦 Stab
    if (hasUserPattern) {
      var evs = state.performance.events;
      var dropStepDur8 = (60 / bpm) / 2; // 八分音符
      var patternOffset = dropStart + dropHalfSteps * stepDur;
      for (var repetition = 0; repetition < 4; repetition++) {
        for (var e = 0; e < evs.length; e++) {
          var ev = evs[e];
          var et = patternOffset + repetition * 8 * dropStepDur8 + ev.step * dropStepDur8;
          if (et >= dropEnd) continue;
          var patternAbsStep = dropHalfSteps + repetition * 16 + ev.step * 2;
          var patternPhraseStep = (repetition * 16 + ev.step * 2) % 32;
          var patternArticulation = getBassArticulation(plan.genre, patternPhraseStep, patternAbsStep, plan.variation);
          var patternDuration = Math.min(dropStepDur8 * 1.3, stepDur * Math.max(0.75, patternArticulation.duration));
          var patternBassFreq = bassFreq;
          if (plan.genre === 'melodicDubstep' || plan.genre === 'bassHouse' ||
              plan.genre === 'hybridTrap' || plan.genre === 'destinyFusion') {
            patternBassFreq *= chordProgression[repetition % chordProgression.length].ratio;
          }

          if (ev.pad === 'D') {
            scheduleBassPitch(patternBassFreq, et);
            scheduleBassColor(synth, patternBassFreq, et, patternDuration, patternArticulation);
            triggerBassNote(et, patternDuration);
            scheduleGenreBassLayer(plan.genre, patternBassFreq, et, stepDur,
              patternAbsStep, patternPhraseStep);
            playKick(et);
          } else if (ev.pad === 'F') {
            scheduleBassPitch(patternBassFreq * 1.5, et);
            scheduleBassColor(synth, patternBassFreq * 1.5, et, patternDuration, patternArticulation);
            triggerBassNote(et, patternDuration);
            scheduleGenreBassLayer(plan.genre, patternBassFreq * 1.5, et, stepDur,
              patternAbsStep, patternPhraseStep);
            scheduleBassPitch(patternBassFreq, et + patternDuration + 0.01);
          } else if (ev.pad === 'J') {
            playSnare(et);
            playHihat(et + dropStepDur8 * 0.3, 0.05);
            playSnare(et + dropStepDur8 * 0.6);
          } else if (ev.pad === 'K') {
            var patternChord = chordProgression[repetition % chordProgression.length];
            playChord(padFreqs[0] * patternChord.ratio, et, dropStepDur8 * 0.9, 0.075, patternChord.quality, 'stab');
          }
        }
      }
    }

    currentTracking = null;

    // 不在此处恢复参数 — Drop 强度曲线必须在整次播放期间保持
    // 恢复在 stopFinalSong 和自然结束时进行

    var totalDur = dropEnd - t0;
    finalSongEndTime = dropEnd;

    // 自然结束：静音并恢复持久参数
    if (finalSongTimerId) clearTimeout(finalSongTimerId);
    finalSongTimerId = setTimeout(function () {
      finalSongTimerId = null;
      isFinalSongPlaying = false;
      finalSongNodes = [];
      silenceAndRestoreParams(state);
      finalSongState = null;
      if (finalSongCompleteCb) {
        var cb = finalSongCompleteCb;
        finalSongCompleteCb = null;
        cb();
      }
    }, totalDur * 1000 + 500);
  }

  function stopFinalSong() {
    if (finalSongTimerId) {
      clearTimeout(finalSongTimerId);
      finalSongTimerId = null;
    }
    isFinalSongPlaying = false;
    finalSongCompleteCb = null;

    // 停止所有一次性节点
    for (var i = 0; i < finalSongNodes.length; i++) {
      var n = finalSongNodes[i];
      try { if (n.stop) n.stop(); } catch (e) {}
      try { n.disconnect(); } catch (e) {}
    }
    finalSongNodes = [];

    // 取消持久参数的自动化事件并安全淡出 + 恢复正常参数
    silenceAndRestoreParams(finalSongState);
    finalSongState = null;
  }

  function getIsFinalSongPlaying() {
    return isFinalSongPlaying;
  }

  function getFinalSongPosition() {
    if (!ctx || !isFinalSongPlaying) return null;
    var remaining = finalSongEndTime - ctx.currentTime;
    if (remaining < 0) return { playing: false };
    return { playing: true, remaining: remaining };
  }

  function stop() {
    stopPreview();
    stopFinalSong();
    stopPattern();
    stopLoop();
    destroyGraph();
  }

  function setMuted(m) {
    muted = m;
    if (masterGain && ctx) {
      smoothSet(masterGain.gain, m ? 0 : 0.35, 0.02);
    }
  }

  function getAnalyser() {
    return analyser;
  }

  function getIsPlaying() {
    return (isLooping && !isPaused) || isFinalSongPlaying;
  }

  function getPosition() {
    if (!ctx || !isLooping || !loopStartTime) return null;
    var elapsed = ctx.currentTime - loopStartTime;
    if (elapsed < 0) return { bar: 1, beat: 1, sixteenth: 1 };
    var beatDur = 60 / currentBpm;
    var stepDur16 = beatDur / 4;
    var totalSteps = Math.floor(elapsed / stepDur16);
    var stepInLoop = totalSteps % 32;
    var bar = Math.floor(stepInLoop / 16) + 1;
    var beat = Math.floor((stepInLoop % 16) / 4) + 1;
    var sixteenth = (stepInLoop % 4) + 1;
    return { bar: bar, beat: beat, sixteenth: sixteenth };
  }

  function getBpm() {
    return currentBpm;
  }

  function setPaused(p) {
    if (!isLooping) return;
    isPaused = p;
    if (p) {
      if (timerID) { clearTimeout(timerID); timerID = null; }
      if (padGain) smoothSet(padGain.gain, 0, 0.05);
      if (bassGate) smoothSet(bassGate.gain, 0, 0.03);
      if (subGate) smoothSet(subGate.gain, 0, 0.03);
    } else {
      if (ctx) {
        nextNoteTime = ctx.currentTime + 0.05;
        loopStartTime = nextNoteTime;
        stepIndex = 0;
        if (padGain) smoothSet(padGain.gain, padTargetGain, 0.1);
        scheduler();
      }
    }
  }

  function getIsPaused() {
    return isPaused;
  }

  // ── 暴露 ──────────────────────────────────────────
  global.AudioEngine = {
    start: start,
    applyState: applyState,
    previewChoice: previewChoice,
    playPattern: playPattern,
    stopPattern: stopPattern,
    getIsPatternPlaying: getIsPatternPlaying,
    playFinalSong: playFinalSong,
    stopFinalSong: stopFinalSong,
    getIsFinalSongPlaying: getIsFinalSongPlaying,
    getFinalSongPosition: getFinalSongPosition,
    stop: stop,
    setMuted: setMuted,
    getAnalyser: getAnalyser,
    getIsPlaying: getIsPlaying,
    getPosition: getPosition,
    getBpm: getBpm,
    setPaused: setPaused,
    getIsPaused: getIsPaused
  };

})(typeof window !== 'undefined' ? window : global);
