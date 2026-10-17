import type { CommandPaletteItem } from '@nuxt/ui/runtime/components/CommandPalette.vue'
import { defaults as appSettingDefaults } from '../composables/useAppSettings'
import { allPages, pageDescriptions } from '../pages.config'
import { featureGroups, firmwareQuickSteps, highlightCards, processSteps, protocolCards, quickStartSteps } from './content'
import {
  BAUD_RATES,
  CAN_BITRATES,
  CHIPS,
  ID_TYPES,
  LIGHT_PATTERNS,
  LOCK_LEVELS,
  OPTIONS,
  PROTOCOLS,
  REGIONS,
  TX_MODES,
  UA_TYPES
} from './device'

export type SearchAction = 'open-settings'

export interface SearchEntry {
  label: string
  to?: string
  icon?: string
  suffix?: string
  description?: string
  keywords?: string
  action?: SearchAction
}

export interface AutoSearchIndex {
  fields: SearchEntry[]
  actions: SearchEntry[]
  pageKeywords: Record<string, string>
}

// --- Source scanning ---------------------------------------------------------

function routeFromPath(path: string): string {
  const rel = path.replace(/^\.\.\/pages/, '').replace(/\.vue$/, '')
  const route = rel.replace(/\/index$/, '')
  return route === '' ? '/' : route
}

function fileBaseName(path: string): string {
  const file = path.split('/').pop() ?? path
  return file.replace(/\.vue$/, '')
}

function pageForRoute(to: string): string {
  if (to === '/') return 'Home'
  return allPages.find(page => page.to === to)?.label ?? to
}

// Literal `label="..."` values from a template (buttons and actions). Bindings
// and expressions (`:label`, `aria-label`, `x.label`) are ignored.
function literalLabels(src: string): string[] {
  const out: string[] = []
  for (const match of src.matchAll(/(?<![\w:.-])label="([^"]{2,48})"/g)) {
    const value = match[1]?.trim()
    if (!value || !/[A-Za-z]/.test(value) || /\$\{|[{}<>]/.test(value)) continue
    out.push(value)
  }
  return out
}

function componentGroup(path: string): string | undefined {
  const segments = path.replace(/^\.\.\/components\//, '').split('/')
  return segments.length > 1 ? segments[0] : undefined
}

// Chooses the page that best matches an action label (by word overlap with the
// page name and description), so generic component actions land on a sensible
// page automatically.
function pickOwner(candidates: [string, string][], label: string): string {
  const words = label.toLowerCase().split(/[^a-z0-9]+/).filter(word => word.length >= 3)
  let bestPath = candidates[0]![0]
  let bestScore = -1
  for (const [pagePath] of candidates) {
    const to = routeFromPath(pagePath)
    const page = allPages.find(item => item.to === to)
    const haystack = `${page?.label ?? ''} ${page ? pageDescriptions[page.id] ?? '' : ''}`.toLowerCase()
    const score = words.reduce((total, word) => total + (haystack.includes(word) ? 1 : 0), 0)
    if (score > bestScore) {
      bestScore = score
      bestPath = pagePath
    }
  }
  return routeFromPath(bestPath)
}

function readString(src: string, index: number): { value: string, end: number } | null {
  const quote = src[index]
  if (quote !== '\'' && quote !== '"' && quote !== '`') return null
  let out = ''
  let i = index + 1
  while (i < src.length) {
    const char = src[i]
    if (char === '\\') {
      out += src[i + 1] ?? ''
      i += 2
      continue
    }
    if (char === quote) return { value: out, end: i + 1 }
    out += char
    i++
  }
  return null
}

function readProp(src: string, index: number): string | undefined {
  let i = index
  while (i < src.length && /\s/.test(src[i] ?? '')) i++
  return readString(src, i)?.value
}

// Extracts `label`/`title`/`description` pairs from object literals and the
// `numField(name, label, description)` helper used across device pages.
function extractFields(src: string): { label: string, description?: string }[] {
  const out: { label: string, description?: string }[] = []
  const seen = new Set<string>()

  const push = (rawLabel: string | undefined, rawDescription: string | undefined) => {
    const label = rawLabel?.trim()
    if (!label || label.length < 2 || label.length > 80) return
    // Skip template literals, class strings and icon names: real field labels
    // are human readable and contain an uppercase letter.
    if (label.includes('${') || !/[A-Z]/.test(label)) return
    const key = label.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push({ label, description: rawDescription?.trim() || undefined })
  }

  for (const match of src.matchAll(/\b(?:label|title)\s*:\s*/g)) {
    const start = (match.index ?? 0) + match[0].length
    const label = readProp(src, start)
    if (!label) continue
    // Look for a description inside the same object literal (before its `}`).
    const tail = src.slice(start)
    const brace = tail.indexOf('}')
    const window = tail.slice(0, brace === -1 ? 300 : Math.min(brace, 300))
    const descMatch = /\bdescription\s*:\s*/.exec(window)
    const description = descMatch ? readProp(window, descMatch.index + descMatch[0].length) : undefined
    push(label, description)
  }

  for (const match of src.matchAll(/\bnumField\s*\(/g)) {
    let i = (match.index ?? 0) + match[0].length
    const skip = () => {
      while (i < src.length && /[\s,]/.test(src[i] ?? '')) i++
    }
    skip()
    const name = readString(src, i)
    if (!name) continue
    i = name.end
    skip()
    const label = readString(src, i)
    if (!label) continue
    i = label.end
    skip()
    const description = readString(src, i)
    push(label.value, description?.value)
  }

  return out
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, '\'')
    .replace(/&nbsp;/g, ' ')
}

// Visible text of the page template, used as extra search keywords.
function templateText(src: string): string {
  const block = src.match(/<template>([\s\S]*)<\/template>/)
  if (!block) return ''
  return decodeEntities(
    block[1]!
      .replace(/<script[\s\S]*?<\/script>/g, ' ')
      .replace(/<style[\s\S]*?<\/style>/g, ' ')
      .replace(/\{\{[\s\S]*?\}\}/g, ' ')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim()
}

// Readable attribute values (labels, titles, placeholders) from the template.
function attributeText(src: string): string {
  const values: string[] = []
  for (const match of src.matchAll(/(?<![\w:.-])(?:label|description|title|message|placeholder)="([^"]*)"/g)) {
    const value = match[1]?.trim()
    if (value) values.push(value)
  }
  return values.join(' ')
}

// --- Auto index --------------------------------------------------------------

let autoIndexPromise: Promise<AutoSearchIndex> | null = null

// Builds (once) the automatically generated index from the page/component
// sources. Safe to call repeatedly: the work happens a single time.
export function loadAutoSearchIndex(): Promise<AutoSearchIndex> {
  if (!autoIndexPromise) autoIndexPromise = buildAutoIndex()
  return autoIndexPromise
}

async function buildAutoIndex(): Promise<AutoSearchIndex> {
  // Loaded on demand as a single chunk; never part of the initial bundle.
  const { pageSources: pages, componentSources: components } = await import('./search-sources')

  const fields: SearchEntry[] = []
  const actions: SearchEntry[] = []
  const pageKeywords: Record<string, string> = {}
  const seenFields = new Set<string>()
  const seenActions = new Set<string>()

  const addAction = (label: string, to: string, keywords: string, icon = 'i-lucide-play') => {
    const key = label.toLowerCase()
    if (seenActions.has(key)) return
    seenActions.add(key)
    actions.push({ label, to, icon, suffix: pageForRoute(to), keywords: `action button ${label} ${keywords}` })
  }

  for (const [path, source] of Object.entries(pages)) {
    const to = routeFromPath(path)
    const pageLabel = pageForRoute(to)
    const icon = allPages.find(page => page.to === to)?.icon ?? 'i-lucide-file-text'
    const extracted = extractFields(source)

    pageKeywords[to] = [
      pageLabel,
      ...extracted.flatMap(field => [field.label, field.description ?? '']),
      ...literalLabels(source),
      attributeText(source),
      templateText(source)
    ].filter(Boolean).join(' ')

    for (const field of extracted) {
      const key = `${to}:${field.label.toLowerCase()}`
      if (seenFields.has(key)) continue
      seenFields.add(key)
      fields.push({
        label: field.label,
        to,
        icon,
        suffix: pageLabel,
        description: field.description ? truncate(field.description) : undefined,
        keywords: [field.label, field.description, pageLabel].filter(Boolean).join(' ')
      })
    }

    for (const label of literalLabels(source)) addAction(label, to, pageLabel, icon)
  }

  // Actions contributed by shared components, attached to the page that best
  // represents them: components are auto-imported, so pages reference them by
  // name, and the component folder maps to a page group (e.g. components/device
  // → the first device page).
  for (const [path, source] of Object.entries(components)) {
    const name = fileBaseName(path)
    const candidates = Object.entries(pages).filter(([, pageSource]) => pageSource.includes(name))
    if (!candidates.length) continue
    const group = componentGroup(path)
    const inGroup = group
      ? candidates.filter(([pagePath]) => allPages.find(page => page.to === routeFromPath(pagePath))?.group === group)
      : []
    const usable = inGroup.length ? inGroup : candidates
    for (const label of literalLabels(source)) {
      const to = pickOwner(usable, label)
      addAction(label, to, `${name} ${pageForRoute(to)}`)
    }
  }

  return { fields, actions, pageKeywords }
}

// --- Reference entries (derived from exported constants) ---------------------

let referenceCache: SearchEntry[] | null = null

export function referenceEntries(): SearchEntry[] {
  if (referenceCache) return referenceCache
  const out: SearchEntry[] = []

  for (const protocol of PROTOCOLS) {
    out.push({
      label: protocol.label,
      to: '/device/flight-controller',
      icon: 'i-lucide-cable',
      suffix: 'Protocol',
      description: 'Flight-controller telemetry protocol',
      keywords: `protocol fc telemetry serial ${protocol.label}`
    })
  }
  for (const type of ID_TYPES) {
    out.push({
      label: type.label,
      to: '/device/identity',
      icon: 'i-lucide-id-card',
      suffix: 'ID type',
      description: 'Basic ID type broadcast by the device',
      keywords: `id type uas identity ${type.label}`
    })
  }
  for (const type of UA_TYPES) {
    out.push({
      label: type.label,
      to: '/device/identity',
      icon: 'i-lucide-user',
      suffix: 'UA type',
      description: 'Aircraft category reported to receivers',
      keywords: `ua type category aircraft ${type.label}`
    })
  }
  for (const level of LOCK_LEVELS) {
    out.push({
      label: level.label,
      to: '/compliance-security/security',
      icon: 'i-lucide-lock',
      suffix: 'Lock level',
      description: 'Firmware lock and signed-command mode',
      keywords: `lock level efuse signed commands ${level.label}`
    })
  }
  for (const pattern of LIGHT_PATTERNS) {
    out.push({
      label: pattern.label,
      to: '/device/hardware',
      icon: 'i-lucide-lightbulb',
      suffix: 'Light pattern',
      description: 'Status and lighting LED pattern',
      keywords: `led light pattern ws2812 ${pattern.label}`
    })
  }
  for (const code of Object.keys(REGIONS) as (keyof typeof REGIONS)[]) {
    const info = REGIONS[code]
    out.push({
      label: info.label,
      to: '/device/nation',
      icon: 'i-lucide-globe',
      suffix: 'Region',
      description: `${info.standard}${info.encoderReady ? '' : ' · encoder pending'}`,
      keywords: `region nation country standard ${code} ${info.standard} ${info.requiredConfig.join(' ')} ${info.requiredRuntime.join(' ')}`
    })
  }
  for (const id of Object.keys(CHIPS) as (keyof typeof CHIPS)[]) {
    const info = CHIPS[id]
    const features = Object.entries(info.features)
      .filter(([, level]) => level !== 'no')
      .map(([feature]) => feature)
      .join(' ')
    out.push({
      label: info.label,
      to: '/firmware',
      icon: 'i-lucide-cpu',
      suffix: 'Board target',
      description: 'Supported board variant and chip target',
      keywords: `chip board target variant ${id} ${features}`
    })
  }
  for (const option of Object.keys(OPTIONS)) {
    out.push({
      label: humanize(option),
      to: '/compliance-security/security',
      icon: 'i-lucide-toggle-right',
      suffix: 'Firmware option',
      keywords: `option flag ${option} ${humanize(option)}`
    })
  }
  for (const mode of Object.keys(TX_MODES)) {
    out.push({
      label: humanize(mode),
      to: '/device/nation',
      icon: 'i-lucide-radio',
      suffix: 'Transmission mode',
      keywords: `tx transmission mode ${mode} ${humanize(mode)}`
    })
  }
  out.push({
    label: 'UART baud rates',
    to: '/device/flight-controller',
    icon: 'i-lucide-gauge',
    suffix: 'Reference',
    description: BAUD_RATES.join(' · '),
    keywords: `baud rate uart serial ${BAUD_RATES.join(' ')}`
  })
  out.push({
    label: 'DroneCAN bitrates',
    to: '/device/hardware',
    icon: 'i-lucide-network',
    suffix: 'Reference',
    description: `${CAN_BITRATES.map(rate => rate / 1000).join(' · ')} kbit/s`,
    keywords: `can dronecan bitrate ${CAN_BITRATES.join(' ')}`
  })
  for (const card of protocolCards) {
    out.push({
      label: card.title,
      to: '/docs/guide#protocols',
      icon: 'i-lucide-book-open',
      suffix: 'Protocol guide',
      description: card.text,
      keywords: `protocol guide ${card.title} ${card.text}`
    })
  }
  for (const group of featureGroups) {
    for (const feature of group) {
      out.push({
        label: feature,
        to: '/',
        icon: 'i-lucide-sparkles',
        suffix: 'Feature',
        keywords: `feature ${feature}`
      })
    }
  }
  for (const card of highlightCards) {
    out.push({
      label: card.title,
      to: '/',
      icon: card.icon,
      suffix: 'Highlight',
      description: card.description,
      keywords: `feature highlight ${card.title} ${card.description}`
    })
  }

  referenceCache = out
  return out
}

// --- App settings (derived from the settings defaults) -----------------------

let settingsCache: SearchEntry[] | null = null

export function appSettingEntries(): SearchEntry[] {
  if (settingsCache) return settingsCache
  settingsCache = Object.keys(appSettingDefaults).map(key => ({
    label: humanize(key),
    icon: 'i-lucide-settings-2',
    suffix: 'App settings',
    description: 'Open application settings',
    keywords: `settings preference option app ${key} ${humanize(key)}`,
    action: 'open-settings' as const
  }))
  return settingsCache
}

// --- Extra keywords attached to existing page items --------------------------

export const contentKeywords: Record<string, string> = {
  '/': [
    ...quickStartSteps,
    ...highlightCards.flatMap(card => [card.title, card.description]),
    ...featureGroups.flat(),
    ...processSteps.flatMap(step => [step.name, step.detail])
  ].join(' '),
  '/firmware': [
    ...firmwareQuickSteps,
    ...processSteps.flatMap(step => [step.name, step.detail])
  ].join(' ')
}

// --- Helpers -----------------------------------------------------------------

export function toCommandItems(entries: SearchEntry[], onAction?: (action: SearchAction) => void): CommandPaletteItem[] {
  return entries.map(entry => ({
    label: entry.label,
    icon: entry.icon,
    to: entry.to,
    suffix: entry.suffix,
    description: entry.description,
    keywords: entry.keywords,
    onSelect: entry.action && onAction ? () => onAction(entry.action!) : undefined
  }))
}

function humanize(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase())
}

function truncate(text: string, max = 140): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`
}

// Short, human-readable summary of long content (used for result descriptions
// while the full text stays available in `keywords`).
export function searchSummary(text: string, max = 160): string {
  return truncate(text.replace(/\s+/g, ' ').trim(), max)
}
