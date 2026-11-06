/** Front-matter values are written as plain YAML scalars. */
export interface DocumentMeta {
  readonly title: string
  readonly sessionId: string
  readonly cwd: string
  readonly createdAt: string
  /** Time this document (or the newest edit of it) was last written. */
  readonly updatedAt: string
  /** 1-based sequence within the output directory; the handoff chain. */
  readonly version: number
  /** File name of the version this one supersedes. */
  readonly previous?: string
  /** Last activity in the session this document describes. */
  readonly sessionActivityAt: string
  readonly provider: string
  readonly model: string
  readonly messages: number
  readonly focus?: string
  /** Generator identity, including the plugin version. */
  readonly generator: string
}

function yamlString(value: string): string {
  if (/^[\w./@-]+$/u.test(value)) return value
  return JSON.stringify(value)
}

/** `2026-10-26 15:36:12 +08:00` — readable, unambiguous, sortable. */
export function readableTime(iso: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})([+-]\d{2}:\d{2})$/u.exec(iso)
  return match === null ? iso : `${match[1]} ${match[2]} ${match[3]}`
}

/** One line under the title: version, freshness, and the version it replaces. */
function metaLine(meta: DocumentMeta): string {
  const parts = [`v${meta.version}`, `生成于 ${readableTime(meta.createdAt)}`, `会话最后活动 ${readableTime(meta.sessionActivityAt)}`]
  if (meta.previous !== undefined && meta.previous !== '') parts.push(`上一份 \`${meta.previous}\``)
  return `> ${parts.join(' · ')}`
}

/** Render the complete document: YAML front matter, title, meta line, and model-written body. */
export function renderDocument(meta: DocumentMeta, body: string): string {
  const fields: [string, string | number][] = [
    ['title', yamlString(meta.title)],
    ['session', yamlString(meta.sessionId)],
    ['cwd', yamlString(meta.cwd)],
    ['created', yamlString(meta.createdAt)],
    ['updated', yamlString(meta.updatedAt)],
    ['version', meta.version],
    ['session-activity', yamlString(meta.sessionActivityAt)],
  ]
  if (meta.previous !== undefined && meta.previous !== '') fields.push(['previous', yamlString(meta.previous)])
  fields.push(['provider', yamlString(meta.provider)])
  fields.push(['model', yamlString(meta.model)])
  fields.push(['messages', meta.messages])
  if (meta.focus !== undefined && meta.focus !== '') fields.push(['focus', yamlString(meta.focus)])
  fields.push(['generator', yamlString(meta.generator)])

  const front = ['---', ...fields.map(([key, value]) => `${key}: ${value}`), '---'].join('\n')
  return `${front}\n\n# 交接文档 · ${meta.title}\n\n${metaLine(meta)}\n\n${body.trim()}\n`
}

/** Input for the `latest.md` pointer that always names the newest document. */
export interface LatestPointerMeta {
  readonly name: string
  readonly version: number
  readonly updatedAt: string
}

/**
 * Render `latest.md` as a pointer rather than a duplicate.
 *
 * A full copy made "which file is newest" ambiguous (two identical files with
 * the same mtime). The pointer states the answer and keeps `latest.md` cheap;
 * `/handoff resume` follows it to the real document.
 */
export function renderLatestPointer(meta: LatestPointerMeta): string {
  const front = [
    '---',
    'kind: latest-pointer',
    `latest: ${yamlString(meta.name)}`,
    `version: ${meta.version}`,
    `updated: ${yamlString(meta.updatedAt)}`,
    '---',
  ].join('\n')
  const body = [
    '# 最新交接文档',
    '',
    `最新一份是 \`${meta.name}\`（v${meta.version}，${readableTime(meta.updatedAt)}）。`,
    '',
    '直接打开它；或者在新会话里运行 `/handoff resume`，会自动跟上这里指向的文件。',
  ].join('\n')
  return `${front}\n\n${body}\n`
}

/** Front matter broken into plain string fields, plus the markdown body. */
export interface SplitDocument {
  readonly meta: Record<string, string>
  readonly body: string
}

/** YAML front matter: `---` line, fields, closing `---`, then the body. */
const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/u

/** A scalar as written by `yamlString`: bare, `"quoted"`, or a plain number. */
function scalar(raw: string): string {
  const value = raw.trim()
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    try {
      const parsed: unknown = JSON.parse(value)
      if (typeof parsed === 'string') return parsed
    } catch {
      // Fall through: a malformed quote is more useful as literal text.
    }
  }
  return value
}

/**
 * Split front matter from the body without a YAML dependency.
 *
 * The generator writes only flat `key: scalar` pairs, so a full parser would be
 * dead weight; a document edited by hand with nested YAML keeps the flat fields
 * it does have and ignores the rest.
 */
export function splitFrontMatter(content: string): SplitDocument {
  const match = FRONT_MATTER.exec(content)
  if (match === null) return { meta: {}, body: content }
  const meta: Record<string, string> = {}
  for (const line of (match[1] ?? '').split(/\r?\n/u)) {
    const field = /^([A-Za-z][\w-]*):[ \t]*(.*)$/u.exec(line)
    if (field?.[1] !== undefined && field[2] !== undefined && field[2].trim() !== '') {
      meta[field[1]] = scalar(field[2])
    }
  }
  return { meta, body: content.slice(match[0].length) }
}

/** One document's identity, without the body it was written from. */
export interface DocumentSummary {
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

/** First level-one heading, with the generated `交接文档 · ` prefix removed. */
function headingTitle(body: string): string | undefined {
  const match = /^#[ \t]+(.+)$/mu.exec(body)
  if (match?.[1] === undefined) return undefined
  const text = match[1].trim().replace(/^交接文档\s*[·:：-]\s*/u, '')
  return text === '' ? undefined : text
}

/**
 * Read the fields the sidebar lists for each document.
 *
 * Best effort by design: an older or hand-edited file still lists, it just
 * carries fewer facts. Nothing here throws.
 */
export function parseDocumentSummary(content: string): DocumentSummary {
  const { meta, body } = splitFrontMatter(content)
  const title = meta.title ?? headingTitle(body)
  const version = Number(meta.version)
  const messages = Number(meta.messages)
  const summary: {
    -readonly [K in keyof DocumentSummary]: DocumentSummary[K]
  } = {}
  if (title !== undefined && title !== '') summary.title = title
  if (Number.isSafeInteger(version) && version > 0) summary.version = version
  if (meta.created !== undefined) summary.created = meta.created
  if (meta.updated !== undefined) summary.updated = meta.updated
  if (meta['session-activity'] !== undefined) summary.sessionActivityAt = meta['session-activity']
  if (meta.previous !== undefined) summary.previous = meta.previous
  if (meta.provider !== undefined) summary.provider = meta.provider
  if (meta.model !== undefined) summary.model = meta.model
  if (Number.isSafeInteger(messages) && messages >= 0) summary.messages = messages
  if (meta.focus !== undefined) summary.focus = meta.focus
  if (meta.generator !== undefined) summary.generator = meta.generator
  return summary
}

/** Read `latest: <name>` out of a pointer document; `undefined` for a legacy full copy. */
export function parseLatestPointer(content: string): string | undefined {
  const front = /^---\n([\s\S]*?)\n---/u.exec(content)
  if (front === null) return undefined
  const field = /^latest:\s*"?([^"\n]+)"?\s*$/mu.exec(front[1] ?? '')
  return field?.[1]?.trim()
}

/** Read the `version:` counter out of an existing document. */
export function parseDocumentVersion(content: string): number | undefined {
  const field = /^version:\s*(\d+)\s*$/mu.exec(content)
  if (field === null) return undefined
  const value = Number(field[1])
  return Number.isSafeInteger(value) && value > 0 ? value : undefined
}

/**
 * Clean model output: drop an accidental whole-document fence, a duplicated
 * front matter block, or a top-level heading the prompt asked it not to add.
 */
export function normalizeBody(raw: string): string {
  let body = raw.trim()

  const fence = /^```[a-zA-Z]*\n([\s\S]*?)\n```$/u.exec(body)
  if (fence?.[1] !== undefined) body = fence[1].trim()

  if (body.startsWith('---\n')) {
    const end = body.indexOf('\n---', 4)
    if (end !== -1) body = body.slice(end + 4).trim()
  }

  body = body.replace(/^# [^\n]*\n+/u, '')
  return body.trim()
}

/** File-name-safe slug that keeps CJK characters. */
export function slugify(text: string, maxChars = 28): string {
  const slug = text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{Script=Han}\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, maxChars)
    .replace(/-+$/u, '')
  return slug === '' ? 'session' : slug
}

/** `20261025-2140` in the host's local time, sortable as a file name. */
function stamp(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

/** Build the timestamped document file name. */
export function documentFileName(prefix: string, date: Date, slug: string): string {
  const safePrefix = slugify(prefix, 24)
  return `${safePrefix}-${stamp(date)}-${slug}.md`
}

/** ISO-ish local timestamp for front matter and prompts. */
export function localTimestamp(date: Date): string {
  const offset = -date.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const pad = (value: number): string => String(Math.trunc(Math.abs(value))).padStart(2, '0')
  const iso = new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 19)
  return `${iso}${sign}${pad(offset / 60)}:${pad(offset % 60)}`
}
