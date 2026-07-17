/**
 * DROP//DESTINY — style-engine.js
 * 纯函数引擎：DNA 重算、混合风格评分、Fusion 判定、枚举测试。
 * 不读取 DOM，不创建音频。通过 window.StyleEngine 暴露。
 */
(function (global) {
  'use strict';

  var D = global.DropDestinyData;
  var INITIAL_DNA = D.INITIAL_DNA;
  var DNA_AXES = D.DNA_AXES;
  var CHOICES = D.CHOICES;
  var BASS_PRESETS = D.BASS_PRESETS;
  var MACRO_DNA_RULES = D.MACRO_DNA_RULES;
  var STYLE_PROFILES = D.STYLE_PROFILES;
  var STYLE_ANCHORS = D.STYLE_ANCHORS;
  var PERF_PAD_ANCHORS = D.PERFORMANCE_PAD_ANCHORS;
  var NEUTRAL_PATTERN = D.NEUTRAL_PATTERN;

  var STYLE_IDS = Object.keys(STYLE_PROFILES);

  // ── 工具函数 ──────────────────────────────────────

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function applyMods(dna, mods) {
    if (!mods) return;
    for (var key in mods) {
      if (dna.hasOwnProperty(key)) {
        dna[key] += mods[key];
      }
    }
  }

  function clampDna(dna) {
    var out = {};
    for (var i = 0; i < DNA_AXES.length; i++) {
      out[DNA_AXES[i]] = clamp(dna[DNA_AXES[i]], 0, 100);
    }
    return out;
  }

  // ── 演奏特征提取 ──────────────────────────────────

  function computePerformanceFeatures(events) {
    if (!events || events.length === 0) {
      return { density: 0, uniquePadCount: 0, repeatRatio: 0.5,
               variationRatio: 0.5, padRatios: { D: 0, F: 0, J: 0, K: 0 } };
    }
    var total = events.length;
    var counts = { D: 0, F: 0, J: 0, K: 0 };
    for (var i = 0; i < total; i++) {
      var pad = events[i].pad;
      if (counts.hasOwnProperty(pad)) counts[pad]++;
    }
    var ratios = { D: counts.D / total, F: counts.F / total,
                   J: counts.J / total, K: counts.K / total };
    var unique = 0;
    for (var p in counts) { if (counts[p] > 0) unique++; }
    var consecSame = 0;
    for (var j = 1; j < total; j++) {
      if (events[j].pad === events[j - 1].pad) consecSame++;
    }
    var repRatio = total > 1 ? consecSame / (total - 1) : 0.5;
    return {
      density: total / 8,
      uniquePadCount: unique,
      repeatRatio: repRatio,
      variationRatio: unique / 4,
      padRatios: ratios
    };
  }

  // ── 演奏 DNA 修正（每轴 -10..+10）──────────────────

  function computePerformanceDna(events) {
    var mods = { rhythm: 0, aggression: 0, harmony: 0, movement: 0, space: 0, surprise: 0 };
    var f = computePerformanceFeatures(events);
    if (f.density === 0) return mods;

    var r = f.repeatRatio;
    var v = f.variationRatio;
    var pr = f.padRatios;

    mods.rhythm    = (r - 0.30) * 15;
    mods.surprise  = (v - 0.60) * 15 + (pr.J - 0.25) * 20;
    mods.movement  = (v - 0.60) * 12 + (pr.F - 0.25) * 15;
    mods.aggression = (pr.F - 0.25) * 20;
    mods.harmony   = (pr.K - 0.25) * 20;
    mods.space     = (pr.K - 0.25) * 16;

    for (var key in mods) {
      mods[key] = clamp(mods[key], -10, 10);
    }
    return mods;
  }

  // ── 演奏锚点 ──────────────────────────────────────

  function computePerformanceAnchors(events) {
    var out = {};
    if (!events || events.length === 0) return out;
    var f = computePerformanceFeatures(events);
    var pr = f.padRatios;
    for (var pad in PERF_PAD_ANCHORS) {
      var ratio = pr[pad] || 0;
      if (ratio > 0.25) {
        var padA = PERF_PAD_ANCHORS[pad];
        for (var style in padA) {
          out[style] = (out[style] || 0) + (ratio - 0.25) * padA[style];
        }
      }
    }
    return out;
  }

  // ── 锚点归一化：程序化计算每个风格的理论最大锚点分 ──

  function computeMaxCardAnchor(styleId) {
    var max = 0;
    for (var cat in STYLE_ANCHORS) {
      var catMax = 0;
      var options = STYLE_ANCHORS[cat];
      for (var opt in options) {
        var s = options[opt][styleId] || 0;
        if (s > catMax) catMax = s;
      }
      max += catMax;
    }
    return max;
  }

  function computeMaxPerfAnchor(styleId) {
    var max = 0;
    for (var pad in PERF_PAD_ANCHORS) {
      var w = PERF_PAD_ANCHORS[pad][styleId] || 0;
      var raw = 0.75 * w; // (1.0 - 0.25) * w
      if (raw > max) max = raw;
    }
    return max;
  }

  // 理论最大锚点分 = 最大卡片锚点分。
  // 演奏锚点作为额外加分（上限为卡片锚点的 20%），可使 anchorSimilarity 超过 100，
  // 最终钳制在 100。这样完美匹配卡片选择即可达到 100% 锚点相似度。
  var MAX_ANCHORS = {};
  (function () {
    for (var i = 0; i < STYLE_IDS.length; i++) {
      MAX_ANCHORS[STYLE_IDS[i]] = computeMaxCardAnchor(STYLE_IDS[i]);
    }
  })();

  // ── computeDna：从 INITIAL_DNA 完整重算 ─────────────

  function computeDna(state) {
    var dna = {};
    for (var i = 0; i < DNA_AXES.length; i++) {
      dna[DNA_AXES[i]] = INITIAL_DNA[DNA_AXES[i]];
    }

    var c = state.choices;

    // Stage 1: Sound World
    if (c.soundWorld && CHOICES.soundWorld[c.soundWorld]) {
      applyMods(dna, CHOICES.soundWorld[c.soundWorld].dna);
    }

    // Stage 2: Bass Personality + Macro adjustments
    if (c.bassPersonality && CHOICES.bassPersonality[c.bassPersonality]) {
      applyMods(dna, CHOICES.bassPersonality[c.bassPersonality].dna);
      var preset = BASS_PRESETS[c.bassPersonality];
      if (preset && state.bassMacros) {
        var macros = ['body', 'growl', 'wobble', 'space'];
        for (var mi = 0; mi < macros.length; mi++) {
          var m = macros[mi];
          var n = (state.bassMacros[m] - preset[m]) / 50;
          var rules = MACRO_DNA_RULES[m];
          if (rules) {
            for (var axis in rules) {
              dna[axis] += rules[axis] * n;
            }
          }
        }
      }
    }

    // Stage 3: Groove (rhythm + density)
    if (c.rhythm && CHOICES.rhythm[c.rhythm]) {
      applyMods(dna, CHOICES.rhythm[c.rhythm].dna);
    }
    if (state.groove && state.groove.density != null &&
        CHOICES.density[state.groove.density]) {
      applyMods(dna, CHOICES.density[state.groove.density].dna);
    }

    // Stage 4: Arrangement (structure + variation)
    if (c.structure && CHOICES.structure[c.structure]) {
      applyMods(dna, CHOICES.structure[c.structure].dna);
    }
    if (c.variation && CHOICES.variation[c.variation]) {
      applyMods(dna, CHOICES.variation[c.variation].dna);
    }

    // Stage 5: Drop
    if (c.drop && CHOICES.drop[c.drop]) {
      applyMods(dna, CHOICES.drop[c.drop].dna);
    }

    // Performance DNA
    if (state.performance && state.performance.events &&
        state.performance.events.length > 0) {
      applyMods(dna, computePerformanceDna(state.performance.events));
    }

    return clampDna(dna);
  }

  // ── DNA 相似度 ────────────────────────────────────

  function computeDnaSimilarity(dna, styleId) {
    var ideal = STYLE_PROFILES[styleId].dna;
    var dist = 0;
    for (var i = 0; i < DNA_AXES.length; i++) {
      dist += Math.abs(dna[DNA_AXES[i]] - ideal[DNA_AXES[i]]);
    }
    return Math.max(0, 100 - dist / 3.6);
  }

  // ── 卡片锚点分 ────────────────────────────────────

  function computeCardAnchor(state, styleId) {
    var c = state.choices;
    var total = 0;
    var cats = ['soundWorld', 'bassPersonality', 'rhythm', 'structure', 'variation', 'drop'];
    for (var i = 0; i < cats.length; i++) {
      var choice = c[cats[i]];
      if (choice && STYLE_ANCHORS[cats[i]] && STYLE_ANCHORS[cats[i]][choice]) {
        total += STYLE_ANCHORS[cats[i]][choice][styleId] || 0;
      }
    }
    return total;
  }

  // ── 锚点相似度（归一化 0–100）──────────────────────

  function computeAnchorSimilarity(state, styleId) {
    var cardAnchor = computeCardAnchor(state, styleId);
    var perfAnchor = 0;
    if (state.performance && state.performance.events &&
        state.performance.events.length > 0) {
      var raw = computePerformanceAnchors(state.performance.events);
      perfAnchor = raw[styleId] || 0;
      // 演奏锚点不得超过卡片锚点的 20%
      perfAnchor = Math.min(perfAnchor, cardAnchor * 0.2);
    }
    var total = cardAnchor + perfAnchor;
    return Math.min(100, (total / MAX_ANCHORS[styleId]) * 100);
  }

  // ── Bass-driven song choices ──────────────────────
  // Arrangement / Drop are no longer separate UI stages. Their musical intent is
  // derived from the user's real synth settings so Bass Forge remains the focus.
  function deriveBassDrivenChoices(state) {
    var c = (state && state.choices) || {};
    var s = (state && state.synthParams) || {};
    var personality = c.bassPersonality || 'wobbly';
    var rhythm = c.rhythm || 'halfTime';
    var drive = Number(s.drive == null ? 50 : s.drive);
    var fm = Number(s.fm == null ? 50 : s.fm);
    var depth = Number(s.depth == null ? 50 : s.depth);
    var space = Number(s.space == null ? 50 : s.space);
    var detune = Number(s.detune == null ? 12 : s.detune);
    var cutoff = Number(s.cutoff == null ? 1400 : s.cutoff);

    var structure;
    if (personality === 'melodic' || (space >= 68 && drive < 74)) structure = 'melodicNarrative';
    else if (rhythm === 'fourOnFloor' || personality === 'mechanical') structure = 'minimalTech';
    else if (drive >= 76 || cutoff >= 3600) structure = 'classicDrop';
    else structure = 'epicJourney';

    var variation;
    if (personality === 'melodic' || (space >= 65 && detune >= 16)) variation = 'lift';
    else if (drive >= 66 || fm >= 64 || depth >= 72) variation = 'mutate';
    else variation = 'repeat';

    var drop;
    if (drive >= 70 || (fm >= 75 && cutoff >= 2200)) drop = 'overload';
    else if (drive <= 34 || (space >= 76 && personality === 'melodic')) drop = 'gentle';
    else drop = 'standard';

    return { structure: structure, variation: variation, drop: drop };
  }

  // ── evaluate：完整风格评分 ─────────────────────────

  function evaluate(state) {
    var dna = computeDna(state);
    var dnaSims = {};
    var anchorSims = {};
    var finalScores = {};

    for (var i = 0; i < STYLE_IDS.length; i++) {
      var sid = STYLE_IDS[i];
      dnaSims[sid] = computeDnaSimilarity(dna, sid);
      anchorSims[sid] = computeAnchorSimilarity(state, sid);
      finalScores[sid] = 0.45 * dnaSims[sid] + 0.55 * anchorSims[sid];
    }

    var sorted = STYLE_IDS.slice().sort(function (a, b) {
      return finalScores[b] - finalScores[a];
    });

    var primary = sorted[0];
    var secondary = sorted[1];
    var isHidden = false;

    // ── Destiny Fusion 判定（spec 4.5）──
    var s1 = finalScores[primary];
    var s2 = finalScores[secondary];
    var a1 = anchorSims[primary];
    var a2 = anchorSims[secondary];

    var dnaVals = DNA_AXES.map(function (a) { return dna[a]; });
    var dnaMin = Math.min.apply(null, dnaVals);
    var dnaMax = Math.max.apply(null, dnaVals);
    var allIn4090 = dnaVals.every(function (v) { return v >= 40 && v <= 90; });
    var dnaSpread = dnaMax - dnaMin;
    var perfDone = state.performance && state.performance.completed;

    if (s1 >= 55 && s2 >= 52 &&
        (s1 - s2) <= 4 &&
        allIn4090 && dnaSpread <= 40 &&
        a1 >= 40 && a2 >= 40 &&
        perfDone) {
      isHidden = true;
    }

    // 确定性反应文案选择
    var reactionStyle = isHidden ? 'destinyFusion' : primary;
    var pool = D.REACTIONS[reactionStyle] || ['未知风格。'];
    var hash = 0;
    var ch = state.choices;
    for (var k in ch) {
      if (ch[k]) {
        for (var ci = 0; ci < ch[k].length; ci++) {
          hash = (hash * 31 + ch[k].charCodeAt(ci)) % 100000;
        }
      }
    }
    var reaction = pool[hash % pool.length];

    return {
      dna: dna,
      primaryStyle: isHidden ? 'destinyFusion' : primary,
      secondaryStyle: secondary,
      isHidden: isHidden,
      dnaSimilarities: dnaSims,
      anchorSimilarities: anchorSims,
      finalScores: finalScores,
      audienceReaction: reaction
    };
  }

  // ── enumerateCardPaths：枚举 2304 条卡片路径 ────────

  function enumerateCardPaths() {
    var sw = Object.keys(CHOICES.soundWorld);
    var bp = Object.keys(CHOICES.bassPersonality);
    var rh = Object.keys(CHOICES.rhythm);
    var st = Object.keys(CHOICES.structure);
    var va = Object.keys(CHOICES.variation);
    var dr = Object.keys(CHOICES.drop);

    var paths = [];
    for (var a = 0; a < sw.length; a++)
      for (var b = 0; b < bp.length; b++)
        for (var c = 0; c < rh.length; c++)
          for (var d = 0; d < st.length; d++)
            for (var e = 0; e < va.length; e++)
              for (var f = 0; f < dr.length; f++)
                paths.push({
                  soundWorld: sw[a],
                  bassPersonality: bp[b],
                  rhythm: rh[c],
                  structure: st[d],
                  variation: va[e],
                  drop: dr[f]
                });
    return paths;
  }

  // ── 暴露 ──────────────────────────────────────────

  global.StyleEngine = {
    computeDna: computeDna,
    evaluate: evaluate,
    enumerateCardPaths: enumerateCardPaths,
    computePerformanceFeatures: computePerformanceFeatures,
    computePerformanceDna: computePerformanceDna,
    computePerformanceAnchors: computePerformanceAnchors,
    computeMaxCardAnchor: computeMaxCardAnchor,
    computeMaxPerfAnchor: computeMaxPerfAnchor,
    deriveBassDrivenChoices: deriveBassDrivenChoices,
    MAX_ANCHORS: MAX_ANCHORS,
    STYLE_IDS: STYLE_IDS
  };

})(typeof window !== 'undefined' ? window : global);
