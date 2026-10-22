# dsh-ai-approval-review

> DeepSeek Harness 插件：会话处于「工作区内修改」（workspace-write）时，把提权申请同时交给模型审核，只返回 `{safe, reason}`；审核期间「允许」按钮显示加载环且不可点，判为不安全时再锁定 N 秒（默认 3 秒）。**最终决定权仍在人，不会自动放行。**

```
审批卡出现
  ├─ 显示待审操作（工具名 + 参数）
  ├─ POST /api/ai-approval-review/action   ← 确认会话 preset、取回操作预览
  ├─ POST /api/ai-approval-review/review   ← 模型只返回 {"safe": bool, "reason": string}
  │    「允许」按钮：加载环 + 禁用
  ├─ safe=true   → 立即解锁「允许」，显示绿色结论
  └─ safe=false  → 红色结论 + 倒计时，N 秒后才可点「允许」
      审核失败/超时/JSON 不合法 → 同样倒计时（防误点），可在设置里把 N 设为 0 关闭
```

## 设置

**设置 → AI 审批审核**（独立设置页，不依赖 DSH 的插件配置表单）：

| 设置项 | 默认 | 说明 |
|---|---|---|
| 启用 AI 审核 | 开 | 关闭后立即回退到 DSH 原生审批面板 |
| 审核模型 | 当前会话模型 | 可选任意已登记 provider/model；留空跟随当前会话 |
| 不安全时锁定时长 | 3 秒 | 0–30；0 表示结论不锁定按钮 |
| 审核提示词 | 内置 | 可完全自定义；JSON 输出契约由插件固定追加，不受影响 |
| 测试审核 | — | 用内置样例跑一次真实模型调用，验证模型/凭据 |

设置保存在**当前浏览器**的 `localStorage`（key `dsh-ai-approval-review:v1`），不会写入 DSH 配置。

## 安装

```sh
# 在插件的父目录执行（dsh plugin add 的相对路径锚定调用目录）
cd C:\Users\dynas\Documents\Code
dsh plugin --profile desktop add ./dsh-anti-blind-approval

# 然后重启桌面端，或刷新 Web 页面
```

卸载：

```sh
dsh plugin --profile desktop remove dsh-ai-approval-review
```

## 行为与边界

- **只接管 `workspace-write` 会话**。`read-only` / `danger-full-access` / `custom` 会话不受影响（宿主侧会再校验一次 preset）。
- **只审核，不替你决定**。审核通过 = 解锁按钮；审核不通过 = 锁 N 秒，之后仍可人工允许。
- **审核内容是事实**：工具名、`callId` 对应的已记录参数、审批 reason、cwd。插件不执行任何命令，也不往会话日志里写东西。
- **失败也锁**：超时（90s）、无可用模型、模型返回非 JSON，都会按“不可用”处理并倒计时；把锁定时长设为 0 可只提示不锁定。
- **审核调用不计入会话 token**：它是插件发起的附加模型请求，不会出现在会话日志/上下文里。
- **同一审批结果会短缓存**：页面内重复挂载不会重复调用模型（最多缓存 64 条）。

## 架构

```
lib/index.js    宿主半（ESM，无第三方依赖）
  ├─ POST /api/ai-approval-review/action    preset 判定 + 待审操作预览（不调模型）
  ├─ POST /api/ai-approval-review/review    调 ctx.llm.stream，严格解析 {safe, reason}
  ├─ GET  /api/ai-approval-review/catalog   provider/model 列表 + 内置提示词
  └─ POST /api/ai-approval-review/test      合成样例的连通性测试
lib/client.js   浏览器半（模块加载器格式，仅依赖 react / ui-primitives）
  ├─ conversation.composer  priority 0 接管审批面板（原生面板是 priority 1）
  └─ settings.section      「AI 审批审核」设置页
```

宿主路由通过 `ctx.connection.fetch.register()` 注册，走 DSH 已有的 `/api` 认证与 Host/Origin 防护，不另开端口。

## 验证

```sh
node test/host.test.mjs      # 假 ctx + 假模型流：路由、preset、JSON 解析、错误码
node test/client.test.mjs    # 假 loader/React：模块注册、面板/设置页初始渲染
```

已在隔离 `DSH_HOME` 的真实 web profile 中验证：

- 插件可安装、进入 `--dump-config` 配置层；
- 客户端 bundle 出现在 boot graph 并可按 `/plugins/...` 加载；
- `/api/ai-approval-review/catalog` 在浏览器 Cookie 认证后返回 200；
- `/api/ai-approval-review/test` 在无凭据的隔离 profile 中返回 `NO_MODEL`（符合预期）。

**未验证**：无头浏览器被本机沙箱拦截，因此“真实浏览器里点开审批卡”的最终交互没有自动化跑过；首次使用请先点一次设置页的「测试审核」。

## 已知限制

- 替换 `conversation.composer` 依赖 DSH 的 slot 链契约（priority 升序、首个非空 select 胜出）。DSH 改版若调整该契约，关掉「启用 AI 审核」即可立即回退原生面板。
- 设置是浏览器本地的；换浏览器/机器需要重设。
- 审核由浏览器面板触发，所以 headless/无 UI 的场景没有这层审核。
- LLM 判断可能出错：这是防“盲点允许”的辅助层，不是安全保证。
- 自定义提示词会连同待审参数一起发给审核模型，注意其中可能含敏感内容。
