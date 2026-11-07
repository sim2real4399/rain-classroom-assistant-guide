# 雨课堂作业与试卷助手

按网页地址选择工具。两套程序分别安装，模型配置也各自保存。

| 使用场景 | 下载 | 打开方式 |
| --- | --- | --- |
| 雨课堂课后作业（yuketang.cn） | [安装作业脚本 2.1.5.3](https://raw.githubusercontent.com/sim2real4399/rain-classroom-assistant-guide/main/yuketang-ComplexAutomation.user.js) | 安装 Tampermonkey 后，在作业页刷新 |
| 学堂在线考试、模拟测验、试卷查看（examination.xuetangx.com） | [下载考试扩展 1.3.0 源码包](https://raw.githubusercontent.com/sim2real4399/rain-classroom-assistant-guide/main/exam-extension-1.3.0.zip) | 解压后，在 Chrome 或 Edge 扩展管理页加载含 manifest.json 的文件夹 |

## 课后作业

1. 从 [Tampermonkey 官网](https://www.tampermonkey.net/)安装浏览器扩展，按提示开启「允许用户脚本」。
2. 点击上方「安装作业脚本」并确认安装。打开课程的课后作业页，刷新后打开助手的「模型设置」。若面板未显示，在油猴菜单点击「显示/恢复雨课堂助手面板」。
3. 填入下表的接口地址、模型名和自己的 API Key。勾选「自动作答作业与题目」和「仅作答作业」，从目标作业点「开始」。仅作业模式会跳过当前目录中已加载的视频等非作业项。
4. 遇到安全校验时手动完成验证，再刷新并重新开始。

## 考试与试卷

1. 下载上方扩展源码包，解压到一个准备保留的文件夹。
2. 打开 `chrome://extensions/` 或 `edge://extensions/`，打开开发者模式，点「加载已解压的扩展程序」，选择含 `manifest.json` 的目录。
3. 在课程允许使用辅助工具的试卷页，点浏览器工具栏的扩展图标。在打开的页面点「API配置」，填好后用一道文字题测试「AI解答」。
4. 这个版本的直接 AI 请求只发送文字。图片题使用「导出Prompt」前先核对导出内容。检查解答和回填结果后自行决定是否提交。

## DeepSeek 配置

| 字段 | 作业脚本 | 考试扩展 |
| --- | --- | --- |
| 接口地址 | `https://api.deepseek.com/chat/completions` | `https://api.deepseek.com` |
| 模型示例 | `deepseek-flash` | `deepseek-flash` |
| API Key | 在本机填写自己的 Key | 在扩展中单独填写自己的 Key |

考试扩展会自动补上 `/chat/completions`。调用模型时，题目文本或截图会发往你配置的服务商。可用模型见 [DeepSeek 官方文档](https://api-docs.deepseek.com/)。

## 教程和源码

- [安装与面板恢复](docs/01-installation.md) · [模型配置与排错](docs/02-model-and-troubleshooting.md) · [考试扩展指南](docs/03-exam-extension.md) · [九张图文教程](docs/05-visual-guide.md)
- 作业脚本基于 [Optance / nagelanping 的项目](https://github.com/nagelanping/yuketang-ComplexAutomation) 修改，采用 [GPL-3.0-only](LICENSE)。
- 考试源码包来自 [soundstarrain 的 1.3.0 对应提交](https://github.com/soundstarrain/yuketang-assistant/tree/080a364716d7eafa547249e1629a7f5febb435cc)，包内附原项目 GPLv3 许可证。浏览器安装与代码阅读使用同一个包。
- [来源及修改记录](NOTICE.md) · [文件校验值](SHA256SUMS.txt)
