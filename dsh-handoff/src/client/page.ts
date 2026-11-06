/**
 * The handoff page: document list, rendered preview, and generation.
 *
 * Layout is a two-column split inside the Host's `main` panel: the left rail
 * lists generated documents, the right pane renders the selected one. Every
 * state the routes can produce — loading, empty, error, truncated — has a
 * visible home, because a handoff screen is often opened in a hurry.
 */
import { createElement as h, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import {
  API,
  apiGet,
  apiPost,
  describeError,
  type AttachResult,
  type DocEntry,
  type DocList,
  type GenerateResult,
  type SessionSummary,
} from './api.ts'
import { clip, dateTimeText, downloadText, fileSizeText, modelText, relativeTime, titleFromFileName, writeClipboard } from './format.ts'
import { inlineText, openingLine, parseDocument, type Block, type Inline, type ParsedDocument } from './markdown.ts'
import { CSS } from './styles.ts'
import {
  IconAlert,
  IconCheck,
  IconChevronDown,
  IconClose,
  IconCode,
  IconCopy,
  IconDownload,
  IconEye,
  IconHandoff,
  IconInfo,
  IconLoader,
  IconRefresh,
  IconSearch,
  IconSparkle,
  IconTaskCheck,
} from './ui.ts'

const SESSION_KEY = 'dsh-handoff:session'

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

interface Notice {
  readonly tone: 'ok' | 'error' | 'info'
  readonly text: string
  readonly code?: string
}

/** Read a remembered panel choice; storage can be unavailable in a sandboxed frame. */
function readStored(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

function storeChoice(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // A panel that cannot remember a choice still works for this visit.
  }
}

/** `交接文档 · 重构登录模块` → `重构登录模块`. */
function stripDocumentPrefix(title: string): string {
  return title.replace(/^交接文档\s*[·:：-]\s*/u, '').trim()
}

function quoteText(block: Extract<Block, { kind: 'quote' }>): string {
  return block.blocks
    .map((inner) => {
      if (inner.kind === 'paragraph') return inlineText(inner.inline)
      if (inner.kind === 'quote') return quoteText(inner)
      return ''
    })
    .join(' ')
}

/** Drop the generated H1 and freshness line: the pane header already shows both. */
function trimBoilerplate(blocks: readonly Block[]): Block[] {
  const out = [...blocks]
  const first = out[0]
  if (first?.kind === 'heading' && first.level === 1) out.shift()
  const next = out[0]
  if (next?.kind === 'quote' && quoteText(next).includes('生成于')) out.shift()
  return out
}

function inlineNodes(inline: readonly Inline[], keyPrefix: string): ReactNode[] {
  return inline.map((node, index) => {
    const key = `${keyPrefix}-${index}`
    switch (node.kind) {
      case 'text':
        return node.text
      case 'code':
        return h('code', { key, className: 'dh-inline-code' }, node.text)
      case 'strong':
        return h('strong', { key }, inlineNodes(node.children, key))
      case 'em':
        return h('em', { key }, inlineNodes(node.children, key))
      case 'del':
        return h('del', { key }, inlineNodes(node.children, key))
      case 'link':
        return h(
          'a',
          { key, href: node.href, target: '_blank', rel: 'noreferrer noopener' },
          inlineNodes(node.children, key),
        )
      default:
        return null
    }
  })
}

/** A fenced block with its own copy affordance. */
function CodeBlock(props: { readonly lang: string; readonly code: string }) {
  const [done, setDone] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const copy = (): void => {
    void writeClipboard(props.code).then((ok) => {
      if (!ok) return
      setDone(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setDone(false), 1400)
    })
  }
  return h(
    'div',
    { className: props.lang === '' ? 'dh-code' : 'dh-code dh-code-has-lang' },
    props.lang === '' ? null : h('span', { className: 'dh-code-lang' }, props.lang),
    h(
      'button',
      { type: 'button', className: 'dh-iconbtn dh-code-copy', title: '复制代码', 'aria-label': '复制代码', onClick: copy },
      done ? h(IconCheck, { size: 13 }) : h(IconCopy, { size: 13 }),
    ),
    h('pre', null, h('code', null, props.code)),
  )
}

function renderBlock(block: Block, key: string): ReactNode {
  switch (block.kind) {
    case 'heading': {
      const level = Math.min(4, block.level)
      return h(`h${level}`, { key }, inlineNodes(block.inline, key))
    }
    case 'paragraph':
      return h('p', { key }, inlineNodes(block.inline, key))
    case 'code':
      return h(CodeBlock, { key, lang: block.lang, code: block.code })
    case 'quote':
      return h('blockquote', { key, className: 'dh-quote' }, block.blocks.map((inner, index) => renderBlock(inner, `${key}-${index}`)))
    case 'hr':
      return h('hr', { key, className: 'dh-hr' })
    case 'table':
      return h(
        'div',
        { key, className: 'dh-tablewrap' },
        h(
          'table',
          null,
          h('thead', null, h('tr', null, block.head.map((cell, index) => h('th', { key: `${key}-h-${index}` }, inlineNodes(cell, `${key}-h-${index}`))))),
          h(
            'tbody',
            null,
            block.rows.map((row, rowIndex) =>
              h(
                'tr',
                { key: `${key}-r-${rowIndex}` },
                row.map((cell, cellIndex) => h('td', { key: `${key}-r-${rowIndex}-${cellIndex}` }, inlineNodes(cell, `${key}-r-${rowIndex}-${cellIndex}`))),
              ),
            ),
          ),
        ),
      )
    case 'list': {
      const listTag = block.ordered ? 'ol' : 'ul'
      const tasks = block.items.some((item) => item.checked !== undefined)
      return h(
        listTag,
        { key, className: tasks ? 'dh-tasklist' : undefined },
        block.items.map((item, index) =>
          h(
            'li',
            {
              key: `${key}-${index}`,
              className: item.checked === undefined ? undefined : 'dh-task',
              style: item.depth === 0 ? undefined : { marginLeft: item.depth * 14 },
            },
            item.checked === undefined
              ? inlineNodes(item.inline, `${key}-${index}`)
              : [
                  h(
                    'span',
                    { key: 'check', className: 'dh-check', 'data-checked': item.checked ? 'true' : 'false', 'aria-hidden': true },
                    item.checked ? h(IconTaskCheck, { size: 10 }) : null,
                  ),
                  h('span', { key: 'text' }, inlineNodes(item.inline, `${key}-${index}`)),
                ],
          ),
        ),
      )
    }
    default:
      return null
  }
}

/** The closing section gets a highlighted card: it is the part people paste. */
function OpeningCard(props: { readonly blocks: readonly Block[]; readonly text: string }) {
  const [done, setDone] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const copy = (): void => {
    void writeClipboard(props.text).then((ok) => {
      if (!ok) return
      setDone(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setDone(false), 1400)
    })
  }
  const body = props.blocks.slice(1)
  return h(
    'section',
    { className: 'dh-opening' },
    h(
      'div',
      { className: 'dh-opening-head' },
      h(IconSparkle, { size: 13 }),
      h('span', null, '给下一个会话的开场白'),
      h('span', { className: 'dh-badge-new' }, '可直接粘贴'),
      h('span', { style: { flex: 1 } }),
      h(
        'button',
        { type: 'button', className: 'dh-btn dh-btn-ghost dh-btn-sm', onClick: copy },
        done ? h(IconCheck, { size: 12 }) : h(IconCopy, { size: 12 }),
        done ? '已复制' : '复制',
      ),
    ),
    h('div', null, body.map((block, index) => renderBlock(block, `opening-${index}`))),
  )
}

/** Render the document body, lifting the opening-line section into its card. */
function Article(props: { readonly blocks: readonly Block[]; readonly text: string }) {
  const nodes: ReactNode[] = []
  const start = props.blocks.findIndex(
    (block) => block.kind === 'heading' && /开场白|opening line/iu.test(inlineText(block.inline)),
  )
  let index = 0
  while (index < props.blocks.length) {
    if (index === start) {
      const group: Block[] = []
      let cursor = index
      while (cursor < props.blocks.length && (cursor === index || props.blocks[cursor]?.kind !== 'heading')) {
        const block = props.blocks[cursor]
        if (block !== undefined) group.push(block)
        cursor += 1
      }
      nodes.push(h(OpeningCard, { key: 'opening', blocks: group, text: props.text }))
      index = cursor
      continue
    }
    const block = props.blocks[index]
    if (block !== undefined) nodes.push(renderBlock(block, `block-${index}`))
    index += 1
  }
  return h('div', { className: 'dh-doc' }, nodes)
}

function NoticeBar(props: { readonly notice: Notice; readonly onDismiss: () => void }) {
  const icon = props.notice.tone === 'error' ? h(IconAlert, { size: 14 }) : props.notice.tone === 'ok' ? h(IconCheck, { size: 14 }) : h(IconInfo, { size: 14 })
  return h(
    'div',
    { className: `dh-banner dh-banner-${props.notice.tone}`, role: props.notice.tone === 'error' ? 'alert' : 'status' },
    h('span', { className: 'dh-banner-icon' }, icon),
    h(
      'span',
      { className: 'dh-banner-text' },
      props.notice.text,
      props.notice.code === undefined ? null : h('code', { style: { marginLeft: 6, opacity: 0.7 } }, props.notice.code),
    ),
    h('button', { type: 'button', className: 'dh-iconbtn', title: '关闭提示', 'aria-label': '关闭提示', onClick: props.onDismiss }, h(IconClose, { size: 12 })),
  )
}

function EmptyState(props: { readonly title: string; readonly text: string; readonly children?: ReactNode }) {
  return h(
    'div',
    { className: 'dh-empty' },
    h('div', { className: 'dh-empty-mark' }, h(IconHandoff, { size: 18 })),
    h('div', { className: 'dh-empty-title' }, props.title),
    h('p', { className: 'dh-empty-text' }, props.text),
    props.children,
  )
}

function SkeletonList() {
  return h(
    'div',
    { className: 'dh-items', 'aria-hidden': true },
    [0, 1, 2].map((index) => h('div', { key: index, className: 'dh-skel' })),
  )
}

/** The busiest live session is the likeliest place to continue the work. */
function defaultAttachTarget(sessions: readonly SessionSummary[]): string {
  let best: SessionSummary | undefined
  for (const session of sessions) {
    if (best === undefined || session.messages > best.messages) best = session
  }
  return best?.id ?? ''
}

/**
 * The confirmation layer for "接续到会话".
 *
 * It is deliberately local rather than a Host dialog import: the panel owns one
 * scoped stylesheet, so the layer reskins with the same `--dsw-*` tokens as the
 * rest of the page and cannot depend on a private Host component path.
 */
function AttachDialog(props: {
  readonly sessions: readonly SessionSummary[]
  readonly docTitle: string
  readonly docName: string
  readonly onCancel: () => void
  readonly onConfirm: (sessionId: string) => void
}) {
  const [target, setTarget] = useState(() => defaultAttachTarget(props.sessions))

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') props.onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [props.onCancel])

  const canConfirm = target !== ''

  return h(
    'div',
    {
      className: 'dh-overlay',
      // A click on the backdrop dismisses; clicks inside the dialog stop at it.
      onMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget) props.onCancel()
      },
    },
    h(
      'div',
      {
        className: 'dh-dialog',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'dh-attach-title',
        'aria-describedby': 'dh-attach-hint',
      },
      h(
        'div',
        { className: 'dh-dialog-head' },
        h('span', { className: 'dh-dialog-mark' }, h(IconHandoff, { size: 15 })),
        h('span', { className: 'dh-dialog-title', id: 'dh-attach-title' }, '接续到会话'),
        h(
          'button',
          { type: 'button', className: 'dh-iconbtn', title: '关闭', 'aria-label': '关闭', onClick: props.onCancel },
          h(IconClose, { size: 13 }),
        ),
      ),
      h(
        'div',
        { className: 'dh-dialog-body' },
        h('p', { className: 'dh-dialog-lead' }, `把《${props.docTitle}》注入到下面选中的会话。`),
        h(
          'div',
          { className: 'dh-dialog-field' },
          h('label', { className: 'dh-label', htmlFor: 'dh-attach-session' }, '目标会话'),
          h(
            'div',
            { className: 'dh-selectwrap dh-dialog-selectwrap' },
            h(
              'select',
              {
                id: 'dh-attach-session',
                className: 'dh-select',
                value: target,
                autoFocus: true,
                onChange: (event: ChangeEvent<HTMLSelectElement>) => setTarget(event.target.value),
              },
              props.sessions.length === 0
                ? h('option', { value: '' }, '没有活动会话')
                : props.sessions.map((session) =>
                    h('option', { key: session.id, value: session.id }, `${session.title}（${session.messages} 条消息）`),
                  ),
            ),
            h(IconChevronDown, { size: 13, className: 'dh-select-icon' }),
          ),
        ),
        h(
          'ul',
          { className: 'dh-dialog-hints', id: 'dh-attach-hint' },
          h('li', null, '会作为模型可见的上下文注入该会话，不产生用户消息，也不开新的一轮对话。'),
          h('li', null, '文档超过 30000 字时只注入前 30000 字，并标注已截断。'),
          h('li', null, '目标会话必须是当前进程里活着的会话；没有活动实例的先发一条消息激活。'),
          h('li', null, '文档按目标会话的工作目录查找同名文件；工作目录不同、没有这份文档时会提示换一个会话。'),
        ),
        h('p', { className: 'dh-dialog-file', title: props.docName }, props.docName),
      ),
      h(
        'div',
        { className: 'dh-dialog-foot' },
        h(
          'button',
          { type: 'button', className: 'dh-btn dh-btn-ghost dh-btn-sm', onClick: props.onCancel },
          '取消',
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'dh-btn dh-btn-primary dh-btn-sm',
            disabled: !canConfirm,
            onClick: () => props.onConfirm(target),
          },
          h(IconHandoff, { size: 13 }),
          '确认注入',
        ),
      ),
    ),
  )
}

function DocumentPane(props: {
  readonly entry: DocEntry | undefined
  readonly state: LoadState
  readonly error: string
  readonly raw: string
  readonly mode: 'preview' | 'raw'
  readonly onMode: (mode: 'preview' | 'raw') => void
  readonly onRetry: () => void
  readonly attachBusy: boolean
  readonly attached: boolean
  readonly onAttach: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const parsed: ParsedDocument | null = useMemo(() => (props.raw === '' ? null : parseDocument(props.raw)), [props.raw])
  const blocks = useMemo(() => (parsed === null ? [] : trimBoilerplate(parsed.blocks)), [parsed])
  const text = useMemo(() => (parsed === null ? '' : openingLine(parsed.blocks)), [parsed])

  const fallbackTitle = parsed?.title === undefined ? '' : stripDocumentPrefix(parsed.title)
  const title = (props.entry?.title ?? fallbackTitle) || titleFromFileName(props.entry?.name ?? '')

  const meta = parsed?.meta ?? {}
  const versionLabel =
    meta.version !== undefined ? `v${meta.version}` : props.entry?.version === undefined ? '' : `v${props.entry.version}`
  const created = meta.created
  const createdMs = created === undefined ? Number.NaN : Date.parse(created)
  const model = modelText(meta.provider ?? props.entry?.provider, meta.model ?? props.entry?.model)
  const focus = meta.focus ?? props.entry?.focus ?? ''
  const previous = meta.previous ?? props.entry?.previous ?? ''
  const generator = meta.generator ?? props.entry?.generator ?? ''
  const messageCount = meta.messages !== undefined ? Number(meta.messages) : props.entry?.messages

  const flash = (setter: (value: boolean) => void): void => {
    setter(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setter(false), 1400)
  }

  const copyAll = (): void => {
    void writeClipboard(props.raw).then((ok) => {
      if (ok) flash(setCopied)
    })
  }

  const download = (): void => {
    if (props.entry === undefined) return
    downloadText(props.entry.name, props.raw)
    flash(setDownloaded)
  }

  if (props.state === 'loading') {
    return h(
      'section',
      { className: 'dh-view' },
      h(
        'div',
        { className: 'dh-empty', 'aria-busy': true },
        h(IconLoader, { size: 18, className: 'dh-spin' }),
        h('div', { className: 'dh-empty-title' }, '正在读取文档…'),
        h('div', { className: 'dh-skel-lines' }, [0, 1, 2].map((index) => h('div', { key: index, className: 'dh-skel-line' }))),
      ),
    )
  }

  if (props.state === 'error') {
    return h(
      'section',
      { className: 'dh-view' },
      h(
        EmptyState,
        { title: '文档读取失败', text: props.error },
        h('button', { type: 'button', className: 'dh-btn dh-btn-ghost dh-btn-sm', onClick: props.onRetry }, h(IconRefresh, { size: 13 }), '重试'),
      ),
    )
  }

  if (props.entry === undefined) {
    return h(
      'section',
      { className: 'dh-view' },
      h(
        EmptyState,
        { title: '选一份文档预览', text: '左侧列出这个会话目录下生成过的交接文档；点任意一份就能在这里读。' },
        null,
      ),
    )
  }

  if (parsed === null) {
    return h(
      'section',
      { className: 'dh-view' },
      h(
        EmptyState,
        { title: '这份文档是空的', text: `${props.entry.name} 没有可显示的内容，可能被清空了。` },
        h(
          'button',
          { type: 'button', className: 'dh-btn dh-btn-ghost dh-btn-sm', onClick: props.onRetry },
          h(IconRefresh, { size: 13 }),
          '重新读取',
        ),
      ),
    )
  }

  return h(
    'section',
    { className: 'dh-view' },
    h(
      'div',
      { className: 'dh-view-head' },
      h('div', { className: 'dh-view-title', title: props.entry.name }, title),
      h(
        'div',
        { className: 'dh-view-actions' },
        h(
          'button',
          {
            type: 'button',
            className: 'dh-btn dh-btn-sm dh-btn-accent',
            onClick: props.onAttach,
            disabled: props.attachBusy,
            title: '把这份交接文档注入到另一个活着的会话，让它在下一步继续',
            'aria-busy': props.attachBusy ? 'true' : undefined,
          },
          props.attachBusy
            ? h(IconLoader, { size: 13, className: 'dh-spin' })
            : props.attached
              ? h(IconCheck, { size: 13 })
              : h(IconHandoff, { size: 13 }),
          props.attachBusy ? '接续中…' : props.attached ? '已接续' : '接续到会话',
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'dh-btn dh-btn-ghost dh-btn-sm',
            onClick: () => props.onMode(props.mode === 'preview' ? 'raw' : 'preview'),
            title: props.mode === 'preview' ? '查看原始 markdown' : '回到渲染视图',
          },
          props.mode === 'preview' ? h(IconCode, { size: 13 }) : h(IconEye, { size: 13 }),
          props.mode === 'preview' ? '原文' : '预览',
        ),
        h(
          'button',
          { type: 'button', className: 'dh-iconbtn', title: copied ? '已复制' : '复制全文', 'aria-label': '复制全文', onClick: copyAll },
          copied ? h(IconCheck, { size: 14 }) : h(IconCopy, { size: 14 }),
        ),
        h(
          'button',
          { type: 'button', className: 'dh-iconbtn', title: downloaded ? '已保存' : '下载 .md', 'aria-label': '下载 markdown', onClick: download },
          downloaded ? h(IconCheck, { size: 14 }) : h(IconDownload, { size: 14 }),
        ),
      ),
    ),
    h(
      'div',
      { className: 'dh-chips' },
      versionLabel === '' ? null : h('span', { className: 'dh-chip dh-chip-brand' }, versionLabel),
      created === undefined || Number.isNaN(createdMs)
        ? null
        : h('span', { className: 'dh-chip', title: created }, h(IconInfo, { size: 10 }), dateTimeText(createdMs)),
      h('span', { className: 'dh-chip' }, model),
      typeof messageCount === 'number' && Number.isFinite(messageCount)
        ? h('span', { className: 'dh-chip' }, `${messageCount} 条消息`)
        : null,
      focus === '' ? null : h('span', { className: 'dh-chip', title: focus }, `关注点：${clip(focus, 24)}`),
      previous === '' ? null : h('span', { className: 'dh-chip', title: previous }, `上一份：${previous}`),
      generator === '' ? null : h('span', { className: 'dh-chip', title: generator }, generator),
    ),
    h('div', { className: 'dh-article' }, props.mode === 'raw' ? h('pre', { className: 'dh-raw' }, props.raw) : h(Article, { blocks, text })),
  )
}

/** The whole panel. */
export function Page() {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [sessionId, setSessionId] = useState('')
  const [sessionsState, setSessionsState] = useState<LoadState>('idle')
  const [docs, setDocs] = useState<DocEntry[]>([])
  const [dir, setDir] = useState('')
  const [docsState, setDocsState] = useState<LoadState>('idle')
  const [docsError, setDocsError] = useState('')
  const [activeName, setActiveName] = useState('')
  const [docState, setDocState] = useState<LoadState>('idle')
  const [docError, setDocError] = useState('')
  const [raw, setRaw] = useState('')
  const [focus, setFocus] = useState('')
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<'preview' | 'raw'>('preview')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [attachOpen, setAttachOpen] = useState(false)
  const [attachBusy, setAttachBusy] = useState(false)
  const [attached, setAttached] = useState(false)
  const loadToken = useRef(0)
  const sessionToken = useRef(0)
  const attachTimer = useRef<number | undefined>(undefined)
  const activeNameRef = useRef('')

  /** Fetch the live sessions and select the remembered one, else the newest. */
  const loadSessions = useCallback(async (): Promise<void> => {
    const token = sessionToken.current + 1
    sessionToken.current = token
    setSessionsState('loading')
    try {
      const value = await apiGet<{ sessions: SessionSummary[] }>(`${API}/sessions`)
      if (sessionToken.current !== token) return
      setSessions(value.sessions)
      setSessionsState('ready')
      const remembered = readStored(SESSION_KEY)
      const pick =
        value.sessions.find((session) => session.id === remembered) ??
        value.sessions[value.sessions.length - 1] ??
        value.sessions[0]
      if (pick !== undefined) setSessionId(pick.id)
    } catch (error) {
      if (sessionToken.current !== token) return
      setSessionsState('error')
      const described = describeError(error)
      setNotice({ tone: 'error', text: `会话列表读取失败：${described.text}`, ...(described.code === undefined ? {} : { code: described.code }) })
    }
  }, [])

  useEffect(() => {
    void loadSessions()
    return () => {
      sessionToken.current += 1
    }
  }, [loadSessions])

  /** Load the document list for one session; returns what it found. */
  const loadDocs = useCallback(async (id: string, token?: number): Promise<DocEntry[]> => {
    const value = await apiGet<DocList>(`${API}/docs?sessionId=${encodeURIComponent(id)}`)
    const found = [...value.docs]
    if (token !== undefined && loadToken.current !== token) return found
    setDocs(found)
    setDir(value.dir)
    setDocsState('ready')
    return found
  }, [])

  /** Select a document and drop the previous body in the same update. */
  const selectDoc = useCallback((name: string): void => {
    setActiveName(name)
    setRaw('')
    setDocError('')
    setDocState(name === '' ? 'idle' : 'loading')
  }, [])

  // Switching sessions clears the pane immediately: showing the previous
  // session's document under a new title for a moment reads as a bug.
  useEffect(() => {
    if (sessionId === '') return
    storeChoice(SESSION_KEY, sessionId)
    setDocs([])
    setDir('')
    setActiveName('')
    setRaw('')
    setDocState('idle')
    setDocsState('loading')
    setDocsError('')
    const token = loadToken.current + 1
    loadToken.current = token
    void loadDocs(sessionId, token).catch((error: unknown) => {
      if (loadToken.current !== token) return
      const described = describeError(error)
      setDocsState('error')
      setDocsError(described.text)
    })
  }, [sessionId, loadDocs])

  // A list that arrives without a selection opens its newest document.
  useEffect(() => {
    if (docsState !== 'ready') return
    if (docs.length === 0) {
      if (activeName !== '') selectDoc('')
      return
    }
    if (!docs.some((doc) => doc.name === activeName)) {
      const newest = docs[0]
      if (newest !== undefined) selectDoc(newest.name)
    }
  }, [docs, docsState, activeName, selectDoc])

  const activeEntry = activeName === '' ? undefined : docs.find((doc) => doc.name === activeName)

  // The flash belongs to one document: switching away must not leave a stale
  // "已接续" label on the next one.
  useEffect(() => {
    activeNameRef.current = activeName
    setAttached(false)
  }, [activeName])

  useEffect(() => () => window.clearTimeout(attachTimer.current), [])

  const loadDoc = useCallback(
    async (id: string, name: string, token: number): Promise<void> => {
      setDocState('loading')
      setDocError('')
      try {
        const value = await apiGet<{ name: string; content: string }>(
          `${API}/doc?sessionId=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}`,
        )
        if (loadToken.current !== token) return
        setRaw(value.content)
        setDocState('ready')
      } catch (error) {
        if (loadToken.current !== token) return
        const described = describeError(error)
        setDocError(described.text)
        setDocState('error')
      }
    },
    [],
  )

  useEffect(() => {
    if (sessionId === '' || activeName === '') {
      setRaw('')
      return
    }
    const token = loadToken.current + 1
    loadToken.current = token
    void loadDoc(sessionId, activeName, token)
  }, [sessionId, activeName, loadDoc])

  const generate = useCallback(async (): Promise<void> => {
    if (sessionId === '' || busy) return
    setBusy(true)
    setNotice(null)
    const token = loadToken.current + 1
    loadToken.current = token
    try {
      const value = await apiPost<GenerateResult>(`${API}/generate`, { sessionId, focus: focus.trim() })
      if (loadToken.current !== token) return
      const created = value.path.split('/').pop() ?? ''
      const nextDocs = await loadDocs(sessionId, token)
      if (loadToken.current !== token) return
      setNotice({
        tone: 'ok',
        text: `交接文档已生成：v${value.version} · ${value.model} · ${value.messages} 条消息${
          value.truncated ? '（记录中段已省略）' : ''
        }`,
      })
      if (created !== '' && nextDocs.some((doc) => doc.name === created)) selectDoc(created)
    } catch (error) {
      if (loadToken.current !== token) return
      const described = describeError(error)
      setNotice({ tone: 'error', text: `生成失败：${described.text}`, ...(described.code === undefined ? {} : { code: described.code }) })
    } finally {
      // `busy` belongs to this invocation, not to the selection token: a user
      // who opens another document mid-generation must still get their button
      // back.
      setBusy(false)
    }
  }, [sessionId, focus, busy, loadDocs, selectDoc])

  const openAttach = useCallback((): void => {
    if (activeName === '' || attachBusy) return
    setNotice(null)
    setAttachOpen(true)
  }, [activeName, attachBusy])

  const closeAttach = useCallback((): void => {
    setAttachOpen(false)
  }, [])

  /**
   * Inject the open document into the picked session.
   *
   * The dialog closes first on purpose: the request must not freeze the panel,
   * so progress lives on the header button and the outcome on the notice bar.
   */
  const attachTo = useCallback(
    async (targetId: string): Promise<void> => {
      if (activeName === '' || attachBusy) return
      const nameAtStart = activeName
      setAttachOpen(false)
      setAttachBusy(true)
      setNotice(null)
      try {
        const value = await apiPost<AttachResult>(`${API}/attach`, { sessionId: targetId, name: nameAtStart })
        setNotice({
          tone: 'ok',
          text: `✅ 已接续《${value.name}》（${value.chars} 字${value.truncated ? '，已截断' : ''}）`,
        })
        if (activeNameRef.current === nameAtStart) {
          setAttached(true)
          window.clearTimeout(attachTimer.current)
          attachTimer.current = window.setTimeout(() => setAttached(false), 1600)
        }
      } catch (error) {
        const described = describeError(error)
        setNotice({
          tone: 'error',
          text: `接续失败：${described.text}`,
          ...(described.code === undefined ? {} : { code: described.code }),
        })
      } finally {
        setAttachBusy(false)
      }
    },
    [activeName, attachBusy],
  )

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (query === '') return docs
    return docs.filter((doc) => {
      const haystack = [doc.title ?? '', doc.name, doc.focus ?? '', doc.version === undefined ? '' : `v${doc.version}`]
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [docs, search])

  const onListKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End']
    if (!keys.includes(event.key)) return
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button.dh-item'))
    if (buttons.length === 0) return
    const current = buttons.findIndex((button) => button === document.activeElement)
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : event.key === 'ArrowDown'
            ? Math.min(buttons.length - 1, current + 1)
            : Math.max(0, current <= 0 ? 0 : current - 1)
    event.preventDefault()
    buttons[next]?.focus()
  }

  const onSession = (event: ChangeEvent<HTMLSelectElement>): void => {
    setSessionId(event.target.value)
    setNotice(null)
  }

  const retryDocs = (): void => {
    if (sessionId === '') return
    const token = loadToken.current + 1
    loadToken.current = token
    setDocsState('loading')
    setDocsError('')
    void loadDocs(sessionId, token).catch((error: unknown) => {
      if (loadToken.current !== token) return
      setDocsState('error')
      setDocsError(describeError(error).text)
    })
  }

  const retryDoc = (): void => {
    if (sessionId === '' || activeName === '') return
    const token = loadToken.current + 1
    loadToken.current = token
    void loadDoc(sessionId, activeName, token)
  }

  const listContent = ((): ReactNode => {
    if (docsState === 'loading' || docsState === 'idle') return h(SkeletonList, null)
    if (docsState === 'error') {
      return h(
        'div',
        { className: 'dh-empty' },
        h('div', { className: 'dh-empty-title' }, '文档列表读取失败'),
        h('p', { className: 'dh-empty-text' }, docsError),
        h('button', { type: 'button', className: 'dh-btn dh-btn-ghost dh-btn-sm', onClick: retryDocs }, h(IconRefresh, { size: 13 }), '重试'),
      )
    }
    if (docs.length === 0) {
      return h(EmptyState, { title: '还没有文档', text: '点上面的「生成交接文档」，把当前会话写成下一份能直接接手的 brief。' }, null)
    }
    if (filtered.length === 0) {
      return h(
        EmptyState,
        { title: '没有匹配的文档', text: `没有找到包含「${search.trim()}」的交接文档。` },
        h('button', { type: 'button', className: 'dh-btn dh-btn-ghost dh-btn-sm', onClick: () => setSearch('') }, '清除搜索'),
      )
    }
    return h(
      'div',
      { className: 'dh-items', onKeyDown: onListKeyDown },
      filtered.map((doc, index) => {
        const active = doc.name === activeName
        const title = doc.title ?? titleFromFileName(doc.name)
        return h(
          'button',
          {
            key: doc.name,
            type: 'button',
            className: 'dh-item',
            'aria-current': active ? 'true' : undefined,
            'data-active': active ? 'true' : 'false',
            title: doc.name,
            onClick: () => selectDoc(doc.name),
          },
          h(
            'div',
            { className: 'dh-item-top' },
            doc.version === undefined ? null : h('span', { className: 'dh-version' }, `v${doc.version}`),
            h('span', { className: 'dh-item-title' }, title),
            index === 0 && search.trim() === '' ? h('span', { className: 'dh-badge-new' }, '最新') : null,
          ),
          h(
            'div',
            { className: 'dh-item-meta' },
            `${relativeTime(doc.modifiedAt)} · ${fileSizeText(doc.size)}${doc.focus === undefined || doc.focus === '' ? '' : ` · ${clip(doc.focus, 18)}`}`,
          ),
        )
      }),
    )
  })()

  const showEmptySessions = sessionsState === 'ready' && sessions.length === 0

  return h(
    'div',
    { className: 'dh-root' },
    h('style', { key: 'dh-style' }, CSS),
    h(
      'header',
      { className: 'dh-head' },
      h(
        'div',
        null,
        h(
          'div',
          { className: 'dh-title' },
          h('span', { className: 'dh-title-mark' }, h(IconHandoff, { size: 15 })),
          '交接文档',
        ),
        h('div', { className: 'dh-sub' }, '把当前会话写成下一个会话能直接接手的 markdown，落到 .dsh/handoff/。'),
      ),
      h(
        'div',
        { className: 'dh-session' },
        h('label', { className: 'dh-label', htmlFor: 'dh-session' }, '会话'),
        h(
          'div',
          { className: 'dh-selectwrap' },
          h(
            'select',
            {
              id: 'dh-session',
              className: 'dh-select',
              value: sessionId,
              onChange: onSession,
              disabled: sessions.length === 0,
              title: sessions.length === 0 ? '当前进程里没有活动会话' : '选择要写成交接文档的会话',
            },
            sessions.length === 0
              ? h('option', { value: '' }, '没有活动会话')
              : sessions.map((session) =>
                  h('option', { key: session.id, value: session.id }, `${session.title}（${session.messages} 条）`),
                ),
          ),
          h(IconChevronDown, { size: 13, className: 'dh-select-icon' }),
        ),
      ),
    ),
    h(
      'div',
      { className: 'dh-compose' },
      h('span', { className: 'dh-compose-icon' }, h(IconSparkle, { size: 14 })),
      h('input', {
        className: 'dh-compose-input',
        value: focus,
        placeholder: '关注点（可省略）：例如「重点写测试和没修完的 bug」',
        'aria-label': '交接文档关注点',
        onChange: (event: ChangeEvent<HTMLInputElement>) => setFocus(event.target.value),
        onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) void generate()
        },
        disabled: busy,
      }),
      h('span', { className: 'dh-compose-meta' }, '留空则由模型判断重点'),
      h(
        'button',
        {
          type: 'button',
          className: 'dh-btn dh-btn-primary',
          disabled: busy || sessionId === '',
          onClick: () => void generate(),
        },
        busy ? h(IconLoader, { size: 13, className: 'dh-spin' }) : h(IconSparkle, { size: 13 }),
        busy ? '生成中…' : '生成交接文档',
      ),
    ),
    notice === null ? null : h(NoticeBar, { notice, onDismiss: () => setNotice(null) }),
    sessionsState === 'error'
      ? h(
          EmptyState,
          {
            title: '会话列表读取失败',
            text: '本地服务没有返回会话列表。重试一次；仍然失败的话，重启 Harness 后再打开这一页。',
          },
          h(
            'button',
            { type: 'button', className: 'dh-btn dh-btn-ghost dh-btn-sm', onClick: () => void loadSessions() },
            h(IconRefresh, { size: 13 }),
            '重试',
          ),
        )
      : showEmptySessions
      ? h(
          EmptyState,
          { title: '没有活动会话', text: '当前进程里还没有会话。开一个新会话聊几句，再回来生成交接文档。' },
          null,
        )
      : h(
          'div',
          { className: 'dh-body' },
          h(
            'aside',
            { className: 'dh-list' },
            h(
              'div',
              { className: 'dh-list-head' },
              h('span', { className: 'dh-list-title' }, '历史文档', h('span', { className: 'dh-count' }, ` ${filtered.length}/${docs.length}`)),
              h(
                'div',
                { style: { display: 'flex', gap: 2 } },
                h(
                  'button',
                  { type: 'button', className: 'dh-iconbtn', title: '刷新列表', 'aria-label': '刷新列表', onClick: retryDocs, disabled: docsState === 'loading' },
                  h(IconRefresh, { size: 13 }),
                ),
              ),
            ),
            h(
              'div',
              { className: 'dh-searchwrap' },
              h(IconSearch, { size: 13, className: 'dh-search-icon' }),
              h('input', {
                className: 'dh-search',
                value: search,
                placeholder: '搜索标题、版本或文件名',
                'aria-label': '搜索交接文档',
                onChange: (event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value),
              }),
              search === ''
                ? null
                : h(
                    'button',
                    { type: 'button', className: 'dh-iconbtn dh-search-clear', title: '清除搜索', 'aria-label': '清除搜索', onClick: () => setSearch('') },
                    h(IconClose, { size: 11 }),
                  ),
            ),
            listContent,
            dir === ''
              ? null
              : h(
                  'div',
                  { className: 'dh-list-foot', title: dir },
                  h('span', null, '目录'),
                  h('span', { className: 'dh-dir' }, dir),
                ),
          ),
          h(DocumentPane, {
            entry: activeEntry,
            state: activeName === '' ? 'idle' : docState,
            error: docError,
            raw,
            mode,
            onMode: setMode,
            onRetry: retryDoc,
            attachBusy,
            attached,
            onAttach: openAttach,
          }),
        ),
    attachOpen && activeEntry !== undefined
      ? h(AttachDialog, {
          sessions,
          docTitle: activeEntry.title ?? titleFromFileName(activeEntry.name),
          docName: activeEntry.name,
          onCancel: closeAttach,
          onConfirm: (targetId: string) => void attachTo(targetId),
        })
      : null,
  )
}

/** Re-exported for the config card, which shares the page's shell. */
export { CSS }
