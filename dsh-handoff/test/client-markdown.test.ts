import { describe, expect, it } from 'vitest'
import { clip, fileSizeText, relativeTime, titleFromFileName } from '../src/client/format.ts'
import { inlineText, openingLine, parseDocument, parseInline } from '../src/client/markdown.ts'

const DOCUMENT = [
  '---',
  'title: "重构登录模块"',
  'session: "session-1"',
  'created: "2026-10-26T08:58:33+08:00"',
  'version: 2',
  'provider: p',
  'model: m',
  'focus: "重点写测试"',
  '---',
  '',
  '# 交接文档 · 重构登录模块',
  '',
  '> v2 · 生成于 2026-10-26 08:58:33 +08:00',
  '',
  '## 任务',
  '',
  '把登录改成 **双因素**，见 [设计稿](https://example.com/a)。',
  '',
  '- 完成 A',
  '- [x] 完成 B',
  '',
  '```ts',
  'const a = 1',
  '```',
  '',
  '| 项 | 状态 |',
  '| --- | --- |',
  '| A | 完成 |',
  '',
  '> 注意会话过期',
  '',
  '## 给下一个会话的开场白',
  '',
  '接着做测试：先跑 `pnpm test`。',
].join('\n')

describe('parseDocument', () => {
  it('splits front matter, keeps the title, and parses the body', () => {
    const parsed = parseDocument(DOCUMENT)
    expect(parsed.meta).toMatchObject({ title: '重构登录模块', version: '2', model: 'm', focus: '重点写测试' })
    expect(parsed.title).toBe('交接文档 · 重构登录模块')
    expect(parsed.blocks.map((block) => block.kind)).toEqual([
      'heading',
      'quote',
      'heading',
      'paragraph',
      'list',
      'code',
      'table',
      'quote',
      'heading',
      'paragraph',
    ])
  })

  it('marks task items and their checked state', () => {
    const list = parseDocument(DOCUMENT).blocks.find((block) => block.kind === 'list')
    expect(list?.kind).toBe('list')
    if (list?.kind !== 'list') return
    expect(list.items).toHaveLength(2)
    expect(list.items[0]?.checked).toBeUndefined()
    expect(list.items[1]?.checked).toBe(true)
  })

  it('keeps fence language and code verbatim', () => {
    const code = parseDocument(DOCUMENT).blocks.find((block) => block.kind === 'code')
    expect(code).toEqual({ kind: 'code', lang: 'ts', code: 'const a = 1' })
  })

  it('reads a table with a header row and body rows', () => {
    const table = parseDocument(DOCUMENT).blocks.find((block) => block.kind === 'table')
    expect(table?.kind).toBe('table')
    if (table?.kind !== 'table') return
    expect(inlineText(table.head[0] ?? [])).toBe('项')
    expect(inlineText(table.rows[0]?.[1] ?? [])).toBe('完成')
  })

  it('surfaces the opening line as copyable text', () => {
    expect(openingLine(parseDocument(DOCUMENT).blocks)).toBe('接着做测试：先跑 `pnpm test`。'.replace(/`/gu, ''))
  })

  it('returns no opening text when the section is absent', () => {
    expect(openingLine(parseDocument('## 任务\n\n做点什么').blocks)).toBe('')
  })
})

describe('parseInline', () => {
  it('recognises code, emphasis, strike and links', () => {
    expect(parseInline('a `b` **c** *d* ~~e~~ [f](https://x.test)')).toEqual([
      { kind: 'text', text: 'a ' },
      { kind: 'code', text: 'b' },
      { kind: 'text', text: ' ' },
      { kind: 'strong', children: [{ kind: 'text', text: 'c' }] },
      { kind: 'text', text: ' ' },
      { kind: 'em', children: [{ kind: 'text', text: 'd' }] },
      { kind: 'text', text: ' ' },
      { kind: 'del', children: [{ kind: 'text', text: 'e' }] },
      { kind: 'text', text: ' ' },
      { kind: 'link', href: 'https://x.test', children: [{ kind: 'text', text: 'f' }] },
    ])
  })

  it('keeps an unsafe link target out of the link position', () => {
    const nodes = parseInline('[x](javascript:alert(1))')
    expect(nodes.some((node) => node.kind === 'link')).toBe(false)
  })

  it('leaves unmatched markers alone', () => {
    expect(parseInline('2 * 3 = 6')).toEqual([{ kind: 'text', text: '2 * 3 = 6' }])
  })
})

describe('format helpers', () => {
  it('formats sizes in binary units', () => {
    expect(fileSizeText(0)).toBe('0 B')
    expect(fileSizeText(900)).toBe('900 B')
    expect(fileSizeText(1536)).toBe('1.5 KB')
    expect(fileSizeText(3 * 1024 * 1024)).toBe('3 MB')
  })

  it('formats relative time across the day boundary', () => {
    const now = new Date(2026, 9, 26, 12, 0, 0).getTime()
    expect(relativeTime(now - 30_000, now)).toBe('刚刚')
    expect(relativeTime(now - 12 * 60_000, now)).toBe('12 分钟前')
    expect(relativeTime(now - 3 * 3_600_000, now)).toBe('3 小时前')
    expect(relativeTime(new Date(2026, 9, 25, 9, 30).getTime(), now)).toBe('昨天 09:30')
    expect(relativeTime(new Date(2026, 8, 1, 9, 30).getTime(), now)).toBe('9月1日 09:30')
    expect(relativeTime(new Date(2025, 0, 2, 9, 30).getTime(), now)).toBe('2025年1月2日')
  })

  it('clips on a character boundary', () => {
    expect(clip('abcdef', 4)).toBe('abc…')
    expect(clip('abc', 4)).toBe('abc')
  })

  it('recovers a readable title from a generated file name', () => {
    expect(titleFromFileName('handoff-20261026-085833-补测试.md')).toBe('补测试')
    expect(titleFromFileName('handoff-20261026-085833-refactor-login.md')).toBe('refactor login')
    expect(titleFromFileName('custom.md')).toBe('custom')
  })
})
