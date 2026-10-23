/**
 * Wire contract between the plugin's two halves.
 *
 * The browser panel posts these bodies to the Host routes and renders the
 * responses; the Host validates every field it reads because a request body is
 * an untrusted boundary. The client imports this module type-only.
 *
 * @module dsh-anti-blind-approval/types
 */

/** Stable error codes the panel localizes. */
export type ReviewErrorCode =
  | 'BAD_REQUEST'
  | 'NO_SESSION'
  | 'NO_MODEL'
  | 'INVALID_OUTPUT'
  | 'TIMEOUT'
  | 'LLM_ERROR'
  | 'LLM_NO_FINISH'
  | 'REVIEW_FAILED'
  | 'ABORTED'
  | 'NETWORK'

/** Fields every panel request carries: the approval being decided, as the panel saw it. */
export interface ReviewRequestBase {
  /** Session whose approval is pending. */
  readonly sessionId?: string
  /** Logged tool-call id the approval answers. */
  readonly callId?: string
  /** Tool requesting the escalation. */
  readonly toolName?: string
  /** Audit reason supplied by the requester. */
  readonly reason?: string
  /** Localized presentation copy supplied by the requester. */
  readonly displayReason?: string
  /** BCP 47-style tag of the language the human reads. */
  readonly userLanguage?: string
}

/** Body of `POST /action`: a cheap scope probe with no model call. */
export interface ActionProbeRequest extends ReviewRequestBase {}

/** Body of `POST /review`: one model review over the same facts. */
export interface ReviewRequest extends ReviewRequestBase {
  /** Replacement reviewer policy; empty or absent uses the built-in prompt. */
  readonly prompt?: string
  /** `provider::model` override; absent uses the session's own route. */
  readonly model?: string
}

/** Answer of `POST /action`. */
export interface ActionProbeResponse {
  /** Whether this session's preset is reviewed at all. */
  readonly active: boolean
  /** The session's effective preset, when the service is composed. */
  readonly preset?: string | null
  /** Rendered pending action, clipped for display. */
  readonly preview?: string
  /** Whether a logged action was found behind the call id. */
  readonly hasAction?: boolean
  /** Set when the probe could not answer. */
  readonly errorCode?: ReviewErrorCode
}

/** Answer of `POST /review`. */
export interface ReviewResponse {
  /** Whether this session's preset is reviewed at all. */
  readonly active?: boolean
  /** The session's effective preset, when the service is composed. */
  readonly preset?: string | null
  /** The reviewer's verdict; only meaningful when no `errorCode` is present. */
  readonly safe?: boolean
  /** One-sentence basis for the verdict, in the reader's language. */
  readonly reason?: string
  /** Route that answered, as `provider/model`. */
  readonly model?: string
  /** Wall-clock duration of the review. */
  readonly elapsedMs?: number
  /** Rendered pending action, clipped for display. */
  readonly preview?: string
  /** Terminal failure code; the verdict fields are absent when set. */
  readonly errorCode?: ReviewErrorCode
  /** Truncated diagnostic detail for the failure code. */
  readonly detail?: string
}

/** One selectable model in the settings picker. */
export interface ReviewCatalogModel {
  readonly id: string
  readonly name: string
}

/** One selectable provider in the settings picker. */
export interface ReviewCatalogProvider {
  readonly id: string
  readonly name: string
  readonly models: readonly ReviewCatalogModel[]
}

/** Answer of `GET /catalog`. */
export interface ReviewCatalogResponse {
  readonly providers: readonly ReviewCatalogProvider[]
  /** Built-in reviewer policy, shown as the settings placeholder and reset target. */
  readonly defaultPrompt: string
}

/** Body of `POST /test`: a connectivity review over synthetic facts. */
export interface TestReviewRequest {
  /** `provider::model` override; absent tries the catalog's first route. */
  readonly model?: string
  /** Replacement reviewer policy. */
  readonly prompt?: string
  /** BCP 47-style tag of the language the human reads. */
  readonly userLanguage?: string
}

/** Answer of `POST /test`. */
export interface TestReviewResponse {
  /** Whether the reviewer answered with a valid verdict. */
  readonly ok?: boolean
  readonly safe?: boolean
  readonly reason?: string
  readonly model?: string
  readonly elapsedMs?: number
  /** Terminal failure code; the verdict fields are absent when set. */
  readonly errorCode?: ReviewErrorCode
  /** Truncated diagnostic detail for the failure code. */
  readonly detail?: string
}

/** The reviewer's strict JSON answer. */
export interface Verdict {
  /** Whether the escalation carries no obvious security risk. */
  readonly safe: boolean
  /** One-sentence basis, in the reader's language. */
  readonly reason: string
}
