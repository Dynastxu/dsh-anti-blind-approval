<p align="center">
  <img src="icon.svg" alt="icon" width="30%"> 
</p>
<h1 align="center">反盲批</h1>

<p align="center">
  <a href="LICENSE">
    <img alt="MIT" src="https://img.shields.io/badge/LICENSE-MIT-blue">
  </a>
</p>

<p align="center">
  <a href="https://www.deepseek.com/harness/">
    <img alt="DeepSeek Harness" src="https://img.shields.io/badge/DeepSeek-Harness-1B1B1C?logo=deepseek&logoColor=white&labelColor=5f6df5">
  </a>
  <a>
    <img alt="WebStorm" src="https://img.shields.io/badge/WebStorm-blue?logo=webstorm">
  </a>
  <a>
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white">
  </a>
</p>

<p align="center">
  中文 ｜
  <a href="README.en.md">English</a>
</p>

## 简介

DeepSeek Harness 插件：防止用户盲目地批准模型的提权请求

仅在会话处于「工作区内修改」（workspace-write）时生效。仅提出建议，**不自动放行**。

## 安装

在安装页面中输入 `@dynastxu/dsh-anti-blind-approval` 或 `https://github.com/Dynastxu/dsh-anti-blind-approval` 即可安装。

## 界面预览
### 审核通过
![allow.png](docs/imgs/allow.png)
### 审核未通过
![deny.png](docs/imgs/deny.png)

## 设置

| 设置项 | 默认 | 说明 |
|---|---|---|
| 启用 AI 审核 | 开 | 关闭后立即回退到 DSH 原生审批面板 |
| 审核模型 | 当前会话模型 | 可选任意已登记 provider/model；留空跟随当前会话 |
| 不安全时锁定时长 | 3 秒 | 0–30；0 表示结论不锁定按钮 |
| 审核超时时间 | 10 秒 | 5000–300000ms；单次审核的最大耗时，超时判定为失败 |
| 审核提示词 | 内置（英文） | 可完全自定义；`{language}` 会替换为用户界面语言；JSON 输出契约由插件固定追加，不受影响 |
| 测试审核 | — | 用内置样例跑一次真实模型调用，验证模型/凭据 |

这些字段是宿主侧插件 `Config` 的 `.volatile()` 字段，由 `@deepseek-ai/dsh-settings` 投影成浏览器表单，浏览器半通过 `ctx.configForms` 读取和写入；写入落在**当前 profile 的 `cordis.patch.yml`**，保存后立即生效，所有浏览器共享，也可以用 `cordis.yml` 直接提供：

```yaml
- id: dsh-anti-blind-approval
  name: 'dsh-anti-blind-approval'
  config:
    enabled: true
    model: 'deepseek-account::deepseek-flash'   # 留空跟随当前会话
    delaySeconds: 3                             # 0 表示不锁定
    prompt: ''                                  # 留空使用内置提示词
    reviewTimeoutMs: 10000                      # 10 秒超时
```

## 源码与构建

插件用 TypeScript 编写，`lib/` 是构建产物，并随仓库一起提交：从 GitHub 安装时只是取源码包，构建产物必须在仓库里。改了 `src/` 之后必须重新构建（`pnpm run build`）并提交 `lib/`，否则安装方加载的仍是旧代码。

```
src/                        TypeScript sources
  index.ts                  宿主入口：name / inject / apply / Config，注册四条路由
  config.ts                 宿主 Config：四个 .volatile() 字段，settings 据此生成表单
  settings-shared.ts        两端共享的 entry id、取值范围与归一化（无运行时依赖）
  routes.ts                 路由处理：preset 判定、请求体字段校验、错误码
  review.ts                 一次审核：路由解析、事实裁剪、模型流、严格 JSON verdict
  prompt.ts                 内置 policy、固定输出契约、{language} 替换
  contract.ts               两个半共享的路由前缀
  types.ts                  两端共享的线上契约（纯类型）
  util.ts                   isRecord / clip / 品牌转换
  client/                   浏览器半（React）
    index.ts                apply：样式、词典、configForms 句柄、两个 slot 注册
    ApprovalPanel.tsx       审批卡（conversation.composer，priority 0）
    SettingsSection.tsx     设置页（settings.section），读写 profile 配置
    settings.ts             configForms 句柄
    locales.ts              zh / en 词典 + 错误码映射
    http.ts                 /api 请求与 HttpError
    styles.ts               注入到 <style> 的样式表
    tsconfig.json           编辑器用的浏览器面锚点
lib/                        构建产物（随仓库提交）
  index.js                  宿主半 ESM（仅 import @deepseek-ai/schemastery）
  client.js                 浏览器半（window.__ModuleLoader__ 闭包工厂格式）
test/                       测试
  host.test.mjs             假 ctx + 假模型流：路由、preset、JSON 解析、错误码
  client.test.mjs           假 loader/React/configForms：面板、设置页、配置写入
  composition.test.mjs      真实 Cordis Context：服务依赖、激活门控、settings 策略
tsconfig.json               Node 编译面（ES2024，无 DOM）
tsconfig.client.json        浏览器编译面（ES2024，React JSX）
tsdown.config.ts            构建配置：src/index.ts → lib/index.js，src/client/ → lib/client.js
cordis.patch.yml            profile patch 层（包名引用）
package.json                包清单 + dsh 声明
README.md                   完整文档
```

## 行为与边界

- **只接管 `workspace-write` 会话**。`read-only` / `danger-full-access` / `custom` 会话不受影响（宿主侧会再校验一次 preset）。
- **审核提示词是英文，结论语言跟随用户**。内置 policy 与 JSON 输出契约均为英文，其中含有 `{language}` 占位符：面板把当前 locale（`ctx.locale` 的 `active`，如 `zh`、`en-US`）作为 `userLanguage` 发出，宿主替换成人类可读的标签（如 `Chinese (zh)`、`English`）再送给模型，所以 `reason` 不会被提示词语言带偏。缺失/非法 tag 时退回 `English`。自定义提示词里同样可以用 `{language}`。
- **只审核，不替你决定**。审核通过 = 解锁按钮；审核不通过 = 锁 N 秒，之后仍可人工允许。
- **审核内容是事实**：工具名、`callId` 对应的已记录参数、审批 reason、cwd。插件不执行任何命令，也不往会话日志里写东西。
- **失败也锁**：超时（默认 10s，可在设置页调整，范围 5–300s）、无可用模型、模型返回非 JSON，都会按"不可用"处理并倒计时；把锁定时长设为 0 可只提示不锁定。
- **审核调用不计入会话 token**：它是插件发起的附加模型调用，不会出现在会话日志/上下文里。
- **同一审批结果会短缓存**：缓存挂在插件实例上（经注入面交给面板），重复挂载不会重复调用模型（最多缓存 64 条）。
- **配置是 profile 级的**：设置页的写入落在当前 profile 的 `cordis.patch.yml`，由 config-editor 校验后热更新；同一 profile 的所有浏览器立即看到同一份值，手工编辑 `cordis.yml` 也等效。

## 已知限制

- 替换 `conversation.composer` 依赖 DSH 的 slot 链契约（priority 升序、首个非空 select 胜出）。DSH 改版若调整该契约，关掉「启用 AI 审核」即可立即回退原生面板。
- 设置页依赖 ui-settings 提供的 `ctx.configForms`；在禁用 ui-settings 的客户端组合里插件不会接管审批面板。
- 审核由浏览器面板触发，所以 headless/无 UI 的场景没有这层审核。
- LLM 判断可能出错：这是防“盲点允许”的辅助层，不是安全保证。
- 自定义提示词会连同待审参数一起发给审核模型，注意其中可能含敏感内容。
