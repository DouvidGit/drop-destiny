# DROP//DESTINY

一个以 Bass 音色塑造为核心的浏览器音乐创作游戏。用户依次选择声音世界、Bass 核心与节奏骨架，然后进入真正的合成器工作台；最终曲风、编排倾向与 Drop 强度由用户的真实合成参数自动推导。

## 运行

无需安装依赖或启动服务器：

1. 下载或克隆仓库。
2. 双击 `index.html`。
3. 点击“开始创作”后开启声音。

建议使用最新版 Chrome，并佩戴耳机体验低频与实时可视化。普通步骤使用电影宽银幕视觉，Bass Forge 会把同一块实时画面嵌入合成器中央开窗；`AUTO` 可循环切换 Shred / Bunker / Fracture 手动模式，`⛶` 可进入全屏。

## 创作流程

1. Sound World：选择声音氛围。
2. Bass Core：选择 Bass 的原始核心性格。
3. Rhythm Chassis：选择节奏家族与 Sparse / Balanced / Busy 密度。
4. Bass Forge：在双振荡器中调节 Wavetable / Osc B、Mix、Detune、FM、Drive、Filter Envelope、Amp Envelope、同步 LFO、Sub 与 Space。

Drive 同时控制音频失真与视觉热度；结构、变奏和 Drop 强度不再作为选择题，而由上述参数自动派生。

最终可能生成 Riddim Dubstep、Brostep、Hybrid Trap、Bass House、Melodic Dubstep 或隐藏的 Destiny Fusion 结局。

## 技术

- 原生 HTML / CSS / JavaScript
- Web Audio API 合成与调度
- CC0 AKWF 单周期波形与 FM Bass 合成
- CC0 采样鼓组、Impact、Riser 与 Kick Sidechain
- 分流派主 Bass 与 Reese / Vowel / Metallic / 808 Glide / Donk 辅助音色
- 逐音 Bass 音高、时值、Filter / FM / Wobble articulation 与 A/B 节奏乐句
- Melodic Dubstep Supersaw 扩展和弦、Saw Lead、回应旋律与稀疏 Bass 点缀
- 六套分流派 Kick / Snare 处理与六个独立 CC0 闭镲采样，并为 House / Trap / Melodic 配置不同开镲
- 分流派 Hat 网格、House Offbeat Open Hat、Trap Hat Roll、Riddim Triplet Fill 与 Dubstep Tom Fill
- Drum / Bass / Harmony / Lead / FX 五总线动态混音与 Kick Sidechain
- 双振荡器 Mix / Detune、Amp Attack / Release、Filter Envelope 与可选 LFO Shape / Destination
- Arp / Pluck / Screech 配器、Crash、Reverse Swell 与多段转场
- AnalyserNode 对数频段、波形 RMS、Attack / Release 平滑与自适应 Beat Detection
- 原生 Canvas 2D 反馈拖影、确定性粒子流场、频谱几何与 Retina DPR 适配
- Sound World、Bass Forge、Groove、Arrangement、Live Drop 分阶段视觉算法
- Riddim / Brostep / Hybrid Trap / Bass House / Melodic Dubstep / Destiny Fusion 六套结局视觉
- 最终歌曲 Intro / Build / Pre-drop / Drop A / Drop B / Outro 实时场景切换
- 红黑海报式分页界面、封面鼠标锯齿 Glitch 与 Bass Forge 中央方形视觉开窗
- 无框架、无 CDN、无外部运行时依赖

开发用风格分布测试位于 `dev/style-engine-test.html`。

第三方音频素材来源和许可见 [ASSET_LICENSES.md](ASSET_LICENSES.md)。
