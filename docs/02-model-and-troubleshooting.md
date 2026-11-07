# DeepSeek 配置与报错排查

核对日期：2026-10-29。模型名称和字段以后续 [官方文档](https://api-docs.deepseek.com/)为准；API 额度和费用在自己的开放平台账户查看。

## 作业脚本：模型设置

| 字段 | 示例 |
| --- | --- |
| 接口地址 | https://api.deepseek.com/chat/completions |
| API Key | 自己申请的有效 Key，不填示例占位符 |
| 模型名称 | deepseek-flash |
| 接口格式 | OpenAI Chat Completions |
| 鉴权方式 | Bearer Token，或确认识别正确的自动模式 |
| 最大 Token | 可先填 8192 测试，按返回再调整 |
| 流式输出 | 初次排查可关闭，稳定后再决定 |

当前脚本的模型名识别未覆盖 deepseek-flash，CoT 开关不能据此证明官方 thinking 已关闭。输出预算耗尽或超时需结合实际返回分析，不宜无限重试。

## 考试扩展：API配置

| 字段 | 示例 |
| --- | --- |
| API URL | https://api.deepseek.com |
| API Key | 自己申请的有效 Key |
| Model | deepseek-flash |

该扩展拼接 config.url + '/chat/completions'，因此填基础地址，末尾不加斜杠，避免重复路径。

核对的扩展请求未设置 stream: true，界面没有对应流式开关；其 max_tokens: 50000 是源码实现，不代表界面有相同字段。不要照搬另一款工具的开关步骤。

## 报错排查

| 现象 | 可能原因 | 优先检查 |
| --- | --- | --- |
| Unexpected end of JSON input | HTTP 响应为空、截断，或把非 JSON 当 JSON 解析 | URL、Network 中 HTTP 状态码和 Response |
| 401 / 403 | Key、权限或账户状态等 | 开放平台与实际响应 |
| 404 | 地址错误、重复路径或模型路由问题 | 是否重复拼接 /chat/completions |
| 429 | 限流或配额 | 停止批量，降低并发，按返回稍后重试 |
| 请求超时 | 网络、拥塞、输出耗时、题图体积等 | 先单题测试，检查网络与返回 |
| 空响应 / 格式错误 | 输出字段为空、预算不足、格式不符等 | content、finish_reason、HTTP 状态 |
| 图片题答非所问 | 模型未收到图片或截图 / 提取有误 | 请求中是否确实有图片输入 |

错误信息只是线索，不能单凭 JSON 错误认定 Key 或模型有问题。

## 反馈与数据

可提供：工具 / 浏览器版本、页面域名与不含私人参数的路径、状态码、打码后的配置和错误截图。不要公开真实 Key、Authorization、Cookie、学号或私人试卷。配置截图遮住密钥。

作业脚本配置保存在该站点的浏览器本地存储，模型请求发往配置的 URL，更换浏览器配置文件、域名或工具时不一定共享。第三方扩展的数据处理以其 [隐私说明](https://github.com/soundstarrain/yuketang-assistant/blob/080a364716d7eafa547249e1629a7f5febb435cc/PRIVACY.md)和代码为准。

DeepSeek 网页聊天和开放平台 API 是不同入口；使用接口需申请自己的 Key 并确认可调用该模型。

## 参考

- [DeepSeek 首次调用](https://api-docs.deepseek.com/)
- [图像理解](https://api-docs.deepseek.com/guides/vision/)
- [考试扩展请求实现](https://github.com/soundstarrain/yuketang-assistant/blob/080a364716d7eafa547249e1629a7f5febb435cc/content.js)
