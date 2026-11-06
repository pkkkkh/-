/** Inline glyphs for the panel: 16px grid, 1.4px stroke, `currentColor`. */
import { createElement as h } from 'react'
import type { ReactElement, ReactNode } from 'react'

export interface IconProps {
  readonly size?: number | undefined
  readonly className?: string | undefined
  readonly strokeWidth?: number | undefined
}

type IconComponent = (props: IconProps) => ReactElement

function draw(children: ReactNode, viewBox: string, defaultSize: number): IconComponent {
  return (props) =>
    h(
      'svg',
      {
        width: props.size ?? defaultSize,
        height: props.size ?? defaultSize,
        viewBox,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: props.strokeWidth ?? 1.4,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        className: props.className,
        'aria-hidden': true,
        focusable: false,
      },
      children,
    )
}

const make = (children: ReactNode, defaultSize = 16): IconComponent => draw(children, '0 0 16 16', defaultSize)

/** The sidebar row and the panel title share this mark: a page passed on. */
export const IconHandoff = make([
  h('path', { key: 'page', d: 'M3.2 2.2h6.1L12.8 5.7v8.1H3.2z' }),
  h('path', { key: 'fold', d: 'M9.3 2.2v3.5h3.5' }),
  h('path', { key: 'line1', d: 'M5.4 8.2h4.2' }),
  h('path', { key: 'line2', d: 'M5.4 11.2h2.6' }),
])

export const IconSearch = make([
  h('circle', { key: 'c', cx: '7.2', cy: '7.2', r: '4.2' }),
  h('path', { key: 'l', d: 'M10.4 10.4 13.4 13.4' }),
])

export const IconRefresh = make([
  h('path', { key: 'a', d: 'M13 8a5 5 0 1 1-1.6-3.7' }),
  h('path', { key: 'b', d: 'M13.2 2.6v3.1h-3.1' }),
])

export const IconCopy = make([
  h('rect', { key: 'a', x: '5.6', y: '5.6', width: '7.6', height: '7.6', rx: '1.4' }),
  h('path', {
    key: 'b',
    d: 'M10.4 5.6V4.2a1.4 1.4 0 0 0-1.4-1.4H4.2a1.4 1.4 0 0 0-1.4 1.4v4.8a1.4 1.4 0 0 0 1.4 1.4h1.4',
  }),
])

export const IconDownload = make([
  h('path', { key: 'a', d: 'M8 2.4v7.6' }),
  h('path', { key: 'b', d: 'M5 7.2 8 10.2l3-3' }),
  h('path', { key: 'c', d: 'M2.9 11.6v1.4a1 1 0 0 0 1 1h8.2a1 1 0 0 0 1-1v-1.4' }),
])

export const IconCheck = make([h('path', { key: 'a', d: 'M3.2 8.4 6.4 11.6 12.8 4.6' })])

export const IconClose = make([h('path', { key: 'a', d: 'M4 4 12 12' }), h('path', { key: 'b', d: 'M12 4 4 12' })])

export const IconAlert = make([
  h('path', { key: 'a', d: 'M8 2.6 14.2 13.4H1.8z' }),
  h('path', { key: 'b', d: 'M8 6.4v3.2' }),
  h('path', { key: 'c', d: 'M8 11.6v.4' }),
])

export const IconInfo = make([
  h('circle', { key: 'a', cx: '8', cy: '8', r: '5.8' }),
  h('path', { key: 'b', d: 'M8 7.2v3.4' }),
  h('path', { key: 'c', d: 'M8 5.1v.3' }),
])

export const IconSparkle = make([
  h('path', { key: 'a', d: 'M6.4 2.2 7.4 5l2.8 1-2.8 1-1 2.8L5.4 7 2.6 6l2.8-1z' }),
  h('path', { key: 'b', d: 'M11.6 8.6l.6 1.7 1.7.6-1.7.6-.6 1.7-.6-1.7-1.7-.6 1.7-.6z' }),
])

export const IconChevronDown = make([h('path', { key: 'a', d: 'M4.6 6.4 8 9.8l3.4-3.4' })])

export const IconEye = make([
  h('path', { key: 'a', d: 'M1.6 8s2.4-4.2 6.4-4.2S14.4 8 14.4 8s-2.4 4.2-6.4 4.2S1.6 8 1.6 8z' }),
  h('circle', { key: 'b', cx: '8', cy: '8', r: '1.8' }),
])

export const IconCode = make([
  h('path', { key: 'a', d: 'M5.8 5 2.8 8l3 3' }),
  h('path', { key: 'b', d: 'M10.2 5l3 3-3 3' }),
])

export const IconLoader = make([
  h('path', { key: 'a', d: 'M8 1.8v2.4' }),
  h('path', { key: 'b', d: 'M8 11.8v2.4' }),
  h('path', { key: 'c', d: 'M1.8 8h2.4' }),
  h('path', { key: 'd', d: 'M11.8 8h2.4' }),
  h('path', { key: 'e', d: 'M3.6 3.6 5.3 5.3' }),
  h('path', { key: 'f', d: 'M10.7 10.7l1.7 1.7' }),
  h('path', { key: 'g', d: 'M12.4 3.6 10.7 5.3' }),
  h('path', { key: 'h', d: 'M5.3 10.7l-1.7 1.7' }),
])

/** A tick for a checked task item; sized to sit inside the 14px box. */
export const IconTaskCheck = make([h('path', { key: 'a', d: 'M2.6 6.2 4.4 8 7.4 4.4' })], 10)
