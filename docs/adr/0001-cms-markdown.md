# ADR 0001：B2B Markdown 消费与英语回退

状态：采用，2026-10-30（B-03-06）。

Strapi 的 b2b-home 仅增加可选 localized `bodyMarkdown`，类型 richtext（Rich Text Markdown）；原 headline/description 和站点语言不变。Adapter 将正文保留为可选 string|null，旧响应缺键可以省略，数字/对象等非法类型阻断。个人站 CMS 模型不变。

在现有 resolveHome 中逐字段处理 Markdown，与 description 使用相同规则：本地有效正文优先；本地字段空/缺失且英语有效时 missing-field 回退；目标整项缺失使用 missing-entry；两端都缺失时不渲染、不计分母。英语没有该可选字段而本地有时仍显示本地，但不计入英语覆盖分母。HTTP/认证/协议类型错误仍阻断。Legacy 响应未包含该字段时保持原有两个字段报告契约。

正文在 Astro SSG 模板中通过本站 renderMarkdown() 转换，仅安全输出进入 set:html。固定 markdown-it 14.1.0，html:false，保留默认危险 URL 校验；原始 HTML 转义而不执行，不启用额外插件或客户端运行时。字段来源 lang、fallback 和 reason 包裹于 section。

英语正文有效后，当前非英语启用语言为 ar/de/fr/zh-CN，英语显示字段由 2→3；分母 4×3=12。既有 headline/description 的 6 个译文字段保留，其他本地 Markdown 均未录入，法语整项仍缺失，所以 6/12=50%（原 6/8=75%）。新增 4 个有效回退字段不应被计成译文。报告 warning 允许构建成功。

独立仓库分别维护同样的安全策略，不引入共享包、Monorepo、正式 UI 或产品模型。新增数据在变更前后都用 B-02 工具保存匹配 Schema 的恢复点。
