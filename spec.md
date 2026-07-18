# DROP//DESTINY — 产品规格书

> 引导普通用户完成第一首可播放、可重做的 Bass Music 小作品。用户依次选择声音世界、塑造 Bass、搭建 Groove、安排歌曲结构，并亲自完成最终 Drop；每一步都必须真实改变声音和实时可视化。系统根据创作选择与最终演奏判定作品风格，可能解锁隐藏结局 Destiny Fusion。

---

## 0. 产品北极星与开发边界

### 0.1 产品北极星

用户完成后应该能够明确地说：**“这是我刚刚做出来的一小段歌。”**

因此，最终版本不能退化成“选择五张卡片后获得音乐人格测试结果”。以下三点属于产品闭环，不是后续锦上添花：

1. 每个阶段都能试听，并真实改变正在播放的音乐。
2. 最终生成一段约 20–28 秒、包含鼓组、Bass 和至少一个旋律/氛围层的可重播作品。
3. 波形或频谱必须由真实音频驱动，而不是与声音无关的装饰动画。

### 0.2 两个不同的里程碑

- **WorkBuddy Foundation**：先完成页面流程、可回退状态管理、风格判定、基础音频接口和可视化占位，使产品骨架可运行、可测试。
- **Final Submission MVP**：接入真正的 Web Audio 合成、连续音乐预览、实时 AnalyserNode 可视化和最终 Drop 演奏，形成完整作品。

不要把 WorkBuddy Foundation 误称为最终 MVP，也不要在功能尚未实现时使用 `[x]` 标记完成。

## 1. 五个创作阶段

| 阶段 | 名称 | 用户做什么 | 产出 |
|------|------|-----------|------|
| 1 | 声音世界 Sound World | 试听并选择 4 个氛围之一 | 设定 Space / Harmony / Surprise 基调和视觉场景 |
| 2 | Bass Forge | 选择 Bass 核心性格，再操作简化合成器 | 生成用户自己的 Bass 预设，影响 Aggression / Movement / Harmony |
| 3 | Groove Lab | 试听并选择节奏家族，再选择密度/Fill 倾向 | 决定 BPM、鼓组骨架和 Rhythm / Movement / Surprise |
| 4 | Arrangement | 选择结构，并对一个段落做变奏决定 | 组成可播放的 Intro / Build / Drop |
| 5 | Live Drop | 选择 Drop 强度，并用 4 个 Pad 编辑一小节 8-step Sequencer | 生成最终演奏事件，调整 DNA，进入结算与完整回放 |

每个阶段只暴露一个主要决策，避免变成专业 DAW；但“主要决策”必须包含试听或短交互，而不是只点卡片。用户可以返回上一阶段修改，DNA 和音乐必须根据当前选择**重新计算**，不得重复叠加旧选择。

全部完成后进入结算页，展示风格判定、DNA 雷达图、观众反应，并提供“播放我的作品”“返回修改”“重新创作”。

---

## 2. 各阶段选择及对音乐的影响

### 阶段 1 — 声音世界

| 选项 | 描述 | DNA 变化 |
|------|------|---------|
| 深渊 Abyss | 极低频嗡鸣，大空间混响，黑暗压迫 | Space +20, Harmony −10, Surprise +5 |
| 霓虹城 Neon City | 高频闪烁，电子脉冲，能量密集 | Movement +15, Rhythm +10, Space −5 |
| 有机森林 Organic Forest | 温暖木质质感，自然泛音，柔和 | Harmony +20, Space +10, Aggression −10 |
| 宇宙虚空 Cosmic Void | 无限延展的 ambient pad，空灵神秘 | Space +25, Harmony +10, Movement −10 |

### 阶段 2 — Bass Forge

| 选项 | 描述 | DNA 变化 |
|------|------|---------|
| 残暴 Brutal | 失真锯齿，嘶吼式 growl bass | Aggression +30, Rhythm +10, Harmony −20 |
| 摇摆 Wobbly | LFO 调制 wobble，弹跳有律动 | Movement +25, Rhythm +10, Aggression +5 |
| 旋律 Melodic | 调音 bass，有音高走向，可哼唱 | Harmony +30, Movement +10, Aggression −15 |
| 机械 Mechanical | 精准量化，金属质感，冰冷节拍 | Rhythm +20, Aggression +10, Movement +5, Harmony −10 |

选择核心性格后显示一个简化 Bass 合成器。预设只决定默认值，用户必须至少亲手调整其中一个真实参数：Wavetable、Osc B、Osc Mix、Detune、Filter Type / Envelope、Sub、FM、Cutoff、Resonance、Drive、Amp Attack / Release、同步 LFO Rate / Depth / Shape / Destination 或 Space。

| 宏观控制 | 听觉含义 | 建议底层映射 |
|----------|---------|-------------|
| Body | Sub 厚度和重量 | sub oscillator gain + low shelf |
| Growl | 中频咆哮与粗糙度 | FM amount + waveshaper + filter resonance |
| Wobble | 调制速度与运动感 | LFO rate / depth，量化到音乐节拍 |
| Space | 宽度、延迟与混响 | delay send + convolver/algorithmic reverb mix |

预设默认值：

| Bass 预设 | Body | Growl | Wobble | Space |
|-----------|-----:|------:|-------:|------:|
| Brutal | 75 | 85 | 60 | 25 |
| Wobbly | 60 | 55 | 85 | 40 |
| Melodic | 50 | 30 | 55 | 70 |
| Mechanical | 65 | 70 | 75 | 30 |

预设表中的 DNA 已经描述了“选择该性格”的影响，因此宏观旋钮只计算**相对预设默认值的用户调整量**，避免重复计分。令 `n = (currentValue - presetDefault) / 50`：

- Body：`Aggression += 12n`，`Rhythm += 5n`，`Space -= 5n`
- Growl：`Aggression += 18n`，`Surprise += 6n`，`Harmony -= 8n`
- Wobble：`Movement += 18n`，`Rhythm += 8n`
- Space：`Space += 20n`，`Harmony += 6n`，`Aggression -= 5n`

合成器旋钮应平滑更新参数，避免 zipper noise。为保持风格引擎兼容，真实参数会派生为 Body / Growl / Wobble / Space 四个 DNA 宏观值，但 UI 直接展示并操作真实合成参数。

### 阶段 3 — Groove Lab

| 选项 | 描述 | DNA 变化 |
|------|------|---------|
| 半拍 Half-time | 通常以 140–150 BPM 制作、听感约为 70–75 BPM；军鼓/拍手落在第 3 拍，形成沉重的半拍律动 | Rhythm +15, Movement −5, Space +10 |
| 四四拍 Four-on-the-floor | 120–128 BPM，舞池驱动 | Rhythm +25, Movement +15, Space −10 |
| 切分 Syncopated | 140–150 BPM，反拍 emphasis，弹性 | Rhythm +20, Movement +20, Surprise +10 |
| 碎拍 Breakbeat | 160–175 BPM，复杂打击，混乱能量 | Rhythm +15, Movement +25, Surprise +20, Aggression +10 |

选择节奏家族后，再提供一个三档密度控制。它改变 Hi-hat、Ghost Note 和 Fill 数量，但不改变核心 Kick/Snare 骨架。用户可以随时 A/B 试听：

- `Sparse`：Movement −8，Space +8。
- `Balanced`：不额外修正。
- `Busy`：Movement +12，Surprise +6，Aggression +4。

### 阶段 4 — Arrangement

| 选项 | 描述 | DNA 变化 |
|------|------|---------|
| 经典 Drop Classic Build & Drop | Intro → Build → Drop | Surprise +5, Space +5 |
| 旋律叙事 Melodic Narrative | Intro → Melody → Build → Drop | Harmony +15, Space +10 |
| 极简科技 Minimal Tech | Loop → Variation → Drop | Rhythm +15, Movement +10, Space −5 |
| 史诗旅程 Epic Journey | Cinematic → Build → Drop | Surprise +20, Movement +15, Space +15 |

为避免只是选择模板，选完结构后再做一次"Drop 后半段如何变化"的决定：

- `Repeat`：强化重复与催眠感，倾向 Riddim / Bass House。
- `Mutate`：更换 Bass 变奏或鼓组 Fill，倾向 Brostep / Hybrid Trap。
- `Lift`：加入和弦、旋律或升调感，倾向 Melodic Dubstep。

最终编排不只替换 Pattern：统一使用 i–VI–III–VII 调性框架，Bass 每个触发音独立决定音阶偏移、时值、Filter / FM / Wobble articulation 与第二 Bass（Reese、Vowel、Metallic、808 Glide、Donk）。Melodic Dubstep 由 Supersaw 扩展和弦和 Saw Lead 主导，Bass 只在重拍与句尾点缀。六种结局使用不同的 Kick / Snare 采样处理、鼓网格与合成 Hat，并加入回应旋律、Arp / Pluck / Screech、Open Hat、Hat Roll、Tom Fill、Crash 与段落 Swell。用户 Pattern 接管 Drop 后半段主 Bass 时，这些和声、配器和鼓组层仍会继续回应用户演奏。

DNA 修正分别为：

- Repeat：Rhythm +10，Surprise −8，Movement −5。
- Mutate：Movement +10，Surprise +12，Aggression +5。
- Lift：Harmony +12，Space +8，Aggression −4。

这个决定应真实影响最终回放，并作为一个小权重风格锚点。

### 阶段 5 — 最终 Drop 与现场演奏

| 选项 | 描述 | DNA 变化 |
|------|------|---------|
| 轻触 Gentle Touch | 克制的 sub drop，留白 | Harmony +10, Space +10, Aggression −10 |
| 标准 Standard Drop | 全频段释放，平衡冲击 | Rhythm +10, Movement +10 |
| 过载 Overload | 极限饱和，最大化能量 | Aggression +20, Surprise +15, Movement +10 |

选择强度后，用户使用 4 个 Pad 编辑一小节 8-step Sequencer。输入自动量化到八分音符，保证普通用户也能得到可听结果：

| Pad | 默认职责 | 对结果的影响 |
|-----|---------|-------------|
| D | 主 Bass Hit | 重复使用提高 Rhythm；稳定重复倾向 Riddim / Bass House |
| F | Growl / Bass Variation | 提高 Aggression 与 Movement；倾向 Brostep |
| J | Drum Fill / Trap Fill | 提高 Surprise 与 Movement；倾向 Hybrid Trap |
| K | Chord / Vocal Texture | 提高 Harmony 与 Space；倾向 Melodic Dubstep |

演奏事件不是“对错题”。系统分析 Pattern 的重复度、变化度、密度和使用的声音层，形成最后一组 DNA 修正：

- 先把 Pattern 转成特征：`density`、`uniquePadCount`、`repeatRatio`、`variationRatio`、各 Pad 使用占比。
- 每个 DNA 轴由 Pattern 产生的修正限制在 `−10..+10`，避免一小节 Sequencer 推翻前四阶段的整体创作。
- 重复度高：Rhythm 上升，Surprise/Movement 下降。
- 变化度和 J Pad 占比高：Surprise/Movement 上升。
- F Pad 占比高：Aggression/Movement 上升。
- K Pad 占比高：Harmony/Space 上升。

播放结束后必须能够重放该 Pattern，并把它放进最终歌曲的 Drop 后半段。

---

## 3. 六个歌曲 DNA 指标

所有指标初始值为 **50**（中性），通过五个阶段的选择累加修改，最终范围钳制在 **0–100**。

| 指标 | 含义 | 低值表现 | 高值表现 |
|------|------|---------|---------|
| **Rhythm 节奏感** | 律动驱动力和节拍稳定度 | 氛围化、无明确节拍 | 强力 groove，身体跟着动 |
| **Aggression 攻击性** | 声音的猛烈、失真和压迫程度 | 柔和、温暖、舒适 | 暴力、嘶吼、撕裂感 |
| **Harmony 和声性** | 音高组织的旋律感和和声丰富度 | 噪音化、无调性 | 有明确调性、可哼唱 |
| **Movement 运动感** | 声音变化频率和层次切换速度 | 静态、重复、催眠 | 快速变化、层次丰富 |
| **Space 空间感** | 混响深度和声场开阔度 | 干燥、紧密、贴脸 | 宽广、深邃、有呼吸 |
| **Surprise 意外性** | 不可预测性和结构创新程度 | 循规蹈矩、意料之中 | 出人意料、打破预期 |

---

## 4. 风格评分逻辑

### 4.1 五个主要风格的理想 DNA 轮廓

| 风格 | Rhythm | Aggression | Harmony | Movement | Space | Surprise |
|------|--------|-----------|---------|----------|-------|----------|
| Riddim Dubstep | 82 | 65 | 30 | 45 | 45 | 40 |
| Brostep | 60 | 85 | 30 | 70 | 40 | 50 |
| Hybrid Trap | 65 | 70 | 40 | 85 | 45 | 82 |
| Bass House | 85 | 55 | 50 | 65 | 25 | 35 |
| Melodic Dubstep | 55 | 30 | 85 | 60 | 70 | 45 |

### 4.2 为什么不能只使用 DNA 距离

初版规则对全部 `4 × 4 × 4 × 4 × 3 = 768` 条选择路径进行了枚举验证，结果为：

| 结果 | 路径数 |
|------|------:|
| Riddim Dubstep | 4 |
| Brostep | 63 |
| Hybrid Trap | 467 |
| Bass House | 29 |
| Melodic Dubstep | 157 |
| Destiny Fusion | 48 |

这说明单纯使用六维曼哈顿距离会严重偏向 Hybrid Trap，且某些高空间感路径会被错误判成 Riddim。原因是风格不只是“数值轮廓”，还存在决定性音乐语法，例如 Four-on-the-floor 几乎是 Bass House 的强锚点，Melodic Bass + Melodic Narrative 是 Melodic Dubstep 的强锚点。

因此采用 **DNA 相似度 + 风格锚点** 的混合判定。

### 4.3 DNA 相似度

保留理想轮廓用于解释歌曲气质，但只占最终得分的一部分：

```text
distance(style) = Σ |userDNA[i] - idealDNA[style][i]|
dnaSimilarity(style) = max(0, 100 - distance / 3.6)
```

### 4.4 风格锚点

每个关键选择为一个或多个风格增加原始锚点分。锚点权重必须作为数据维护，不能散落在事件处理代码中。

```javascript
const STYLE_ANCHORS = {
  soundWorld: {
    abyss:        { riddimDubstep: 2, brostep: 2 },
    neonCity:     { bassHouse: 3, brostep: 1 },
    organicForest:{ melodicDubstep: 4 },
    cosmicVoid:   { melodicDubstep: 2, hybridTrap: 1 }
  },
  bassPersonality: {
    brutal:       { brostep: 5, hybridTrap: 1 },
    wobbly:       { riddimDubstep: 5, bassHouse: 2, hybridTrap: 1 },
    melodic:      { melodicDubstep: 5 },
    mechanical:   { riddimDubstep: 5, bassHouse: 4 }
  },
  rhythm: {
    halfTime:     { riddimDubstep: 5, brostep: 2, hybridTrap: 2, melodicDubstep: 2 },
    fourOnFloor:  { bassHouse: 6 },
    syncopated:   { riddimDubstep: 1, hybridTrap: 1, brostep: 2 },
    breakbeat:    { hybridTrap: 5, brostep: 2 }
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
```

最终演奏 Pattern 也提供锚点，但总影响不得超过卡片选择锚点的 20%，避免用户随便多按一个 Pad 就完全改变结果。

将每种风格的原始锚点分除以该风格理论最大锚点分，得到 `anchorSimilarity`（0–100）。

### 4.5 最终得分与判定

```text
finalScore(style) = 0.45 × dnaSimilarity(style)
                  + 0.55 × anchorSimilarity(style)
```

1. 计算全部 5 个风格的 `finalScore`。
2. 最高分为主风格，第二名作为“副风格影响”，在结果文案中展示，例如“Melodic Dubstep with Hybrid Trap influence”。
3. **Destiny Fusion** 只有同时满足以下条件才触发：
   - 第一名得分 ≥ 55，第二名得分 ≥ 52；
   - 第一与第二名差值 ≤ 4；
   - 六个 DNA 全部位于 40–90，且最高值与最低值差 ≤ 40；
   - 第一、第二风格的锚点相似度都 ≥ 40；
   - 用户完成了 Live Drop，而不是跳过演奏。
4. 结算页展示五个 `finalScore`，并明确标出主风格与副风格。

### 4.6 可达性自动验证

实现风格引擎时必须同时写一个仅供开发使用的枚举测试函数。新规格包含 4×4×4×4×3×3 = **2304** 条“声音世界 × Bass × Groove × Structure × Variation × Drop”卡片路径；测试时使用一个固定的中性 Live Drop Pattern，输出全部路径的结果分布。验收范围：

- 每个主要风格至少占全部路径的 5%；
- 任一主要风格不得超过 45%；
- Destiny Fusion 应当稀有，占比建议 1%–8%；
- 附录中的五条标志性路径必须得到预期结果；
- 相同输入必须产生完全相同的结果。

### 4.7 风格描述速查

| 风格 | 一句话描述 |
|------|-----------|
| Riddim Dubstep | 极简、重复、重压——用最少的元素砸最重的拳 |
| Brostep | 狂暴、多变、撕裂——一场肾上腺素过山车 |
| Hybrid Trap | 实验、跨界、意外——陷阱鼓组遇上奇形 Bass |
| Bass House | 律动、舞池、弹跳——让整个房间跟着抖 |
| Melodic Dubstep | 情感、旋律、辽阔——眼眶发热的那一刻 |
| Destiny Fusion（隐藏） | 超越分类——你的本能打破了所有边界 |

---

## 5. 项目状态数据结构

`choices`、`synthParams`、Groove 参数和演奏事件是事实来源；`bassMacros`、`dna` 与 `result` 都是可重新计算的派生数据。禁止在用户每次点击时永久累加 DNA，否则返回上一步换选项会重复加分。

```javascript
const INITIAL_DNA = Object.freeze({
  rhythm: 50,
  aggression: 50,
  harmony: 50,
  movement: 50,
  space: 50,
  surprise: 50
});

const STATE = {
  // 'intro' | 'soundWorld' | 'bassForge' | 'groove' | 'arrangement' | 'liveDrop' | 'result'
  phase: 'intro',

  choices: {
    soundWorld: null,
    bassPersonality: null,
    rhythm: null,
    structure: null,
    variation: null,       // 'repeat' | 'mutate' | 'lift'
    drop: null
  },

  // 真实合成参数是 Bass Forge 的事实来源；预设只提供默认值
  synthParams: {
    waveform: 'distorted',
    filterType: 'lowpass',
    sub: 60,
    fm: 50,
    cutoff: 1400,
    resonance: 8,
    drive: 55,
    rate: 2,          // 0..4 → 1/2、1/4、1/8、1/8T、1/16
    depth: 55,
    space: 40
  },

  // 由 synthParams 派生，保留给风格评分引擎；UI 不直接编辑
  bassMacros: {
    body: 50,
    growl: 50,
    wobble: 50,
    space: 50
  },

  groove: {
    density: 1,       // 0 sparse | 1 balanced | 2 busy
    fillPreference: 1
  },

  performance: {
    events: [],       // [{ step: 0..7, pad: 'D'|'F'|'J'|'K' }]
    completed: false
  },

  // 以下均由当前 choices / synthParams / groove / performance 重新计算
  dna: { ...INITIAL_DNA },
  result: {
    primaryStyle: null,
    secondaryStyle: null,
    isHidden: false,
    dnaSimilarities: null,
    anchorSimilarities: null,
    finalScores: null,
    audienceReaction: null
  },

  ui: {
    muted: false,
    isPlaying: false,
    canGoBack: false
  }
};

// AudioContext、OscillatorNode、GainNode、AnalyserNode、定时器句柄等运行时对象
// 必须放在独立 AUDIO_RUNTIME 中，不能塞入可序列化的 STATE。
```

### 数据流

```
用户试听/选择/演奏
        ↓
只更新 choices / synthParams / groove / performance
        ↓
computeDnaFromState() 从 INITIAL_DNA 重新计算 DNA
        ↓
audioEngine.applyState() 平滑更新正在播放的声音
        ↓
render() 更新 DNA、步骤和可视化说明
        ↓
完成 Live Drop → styleEngine.evaluate() → 结算并播放完整作品
```

必须提供“返回修改”。用户返回后改变任意选择，音乐、DNA、风格结果都应确定性更新。相同状态重复计算必须得到相同结果。

---

## 6. 开发里程碑

### 6.1 WorkBuddy Foundation（下一轮目标）

- [ ] 5 阶段流程可前进、返回和重新开始。
- [ ] 选择、Bass 合成参数和演奏 Pattern 使用统一状态管理；bassMacros 只由 synthParams 派生。
- [ ] DNA 每次从当前状态重新计算，不出现返回后重复叠加。
- [ ] 混合风格判定引擎与 2304 路径枚举测试可运行。
- [ ] 结算页显示主风格、副风格、DNA 雷达图和五风格得分。
- [ ] Audio Engine 和 Visualizer 使用明确接口与临时占位实现，主应用不直接创建音频节点。
- [ ] 页面在 390px 和 1440px 下可用，支持键盘与触摸。
- [ ] 双击 `index.html` 离线运行，零外部依赖。

Foundation 可以暂时使用简单循环音和基础 Canvas 线条，但每个阶段的接口必须为后续真实音频升级预留位置。

### 6.2 Final Submission MVP（最终必须完成）

- [ ] 至少三个真实音乐层：鼓组、Bass、旋律或氛围层。
- [ ] 用户点击“开始创作”后形成连续播放的音乐预览；每阶段选择能听出差异。
- [ ] Bass Forge 提供可操作的简化合成器：Wavetable、Filter Type、Sub、FM、Cutoff、Resonance、Drive、同步 Rate、Depth 与 Space；并派生兼容评分引擎的四个宏观值。
- [ ] Groove 和 Arrangement 真实改变节奏与段落播放，而不是只改变 DNA 数字。
- [ ] Live Drop 能编辑并试听一小节 8-step Pad Pattern，并加入最终歌曲。
- [ ] 最终作品约 20–28 秒，可在结算页完整重播。
- [ ] Canvas 波形或频谱由 Web Audio `AnalyserNode` 实时驱动。
- [ ] 结算页提供主风格、副风格、歌曲 DNA、观众反应和不同结局。
- [ ] 支持返回修改、重新创作、静音和停止播放，不发生音频叠加。
- [ ] 响应式、`prefers-reduced-motion`、Chrome/Edge 离线运行全部通过。

### 6.3 Stretch Goals（时间允许再做）

- [ ] 使用 localStorage 保存作品参数和最佳作品。
- [ ] 使用 MediaRecorder 下载 WebM/Opus 录音。
- [ ] 通过 URL 编码分享无隐私的作品参数。
- [ ] 更丰富的 Canvas 粒子、舞台和 Drop 全屏冲击。
- [ ] 成就、二周目和稀有结局。
- [ ] 封面卡片生成与多语言。

---

## 7. 文件规划

### 7.1 核心文件

```
DROP_DESTINY/
├─ index.html         # 页面结构与经典 script 引入
├─ styles.css         # 布局、配色、动画、响应式、reduced-motion
├─ data.js            # 选项、DNA 修正、风格轮廓、锚点、文案
├─ style-engine.js    # DNA 重算、混合评分、Fusion 判定、枚举测试
├─ audio-engine.js    # Web Audio 播放接口；Foundation 可先用简单实现
├─ visualizer.js      # Canvas + AnalyserNode；Foundation 可先用基础波形
├─ app.js             # 状态、阶段控制、事件绑定、DOM 渲染
├─ spec.md            # 本文件
├─ README.md          # 项目说明（后续补充）
└─ screenshots/       # WorkBuddy 协作截图（后续补充）
```

虽然文件比“全部塞进 app.js”多，但职责更清楚，可以避免后续接入音频时重写整个项目。全部使用普通 `<script>`，不使用 ES Module，仍然支持 `file://`。

### 7.2 index.html 结构

```
<body>
  <div id="app">
    <header>           # 标题 + 进度指示器（5 个点）+ 静音按钮
    <main>
      <section id="intro">            # 首屏：标题、简介、开始按钮
      <section id="soundWorld">       # 阶段 1：4 个声音世界选项卡
      <section id="bassForge">         # 阶段 2：Bass 预设 + 简化合成器
      <section id="groove">            # 阶段 3：节奏家族 + 密度/Fill
      <section id="arrangement">       # 阶段 4：结构 + 一次段落变奏
      <section id="liveDrop">          # 阶段 5：Drop 强度 + 4 Pad Pattern
      <section id="result">            # 结算、完整回放、返回修改、重做
    </main>
    <footer>          # DNA 指标条（6 条，实时更新）+ 当前阶段名
  </div>
  <script src="data.js"></script>
  <script src="style-engine.js"></script>
  <script src="audio-engine.js"></script>
  <script src="visualizer.js"></script>
  <script src="app.js"></script>
</body>
```

### 7.3 styles.css 组织

```
/* 1. CSS 变量：颜色、字号、间距、动画时长 */
/* 2. 全局重置 + 基础排版 */
/* 3. 布局：header / main / footer 网格 */
/* 4. intro 首屏样式 */
/* 5. 选项卡通用样式（.option-card）+ 各阶段变体 */
/* 6. DNA 指标条样式（.dna-bar） */
/* 7. 结算页：雷达图、条形图、反应文案 */
/* 8. 动画：fadeIn、slideLeft、pulse、dropImpact */
/* 9. 响应式：@media 768px / 390px 断点 */
/* 10. prefers-reduced-motion 降级 */
```

### 7.4 JavaScript 职责与公共接口

```javascript
// data.js
// window.DropDestinyData = { CHOICES, STYLE_PROFILES, STYLE_ANCHORS, REACTIONS }

// style-engine.js（纯函数，不读取 DOM，不创建音频）
// window.StyleEngine.computeDna(state)
// window.StyleEngine.evaluate(state)
// window.StyleEngine.enumerateCardPaths()

// audio-engine.js
// window.AudioEngine.start(state)
// window.AudioEngine.applyState(state)
// window.AudioEngine.previewChoice(phase, optionId)
// window.AudioEngine.playFinalSong(state)
// window.AudioEngine.stop()
// window.AudioEngine.setMuted(muted)
// window.AudioEngine.getAnalyser()

// visualizer.js
// window.Visualizer.start(canvas, analyser)
// window.Visualizer.setTheme(soundWorld)
// window.Visualizer.setIntensity(value)
// window.Visualizer.stop()

// app.js
// 只负责 STATE、阶段切换、事件绑定、调用上述接口和渲染 DOM。
// selectOption() 只记录选择，然后调用 recomputeDerivedState()；不得直接累加 DNA。
```

### 7.5 Foundation 占位实现规则

WorkBuddy Foundation 可以暂时让 `audio-engine.js` 只播放简单的鼓、Bass 和 Pad 循环，让 `visualizer.js` 只画基础时域波形，但公共接口必须保持不变。后续升级内部实现时，`app.js` 不应需要大规模修改。

---

## 8. 验收标准

### 8.1 功能验收

| # | 标准 | 验证方法 |
|---|------|---------|
| F1 | 双击 `index.html` 可在浏览器中打开，控制台无报错 | Chrome / Edge 各测一次 |
| F2 | 首屏显示标题、简介和「开始创作」按钮，点击后进入阶段 1 | 手动点击 |
| F3 | 5 个阶段依次出现，每个主要选择都可试听或操作 | 逐阶段走完并对比声音 |
| F4 | 选择或调整任一创作参数后，DNA 与正在播放的音乐同步变化 | 观察数值并听声音变化 |
| F5 | 阶段间有过渡动画，不会突兀跳转 | 视觉确认 |
| F6 | Live Drop 可编辑一个量化 8-step Sequencer，并能立即重放 | 使用 D/F/J/K 编辑后播放 |
| F7 | 结算页显示主/副风格、DNA、五风格得分、结局，并能播放完整作品 | 完整走一条路径后回放 |
| F8 | 五个主要风格均有明确可达路径 | 运行枚举测试 + 手测附录路径 |
| F9 | Destiny Fusion 稀有但可达，不会被极端 Brostep/Hybrid 路径误触发 | 枚举测试并检查固定 Fusion 路径 |
| F10 | 「返回修改」重新计算声音/DNA；「重新创作」彻底重置状态 | 修改旧选择并确认没有重复加分 |
| F11 | 至少存在鼓组、Bass、氛围/旋律层和 4 个 Drop Pad 声音 | 分层试听并完成最终作品 |
| F12 | 静音按钮可关闭声音，不影响视觉和逻辑 | 切换静音后操作 |
| F13 | 重新开始、返回修改、多次播放后不会叠加旧的定时器或音频节点 | 连续完成两次创作并监听 |

### 8.2 技术验收

| # | 标准 | 验证方法 |
|---|------|---------|
| T1 | 无任何外部网络请求（无 CDN、在线字体、远程图片） | DevTools Network 面板，断网测试 |
| T2 | 无 npm、无构建步骤、无框架依赖 | 检查文件列表，无 package.json / node_modules |
| T3 | `file://` 协议下完整运行 | 断网后双击 index.html |
| T4 | Foundation 建议 < 1 MB，最终项目目标 < 5 MB，且必须 < 50 MB | 查看文件属性 |
| T5 | 无 ES Module 语法（无 import / export） | 代码搜索 |
| T6 | 所有路径为相对路径 | 代码搜索 `C:\` 或 `http` |
| T7 | 音频调度使用 AudioContext 时间轴，而非只依赖 setInterval | 检查 audio-engine.js |
| T8 | 页面离开/重置时停止或断开旧音频节点与动画循环 | 多次重置 + Performance 检查 |

### 8.3 体验验收

| # | 标准 | 验证方法 |
|---|------|---------|
| U1 | 手机 390×844 无横向滚动，选项卡可点击 | DevTools 设备模拟 |
| U2 | 桌面 1440px 布局合理，不空洞 | 视觉确认 |
| U3 | 1 分钟内能理解操作方式（无需说明文档） | 请他人试玩 |
| U4 | `prefers-reduced-motion` 开启时动画降级 | 系统设置开启后测试 |
| U5 | 键盘可操作（数字键选选项、Enter 确认、D/F/J/K 演奏） | 纯键盘走完全流程 |
| U6 | 颜色对比度满足 WCAG AA（正文 ≥ 4.5:1） | DevTools 检查 |

### 8.4 MTX 任务硬性要求对照

| 任务要求 | 本项目实现方式 |
|---------|-------------|
| 规则 1 分钟内能理解 | 首屏一句话介绍 + 「开始创作」按钮，无需阅读规则 |
| 至少 3 首音乐或 3 种音效 | 鼓组、Bass、Pad/旋律层及 4 个 Drop Pad 均由 Web Audio 合成 |
| 得分、关卡或反馈机制 | DNA 实时反馈 + 主/副风格评分 + 观众反应 + 多结局 |
| 统一视觉与音乐风格 | 深色霓虹 Bass Music 风格，贯穿全流程 |
| 双击 index.html 可离线运行 | 零外部依赖，纯前端 |
| 适配手机和电脑 | 响应式布局，触摸 + 键鼠 |
| 最终 ZIP < 50 MB | 以程序化合成为主，目标 < 5 MB |

---

## 附录：风格判定路径示例

以下路径用于验证评分逻辑的正确性：

| 路径 | 选择组合 | 预期风格 |
|------|---------|---------|
| 极端残暴 | Abyss + Brutal + Half-time + Classic Drop + Mutate + Overload | Brostep |
| 极简机械 | Abyss + Mechanical + Half-time + Minimal Tech + Repeat + Standard | Riddim Dubstep |
| 舞池驱动 | Neon City + Mechanical + Four-on-the-floor + Minimal Tech + Repeat + Standard | Bass House |
| 情感旋律 | Organic Forest + Melodic + Half-time + Melodic Narrative + Lift + Gentle | Melodic Dubstep |
| 实验跨界 | Cosmic Void + Wobbly + Syncopated + Epic Journey + Mutate + Overload | Hybrid Trap |
| 融合路线 | Abyss + Melodic + Half-time + Melodic Narrative + Mutate + Overload | Destiny Fusion |

> Fusion 路线代表 Melodic Dubstep 与 Hybrid Trap 的混合：高和声与大空间保留情绪性，Mutate 与 Overload 增加变奏、攻击性和意外感。结果仍必须保持确定性，不能依赖随机数。
