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
  var PHASES = ['intro', 'soundWorld', 'bassCore', 'rhythm', 'bassForge', 'result'];
  var STAGE_PHASES = ['soundWorld', 'bassCore', 'rhythm', 'bassForge'];
  var DNA_AXES = D.DNA_AXES;
  var DNA_LABELS = {
    rhythm: 'Rhythm', aggression: 'Aggression', harmony: 'Harmony',
    movement: 'Movement', space: 'Space', surprise: 'Surprise'
  };
  var DNA_COLORS = {
    rhythm: '#FFCE00', aggression: '#FF3B18', harmony: '#FFE9B0',
    movement: '#FF7A00', space: '#FFFFFF', surprise: '#A7190B'
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
    dom.studioShell = document.getElementById('studioShell');
    dom.main = document.getElementById('main');
    dom.progressDots = document.getElementById('progressDots');
    dom.muteBtn = document.getElementById('muteBtn');
    dom.introCanvas = document.getElementById('introCanvas');
    dom.resultContent = document.getElementById('resultContent');
    // Workbench
    dom.workbench = document.getElementById('workbench');
    dom.wbPlayPause = document.getElementById('wbPlayPause');
    dom.wbBpm = document.getElementById('wbBpm');
    dom.wbPosition = document.getElementById('wbPosition');
    dom.wbCanvas = document.getElementById('wbCanvas');
    dom.visualSceneLabel = document.getElementById('visualSceneLabel');
    dom.visualSectionLabel = document.getElementById('visualSectionLabel');
    dom.visualModeBtn = document.getElementById('visualModeBtn');
    dom.visualFullscreenBtn = document.getElementById('visualFullscreenBtn');
    dom.driveStage = document.getElementById('driveStage');
    dom.driveHeatLabel = document.getElementById('driveHeatLabel');
    dom.auditionBass = document.getElementById('auditionBass');
    dom.resetBass = document.getElementById('resetBass');
    dom.synthVisualDock = document.getElementById('synthVisualDock');
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
    keys.forEach(function (key) {
      var opt = choices[key];
      var card = document.createElement('div');
      card.className = 'option-card';
      card.dataset.choice = key;
      card.dataset.phase = choiceKey;
      if (STATE.choices[choiceKey] === key) card.classList.add('selected');
      var label = document.createElement('div');
      label.className = 'opt-label';
      label.textContent = opt.label;
      var desc = document.createElement('div');
      desc.className = 'opt-desc';
      desc.textContent = opt.description;
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
    if (phase === 'bassPersonality' && STATE.phase === 'bassForge') {
      showMacroPanel();
    }
    if (phase === 'rhythm') {
      showDensityPanel();
      checkMacroAdjusted();
    }
    recomputeDerivedState();
    updateNextButton();
  }

  function findOptionContainer(phase) {
    var map = {
      soundWorld: 'soundWorldOptions',
      bassPersonality: 'bassPersonalityOptions',
      rhythm: 'rhythmOptions'
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
    updateDriveHeatUI();
    checkMacroAdjusted();
  }

  function updateDriveHeatUI() {
    var drive = Math.max(0, Math.min(100, Number(STATE.synthParams.drive) || 0));
    var label = drive < 24 ? 'CLEAN CUT' : drive < 48 ? 'GRIT' : drive < 72 ? 'CRUSH' : drive < 90 ? 'BURN' : 'MELTDOWN';
    if (dom.driveHeatLabel) dom.driveHeatLabel.textContent = label;
    if (dom.driveStage) {
      dom.driveStage.dataset.heat = drive < 34 ? 'low' : drive < 70 ? 'mid' : 'high';
      dom.driveStage.style.setProperty('--drive-level', drive / 100);
    }
    if (dom.app) dom.app.style.setProperty('--drive-level', drive / 100);
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
    hint.textContent = adjusted ? '✓ BASS 已经离开预设，可以铸造结局' : '改变至少一个真实参数，才能完成铸造。';
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

  function setupForgeActions() {
    if (dom.auditionBass) {
      dom.auditionBass.addEventListener('click', function () {
        if (!STATE.choices.bassPersonality) return;
        AE.applyState(STATE);
        AE.previewChoice('bassPersonality', STATE.choices.bassPersonality);
        if (VIZ.pulsePad) VIZ.pulsePad('F', Math.round((STATE.synthParams.drive || 0) / 13));
      });
    }
    if (dom.resetBass) {
      dom.resetBass.addEventListener('click', function () {
        if (!STATE.choices.bassPersonality) return;
        applyPresetDefaults(STATE.choices.bassPersonality);
        recomputeDerivedState();
        updateNextButton();
        AE.previewChoice('bassPersonality', STATE.choices.bassPersonality);
      });
    }
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
    context.strokeStyle = 'rgba(255,206,0,0.18)';
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
    context.strokeStyle = 'rgba(215,47,25,0.62)';
    context.lineWidth = 1;
    context.beginPath();
    for (var b = 0; b < samples.length; b++) {
      var bx = b / (samples.length - 1) * width;
      var by = height / 2 - oscBSample(b / (samples.length - 1)) * height * 0.28;
      if (b === 0) context.moveTo(bx, by); else context.lineTo(bx, by);
    }
    context.stroke();
    context.strokeStyle = '#FFCE00';
    context.lineWidth = 2;
    context.shadowColor = '#FF3B18';
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
    if (panel) panel.style.display = 'grid';
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
  var visualStarted = false;
  var visualHudTick = 0;

  function showWorkbench() {
    if (dom.app) dom.app.classList.add('visual-active');
    if (dom.workbench) dom.workbench.style.display = 'grid';
    // 连接可视化到真实 Analyser
    var an = AE.getAnalyser();
    if (an && dom.wbCanvas) {
      VIZ.setAnalyser(an);
      if (!visualStarted) {
        VIZ.start(dom.wbCanvas, an);
        visualStarted = true;
      }
    }
    if (VIZ.setExperienceState) VIZ.setExperienceState(STATE);
    // 启动位置更新（确保只有一个 RAF）
    if (!wbRafId) updateWorkbenchDisplay();
  }

  function hideWorkbench() {
    if (dom.workbench) dom.workbench.style.display = 'none';
    if (dom.app) dom.app.classList.remove('visual-active');
    if (wbRafId) { cancelAnimationFrame(wbRafId); wbRafId = null; }
    VIZ.stop();
    visualStarted = false;
  }

  function getFinalVisualSection(progress) {
    if (progress < 0.13) return 'intro';
    if (progress < 0.35) return 'build';
    if (progress < 0.40) return 'predrop';
    if (progress < 0.67) return 'dropA';
    if (progress < 0.92) return 'dropB';
    return 'outro';
  }

  function updateVisualHud() {
    if (!VIZ.getMetrics) return;
    var visual = VIZ.getMetrics();
    if (dom.visualSceneLabel) dom.visualSceneLabel.textContent = visual.sceneLabel || 'DESTINY SIGNAL';
    if (dom.visualSectionLabel) dom.visualSectionLabel.textContent = visual.sectionLabel || 'CREATION LOOP';
  }

  function updateWorkbenchDisplay() {
    // 最终作品播放时显示不同状态
    var isFinalPlaying = AE.getIsFinalSongPlaying ? AE.getIsFinalSongPlaying() : false;

    if (isFinalPlaying) {
      var finalPosition = AE.getFinalSongPosition ? AE.getFinalSongPosition() : null;
      var finalProgress = finalPosition && typeof finalPosition.progress === 'number' ? finalPosition.progress : 0;
      var finalSection = finalPosition && finalPosition.section ? finalPosition.section : getFinalVisualSection(finalProgress);
      if (VIZ.setPlayback) VIZ.setPlayback({ isFinal: true, progress: finalProgress, section: finalSection });
      if (dom.wbBpm) dom.wbBpm.textContent = (AE.getBpm ? AE.getBpm() : getBpm()) + ' BPM';
      if (dom.wbPosition) dom.wbPosition.textContent = Math.round(finalProgress * 100) + '%';
      if (dom.wbPlayPause) {
        dom.wbPlayPause.classList.add('playing');
        dom.wbPlayPause.disabled = true;
      }
    } else {
      if (VIZ.setPlayback) VIZ.setPlayback({ isFinal: false, progress: 0, section: 'creation' });
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

    visualHudTick = (visualHudTick + 1) % 4;
    if (visualHudTick === 0) updateVisualHud();

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

    if (dom.visualModeBtn) {
      dom.visualModeBtn.addEventListener('click', function () {
        var mode = VIZ.cycleMode ? VIZ.cycleMode() : 'auto';
        dom.visualModeBtn.textContent = String(mode || 'auto').toUpperCase();
      });
    }

    if (dom.visualFullscreenBtn && dom.workbench) {
      dom.visualFullscreenBtn.addEventListener('click', function () {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else if (dom.workbench.requestFullscreen) {
          dom.workbench.requestFullscreen();
        }
      });

      var cursorTimer = null;
      dom.workbench.addEventListener('mousemove', function () {
        dom.workbench.classList.remove('cursor-hidden');
        if (cursorTimer) clearTimeout(cursorTimer);
        if (document.fullscreenElement === dom.workbench) {
          cursorTimer = setTimeout(function () {
            dom.workbench.classList.add('cursor-hidden');
          }, 1800);
        }
      });
      document.addEventListener('fullscreenchange', function () {
        if (document.fullscreenElement !== dom.workbench) dom.workbench.classList.remove('cursor-hidden');
        setTimeout(function () { VIZ.resize(); }, 60);
      });
    }
  }

  function dockWorkbenchForPhase(phase) {
    if (!dom.workbench || !dom.studioShell || !dom.main) return;
    if (phase === 'bassForge' && dom.synthVisualDock) {
      if (dom.workbench.parentNode !== dom.synthVisualDock) dom.synthVisualDock.appendChild(dom.workbench);
      dom.workbench.classList.add('synth-docked');
    } else {
      if (dom.workbench.parentNode !== dom.studioShell) dom.studioShell.insertBefore(dom.workbench, dom.main);
      dom.workbench.classList.remove('synth-docked');
    }
    setTimeout(function () { VIZ.resize(); }, 40);
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

    if (dom.app) dom.app.setAttribute('data-phase', phase);
    dockWorkbenchForPhase(phase);
    if (phase === 'intro') hideWorkbench();
    else showWorkbench();
    if (dom.app && phase !== 'result') dom.app.removeAttribute('data-ending-style');
    if (VIZ.setExperienceState) VIZ.setExperienceState(STATE);

    // 进度点
    updateProgressDots();

    // 滚动到顶部
    window.scrollTo(0, 0);
    if (dom.main) dom.main.scrollTop = 0;

    // 结果页特殊处理
    if (phase === 'result') {
      renderResult();
    }

    // 重新渲染选项（恢复选中状态）
    if (phase === 'soundWorld') renderOptions('soundWorldOptions', 'soundWorld');
    if (phase === 'bassCore') renderOptions('bassPersonalityOptions', 'bassPersonality');
    if (phase === 'rhythm') {
      renderOptions('rhythmOptions', 'rhythm');
      updateDensityUI();
    }
    if (phase === 'bassForge') {
      showMacroPanel();
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

    // Bass Forge → Result：Bass 参数完成后自动推导编排与 Drop 倾向
    if (STATE.phase === 'bassForge') {
      syncBassDrivenSongChoices();
      STATE.performance.completed = true;
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
    hideWorkbench();
    // 重置最终歌曲按钮状态
    var playSongBtn = document.getElementById('playSong');
    var stopSongBtn = document.getElementById('stopSong');
    if (playSongBtn) playSongBtn.style.display = '';
    if (stopSongBtn) stopSongBtn.style.display = 'none';
    goToPhase('intro');
    VIZ.setTheme('default');
    VIZ.setIntensity(0.5);
    VIZ.setAnalyser(null);
    if (VIZ.setPlayback) VIZ.setPlayback({ isFinal: false, progress: 0, section: 'creation' });
    if (VIZ.setExperienceState) VIZ.setExperienceState(STATE);
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
        canProceed = hasMacroAdjusted();
        if (nextBtn) nextBtn.textContent = '铸造结局 →';
        break;
      case 'bassCore':
        canProceed = !!STATE.choices.bassPersonality;
        break;
      case 'rhythm':
        canProceed = !!STATE.choices.rhythm;
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

  function syncBassDrivenSongChoices() {
    if (!SE.deriveBassDrivenChoices) return;
    var derived = SE.deriveBassDrivenChoices(STATE);
    STATE.choices.structure = derived.structure;
    STATE.choices.variation = derived.variation;
    STATE.choices.drop = derived.drop;
  }

  function recomputeDerivedState() {
    syncBassDrivenSongChoices();
    STATE.dna = SE.computeDna(STATE);

    // 实时更新正在播放的 Loop 参数（平滑更新，不重建 AudioContext）
    AE.applyState(STATE);

    // 更新可视化强度
    var avg = 0;
    DNA_AXES.forEach(function (a) { avg += STATE.dna[a]; });
    avg /= DNA_AXES.length;
    VIZ.setIntensity(avg / 100);
    if (VIZ.setExperienceState) VIZ.setExperienceState(STATE);
  }

  // ── 结算页渲染 ────────────────────────────────────

  function renderResult() {
    STATE.result = SE.evaluate(STATE);
    var r = STATE.result;
    if (dom.app) dom.app.setAttribute('data-ending-style', r.isHidden ? 'destinyFusion' : r.primaryStyle);
    if (VIZ.setExperienceState) VIZ.setExperienceState(STATE);
    if (AE.preloadEnding) AE.preloadEnding(r.primaryStyle);
    var html = '';

    // 主风格
    var primaryLabel = r.isHidden ? 'Destiny Fusion' :
      (D.STYLE_PROFILES[r.primaryStyle] ? D.STYLE_PROFILES[r.primaryStyle].label : r.primaryStyle);
    var secondaryLabel = D.STYLE_PROFILES[r.secondaryStyle] ? D.STYLE_PROFILES[r.secondaryStyle].label : r.secondaryStyle;

    html += '<div class="result-style">';
    html += '<div class="style-label">FINAL OUTPUT</div>';
    html += '<div class="style-name">' + escapeHtml(primaryLabel) + '</div>';
    if (!r.isHidden) {
      html += '<div class="style-secondary">with ' + escapeHtml(secondaryLabel) + ' influence</div>';
    } else {
      html += '<div class="hidden-badge">HIDDEN ENDING</div>';
    }
    html += '</div>';

    var resultTraits = [
      { label: 'STRUCTURE', key: 'structure' },
      { label: 'MOTION', key: 'variation' },
      { label: 'IMPACT', key: 'drop' }
    ];
    html += '<div class="result-signature">';
    resultTraits.forEach(function (trait) {
      var value = STATE.choices[trait.key];
      var option = D.CHOICES[trait.key] && D.CHOICES[trait.key][value];
      html += '<div class="result-trait"><span>' + trait.label + '</span><strong>' + escapeHtml(option ? option.label : value) + '</strong></div>';
    });
    html += '</div>';

    // 观众反应
    html += '<div class="result-reaction">';
    html += '<div class="reaction-label">CROWD READOUT</div>';
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
        svg += '<polygon points="' + gp.join(' ') + '" fill="none" stroke="#4b2415" stroke-width="1"/>';
    }
    // 轴线
    for (var ai = 0; ai < n; ai++) {
      var aa = (Math.PI * 2 * ai / n) - Math.PI / 2;
      svg += '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + Math.cos(aa) * maxR).toFixed(1) + '" y2="' + (cy + Math.sin(aa) * maxR).toFixed(1) + '" stroke="#4b2415" stroke-width="1"/>';
    }
    // 理想轮廓
    if (idealPoints.length > 0) {
      svg += '<polygon points="' + idealPoints.join(' ') + '" fill="none" stroke="#D72F19" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.85"/>';
    }
    // 用户 DNA
    svg += '<polygon points="' + points.join(' ') + '" fill="rgba(255,206,0,0.14)" stroke="#FFCE00" stroke-width="2"/>';
    // 数据点
    for (var pi = 0; pi < n; pi++) {
      var p = points[pi].split(',');
      svg += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3" fill="#FFCE00"/>';
    }
    // 标签
    for (var li = 0; li < n; li++) {
      var la = (Math.PI * 2 * li / n) - Math.PI / 2;
      var lr = maxR + 18;
      var lx = cx + Math.cos(la) * lr;
      var ly = cy + Math.sin(la) * lr;
      svg += '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="#BFA98B">' + DNA_LABELS[DNA_AXES[li]] + '</text>';
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
        if (STATE.phase === 'intro') {
          startExperience();
          e.preventDefault();
          return;
        }
        var nextBtn = dom.sections[STATE.phase] && dom.sections[STATE.phase].querySelector('[data-next]');
        if (nextBtn && !nextBtn.disabled) { goNext(); e.preventDefault(); }
        return;
      }

      // 数字键 = 选择选项
      if (STATE.phase !== 'intro' && STATE.phase !== 'result') {
        var num = parseInt(key, 10);
        if (num >= 1 && num <= 4) {
          var phaseMap = {
            soundWorld: 'soundWorld',
            bassCore: 'bassPersonality',
            rhythm: 'rhythm'
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

  function startExperience() {
    if (STATE.phase !== 'intro') return;
    AE.start(STATE);
    goToPhase('soundWorld');
  }

  function setupNavButtons() {
    // 通用 next/back
    document.querySelectorAll('[data-next]').forEach(function (btn) {
      btn.addEventListener('click', goNext);
    });
    document.querySelectorAll('[data-back]').forEach(function (btn) {
      btn.addEventListener('click', goBack);
    });

    // Intro: click anywhere except the mute control.
    if (dom.app) {
      dom.app.addEventListener('click', function (event) {
        if (STATE.phase !== 'intro') return;
        if (event.target.closest && event.target.closest('#muteBtn')) return;
        startExperience();
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
        STATE.result = null;
        // 恢复 Loop
        AE.start(STATE);
        showWorkbench();
        if (playSongBtn) playSongBtn.style.display = '';
        if (stopSongBtn) stopSongBtn.style.display = 'none';
        goToPhase('bassForge');
      });
    }
  }

  // ── Intro pointer glitch ───────────────────────────

  function setupIntroGlitch() {
    var canvas = dom.introCanvas;
    var intro = dom.sections.intro;
    if (!canvas || !intro) return;
    var context = canvas.getContext('2d');
    var pendingBurst = null;
    var drawRaf = null;
    var clearTimer = null;
    var lastSpawn = 0;
    var canvasCssWidth = 0;
    var canvasCssHeight = 0;
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function resizeIntroCanvas() {
      var rect = intro.getBoundingClientRect();
      var ratio = Math.min(3, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      canvasCssWidth = rect.width;
      canvasCssHeight = rect.height;
    }

    function seeded(seed) {
      var value = seed || 1;
      return function () {
        value = (value * 1664525 + 1013904223) >>> 0;
        return value / 4294967296;
      };
    }

    function spawn(event) {
      if (reduced || STATE.phase !== 'intro') return;
      var now = performance.now();
      var rect = intro.getBoundingClientRect();
      if (Math.abs(rect.width - canvasCssWidth) > 1 || Math.abs(rect.height - canvasCssHeight) > 1) {
        resizeIntroCanvas();
        rect = intro.getBoundingClientRect();
      }
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
      if (now - lastSpawn < 170) return;
      lastSpawn = now;
      var speed = Math.abs(event.movementX || 0) + Math.abs(event.movementY || 0);
      pendingBurst = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        seed: ((event.clientX * 73856093) ^ (event.clientY * 19349663) ^ Math.floor(now)) >>> 0,
        width: 84 + Math.min(230, speed * 5.5),
        amp: 7 + Math.min(30, speed * 0.9)
      };
      if (!drawRaf) drawRaf = requestAnimationFrame(drawIntroGlitch);
    }

    function drawIntroGlitch() {
      drawRaf = null;
      if (!pendingBurst) return;
      var rect = intro.getBoundingClientRect();
      var burst = pendingBurst;
      pendingBurst = null;
      context.clearRect(0, 0, rect.width, rect.height);
      context.save();
      context.globalCompositeOperation = 'multiply';
      context.lineCap = 'butt';
      context.lineJoin = 'miter';

      var random = seeded(burst.seed);
      var left = burst.x - burst.width / 2;
      var colors = ['rgba(77,0,14,0.72)', 'rgba(116,0,22,0.48)', 'rgba(35,0,8,0.34)'];
      for (var layer = 0; layer < 3; layer++) {
        var segments = 34 + layer * 8;
        var layerY = burst.y + (layer - 1) * 4;
        context.strokeStyle = colors[layer];
        context.lineWidth = 0.85 + layer * 0.7;
        context.setLineDash(layer === 2 ? [5, 3] : []);
        context.beginPath();
        for (var i = 0; i <= segments; i++) {
          var px = left + i / segments * burst.width;
          var tooth = (i % 2 ? -1 : 1) * burst.amp * (0.18 + random() * 0.82);
          var py = Math.round((layerY + tooth + (random() - 0.5) * 3.5) * 2) / 2;
          if (!i) context.moveTo(px, py); else context.lineTo(px, py);
        }
        context.stroke();
      }
      context.setLineDash([]);

      for (var slice = 0; slice < 13; slice++) {
        var sw = 3 + random() * Math.min(46, burst.width * 0.18);
        var sx = left + random() * Math.max(1, burst.width - sw);
        var sy = burst.y + (random() - 0.5) * burst.amp * 2.4;
        context.fillStyle = slice % 3 === 0 ? 'rgba(44,0,9,0.48)' : 'rgba(104,0,20,0.28)';
        context.fillRect(Math.round(sx), Math.round(sy), Math.max(1, Math.round(sw)), 1 + Math.floor(random() * 3));
      }
      context.fillStyle = 'rgba(72,0,15,0.3)';
      for (var toothIndex = 0; toothIndex < 9; toothIndex++) {
        var tx = left + random() * burst.width;
        var th = 3 + random() * burst.amp * 0.9;
        context.fillRect(Math.round(tx), Math.round(burst.y - th / 2), 1, Math.round(th));
      }
      context.restore();

      if (clearTimer) clearTimeout(clearTimer);
      clearTimer = setTimeout(function () {
        var currentRect = intro.getBoundingClientRect();
        context.clearRect(0, 0, currentRect.width, currentRect.height);
        clearTimer = null;
      }, 120);
    }

    document.addEventListener('pointermove', spawn, { passive: true });
    document.addEventListener('pointerdown', spawn, { passive: true });
    window.addEventListener('resize', resizeIntroCanvas);
    resizeIntroCanvas();
    requestAnimationFrame(resizeIntroCanvas);
    setTimeout(resizeIntroCanvas, 80);
  }

  // ── 初始化 ────────────────────────────────────────

  function init() {
    cacheDom();
    setupMacroListeners();
    setupForgeActions();
    setupDensityListeners();
    setupNavButtons();
    setupKeyboard();
    setupWorkbenchListeners();
    setupIntroGlitch();

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

    goToPhase('intro');
  }

  // DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
