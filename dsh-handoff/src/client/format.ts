/**
 * Small presentation helpers for the handoff panel.
 *
 * Kept free of React and of the Host's modules so the panel renders the same
 * under the web client, under `renderToStaticMarkup` in tests, and nowhere else.
 */

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** `3 KB`, `1.4 MB` — binary units, one decimal only when it helps. */
export function fileSizeText(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1).replace(/\.0$/u, '') : Math.round(kb)} KB`
  return `${(kb / 1024).toFixed(1).replace(/\.0$/u, '')} MB`
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** `2026-10-26 08:58` in the browser's own time zone. */
export function dateTimeText(at: number): string {
  const date = new Date(at)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** `2026-10-26` — for metadata strips where the minute does not matter. */
export function dateText(at: number): string {
  const date = new Date(at)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * `刚刚` / `12 分钟前` / `昨天 08:58` / `10月26日 08:58` / `2025年10月26日`.
 *
 * A handoff is read minutes after it is written, so the near range is worth
 * spelling out; anything older gets a date the reader can place.
 */
export function relativeTime(at: number, now = Date.now()): string {
  const delta = now - at
  if (!Number.isFinite(delta)) return ''
  if (delta < MINUTE) return '刚刚'
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)} 分钟前`
  if (delta < DAY) return `${Math.floor(delta / HOUR)} 小时前`

  const date = new Date(at)
  const today = new Date(now)
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  if (at >= startOfToday - DAY) return `昨天 ${pad(date.getHours())}:${pad(date.getMinutes())}`
  if (date.getFullYear() === today.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`
  }
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

/** Trim to `max` characters on a word-free boundary that keeps CJK intact. */
export function clip(text: string, max: number): string {
  const value = text.trim()
  return value.length <= max ? value : `${value.slice(0, Math.max(1, max - 1))}…`
}

/** `provider/model` as written in the front matter, or `未知模型`. */
export function modelText(provider?: string, model?: string): string {
  const value = [provider, model].filter((part) => part !== undefined && part !== '').join('/')
  return value === '' ? '未知模型' : value
}

/** Copy text to the clipboard, tolerating a browser that only offers the old path. */
export async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard !== undefined && navigator.clipboard.writeText !== undefined) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to the selection copy used before `navigator.clipboard`.
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const done = document.execCommand('copy')
    document.body.removeChild(area)
    return done
  } catch {
    return false
  }
}

/** Trigger a browser download for generated text. */
export function downloadText(name: string, text: string): void {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** `handoff-20261026-085833-补测试.md` → `补测试`, with a readable fallback. */
export function titleFromFileName(name: string): string {
  const bare = name.replace(/\.md$/u, '')
  const match = /^\w+?-(\d{8})-(\d{6})-(.+)$/u.exec(bare)
  const slug = match?.[3]?.replace(/-/gu, ' ').trim() ?? ''
  return slug === '' ? bare : slug
}
