/**
 * DROP//DESTINY — app.js
 * 状态管理、阶段切换、事件绑定、DOM 渲染。
 * 只负责 STATE 和 UI，评分逻辑全部委托 StyleEngine。
 */
(function () {
  'use strict';

  var D = window.DropDestinyData;
  var SE = window.StyleEngine;
  var AE = window.AudioEngine;
  var VIZ = window.Visualizer;

  // ── 常量 ──────────────────────────────────────────
  var PHASES = ['intro', 'soundWorld', 'bassForge', 'groove', 'arrangement', 'liveDrop', 'result'];
  var STAGE_PHASES = ['soundWorld', 'bassForge', 'groove', 'arrangement', 'liveDrop'];
  var DNA_AXES = D.DNA_AXES;
  var DNA_LABELS = {
    rhythm: 'Rhythm', aggression: 'Aggression', harmony: 'Harmony',
    movement: 'Movement', space: 'Space', surprise: 'Surprise'
  };
  var DNA_COLORS = {
    rhythm: '#6644ff', aggression: '#ff3344', harmony: '#44ff88',
    movement: '#ffcc00', space: '#00ffcc', surprise: '#ff00aa'
  };

  // ── 状态（spec section 5）──────────────────────────
  var STATE = createInitialState();

  function createInitialState() {
    return {
      phase: 'intro',
      choices: {
        soundWorld: null,
        bassPersonality: null,
        rhythm: null,
        structure: null,
        variation: null,
        drop: null
      },
      bassMacros: { body: 50, growl: 50, wobble: 50, space: 50 },
      synthParams: {
        waveform: 'distorted', oscB: 'sawtooth', oscMix: 45, detune: 12,
        filterType: 'lowpass', filterEnv: 60,
        sub: 60, fm: 50, cutoff: 1400, resonance: 8,
        drive: 55, attack: 5, release: 110,
        rate: 2, depth: 55, lfoShape: 'sine', lfoTarget: 'filter', space: 40
      },
      groove: { density: 1, fillPreference: 1 },
      performance: { events: [], completed: false },
      dna: Object.assign({}, D.INITIAL_DNA),
      result: null,
      ui: { muted: false, isPlaying: false, canGoBack: false }
    };
  }

  // ── DOM 引用 ──────────────────────────────────────
  var dom = {};

  function cacheDom() {
    dom.app = document.getElementById('app');
    dom.main = document.getElementById('main');
    dom.footer = document.getElementById('footer');
    dom.progressDots = document.getElementById('progressDots');
    dom.muteBtn = document.getElementById('muteBtn');
    dom.dnaBars = document.getElementById('dnaBars');
    dom.phaseLabel = document.getElementById('phaseLabel');
    dom.introCanvas = document.getElementById('introCanvas');
    dom.startBtn = document.getElementById('startBtn');
    dom.resultContent = document.getElementById('resultContent');
    // Workbench
    dom.workbench = document.getElementById('workbench');
    dom.wbPlayPause = document.getElementById('wbPlayPause');
    dom.wbBpm = document.getElementById('wbBpm');
    dom.wbPosition = document.getElementById('wbPosition');
    dom.wbCanvas = document.getElementById('wbCanvas');
    dom.sections = {};
    PHASES.forEach(function (p) {
      dom.sections[p] = document.getElementById(p);
    });
  }

  // ── 选项渲染 ──────────────────────────────────────

  function renderOptions(containerId, choiceKey, gridClass) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    var choices = D.CHOICES[choiceKey];
    var keys = Object.keys(choices);
    keys.forEach(function (key, idx) {
      var opt = choices[key];
      var card = document.createElement('div');
      card.className = 'option-card';
      card.dataset.choice = key;
      card.dataset.phase = choiceKey;
      if (STATE.choices[choiceKey] === key) card.classList.add('selected');
      var num = document.createElement('span');
      num.className = 'opt-num';
      num.textContent = (idx + 1);
      var label = document.createElement('div');
      label.className = 'opt-label';
      label.textContent = opt.label;
      var desc = document.createElement('div');
      desc.className = 'opt-desc';
      desc.textContent = opt.description;
      card.appendChild(num);
      card.appendChild(label);
      card.appendChild(desc);
      card.addEventListener('click', function () {
        selectOption(choiceKey, key);
      });
      container.appendChild(card);
    });
  }

  // ── 选择处理 ──────────────────────────────────────

  function selectOption(phase, optionId) {
    STATE.choices[phase] = optionId;

    // 更新卡片选中状态
    var container = findOptionContainer(phase);
    if (container) {
      var cards = container.querySelectorAll('.option-card');
      cards.forEach(function (card) {
        card.classList.toggle('selected', card.dataset.choice === optionId);
      });
    }

    if (phase === 'bassPersonality') applyPresetDefaults(optionId);

    // 预览音效（Bass 先应用预设，确保听到所选音色）
    AE.applyState(STATE);
    AE.previewChoice(phase, optionId);

    // 特殊处理
    if (phase === 'soundWorld') {
      VIZ.setTheme(optionId);
      // 选择 Sound World 后启动持续 Loop
      AE.start(STATE);
      showWorkbench();
    }
    if (phase === 'bassPersonality') {
      showMacroPanel();
    }
    if (phase === 'rhythm') {
      showDensityPanel();
    }
    if (phase === 'structure') {
      showVariationPanel();
    }
    if (phase === 'drop') {
      showPatternPanel();
    }

    recomputeDerivedState();
    updateNextButton();
  }

  function findOptionContainer(phase) {
    var map = {
      soundWorld: 'soundWorldOptions',
      bassPersonality: 'bassPersonalityOptions',
      rhythm: 'rhythmOptions',
      structure: 'structureOptions',
      drop: 'dropOptions'
    };
    return document.getElementById(map[phase]);
  }

  // ── Bass 宏观控制 ─────────────────────────────────

  function applyPresetDefaults(personality) {
    var synthPreset = D.SYNTH_PRESETS && D.SYNTH_PRESETS[personality];
    if (!synthPreset) return;
    STATE.synthParams = Object.assign({}, synthPreset);
    syncLegacyMacrosFromSynth();
    updateMacroUI();
  }

  function showMacroPanel() {
    var panel = document.getElementById('macroPanel');
    if (panel) panel.style.display = 'block';
    renderWaveformOptions();
    updateMacroUI();
  }

  function updateMacroUI() {
    var knobs = document.querySelectorAll('.synth-knob[data-synth-param]');
    knobs.forEach(function (knob) {
      var param = knob.dataset.synthParam;
      setKnobVisual(knob, STATE.synthParams[param]);
    });
    var selectorMap = {
      filterType: 'filterType', oscBType: 'oscB',
      lfoShape: 'lfoShape', lfoTarget: 'lfoTarget'
    };
    Object.keys(selectorMap).forEach(function (id) {
      var selector = document.getElementById(id);
      if (selector) selector.value = STATE.synthParams[selectorMap[id]];
    });
    updateWaveformSelection();
    drawSynthWaveform();
    checkMacroAdjusted();
  }

  function checkMacroAdjusted() {
    var preset = D.SYNTH_PRESETS && D.SYNTH_PRESETS[STATE.choices.bassPersonality];
    var hint = document.getElementById('macroHint');
    if (!preset || !hint) return;
    var params = ['waveform', 'oscB', 'oscMix', 'detune', 'filterType', 'filterEnv',
      'sub', 'fm', 'cutoff', 'resonance', 'drive', 'attack', 'release',
      'rate', 'depth', 'lfoShape', 'lfoTarget', 'space'];
    var adjusted = params.some(function (param) {
      return STATE.synthParams[param] !== preset[param];
    });
    hint.classList.toggle('adjusted', adjusted);
    hint.textContent = adjusted ? '✓ 这个 Bass 已经带上你的参数' : '至少改变一个真实参数，塑造属于你的 Bass';
  }

  function setupMacroListeners() {
    document.querySelectorAll('.synth-knob[data-synth-param]').forEach(setupKnobInteraction);

    var selectors = [
      { id: 'filterType', param: 'filterType' },
      { id: 'oscBType', param: 'oscB' },
      { id: 'lfoShape', param: 'lfoShape' },
      { id: 'lfoTarget', param: 'lfoTarget' }
    ];
    selectors.forEach(function (item) {
      var selector = document.getElementById(item.id);
      if (selector) selector.addEventListener('change', function () {
        STATE.synthParams[item.param] = selector.value;
        updateMacroUI();
        synthParamChanged();
      });
    });
  }

  function setupKnobInteraction(knob) {
    var startY = 0;
    var startNormalized = 0;

    knob.addEventListener('pointerdown', function (event) {
      startY = event.clientY;
      startNormalized = valueToNormalized(knob, STATE.synthParams[knob.dataset.synthParam]);
      knob.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    knob.addEventListener('pointermove', function (event) {
      if (!knob.hasPointerCapture(event.pointerId)) return;
      var normalized = Math.max(0, Math.min(1, startNormalized + (startY - event.clientY) / 150));
      setSynthParam(knob.dataset.synthParam, normalizedToValue(knob, normalized));
    });
    knob.addEventListener('wheel', function (event) {
      event.preventDefault();
      var normalized = valueToNormalized(knob, STATE.synthParams[knob.dataset.synthParam]);
      normalized += event.deltaY < 0 ? 0.025 : -0.025;
      setSynthParam(knob.dataset.synthParam, normalizedToValue(knob, Math.max(0, Math.min(1, normalized))));
    }, { passive: false });
    knob.addEventListener('keydown', function (event) {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowRight' && event.key !== 'ArrowDown' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      var direction = (event.key === 'ArrowUp' || event.key === 'ArrowRight') ? 1 : -1;
      var step = parseFloat(knob.dataset.step) || 1;
      setSynthParam(knob.dataset.synthParam, STATE.synthParams[knob.dataset.synthParam] + direction * step);
    });
    knob.addEventListener('dblclick', function () {
      var preset = D.SYNTH_PRESETS[STATE.choices.bassPersonality];
      if (preset) setSynthParam(knob.dataset.synthParam, preset[knob.dataset.synthParam]);
    });
  }

  function valueToNormalized(knob, value) {
    var min = parseFloat(knob.dataset.min);
    var max = parseFloat(knob.dataset.max);
    if (knob.dataset.curve === 'log') return Math.log(value / min) / Math.log(max / min);
    return (value - min) / (max - min);
  }

  function normalizedToValue(knob, normalized) {
    var min = parseFloat(knob.dataset.min);
    var max = parseFloat(knob.dataset.max);
    var step = parseFloat(knob.dataset.step) || 1;
    var value = knob.dataset.curve === 'log' ? min * Math.pow(max / min, normalized) : min + (max - min) * normalized;
    return Math.round(value / step) * step;
  }

  function setSynthParam(param, value) {
    var knob = document.querySelector('.synth-knob[data-synth-param="' + param + '"]');
    if (knob) {
      var min = parseFloat(knob.dataset.min);
      var max = parseFloat(knob.dataset.max);
      value = Math.max(min, Math.min(max, value));
    }
    STATE.synthParams[param] = value;
    syncLegacyMacrosFromSynth();
    updateMacroUI();
    synthParamChanged();
  }

  function synthParamChanged() {
    syncLegacyMacrosFromSynth();
    checkMacroAdjusted();
    recomputeDerivedState();
    updateNextButton();
  }

  function syncLegacyMacrosFromSynth() {
    var s = STATE.synthParams;
    STATE.bassMacros.body = Math.round(s.sub);
    STATE.bassMacros.growl = Math.round(Math.min(100,
      s.fm * 0.28 + s.drive * 0.34 + (s.resonance / 20) * 18 + s.filterEnv * 0.20));
    STATE.bassMacros.wobble = Math.round(Math.min(100,
      s.depth * 0.76 + (s.rate / 4) * 16 + (s.detune / 36) * 8));
    var releaseSpace = Math.max(0, Math.min(1, (s.release - 30) / 470));
    STATE.bassMacros.space = Math.round(Math.min(100, s.space * 0.90 + releaseSpace * 10));
  }

  function setKnobVisual(knob, value) {
    var normalized = Math.max(0, Math.min(1, valueToNormalized(knob, value)));
    var angle = -135 + normalized * 270;
    knob.style.setProperty('--knob-angle', angle + 'deg');
    knob.style.setProperty('--knob-fill', (normalized * 270) + 'deg');
    knob.setAttribute('aria-valuemin', knob.dataset.min);
    knob.setAttribute('aria-valuemax', knob.dataset.max);
    knob.setAttribute('aria-valuenow', value);
    var valueNode = document.getElementById(knob.id + 'Val');
    if (valueNode) valueNode.textContent = formatSynthValue(knob.dataset.synthParam, value);
  }

  function formatSynthValue(param, value) {
    if (param === 'cutoff') return value >= 1000 ? (value / 1000).toFixed(value >= 3000 ? 1 : 2) + ' kHz' : Math.round(value) + ' Hz';
    if (param === 'resonance') return Number(value).toFixed(1) + ' Q';
    if (param === 'detune') return Math.round(value) + ' ct';
    if (param === 'attack' || param === 'release') return Math.round(value) + ' ms';
    if (param === 'rate') return ['1/2', '1/4', '1/8', '1/8T', '1/16'][Math.round(value)] || '1/8';
    return Math.round(value) + '%';
  }

  function renderWaveformOptions() {
    var container = document.getElementById('waveformOptions');
    var bank = window.DropDestinyWavetables;
    if (!container || !bank || container.children.length) return;
    Object.keys(bank.tables).forEach(function (id) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'waveform-btn';
      button.dataset.waveform = id;
      button.textContent = bank.metadata[id].label;
      button.addEventListener('click', function () {
        STATE.synthParams.waveform = id;
        updateWaveformSelection();
        drawSynthWaveform();
        synthParamChanged();
      });
      container.appendChild(button);
    });
  }

  function updateWaveformSelection() {
    document.querySelectorAll('.waveform-btn').forEach(function (button) {
      button.classList.toggle('active', button.dataset.waveform === STATE.synthParams.waveform);
    });
  }

  function drawSynthWaveform() {
    var canvas = document.getElementById('synthWaveCanvas');
    var bank = window.DropDestinyWavetables;
    if (!canvas || !bank || !bank.tables[STATE.synthParams.waveform]) return;
    var context = canvas.getContext('2d');
    var samples = bank.tables[STATE.synthParams.waveform];
    var width = canvas.width;
    var height = canvas.height;
    context.clearRect(0, 0, width, height);
    context.strokeStyle = 'rgba(0,255,204,0.16)';
    context.beginPath(); context.moveTo(0, height / 2); context.lineTo(width, height / 2); context.stroke();
    var oscB = STATE.synthParams.oscB || 'sawtooth';
    var mix = Math.max(0, Math.min(1, (STATE.synthParams.oscMix == null ? 45 : STATE.synthParams.oscMix) / 100));
    var gainA = Math.cos(mix * Math.PI / 2);
    var gainB = Math.sin(mix * Math.PI / 2);
    function oscBSample(phase) {
      if (oscB === 'sine') return Math.sin(phase * Math.PI * 2);
      if (oscB === 'triangle') return 1 - 4 * Math.abs(Math.round(phase) - phase);
      if (oscB === 'square') return phase < 0.5 ? 1 : -1;
      return 2 * phase - 1;
    }
    context.strokeStyle = 'rgba(142,125,255,0.42)';
    context.lineWidth = 1;
    context.beginPath();
    for (var b = 0; b < samples.length; b++) {
      var bx = b / (samples.length - 1) * width;
      var by = height / 2 - oscBSample(b / (samples.length - 1)) * height * 0.28;
      if (b === 0) context.moveTo(bx, by); else context.lineTo(bx, by);
    }
    context.stroke();
    context.strokeStyle = '#00ffcc';
    context.lineWidth = 2;
    context.shadowColor = '#00ffcc';
    context.shadowBlur = 8;
    context.beginPath();
    for (var i = 0; i < samples.length; i++) {
      var x = i / (samples.length - 1) * width;
      var combined = samples[i] * gainA + oscBSample(i / (samples.length - 1)) * gainB;
      var y = height / 2 - combined * height * 0.31;
      if (i === 0) context.moveTo(x, y); else context.lineTo(x, y);
    }
    context.stroke();
    context.shadowBlur = 0;
  }

  // ── 密度选择 ──────────────────────────────────────

  function showDensityPanel() {
    var panel = document.getElementById('densityPanel');
    if (panel) panel.style.display = 'block';
  }

  function setupDensityListeners() {
    var btns = document.querySelectorAll('.density-btn');
    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var d = parseInt(btn.dataset.density, 10);
        STATE.groove.density = d;
        btns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        recomputeDerivedState();
      });
    });
  }

  // ── 变奏选择 ──────────────────────────────────────

  function showVariationPanel() {
    var panel = document.getElementById('variationPanel');
    if (panel) panel.style.display = 'block';
  }

  function setupVariationListeners() {
    var btns = document.querySelectorAll('.variation-btn');
    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var v = btn.dataset.variation;
        STATE.choices.variation = v;
        btns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        recomputeDerivedState();
        updateNextButton();
      });
    });
  }

  // ── Pattern 编辑器 ────────────────────────────────

  var PATTERN_PADS = ['D', 'F', 'J', 'K'];
  var PATTERN_STEPS = 8;
  var PATTERN_LABELS = {
    D: 'D  Main Bass',
    F: 'F  Growl',
    J: 'J  Drum Fill',
    K: 'K  Chord'
  };
  var PATTERN_STEP_HEADERS = ['1', '&', '2', '&', '3', '&', '4', '&'];
  var patternCursor = 0;

  function showPatternPanel() {
    var panel = document.getElementById('patternPanel');
    if (panel) panel.style.display = 'block';
    renderPatternGrid();
  }

  function renderPatternGrid() {
    var grid = document.getElementById('patternGrid');
    if (!grid) return;
    grid.innerHTML = '';

    // 步骤表头：1 & 2 & 3 & 4 &
    var empty = document.createElement('div');
    empty.className = 'pad-label';
    grid.appendChild(empty);
    for (var s = 0; s < PATTERN_STEPS; s++) {
      var header = document.createElement('div');
      header.className = 'step-header';
      header.textContent = PATTERN_STEP_HEADERS[s];
      grid.appendChild(header);
    }

    // 每行一个 Pad
    for (var r = 0; r < PATTERN_PADS.length; r++) {
      var pad = PATTERN_PADS[r];
      var label = document.createElement('div');
      label.className = 'pad-label';
      label.textContent = PATTERN_LABELS[pad];
      grid.appendChild(label);

      for (var c = 0; c < PATTERN_STEPS; c++) {
        var cell = document.createElement('div');
        cell.className = 'pad-cell';
        cell.dataset.pad = pad;
        cell.dataset.step = c;
        if (isPatternCellActive(pad, c)) cell.classList.add('active');
        cell.addEventListener('click', function () {
          togglePatternCell(this.dataset.pad, parseInt(this.dataset.step, 10));
        });
        grid.appendChild(cell);
      }
    }
  }

  function isPatternCellActive(pad, step) {
    for (var i = 0; i < STATE.performance.events.length; i++) {
      if (STATE.performance.events[i].pad === pad && STATE.performance.events[i].step === step) {
        return true;
      }
    }
    return false;
  }

  function togglePatternCell(pad, step) {
    var found = -1;
    for (var i = 0; i < STATE.performance.events.length; i++) {
      if (STATE.performance.events[i].pad === pad && STATE.performance.events[i].step === step) {
        found = i;
        break;
      }
    }
    if (found >= 0) {
      STATE.performance.events.splice(found, 1);
    } else {
      STATE.performance.events.push({ step: step, pad: pad });
      STATE.performance.events.sort(function (a, b) {
        return a.step - b.step;
      });
    }
    // 预览声音
    AE.previewChoice('drop', pad);
    updatePatternGrid();
    recomputeDerivedState();
    updateNextButton();
  }

  function patternKeyAction(pad) {
    // 键盘 D/F/J/K：在当前 cursor 位置切换，然后前进
    togglePatternCell(pad, patternCursor);
    patternCursor = (patternCursor + 1) % PATTERN_STEPS;
    highlightCursor();
  }

  function highlightCursor() {
    var cells = document.querySelectorAll('.pad-cell');
    cells.forEach(function (cell) {
      cell.classList.remove('playing');
    });
    var active = document.querySelectorAll('.pad-cell[data-step="' + patternCursor + '"]');
    active.forEach(function (cell) {
      cell.classList.add('playing');
    });
    setTimeout(function () {
      active.forEach(function (cell) {
        cell.classList.remove('playing');
      });
    }, 200);
  }

  function updatePatternGrid() {
    var cells = document.querySelectorAll('.pad-cell');
    cells.forEach(function (cell) {
      var pad = cell.dataset.pad;
      var step = parseInt(cell.dataset.step, 10);
      cell.classList.toggle('active', isPatternCellActive(pad, step));
    });
  }

  function setupPatternListeners() {
    var clearBtn = document.getElementById('clearPattern');
    var playBtn = document.getElementById('playPattern');
    var stopBtn = document.getElementById('stopPattern');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        STATE.performance.events = [];
        patternCursor = 0;
        AE.stopPattern();
        updatePatternGrid();
        clearPlayhead();
        if (stopBtn) stopBtn.style.display = 'none';
        if (playBtn) playBtn.style.display = '';
        recomputeDerivedState();
        updateNextButton();
      });
    }
    if (playBtn) {
      playBtn.addEventListener('click', function () {
        if (STATE.performance.events.length === 0) return;
        var bpm = getBpm();
        AE.playPattern(STATE.performance.events, bpm, movePlayhead, function () {
          // 自然结束回调：恢复 UI
          playBtn.style.display = '';
          if (stopBtn) stopBtn.style.display = 'none';
          clearPlayhead();
        });
        playBtn.style.display = 'none';
        if (stopBtn) stopBtn.style.display = '';
      });
    }
    if (stopBtn) {
      stopBtn.addEventListener('click', function () {
        AE.stopPattern();
        stopBtn.style.display = 'none';
        if (playBtn) playBtn.style.display = '';
        clearPlayhead();
      });
    }
  }

  function movePlayhead(step) {
    clearPlayhead();
    var cells = document.querySelectorAll('.pad-cell[data-step="' + step + '"]');
    cells.forEach(function (cell) {
      cell.classList.add('playhead');
    });
    // 最后一步后清除
    if (step === 7) {
      setTimeout(clearPlayhead, 200);
    }
  }

  function clearPlayhead() {
    var cells = document.querySelectorAll('.pad-cell.playhead');
    cells.forEach(function (cell) {
      cell.classList.remove('playhead');
    });
  }

  // 清理 Pattern 试听状态并恢复 UI
  function cleanupPatternUI() {
    AE.stopPattern();
    clearPlayhead();
    var playPatBtn = document.getElementById('playPattern');
    var stopPatBtn = document.getElementById('stopPattern');
    if (playPatBtn) playPatBtn.style.display = '';
    if (stopPatBtn) stopPatBtn.style.display = 'none';
  }

  function getBpm() {
    var r = STATE.choices.rhythm;
    if (r === 'halfTime') return 140;
    if (r === 'fourOnFloor') return 124;
    if (r === 'syncopated') return 145;
    if (r === 'breakbeat') return 165;
    return 140;
  }

  // ── 导航 ──────────────────────────────────────────

  // ── Music Workbench ────────────────────────────────

  var wbRafId = null;

  function showWorkbench() {
    if (dom.workbench) dom.workbench.style.display = 'flex';
    // 连接可视化到真实 Analyser
    var an = AE.getAnalyser();
    if (an && dom.wbCanvas) {
      VIZ.setAnalyser(an);
      VIZ.start(dom.wbCanvas, an);
    }
    // 启动位置更新（确保只有一个 RAF）
    if (!wbRafId) updateWorkbenchDisplay();
  }

  function hideWorkbench() {
    if (dom.workbench) dom.workbench.style.display = 'none';
    if (wbRafId) { cancelAnimationFrame(wbRafId); wbRafId = null; }
    VIZ.stop();
  }

  function updateWorkbenchDisplay() {
    // 最终作品播放时显示不同状态
    var isFinalPlaying = AE.getIsFinalSongPlaying ? AE.getIsFinalSongPlaying() : false;

    if (isFinalPlaying) {
      if (dom.wbBpm) dom.wbBpm.textContent = getBpm() + ' BPM';
      if (dom.wbPosition) dom.wbPosition.textContent = 'PLAYING';
      if (dom.wbPlayPause) {
        dom.wbPlayPause.classList.add('playing');
        dom.wbPlayPause.disabled = true;
      }
    } else {
      var bpm = AE.getBpm ? AE.getBpm() : null;
      if (bpm && dom.wbBpm) dom.wbBpm.textContent = bpm + ' BPM';

      var pos = AE.getPosition ? AE.getPosition() : null;
      if (pos && dom.wbPosition) {
        dom.wbPosition.textContent = pos.bar + '.' + pos.beat;
      } else if (dom.wbPosition) {
        dom.wbPosition.textContent = '---';
      }

      if (dom.wbPlayPause) {
        dom.wbPlayPause.disabled = false;
        var playing = AE.getIsPlaying ? AE.getIsPlaying() : false;
        dom.wbPlayPause.classList.toggle('playing', playing);
      }
    }

    wbRafId = requestAnimationFrame(updateWorkbenchDisplay);
  }

  function togglePlayPause() {
    // 最终作品播放时不允许切换 Loop
    if (AE.getIsFinalSongPlaying && AE.getIsFinalSongPlaying()) return;
    if (!AE.setPaused) return;
    var paused = AE.getIsPaused ? AE.getIsPaused() : false;
    AE.setPaused(!paused);
    if (dom.wbPlayPause) {
      dom.wbPlayPause.classList.toggle('playing', !paused);
    }
  }

  function setupWorkbenchListeners() {
    if (dom.wbPlayPause) {
      dom.wbPlayPause.addEventListener('click', togglePlayPause);
      // 触摸支持
      dom.wbPlayPause.addEventListener('touchend', function (e) {
        e.preventDefault();
        togglePlayPause();
      });
    }
  }

  function goToPhase(phase) {
    STATE.phase = phase;
    PHASES.forEach(function (p) {
      if (dom.sections[p]) {
        dom.sections[p].classList.remove('active');
      }
    });
    if (dom.sections[phase]) {
      dom.sections[phase].classList.add('active');
    }

    // Footer 显示控制
    dom.footer.style.display = (phase === 'intro') ? 'none' : 'block';

    // 进度点
    updateProgressDots();

    // 阶段标签
    var labels = {
      soundWorld: '阶段 1/5 · 声音世界',
      bassForge: '阶段 2/5 · Bass Forge',
      groove: '阶段 3/5 · Groove Lab',
      arrangement: '阶段 4/5 · Arrangement',
      liveDrop: '阶段 5/5 · Live Drop',
      result: '结算'
    };
    dom.phaseLabel.textContent = labels[phase] || '';

    // 滚动到顶部
    window.scrollTo(0, 0);

    // 结果页特殊处理
    if (phase === 'result') {
      renderResult();
    }

    // 重新渲染选项（恢复选中状态）
    if (phase === 'soundWorld') renderOptions('soundWorldOptions', 'soundWorld');
    if (phase === 'bassForge') {
      renderOptions('bassPersonalityOptions', 'bassPersonality');
      if (STATE.choices.bassPersonality) {
        showMacroPanel();
      }
    }
    if (phase === 'groove') {
      renderOptions('rhythmOptions', 'rhythm');
      if (STATE.choices.rhythm) showDensityPanel();
      updateDensityUI();
    }
    if (phase === 'arrangement') {
      renderOptions('structureOptions', 'structure');
      if (STATE.choices.structure) showVariationPanel();
      updateVariationUI();
    }
    if (phase === 'liveDrop') {
      renderOptions('dropOptions', 'drop');
      if (STATE.choices.drop) showPatternPanel();
    }

    updateNextButton();
    updateBackButton();
  }

  function updateProgressDots() {
    var dots = dom.progressDots.querySelectorAll('.dot');
    var stageIdx = STAGE_PHASES.indexOf(STATE.phase);
    dots.forEach(function (dot, idx) {
      dot.classList.remove('active', 'done');
      if (idx < stageIdx) dot.classList.add('done');
      else if (idx === stageIdx) dot.classList.add('active');
    });
  }

  function updateDensityUI() {
    var btns = document.querySelectorAll('.density-btn');
    btns.forEach(function (btn) {
      btn.classList.toggle('active', parseInt(btn.dataset.density, 10) === STATE.groove.density);
    });
  }

  function updateVariationUI() {
    var btns = document.querySelectorAll('.variation-btn');
    btns.forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.variation === STATE.choices.variation);
    });
  }

  function goNext() {
    var idx = PHASES.indexOf(STATE.phase);
    if (idx < 0 || idx >= PHASES.length - 1) return;

    // Live Drop → Result：标记演奏完成，清理 Pattern 试听
    if (STATE.phase === 'liveDrop') {
      if (STATE.performance.events.length === 0) return;
      STATE.performance.completed = true;
      cleanupPatternUI();
      recomputeDerivedState();
    }

    var nextPhase = PHASES[idx + 1];
    goToPhase(nextPhase);

    // 离开 intro 时确保音频引擎已启动
    if (nextPhase === 'soundWorld' && STATE.choices.soundWorld) {
      AE.start(STATE);
    }
  }

  function goBack() {
    var idx = PHASES.indexOf(STATE.phase);
    if (idx <= 0) return;
    if (STATE.phase === 'intro') return;
    var prevPhase = PHASES[idx - 1];
    if (prevPhase === 'intro') {
      goToPhase('intro');
    } else {
      goToPhase(prevPhase);
    }
  }

  function restart() {
    AE.stop();
    STATE = createInitialState();
    patternCursor = 0;
    hideWorkbench();
    // 清理 Pattern 和按钮状态
    cleanupPatternUI();
    // 重置最终歌曲按钮状态
    var playSongBtn = document.getElementById('playSong');
    var stopSongBtn = document.getElementById('stopSong');
    if (playSongBtn) playSongBtn.style.display = '';
    if (stopSongBtn) stopSongBtn.style.display = 'none';
    goToPhase('intro');
    VIZ.setTheme('default');
    VIZ.setIntensity(0.5);
    VIZ.setAnalyser(null);
  }

  // ── 导航按钮状态 ──────────────────────────────────

  function updateNextButton() {
    var nextBtn = dom.sections[STATE.phase] && dom.sections[STATE.phase].querySelector('[data-next]');
    if (!nextBtn) return;
    var canProceed = false;
    switch (STATE.phase) {
      case 'soundWorld':
        canProceed = !!STATE.choices.soundWorld;
        break;
      case 'bassForge':
        canProceed = !!STATE.choices.bassPersonality && hasMacroAdjusted();
        break;
      case 'groove':
        canProceed = !!STATE.choices.rhythm;
        break;
      case 'arrangement':
        canProceed = !!STATE.choices.structure && !!STATE.choices.variation;
        break;
      case 'liveDrop':
        canProceed = !!STATE.choices.drop && STATE.performance.events.length > 0;
        if (nextBtn) nextBtn.textContent = '完成演奏 →';
        break;
      default:
        canProceed = true;
    }
    nextBtn.disabled = !canProceed;
  }

  function updateBackButton() {
    var backBtn = dom.sections[STATE.phase] && dom.sections[STATE.phase].querySelector('[data-back]');
    if (!backBtn) return;
    var canBack = STATE.phase !== 'intro';
    backBtn.style.visibility = canBack ? 'visible' : 'hidden';
  }

  function hasMacroAdjusted() {
    var preset = D.SYNTH_PRESETS && D.SYNTH_PRESETS[STATE.choices.bassPersonality];
    if (!preset) return false;
    return ['waveform', 'oscB', 'oscMix', 'detune', 'filterType', 'filterEnv',
      'sub', 'fm', 'cutoff', 'resonance', 'drive', 'attack', 'release',
      'rate', 'depth', 'lfoShape', 'lfoTarget', 'space']
      .some(function (param) { return STATE.synthParams[param] !== preset[param]; });
  }

  // ── 派生状态重算 ──────────────────────────────────

  function recomputeDerivedState() {
    STATE.dna = SE.computeDna(STATE);
    renderDNABars();

    // 实时更新正在播放的 Loop 参数（平滑更新，不重建 AudioContext）
    AE.applyState(STATE);

    // 更新可视化强度
    var avg = 0;
    DNA_AXES.forEach(function (a) { avg += STATE.dna[a]; });
    avg /= DNA_AXES.length;
    VIZ.setIntensity(avg / 100);
  }

  // ── DNA 条渲染 ────────────────────────────────────

  function renderDNABars() {
    if (!dom.dnaBars) return;
    dom.dnaBars.innerHTML = '';
    DNA_AXES.forEach(function (axis) {
      var bar = document.createElement('div');
      bar.className = 'dna-bar';
      var name = document.createElement('div');
      name.className = 'dna-name';
      name.textContent = DNA_LABELS[axis];
      var track = document.createElement('div');
      track.className = 'dna-track';
      var fill = document.createElement('div');
      fill.className = 'dna-fill';
      fill.style.width = STATE.dna[axis] + '%';
      fill.style.background = DNA_COLORS[axis];
      track.appendChild(fill);
      var val = document.createElement('div');
      val.className = 'dna-val';
      val.textContent = Math.round(STATE.dna[axis]);
      bar.appendChild(name);
      bar.appendChild(track);
      bar.appendChild(val);
      dom.dnaBars.appendChild(bar);
    });
  }

  // ── 结算页渲染 ────────────────────────────────────

  function renderResult() {
    STATE.result = SE.evaluate(STATE);
    var r = STATE.result;
    if (AE.preloadEnding) AE.preloadEnding(r.primaryStyle);
    var html = '';

    // 主风格
    var primaryLabel = r.isHidden ? 'Destiny Fusion' :
      (D.STYLE_PROFILES[r.primaryStyle] ? D.STYLE_PROFILES[r.primaryStyle].label : r.primaryStyle);
    var secondaryLabel = D.STYLE_PROFILES[r.secondaryStyle] ? D.STYLE_PROFILES[r.secondaryStyle].label : r.secondaryStyle;

    html += '<div class="result-style">';
    html += '<div class="style-label">你的风格</div>';
    html += '<div class="style-name">' + escapeHtml(primaryLabel) + '</div>';
    if (!r.isHidden) {
      html += '<div class="style-secondary">with ' + escapeHtml(secondaryLabel) + ' influence</div>';
    } else {
      html += '<div class="hidden-badge">⚡ HIDDEN ENDING UNLOCKED</div>';
    }
    html += '</div>';

    // DNA 雷达图 + 得分
    html += '<div class="result-body">';
    html += '<div class="result-radar">';
    html += '<h4 style="font-size:0.85rem;color:var(--text-dim);margin-bottom:8px;">DNA 雷达图</h4>';
    html += renderRadarSVG(r.dna, r.primaryStyle);
    html += '</div>';
    html += '<div class="result-scores">';
    html += '<h4>风格得分</h4>';
    html += renderScoreBars(r);
    html += '</div>';
    html += '</div>';

    // 观众反应
    html += '<div class="result-reaction">';
    html += '<div class="reaction-label">观众反应</div>';
    html += '<div class="reaction-text">' + escapeHtml(r.audienceReaction) + '</div>';
    html += '</div>';

    dom.resultContent.innerHTML = html;
  }

  function showFinalSongError(message) {
    var existing = document.getElementById('finalSongError');
    if (!existing) {
      existing = document.createElement('div');
      existing.id = 'finalSongError';
      existing.className = 'final-song-error';
      dom.resultContent.appendChild(existing);
    }
    existing.textContent = message || '新的结局伴奏加载失败。';
    existing.style.display = '';
  }

  function clearFinalSongError() {
    var existing = document.getElementById('finalSongError');
    if (existing) {
      existing.textContent = '';
      existing.style.display = 'none';
    }
  }

  function renderRadarSVG(dna, primaryStyle) {
    var cx = 140, cy = 140, maxR = 100;
    var n = DNA_AXES.length;
    var points = [];
    var idealPoints = [];
    var ideal = D.STYLE_PROFILES[primaryStyle] ? D.STYLE_PROFILES[primaryStyle].dna : null;

    for (var i = 0; i < n; i++) {
      var angle = (Math.PI * 2 * i / n) - Math.PI / 2;
      var val = dna[DNA_AXES[i]] / 100;
      var x = cx + Math.cos(angle) * maxR * val;
      var y = cy + Math.sin(angle) * maxR * val;
      points.push(x.toFixed(1) + ',' + y.toFixed(1));

      if (ideal) {
        var iv = ideal[DNA_AXES[i]] / 100;
        var ix = cx + Math.cos(angle) * maxR * iv;
        var iy = cy + Math.sin(angle) * maxR * iv;
        idealPoints.push(ix.toFixed(1) + ',' + iy.toFixed(1));
      }
    }

    var svg = '<svg viewBox="0 0 280 280" xmlns="http://www.w3.org/2000/svg">';
    // 背景网格
    for (var g = 1; g <= 4; g++) {
      var gr = maxR * g / 4;
      var gp = [];
      for (var gi = 0; gi < n; gi++) {
        var ga = (Math.PI * 2 * gi / n) - Math.PI / 2;
        gp.push((cx + Math.cos(ga) * gr).toFixed(1) + ',' + (cy + Math.sin(ga) * gr).toFixed(1));
      }
      svg += '<polygon points="' + gp.join(' ') + '" fill="none" stroke="#2a2a44" stroke-width="1"/>';
    }
    // 轴线
    for (var ai = 0; ai < n; ai++) {
      var aa = (Math.PI * 2 * ai / n) - Math.PI / 2;
      svg += '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + Math.cos(aa) * maxR).toFixed(1) + '" y2="' + (cy + Math.sin(aa) * maxR).toFixed(1) + '" stroke="#2a2a44" stroke-width="1"/>';
    }
    // 理想轮廓
    if (idealPoints.length > 0) {
      svg += '<polygon points="' + idealPoints.join(' ') + '" fill="none" stroke="#ff00aa" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.6"/>';
    }
    // 用户 DNA
    svg += '<polygon points="' + points.join(' ') + '" fill="rgba(0,255,204,0.15)" stroke="#00ffcc" stroke-width="2"/>';
    // 数据点
    for (var pi = 0; pi < n; pi++) {
      var p = points[pi].split(',');
      svg += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3" fill="#00ffcc"/>';
    }
    // 标签
    for (var li = 0; li < n; li++) {
      var la = (Math.PI * 2 * li / n) - Math.PI / 2;
      var lr = maxR + 18;
      var lx = cx + Math.cos(la) * lr;
      var ly = cy + Math.sin(la) * lr;
      svg += '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="#8888aa">' + DNA_LABELS[DNA_AXES[li]] + '</text>';
    }
    svg += '</svg>';
    return svg;
  }

  function renderScoreBars(r) {
    var html = '';
    var sorted = SE.STYLE_IDS.slice().sort(function (a, b) {
      return r.finalScores[b] - r.finalScores[a];
    });
    sorted.forEach(function (sid, idx) {
      var label = D.STYLE_PROFILES[sid] ? D.STYLE_PROFILES[sid].label : sid;
      var score = r.finalScores[sid];
      var cls = '';
      if (sid === r.primaryStyle && !r.isHidden) cls = 'primary';
      else if (sid === r.secondaryStyle) cls = 'secondary';
      html += '<div class="score-row ' + cls + '">';
      html += '<span class="score-name">' + escapeHtml(label) + '</span>';
      html += '<div class="score-track"><div class="score-fill" style="width:' + score.toFixed(1) + '%"></div></div>';
      html += '<span class="score-val">' + score.toFixed(1) + '</span>';
      html += '</div>';
    });
    return html;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── 静音 ──────────────────────────────────────────

  function toggleMute() {
    STATE.ui.muted = !STATE.ui.muted;
    AE.setMuted(STATE.ui.muted);
    dom.muteBtn.classList.toggle('muted', STATE.ui.muted);
  }

  // ── 键盘 ──────────────────────────────────────────

  function setupKeyboard() {
    document.addEventListener('keydown', function (e) {
      // 防止在输入框中触发
      if (e.target.tagName === 'INPUT' && e.target.type === 'range') return;

      var key = e.key.toLowerCase();

      // M = 静音
      if (key === 'm') { toggleMute(); e.preventDefault(); return; }

      // Enter = 下一步
      if (key === 'enter') {
        var nextBtn = dom.sections[STATE.phase] && dom.sections[STATE.phase].querySelector('[data-next]');
        if (nextBtn && !nextBtn.disabled) { goNext(); e.preventDefault(); }
        return;
      }

      // D/F/J/K = Pattern 演奏（仅 Live Drop 阶段）
      if (STATE.phase === 'liveDrop' && STATE.choices.drop) {
        var pad = key.toUpperCase();
        if (PATTERN_PADS.indexOf(pad) >= 0) {
          patternKeyAction(pad);
          e.preventDefault();
          return;
        }
      }

      // 数字键 = 选择选项
      if (STATE.phase !== 'intro' && STATE.phase !== 'result') {
        var num = parseInt(key, 10);
        if (num >= 1 && num <= 4) {
          var phaseMap = {
            soundWorld: 'soundWorld',
            bassForge: 'bassPersonality',
            groove: 'rhythm',
            arrangement: 'structure',
            liveDrop: 'drop'
          };
          var phase = phaseMap[STATE.phase];
          if (phase) {
            var choices = D.CHOICES[phase];
            var keys = Object.keys(choices);
            if (num <= keys.length) {
              selectOption(phase, keys[num - 1]);
              e.preventDefault();
            }
          }
        }
      }
    });
  }

  // ── 导航按钮绑定 ──────────────────────────────────

  function setupNavButtons() {
    // 通用 next/back
    document.querySelectorAll('[data-next]').forEach(function (btn) {
      btn.addEventListener('click', goNext);
    });
    document.querySelectorAll('[data-back]').forEach(function (btn) {
      btn.addEventListener('click', goBack);
    });

    // Start
    if (dom.startBtn) {
      dom.startBtn.addEventListener('click', function () {
        AE.start(STATE);
        goToPhase('soundWorld');
      });
    }

    // Mute
    if (dom.muteBtn) {
      dom.muteBtn.addEventListener('click', toggleMute);
    }

    // Result buttons
    var playSongBtn = document.getElementById('playSong');
    var stopSongBtn = document.getElementById('stopSong');
    var restartBtn = document.getElementById('restart');
    var backToModifyBtn = document.getElementById('backToModify');
    if (playSongBtn) {
      playSongBtn.addEventListener('click', function () {
        if (AE.getIsFinalSongPlaying && AE.getIsFinalSongPlaying()) return;
        clearFinalSongError();
        // 清理 Pattern 试听状态
        cleanupPatternUI();
        // playFinalSong 内部会暂停 Loop，播放最终作品
        playSongBtn.style.display = 'none';
        if (stopSongBtn) stopSongBtn.style.display = '';
        var playback = AE.playFinalSong(STATE, function () {
          // 播放完成回调：恢复按钮状态
          playSongBtn.style.display = '';
          if (stopSongBtn) stopSongBtn.style.display = 'none';
        });
        if (playback && typeof playback.then === 'function') {
          playback.then(function (started) {
            if (started) return;
            playSongBtn.style.display = '';
            if (stopSongBtn) stopSongBtn.style.display = 'none';
            showFinalSongError(AE.getFinalSongError ? AE.getFinalSongError() : null);
          });
        }
      });
    }
    if (stopSongBtn) {
      stopSongBtn.addEventListener('click', function () {
        AE.stopFinalSong();
        stopSongBtn.style.display = 'none';
        if (playSongBtn) playSongBtn.style.display = '';
      });
    }
    if (restartBtn) {
      restartBtn.addEventListener('click', restart);
    }
    if (backToModifyBtn) {
      backToModifyBtn.addEventListener('click', function () {
        // 停止最终作品
        AE.stopFinalSong();
        // 清理 Pattern 试听
        cleanupPatternUI();
        // 恢复 Loop
        AE.start(STATE);
        showWorkbench();
        if (playSongBtn) playSongBtn.style.display = '';
        if (stopSongBtn) stopSongBtn.style.display = 'none';
        goToPhase('liveDrop');
      });
    }
  }

  // ── 初始化 ────────────────────────────────────────

  function init() {
    cacheDom();
    renderDNABars();
    setupMacroListeners();
    setupDensityListeners();
    setupVariationListeners();
    setupPatternListeners();
    setupNavButtons();
    setupKeyboard();
    setupWorkbenchListeners();

    // Intro 可视化不使用伪数据，仅设置主题
    VIZ.setTheme('default');
    VIZ.setIntensity(0.5);

    // 窗口缩放时更新 Canvas
    window.addEventListener('resize', function () {
      if (dom.wbCanvas && AE.getAnalyser()) {
        VIZ.resize();
      }
    });

    // 渲染初始选项
    renderOptions('soundWorldOptions', 'soundWorld');
    renderOptions('bassPersonalityOptions', 'bassPersonality');
    renderOptions('rhythmOptions', 'rhythm');
    renderOptions('structureOptions', 'structure');
    renderOptions('dropOptions', 'drop');

    goToPhase('intro');
  }

  // DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
