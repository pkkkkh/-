/**
 * A deliberately small markdown reader for handoff documents.
 *
 * The Host ships a full markdown renderer, but it expects a sizable label
 * bundle and the transcript typography; a handoff is a short, predictable
 * document, so a local parser keeps the panel independent and lets the preview
 * style its own sections. Everything is returned as data and rendered as React
 * elements — never as HTML — so a document can not inject markup.
 */
import { splitFrontMatter } from '../markdown.ts'

export interface InlineText {
  readonly kind: 'text'
  readonly text: string
}

export interface InlineCode {
  readonly kind: 'code'
  readonly text: string
}

export interface InlineEmphasis {
  readonly kind: 'strong' | 'em' | 'del'
  readonly children: readonly Inline[]
}

export interface InlineLink {
  readonly kind: 'link'
  readonly href: string
  readonly children: readonly Inline[]
}

export type Inline = InlineText | InlineCode | InlineEmphasis | InlineLink

export interface ListItem {
  readonly inline: readonly Inline[]
  /** Present only for a task list item. */
  readonly checked?: boolean
  /** 0 for the outermost list, 1 for one nested level. */
  readonly depth: number
}

export type Block =
  | { readonly kind: 'heading'; readonly level: 1 | 2 | 3 | 4 | 5 | 6; readonly inline: readonly Inline[] }
  | { readonly kind: 'paragraph'; readonly inline: readonly Inline[] }
  | { readonly kind: 'list'; readonly ordered: boolean; readonly items: readonly ListItem[] }
  | { readonly kind: 'code'; readonly lang: string; readonly code: string }
  | { readonly kind: 'quote'; readonly blocks: readonly Block[] }
  | { readonly kind: 'table'; readonly head: readonly (readonly Inline[])[]; readonly rows: readonly (readonly (readonly Inline[])[])[] }
  | { readonly kind: 'hr' }

export interface ParsedDocument {
  readonly meta: Record<string, string>
  readonly blocks: readonly Block[]
  /** The first level-one heading, used as a fallback title. */
  readonly title?: string
}

const SAFE_HREF = /^(?:https?:|mailto:|#|\/)/iu

/** Split inline markdown into data. Unknown syntax stays literal text. */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = []
  const pattern = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(~~[^~\n]+~~)|(\[[^\]\n]+\]\([^)\s]+\))/gu
  let cursor = 0
  for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
    if (match.index > cursor) out.push({ kind: 'text', text: text.slice(cursor, match.index) })
    const token = match[0]
    if (match[1] !== undefined) out.push({ kind: 'code', text: token.slice(1, -1) })
    else if (match[2] !== undefined || match[3] !== undefined) {
      out.push({ kind: 'strong', children: parseInline(token.slice(2, -2)) })
    } else if (match[4] !== undefined || match[5] !== undefined) {
      out.push({ kind: 'em', children: parseInline(token.slice(1, -1)) })
    } else if (match[6] !== undefined) {
      out.push({ kind: 'del', children: parseInline(token.slice(2, -2)) })
    } else if (match[7] !== undefined) {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/u.exec(token)
      const label = link?.[1] ?? token
      const href = link?.[2] ?? ''
      out.push(SAFE_HREF.test(href) ? { kind: 'link', href, children: parseInline(label) } : { kind: 'text', text: label })
    }
    cursor = match.index + token.length
  }
  if (cursor < text.length) out.push({ kind: 'text', text: text.slice(cursor) })
  return out
}

/** Plain text of inline content — for copy buttons and search. */
export function inlineText(inline: readonly Inline[]): string {
  return inline
    .map((node) => {
      switch (node.kind) {
        case 'text':
        case 'code':
          return node.text
        case 'strong':
        case 'em':
        case 'del':
          return inlineText(node.children)
        case 'link':
          return inlineText(node.children)
        default:
          return ''
      }
    })
    .join('')
}

const HEADING = /^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/u
const FENCE = /^```([\w+#.-]*)[ \t]*$/u
const UL_ITEM = /^([ \t]*)[-*+][ \t]+(.*)$/u
const OL_ITEM = /^([ \t]*)(\d{1,9})[.)][ \t]+(.*)$/u
const TASK = /^\[([ xX])\][ \t]+(.*)$/u
const QUOTE = /^>[ \t]?(.*)$/u
const HR = /^[ \t]{0,3}(?:-{3,}|\*{3,}|_{3,})[ \t]*$/u
const TABLE_SEPARATOR = /^[ \t]*\|?[ \t]*:?-{2,}:?[ \t]*(?:\|[ \t]*:?-{2,}:?[ \t]*)*\|?[ \t]*$/u

function tableCells(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/u, '').replace(/\|$/u, '')
  return trimmed.split('|').map((cell) => cell.trim())
}

/** Indentation width → nesting depth (two spaces or one tab per level). */
function depthOf(indent: string): number {
  const spaces = indent.replace(/\t/gu, '  ').length
  return Math.min(3, Math.floor(spaces / 2))
}

/** Parse a document body into blocks. Front matter is returned separately. */
export function parseDocument(raw: string): ParsedDocument {
  const { meta, body } = splitFrontMatter(raw)
  const lines = body.split(/\r?\n/u)
  const blocks: Block[] = []
  let title: string | undefined
  let index = 0

  const pushParagraph = (parts: string[]): void => {
    const text = parts.join('\n').trim()
    if (text !== '') blocks.push({ kind: 'paragraph', inline: parseInline(text) })
  }

  while (index < lines.length) {
    const line = lines[index] ?? ''
    index += 1

    if (line.trim() === '') continue

    const fence = FENCE.exec(line.trim())
    if (fence !== null) {
      const code: string[] = []
      while (index < lines.length && (lines[index] ?? '').trim() !== '```') {
        code.push(lines[index] ?? '')
        index += 1
      }
      index += 1
      blocks.push({ kind: 'code', lang: fence[1] ?? '', code: code.join('\n') })
      continue
    }

    const heading = HEADING.exec(line)
    if (heading !== null) {
      const level = Math.min(6, (heading[1] ?? '#').length) as 1 | 2 | 3 | 4 | 5 | 6
      const inline = parseInline((heading[2] ?? '').trim())
      if (level === 1 && title === undefined) title = inlineText(inline)
      blocks.push({ kind: 'heading', level, inline })
      continue
    }

    if (HR.test(line)) {
      blocks.push({ kind: 'hr' })
      continue
    }

    if (line.trimStart().startsWith('|') && TABLE_SEPARATOR.test(lines[index] ?? '')) {
      const head = tableCells(line).map((cell) => parseInline(cell))
      index += 1
      const rows: Inline[][][] = []
      while (index < lines.length && (lines[index] ?? '').trimStart().startsWith('|')) {
        rows.push(tableCells(lines[index] ?? '').map((cell) => parseInline(cell)))
        index += 1
      }
      blocks.push({ kind: 'table', head, rows })
      continue
    }

    if (QUOTE.test(line)) {
      const inner: string[] = [(QUOTE.exec(line)?.[1] ?? '').trim()]
      while (index < lines.length) {
        const next = lines[index] ?? ''
        if (!QUOTE.test(next)) break
        inner.push((QUOTE.exec(next)?.[1] ?? '').trim())
        index += 1
      }
      blocks.push({ kind: 'quote', blocks: parseDocument(inner.join('\n')).blocks })
      continue
    }

    if (UL_ITEM.test(line) || OL_ITEM.test(line)) {
      const ordered = !UL_ITEM.test(line)
      const items: ListItem[] = []
      let current: string | undefined = line
      while (current !== undefined) {
        const item = ordered ? OL_ITEM.exec(current) : UL_ITEM.exec(current)
        if (item === null) break
        const depth = depthOf(item[1] ?? '')
        let text = (ordered ? item[3] ?? '' : item[2] ?? '').trim()
        const task = TASK.exec(text)
        const checked = task === null ? undefined : (task[1] ?? '').trim().toLowerCase() === 'x'
        if (task !== null) text = task[2] ?? ''
        while (index < lines.length) {
          const next = lines[index] ?? ''
          if (
            next.trim() === '' ||
            UL_ITEM.test(next) ||
            OL_ITEM.test(next) ||
            HEADING.test(next) ||
            FENCE.test(next.trim()) ||
            QUOTE.test(next) ||
            HR.test(next) ||
            next.trimStart().startsWith('|')
          ) {
            break
          }
          text += ` ${next.trim()}`
          index += 1
        }
        const inline = parseInline(text)
        items.push(checked === undefined ? { inline, depth } : { inline, depth, checked })
        current = lines[index]
        if (current !== undefined && (ordered ? OL_ITEM.test(current) : UL_ITEM.test(current))) index += 1
        else current = undefined
      }
      blocks.push({ kind: 'list', ordered, items })
      continue
    }

    const paragraph: string[] = [line]
    while (index < lines.length) {
      const next = lines[index] ?? ''
      if (
        next.trim() === '' ||
        HEADING.test(next) ||
        FENCE.test(next.trim()) ||
        HR.test(next) ||
        QUOTE.test(next) ||
        UL_ITEM.test(next) ||
        OL_ITEM.test(next) ||
        next.trimStart().startsWith('|')
      ) {
        break
      }
      paragraph.push(next)
      index += 1
    }
    pushParagraph(paragraph)
  }

  return title === undefined ? { meta, blocks } : { meta, blocks, title }
}

/** Everything the opening-line section contains, for its copy button. */
export function openingLine(blocks: readonly Block[]): string {
  const start = blocks.findIndex((block) => block.kind === 'heading' && /开场白|opening line/iu.test(inlineText(block.inline)))
  if (start < 0) return ''
  const parts: string[] = []
  for (const block of blocks.slice(start + 1)) {
    if (block.kind === 'heading') break
    if (block.kind === 'paragraph') parts.push(inlineText(block.inline))
    else if (block.kind === 'quote') parts.push(block.blocks.map((inner) => (inner.kind === 'paragraph' ? inlineText(inner.inline) : '')).join(' '))
  }
  return parts.join('\n\n').trim()
}
