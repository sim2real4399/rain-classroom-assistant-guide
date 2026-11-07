# 考试 / 试卷页面指南

适用范围：课程允许 AI 辅助的练习、模拟测验和试卷复习，按课程规则确定使用场景。

## 工具与域名

本仓库作业脚本只匹配 *.yuketang.cn，不在 examination.xuetangx.com 加载。仅添加域名仍需适配题面、选项和按钮。

此处使用独立项目 [soundstarrain/yuketang-assistant](https://github.com/soundstarrain/yuketang-assistant)，扩展匹配 *.yuketang.cn 与 *.xuetangx.com，并对 result 试卷查看页单独处理。

## 安装

随仓库分发的是此前核对的 1.3.0 源码。

1. 从[仓库下载扩展源码包](https://raw.githubusercontent.com/sim2real4399/rain-classroom-assistant-guide/main/exam-extension-1.3.0.zip)，解压。
2. 找到包含 manifest.json 的目录。
3. 打开 edge://extensions/ 或 chrome://extensions/。
4. 按界面开启开发者模式，点击「加载解压缩的扩展」。
5. 选择含 manifest.json 的目录，安装后保留该目录。
6. 在工具栏固定「雨课堂考试助手」图标。

这里加载浏览器扩展目录，不在油猴导入 .user.js。

## 提取与配置

1. 在目标题目 / 试卷页，点击浏览器工具栏的扩展图标。
2. 在新标签页核对题干、选项与题目数量。
3. 点「API配置」填写：

    API URL：https://api.deepseek.com
    API Key：自己申请的有效 Key
    Model：deepseek-flash

4. 保存后先测试一道文字题的「AI解答」。
5. 确认正常再决定使用批量解答。

## 回填与提交

原项目提供「导出Prompt」「导入解题结果」工作流。导出带格式约束的 Prompt，把模型 JSON 导入后核对原页的选择状态。原项目说明回填不会自动提交，交卷自己确认。出现解析结果不代表原页已完成回填。

## 图片题限制

核对的扩展 1.3.0 在直接单题和批量请求中使用文本 content，images 初始化为空。页面能显示图片不代表 AI 收到图片。

可检查「导出Prompt」是否包含题图，再交给支持识图的模型；不要宣传当前直接 AI 按钮覆盖所有图片题。后续版本见上游项目。

## 校验与报错

安全校验人工完成，不提供自动验证步骤。JSON 解析错误先对照 [配置与排错](02-model-and-troubleshooting.md)，特别检查 API URL 是否填成完整接口地址。

本仓库不承诺第三方扩展在任何特定试卷上均可运行。
