# DROP//DESTINY — 产品规格书

> 引导普通用户完成第一首可播放、可重做的 Bass Music 小作品。用户依次选择声音世界、Bass 核心性格与节奏骨架，然后进入真正的合成器工作台塑造音色；最终曲风、编排倾向与 Drop 强度由用户的真实合成参数自动推导。系统根据创作选择判定作品风格，可能解锁隐藏结局 Destiny Fusion。

---

## 0. 产品北极星与开发边界

### 0.1 产品北极星

用户完成后应该能够明确地说：**"这是我刚刚做出来的一小段歌。"**

因此，最终版本不能退化成"选择几张卡片后获得音乐人格测试结果"。以下三点属于产品闭环，不是后续锦上添花：

1. 每个阶段都能试听，并真实改变正在播放的音乐。
2. 最终生成一段约 20–28 秒、包含鼓组、Bass 和至少一个旋律/氛围层的可重播作品。
3. 波形或频谱必须由真实音频驱动，而不是与声音无关的装饰动画。

### 0.2 当前状态

产品已完成从 Foundation 骨架到完整 MVP 的演进。核心创作流程为：

**Intro → Sound World → Bass Core → Rhythm Chassis → Bass Forge → Result**

用户的主要操作重心是 Bass Forge 合成器。Structure（编曲结构）、Variation（Drop 后半段变化）和 Drop 强度不再作为独立选择题出现，而是由用户在 Bass Forge 中调节的真实合成参数自动推导。六种结局使用内嵌 Collider 渲染的伴奏，并实时叠加由用户实际合成参数驱动的主 Bass。

---

## 1. 六屏流程（Intro + 四个创作阶段 + Result）

| 阶段 | 名称 | 用户做什么 | 产出 |
|------|------|-----------|------|
| 0 | Intro 封面 | 点击页面任意位置进入 | 启动 AudioContext，进入阶段 1 |
| 1 | 声音世界 Sound World | 试听并选择 4 个氛围之一 | 设定 Space / Harmony / Surprise 基调和视觉场景 |
| 2 | Bass Core | 选择 Bass 核心性格 | 设定合成器预设默认值，影响 Aggression / Movement / Harmony |
| 3 | 节奏骨架 Rhythm Chassis | 选择节奏家族 + 密度档位 | 决定 BPM、鼓组骨架和 Rhythm / Movement / Surprise |
| 4 | Bass Forge | 操作双振荡器合成器 | 生成用户自己的 Bass 音色，自动推导 Structure / Variation / Drop |
| 5 | Result 结算 | 播放作品、返回修改或重新创作 | 展示主风格、副风格、三个派生特征和风格简介 |

封面不再有"开始创作"按钮——用户点击页面任意位置（除静音按钮外）即可进入。每个阶段都可以返回上一阶段修改，DNA 和音乐根据当前选择**重新计算**，不重复叠加旧选择。

全部完成后进入结算页，展示风格判定和派生特征，并提供"播放我的作品""返回修改""重新创作"。

---

## 2. 各阶段选择及对音乐的影响

### 阶段 1 — 声音世界

| 选项 | 描述 | DNA 变化 |
|------|------|---------|
| 深渊 Abyss | 极低频嗡鸣，大空间混响，黑暗压迫 | Space +20, Harmony −10, Surprise +5 |
| 霓虹城 Neon City | 高频闪烁，电子脉冲，能量密集 | Movement +15, Rhythm +10, Space −5 |
| 有机森林 Organic Forest | 温暖木质质感，自然泛音，柔和 | Harmony +20, Space +10, Aggression −10 |
| 宇宙虚空 Cosmic Void | 无限延展的 ambient pad，空灵神秘 | Space +25, Harmony +10, Movement −10 |

选择后启动持续 Loop，可视化舞台随即显示。

### 阶段 2 — Bass Core

| 选项 | 描述 | DNA 变化 |
|------|------|---------|
| 残暴 Brutal | 失真锯齿，嘶吼式 growl bass | Aggression +30, Rhythm +10, Harmony −20 |
| 摇摆 Wobbly | LFO 调制 wobble，弹跳有律动 | Movement +25, Rhythm +10, Aggression +5 |
| 旋律 Melodic | 调音 bass，有音高走向，可哼唱 | Harmony +30, Movement +10, Aggression −15 |
| 机械 Mechanical | 精准量化，金属质感，冰冷节拍 | Rhythm +20, Aggression +10, Movement +5, Harmony −10 |

选择核心性格后加载对应的合成器预设。

### 阶段 3 — Rhythm Chassis

| 选项 | 描述 | DNA 变化 |
|------|------|---------|
| 半拍 Half-time | 140 BPM，听感约 70–75 BPM | Rhythm +15, Movement −5, Space +10 |
| 四四拍 Four-on-the-floor | 124 BPM，舞池驱动 | Rhythm +25, Movement +15, Space −10 |
| 切分 Syncopated | 145 BPM，反拍 emphasis，弹性 | Rhythm +20, Movement +20, Surprise +10 |
| 碎拍 Breakbeat | 165 BPM，复杂打击，混乱能量 | Rhythm +15, Movement +25, Surprise +20, Aggression +10 |

选择节奏家族后，再选择一个三档密度控制：

- `Sparse`：Movement −8，Space +8。
- `Balanced`：不额外修正。
- `Busy`：Movement +12，Surprise +6，Aggression +4。

密度改变 Hi-hat、Ghost Note 和 Fill 数量，但不改变核心 Kick/Snare 骨架。

### 阶段 4 — Bass Forge（主要工作台）

Bass Forge 是用户的核心创作工作台。选择 Bass Core 后加载预设，用户操作完整的双振荡器合成器：

**OSCILLATORS 组**

| 参数 | 范围 | 说明 |
|------|------|------|
| Wavetable | 5 种 AKWF 单周期波形 | 主振荡器波形 |
| OSC B | SAW / SQUARE / TRIANGLE / SINE | 第二振荡器波形 |
| MIX | 0–100% | A/B 振荡器混合（等功率） |
| DETUNE | 0–36 ct | 振荡器失谐 |
| FM | 0–100% | FM 调制量 |

**DISTORTION 组**

| 参数 | 范围 | 说明 |
|------|------|------|
| DRIVE | 0–100% | 失真量 + 视觉热度（CLEAN CUT → GRIT → CRUSH → BURN → MELTDOWN） |

**FILTER + MOTION 组**

| 参数 | 范围 | 说明 |
|------|------|------|
| FILTER TYPE | LOW PASS / BAND PASS / NOTCH | 滤波器类型 |
| CUTOFF | 80–8000 Hz（对数） | 滤波器截止频率 |
| RESO | 0.5–20 Q | 滤波器共振 |
| ENV | 0–100% | 滤波器包络量 |
| RATE | 1/2、1/4、1/8、1/8T、1/16 | 同步 LFO 速率 |
| DEPTH | 0–100% | LFO 调制深度 |
| LFO SHAPE | SINE / TRIANGLE / SAW / SQUARE | LFO 波形 |
| LFO TO | FILTER / PITCH / FM | LFO 调制目标 |

**AMP + SPACE 组**

| 参数 | 范围 | 说明 |
|------|------|------|
| ATTACK | 1–180 ms（对数） | 音符起音 |
| RELEASE | 30–500 ms（对数） | 音符释放 |
| SPACE | 0–100% | 延迟发送 + 混响感 |

合成器旋钮支持拖拽、滚轮和键盘操作，双击恢复预设值。参数平滑更新避免 zipper noise。

**门槛要求**：用户必须至少调整一个合成参数才能进入 Result 阶段（详见 §11.1 F6）。

#### 派生宏观值

真实合成参数派生为 Body / Growl / Wobble / Space 四个 DNA 宏观值，供风格评分引擎使用：

| 宏观值 | 派生公式 | DNA 影响 |
|--------|---------|---------|
| Body | `sub` | Aggression += 12n, Rhythm += 5n, Space -= 5n |
| Growl | `fm × 0.28 + drive × 0.34 + (resonance/20) × 18 + filterEnv × 0.20` | Aggression += 18n, Surprise += 6n, Harmony -= 8n |
| Wobble | `depth × 0.76 + (rate/4) × 16 + (detune/36) × 8` | Movement += 18n, Rhythm += 8n |
| Space | `space × 0.90 + releaseSpace × 10` | Space += 20n, Harmony += 6n, Aggression -= 5n |

其中 `n = (currentValue - presetDefault) / 50`。

#### 自动推导 Structure / Variation / Drop

进入 Result 阶段时，系统根据用户合成参数自动推导编曲选择：

| 推导维度 | 条件 | 结果 |
|---------|------|------|
| Structure | melodic 性格 / space≥68 且 drive<74 | melodicNarrative |
| | fourOnFloor 节奏 / mechanical 性格 | minimalTech |
| | drive≥76 / cutoff≥3600 | classicDrop |
| | 其他 | epicJourney |
| Variation | melodic 性格 / space≥65 且 detune≥16 | lift |
| | drive≥66 / fm≥64 / depth≥72 | mutate |
| | 其他 | repeat |
| Drop | drive≥70 / (fm≥75 且 cutoff≥2200) | overload |
| | drive≤34 / (space≥76 且 melodic) | gentle |
| | 其他 | standard |

这些推导结果在结算页以 STRUCTURE / MOTION / IMPACT 三个特征展示。

---

## 3. 最终作品播放

### 播放方式

最终作品使用内嵌 Collider 渲染的预伴奏，并实时叠加由用户实际合成参数驱动的主 Bass：

1. 根据风格判定结果确定 genre（riddimDubstep / brostep / hybridTrap / bassHouse / melodicDubstep / destinyFusion）。
2. 从 `ending-assets.js` 加载对应 genre 的预渲染伴奏 buffer（内含鼓组、和声层、旋律层和配器）。
3. 创建 `BufferSource` 播放伴奏，同时使用用户的持久 Bass 链（`bassOsc` + `bassFilter` + `bassShaper` + `bassGate`）在 Drop 段落实时叠加主 Bass。
4. Bass 音高、音色和 articulation 由 genre phrase + 用户合成参数 + Sound World 音域共同决定。

### 伴奏规格

| Genre | BPM | Root | Gain |
|-------|-----|------|------|
| Riddim Dubstep | 140 | 55 Hz | 1.42 |
| Brostep | 150 | 55 Hz | 1.38 |
| Hybrid Trap | 150 | 49 Hz | 1.42 |
| Bass House | 126 | 65.4 Hz | 1.38 |
| Melodic Dubstep | 150 | 73.4 Hz | 1.25 |
| Destiny Fusion | 145 | 49 Hz | 1.38 |

伴奏时长约 20–28 秒，结构为 2 bars Intro + 4 bars Build-up + 8 bars Drop（14 bars 总计）。

### Drop 段落用户 Bass 叠加

Drop 分为前后两段（各 4 bars），根据推导的 Variation 决定后半段行为：

- **Repeat**：后半段延续前半段核心 bass phrase。
- **Mutate**：后半段切换到变奏 phrase。
- **Lift**：后半段频率上行 1.5 倍（升五度）。

Bass articulation（音高偏移、时值、Filter/FM/Wobble 表现）由 genre-specific phrase 和 step 位置决定。

> **已知问题**：用户 Bass 调度存在代码问题，部分场景下 Drop 段落叠加时序可能异常。此问题将由其他任务修复，不影响 14 小节结构和 20–28 秒时长描述。

---

## 4. 六个歌曲 DNA 指标

所有指标初始值为 **50**（中性），通过阶段选择和合成参数调整累加修改，最终范围钳制在 **0–100**。

| 指标 | 含义 | 低值表现 | 高值表现 |
|------|------|---------|---------|
| **Rhythm 节奏感** | 律动驱动力和节拍稳定度 | 氛围化、无明确节拍 | 强力 groove，身体跟着动 |
| **Aggression 攻击性** | 声音的猛烈、失真和压迫程度 | 柔和、温暖、舒适 | 暴力、嘶吼、撕裂感 |
| **Harmony 和声性** | 音高组织的旋律感和和声丰富度 | 噪音化、无调性 | 有明确调性、可哼唱 |
| **Movement 运动感** | 声音变化频率和层次切换速度 | 静态、重复、催眠 | 快速变化、层次丰富 |
| **Space 空间感** | 混响深度和声场开阔度 | 干燥、紧密、贴脸 | 宽广、深邃、有呼吸 |
| **Surprise 意外性** | 不可预测性和结构创新程度 | 循规蹈矩、意料之中 | 出人意料、打破预期 |

---

## 5. 风格评分逻辑

### 5.1 五个主要风格的理想 DNA 轮廓

| 风格 | Rhythm | Aggression | Harmony | Movement | Space | Surprise |
|------|--------|-----------|---------|----------|-------|----------|
| Riddim Dubstep | 82 | 65 | 30 | 45 | 45 | 40 |
| Brostep | 60 | 85 | 30 | 70 | 40 | 50 |
| Hybrid Trap | 65 | 70 | 40 | 85 | 45 | 82 |
| Bass House | 85 | 55 | 50 | 65 | 25 | 35 |
| Melodic Dubstep | 55 | 30 | 85 | 60 | 70 | 45 |

### 5.2 为什么不能只使用 DNA 距离

初版规则对全部 `4 × 4 × 4 × 4 × 3 × 3 = 2304` 条选择路径进行了枚举验证，结果为：

| 结果 | 路径数 |
|------|------:|
| Riddim Dubstep | 4 |
| Brostep | 63 |
| Hybrid Trap | 467 |
| Bass House | 29 |
| Melodic Dubstep | 157 |
| Destiny Fusion | 48 |

这说明单纯使用六维曼哈顿距离会严重偏向 Hybrid Trap，且某些高空间感路径会被错误判成 Riddim。原因是风格不只是"数值轮廓"，还存在决定性音乐语法，例如 Four-on-the-floor 几乎是 Bass House 的强锚点，Melodic Bass + Melodic Narrative 是 Melodic Dubstep 的强锚点。

因此采用 **DNA 相似度 + 风格锚点** 的混合判定。

### 5.3 DNA 相似度

保留理想轮廓用于解释歌曲气质，但只占最终得分的一部分：

```text
distance(style) = Σ |userDNA[i] - idealDNA[style][i]|
dnaSimilarity(style) = max(0, 100 - distance / 3.6)
```

### 5.4 风格锚点

每个关键选择为一个或多个风格增加原始锚点分。锚点权重作为数据维护在 `data.js` 的 `STYLE_ANCHORS` 中。

锚点覆盖六个维度：soundWorld、bassPersonality、rhythm、structure、variation、drop。其中 structure、variation、drop 由合成参数自动推导（见 §2 阶段 4），但锚点权重仍参与评分。

将每种风格的原始锚点分除以该风格理论最大锚点分（程序化计算），得到 `anchorSimilarity`（0–100）。

### 5.5 最终得分与判定

```text
finalScore(style) = 0.45 × dnaSimilarity(style)
                  + 0.55 × anchorSimilarity(style)
```

1. 计算全部 5 个风格的 `finalScore`。
2. 最高分为主风格，第二名作为"副风格影响"，在结果文案中展示，例如"Melodic Dubstep with Hybrid Trap influence"。
3. **Destiny Fusion** 只有同时满足以下条件才触发：
   - 第一名得分 ≥ 55，第二名得分 ≥ 52；
   - 第一与第二名差值 ≤ 4；
   - 六个 DNA 全部位于 40–90，且最高值与最低值差 ≤ 40；
   - 第一、第二风格的锚点相似度都 ≥ 40；
   - Bass Forge 已完成（`performance.completed = true`）。

### 5.6 可达性自动验证

实现风格引擎时必须同时写一个仅供开发使用的枚举测试函数。`4 × 4 × 4 × 4 × 3 × 3 = 2304` 条"声音世界 × Bass × Groove × Structure × Variation × Drop"卡片路径使用固定的中性 Pattern，输出全部路径的结果分布。验收范围：

- 每个主要风格至少占全部路径的 5%；
- 任一主要风格不得超过 45%；
- Destiny Fusion 应当稀有，占比建议 1%–8%；
- 相同输入必须产生完全相同的结果。

开发用测试位于 `dev/style-engine-test.html`。

### 5.7 风格描述速查

| 风格 | 一句话描述 |
|------|-----------|
| Riddim Dubstep | 极简、重复、重压——用最少的元素砸最重的拳 |
| Brostep | 狂暴、多变、撕裂——一场肾上腺素过山车 |
| Hybrid Trap | 实验、跨界、意外——陷阱鼓组遇上奇形 Bass |
| Bass House | 律动、舞池、弹跳——让整个房间跟着抖 |
| Melodic Dubstep | 情感、旋律、辽阔——眼眶发热的那一刻 |
| Destiny Fusion（隐藏） | 超越分类——你的本能打破了所有边界 |

---

## 6. 结算页

结算页展示以下内容：

| 区域 | 内容 |
|------|------|
| FINAL OUTPUT | 主风格名称（Destiny Fusion 时显示 HIDDEN ENDING 徽章） |
| Secondary | 副风格影响（"with X influence"），隐藏结局时不显示 |
| STRUCTURE | 推导的编曲结构标签 |
| MOTION | 推导的 Variation 标签 |
| IMPACT | 推导的 Drop 强度标签 |
| STYLE PROFILE | 主风格的一句话描述 |

操作按钮：

- **播放作品**：加载 Collider 伴奏并实时叠加用户 Bass，播放完成后自动恢复按钮。
- **停止播放**：立即停止播放并恢复参数。
- **返回修改**：返回 Bass Forge 重新调整参数。
- **重新创作**：重置全部状态回到封面。

---

## 7. 项目状态数据结构

`choices`、`synthParams`、Groove 参数是事实来源；`bassMacros`、`dna` 与 `result` 都是可重新计算的派生数据。禁止在用户每次点击时永久累加 DNA。

```javascript
const INITIAL_DNA = Object.freeze({
  rhythm: 50, aggression: 50, harmony: 50,
  movement: 50, space: 50, surprise: 50
});

const STATE = {
  // 'intro' | 'soundWorld' | 'bassCore' | 'rhythm' | 'bassForge' | 'result'
  phase: 'intro',

  choices: {
    soundWorld: null,
    bassPersonality: null,
    rhythm: null,
    structure: null,     // 由合成参数自动推导
    variation: null,     // 由合成参数自动推导
    drop: null           // 由合成参数自动推导
  },

  // 真实合成参数是 Bass Forge 的事实来源
  synthParams: {
    waveform: 'distorted', oscB: 'sawtooth', oscMix: 45, detune: 12,
    filterType: 'lowpass', filterEnv: 60,
    sub: 60, fm: 50, cutoff: 1400, resonance: 8,
    drive: 55, attack: 5, release: 110,
    rate: 2, depth: 55, lfoShape: 'sine', lfoTarget: 'filter', space: 40
  },

  // 由 synthParams 派生，供风格评分引擎使用
  bassMacros: { body: 50, growl: 50, wobble: 50, space: 50 },

  groove: { density: 1, fillPreference: 1 },

  performance: { events: [], completed: false }, // events 为兼容/测试输入；completed 用于 Fusion 判定

  // 以下均由当前状态重新计算
  dna: { ...INITIAL_DNA },
  result: null,

  ui: { muted: false, isPlaying: false, canGoBack: false }
};
```

### 数据流

```
用户试听/选择/调节合成器
        ↓
只更新 choices / synthParams / groove
        ↓
deriveBassDrivenChoices() 从合成参数推导 structure / variation / drop
        ↓
computeDna() 从 INITIAL_DNA 重新计算 DNA
        ↓
audioEngine.applyState() 平滑更新正在播放的声音
        ↓
完成 Bass Forge → styleEngine.evaluate() → 结算并播放完整作品
```

必须提供"返回修改"。用户返回后改变任意选择，音乐、DNA、风格结果都应确定性更新。

---

## 8. 视觉与交互

### 8.1 视觉风格

- **配色**：红黑白主色调，黄色（#FFCE00）和蓝色作为点缀。
- **封面**：标题 "DROP"，鼠标移动触发锯齿 Glitch 效果，点击任意位置进入。
- **可视化舞台**：跨阶段持续显示的音频反应式 Canvas，使用 AnalyserNode 实时驱动。
- **Bass Forge**：可视化舞台嵌入合成器中央开窗（synth-docked 模式）。
- **全屏模式**：可视化舞台支持全屏，鼠标静止 1.8 秒后隐藏光标。

### 8.2 可视化特性

- 对数频段分析、波形 RMS、Attack/Release 平滑与自适应 Beat Detection。
- 反馈拖影、确定性粒子流场、频谱几何与 Retina DPR 适配。
- 四种显示模式（AUTO / SHRED / BUNKER / FRACTURE），其中 AUTO 为自动模式，另外三种为手动模式，可循环切换。
- 六套结局视觉（Riddim / Brostep / Hybrid Trap / Bass House / Melodic / Destiny Fusion）。
- 最终歌曲播放时按段落（Intro / Build / Pre-drop / Drop A / Drop B / Outro）实时切换场景。

### 8.3 进度指示

Header 显示 4 个进度点（Sound World / Bass Core / Rhythm / Bass Forge），当前阶段高亮，已完成阶段标记为 done。

---

## 9. 开发里程碑

### 9.1 已完成

- [x] 六屏流程可前进、返回和重新开始。
- [x] 选择、合成器参数使用统一状态管理；bassMacros 只由 synthParams 派生。
- [x] DNA 每次从当前状态重新计算，不出现返回后重复叠加。
- [x] 混合风格判定引擎与 2304 路径枚举测试可运行。
- [x] Structure / Variation / Drop 由合成参数自动推导。
- [x] Bass Forge 提供完整双振荡器合成器：Wavetable、Osc B、Mix、Detune、FM、Filter Type、Cutoff、Resonance、Env、Drive、Amp Attack/Release、同步 LFO Rate/Depth/Shape/Target、Sub、Space。
- [x] 至少三个真实音乐层：鼓组、Bass、氛围/旋律层。
- [x] 每阶段选择能听出差异，连续播放的音乐预览。
- [x] 最终作品使用内嵌 Collider 伴奏 + 用户 Bass 实时叠加，约 20–28 秒。
- [x] Canvas 波形/频谱由 Web Audio AnalyserNode 实时驱动。
- [x] 结算页显示主风格、副风格、三个派生特征和风格简介。
- [x] 支持返回修改、重新创作、静音和停止播放，不发生音频叠加。
- [x] 响应式布局，支持键盘与触摸。
- [x] 双击 `index.html` 离线运行，零外部依赖。

### 9.2 Stretch Goals（时间允许再做）

- [ ] 使用 localStorage 保存作品参数和最佳作品。
- [ ] 使用 MediaRecorder 下载 WebM/Opus 录音。
- [ ] 通过 URL 编码分享无隐私的作品参数。
- [ ] 更丰富的 Canvas 粒子、舞台和 Drop 全屏冲击。
- [ ] 成就、二周目和稀有结局。
- [ ] 封面卡片生成与多语言。

---

## 10. 文件结构

### 10.1 核心文件

```
DROP_DESTINY/
├─ index.html              # 页面结构与经典 script 引入
├─ styles.css              # 布局、配色、动画、响应式、reduced-motion
├─ app.js                  # 状态管理、阶段切换、事件绑定、DOM 渲染
├─ data.js                 # 选项、DNA 修正、风格轮廓、锚点、合成器预设
├─ style-engine.js         # DNA 重算、混合评分、Fusion 判定、推导函数、枚举测试
├─ audio-engine.js         # Web Audio 合成引擎、Loop 调度、Collider 伴奏播放
├─ visualizer.js           # Canvas + AnalyserNode 实时可视化
├─ wavetables.js           # AKWF CC0 单周期波形数据
├─ audio-assets.js         # CC0 鼓组/Impact/Riser 采样（Base64 内嵌）
├─ ending-assets.js        # Collider 渲染的六风格结局伴奏（Base64 内嵌）
├─ spec.md                 # 本文件
├─ README.md               # 项目说明
├─ ASSET_LICENSES.md       # 第三方音频素材来源与许可
└─ .gitignore
```

### 10.2 Collider 源码（开发用）

```
collider/
├─ drop-destiny-tape.scd      # 主 SuperCollider 渲染脚本
├─ drop-destiny-tape.md       # 渲染说明
├─ render-backing.scd          # 批量渲染伴奏
├─ render-one.scd              # 单曲渲染
├─ validate-tape.scd           # 验证脚本
├─ arrangements/               # 六风格编曲定义
│  ├─ riddim-arrangement.scd
│  ├─ brostep-arrangement.scd
│  ├─ hybrid-arrangement.scd
│  ├─ house-arrangement.scd
│  ├─ melodic-arrangement.scd
│  └─ fusion-arrangement.scd
└─ samples/                    # CC0 鼓组采样（源文件）
```

### 10.3 开发工具（dev/）

```
dev/
├─ style-engine-test.html      # 2304 路径枚举测试页面
├─ regression-test.js          # 回归测试
├─ audio-engine-smoke-test.js  # 音频引擎冒烟测试
├─ test-visualizer.js          # 可视化测试
├─ test-ending-integration.js  # 结局集成测试
├─ test-desktop-layout.js      # 布局测试
├─ build-assets.js             # 采样打包脚本
├─ build-ending-assets.js      # 结局伴奏打包脚本
├─ render-collider-endings.js  # Collider 结局渲染驱动
├─ extract-collider-samples.js # 采样提取
├─ export-representative-audio.js # 代表性音频导出
├─ analyze-reference-audio.js  # 参考音频分析
└─ native-audio-export.html    # 原生音频导出页面
```

### 10.4 JavaScript 公共接口

```javascript
// data.js
// window.DropDestinyData = { CHOICES, BASS_PRESETS, SYNTH_PRESETS, MACRO_DNA_RULES,
//   STYLE_PROFILES, STYLE_ANCHORS, PERFORMANCE_PAD_ANCHORS, NEUTRAL_PATTERN }
// PERFORMANCE_PAD_ANCHORS 与 NEUTRAL_PATTERN 保留给风格枚举、音频回归和兼容输入，当前无 UI 消费者。

// style-engine.js（纯函数，不读取 DOM，不创建音频）
// window.StyleEngine.computeDna(state)
// window.StyleEngine.evaluate(state)
// window.StyleEngine.deriveBassDrivenChoices(state)  // 从合成参数推导 structure/variation/drop
// window.StyleEngine.enumerateCardPaths()

// audio-engine.js
// window.AudioEngine.start(state) / applyState(state) / previewChoice(phase, optionId)
// window.AudioEngine.playFinalSong(state, completeCb) → Promise<boolean>
// window.AudioEngine.stopFinalSong() / stop() / setMuted(muted)
// window.AudioEngine.getAnalyser() / getIsPlaying() / getIsPaused()
// window.AudioEngine.getIsFinalSongPlaying() / getFinalSongPosition()
// window.AudioEngine.preloadEnding(genre) / getFinalSongError()

// visualizer.js
// window.Visualizer.start(canvas, analyser) / stop() / resize()
// window.Visualizer.setTheme(soundWorld) / setIntensity(value)
// window.Visualizer.setAnalyser(analyser) / setPlayback(playback)
// window.Visualizer.setExperienceState(state) / cycleMode() / getMetrics()
```

全部使用普通 `<script>`，不使用 ES Module，支持 `file://`。

---

## 11. 验收标准

### 11.1 功能验收

| # | 标准 | 验证方法 |
|---|------|---------|
| F1 | 双击 `index.html` 可在浏览器中打开，控制台无报错 | Chrome 已测；Edge 离线待最终验收 |
| F2 | 封面点击任意位置进入阶段 1，AudioContext 启动 | 手动点击 |
| F3 | 4 个阶段依次出现，每个主要选择都可试听或操作 | 逐阶段走完并对比声音 |
| F4 | 选择或调整任一创作参数后，DNA 与正在播放的音乐同步变化 | 观察数值并听声音变化 |
| F5 | Bass Forge 合成器所有旋钮可操作（拖拽/滚轮/键盘），双击恢复预设 | 手动操作每个旋钮 |
| F6 | 改变至少一个合成参数后才能进入 Result | 尝试不修改直接下一步 |
| F7 | 结算页显示主/副风格、三个派生特征和风格简介 | 完整走一条路径后查看 |
| F8 | 播放作品加载 Collider 伴奏并叠加用户 Bass，约 20–28 秒 | 点击播放并计时 |
| F9 | 五个主要风格均有明确可达路径 | 运行枚举测试 |
| F10 | Destiny Fusion 稀有但可达 | 枚举测试并检查固定 Fusion 路径 |
| F11 | 「返回修改」重新计算声音/DNA；「重新创作」彻底重置状态 | 修改旧选择并确认没有重复加分 |
| F12 | 静音按钮可关闭声音，不影响视觉和逻辑 | 切换静音后操作 |
| F13 | 重新开始、返回修改、多次播放后不会叠加旧的定时器或音频节点 | 连续完成两次创作并监听 |
| F14 | Drop 播放中按 Stop 快速安静，立即重播不出现旧 Bass 或旧 Pad | 播放中点停止后立即重播 |

### 11.2 技术验收

| # | 标准 | 验证方法 |
|---|------|---------|
| T1 | 无任何外部网络请求（无 CDN、在线字体、远程图片） | DevTools Network 面板，断网测试 |
| T2 | 无 npm、无构建步骤、无框架依赖 | 检查文件列表，无 package.json / node_modules |
| T3 | `file://` 协议下完整运行 | Chrome 断网已测；Edge 离线待最终验收 |
| T4 | 项目目标 < 5 MB，必须 < 50 MB | 查看文件属性 |
| T5 | 无 ES Module 语法（无 import / export） | 代码搜索 |
| T6 | 所有路径为相对路径 | 代码搜索 `C:\` 或 `http` |
| T7 | 音频调度使用 AudioContext 时间轴 | 检查 audio-engine.js |
| T8 | 页面离开/重置时停止或断开旧音频节点与动画循环 | 多次重置 + Performance 检查 |

### 11.3 体验验收

| # | 标准 | 验证方法 |
|---|------|---------|
| U1 | 手机 390×844 无横向滚动，选项卡可点击 | DevTools 设备模拟已通过；真实触摸设备待最终验收 |
| U2 | 桌面 1440px 布局合理，不空洞 | 视觉确认 |
| U3 | 1 分钟内能理解操作方式（无需说明文档） | 请他人试玩 |
| U4 | `prefers-reduced-motion` 开启时动画降级 | 系统设置开启后测试 |
| U5 | 键盘可操作（数字键选选项、Enter 确认） | 纯键盘走完全流程 |
| U6 | 颜色对比度满足 WCAG AA（正文 ≥ 4.5:1） | DevTools 检查；WCAG AA 待最终人工验收 |

### 11.4 MTX 任务硬性要求对照

| 任务要求 | 本项目实现方式 |
|---------|-------------|
| 规则 1 分钟内能理解 | 封面点击进入，逐阶段选择，无需阅读规则 |
| 至少 3 首音乐或 3 种音效 | 鼓组、Bass、Pad/旋律层及六风格结局伴奏均由 Web Audio 合成或内嵌 |
| 得分、关卡或反馈机制 | 内部 DNA 判定 + 主/副风格结果 + 三个派生特征 + 六结局 + 实时可视化反馈 |
| 统一视觉与音乐风格 | 红黑白高对比 Bass Music 风格，贯穿全流程 |
| 双击 index.html 可离线运行 | 零外部依赖，纯前端 |
| 适配手机和电脑 | 响应式布局，触摸 + 键鼠 |
| 最终 ZIP < 50 MB | 以程序化合成 + 内嵌 Base64 为主 |

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

> 注意：实际产品中 Structure / Variation / Drop 由合成参数自动推导，上表的选择组合用于验证评分引擎在 2304 路径枚举中的正确性。相同输入必须产生完全相同的结果。
