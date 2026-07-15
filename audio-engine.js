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
  var compressor = null;
  var analyser = null;
  var masterGain = null;
  var muted = false;

  // ── 持久 Bass 节点 ─────────────────────────────────
  var bassOsc = null;
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
  var currentGrowlVal = 0.5;   // 0-1, 用于 playBassOneShot 复用
  var currentBodyVal = 0.5;    // 0-1, 用于 Pattern one-shot 音量

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
    if (!state.bassMacros || state.bassMacros[key] == null) return 50;
    return state.bassMacros[key];
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

    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -10;
    compressor.knee.value = 20;
    compressor.ratio.value = 6;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.1;

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
    bassOutGain.gain.value = 0.15;

    bassOsc.connect(bassFilter);
    bassFilter.connect(bassShaper);
    bassShaper.connect(bassGate);
    bassGate.connect(bassOutGain);
    bassOutGain.connect(sumGain);

    // ── Sub 链 ──
    subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.value = 27.5; // 比 bass 低八度

    subGate = ctx.createGain();
    subGate.gain.value = 0;

    subGain = ctx.createGain();
    subGain.gain.value = 0.1;

    subOsc.connect(subGate);
    subGate.connect(subGain);
    subGain.connect(sumGain);

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
    padGain.connect(sumGain);

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
    delaySend.connect(delayNode);
    delayNode.connect(feedbackGain);
    feedbackGain.connect(delayNode); // 反馈回路
    delayNode.connect(delayWet);
    delayWet.connect(sumGain);

    // 启动持久振荡器
    bassOsc.start();
    subOsc.start();
    lfo.start();
    padOsc1.start();
    padOsc2.start();
  }

  // ── 销毁持久音频图 ─────────────────────────────────

  function destroyGraph() {
    var persistentNodes = [
      bassOsc, subOsc, lfo, padOsc1, padOsc2
    ];
    var allNodes = [
      bassOsc, bassFilter, bassShaper, bassGate, bassOutGain,
      subOsc, subGate, subGain,
      lfo, lfoDepth,
      padOsc1, padOsc2, padGain,
      delaySend, delayNode, feedbackGain, delayWet,
      sumGain, compressor, analyser, masterGain
    ];

    for (var i = 0; i < persistentNodes.length; i++) {
      var n = persistentNodes[i];
      if (n) { try { n.stop(); } catch (e) {} }
    }
    for (var j = 0; j < allNodes.length; j++) {
      var m = allNodes[j];
      if (m) { try { m.disconnect(); } catch (e) {} }
    }

    bassOsc = null; bassFilter = null; bassShaper = null;
    bassGate = null; bassOutGain = null;
    subOsc = null; subGate = null; subGain = null;
    lfo = null; lfoDepth = null;
    padOsc1 = null; padOsc2 = null; padGain = null;
    delaySend = null; delayNode = null; feedbackGain = null; delayWet = null;
    sumGain = null; compressor = null; analyser = null; masterGain = null;
  }

  // ── 鼓组合成 ───────────────────────────────────────

  function playKick(time) {
    if (!ctx || !sumGain) return;
    var t = time || ctx.currentTime;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(0.01, t + 0.3);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(g);
    g.connect(sumGain);
    osc.start(t);
    osc.stop(t + 0.35);
    if (currentTracking) { currentTracking.push(osc, g); }
  }

  function playSnare(time) {
    if (!ctx || !sumGain) return;
    var t = time || ctx.currentTime;
    var dur = 0.15;
    var bufSize = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.3));
    }
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var g = ctx.createGain();
    g.gain.value = 0.2;
    var filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1000;
    src.connect(filter);
    filter.connect(g);
    g.connect(sumGain);
    src.start(t);
    if (currentTracking) { currentTracking.push(src, g, filter); }
  }

  function playHihat(time, gainVal) {
    if (!ctx || !sumGain) return;
    var t = time || ctx.currentTime;
    var dur = 0.05;
    var bufSize = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.1));
    }
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var g = ctx.createGain();
    g.gain.value = gainVal || 0.06;
    var filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6000;
    src.connect(filter);
    filter.connect(g);
    g.connect(sumGain);
    src.start(t);
    if (currentTracking) { currentTracking.push(src, g, filter); }
  }

  // ── Bass 音符触发 ──────────────────────────────────

  function triggerBassNote(time, duration) {
    if (!bassGate || !ctx) return;
    var d = Math.max(0.03, duration);
    scheduleGateEnvelope(bassGate.gain, time, d, 0.9);
    if (subGate) scheduleGateEnvelope(subGate.gain, time, d, 0.82);
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
      playHihat(time, hh > 1 ? 0.04 : 0.07);
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

    var macros = state.bassMacros || { body: 50, growl: 50, wobble: 50, space: 50 };
    var body = macros.body / 100;
    var growl = macros.growl / 100;
    var wobble = macros.wobble / 100;

    // 振荡器频率
    var sw = state.choices.soundWorld;
    var freqs = SW_FREQS[sw] || SW_FREQS.abyss;
    if (freqs.bass !== currentBassFreq) {
      currentBassFreq = freqs.bass;
      smoothSet(bassOsc.frequency, currentBassFreq, 0.01);
      smoothSet(subOsc.frequency, currentBassFreq / 2, 0.01);
    }

    // 振荡器类型
    var personality = state.choices.bassPersonality;
    var oscType = PERSONALITY_OSC[personality] || 'sawtooth';
    if (oscType !== currentBassType) {
      currentBassType = oscType;
      bassOsc.type = oscType;
    }

    // Body → Sub 音量/厚度
    currentBodyVal = body;
    smoothSet(subGain.gain, 0.02 + body * 0.35, 0.02);
    smoothSet(bassOutGain.gain, 0.05 + body * 0.20, 0.02);

    // Growl → 失真 + 滤波器共振 + 截止频率
    currentGrowlVal = growl;  // 保存供 playBassOneShot 复用
    bassShaper.curve = makeDistortionCurve(growl);
    smoothSet(bassFilter.Q, 1 + growl * 14, 0.02);

    // Wobble → LFO rate/depth
    updateLfoRate(state);
    smoothSet(lfoDepth.gain, Math.pow(wobble, 1.5) * 2500, 0.02);

    // Growl 影响 baseline 截止频率（growl 高 = 更暗）
    var baselineFreq = 2000 - growl * 1600;
    // 注意：LFO 在 baseline 上叠加调制，所以只设 baseline
    // 用 setValueAtTime 避免与 LFO 冲突——LFO 通过 lfoDepth 控制幅度
    // baseline 设为滤波器的 value（LFO 在此之上叠加）
    // 但 setTargetAtTime 会和 LFO 抢占 frequency param
    // 解决：用一个固定 gain 偏置 + LFO depth
    // 实际上 Web Audio 中 LFO 连接到 frequency 会叠加在 value 之上
    // 所以 setTargetAtTime 设置 baseline，LFO 在此之上调制
    smoothSet(bassFilter.frequency, baselineFreq, 0.02);
  }

  function updateLfoRate(state) {
    if (!lfo || !ctx) return;
    var wobble = macroVal(state, 'wobble') / 100;
    var beatRate = currentBpm / 60;
    // wobble=0: 0.5 Hz (几乎不动), wobble=1: 4×beatRate (快)
    var lfoRate = beatRate * (0.5 + wobble * 3.5);
    smoothSet(lfo.frequency, lfoRate, 0.03);
  }

  // ── Pad 参数更新 ───────────────────────────────────

  function updatePadParams(state) {
    if (!padOsc1 || !ctx) return;

    var sw = state.choices.soundWorld;
    var freqs = SW_FREQS[sw] || SW_FREQS.abyss;

    if (freqs.pad[0] !== padOsc1.frequency.value) {
      smoothSet(padOsc1.frequency, freqs.pad[0], 0.05);
      smoothSet(padOsc2.frequency, freqs.pad[1], 0.05);
    }

    // Space 影响 pad 音量
    var space = macroVal(state, 'space') / 100;
    padTargetGain = 0.02 + space * 0.06;
    if (!isPaused) {
      smoothSet(padGain.gain, padTargetGain, 0.05);
    }
  }

  // ── 效果参数更新 ───────────────────────────────────

  function updateEffects(state) {
    if (!delaySend || !ctx) return;

    var space = macroVal(state, 'space') / 100;

    // Space → Delay send + feedback
    smoothSet(delaySend.gain, space * 0.4, 0.03);
    smoothSet(feedbackGain.gain, 0.15 + space * 0.35, 0.03);

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

    if (phase === 'rhythm') {
      // 节奏预览：播放 2 拍 kick/snare
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
      playOneShot(f, 0.3, phase === 'bassPersonality' ? 'sawtooth' : 'sine', 0.15);
    }
  }

  function playOneShot(freq, duration, type, gainVal, startTime) {
    if (!ctx || !sumGain) return;
    var t = startTime || ctx.currentTime;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gainVal || 0.15, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(g);
    g.connect(sumGain);
    osc.start(t);
    osc.stop(t + duration + 0.05);
    if (currentTracking) { currentTracking.push(osc, g); }
  }

  // ── 创建使用当前 Bass 音色的一次性振荡器 ─────────────
  // 用于 Pattern 试听和最终歌曲中的 D/F Pad

  function playBassOneShot(freq, duration, gainVal, startTime, extraDistort) {
    if (!ctx || !sumGain || !bassShaper) return;
    var t = startTime || ctx.currentTime;
    var osc = ctx.createOscillator();
    var shaper = ctx.createWaveShaper();
    var filter = ctx.createBiquadFilter();
    var g = ctx.createGain();

    osc.type = currentBassType || 'sawtooth';
    osc.frequency.value = freq;

    // 复制当前 bass 的滤波器设置
    filter.type = 'lowpass';
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
    g.connect(sumGain);
    osc.start(t);
    osc.stop(t + duration + 0.05);
    if (currentTracking) { currentTracking.push(osc, g, filter, shaper); }
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

    // Drop 强度 → 混音参数
    var intensity;
    if (drop === 'gentle') {
      intensity = { distortMult: 0.45, gainMult: 0.65, drumDensity: 0, spaceMult: 1.6 };
    } else if (drop === 'overload') {
      intensity = { distortMult: 1.9, gainMult: 1.35, drumDensity: 2, spaceMult: 0.6 };
    } else {
      intensity = { distortMult: 1.0, gainMult: 1.0, drumDensity: 1, spaceMult: 1.0 };
    }

    // 基础计划：2+4+8=14 小节
    var plan = {
      intro: { bars: 2, pad: true, drums: false, bass: false, melody: false },
      build: { bars: 4, pad: true, drums: 'gradual', bass: 'default', melody: false },
      drop:  { bars: 8, pad: true, drums: 'full', bass: 'default', melody: false },
      totalBars: 14,
      intensity: intensity,
      variation: variation,
      structure: structure
    };

    if (structure === 'classicDrop') {
      // 明显停顿后重拍进入
      plan.drop.pauseBefore = true;
    } else if (structure === 'melodicNarrative') {
      // Build-up 保留旋律，Drop 中旋律与 Bass 共同出现
      plan.intro.melody = true;
      plan.build.melody = true;
      plan.build.bass = 'melodic';
      plan.drop.melody = true;
    } else if (structure === 'minimalTech') {
      // 元素更少，靠节奏和滤波推进
      plan.intro.pad = false;
      plan.intro.filter = true;
      plan.build.pad = false;
      plan.build.drums = 'sparse';
      plan.build.filter = true;
      plan.drop.pad = false;
      plan.drop.drums = 'lean';
    } else if (structure === 'epicJourney') {
      // Build-up 更宽、更有上升感，Drop 更有冲击力
      plan.build.drums = 'rising';
      plan.build.rising = true;
      plan.drop.extraSub = true;
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
      bassFilter ? bassFilter.frequency : null,
      bassFilter ? bassFilter.Q : null,
      bassOutGain ? bassOutGain.gain : null,
      subGain ? subGain.gain : null,
      padGain ? padGain.gain : null,
      padOsc1 ? padOsc1.frequency : null,
      padOsc2 ? padOsc2.frequency : null,
      lfoDepth ? lfoDepth.gain : null,
      delaySend ? delaySend.gain : null,
      feedbackGain ? feedbackGain.gain : null
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

    // 恢复用户正常参数
    if (state) {
      var growl = macroVal(state, 'growl') / 100;
      var body = macroVal(state, 'body') / 100;
      var space = macroVal(state, 'space') / 100;

      if (bassShaper) bassShaper.curve = makeDistortionCurve(growl);
      currentGrowlVal = growl;
      if (bassOutGain) smoothSet(bassOutGain.gain, 0.05 + body * 0.20, 0.05, now);
      if (subGain) smoothSet(subGain.gain, 0.02 + body * 0.35, 0.05, now);
      if (bassFilter) {
        smoothSet(bassFilter.frequency, 2000 - growl * 1600, 0.05, now);
        smoothSet(bassFilter.Q, 1 + growl * 14, 0.05, now);
      }
      if (delaySend) smoothSet(delaySend.gain, space * 0.4, 0.05, now);
      if (feedbackGain) smoothSet(feedbackGain.gain, 0.15 + space * 0.35, 0.05, now);
    }
  }

  // ── 最终歌曲：调度 ─────────────────────────────────

  function playFinalSong(state, completeCb) {
    ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

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
    var rId = getRhythmId(state);
    var basePat = DRUM_PATTERNS[rId] || DRUM_PATTERNS.halfTime;

    var sw = state.choices.soundWorld;
    var freqs = SW_FREQS[sw] || SW_FREQS.abyss;
    var bassFreq = freqs.bass;
    var padFreqs = freqs.pad;

    var bassPat = state.choices.bassPersonality === 'melodic' ? BASS_PATTERNS.melodic : BASS_PATTERNS.default;

    // 保存原始参数（使用 macroVal 避免 0 被替换为 50）
    var origGrowl = macroVal(state, 'growl');
    var origBody = macroVal(state, 'body');
    var origSpace = macroVal(state, 'space');

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

    // Intro 旋律 (melodicNarrative)
    if (plan.intro.melody) {
      var iMelNotes = [padFreqs[0], padFreqs[0] * 1.26, padFreqs[0] * 1.5, padFreqs[0] * 1.26];
      for (var im = 0; im < introSteps; im += 4) {
        playOneShot(iMelNotes[Math.floor(im / 4) % 4], stepDur * 3, 'triangle', 0.05, introStart + im * stepDur);
      }
    }

    // ════════════════════════════════════════════════
    // 2. Build-up (4 bars)
    // ════════════════════════════════════════════════
    if (plan.build.pad) {
      smoothSet(padGain.gain, 0.02 + (origSpace / 100) * 0.05, 0.1, buildStart);
    }

    // Build-up 鼓组
    if (plan.build.drums) {
      var bDrumMode = plan.build.drums;
      for (var bs = 0; bs < buildSteps; bs++) {
        var bsTime = buildStart + bs * stepDur;
        var bpi = bs % 32;
        var bProg = bs / buildSteps;

        var bKick = false, bSnare = false, bHat = false;

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

        // Classic Drop: 最后 2 拍静默作为停顿
        if (plan.drop.pauseBefore && bProg > 0.875) {
          bKick = false; bSnare = false; bHat = false;
        }

        if (bKick) playKick(bsTime);
        if (bSnare) playSnare(bsTime);
        if (bHat) playHihat(bsTime, 0.06);
      }
    }

    // Build-up bass — 后半段进入
    if (plan.build.bass) {
      var bBassMode = plan.build.bass;
      var bBassPat = bBassMode === 'melodic' ? BASS_PATTERNS.melodic : BASS_PATTERNS.default;
      for (var bb = 0; bb < buildSteps; bb++) {
        var bbProg = bb / buildSteps;
        if (bbProg > 0.4 && bBassPat[bb % 32]) {
          var bbFreq = bassFreq;
          if (plan.build.rising) {
            bbFreq = bassFreq * (1 + bbProg * 0.3);
          }
          var bbTime = buildStart + bb * stepDur;
          if (bassOsc) {
            smoothSet(bassOsc.frequency, bbFreq, 0.005, bbTime);
            triggerBassNote(bbTime, stepDur * 1.2);
          }
        }
      }
    }

    // Build-up 旋律 (melodicNarrative)
    if (plan.build.melody) {
      var bMelNotes = [padFreqs[0], padFreqs[0] * 1.26, padFreqs[0] * 1.5, padFreqs[0] * 1.26,
                       padFreqs[0] * 1.5, padFreqs[0], padFreqs[0] * 1.26, padFreqs[0] * 1.5];
      for (var bm = 0; bm < buildSteps; bm += 2) {
        playOneShot(bMelNotes[Math.floor(bm / 2) % 8], stepDur * 1.5, 'triangle', 0.04, buildStart + bm * stepDur);
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

    bassShaper.curve = makeDistortionCurve(Math.min(100, Math.max(0, origGrowl * distortMult)) / 100);
    smoothSet(bassOutGain.gain, (0.05 + (origBody / 100) * 0.20) * gainMult, 0.05, dropStart);

    // Drop pad
    if (plan.drop.pad) {
      smoothSet(padGain.gain, (0.02 + (origSpace / 100) * 0.06) * spaceMult, 0.1, dropStart);
    } else {
      smoothSet(padGain.gain, 0, 0.05, dropStart);
    }

    // Epic Journey: 额外 sub 增强冲击力
    if (plan.drop.extraSub && subGain) {
      smoothSet(subGain.gain, 0.15, 0.05, dropStart);
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
      var dHatGain = 0.07;

      if (dDrumMode === 'full') {
        dKick = !!basePat.kick[dpi];
        dSnare = !!basePat.snare[dpi];
        dHat = !!dropHihatPat[dpi];
        if (drumDensity === 2) dHatGain = 0.05;
      } else if (dDrumMode === 'lean') {
        // Minimal Tech: kick + snare + 按 groove density 调整 hi-hat
        dKick = !!basePat.kick[dpi];
        dSnare = !!basePat.snare[dpi];
        dHat = !!leanHihatPat[dpi];
      }

      // Classic Drop: 跳过第一拍（已用强 kick 覆盖）
      if (plan.drop.pauseBefore && ds === 0) {
        dKick = false;
      }

      if (dKick) playKick(dsTime);
      if (dSnare) playSnare(dsTime);
      if (dHat) playHihat(dsTime, dHatGain);

      // Overload + Busy: 额外 fill（两个维度都高时才加 fill）
      if (drumDensity === 2 && grooveDensity >= 1 && ds % 16 === 14) {
        playSnare(dsTime);
        playHihat(dsTime + stepDur * 0.5, 0.05);
      }
      // Busy groove: 每 8 步加 ghost fill
      if (grooveDensity === 2 && ds % 8 === 6 && !dHat) {
        playHihat(dsTime, 0.04);
      }
    }

    // Drop bass — Variation 影响后半段（第 5-8 小节）
    var dropBassPatA = bassPat;     // 前半段 pattern
    var dropBassPatB = bassPat;     // 后半段 pattern (repeat 默认相同)
    var dropBassFreqB = bassFreq;   // 后半段频率

    if (plan.variation === 'mutate') {
      // Mutate: 后半段修改 Bass rhythm
      dropBassPatB = [
        1,0,0,1, 0,0,1,0, 1,0,0,0, 0,1,0,0,
        1,0,1,0, 0,1,0,0, 1,0,0,1, 0,0,1,0
      ];
    } else if (plan.variation === 'lift') {
      // Lift: 后半段提高音区
      dropBassFreqB = bassFreq * 1.5; // 上行五度
    }

    for (var db = 0; db < dropSteps; db++) {
      var dbTime = dropStart + db * stepDur;
      var isSecondHalf = db >= dropHalfSteps;
      var usePat = isSecondHalf ? dropBassPatB : dropBassPatA;
      var useFreq = isSecondHalf ? dropBassFreqB : bassFreq;

      if (usePat[db % 32]) {
        if (bassOsc) {
          smoothSet(bassOsc.frequency, useFreq, 0.005, dbTime);
          triggerBassNote(dbTime, stepDur * 1.5);
        }
      }
    }

    // Drop 旋律 (melodicNarrative: 旋律与 Bass 共同出现)
    if (plan.drop.melody) {
      var dMelNotes = [padFreqs[0], padFreqs[0] * 1.26, padFreqs[0] * 1.5, padFreqs[0] * 1.26,
                       padFreqs[0] * 1.5, padFreqs[0], padFreqs[0] * 1.26, padFreqs[0] * 1.5,
                       padFreqs[0], padFreqs[0] * 1.5, padFreqs[0] * 1.26, padFreqs[0],
                       padFreqs[0] * 1.26, padFreqs[0] * 1.5, padFreqs[0], padFreqs[0] * 1.26];
      for (var dm = 0; dm < dropSteps; dm += 2) {
        playOneShot(dMelNotes[Math.floor(dm / 2) % 16], stepDur * 1.5, 'triangle', 0.05, dropStart + dm * stepDur);
      }
    }

    // Drop: 后半段叠加用户 Pattern
    if (state.performance && state.performance.events &&
        state.performance.events.length > 0) {
      var evs = state.performance.events;
      var dropStepDur8 = (60 / bpm) / 2; // 八分音符
      var patternOffset = dropStart + dropHalfSteps * stepDur;
      for (var e = 0; e < evs.length; e++) {
        var ev = evs[e];
        var et = patternOffset + ev.step * dropStepDur8;
        if (et >= dropEnd) break;

        if (ev.pad === 'D') {
          if (bassOsc) {
            smoothSet(bassOsc.frequency, bassFreq, 0.005, et);
            triggerBassNote(et, dropStepDur8 * 0.9);
          }
          playKick(et);
        } else if (ev.pad === 'F') {
          if (bassOsc) {
            smoothSet(bassOsc.frequency, bassFreq * 1.5, 0.005, et);
            triggerBassNote(et, dropStepDur8 * 0.9);
            smoothSet(bassOsc.frequency, bassFreq, 0.005, et + dropStepDur8 * 0.9 + 0.01);
          }
        } else if (ev.pad === 'J') {
          playSnare(et);
          playHihat(et + dropStepDur8 * 0.3, 0.05);
          playSnare(et + dropStepDur8 * 0.6);
        } else if (ev.pad === 'K') {
          playOneShot(padFreqs[0], dropStepDur8 * 0.9, 'sine', 0.12, et);
          playOneShot(padFreqs[1], dropStepDur8 * 0.9, 'triangle', 0.10, et);
          playOneShot(padFreqs[0] * 1.5, dropStepDur8 * 0.9, 'sine', 0.08, et);
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
