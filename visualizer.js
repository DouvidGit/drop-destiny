/**
 * DROP//DESTINY — visualizer.js
 * Dependency-free, file:// safe audio-reactive generative stage.
 *
 * The visual graph reuses AudioEngine.getAnalyser(). It combines logarithmic FFT
 * bands, attack/release envelopes, adaptive beat detection, feedback trails and
 * deterministic particle fields. Public legacy methods remain available.
 */
(function (global) {
  'use strict';

  var canvas = null;
  var output = null;
  var analyser = null;
  var rafId = null;
  var resizeObserver = null;
  var running = false;
  var cssWidth = 1;
  var cssHeight = 1;
  var dpr = 1;
  var lastFrameTime = 0;
  var reducedMotion = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var frameCanvas = document.createElement('canvas');
  var frameCtx = frameCanvas.getContext('2d');
  var historyCanvas = document.createElement('canvas');
  var historyCtx = historyCanvas.getContext('2d');

  var waveBuffer = null;
  var freqBuffer = null;
  var logBands = new Float32Array(48);
  var bassHistory = [];
  var lastBeatAt = 0;
  var beatPulse = 0;
  var transitionFlash = 0;
  var theme = 'default';
  var intensity = 0.5;
  var manualModeIndex = 0;
  var MANUAL_MODES = ['auto', 'shred', 'bunker', 'fracture'];
  var MODE_LABELS = { auto: 'AUTO', shred: 'SHRED', bunker: 'BUNKER', fracture: 'FRACTURE' };
  var sceneSignature = '';

  var experience = {
    phase: 'intro',
    choices: {},
    synth: {},
    dna: {},
    style: null
  };
  var playback = {
    isFinal: false,
    progress: 0,
    section: 'creation'
  };

  var metrics = {
    bass: 0,
    mid: 0,
    treble: 0,
    rms: 0,
    beat: false,
    scene: 'intro',
    sceneLabel: 'DESTINY SIGNAL',
    sectionLabel: 'CREATION LOOP',
    mode: 'auto',
    drive: 0.5
  };

  var smooth = { bass: 0, mid: 0, treble: 0, rms: 0 };
  var particles = [];
  var padBursts = [];

  var THEMES = {
    abyss:         { bg: '#030303', a: '#FFFFFF', b: '#A60019', c: '#5B0010' },
    neonCity:      { bg: '#050505', a: '#F4F4F4', b: '#FF0033', c: '#FFCE00' },
    organicForest: { bg: '#060303', a: '#EADDD5', b: '#B00020', c: '#6E0615' },
    cosmicVoid:    { bg: '#010101', a: '#EA0029', b: '#FFFFFF', c: '#606060' },
    default:       { bg: '#030303', a: '#FFFFFF', b: '#EA0029', c: '#5A0712' }
  };

  var STYLE_PALETTES = {
    riddimDubstep:  { a: '#FFFFFF', b: '#111111', c: '#EA0029' },
    brostep:        { a: '#FF0033', b: '#FFFFFF', c: '#720014' },
    hybridTrap:     { a: '#FFFFFF', b: '#EA0029', c: '#161616' },
    bassHouse:      { a: '#FFFFFF', b: '#FF153B', c: '#FFCE00' },
    melodicDubstep: { a: '#F6E7C1', b: '#3E7CB1', c: '#FFCE00' },
    destinyFusion:  { a: '#FFFFFF', b: '#EA0029', c: '#FFCE00' }
  };

  var STYLE_LABELS = {
    riddimDubstep: 'RIDDIM MONOLITH',
    brostep: 'BROSTEP REACTOR',
    hybridTrap: 'HYBRID SHARD FIELD',
    bassHouse: 'BASS HOUSE ENGINE',
    melodicDubstep: 'SUPERSAW HORIZON',
    destinyFusion: 'DESTINY KALEIDOSCOPE'
  };

  var SECTION_LABELS = {
    creation: 'CREATION LOOP',
    intro: 'SONG / INTRO',
    build: 'SONG / BUILD UP',
    predrop: 'SONG / GRAVITY BREAK',
    dropA: 'SONG / DROP A',
    dropB: 'SONG / DROP B — MUTATION',
    outro: 'SONG / AFTERGLOW'
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, amount) {
    return a + (b - a) * amount;
  }

  function attackRelease(current, target, attack, release) {
    return lerp(current, target, target > current ? attack : release);
  }

  function hashSeed(seed) {
    var value = seed || 2463534242;
    return function () {
      value ^= value << 13;
      value ^= value >>> 17;
      value ^= value << 5;
      return ((value >>> 0) % 1000000) / 1000000;
    };
  }

  function hexToRgb(hex) {
    var clean = (hex || '#000000').replace('#', '');
    if (clean.length === 3) clean = clean.replace(/(.)/g, '$1$1');
    var value = parseInt(clean, 16);
    return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
  }

  function parseColor(color) {
    if ((color || '').indexOf('#') === 0) return hexToRgb(color);
    var match = String(color || '').match(/\d+/g);
    return match ? { r: +match[0], g: +match[1], b: +match[2] } : { r: 0, g: 0, b: 0 };
  }

  function colorMix(a, b, amount) {
    var ca = parseColor(a);
    var cb = parseColor(b);
    return 'rgb(' + Math.round(lerp(ca.r, cb.r, amount)) + ',' +
      Math.round(lerp(ca.g, cb.g, amount)) + ',' + Math.round(lerp(ca.b, cb.b, amount)) + ')';
  }

  function alphaColor(color, alpha) {
    var c;
    if (color.indexOf('#') === 0) c = hexToRgb(color);
    else {
      var match = color.match(/\d+/g);
      c = match ? { r: +match[0], g: +match[1], b: +match[2] } : { r: 255, g: 255, b: 255 };
    }
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + clamp(alpha, 0, 1) + ')';
  }

  function resolveStyle() {
    if (experience.style) return experience.style;
    var choices = experience.choices || {};
    if (choices.rhythm === 'fourOnFloor') return 'bassHouse';
    if (choices.bassPersonality === 'melodic' || choices.structure === 'melodicNarrative') return 'melodicDubstep';
    if (choices.rhythm === 'breakbeat' || choices.structure === 'epicJourney') return 'hybridTrap';
    if (choices.bassPersonality === 'brutal' || choices.drop === 'overload') return 'brostep';
    if (choices.bassPersonality === 'mechanical' || choices.bassPersonality === 'wobbly') return 'riddimDubstep';
    return null;
  }

  function getPalette() {
    var world = THEMES[theme] || THEMES.default;
    var style = STYLE_PALETTES[resolveStyle()];
    var drive = clamp(Number(experience.synth.drive == null ? 50 : experience.synth.drive) / 100, 0, 1);
    var base = style ? {
      bg: world.bg,
      a: colorMix(world.a, style.a, 0.68),
      b: colorMix(world.b, style.b, 0.72),
      c: colorMix(world.c, style.c, 0.62)
    } : world;
    return {
      bg: colorMix(base.bg, '#000000', 0.34 + drive * 0.42),
      a: colorMix(base.a, '#FFFFFF', drive * 0.18),
      b: colorMix(base.b, '#FF0033', drive * 0.82),
      c: colorMix(base.c, '#FFFFFF', drive * 0.68)
    };
  }

  function ensureBuffers() {
    if (!analyser) return;
    if (!waveBuffer || waveBuffer.length !== analyser.fftSize) waveBuffer = new Uint8Array(analyser.fftSize);
    if (!freqBuffer || freqBuffer.length !== analyser.frequencyBinCount) freqBuffer = new Uint8Array(analyser.frequencyBinCount);
  }

  function averageFrequency(lowHz, highHz) {
    if (!freqBuffer || !freqBuffer.length || !analyser) return 0;
    var sampleRate = analyser.context ? analyser.context.sampleRate : 44100;
    var nyquist = sampleRate / 2;
    var lowBin = Math.floor(lowHz / nyquist * freqBuffer.length);
    var highBin = Math.min(freqBuffer.length - 1, Math.ceil(highHz / nyquist * freqBuffer.length));
    var sum = 0;
    var count = 0;
    for (var i = Math.max(0, lowBin); i <= highBin; i++) {
      sum += freqBuffer[i] / 255;
      count++;
    }
    return count ? sum / count : 0;
  }

  function buildLogBands() {
    if (!freqBuffer || !analyser) return;
    var sampleRate = analyser.context ? analyser.context.sampleRate : 44100;
    var nyquist = sampleRate / 2;
    for (var band = 0; band < logBands.length; band++) {
      var lowFreq = 24 * Math.pow(nyquist / 24, band / logBands.length);
      var highFreq = 24 * Math.pow(nyquist / 24, (band + 1) / logBands.length);
      var lowBin = Math.floor(lowFreq / nyquist * freqBuffer.length);
      var highBin = Math.max(lowBin + 1, Math.floor(highFreq / nyquist * freqBuffer.length));
      var sum = 0;
      var count = 0;
      for (var i = lowBin; i < highBin && i < freqBuffer.length; i++) {
        sum += freqBuffer[i] / 255;
        count++;
      }
      logBands[band] = count ? sum / count : 0;
    }
  }

  function analyseAudio(now) {
    metrics.beat = false;
    if (analyser) {
      ensureBuffers();
      analyser.getByteFrequencyData(freqBuffer);
      analyser.getByteTimeDomainData(waveBuffer);
      buildLogBands();
    } else {
      if (freqBuffer) freqBuffer.fill(0);
      if (waveBuffer) waveBuffer.fill(128);
      logBands.fill(0);
    }

    var rawBass = analyser ? averageFrequency(28, 220) : 0;
    var rawMid = analyser ? averageFrequency(220, 4200) : 0;
    var rawTreble = analyser ? averageFrequency(4200, 17000) : 0;
    var rms = 0;
    if (waveBuffer && waveBuffer.length) {
      for (var i = 0; i < waveBuffer.length; i += 2) {
        var sample = (waveBuffer[i] - 128) / 128;
        rms += sample * sample;
      }
      rms = Math.sqrt(rms / Math.ceil(waveBuffer.length / 2));
    }

    smooth.bass = attackRelease(smooth.bass, rawBass, 0.48, 0.10);
    smooth.mid = attackRelease(smooth.mid, rawMid, 0.34, 0.09);
    smooth.treble = attackRelease(smooth.treble, rawTreble, 0.38, 0.08);
    smooth.rms = attackRelease(smooth.rms, rms, 0.5, 0.12);

    bassHistory.push(rawBass);
    if (bassHistory.length > 42) bassHistory.shift();
    var historyAverage = 0;
    for (var h = 0; h < bassHistory.length; h++) historyAverage += bassHistory[h];
    historyAverage = bassHistory.length ? historyAverage / bassHistory.length : 0;
    var beatThreshold = Math.max(0.075, historyAverage * 1.34);
    if (rawBass > beatThreshold && now - lastBeatAt > 145) {
      metrics.beat = true;
      beatPulse = 1;
      lastBeatAt = now;
    }
    beatPulse *= 0.86;

    metrics.bass = smooth.bass;
    metrics.mid = smooth.mid;
    metrics.treble = smooth.treble;
    metrics.rms = smooth.rms;
  }

  function initParticles() {
    particles = [];
    var random = hashSeed(0xD09D3571);
    var count = reducedMotion ? 50 : 150;
    for (var i = 0; i < count; i++) {
      particles.push({
        x: random(), y: random(), px: random(), py: random(),
        depth: 0.2 + random() * 0.8,
        phase: random() * Math.PI * 2,
        size: 0.4 + random() * 2.2
      });
    }
  }

  function resizeBuffers() {
    if (!canvas) return;
    var rect = canvas.getBoundingClientRect();
    cssWidth = Math.max(1, Math.floor(rect.width));
    cssHeight = Math.max(1, Math.floor(rect.height));
    dpr = Math.min(2, global.devicePixelRatio || 1);
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);
    output = canvas.getContext('2d');
    output.setTransform(dpr, 0, 0, dpr, 0, 0);

    frameCanvas.width = cssWidth;
    frameCanvas.height = cssHeight;
    historyCanvas.width = cssWidth;
    historyCanvas.height = cssHeight;
    frameCtx = frameCanvas.getContext('2d');
    historyCtx = historyCanvas.getContext('2d');
    historyCtx.fillStyle = '#05050b';
    historyCtx.fillRect(0, 0, cssWidth, cssHeight);
    initParticles();
  }

  function sceneForState() {
    var manualMode = MANUAL_MODES[manualModeIndex];
    if (manualMode !== 'auto') return manualMode;
    if (playback.isFinal) {
      if (playback.section === 'build') return 'build';
      if (playback.section === 'predrop') return 'vacuum';
      if (playback.section === 'intro') return 'world';
      if (playback.section === 'outro') return 'afterglow';
      return resolveStyle() || 'kaleido';
    }
    if (experience.phase === 'soundWorld' || experience.phase === 'intro') return 'world';
    if (experience.phase === 'bassCore') return 'synth';
    if (experience.phase === 'rhythm') return 'rhythm';
    if (experience.phase === 'bassForge') return 'synth';
    if (experience.phase === 'groove') return 'rhythm';
    if (experience.phase === 'arrangement') return 'structure';
    if (experience.phase === 'liveDrop' || experience.phase === 'result') return resolveStyle() || 'kaleido';
    return 'world';
  }

  function updateSceneMetadata(scene) {
    var style = resolveStyle();
    var phaseLabels = {
      intro: 'DESTINY SIGNAL', soundWorld: 'WORLD FREQUENCY', bassCore: 'CORE MATERIAL',
      rhythm: 'RHYTHM CHASSIS', bassForge: 'BASS OSCILLOSCOPE',
      groove: 'GROOVE VECTOR GRID', arrangement: 'ARRANGEMENT ORBIT', liveDrop: 'LIVE DROP MATRIX',
      result: style ? STYLE_LABELS[style] : 'DESTINY RESOLUTION'
    };
    metrics.scene = scene;
    metrics.sceneLabel = style && (experience.phase === 'liveDrop' || experience.phase === 'result' || playback.isFinal) ?
      STYLE_LABELS[style] : (phaseLabels[experience.phase] || 'DESTINY SIGNAL');
    metrics.sectionLabel = playback.isFinal ? (SECTION_LABELS[playback.section] || 'SONG / LIVE') : 'CREATION LOOP';
    metrics.mode = MANUAL_MODES[manualModeIndex];
    metrics.drive = clamp(Number(experience.synth.drive == null ? 50 : experience.synth.drive) / 100, 0, 1);
  }

  function drawParticles(ctx, w, h, time, palette, energy, scene) {
    var movement = ((experience.dna && experience.dna.movement) || 50) / 100;
    var speed = 0.000012 * (0.4 + movement + energy * 2.2);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.px = p.x;
      p.py = p.y;
      var field = Math.sin(p.y * 9 + time * 0.00021 + p.phase) + Math.cos(p.x * 7 - time * 0.00017);
      var angle = field * Math.PI + (scene === 'bassHouse' ? -Math.PI / 2 : 0);
      p.x += Math.cos(angle) * speed * 16 * p.depth;
      p.y += Math.sin(angle) * speed * 16 * p.depth;
      if (p.x < 0) { p.x += 1; p.px = p.x; }
      if (p.x > 1) { p.x -= 1; p.px = p.x; }
      if (p.y < 0) { p.y += 1; p.py = p.y; }
      if (p.y > 1) { p.y -= 1; p.py = p.y; }
      var alpha = 0.08 + energy * 0.24 * p.depth;
      ctx.strokeStyle = alphaColor(i % 3 === 0 ? palette.b : palette.a, alpha);
      ctx.lineWidth = p.size * (0.45 + energy);
      ctx.beginPath();
      ctx.moveTo(p.px * w, p.py * h);
      ctx.lineTo(p.x * w, p.y * h);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawWorld(ctx, w, h, time, palette, energy) {
    var world = theme;
    var cx = w * 0.5;
    var cy = h * 0.5;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (world === 'neonCity') {
      drawPerspectiveGrid(ctx, w, h, time, palette, energy, true);
      for (var b = 0; b < 24; b++) {
        var val = logBands[b + 8] || 0;
        var bw = w / 30;
        var x = w * 0.1 + b * w * 0.8 / 24;
        var bh = h * (0.04 + val * 0.34);
        ctx.fillStyle = alphaColor(b % 2 ? palette.a : palette.b, 0.12 + val * 0.5);
        ctx.fillRect(x, h * 0.72 - bh, bw, bh);
      }
    } else if (world === 'organicForest') {
      for (var branch = 0; branch < 22; branch++) {
        var baseX = w * branch / 21;
        ctx.strokeStyle = alphaColor(branch % 3 ? palette.a : palette.c, 0.1 + energy * 0.28);
        ctx.lineWidth = 0.7 + (branch % 4) * 0.35;
        ctx.beginPath();
        ctx.moveTo(baseX, h);
        for (var y = h; y > h * 0.08; y -= 18) {
          var sway = Math.sin(y * 0.021 + time * 0.00035 + branch) * (10 + energy * 30);
          ctx.lineTo(baseX + sway, y);
        }
        ctx.stroke();
      }
    } else if (world === 'cosmicVoid') {
      for (var ring = 0; ring < 13; ring++) {
        var rr = ((time * 0.025 + ring * 54) % Math.max(w, h)) * (0.45 + energy * 0.25);
        ctx.strokeStyle = alphaColor(ring % 2 ? palette.a : palette.b, 0.05 + energy * 0.14);
        ctx.lineWidth = 1 + energy * 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rr, rr * 0.62, time * 0.00005, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      for (var arm = 0; arm < 10; arm++) {
        ctx.strokeStyle = alphaColor(arm % 2 ? palette.a : palette.b, 0.08 + energy * 0.22);
        ctx.lineWidth = 1 + energy * 3;
        ctx.beginPath();
        for (var step = 0; step < 90; step++) {
          var radius = step * Math.min(w, h) / 150;
          var angle = arm * Math.PI * 0.2 + step * 0.12 + time * 0.00012;
          var x2 = cx + Math.cos(angle) * radius;
          var y2 = cy + Math.sin(angle) * radius * 0.7;
          if (!step) ctx.moveTo(x2, y2); else ctx.lineTo(x2, y2);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawWaveRibbon(ctx, w, h, palette, scale, copies) {
    if (!waveBuffer || !waveBuffer.length) return;
    var stride = Math.max(2, Math.floor(waveBuffer.length / Math.max(180, w)));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var copy = 0; copy < copies; copy++) {
      var offset = (copy - (copies - 1) / 2) * (8 + smooth.mid * 24);
      ctx.strokeStyle = alphaColor(copy % 2 ? palette.b : palette.a, 0.18 + smooth.rms * 0.58);
      ctx.lineWidth = 0.8 + copy * 0.45 + smooth.bass * 3;
      ctx.beginPath();
      for (var i = 0; i < waveBuffer.length; i += stride) {
        var x = i / (waveBuffer.length - 1) * w;
        var sample = (waveBuffer[i] - 128) / 128;
        var y = h * 0.5 + sample * h * scale + offset;
        if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawRadialSpectrum(ctx, w, h, time, palette, radiusScale, symmetry) {
    var cx = w / 2;
    var cy = h / 2;
    var base = Math.min(w, h) * radiusScale;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(time * 0.000035 * (1 + smooth.mid));
    ctx.globalCompositeOperation = 'lighter';
    for (var side = 0; side < symmetry; side++) {
      ctx.save();
      ctx.rotate(Math.PI * 2 * side / symmetry);
      ctx.beginPath();
      for (var i = 0; i < logBands.length; i++) {
        var angle = i / (logBands.length - 1) * Math.PI * 2 / symmetry;
        var value = logBands[i] * intensity;
        var radius = base + value * Math.min(w, h) * 0.34;
        var x = Math.cos(angle) * radius;
        var y = Math.sin(angle) * radius;
        if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = alphaColor(side % 2 ? palette.a : palette.b, 0.28 + smooth.rms * 0.65);
      ctx.lineWidth = 1.2 + smooth.bass * 5;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawPerspectiveGrid(ctx, w, h, time, palette, energy, vertical) {
    var horizon = h * (vertical ? 0.56 : 0.48);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = alphaColor(palette.a, 0.08 + energy * 0.24);
    ctx.lineWidth = 1;
    for (var x = -10; x <= 10; x++) {
      ctx.beginPath();
      ctx.moveTo(w / 2 + x * 10, horizon);
      ctx.lineTo(w / 2 + x * w * 0.13, h);
      ctx.stroke();
    }
    for (var line = 0; line < 18; line++) {
      var phase = ((line / 18 + time * 0.00008) % 1);
      var eased = phase * phase;
      var y = horizon + eased * (h - horizon);
      ctx.strokeStyle = alphaColor(line % 3 ? palette.a : palette.b, 0.04 + eased * 0.22 + energy * 0.1);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSynth(ctx, w, h, time, palette) {
    var synth = experience.synth || {};
    var drive = (synth.drive || 50) / 100;
    var fm = (synth.fm || 50) / 100;
    var resonance = clamp((synth.resonance || 8) / 20, 0, 1);
    var cutoff = clamp(Math.log((synth.cutoff || 1400) / 80) / Math.log(100), 0, 1);
    var symmetry = 3 + Math.round(fm * 7);
    drawRadialSpectrum(ctx, w, h, time * (0.8 + (synth.rate || 2) * 0.12), palette, 0.09 + cutoff * 0.08, symmetry);
    drawWaveRibbon(ctx, w, h, palette, 0.08 + drive * 0.18, 3 + Math.round(resonance * 4));
    var radius = Math.min(w, h) * (0.11 + smooth.bass * 0.12);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(time * 0.00018 * ((synth.rate || 2) + 1));
    ctx.strokeStyle = alphaColor(palette.c, 0.25 + smooth.mid * 0.65);
    ctx.lineWidth = 1 + drive * 3;
    for (var ring = 0; ring < 4; ring++) {
      ctx.beginPath();
      for (var i = 0; i <= 120; i++) {
        var angle = i / 120 * Math.PI * 2;
        var teeth = Math.sin(angle * symmetry + time * 0.002) * (fm * 14 + smooth.treble * 30);
        var r = radius + ring * 9 + teeth;
        var x = Math.cos(angle) * r;
        var y = Math.sin(angle) * r;
        if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawRhythm(ctx, w, h, time, palette) {
    var rhythm = experience.choices.rhythm || 'halfTime';
    var columns = rhythm === 'breakbeat' ? 16 : rhythm === 'fourOnFloor' ? 12 : 8;
    var rows = 8;
    var cellW = w / columns;
    var cellH = h / rows;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < columns; x++) {
        var band = logBands[(x * 3 + y * 5) % logBands.length] || 0;
        var phase = Math.sin(time * 0.003 + x * 1.7 + y * 2.1) * 0.5 + 0.5;
        var active = band * 0.8 + beatPulse * (x % 4 === 0 ? 0.6 : 0) + phase * 0.05;
        var inset = 4 + (1 - active) * 10;
        ctx.strokeStyle = alphaColor((x + y) % 3 ? palette.a : palette.b, 0.04 + active * 0.42);
        ctx.lineWidth = 1 + active * 2;
        ctx.strokeRect(x * cellW + inset, y * cellH + inset, Math.max(1, cellW - inset * 2), Math.max(1, cellH - inset * 2));
      }
    }
    ctx.restore();
    drawRadialSpectrum(ctx, w, h, time, palette, 0.06, rhythm === 'fourOnFloor' ? 4 : rhythm === 'breakbeat' ? 7 : 2);
  }

  function drawStructure(ctx, w, h, time, palette) {
    var structure = experience.choices.structure || 'classicDrop';
    var lanes = structure === 'epicJourney' ? 7 : structure === 'melodicNarrative' ? 5 : 4;
    var cx = w / 2;
    var cy = h / 2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var lane = 0; lane < lanes; lane++) {
      var radius = Math.min(w, h) * (0.1 + lane * 0.065) + beatPulse * lane * 4;
      var start = time * 0.0002 * (lane % 2 ? 1 : -1) + lane;
      var span = Math.PI * (0.55 + (logBands[lane * 5] || 0) * 1.3);
      ctx.strokeStyle = alphaColor(lane % 2 ? palette.a : palette.b, 0.12 + smooth.mid * 0.4);
      ctx.lineWidth = 2 + (logBands[lane * 6] || 0) * 8;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, start, start + span);
      ctx.stroke();
    }
    for (var marker = 0; marker < 24; marker++) {
      var angle = marker / 24 * Math.PI * 2 + time * 0.0001;
      var radius2 = Math.min(w, h) * (0.22 + (logBands[marker * 2] || 0) * 0.2);
      ctx.fillStyle = alphaColor(marker % 3 ? palette.c : palette.b, 0.14 + smooth.treble * 0.45);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(angle) * radius2, cy + Math.sin(angle) * radius2, 1 + (logBands[marker * 2] || 0) * 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawRiddim(ctx, w, h, time, palette, mutate) {
    var cx = w / 2;
    var cy = h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(mutate ? Math.sin(time * 0.0004) * 0.12 : 0);
    ctx.globalCompositeOperation = 'lighter';
    for (var portal = 0; portal < 12; portal++) {
      var phase = ((portal / 12 + time * 0.00008) % 1);
      var scale = 0.08 + phase * phase * 1.05;
      var pw = w * scale;
      var ph = h * scale * (0.42 + smooth.bass * 0.18);
      ctx.strokeStyle = alphaColor(portal % 3 ? palette.a : palette.b, (1 - phase) * (0.12 + smooth.bass * 0.48));
      ctx.lineWidth = 1 + (1 - phase) * 5 + beatPulse * 4;
      ctx.strokeRect(-pw / 2, -ph / 2, pw, ph);
    }
    ctx.restore();
    drawWaveRibbon(ctx, w, h, palette, 0.13, 2);
  }

  function drawBrostep(ctx, w, h, time, palette, mutate) {
    var cx = w / 2;
    var cy = h / 2;
    var rays = mutate ? 28 : 18;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(time * 0.00022);
    ctx.globalCompositeOperation = 'lighter';
    for (var ray = 0; ray < rays; ray++) {
      var value = logBands[(ray * 2) % logBands.length] || 0;
      var angle = ray / rays * Math.PI * 2;
      var inner = Math.min(w, h) * (0.06 + smooth.bass * 0.08);
      var outer = inner + Math.min(w, h) * (0.15 + value * 0.48 + beatPulse * 0.08);
      ctx.strokeStyle = alphaColor(ray % 2 ? palette.a : palette.b, 0.14 + value * 0.62);
      ctx.lineWidth = 1 + value * 7;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      var kink = angle + Math.sin(time * 0.002 + ray) * 0.18;
      ctx.lineTo(Math.cos(kink) * outer * 0.58, Math.sin(kink) * outer * 0.58);
      ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      ctx.stroke();
    }
    ctx.restore();
    drawRadialSpectrum(ctx, w, h, -time * 1.3, palette, 0.12, mutate ? 7 : 5);
  }

  function drawHybrid(ctx, w, h, time, palette, mutate) {
    var cx = w * (mutate ? 0.54 : 0.46);
    var cy = h * 0.5;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalCompositeOperation = 'lighter';
    for (var shard = 0; shard < 26; shard++) {
      var value = logBands[(shard * 5) % logBands.length] || 0;
      var angle = shard * 2.399 + time * 0.00018 * (shard % 2 ? 1 : -1);
      var radius = Math.min(w, h) * (0.06 + (shard % 7) * 0.045 + value * 0.22);
      var size = 4 + value * 34 + beatPulse * 8;
      var x = Math.cos(angle) * radius;
      var y = Math.sin(angle) * radius * 0.72;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle + time * 0.0007);
      ctx.fillStyle = alphaColor(shard % 3 ? palette.a : palette.b, 0.06 + value * 0.36);
      ctx.strokeStyle = alphaColor(palette.c, 0.12 + value * 0.48);
      ctx.beginPath();
      ctx.moveTo(size, 0);
      ctx.lineTo(-size * 0.7, size * 0.45);
      ctx.lineTo(-size * 0.25, -size * 0.82);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawBassHouse(ctx, w, h, time, palette, mutate) {
    drawPerspectiveGrid(ctx, w, h, time, palette, smooth.rms, true);
    var cx = w / 2;
    var cy = h * 0.46;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.sin(time * 0.00025) * (mutate ? 0.22 : 0.06));
    ctx.globalCompositeOperation = 'lighter';
    for (var box = 0; box < 14; box++) {
      var phase = ((box / 14 + time * 0.00011) % 1);
      var size = Math.min(w, h) * (0.05 + phase * 0.8);
      ctx.strokeStyle = alphaColor(box % 2 ? palette.a : palette.b, (1 - phase) * (0.1 + smooth.bass * 0.4));
      ctx.lineWidth = 1 + beatPulse * 5;
      ctx.strokeRect(-size, -size * 0.58, size * 2, size * 1.16);
    }
    ctx.restore();
  }

  function drawMelodic(ctx, w, h, time, palette, mutate) {
    var horizon = h * 0.55;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var ribbon = 0; ribbon < 9; ribbon++) {
      ctx.strokeStyle = alphaColor(ribbon % 2 ? palette.a : palette.b, 0.08 + smooth.mid * 0.34);
      ctx.lineWidth = 1 + ribbon * 0.22 + smooth.rms * 4;
      ctx.beginPath();
      for (var x = 0; x <= w; x += 7) {
        var nx = x / w;
        var saw = ((nx * (mutate ? 16 : 11) + time * 0.00015 + ribbon * 0.09) % 1) * 2 - 1;
        var sine = Math.sin(nx * Math.PI * (3 + ribbon * 0.3) + time * 0.00055);
        var y = horizon + (ribbon - 4) * 13 + saw * (8 + smooth.treble * 34) + sine * (10 + smooth.mid * 28);
        if (!x) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    var glow = ctx.createLinearGradient(0, horizon - h * 0.32, 0, horizon + h * 0.35);
    glow.addColorStop(0, alphaColor(palette.b, 0));
    glow.addColorStop(0.5, alphaColor(palette.a, 0.08 + smooth.mid * 0.18));
    glow.addColorStop(1, alphaColor(palette.b, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    drawRadialSpectrum(ctx, w, h, time * 0.55, palette, 0.09, mutate ? 8 : 6);
  }

  function drawKaleido(ctx, w, h, time, palette, mutate) {
    var wedges = mutate ? 12 : 8;
    var cx = w / 2;
    var cy = h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(time * 0.00012);
    ctx.globalCompositeOperation = 'lighter';
    for (var wedge = 0; wedge < wedges; wedge++) {
      ctx.save();
      ctx.rotate(wedge * Math.PI * 2 / wedges);
      if (wedge % 2) ctx.scale(1, -1);
      for (var point = 0; point < 18; point++) {
        var value = logBands[(point * 3) % logBands.length] || 0;
        var radius = Math.min(w, h) * (0.04 + point * 0.018 + value * 0.18);
        var size = 1 + value * 9 + beatPulse * 3;
        ctx.fillStyle = alphaColor(point % 3 === 0 ? palette.c : point % 2 ? palette.a : palette.b, 0.08 + value * 0.38);
        ctx.fillRect(radius, point * 2.2, size * 2.8, size);
      }
      ctx.restore();
    }
    ctx.restore();
    drawRadialSpectrum(ctx, w, h, -time, palette, 0.08, wedges / 2);
  }

  function drawBuild(ctx, w, h, time, palette) {
    var progress = playback.isFinal ? playback.progress : 0.5;
    var cx = w / 2;
    var cy = h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(time * 0.0003 * (1 + progress * 2));
    ctx.globalCompositeOperation = 'lighter';
    for (var spiral = 0; spiral < 7; spiral++) {
      ctx.strokeStyle = alphaColor(spiral % 2 ? palette.a : palette.b, 0.08 + smooth.mid * 0.34);
      ctx.lineWidth = 1 + progress * 2;
      ctx.beginPath();
      for (var i = 0; i < 130; i++) {
        var radius = (130 - i) * Math.min(w, h) / 240;
        var angle = i * (0.11 + progress * 0.018) + spiral * Math.PI * 2 / 7;
        var x = Math.cos(angle) * radius;
        var y = Math.sin(angle) * radius * 0.74;
        if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
    drawRadialSpectrum(ctx, w, h, time * 1.7, palette, 0.05 + progress * 0.06, 5);
  }

  function drawVacuum(ctx, w, h, time, palette) {
    var pulse = 0.5 + 0.5 * Math.sin(time * 0.004);
    var radius = Math.min(w, h) * (0.035 + pulse * 0.018);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = alphaColor(palette.a, 0.24 + pulse * 0.34);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = alphaColor(palette.b, 0.1 + pulse * 0.12);
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, radius * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawAfterglow(ctx, w, h, time, palette) {
    drawParticles(ctx, w, h, time * 0.35, palette, smooth.rms * 0.4, 'afterglow');
    drawWaveRibbon(ctx, w, h, palette, 0.06, 2);
  }

  function drawPadBursts(ctx, w, h, palette) {
    var colors = { D: '#FFCE00', F: '#FF3217', J: '#FFFFFF', K: '#D72F19' };
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = padBursts.length - 1; i >= 0; i--) {
      var burst = padBursts[i];
      burst.life -= reducedMotion ? 0.04 : 0.025;
      burst.radius += 5 + burst.energy * 6;
      if (burst.life <= 0) {
        padBursts.splice(i, 1);
        continue;
      }
      ctx.strokeStyle = alphaColor(colors[burst.pad] || palette.a, burst.life * 0.7);
      ctx.lineWidth = 1 + burst.life * 5;
      ctx.beginPath();
      ctx.arc(w * burst.x, h * burst.y, burst.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBrutalOverlay(ctx, w, h, time, palette, scene) {
    var drive = clamp(Number(experience.synth.drive == null ? 50 : experience.synth.drive) / 100, 0, 1);
    var audioHit = clamp(smooth.bass * 0.8 + smooth.rms * 1.4 + beatPulse * 0.7, 0, 1.5);
    var damage = clamp(drive * 0.72 + audioHit * 0.42, 0, 1.4);
    var words = {
      world: 'SIGNAL', synth: 'DRIVE', rhythm: 'STOMP', build: 'TENSION', vacuum: 'ZERO',
      riddimDubstep: 'MONOLITH', brostep: 'IMPACT', hybridTrap: 'FRACTURE',
      bassHouse: 'PRESSURE', melodicDubstep: 'SAW WALL', destinyFusion: 'DESTINY',
      shred: 'SHRED', bunker: 'BUNKER', fracture: 'BREAK'
    };

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    // Hard black slabs and industrial-yellow registration marks.
    ctx.fillStyle = alphaColor('#000000', 0.42 + drive * 0.18);
    ctx.fillRect(0, h * 0.13, w * (0.045 + drive * 0.035), h * 0.54);
    ctx.fillRect(w * (0.88 - drive * 0.04), h * 0.74, w * 0.16, h * 0.055);
    ctx.fillStyle = alphaColor(drive > 0.84 ? '#FFCE00' : '#FFFFFF', 0.34 + audioHit * 0.18);
    ctx.fillRect(0, h * 0.12, w * (0.13 + drive * 0.08), 5 + drive * 8);
    ctx.fillRect(w * 0.82, h * 0.71, w * 0.18, 3 + drive * 6);

    // Torn diagonal bars grow denser with Drive.
    var slashCount = 3 + Math.round(drive * 10);
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-0.36 + Math.sin(time * 0.00013) * 0.025 * damage);
    for (var slash = 0; slash < slashCount; slash++) {
      var phase = (slash / slashCount + time * (0.000018 + drive * 0.000025)) % 1;
      var y = -h * 0.62 + phase * h * 1.24;
      var barWidth = w * (0.09 + ((slash * 37) % 9) * 0.012 + damage * 0.035);
      var barHeight = 2 + drive * 7 + (slash % 3) * 2;
      ctx.fillStyle = alphaColor(slash % 3 === 0 ? '#000000' : slash % 2 ? palette.a : palette.b,
        0.055 + damage * 0.12);
      ctx.fillRect(-barWidth / 2 + Math.sin(slash * 4.1 + time * 0.0007) * w * 0.34, y, barWidth, barHeight);
    }
    ctx.rotate(0.36 - Math.sin(time * 0.00013) * 0.025 * damage);
    ctx.translate(-w / 2, -h / 2);

    // Feedback slices mimic damaged print registration rather than smooth neon trails.
    if (!reducedMotion && drive > 0.38) {
      var slices = 2 + Math.round(drive * 5);
      ctx.globalAlpha = 0.035 + drive * 0.075;
      for (var slice = 0; slice < slices; slice++) {
        var sy = ((slice * 0.173 + time * 0.000043) % 1) * h;
        var sh = 3 + drive * 13;
        var offset = Math.sin(time * 0.0021 + slice * 2.7) * (4 + drive * 28);
        ctx.drawImage(historyCanvas, 0, sy, w, sh, offset, sy, w, sh);
      }
      ctx.globalAlpha = 1;
    }

    // Oversized brutalist wordmark appears as a structural layer, not an HUD label.
    var word = words[scene] || 'BASS';
    ctx.save();
    ctx.translate(w * 0.5, h * 0.54);
    ctx.rotate(-Math.PI / 2);
    ctx.font = '900 ' + Math.max(44, Math.min(150, h * 0.17)) + 'px Arial Black, Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = alphaColor('#FFFFFF', 0.018 + damage * 0.055);
    ctx.fillText(word, 0, 0);
    ctx.restore();

    // Halftone impact field, tied to mid/high energy and Drive.
    ctx.fillStyle = alphaColor(palette.c, 0.025 + damage * 0.055);
    var dotGap = drive > 0.72 ? 18 : 25;
    var dotRadius = 0.6 + smooth.treble * 2.6 + drive * 0.8;
    for (var dx = dotGap; dx < w; dx += dotGap) {
      for (var dy = dotGap; dy < h; dy += dotGap) {
        if (((dx / dotGap + dy / dotGap) % 3) !== 0) continue;
        ctx.beginPath();
        ctx.arc(dx, dy, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (drive > 0.82 && beatPulse > 0.3) {
      ctx.fillStyle = alphaColor('#FFFFFF', beatPulse * (drive - 0.78) * 0.36);
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }

  function renderScene(ctx, w, h, time, scene, palette) {
    var mutate = playback.isFinal && playback.section === 'dropB';
    if (scene === 'shred') {
      drawWaveRibbon(ctx, w, h, palette, 0.24, 7);
      drawBrostep(ctx, w, h, time, palette, true);
    } else if (scene === 'bunker') {
      drawRiddim(ctx, w, h, time, palette, true);
      drawBassHouse(ctx, w, h, time, palette, true);
    } else if (scene === 'fracture') {
      drawHybrid(ctx, w, h, time, palette, true);
      drawKaleido(ctx, w, h, time, palette, true);
    } else if (scene === 'world') {
      drawWorld(ctx, w, h, time, palette, smooth.rms);
    } else if (scene === 'synth') {
      drawSynth(ctx, w, h, time, palette);
    } else if (scene === 'rhythm') {
      drawRhythm(ctx, w, h, time, palette);
    } else if (scene === 'structure') {
      drawStructure(ctx, w, h, time, palette);
    } else if (scene === 'build') {
      drawBuild(ctx, w, h, time, palette);
    } else if (scene === 'vacuum') {
      drawVacuum(ctx, w, h, time, palette);
    } else if (scene === 'afterglow') {
      drawAfterglow(ctx, w, h, time, palette);
    } else if (scene === 'riddimDubstep') {
      drawRiddim(ctx, w, h, time, palette, mutate);
    } else if (scene === 'brostep') {
      drawBrostep(ctx, w, h, time, palette, mutate);
    } else if (scene === 'hybridTrap') {
      drawHybrid(ctx, w, h, time, palette, mutate);
    } else if (scene === 'bassHouse') {
      drawBassHouse(ctx, w, h, time, palette, mutate);
    } else if (scene === 'melodicDubstep') {
      drawMelodic(ctx, w, h, time, palette, mutate);
    } else {
      drawKaleido(ctx, w, h, time, palette, mutate);
    }
  }

  function draw(now) {
    if (!running || !canvas || !output) return;
    rafId = global.requestAnimationFrame(draw);
    if (reducedMotion && now - lastFrameTime < 33) return;
    lastFrameTime = now;

    analyseAudio(now);
    var scene = sceneForState();
    updateSceneMetadata(scene);
    var palette = getPalette();
    var w = cssWidth;
    var h = cssHeight;
    var drive = clamp(Number(experience.synth.drive == null ? 50 : experience.synth.drive) / 100, 0, 1);
    var energy = clamp((smooth.rms * 1.35 + smooth.bass * 0.75) * intensity, 0, 1.4);
    var dropBoost = experience.choices.drop === 'overload' ? 1.24 : experience.choices.drop === 'gentle' ? 0.78 : 1;
    energy *= dropBoost;

    frameCtx.setTransform(1, 0, 0, 1, 0, 0);
    frameCtx.globalCompositeOperation = 'source-over';
    frameCtx.fillStyle = palette.bg;
    frameCtx.fillRect(0, 0, w, h);

    if (scene !== 'vacuum') {
      frameCtx.save();
      frameCtx.translate(w / 2, h / 2);
      var zoom = 1.003 + energy * 0.008 + beatPulse * 0.006 + drive * 0.004;
      var rotation = reducedMotion ? 0 : Math.sin(now * 0.00017) * (0.0025 + drive * 0.006) * (1 + smooth.mid * 2);
      frameCtx.rotate(rotation);
      frameCtx.scale(zoom, zoom);
      frameCtx.translate(-w / 2, -h / 2);
      frameCtx.globalAlpha = reducedMotion ? 0.58 : (0.76 + clamp(((experience.dna.space || 50) - 50) / 300, -0.08, 0.1));
      frameCtx.drawImage(historyCanvas, 0, 0, w, h);
      frameCtx.restore();
      frameCtx.fillStyle = alphaColor(palette.bg, 0.12 + (1 - energy) * 0.07);
      frameCtx.fillRect(0, 0, w, h);
    }

    if (scene !== 'vacuum' && scene !== 'afterglow') drawParticles(frameCtx, w, h, now, palette, energy, scene);
    renderScene(frameCtx, w, h, now, scene, palette);
    drawBrutalOverlay(frameCtx, w, h, now, palette, scene);
    drawPadBursts(frameCtx, w, h, palette);

    if (beatPulse > 0.04 && scene !== 'vacuum') {
      frameCtx.save();
      frameCtx.globalCompositeOperation = 'lighter';
      frameCtx.strokeStyle = alphaColor(palette.c, beatPulse * 0.18);
      frameCtx.lineWidth = 1 + beatPulse * 5;
      frameCtx.strokeRect(8 + beatPulse * 8, 8 + beatPulse * 8, w - 16 - beatPulse * 16, h - 16 - beatPulse * 16);
      frameCtx.restore();
    }

    if (transitionFlash > 0.01) {
      frameCtx.fillStyle = alphaColor(palette.a, transitionFlash * 0.12);
      frameCtx.fillRect(0, 0, w, h);
      transitionFlash *= 0.89;
    }

    historyCtx.setTransform(1, 0, 0, 1, 0, 0);
    historyCtx.globalCompositeOperation = 'source-over';
    historyCtx.clearRect(0, 0, w, h);
    historyCtx.drawImage(frameCanvas, 0, 0, w, h);

    output.setTransform(dpr, 0, 0, dpr, 0, 0);
    output.clearRect(0, 0, w, h);
    output.drawImage(frameCanvas, 0, 0, w, h);
  }

  function start(targetCanvas, targetAnalyser) {
    canvas = targetCanvas;
    if (!canvas) return;
    if (rafId) global.cancelAnimationFrame(rafId);
    analyser = targetAnalyser || null;
    waveBuffer = null;
    freqBuffer = null;
    resizeBuffers();
    if (resizeObserver) resizeObserver.disconnect();
    if (global.ResizeObserver) {
      resizeObserver = new global.ResizeObserver(function () { resizeBuffers(); });
      resizeObserver.observe(canvas);
    }
    running = true;
    lastFrameTime = 0;
    rafId = global.requestAnimationFrame(draw);
  }

  function setAnalyser(value) {
    analyser = value || null;
    waveBuffer = null;
    freqBuffer = null;
  }

  function setTheme(soundWorld) {
    var nextTheme = soundWorld || 'default';
    if (theme !== nextTheme) transitionFlash = 1;
    theme = nextTheme;
  }

  function setIntensity(value) {
    intensity = clamp(value, 0.1, 1.25);
  }

  function setExperienceState(state) {
    state = state || {};
    var result = state.result || null;
    experience = {
      phase: state.phase || 'intro',
      choices: Object.assign({}, state.choices || {}),
      synth: Object.assign({}, state.synthParams || {}),
      dna: Object.assign({}, state.dna || {}),
      style: result ? (result.isHidden ? 'destinyFusion' : result.primaryStyle) : null
    };
    var signature = [experience.phase, resolveStyle(), experience.choices.soundWorld,
      experience.choices.bassPersonality, experience.choices.rhythm, experience.choices.structure,
      experience.choices.drop].join('|');
    if (signature !== sceneSignature) {
      sceneSignature = signature;
      transitionFlash = 1;
    }
  }

  function setPlayback(value) {
    value = value || {};
    var nextSection = value.section || 'creation';
    if (playback.section !== nextSection || playback.isFinal !== !!value.isFinal) transitionFlash = 1;
    playback.isFinal = !!value.isFinal;
    playback.progress = clamp(value.progress || 0, 0, 1);
    playback.section = nextSection;
  }

  function pulsePad(pad, step) {
    var positions = { D: [0.27, 0.62], F: [0.42, 0.42], J: [0.58, 0.42], K: [0.73, 0.62] };
    var pos = positions[pad] || [0.5, 0.5];
    padBursts.push({ pad: pad, x: pos[0], y: pos[1], radius: 4, life: 1, energy: 0.6 + ((step || 0) % 4) * 0.1 });
    if (padBursts.length > 20) padBursts.shift();
  }

  function cycleMode() {
    manualModeIndex = (manualModeIndex + 1) % MANUAL_MODES.length;
    transitionFlash = 1;
    return MODE_LABELS[MANUAL_MODES[manualModeIndex]];
  }

  function getMode() {
    return MANUAL_MODES[manualModeIndex];
  }

  function getMetrics() {
    return {
      bass: metrics.bass, mid: metrics.mid, treble: metrics.treble, rms: metrics.rms,
      beat: metrics.beat, scene: metrics.scene, sceneLabel: metrics.sceneLabel,
      sectionLabel: metrics.sectionLabel, mode: metrics.mode, drive: metrics.drive
    };
  }

  function resize() {
    resizeBuffers();
  }

  function stop() {
    running = false;
    if (rafId) global.cancelAnimationFrame(rafId);
    rafId = null;
    if (resizeObserver) resizeObserver.disconnect();
    resizeObserver = null;
  }

  global.Visualizer = {
    start: start,
    setAnalyser: setAnalyser,
    setTheme: setTheme,
    setIntensity: setIntensity,
    setExperienceState: setExperienceState,
    setPlayback: setPlayback,
    pulsePad: pulsePad,
    cycleMode: cycleMode,
    getMode: getMode,
    getMetrics: getMetrics,
    resize: resize,
    stop: stop
  };

})(typeof window !== 'undefined' ? window : global);
