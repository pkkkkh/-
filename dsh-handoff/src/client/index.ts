/**
 * Browser half of dsh-handoff.
 *
 * Registers one sidebar page (a `main` panel beside the Host's own pages) that
 * lists generated handoff documents, renders them, and can generate a new one
 * for any live session; plus a card on this bundle's configuration page.
 *
 * Written with `createElement` and structural service types on purpose: the
 * bundle resolves `react` through the Host's shared module table, so it must
 * not depend on monorepo-internal type packages at runtime.
 */
import { SettingsCard } from './card.ts'
import { Page } from './page.ts'
import { IconHandoff } from './ui.ts'
import type { IconProps } from './ui.ts'

const NS = 'dsh-handoff'

/** The sidebar seat calls its occupant with Host-owned props; only `size` matters here. */
const SidebarIcon = (props?: unknown) => IconHandoff((props ?? {}) as IconProps)

interface SlotsService {
  inject(slot: string, register: () => void): void
  register(meta: Record<string, unknown>, render: (props?: unknown) => unknown): unknown
}

interface ClientContext {
  slots: SlotsService
}

export const name = 'dsh-handoff'
export const inject = ['slots']

/** Register the page, its sidebar row, and the bundle's configuration card. */
export function apply(ctx: ClientContext): void {
  // `inject` is the slot's prop factory; these surfaces read only owner props,
  // so it supplies nothing. Passing it keeps the registration shape identical
  // to the shipped third-party plugins' (the slot contract expects the field).
  const noProps = (): Record<string, never> => ({})

  ctx.slots.inject('sidebar.panellist', () => {
    // The page and the row share one id: selecting the row opens `main`.
    ctx.slots.register({ name: 'main', key: NS, inject: noProps }, Page)
    ctx.slots.register({ name: 'sidebar.panellist', id: NS, order: 30, label: () => '交接文档', inject: noProps }, SidebarIcon)
  })

  ctx.slots.inject('plugins.bundle.config', () => {
    ctx.slots.register({ name: 'plugins.bundle.config', key: NS, inject: noProps }, SettingsCard)
  })
}
