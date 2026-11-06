import type { ContentBlock, Message } from '@deepseek-ai/dsh-llm'

/** What the transcript builder is allowed to spend and include. */
export interface TranscriptOptions {
  /** Total character budget for the rendered transcript. */
  readonly maxChars: number
  /** Render tool-result entries. */
  readonly includeToolResults: boolean
  /** Render assistant reasoning blocks. */
  readonly includeReasoning: boolean
  /**
   * Render user-role messages the harness injected (skill catalogs, workspace
   * notes, plugin notices). Off by default: they repeat boilerplate that the
   * next session already receives from the harness, and they crowd out the
   * conversation inside the character budget.
   */
  readonly includeInjectedContext: boolean
}

export interface TranscriptStats {
  /** Messages derived from the session. */
  readonly messages: number
  /** Messages that made it into the rendered transcript. */
  readonly included: number
  /** Rendered transcript length in characters. */
  readonly chars: number
  /** Whether the middle of the conversation was dropped to respect the budget. */
  readonly truncated: boolean
  /** Messages dropped from the middle. */
  readonly omitted: number
}

export interface Transcript {
  readonly text: string
  readonly stats: TranscriptStats
}

/** One path or command and how often the conversation touched it. */
export interface ActivityItem {
  readonly text: string
  readonly count: number
}

/**
 * Deterministic tool activity over the whole session.
 *
 * Built from every message, not from the budgeted transcript, so file paths and
 * commands survive a truncated record. The writer uses it to keep the "key
 * files, commands, and environment" section exact instead of reconstructing
 * names from prose that may have been cut.
 */
export interface ActivitySummary {
  readonly edited: readonly ActivityItem[]
  readonly read: readonly ActivityItem[]
  readonly commands: readonly ActivityItem[]
  readonly searches: readonly ActivityItem[]
  readonly failures: readonly ActivityItem[]
}

/** One rendered line group, before budgeting. */
interface Entry {
  readonly kind: 'user' | 'context' | 'assistant' | 'tool-call' | 'tool-result' | 'reasoning'
  readonly text: string
  /** Human turn this entry belongs to; 0 for anything before the first message. */
  readonly turn: number
  /** The call id this entry answers, for tool results. */
  readonly callId?: string
}

const ENTRY_LIMIT = 4_000
const ENTRY_HEAD = 2_600
const ENTRY_TAIL = 1_200
const CALL_ARGS_LIMIT = 300

function clip(text: string, limit = ENTRY_LIMIT): string {
  if (text.length <= limit) return text
  const omitted = text.length - ENTRY_HEAD - ENTRY_TAIL
  return `${text.slice(0, ENTRY_HEAD)}\n…（此处截断 ${omitted} 字符）…\n${text.slice(text.length - ENTRY_TAIL)}`
}

/** Single-line clip for one argument value. */
function inline(text: string, limit: number): string {
  const flat = text.replace(/\s+/gu, ' ').trim()
  return flat.length <= limit ? flat : `${flat.slice(0, limit)}…`
}

/** Flatten content blocks into readable text, skipping images and files. */
function contentText(blocks: readonly ContentBlock[], includeReasoning: boolean): string {
  const parts: string[] = []
  for (const block of blocks) {
    if (block.type === 'text') parts.push(block.text)
    else if (block.type === 'reasoning' && includeReasoning) parts.push(`[思考] ${block.text}`)
    else if (block.type === 'image') parts.push('[图片]')
    else if (block.type === 'file') parts.push('[文件]')
  }
  return parts.join('\n').trim()
}

/**
 * The signal-bearing fields of a tool call, in one line.
 *
 * Dumping raw JSON spends the budget on `content` bodies that the summarizer
 * cannot use, and hides the one thing it can use: which file or command the
 * call touched. Known argument names are lifted out; bulk payloads collapse to
 * their size so a `write` still says *what* file and *how much* was written.
 */
function argumentsSummary(raw: string): string {
  const text = raw.trim()
  if (text === '') return ''
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return inline(text, CALL_ARGS_LIMIT)
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return inline(text, CALL_ARGS_LIMIT)
  const record = value as Record<string, unknown>
  const parts: string[] = []
  for (const key of ['path', 'file_path', 'cmd', 'command', 'pattern', 'url', 'query', 'name', 'skill', 'description', 'focus']) {
    const hit = record[key]
    if (typeof hit === 'string' && hit.trim() !== '') parts.push(`${key}=${inline(hit, 160)}`)
    else if (typeof hit === 'number' || typeof hit === 'boolean') parts.push(`${key}=${String(hit)}`)
  }
  for (const key of ['content', 'old_string', 'new_string', 'text', 'old_str', 'new_str']) {
    const hit = record[key]
    if (typeof hit === 'string' && hit !== '') parts.push(`${key}(${hit.length}ch)`)
    else if (Array.isArray(hit)) parts.push(`${key}(${hit.length}项)`)
  }
  if (parts.length === 0) return inline(text, CALL_ARGS_LIMIT)
  return inline(parts.join(' '), 400)
}

function toolNameOf(message: Message, names: ReadonlyMap<string, string>): string {
  if (message.role !== 'tool') return 'tool'
  return names.get(String(message.source.callId)) ?? 'tool'
}

/** Collect `callId → tool name` so results can name their call. */
function collectToolNames(messages: readonly Message[]): Map<string, string> {
  const names = new Map<string, string>()
  for (const message of messages) {
    if (message.role !== 'assistant') continue
    for (const block of message.content) {
      if (block.type === 'tool-call') names.set(String(block.id), block.name)
    }
  }
  return names
}

function toEntries(messages: readonly Message[], options: TranscriptOptions): Entry[] {
  const names = collectToolNames(messages)
  const entries: Entry[] = []
  // A turn starts at each message the human actually sent. Numbering lets the
  // writer say "the user changed direction at #5" without retelling the chat,
  // and lets the next session find a specific exchange by number.
  let turn = 0
  for (const message of messages) {
    switch (message.role) {
      case 'system':
      case 'developer':
        // Prompt text and tool-update bookkeeping add tokens, not handoff signal.
        break
      case 'user': {
        const injected = message.source.kind !== 'user'
        if (!injected) turn += 1
        if (injected && !options.includeInjectedContext) break
        const text = contentText(message.content, options.includeReasoning)
        if (text === '') break
        entries.push({ kind: injected ? 'context' : 'user', turn, text: clip(text) })
        break
      }
      case 'assistant': {
        const text = contentText(message.content, options.includeReasoning)
        if (text !== '') entries.push({ kind: 'assistant', turn, text: clip(text) })
        for (const block of message.content) {
          if (block.type !== 'tool-call') continue
          const summary = argumentsSummary(block.arguments)
          entries.push({
            kind: 'tool-call',
            turn,
            callId: String(block.id),
            text: clip(summary === '' ? block.name : `${block.name} ${summary}`, 700),
          })
        }
        break
      }
      case 'tool': {
        if (!options.includeToolResults) break
        const text = contentText(message.content, false)
        const name = toolNameOf(message, names)
        const label = message.isError === true ? `✗ ${name}` : `← ${name}`
        entries.push({ kind: 'tool-result', turn, callId: String(message.source.callId), text: clip(`${label} ${text}`, 1_200) })
        break
      }
    }
  }
  return entries
}

function renderEntry(entry: Entry): string {
  const at = entry.turn === 0 ? '' : ` #${entry.turn}`
  switch (entry.kind) {
    case 'user':
      return `[用户${at}] ${entry.text}`
    case 'context':
      return `[上下文${at}] ${entry.text}`
    case 'assistant':
      return `[助手${at}] ${entry.text}`
    case 'tool-call':
      return `[调用${at}] ${entry.text}`
    case 'tool-result':
      return `[结果${at}] ${entry.text}`
    case 'reasoning':
      return `[思考${at}] ${entry.text}`
  }
}

/**
 * Render the conversation into a compact transcript under a character budget.
 *
 * The budget keeps the beginning (the task statement) and the newest entries
 * (where the work actually is), dropping the middle with an explicit marker so
 * the summarizer knows the record is incomplete instead of silently missing it.
 */
export function buildTranscript(messages: readonly Message[], options: TranscriptOptions): Transcript {
  const entries = toEntries(messages, options)
  const budget = Math.max(2_000, options.maxChars)
  const rendered = entries.map(renderEntry)
  const total = rendered.reduce((sum, text) => sum + text.length + 2, 0)

  if (total <= budget) {
    const text = rendered.join('\n\n')
    return {
      text,
      stats: { messages: messages.length, included: entries.length, chars: text.length, truncated: false, omitted: 0 },
    }
  }

  const headBudget = Math.floor(budget * 0.35)
  const tailBudget = Math.max(1_000, budget - headBudget - 240)
  const head: string[] = []
  let headChars = 0
  for (const text of rendered) {
    if (headChars + text.length + 2 > headBudget) break
    head.push(text)
    headChars += text.length + 2
  }
  const tail: string[] = []
  let tailChars = 0
  for (let index = rendered.length - 1; index >= head.length; index--) {
    const text = rendered[index] as string
    if (tailChars + text.length + 2 > tailBudget) break
    tail.unshift(text)
    tailChars += text.length + 2
  }
  const omitted = entries.length - head.length - tail.length
  const marker = `…（会话中段省略 ${omitted} 条消息，约 ${Math.max(0, total - headChars - tailChars)} 字符未展示）…`
  const text = [...head, marker, ...tail].join('\n\n')
  return {
    text,
    stats: { messages: messages.length, included: head.length + tail.length, chars: text.length, truncated: true, omitted },
  }
}

/** Could not parse a tool call's arguments; the summary simply skips it. */
function parsedArguments(raw: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
    return value as Record<string, unknown>
  } catch {
    return undefined
  }
}

function stringArgument(args: Record<string, unknown> | undefined, keys: readonly string[]): string {
  if (args === undefined) return ''
  for (const key of keys) {
    const hit = args[key]
    if (typeof hit === 'string' && hit.trim() !== '') return hit.trim()
  }
  return ''
}

const EDIT_TOOL = /write|edit|patch|replace/iu
const READ_TOOL = /^read$|read_file|read_text|notebook_read/iu
const SHELL_TOOL = /bash|pwsh|shell|terminal|exec/iu
const SEARCH_TOOL = /grep|glob|search|find/iu
const WEB_TOOL = /web_fetch|web_search/iu

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1)
}

function items(map: ReadonlyMap<string, number>, limit: number): ActivityItem[] {
  return [...map.entries()].slice(0, limit).map(([text, count]) => ({ text, count }))
}

/** Collect edited/read files, commands, searches, and failures across the session. */
export function summarizeActivity(messages: readonly Message[]): ActivitySummary {
  const edited = new Map<string, number>()
  const read = new Map<string, number>()
  const commands = new Map<string, number>()
  const searches = new Map<string, number>()
  const failures = new Map<string, number>()
  const names = collectToolNames(messages)

  for (const message of messages) {
    if (message.role === 'assistant') {
      for (const block of message.content) {
        if (block.type !== 'tool-call') continue
        const args = parsedArguments(block.arguments)
        const path = stringArgument(args, ['path', 'file_path', 'notebook_path'])
        if (EDIT_TOOL.test(block.name)) {
          if (path !== '') bump(edited, path)
          continue
        }
        if (READ_TOOL.test(block.name)) {
          if (path !== '') bump(read, path)
          continue
        }
        if (SHELL_TOOL.test(block.name)) {
          const command = stringArgument(args, ['cmd', 'command'])
          if (command !== '') bump(commands, inline(command.split('\n')[0] ?? '', 90))
          continue
        }
        if (SEARCH_TOOL.test(block.name)) {
          const pattern = stringArgument(args, ['pattern', 'query'])
          if (pattern !== '') bump(searches, `${block.name} ${inline(pattern, 60)}`)
          continue
        }
        if (WEB_TOOL.test(block.name)) {
          const target = stringArgument(args, ['url', 'query'])
          if (target !== '') bump(searches, `${block.name} ${inline(target, 60)}`)
        }
      }
      continue
    }
    if (message.role === 'tool' && message.isError === true) {
      const first = contentText(message.content, false).split('\n')[0] ?? ''
      bump(failures, `${toolNameOf(message, names)}: ${inline(first, 80)}`)
    }
  }

  return {
    edited: items(edited, 12),
    read: items(read, 12),
    commands: items(commands, 10),
    searches: items(searches, 6),
    failures: items(failures, 6),
  }
}

function renderItems(list: readonly ActivityItem[], language: 'zh' | 'en'): string {
  const separator = language === 'zh' ? '、' : ', '
  return list
    .map((item) => {
      if (item.count <= 1) return item.text
      return language === 'zh' ? `${item.text}（${item.count} 次）` : `${item.text} (${item.count}x)`
    })
    .join(separator)
}

/** Render the activity digest as prompt lines; empty when nothing happened. */
export function renderActivity(activity: ActivitySummary, language: 'zh' | 'en'): string {
  const zh = language === 'zh'
  const lines: string[] = []
  const add = (label: string, list: readonly ActivityItem[]): void => {
    if (list.length > 0) lines.push(`- ${label}${zh ? '：' : ': '}${renderItems(list, language)}`)
  }
  if (zh) {
    add('修改过', activity.edited)
    add('读过', activity.read)
    add('执行过', activity.commands)
    add('检索过', activity.searches)
    add('失败过', activity.failures)
  } else {
    add('Edited', activity.edited)
    add('Read', activity.read)
    add('Ran', activity.commands)
    add('Searched', activity.searches)
    add('Failed', activity.failures)
  }
  return lines.join('\n')
}

/**
 * The user's own messages, in order.
 *
 * Injected context (skills, workspace notes, plugin notices) also rides in
 * user-role messages, but it is not the human's language and must not decide
 * the document language or the title. Falls back to every user-role message
 * when a session has none of its own.
 */
function humanMessages(messages: readonly Message[]): Message[] {  const own = messages.filter((message) => message.role === 'user' && message.source.kind === 'user')
  return own.length > 0 ? own : messages.filter((message) => message.role === 'user')
}

/** First non-empty user line — a cheap title anchor, never a substitute for the task section. */
export function firstUserLine(messages: readonly Message[], maxChars = 60): string {
  for (const message of humanMessages(messages)) {
    const text = contentText(message.content, false).replace(/\s+/gu, ' ').trim()
    if (text !== '') return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text
  }
  return ''
}

/** Heuristic for `language: auto`: CJK characters in the user's own words. */
export function dominantLanguage(messages: readonly Message[]): 'zh' | 'en' {
  let cjk = 0
  let latin = 0
  for (const message of humanMessages(messages)) {
    const text = contentText(message.content, false)
    for (const char of text) {
      if (/\p{Script=Han}/u.test(char)) cjk++
      else if (/[A-Za-z]/u.test(char)) latin++
    }
  }
  return cjk >= latin / 3 && cjk > 0 ? 'zh' : 'en'
}
