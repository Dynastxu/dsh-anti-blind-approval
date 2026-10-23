/**
 * Requests to the plugin's own Host routes. They ride the authenticated `/api`
 * carrier, so the browser's same-origin cookies are the whole credential story.
 * @module dsh-ai-approval-review/client/http
 */

/** One failed request, carrying the HTTP status the caller may act on. */
export class HttpError extends Error {
  /** Response status; `404` means the Host half is not composed. */
  readonly status: number

  /**
   * @param status - response status.
   */
  constructor(status: number) {
    super(`HTTP_${String(status)}`)
    this.name = 'HttpError'
    this.status = status
  }
}

/**
 * Post a JSON body and parse the JSON answer.
 * @param url - route path below the current origin.
 * @param body - request body.
 * @param signal - cancellation for this request.
 * @returns the parsed response body.
 * @throws {HttpError} when the response status is not OK.
 */
export async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    ...(signal === undefined ? {} : { signal }),
  })
  if (!response.ok) throw new HttpError(response.status)
  return await response.json() as T
}

/**
 * Fetch a JSON document.
 * @param url - route path below the current origin.
 * @returns the parsed response body.
 * @throws {HttpError} when the response status is not OK.
 */
export async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'same-origin',
    headers: { accept: 'application/json' },
  })
  if (!response.ok) throw new HttpError(response.status)
  return await response.json() as T
}
