/**
 * DROP//DESTINY — visualizer.js
 * Canvas + AnalyserNode 可视化。
 * 只使用 AudioEngine.getAnalyser() 返回的真实分析器数据，不使用伪随机数据。
 *
 * 公共接口（不变）：start / setAnalyser / setTheme / setIntensity / resize / stop
 */
(function (global) {
  'use strict';

  var canvas = null;
  var ctx2d = null;
  var analyser = null;
  var rafId = null;
  var theme = 'default';
  var intensity = 0.5;
  var running = false;

  // CSS 像素尺寸（用于绘制逻辑），与 canvas.width/height（物理像素）分离
  var cssWidth = 0;
  var cssHeight = 0;

  // 各声音世界主题色
  var THEMES = {
    abyss:         { primary: '#4400aa', secondary: '#aa00ff', bg: '#0a0a18' },
    neonCity:      { primary: '#00ffcc', secondary: '#ff00aa', bg: '#0a0a12' },
    organicForest: { primary: '#44ff88', secondary: '#88ff44', bg: '#0a120a' },
    cosmicVoid:    { primary: '#6644ff', secondary: '#aa88ff', bg: '#080818' },
    default:       { primary: '#00ffcc', secondary: '#6644ff', bg: '#0a0a12' }
  };

  // 时域波形缓冲
  var waveBuffer = null;
  // 频域缓冲
  var freqBuffer = null;

  function getThemeColors() {
    return THEMES[theme] || THEMES.default;
  }

  function ensureBuffers() {
    if (!analyser) return;
    if (!waveBuffer || waveBuffer.length !== analyser.fftSize) {
      waveBuffer = new Uint8Array(analyser.fftSize);
    }
    if (!freqBuffer || freqBuffer.length !== analyser.frequencyBinCount) {
      freqBuffer = new Uint8Array(analyser.frequencyBinCount);
    }
  }

  function draw() {
    if (!running || !canvas || !ctx2d) return;

    var w = cssWidth || canvas.width;
    var h = cssHeight || canvas.height;
    var colors = getThemeColors();

    // 背景
    ctx2d.fillStyle = colors.bg;
    ctx2d.fillRect(0, 0, w, h);

    if (!analyser) {
      // 无分析器时画静默线
      ctx2d.strokeStyle = colors.primary;
      ctx2d.globalAlpha = 0.2;
      ctx2d.lineWidth = 1;
      ctx2d.beginPath();
      ctx2d.moveTo(0, h / 2);
      ctx2d.lineTo(w, h / 2);
      ctx2d.stroke();
      ctx2d.globalAlpha = 1;
      rafId = global.requestAnimationFrame(draw);
      return;
    }

    ensureBuffers();

    // ── 频谱条 ──
    analyser.getByteFrequencyData(freqBuffer);

    var barCount = 48;
    var barWidth = w / barCount;
    var centerY = h / 2;

    ctx2d.lineWidth = 2;

    for (var b = 0; b < barCount; b++) {
      // 使用对数索引以更好地反映听觉感受
      var logIdx = Math.floor(Math.pow(b / barCount, 1.8) * freqBuffer.length);
      var val = freqBuffer[Math.min(logIdx, freqBuffer.length - 1)] / 255;
      val *= intensity;

      var barH = val * h * 0.42;

      if (barH > 0.5) {
        // 渐变色
        var grad = ctx2d.createLinearGradient(0, centerY - barH, 0, centerY + barH);
        grad.addColorStop(0, colors.primary);
        grad.addColorStop(1, colors.secondary);

        ctx2d.fillStyle = grad;
        var x = b * barWidth + barWidth * 0.1;
        var bw = barWidth * 0.8;
        ctx2d.fillRect(x, centerY - barH, bw, barH * 2);
      }
    }

    // ── 时域波形叠加 ──
    analyser.getByteTimeDomainData(waveBuffer);

    ctx2d.strokeStyle = colors.primary;
    ctx2d.globalAlpha = 0.6;
    ctx2d.lineWidth = 1.5;
    ctx2d.beginPath();

    var sliceWidth = w / waveBuffer.length;
    var x = 0;
    for (var i = 0; i < waveBuffer.length; i++) {
      var v = waveBuffer[i] / 128.0;
      var y = (v * h) / 2;
      if (i === 0) {
        ctx2d.moveTo(x, y);
      } else {
        ctx2d.lineTo(x, y);
      }
      x += sliceWidth;
    }
    ctx2d.stroke();
    ctx2d.globalAlpha = 1;

    // 中线
    ctx2d.strokeStyle = colors.secondary;
    ctx2d.globalAlpha = 0.1;
    ctx2d.lineWidth = 1;
    ctx2d.beginPath();
    ctx2d.moveTo(0, centerY);
    ctx2d.lineTo(w, centerY);
    ctx2d.stroke();
    ctx2d.globalAlpha = 1;

    rafId = global.requestAnimationFrame(draw);
  }

  // ── 公共接口 ──────────────────────────────────────

  function start(c, a) {
    canvas = c;
    if (!canvas) return;

    // 停止已有的 RAF 循环，确保只有一个
    if (running) {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    }

    analyser = a || null;

    // 适配 DPR：canvas 物理像素 = CSS 像素 × DPR，context scale = DPR
    resize();

    running = true;
    draw();
  }

  function setAnalyser(a) {
    analyser = a;
    waveBuffer = null;
    freqBuffer = null;
  }

  function setTheme(soundWorld) {
    theme = soundWorld || 'default';
  }

  function setIntensity(value) {
    intensity = Math.max(0.1, Math.min(1, value));
  }

  function resize() {
    if (!canvas) return;
    var dpr = global.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    cssWidth = Math.max(1, Math.floor(rect.width));
    cssHeight = Math.max(1, Math.floor(rect.height));
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';
    ctx2d = canvas.getContext('2d');
    ctx2d.setTransform(1, 0, 0, 1, 0, 0); // 重置变换矩阵
    ctx2d.scale(dpr, dpr);
  }

  function stop() {
    running = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  // ── 暴露 ──────────────────────────────────────────
  global.Visualizer = {
    start: start,
    setAnalyser: setAnalyser,
    setTheme: setTheme,
    setIntensity: setIntensity,
    resize: resize,
    stop: stop
  };

})(typeof window !== 'undefined' ? window : global);
