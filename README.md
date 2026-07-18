# DROP//DESTINY

一个以 Bass 音色塑造为核心的浏览器音乐创作游戏。用户依次选择声音世界、Bass 核心性格与节奏骨架，然后进入真正的合成器工作台；最终曲风、编排倾向与 Drop 强度由用户的真实合成参数自动推导。

## 运行

无需安装依赖或启动服务器：

1. 下载或克隆仓库。
2. 双击 `index.html`。
3. 点击封面任意位置进入，开启声音。

建议使用最新版 Chrome 或 Edge，并佩戴耳机体验低频与实时可视化。普通步骤使用电影宽银幕视觉，Bass Forge 会把同一块实时画面嵌入合成器中央开窗；`AUTO` 为自动模式，另外三种（SHRED / BUNKER / FRACTURE）为手动模式，可循环切换；`⛶` 可进入全屏。

## 创作流程

```
Intro → Sound World → Bass Core → Rhythm Chassis → Bass Forge → Result
```

1. **Intro**：封面点击任意位置进入。
2. **Sound World**：选择声音氛围（深渊 / 霓虹城 / 有机森林 / 宇宙虚空）。
3. **Bass Core**：选择 Bass 的原始核心性格（残暴 / 摇摆 / 旋律 / 机械），加载对应合成器预设。
4. **Rhythm Chassis**：选择节奏家族（半拍 / 四四拍 / 切分 / 碎拍）与 Sparse / Balanced / Busy 密度。
5. **Bass Forge**：在双振荡器合成器中调节 Wavetable / Osc B / Mix / Detune / FM / Drive / Filter Type / Cutoff / Resonance / Env / Amp Attack / Release / 同步 LFO Rate / Depth / Shape / Target / Sub / Space。改变至少一个参数才能铸造结局。

Drive 同时控制音频失真与视觉热度。Structure（编曲结构）、Variation（Drop 后半段变化）和 Drop 强度不再作为选择题，而由上述合成参数自动推导，在结算页以 STRUCTURE / MOTION / IMPACT 三个特征展示。

最终可能生成 Riddim Dubstep、Brostep、Hybrid Trap、Bass House、Melodic Dubstep 或隐藏的 Destiny Fusion 结局。

## 最终作品

六种结局使用内嵌 Collider 渲染的预伴奏，并实时叠加由用户实际合成参数驱动的主 Bass：

- 伴奏在 SuperCollider 中预渲染，包含鼓组、和声层、旋律层和配器，以 Base64 内嵌于 `ending-assets.js`。
- 播放时创建 BufferSource 播放伴奏，同时使用用户的持久 Bass 链在 Drop 段落实时叠加主 Bass。
- 结构为 2 bars Intro + 4 bars Build-up + 8 bars Drop（14 bars 总计），时长约 20–28 秒。
- Drop 后半段行为由推导的 Variation 决定：Repeat 延续、Mutate 变奏、Lift 升调。

## 视觉

- 红黑白主色调，黄色与蓝色点缀，高对比 Bass Music 海报风格。
- 封面鼠标移动触发锯齿 Glitch 效果。
- 跨阶段持续显示的音频反应式 Canvas，由 AnalyserNode 实时驱动。
- 四种显示模式：AUTO（自动模式）+ SHRED / BUNKER / FRACTURE（手动模式），可循环切换。
- 六套结局视觉按风格切换，最终歌曲按段落实时切换场景。
- 支持全屏模式，鼠标静止后隐藏光标。

## 技术

- 原生 HTML / CSS / JavaScript，无框架、无 CDN、无外部运行时依赖。
- Web Audio API 合成与调度，AudioContext 时间轴精确调度。
- 双振荡器 Mix / Detune、FM 合成、WaveShaper 失真、BiquadFilter、同步 LFO。
- AKWF CC0 单周期波形（`wavetables.js`）。
- CC0 采样鼓组、Impact、Riser 与 Kick Sidechain（`audio-assets.js`）。
- 分流派主 Bass 与 Reese / Vowel / Metallic / 808 Glide / Donk 辅助音色。
- 逐音 Bass 音高、时值、Filter / FM / Wobble articulation 与 A/B 节奏乐句。
- Melodic Dubstep Supersaw 扩展和弦、Saw Lead、回应旋律与稀疏 Bass 点缀。
- 六套分流派 Kick / Snare 处理与独立闭镲/开镲采样。
- Drum / Bass / Harmony / Lead / FX 五总线动态混音与 Kick Sidechain。
- AnalyserNode 对数频段、波形 RMS、Attack / Release 平滑与自适应 Beat Detection。
- 原生 Canvas 2D 反馈拖影、确定性粒子流场、频谱几何与 Retina DPR 适配。
- `prefers-reduced-motion` 动画降级。
- 响应式布局，支持触摸与键盘操作。

## 文件结构

```
DROP_DESTINY/
├─ index.html              # 页面入口
├─ styles.css              # 样式
├─ app.js                  # 状态管理、阶段切换、UI
├─ data.js                 # 选项、DNA、风格轮廓、锚点、合成器预设
├─ style-engine.js         # DNA 重算、风格评分、推导函数、枚举测试
├─ audio-engine.js         # Web Audio 合成引擎、调度、Collider 伴奏播放
├─ visualizer.js           # 实时音频可视化
├─ wavetables.js           # AKWF CC0 单周期波形
├─ audio-assets.js         # CC0 鼓组/Impact/Riser 采样（内嵌）
├─ ending-assets.js        # Collider 渲染的六风格结局伴奏（内嵌）
├─ spec.md                 # 产品规格书
├─ README.md               # 本文件
├─ ASSET_LICENSES.md       # 音频素材来源与许可
├─ collider/               # SuperCollider 源码（开发用，不参与运行）
│  ├─ drop-destiny-tape.scd
│  ├─ render-backing.scd
│  ├─ arrangements/        # 六风格编曲定义
│  └─ samples/             # CC0 鼓组采样源文件
├─ dev/                    # 开发工具与测试
│  ├─ style-engine-test.html   # 2304 路径枚举测试
│  ├─ regression-test.js       # 回归测试
│  ├─ audio-engine-smoke-test.js
│  ├─ test-visualizer.js
│  ├─ test-ending-integration.js
│  ├─ test-desktop-layout.js
│  ├─ build-assets.js          # 采样打包
│  ├─ build-ending-assets.js   # 结局伴奏打包
│  └─ ...
└─ exports/                # 测试运行后生成，可忽略
```

## 测试

### 风格分布测试

浏览器打开 `dev/style-engine-test.html`，运行 2304 路径枚举，验证风格分布满足验收范围。

### 回归测试

```bash
node dev/regression-test.js
```

### 音频引擎冒烟测试

```bash
node dev/audio-engine-smoke-test.js
```

### 结局集成测试

```bash
node dev/test-ending-integration.js
```

### 可视化测试

```bash
node dev/test-visualizer.js
```

## 第三方素材

第三方音频采样为 CC0，字体许可证另行记录。详见 [ASSET_LICENSES.md](ASSET_LICENSES.md)。
