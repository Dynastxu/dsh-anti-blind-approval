/**
 * Copy for the anti-blind-approval surfaces: the approval panel and the
 * settings page, plus the failure codes the Host routes return.
 * @module dsh-ai-approval-review/client/locales
 */

import type { ReviewErrorCode } from '../types.ts'

/** Dictionary namespace owned by this plugin. */
export const NS = 'ai-approval-review'

/** Simplified Chinese dictionary and key-set source of truth. */
export const zh = {
  nav: '反盲批',
  title: '反盲批',
  intro: '会话处于「工作区内修改」时，先把提权申请交给模型审核：审核期间「允许」不可点；判为不安全时再锁定一段时间。最终决定权仍在人。',
  enabled: '启用 AI 审核',
  enabledHint: '关闭后恢复原生审批面板',
  model: '审核模型',
  modelHint: '留空使用当前会话模型',
  modelCurrent: '当前会话模型（默认）',
  delay: '不安全时锁定时长（秒）',
  delayHint: '0 表示审核结果不锁定按钮',
  prompt: '审核提示词',
  promptHint: '留空使用内置英文提示词；可用 {language} 占位符，运行时替换为界面语言（如 Chinese (zh)）；JSON 输出格式由插件固定追加',
  promptReset: '恢复默认',
  promptDefault: '内置默认提示词',
  test: '测试审核',
  testing: '审核中…',
  testOk: '模型可用',
  testFail: '测试失败',
  saved: '已保存',
  catalogFail: '无法读取模型列表，将使用当前会话模型。',
  storageHint: '设置保存在当前浏览器（localStorage），不会写入 DSH 配置。',
  waiting: '等待审批',
  checking: '正在确认审批范围',
  reviewing: 'AI 审核中…',
  safe: 'AI 审核通过',
  unsafe: 'AI 审核未通过',
  error: 'AI 审核不可用',
  escalation: '工具 {toolName} 请求越权执行',
  detailAria: '审批详情',
  preview: '待审操作',
  allowOnce: '允许一次',
  reject: '拒绝',
  hold: '{seconds} 秒后可允许',
  verdictSafe: '模型判断此操作无明显安全风险，请确认后允许。',
  verdictUnsafe: '模型判断此操作存在安全风险：',
  verdictError: '审核未能完成，已按防误点策略短暂锁定：',
  'err.NO_SESSION': '找不到会话',
  'err.NO_MODEL': '没有可用的审核模型',
  'err.INVALID_OUTPUT': '模型返回格式不符合 JSON 约定',
  'err.TIMEOUT': '审核超时',
  'err.LLM_ERROR': '模型调用失败',
  'err.LLM_NO_FINISH': '模型没有正常结束',
  'err.REVIEW_FAILED': '审核失败',
  'err.BAD_REQUEST': '请求格式错误',
  'err.NETWORK': '网络或服务不可用',
  'err.ABORTED': '审核已取消',
} satisfies Record<string, string>

/** Approval dictionary key union. */
export type ApprovalKey = keyof typeof zh

/** English dictionary, checked against the Chinese key set. */
export const en = {
  nav: 'Anti Blind Approval',
  title: 'Anti Blind Approval',
  intro: 'In a Workspace Write session, the escalation request is reviewed by a model before you decide: Allow stays disabled while the review runs, and for a while after an unsafe verdict. You still make the final call.',
  enabled: 'Enable AI review',
  enabledHint: 'Turn off to restore the stock approval panel',
  model: 'Review model',
  modelHint: 'Leave empty to use the current session model',
  modelCurrent: 'Current session model (default)',
  delay: 'Lock Allow for (seconds)',
  delayHint: '0 means the verdict never locks the buttons',
  prompt: 'Review prompt',
  promptHint: 'Empty uses the built-in English prompt. {language} is replaced at runtime with the UI language (e.g. Chinese (zh)); the JSON output contract is appended by the plugin',
  promptReset: 'Restore default',
  promptDefault: 'Built-in default prompt',
  test: 'Test review',
  testing: 'Reviewing…',
  testOk: 'Model is available',
  testFail: 'Test failed',
  saved: 'Saved',
  catalogFail: 'Could not load the model list; the current session model will be used.',
  storageHint: 'Settings live in this browser (localStorage); they are not written into the DSH configuration.',
  waiting: 'Waiting for approval',
  checking: 'Checking approval scope',
  reviewing: 'AI reviewing…',
  safe: 'AI review passed',
  unsafe: 'AI review failed',
  error: 'AI review unavailable',
  escalation: 'Tool {toolName} requests privileged execution',
  detailAria: 'Approval details',
  preview: 'Pending action',
  allowOnce: 'Allow once',
  reject: 'Reject',
  hold: 'Allow in {seconds}s',
  verdictSafe: 'The model found no obvious risk in this action. Confirm to allow.',
  verdictUnsafe: 'The model flagged this action: ',
  verdictError: 'The review did not finish; the anti-blind-click hold is active: ',
  'err.NO_SESSION': 'Session not found',
  'err.NO_MODEL': 'No review model is available',
  'err.INVALID_OUTPUT': 'The model output did not match the JSON contract',
  'err.TIMEOUT': 'The review timed out',
  'err.LLM_ERROR': 'The model call failed',
  'err.LLM_NO_FINISH': 'The model stream did not finish',
  'err.REVIEW_FAILED': 'The review failed',
  'err.BAD_REQUEST': 'Malformed request',
  'err.NETWORK': 'Network or service unavailable',
  'err.ABORTED': 'Review cancelled',
} satisfies Record<ApprovalKey, string>

/** Dictionary key for each failure code a route can report. */
const ERROR_KEYS = {
  BAD_REQUEST: 'err.BAD_REQUEST',
  NO_SESSION: 'err.NO_SESSION',
  NO_MODEL: 'err.NO_MODEL',
  INVALID_OUTPUT: 'err.INVALID_OUTPUT',
  TIMEOUT: 'err.TIMEOUT',
  LLM_ERROR: 'err.LLM_ERROR',
  LLM_NO_FINISH: 'err.LLM_NO_FINISH',
  REVIEW_FAILED: 'err.REVIEW_FAILED',
  ABORTED: 'err.ABORTED',
  NETWORK: 'err.NETWORK',
} satisfies Record<ReviewErrorCode, ApprovalKey>

/**
 * Resolve the dictionary key of a reported failure code.
 * @param code - code from a response body, which is why an unknown value is possible.
 * @returns the matching key, or the generic failure key.
 */
export function errorKey(code: unknown): ApprovalKey {
  if (typeof code === 'string' && Object.hasOwn(ERROR_KEYS, code)) {
    return ERROR_KEYS[code as ReviewErrorCode]
  }
  return ERROR_KEYS.REVIEW_FAILED
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Anti-blind-approval panel and settings copy. */
    'ai-approval-review': ApprovalKey
  }
}
