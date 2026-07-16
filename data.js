/**
 * DROP//DESTINY — data.js
 * 所有选择、DNA 修正、Bass 预设、风格轮廓、风格锚点、观众反应文案。
 * 纯数据文件，不包含逻辑函数。通过 window.DropDestinyData 暴露。
 */
(function (global) {
  'use strict';

  var INITIAL_DNA = Object.freeze({
    rhythm: 50,
    aggression: 50,
    harmony: 50,
    movement: 50,
    space: 50,
    surprise: 50
  });

  var DNA_AXES = ['rhythm', 'aggression', 'harmony', 'movement', 'space', 'surprise'];

  // ── 各阶段选择及 DNA 修正 ──────────────────────────

  var CHOICES = {
    soundWorld: {
      abyss: {
        label: '深渊', description: '极低频嗡鸣，大空间混响，黑暗压迫',
        dna: { space: 20, harmony: -10, surprise: 5 }
      },
      neonCity: {
        label: '霓虹城', description: '高频闪烁，电子脉冲，能量密集',
        dna: { movement: 15, rhythm: 10, space: -5 }
      },
      organicForest: {
        label: '有机森林', description: '温暖木质质感，自然泛音，柔和',
        dna: { harmony: 20, space: 10, aggression: -10 }
      },
      cosmicVoid: {
        label: '宇宙虚空', description: '无限延展的 ambient pad，空灵神秘',
        dna: { space: 25, harmony: 10, movement: -10 }
      }
    },

    bassPersonality: {
      brutal: {
        label: '残暴', description: '失真锯齿，嘶吼式 growl bass',
        dna: { aggression: 30, rhythm: 10, harmony: -20 }
      },
      wobbly: {
        label: '摇摆', description: 'LFO 调制 wobble，弹跳有律动',
        dna: { movement: 25, rhythm: 10, aggression: 5 }
      },
      melodic: {
        label: '旋律', description: '调音 bass，有音高走向，可哼唱',
        dna: { harmony: 30, movement: 10, aggression: -15 }
      },
      mechanical: {
        label: '机械', description: '精准量化，金属质感，冰冷节拍',
        dna: { rhythm: 20, aggression: 10, movement: 5, harmony: -10 }
      }
    },

    rhythm: {
      halfTime: {
        label: '半拍', description: '140–150 BPM 制作，听感约 70–75 BPM',
        dna: { rhythm: 15, movement: -5, space: 10 }
      },
      fourOnFloor: {
        label: '四四拍', description: '120–128 BPM，舞池驱动',
        dna: { rhythm: 25, movement: 15, space: -10 }
      },
      syncopated: {
        label: '切分', description: '140–150 BPM，反拍 emphasis，弹性',
        dna: { rhythm: 20, movement: 20, surprise: 10 }
      },
      breakbeat: {
        label: '碎拍', description: '160–175 BPM，复杂打击，混乱能量',
        dna: { rhythm: 15, movement: 25, surprise: 20, aggression: 10 }
      }
    },

    structure: {
      classicDrop: {
        label: '经典 Drop', description: 'Intro → Build → Drop',
        dna: { surprise: 5, space: 5 }
      },
      melodicNarrative: {
        label: '旋律叙事', description: 'Intro → Melody → Build → Drop',
        dna: { harmony: 15, space: 10 }
      },
      minimalTech: {
        label: '极简科技', description: 'Loop → Variation → Drop',
        dna: { rhythm: 15, movement: 10, space: -5 }
      },
      epicJourney: {
        label: '史诗旅程', description: 'Cinematic → Build → Drop',
        dna: { surprise: 20, movement: 15, space: 15 }
      }
    },

    variation: {
      repeat: {
        label: 'Repeat', description: '强化重复与催眠感，倾向 Riddim / Bass House',
        dna: { rhythm: 10, surprise: -8, movement: -5 }
      },
      mutate: {
        label: 'Mutate', description: '更换 Bass 变奏或鼓组 Fill，倾向 Brostep / Hybrid Trap',
        dna: { movement: 10, surprise: 12, aggression: 5 }
      },
      lift: {
        label: 'Lift', description: '加入和弦、旋律或升调感，倾向 Melodic Dubstep',
        dna: { harmony: 12, space: 8, aggression: -4 }
      }
    },

    drop: {
      gentle: {
        label: '轻触', description: '克制的 sub drop，留白',
        dna: { harmony: 10, space: 10, aggression: -10 }
      },
      standard: {
        label: '标准', description: '全频段释放，平衡冲击',
        dna: { rhythm: 10, movement: 10 }
      },
      overload: {
        label: '过载', description: '极限饱和，最大化能量',
        dna: { aggression: 20, surprise: 15, movement: 10 }
      }
    },

    density: {
      0: { label: 'Sparse',   dna: { movement: -8, space: 8 } },
      1: { label: 'Balanced', dna: {} },
      2: { label: 'Busy',     dna: { movement: 12, surprise: 6, aggression: 4 } }
    }
  };

  // ── Bass 预设默认宏观参数 ──────────────────────────

  var BASS_PRESETS = {
    brutal:     { body: 75, growl: 85, wobble: 60, space: 25 },
    wobbly:     { body: 60, growl: 55, wobble: 85, space: 40 },
    melodic:    { body: 50, growl: 30, wobble: 55, space: 70 },
    mechanical: { body: 65, growl: 70, wobble: 75, space: 30 }
  };

  // ── Bass Forge 真实合成器预设 ───────────────────────

  var SYNTH_PRESETS = {
    brutal: {
      waveform: 'distorted', oscB: 'square', oscMix: 46, detune: 8,
      filterType: 'lowpass', filterEnv: 82,
      sub: 78, fm: 82, cutoff: 920, resonance: 12.5,
      drive: 90, attack: 3, release: 68,
      rate: 3, depth: 68, lfoShape: 'sawtooth', lfoTarget: 'filter', space: 22
    },
    wobbly: {
      waveform: 'granite', oscB: 'sawtooth', oscMix: 55, detune: 17,
      filterType: 'bandpass', filterEnv: 58,
      sub: 64, fm: 58, cutoff: 1450, resonance: 10,
      drive: 62, attack: 7, release: 135,
      rate: 2, depth: 92, lfoShape: 'sine', lfoTarget: 'filter', space: 38
    },
    melodic: {
      waveform: 'vocal', oscB: 'triangle', oscMix: 34, detune: 22,
      filterType: 'lowpass', filterEnv: 44,
      sub: 52, fm: 28, cutoff: 3100, resonance: 4.5,
      drive: 28, attack: 24, release: 270,
      rate: 1, depth: 42, lfoShape: 'triangle', lfoTarget: 'filter', space: 76
    },
    mechanical: {
      waveform: 'bitCore', oscB: 'square', oscMix: 58, detune: 5,
      filterType: 'notch', filterEnv: 90,
      sub: 66, fm: 74, cutoff: 1250, resonance: 15,
      drive: 76, attack: 2, release: 48,
      rate: 3, depth: 78, lfoShape: 'square', lfoTarget: 'fm', space: 26
    }
  };

  // n = (currentValue - presetDefault) / 50，然后乘以下列系数
  var MACRO_DNA_RULES = {
    body:   { aggression: 12, rhythm: 5, space: -5 },
    growl:  { aggression: 18, surprise: 6, harmony: -8 },
    wobble: { movement: 18, rhythm: 8 },
    space:  { space: 20, harmony: 6, aggression: -5 }
  };

  // ── Style Profiles（理想 DNA 轮廓）──────────────────

  var STYLE_PROFILES = {
    riddimDubstep: {
      label: 'Riddim Dubstep',
      description: '极简、重复、重压——用最少的元素砸最重的拳',
      dna: { rhythm: 82, aggression: 65, harmony: 30, movement: 45, space: 45, surprise: 40 }
    },
    brostep: {
      label: 'Brostep',
      description: '狂暴、多变、撕裂——一场肾上腺素过山车',
      dna: { rhythm: 60, aggression: 85, harmony: 30, movement: 70, space: 40, surprise: 50 }
    },
    hybridTrap: {
      label: 'Hybrid Trap',
      description: '实验、跨界、意外——陷阱鼓组遇上奇形 Bass',
      dna: { rhythm: 65, aggression: 70, harmony: 40, movement: 85, space: 45, surprise: 82 }
    },
    bassHouse: {
      label: 'Bass House',
      description: '律动、舞池、弹跳——让整个房间跟着抖',
      dna: { rhythm: 85, aggression: 55, harmony: 50, movement: 65, space: 25, surprise: 35 }
    },
    melodicDubstep: {
      label: 'Melodic Dubstep',
      description: '情感、旋律、辽阔——眼眶发热的那一刻',
      dna: { rhythm: 55, aggression: 30, harmony: 85, movement: 60, space: 70, surprise: 45 }
    }
  };

  // ── Style Anchors（风格锚点）────────────────────────

  var STYLE_ANCHORS = {
    soundWorld: {
      abyss:         { riddimDubstep: 2, brostep: 2 },
      neonCity:      { bassHouse: 3, brostep: 1 },
      organicForest: { melodicDubstep: 4 },
      cosmicVoid:    { melodicDubstep: 2, hybridTrap: 1 }
    },
    bassPersonality: {
      brutal:        { brostep: 5, hybridTrap: 1 },
      wobbly:        { riddimDubstep: 5, bassHouse: 2, hybridTrap: 1 },
      melodic:       { melodicDubstep: 5 },
      mechanical:    { riddimDubstep: 5, bassHouse: 4 }
    },
    rhythm: {
      halfTime:      { riddimDubstep: 5, brostep: 2, hybridTrap: 2, melodicDubstep: 2 },
      fourOnFloor:   { bassHouse: 6 },
      syncopated:    { riddimDubstep: 1, hybridTrap: 1, brostep: 2 },
      breakbeat:     { hybridTrap: 5, brostep: 2 }
    },
    structure: {
      classicDrop:       { brostep: 3, bassHouse: 1 },
      melodicNarrative:  { melodicDubstep: 5 },
      minimalTech:       { riddimDubstep: 6, bassHouse: 3 },
      epicJourney:       { brostep: 2, hybridTrap: 3, melodicDubstep: 2 }
    },
    variation: {
      repeat:        { riddimDubstep: 5, bassHouse: 2 },
      mutate:        { brostep: 2, hybridTrap: 4 },
      lift:          { melodicDubstep: 3 }
    },
    drop: {
      gentle:       { melodicDubstep: 4 },
      standard:     { riddimDubstep: 2, bassHouse: 1, hybridTrap: 1, melodicDubstep: 1 },
      overload:     { brostep: 5, hybridTrap: 1 }
    }
  };

  // ── Performance Pad 锚点（每个 Pad 对各风格的原始权重）──
  // 使用时取 (padRatio - 0.25) * weight，只有 pad 占比超过 25% 才贡献

  var PERFORMANCE_PAD_ANCHORS = {
    D: { riddimDubstep: 8, bassHouse: 6 },
    F: { brostep: 8 },
    J: { hybridTrap: 8 },
    K: { melodicDubstep: 8 }
  };

  // ── 观众反应文案 ──────────────────────────────────

  var REACTIONS = {
    riddimDubstep: [
      '人群开始集体点头，低频把胸腔按在地上——这就是 Riddim 的重量。',
      '极简的重复击穿了舞池，每个人都陷入了同一频率的催眠。'
    ],
    brostep: [
      'Drop 砸下来的瞬间，前排直接炸开——这就是 Brostep 的暴力美学。',
      '扭曲的 Bass 像电钻一样撕开空气，有人捂耳有人尖叫。'
    ],
    hybridTrap: [
      '没人预料到那个 Trap Fill——实验性的跨界让全场措手不及。',
      '奇形怪状的 Bass 配上陷阱鼓组，舞池里出现了新的律动。'
    ],
    bassHouse: [
      '四四拍一响，整个房间开始抖动——Bass House 的舞池魔法生效了。',
      '弹跳的律动让所有人都动了起来，这就是舞池音乐的力量。'
    ],
    melodicDubstep: [
      '旋律响起的瞬间，空气变柔了——有人闭眼，有人眼眶发热。',
      '辽阔的和声铺开后，Drop 的情感冲击让时间慢了一拍。'
    ],
    destinyFusion: [
      '观众先是困惑，然后爆发出欢呼——他们听到了从未听过的东西。',
      '你打破了所有分类，创造了一种只属于你的声音。这就是 Destiny Fusion。'
    ]
  };

  // ── 枚举测试用的固定中性 Live Drop Pattern ──────────
  // 4 个 Pad 各用一次，无连续重复，density = 0.5

  var NEUTRAL_PATTERN = [
    { step: 0, pad: 'D' },
    { step: 2, pad: 'F' },
    { step: 4, pad: 'J' },
    { step: 6, pad: 'K' }
  ];

  // ── 暴露 ──────────────────────────────────────────

  global.DropDestinyData = {
    INITIAL_DNA: INITIAL_DNA,
    DNA_AXES: DNA_AXES,
    CHOICES: CHOICES,
    BASS_PRESETS: BASS_PRESETS,
    SYNTH_PRESETS: SYNTH_PRESETS,
    MACRO_DNA_RULES: MACRO_DNA_RULES,
    STYLE_PROFILES: STYLE_PROFILES,
    STYLE_ANCHORS: STYLE_ANCHORS,
    PERFORMANCE_PAD_ANCHORS: PERFORMANCE_PAD_ANCHORS,
    REACTIONS: REACTIONS,
    NEUTRAL_PATTERN: NEUTRAL_PATTERN
  };

})(typeof window !== 'undefined' ? window : global);
