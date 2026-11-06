/** Typed access to the plugin's small HTTP surface. */

export const API = '/api/dsh-handoff'

export interface SessionSummary {
  readonly id: string
  readonly cwd: string
  readonly title: string
  readonly messages: number
}

/** One listed document; the summary fields come from its front matter. */
export interface DocEntry {
  readonly name: string
  readonly path: string
  readonly size: number
  readonly modifiedAt: number
  readonly title?: string
  readonly version?: number
  readonly created?: string
  readonly updated?: string
  readonly sessionActivityAt?: string
  readonly previous?: string
  readonly provider?: string
  readonly model?: string
  readonly messages?: number
  readonly focus?: string
  readonly generator?: string
}

export interface DocList {
  readonly dir: string
  readonly docs: readonly DocEntry[]
}

export interface GenerateResult {
  readonly path: string
  readonly version: number
  readonly messages: number
  readonly chars: number
  readonly model: string
  readonly truncated: boolean
}

/** What `POST /attach` confirms after framing and injecting one document. */
export interface AttachResult {
  readonly name: string
  readonly chars: number
  readonly truncated: boolean
}

interface Envelope<T> {
  readonly ok?: boolean
  readonly value?: T
  readonly error?: { readonly code?: string; readonly message?: string }
}

/** Failure carrying the Host's stable error code, when the route supplied one. */
export class HandoffRequestError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'HandoffRequestError'
    this.code = code
  }
}

/** Plain-language explanation for the codes the routes can return. */
const HINTS: Record<string, string> = {
  NO_ROUTE: '这个会话还没有模型回复，无法推断用哪个模型。先在插件配置里填写 provider / model，或先在会话里聊一轮。',
  NO_SESSION: '这个会话已经不在当前进程里了，换一个会话再试。',
  EMPTY_SESSION: '当前会话还没有任何消息，先聊一轮再生成。',
  EMPTY_DOCUMENT: '模型返回了空文档，重试一次通常就好。',
  TOOL_CALLS: '模型选择调用工具而不是写文档，重试一次即可。',
  ABORTED: '生成被取消了。',
  RATE_LIMIT: '模型服务限流了，等一会儿再试。',
  AUTH: '模型凭据无效，检查插件或账号配置。',
  BAD_ROUTE_CONFIG: 'provider 与 model 必须同时填写，或都留空。',
  BROKEN_POINTER: 'latest.md 指向的文件不存在，直接选一份历史文档。',
  BAD_NAME: '文件名不合法。',
  NO_DOCUMENT: '这个目录下还没有交接文档。',
  NO_AGENT: '这个会话当前没有活动实例。先给它发一条消息激活，再回来接续。',
  INTERNAL: '本地服务处理失败，稍后重试一次；仍然失败就重启 Harness。',
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, { cache: 'no-store', ...init })
  } catch (error) {
    throw new HandoffRequestError('NETWORK', `无法连接本地服务：${String(error)}`)
  }
  let body: Envelope<T> | undefined
  try {
    body = (await response.json()) as Envelope<T>
  } catch {
    throw new HandoffRequestError(`HTTP_${response.status}`, `本地服务返回了非 JSON 响应（HTTP ${response.status}）。`)
  }
  if (body.ok !== true) {
    const code = body.error?.code ?? `HTTP_${response.status}`
    const message = body.error?.message ?? `请求失败（HTTP ${response.status}）。`
    throw new HandoffRequestError(code, message)
  }
  return body.value as T
}

/** Read a route's value. */
export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path)
}

/** Post a JSON body to a route. */
export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** Human-facing text for an error: the hint when we know the code, else the raw message. */
export function describeError(error: unknown): { text: string; code?: string } {
  if (error instanceof HandoffRequestError) {
    const hint = HINTS[error.code]
    return hint === undefined ? { text: error.message, code: error.code } : { text: hint, code: error.code }
  }
  return { text: error instanceof Error ? error.message : String(error) }
}
