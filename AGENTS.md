# AGENTS.md

This is a DeepSeek Harness plugin.

## Directory structure

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
    settings.ts             configForms 句柄 + 旧 localStorage 的一次性迁移
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
cordis.dev.yml              --patch 开发覆盖层（绝对路径，本机专用）
cordis.patch.yml            profile patch 层（包名引用）
package.json                包清单 + dsh 声明
README.md                   完整文档
```
