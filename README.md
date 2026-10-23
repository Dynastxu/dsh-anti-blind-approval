# 反盲批 (Anti Blind Approval)

> DeepSeek Harness 插件：会话处于「工作区内修改」（workspace-write）时，把提权申请同时交给模型审核，只返回 `{safe, reason}`；审核期间「允许」按钮显示加载环且不可点，判为不安全时再锁定 N 秒（默认 3 秒）。**最终决定权仍在人，不会自动放行。**

> 界面显示名：**反盲批 / Anti Blind Approval**。包标识与仓库/文件夹同名：`dsh-anti-blind-approval`，安装、卸载和命令里用这个包名。

```
审批卡出现
  ├─ 显示待审操作（工具名 + 参数）
  ├─ POST /api/anti-blind-approval/action   ← 确认会话 preset、取回操作预览
  ├─ POST /api/anti-blind-approval/review   ← 模型只返回 {"safe": bool, "reason": string}
  │    「允许」按钮：加载环 + 禁用
  ├─ safe=true   → 立即解锁「允许」，显示绿色结论
  └─ safe=false  → 红色结论 + 倒计时，N 秒后才可点「允许」
      审核失败/超时/JSON 不合法 → 同样倒计时（防误点），可在设置里把 N 设为 0 关闭
```

## 设置

**设置 → 反盲批**（独立设置页，不依赖 DSH 的插件配置表单）：

| 设置项 | 默认 | 说明 |
|---|---|---|
| 启用 AI 审核 | 开 | 关闭后立即回退到 DSH 原生审批面板 |
| 审核模型 | 当前会话模型 | 可选任意已登记 provider/model；留空跟随当前会话 |
| 不安全时锁定时长 | 3 秒 | 0–30；0 表示结论不锁定按钮 |
| 审核提示词 | 内置（英文） | 可完全自定义；`{language}` 会替换为用户界面语言；JSON 输出契约由插件固定追加，不受影响 |
| 测试审核 | — | 用内置样例跑一次真实模型调用，验证模型/凭据 |

设置保存在**当前浏览器**的 `localStorage`（key `dsh-anti-blind-approval:v1`），不会写入 DSH 配置。

## 源码与构建

插件用 TypeScript 编写，`lib/` 是构建产物，并随仓库一起提交：从 GitHub 安装时只是取源码包，构建产物必须在仓库里。改了 `src/` 之后必须重新构建并提交 `lib/`，否则安装方加载的仍是旧代码。

```
src/
├── index.ts          宿主入口：name / inject / apply，注册四条路由
├── routes.ts         路由处理：preset 判定、请求体字段校验、错误码
├── review.ts         一次审核：路由解析、事实裁剪、模型流、严格 JSON verdict
├── prompt.ts         内置 policy、固定输出契约、{language} 替换
├── contract.ts       两个半共享的路由前缀
├── types.ts          两端共享的线上契约（纯类型）
├── util.ts           isRecord / clip / 品牌转换
└── client/
    ├── index.ts      apply：样式、词典、两个 slot 注册
    ├── ApprovalPanel.tsx    审批卡（conversation.composer，priority 0）
    ├── SettingsSection.tsx  设置页（settings.section）
    ├── settings.ts          localStorage 读写
    ├── locales.ts           zh / en 词典 + 错误码映射
    ├── http.ts              /api 请求与 HttpError
    ├── styles.ts            注入到 <style> 的样式表
    └── tsconfig.json        编辑器用的浏览器面锚点
```

在本仓库里开发时，用仓库根目录的工具链（插件目录本身没有 `node_modules`）：

```sh
cd dsh-anti-blind-approval
pnpm run typecheck:repo    # tsc -p tsconfig.json + tsconfig.client.json
pnpm run build:repo        # tsdown：src/index.ts → lib/index.js，src/client/index.ts → lib/client.js
pnpm test                  # 三个 node 测试：路由、浏览器半、真实 Cordis 组合
```

插件单独安装了自己的依赖时（例如把它移出本仓库后 `pnpm install`），改用标准脚本 `pnpm run typecheck` / `pnpm run build`。这里刻意不设 `prepare`：pnpm 会为 git 依赖执行 `prepare`，而它默认拒绝执行未列入 `allowBuilds` 的依赖脚本，安装会直接失败（`ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`）；产物已经提交，安装方不需要现场构建。

### 两个编译面

`tsconfig.json`（Node，无 DOM）和 `tsconfig.client.json`（浏览器，React JSX）分开，避免任一面带进另一面的全局类型。两面的 `paths` 只把 `@deepseek-ai/*` 指到各包**已发布的声明**（`lib/types`），因此类型检查针对的就是运行时实际安装的 API，与仓库内部的源码别名无关。

`lib/client.js` 由 `tsdown.config.ts` 产出为客户端模块表要求的闭包工厂格式（`window.__ModuleLoader__.load({ id, factory })`）：`react`、`react/jsx-runtime`、`@deepseek-ai/dsh-client-ui-primitives` 保持为模块表请求，其余全部内联。宿主半没有任何运行时 import，产物完全自包含。

## 带着插件跑 Web（不装 profile）

源码 checkout 里用 `--patch` 覆盖层即可，不用改 profile、不用 `pnpm install`：

```sh
cd C:\Users\dynas\Documents\Code\deepseek-harness

# 1) 构建插件（改了 src 之后都要重建；客户端半是 lib/client.js，缺失会启动失败）
cd dsh-anti-blind-approval && pnpm run build:repo && cd ..

# 2) 启动（启动器 flag 必须在 app 名之前；`dsh web --patch …` 会把 --patch 丢给 web 应用并报错）
pnpm dsh --profile web --patch ./dsh-anti-blind-approval/cordis.dev.yml
```

`cordis.dev.yml` 里插一行、`name` 指向 `lib/index.js` 的绝对路径：`--patch` 覆盖层不走 profile 的模块解析，所以**不能用包名**（本仓库不是 pnpm workspace 成员，裸包名解析不到）。这个文件是本机开发用的，换机器/换目录要改路径。

浏览器半不需要单独的行：`dsh-client-modules` 按行解析到**最近的 `package.json`**，读它的 `dsh.client` 声明，再服务它的 `./client` 导出。

已验证的组合（隔离 `DSH_HOME`、闲置端口）：

- `--dump-config` 末尾出现 `# == …cordis.dev.yml` 层与我们的行；
- `GET /api/anti-blind-approval/catalog` → 200，返回 provider 列表与内置提示词（宿主半已激活）；
- 启动页 boot graph 的脚本批次里含 `dsh-anti-blind-approval/client.js`，拉下来的 200 响应里有 `window.__ModuleLoader__.load({ id: "dsh-anti-blind-approval", … })`。

## 安装进 profile（长期使用）

```sh
cd C:\Users\dynas\Documents\Code\deepseek-harness

# 装进某个 profile（会改该 profile 的 package.json 与 bundles 列表，需要 pnpm 可用）
pnpm dsh plugin --profile web add ./dsh-anti-blind-approval
pnpm dsh --profile web

# 然后重启桌面端，或刷新 Web 页面
```

改动源码后：`pnpm run build:repo`，再刷新 Web 页面（正在运行的 Host 不会重新读 `lib/index.js`，宿主变更需重启）。

从 GitHub 直接安装同样不需要改 `allowBuilds`：仓库里带着 `lib/`，而且没有 `prepare`/`install`/`postinstall` 脚本，pnpm 不会要求授权执行任何依赖脚本。spec 里建议带 commit 固定同一份产物（`#main` 则跟随主分支）：

```sh
pnpm dsh plugin --profile desktop add github:Dynastxu/dsh-anti-blind-approval#main
```

改动 `src/` 之后要重新提交 `lib/` 再推送，否则安装方拿到的是旧产物。

卸载：

```sh
pnpm dsh plugin --profile web remove dsh-anti-blind-approval
```

## 行为与边界

- **只接管 `workspace-write` 会话**。`read-only` / `danger-full-access` / `custom` 会话不受影响（宿主侧会再校验一次 preset）。
- **审核提示词是英文，结论语言跟随用户**。内置 policy 与 JSON 输出契约均为英文，其中含有 `{language}` 占位符：面板把当前 locale（`ctx.locale` 的 `active`，如 `zh`、`en-US`）作为 `userLanguage` 发出，宿主替换成人类可读的标签（如 `Chinese (zh)`、`English`）再送给模型，所以 `reason` 不会被提示词语言带偏。缺失/非法 tag 时退回 `English`。自定义提示词里同样可以用 `{language}`。
- **只审核，不替你决定**。审核通过 = 解锁按钮；审核不通过 = 锁 N 秒，之后仍可人工允许。
- **审核内容是事实**：工具名、`callId` 对应的已记录参数、审批 reason、cwd。插件不执行任何命令，也不往会话日志里写东西。
- **失败也锁**：超时（90s）、无可用模型、模型返回非 JSON，都会按“不可用”处理并倒计时；把锁定时长设为 0 可只提示不锁定。
- **审核调用不计入会话 token**：它是插件发起的附加模型调用，不会出现在会话日志/上下文里。
- **同一审批结果会短缓存**：缓存挂在插件实例上（经注入面交给面板），重复挂载不会重复调用模型（最多缓存 64 条）。

## 架构

```
lib/index.js    宿主半（ESM，无运行时 import）
  ├─ POST /api/anti-blind-approval/action    preset 判定 + 待审操作预览（不调模型）
  ├─ POST /api/anti-blind-approval/review    调 ctx.llm.stream，严格解析 {safe, reason}
  ├─ GET  /api/anti-blind-approval/catalog   provider/model 列表 + 内置提示词
  └─ POST /api/anti-blind-approval/test      合成样例的连通性测试
lib/client.js   浏览器半（模块加载器格式，仅 require react / react-jsx-runtime / ui-primitives）
  ├─ conversation.composer  priority 0 接管审批面板（原生面板是 priority 1）
  └─ settings.section       「反盲批」设置页
```

宿主路由通过 `ctx.connection.fetch.register()` 注册，走 DSH 已有的 `/api` 认证与 Host/Origin 防护，不另开端口；`connection` 缺失时插件照常加载、不注册路由，面板探测到 404 就回退原生面板。

## 验证

```sh
node test/host.test.mjs          # 假 ctx + 假模型流：路由、preset、JSON 解析、错误码、裁剪
node test/client.test.mjs        # 假 loader/React：模块注册、面板/设置页渲染、请求体断言
node test/composition.test.mjs   # 真实 Cordis Context：服务依赖决定激活、无 connection 时零路由
```

`composition.test.mjs` 加载的是仓库内 `vendor/cordis` 的运行时，因此校验的是真实的 `inject` 门控与激活时机，而不是手搭的假 ctx。路由的销毁由 Host Connection 服务在调用方 fiber 的 effect 里负责（`register()` 返回的 disposer 属于该 fiber），插件只负责提交路由。

已在隔离 `DSH_HOME` 的真实 web profile 中验证过（改造前的 JS 版）：插件可安装、进入 `--dump-config` 配置层、客户端 bundle 出现在 boot graph 并可经 `/plugins/...` 加载、`/catalog` 与 `/test` 在浏览器 Cookie 认证后可达。

**未验证**：改造后没有再次在真实 profile 里安装运行（本机 pnpm 安装受沙箱限制）；“真实浏览器里点开审批卡”的最终交互仍未自动化，首次使用请先点一次设置页的「测试审核」。

## 已知限制

- 替换 `conversation.composer` 依赖 DSH 的 slot 链契约（priority 升序、首个非空 select 胜出）。DSH 改版若调整该契约，关掉「启用 AI 审核」即可立即回退原生面板。
- `conversation.composer` 的 `select` 与设置页都直接读 `localStorage`，多标签页之间不会互相同步。
- 设置是浏览器本地的；换浏览器/机器需要重设。
- 审核由浏览器面板触发，所以 headless/无 UI 的场景没有这层审核。
- LLM 判断可能出错：这是防“盲点允许”的辅助层，不是安全保证。
- 自定义提示词会连同待审参数一起发给审核模型，注意其中可能含敏感内容。
