# DROP//DESTINY

一个引导用户完成 Bass Music 片段的浏览器音乐创作游戏。用户选择声音世界、塑造 Bass 音色、设计 Groove 与编排变化，最后编辑一小节 8-step Pattern，生成约 20–28 秒的 Build-up → Drop 作品与风格结局。

## 运行

无需安装依赖或启动服务器：

1. 下载或克隆仓库。
2. 双击 `index.html`。
3. 点击“开始创作”后开启声音。

建议使用最新版 Chrome，并佩戴耳机体验低频与实时可视化。

## 创作流程

1. Sound World：选择声音氛围。
2. Bass Forge：选择 Bass 性格并调节 Body / Growl / Wobble / Space。
3. Groove Lab：选择节奏与 Sparse / Balanced / Busy 密度。
4. Arrangement：决定 Build-up 与 Drop 后半段变化。
5. Live Drop：选择 Drop 强度并编辑一小节 8-step Sequencer。

最终可能生成 Riddim Dubstep、Brostep、Hybrid Trap、Bass House、Melodic Dubstep 或隐藏的 Destiny Fusion 结局。

## 技术

- 原生 HTML / CSS / JavaScript
- Web Audio API 合成与调度
- AnalyserNode 实时波形和频谱
- 无框架、无 CDN、无外部运行时依赖

开发用风格分布测试位于 `dev/style-engine-test.html`。
