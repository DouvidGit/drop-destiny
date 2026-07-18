# WorkBuddy 使用记录

本项目按照任务要求使用 WorkBuddy 参与开发。WorkBuddy 主要承担适合拆分、边界清晰的规格整理和初版实现任务；产品方向、试听判断、视觉取舍、代码审查与最终验收由我持续参与，并结合 Codex 进行多轮修正。

## 使用过程

| 阶段 | 交给 WorkBuddy 的任务 | WorkBuddy 产出 | 人工审查与后续修正 |
| --- | --- | --- | --- |
| 产品规格 | 将创意整理成 `spec.md`，定义阶段、DNA、风格判定、MVP 范围与验收标准 | 完成初版规格和文件规划 | 实际试玩后把重心从连续选择题转向 Bass Forge，并删除 Pattern / Arrangement UI；规格同步为当前六屏流程 |
| 初版工程 | 根据规格搭建原生 HTML / CSS / JavaScript 流程、状态和风格判定 | 形成可离线运行的初版网站 | 逐页审查交互，重做声音、布局、视觉与结果页；补充自动测试 |
| 风格分布 | 调整风格判定并验证 2304 组内部状态 | 让六种结局均可到达 | 保留枚举测试作为内部验收，但不把 Structure / Variation / Impact 重新做成用户选择题 |
| 歌曲结构 | 将早期多段流程改为一个完整 Build-up 与 Drop | 完成 14 小节歌曲结构的初版改造 | 后续统一为 2 小节 Intro、3 小节 Build、1 小节 Pre-drop、4 小节 Drop A、3 小节 Drop B、1 小节 Final，并修正用户主 Bass 的进入和结束位置 |
| 项目文档 | 更新 README、spec，并生成 Dead Code Audit | 提供文档和可删除项清单 | 对审计结果逐项复核，发现其中 `playPattern()` 调用关系判断已过时；最终只保留经验证的清理记录 |
| 本地字体 | 将 Teko 转为 WOFF2，加入许可证并替换旧字体引用 | 完成本地字体嵌入 | 检查断网 `file://` 加载，补充许可证与提交包说明 |

## 证据截图

- [01-spec-generation.png](workbuddy/01-spec-generation.png)：WorkBuddy 生成初版 `spec.md`。
- [02-song-structure.png](workbuddy/02-song-structure.png)：WorkBuddy 将最终歌曲整理为单次 14 小节结构。
- [03-local-font.png](workbuddy/03-local-font.png)：WorkBuddy 嵌入 Teko WOFF2 并附带 SIL OFL。

## 协作反思

WorkBuddy 很适合先产出结构化草稿和执行明确的局部改动，但音乐听感、界面气质和交互重心无法只靠一次提示确定。这个项目中，多次关键改进都来自试玩后的具体反馈，例如重新平衡鼓、Bass、和弦与辅助声部，改用真实结局伴奏，以及把无实际影响的操作从界面移除。AI 的输出不是最终答案，而是需要被验证、取舍和继续迭代的开发材料。
