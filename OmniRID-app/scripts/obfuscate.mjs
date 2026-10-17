#!/usr/bin/env node
/*
 * Post-build obfuscation of the client bundle (`.output/public/_nuxt/**`).
 *
 * Purpose: raise the cost of casual reverse engineering of the shipped app.
 * It is NOT a security boundary — HTML/CSS/JS delivered to a browser can always
 * be recovered. Never rely on this to protect anything; keep secrets off the
 * client entirely.
 *
 * Design:
 *   - Runs only on the generated static output; a no-op when it is absent.
 *   - Fail-soft: if a file fails to obfuscate, the original is kept, so a build
 *     is never broken by obfuscation.
 *   - Set `OBFUSCATE=0` to skip (useful for debugging production builds).
 */
import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import JavaScriptObfuscator from 'javascript-obfuscator'

const PUBLIC_DIR = fileURLToPath(new URL('../.output/public/', import.meta.url))
const NUXT_DIR = join(PUBLIC_DIR, '_nuxt')

const OPTIONS = {
  sourceType: 'module',
  target: 'browser',
  compact: true,
  // Conservative enough to keep ESM chunk semantics intact.
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  selfDefending: false,
  debugProtection: false,
  disableConsoleOutput: false,
  unicodeEscapeSequence: false,
  // String concealment is the cheapest, most robust win.
  stringArray: true,
  stringArrayThreshold: 0.75,
  stringArrayEncoding: ['base64'],
  stringArrayRotate: true,
  stringArrayShuffle: true,
  splitStrings: false,
  // Light control-flow flattening; heavy settings blow up bundle size/time.
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.25,
  deadCodeInjection: false,
  transformObjectKeys: false,
  numbersToExpressions: false,
  simplify: true
}

async function collectJsFiles(dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...await collectJsFiles(full))
    } else if (entry.isFile() && /\.m?js$/.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

async function main() {
  if (process.env.OBFUSCATE === '0') {
    console.log('[obfuscate] skipped (OBFUSCATE=0)')
    return
  }

  try {
    await stat(NUXT_DIR)
  } catch {
    console.log('[obfuscate] no .output/public/_nuxt — nothing to do')
    return
  }

  const files = await collectJsFiles(NUXT_DIR)
  if (files.length === 0) {
    console.log('[obfuscate] no JS chunks found')
    return
  }

  let obfuscated = 0
  let skipped = 0
  let bytesBefore = 0
  let bytesAfter = 0

  for (const file of files) {
    try {
      const source = await readFile(file, 'utf8')
      // Skip already-empty or trivial files.
      if (source.trim().length < 32) {
        skipped++
        continue
      }
      const result = JavaScriptObfuscator.obfuscate(source, OPTIONS).getObfuscatedCode()
      if (!result || result.length < 32) {
        skipped++
        continue
      }
      await writeFile(file, result)
      obfuscated++
      bytesBefore += source.length
      bytesAfter += result.length
    } catch (error) {
      skipped++
      console.warn(`[obfuscate] keeping ${file}: ${error instanceof Error ? error.message : error}`)
    }
  }

  const kb = n => (n / 1024).toFixed(0)
  console.log(
    `[obfuscate] ${obfuscated} chunk(s) obfuscated, ${skipped} skipped `
    + `(${kb(bytesBefore)} KB -> ${kb(bytesAfter)} KB)`
  )
}

await main()
