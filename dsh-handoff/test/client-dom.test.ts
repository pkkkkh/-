// @vitest-environment jsdom
/**
 * Mounts the real page against stubbed routes.
 *
 * The static-markup tests cover registration and the first paint; this one runs
 * the effects that fetch sessions, list documents, and render a document, so a
 * crash in the data path fails the suite instead of showing up as a blank panel.
 */
import { writeFileSync } from 'node:fs'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Page } from '../src/client/page.ts'

// React only suppresses its "not configured to support act" warning when this
// flag is set; the flag is read at render time, not at import time.
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const DOCUMENT = [
  '---',
  'title: "重构登录模块"',
  'session: "session-1"',
  'cwd: "C:/ws"',
  'created: "2026-10-26T08:58:33+08:00"',
  'updated: "2026-10-26T08:58:33+08:00"',
  'version: 2',
  'previous: "handoff-20261025-214005-重构登录模块.md"',
  'provider: deepseek-account',
  'model: deepseek-flash',
  'messages: 12',
  'focus: "重点写测试"',
  'generator: dsh-handoff@0.4.0',
  '---',
  '',
  '# 交接文档 · 重构登录模块',
  '',
  '> v2 · 生成于 2026-10-26 08:58:33 +08:00 · 会话最后活动 2026-10-26 08:57:12 +08:00',
  '',
  '## 任务',
  '',
  '把登录改成 **双因素**，见 [设计稿](https://example.com/a)。',
  '',
  '## 已完成',
  '',
  '- 登录页改造完成',
  '- [x] 单元测试补齐',
  '',
  '```ts',
  'export const enabled = true',
  '```',
  '',
  '| 项 | 状态 |',
  '| --- | --- |',
  '| 双因素开关 | 完成 |',
  '',
  '## 给下一个会话的开场白',
  '',
  '接着做测试：先跑 `pnpm test`。',
].join('\n')

const DOCS = [
  {
    name: 'handoff-20261026-085833-登录.md',
    path: '.dsh/handoff/handoff-20261026-085833-登录.md',
    size: 2048,
    modifiedAt: Date.now() - 12 * 60_000,
    title: '重构登录模块',
    version: 2,
    focus: '重点写测试',
    provider: 'deepseek-account',
    model: 'deepseek-flash',
    messages: 12,
  },
  {
    name: 'handoff-20261025-214005-登录.md',
    path: '.dsh/handoff/handoff-20261025-214005-登录.md',
    size: 1024,
    modifiedAt: Date.now() - 26 * 60 * 60_000,
    title: '登录模块初稿',
    version: 1,
  },
]

function respond(value: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ ok: true, value }),
  } as unknown as Response
}

function respondError(code: string, message: string): Response {
  return {
    ok: false,
    status: 200,
    json: async () => ({ ok: false, error: { code, message } }),
  } as unknown as Response
}

interface RouteOptions {
  /** Sessions the picker may choose from; defaults to the one from the fixture. */
  readonly sessions?: readonly unknown[]
  /** Value `/attach` answers with when it succeeds. */
  readonly attach?: unknown
  /** Make `/attach` fail with this stable code. */
  readonly attachError?: { readonly code: string; readonly message: string }
  /** Observe every request the page sends. */
  readonly onFetch?: (url: string, init?: RequestInit) => void
}

function installRoutes(options: RouteOptions = {}): void {
  const fetchStub = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    options.onFetch?.(url, init)
    if (url.endsWith('/attach')) {
      if (options.attachError !== undefined) return respondError(options.attachError.code, options.attachError.message)
      return respond(options.attach ?? { name: DOCS[0]?.name, chars: 0, truncated: false })
    }
    if (url.includes('/sessions')) {
      return respond({
        sessions: options.sessions ?? [{ id: 'session-1', cwd: 'C:/ws', title: '重构登录', messages: 12 }],
      })
    }
    if (url.includes('/docs?')) return respond({ dir: 'C:/ws/.dsh/handoff', docs: DOCS })
    if (url.includes('/doc?')) return respond({ name: DOCS[0]?.name, content: DOCUMENT })
    throw new Error(`unexpected fetch ${url}`)
  })
  vi.stubGlobal('fetch', fetchStub)
}

async function flush(rounds = 6): Promise<void> {
  for (let index = 0; index < rounds; index += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }
}

async function mount(): Promise<HTMLElement> {
  const container = document.createElement('div')
  container.id = 'mount'
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(createElement(Page))
  })
  await flush()
  return container
}

/** Set a controlled input's value the way a keystroke would. */
async function type(input: HTMLInputElement, value: string): Promise<void> {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, value)
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
}

/** Dispatch a real click through React's delegated listener. */
async function click(element: Element | null | undefined): Promise<void> {
  await act(async () => {
    element?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('handoff panel against live-shaped data', () => {
  it('loads sessions, lists documents, and opens the newest one', async () => {
    installRoutes()
    const container = await mount()
    const text = container.textContent ?? ''

    expect(text).toContain('重构登录')
    expect(text).toContain('历史文档')
    expect(text).toContain('重构登录模块')
    expect(text).toContain('v2')
    expect(text).toContain('最新')
    expect(text).toContain('deepseek-account/deepseek-flash')
    expect(text).toContain('关注点：重点写测试')
    expect(text).toContain('上一份')
    expect(container.querySelectorAll('button.dh-item')).toHaveLength(2)
  })

  it('renders the document body, including its opening-line card', async () => {
    installRoutes()
    const container = await mount()
    expect(container.querySelector('.dh-doc h2')?.textContent).toBe('任务')
    expect(container.querySelector('.dh-doc strong')?.textContent).toBe('双因素')
    expect(container.querySelector('.dh-doc .dh-inline-code')?.textContent).toBe('pnpm test')
    expect(container.querySelector('table th')?.textContent).toBe('项')
    expect(container.querySelector('.dh-code code')?.textContent).toContain('export const enabled')
    expect(container.querySelector('.dh-task span.dh-check')?.getAttribute('data-checked')).toBe('true')
    const opening = container.querySelector('.dh-opening')
    expect(opening?.textContent).toContain('给下一个会话的开场白')
    expect(opening?.textContent).toContain('可直接粘贴')
  })

  it('switches between the rendered view and the raw markdown', async () => {
    installRoutes()
    const container = await mount()
    const toggle = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('原文'))
    expect(toggle).toBeDefined()
    await act(async () => {
      toggle?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    })
    expect(container.querySelector('pre.dh-raw')?.textContent).toContain('---')
    expect(container.querySelector('.dh-doc')).toBeNull()

    const back = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('预览'))
    await act(async () => {
      back?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    })
    expect(container.querySelector('.dh-doc')).not.toBeNull()
  })

  it('filters the list by search and shows an empty result state', async () => {
    installRoutes()
    const container = await mount()
    const search = container.querySelector('input.dh-search')
    expect(search).not.toBeNull()
    if (!(search instanceof window.HTMLInputElement)) return

    await type(search, '不存在的标题')
    expect(container.querySelectorAll('button.dh-item')).toHaveLength(0)
    expect(container.textContent).toContain('没有匹配的文档')

    await type(search, '初稿')
    expect(container.querySelectorAll('button.dh-item')).toHaveLength(1)
  })

  it('marks the row the reader picked as current', async () => {
    installRoutes()
    const container = await mount()
    const rows = [...container.querySelectorAll('button.dh-item')]
    expect(rows).toHaveLength(2)
    await act(async () => {
      rows[1]?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    })
    await flush()
    expect(rows[1]?.getAttribute('data-active')).toBe('true')
    expect(rows[0]?.getAttribute('data-active')).toBe('false')
  })

  it('opens the attach layer, defaults to the busiest session, and injects', async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    installRoutes({
      sessions: [
        { id: 'session-1', cwd: 'C:/ws', title: '重构登录', messages: 12 },
        { id: 'session-2', cwd: 'C:/ws2', title: '接续目标', messages: 40 },
      ],
      attach: { name: DOCS[0]?.name, chars: 1234, truncated: false },
      onFetch: (url, init) => calls.push(init === undefined ? { url } : { url, init }),
    })
    const container = await mount()

    const attachButton = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('接续到会话'),
    )
    expect(attachButton).toBeDefined()
    await click(attachButton)

    const dialog = container.querySelector('.dh-dialog')
    expect(dialog).not.toBeNull()
    expect(dialog?.getAttribute('role')).toBe('dialog')
    expect(dialog?.textContent).toContain('不产生用户消息')
    expect(dialog?.textContent).toContain('30000')
    expect(dialog?.textContent).toContain('取消')

    const select = container.querySelector<HTMLSelectElement>('#dh-attach-session')
    expect(select?.value).toBe('session-2')
    expect(select?.textContent).toContain('接续目标')
    expect(select?.textContent).toContain('40 条消息')

    const confirm = [...(dialog?.querySelectorAll('button') ?? [])].find((button) =>
      button.textContent?.includes('确认注入'),
    )
    await click(confirm)
    await flush()

    const posted = calls.find((entry) => entry.url.endsWith('/attach'))
    expect(posted).toBeDefined()
    expect(JSON.parse(String(posted?.init?.body))).toEqual({ sessionId: 'session-2', name: DOCS[0]?.name })
    expect(container.textContent).toContain('✅ 已接续')
    expect(container.textContent).toContain('1234 字')
    expect(container.querySelector('.dh-dialog')).toBeNull()
    expect([...container.querySelectorAll('button')].some((button) => button.textContent?.includes('已接续'))).toBe(true)
  })

  it('shows the Chinese reason for an attach failure code', async () => {
    installRoutes({
      attachError: { code: 'NO_AGENT', message: '这个会话当前没有活动实例，请先给它发一条消息激活。' },
    })
    const container = await mount()
    await click([...container.querySelectorAll('button')].find((button) => button.textContent?.includes('接续到会话')))

    const confirm = [...container.querySelectorAll('.dh-dialog button')].find((button) =>
      button.textContent?.includes('确认注入'),
    )
    await click(confirm)
    await flush()

    expect(container.textContent).toContain('接续失败')
    expect(container.textContent).toContain('这个会话当前没有活动实例')
    expect(container.textContent).toContain('NO_AGENT')
    expect(container.querySelector('.dh-dialog')).toBeNull()
  })

  it('can dump its markup for a visual review', async () => {
    installRoutes()
    const container = await mount()
    const out = process.env.PANEL_HTML_OUT
    if (out !== undefined && out !== '') writeFileSync(out, container.innerHTML, 'utf8')
    expect(container.querySelector('.dh-root')).not.toBeNull()
  })
})
