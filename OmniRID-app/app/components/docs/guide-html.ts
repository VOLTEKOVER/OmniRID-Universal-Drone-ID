import { h } from 'vue'
import type { VNodeChild } from 'vue'

const ALLOWED_TAGS = new Set(['code', 'b', 'strong', 'i', 'em', 'a', 'img', 'br'])
const VOID_TAGS = new Set(['img', 'br'])

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel']),
  img: new Set(['src', 'alt', 'class', 'loading'])
}

const ENTITIES: Record<string, string> = {
  '&lt;': '<',
  '&gt;': '>',
  '&amp;': '&',
  '&quot;': '"',
  '&apos;': '\'',
  '&#39;': '\'',
  '&nbsp;': '\u00a0'
}

type Child = string | { tag: string, attrs: Record<string, string>, children: Child[] }

const decodeEntities = (text: string) =>
  text.replace(/&(?:lt|gt|amp|quot|apos|#39|nbsp);/g, match => ENTITIES[match] ?? match)

const safeUrl = (value: string, allowHash: boolean) => {
  const url = value.trim()
  if (allowHash && url.startsWith('#')) return url
  if (/^(https?:|mailto:)/i.test(url)) return url
  if (url.startsWith('/') && !url.startsWith('//')) return url
  return undefined
}

const parseAttrs = (tag: string, raw: string): Record<string, string> => {
  const allowed = ALLOWED_ATTRS[tag]
  const attrs: Record<string, string> = {}
  if (!allowed) return attrs
  const re = /([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
  let match: RegExpExecArray | null
  while ((match = re.exec(raw))) {
    const name = match[1]!.toLowerCase()
    if (!allowed.has(name)) continue
    let value = match[2] ?? match[3] ?? ''
    if (name === 'href' || name === 'src') {
      const safe = safeUrl(value, name === 'href')
      if (!safe) continue
      value = safe
    }
    attrs[name] = value
  }
  if (tag === 'a' && attrs.target === '_blank') attrs.rel = 'noopener noreferrer'
  return attrs
}

/**
 * Parse the small, trusted HTML subset used by the guide content into a
 * whitelist-only tree. Unknown tags are dropped (their text is kept) so the
 * renderer can never emit scripts, event handlers or unsafe URLs.
 */
export const parseGuideHtml = (html: string): Child[] => {
  const root: Child[] = []
  const stack: { tag: string, children: Child[] }[] = [{ tag: '', children: root }]
  const re = /<[^>]*>/g
  let last = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(html))) {
    if (match.index > last) {
      const text = decodeEntities(html.slice(last, match.index))
      if (text) stack[stack.length - 1]!.children.push(text)
    }
    last = re.lastIndex
    const raw = match[0]
    const nameMatch = /^<\/?\s*([a-zA-Z][a-zA-Z0-9-]*)/.exec(raw)
    if (!nameMatch) continue
    const name = nameMatch[1]!.toLowerCase()
    if (!ALLOWED_TAGS.has(name)) continue

    if (/^<\//.test(raw)) {
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i]!.tag === name) {
          stack.length = i
          break
        }
      }
      continue
    }

    const node: Child = { tag: name, attrs: parseAttrs(name, raw), children: [] }
    stack[stack.length - 1]!.children.push(node)
    if (!VOID_TAGS.has(name) && !/\/>\s*$/.test(raw)) {
      stack.push({ tag: name, children: node.children })
    }
  }

  if (last < html.length) {
    const text = decodeEntities(html.slice(last))
    if (text) stack[stack.length - 1]!.children.push(text)
  }

  return root
}

export const renderGuideHtml = (children: Child[]): VNodeChild[] =>
  children.map((child) => {
    if (typeof child === 'string') return child
    const rendered = child.children.length ? renderGuideHtml(child.children) : undefined
    return h(child.tag, child.attrs, rendered)
  })
