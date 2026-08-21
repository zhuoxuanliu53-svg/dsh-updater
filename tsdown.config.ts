/**
 * Self-contained tsdown config for dsh-updater's browser client bundle.
 *
 * This mirrors the harness `packages/client/tsdown.client.ts` preset so the
 * output `lib/client.js` matches the runtime contract the Web GUI loader
 * expects: a CJS bundle that calls `window.__ModuleLoader__.load({ id,
 * factory })`, resolves platform modules through the injected require
 * (react, cordis, slots, ...), and compiles CSS Modules with lightningcss
 * into an injected `<style data-plugin>` tag.
 *
 * The node-half `lib/*.js` + `lib/types/**` come from `tsc -p
 * tsconfig.build.json` (run first by the `build` script).
 */
import { readFile } from 'node:fs/promises'
import { basename, dirname, resolve as resolvePath } from 'node:path'
import type { UserConfig } from 'tsdown'
import { transform } from 'lightningcss'

/** CSS Modules virtual-id wrapper (must not end in .css - tsdown guards on that). */
const CSS_VIRTUAL_PREFIX = '\0dsh-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

/**
 * Platform module table shared into the frozen loader table: these specifiers
 * are EXTERNAL - the injected require answers them, the bundle never inlines
 * them. Everything else under @deepseek-ai/* must inline instead (wire/type
 * layers with no shared runtime identity).
 */
const PLATFORM_MODULES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-web-react',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-attachment',
  '@deepseek-ai/dsh-client-schema-form',
] as const

/** Documented runtime exemption: the lazy CJS table answers this require natively. */
const RUNTIME_STORE_EXEMPTION = '@deepseek-ai/dsh-client-runtime/client'

const CLIENT_EXTERNALS = [...PLATFORM_MODULES, RUNTIME_STORE_EXEMPTION]

/** Any cross-plugin value import that is neither a platform module nor an
 * inline-safe wire layer is a build error (mirrors the harness purity gate). */
const INLINE_SAFE = /^@deepseek-ai\/dsh-(host-apiproxy|session|llm|tools|brand)(\/|$)/
const VENDORED_LIBRARY = /^@deepseek-ai\/(cosmokit|schemastery)(\/|$)/

/** Build the client config. */
function clientConfig(id: string, entry: string): UserConfig {
  return {
    name: `${id}/client`,
    entry: { client: entry },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    sourcemap: true,
    clean: false,
    // Platform modules stay external (the injected require answers them); every
    // non-platform specifier inlines instead (wire/type layers, zod, clsx).
    deps: {
      neverBundle: [...CLIENT_EXTERNALS],
      alwaysBundle: (spec: string) => (CLIENT_EXTERNALS.includes(spec) ? undefined : true),
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
    },
    plugins: [
      {
        name: 'dsh-client-bundle-purity',
        resolveId(source: string) {
          if (!source.startsWith('@deepseek-ai/')) return null
          if (CLIENT_EXTERNALS.includes(source)) return null
          if (VENDORED_LIBRARY.test(source)) return null
          if (INLINE_SAFE.test(source)) return null
          throw new Error(
            `client bundle purity: "${source}" is neither a platform module, an inline-safe wire layer, nor a generated /remote contribution - `
            + 'cross-plugin value imports are forbidden; collaborate through cordis services',
          )
        },
      },
      {
        name: 'dsh-css-modules-inline',
        resolveId(source: string, importer: string | undefined) {
          if (!source.endsWith('.module.css')) return null
          const abs = importer !== undefined ? resolvePath(dirname(importer), source) : source
          return CSS_VIRTUAL_PREFIX + abs + CSS_VIRTUAL_SUFFIX
        },
        async load(virtualId: string) {
          if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
          const fileId = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
          this.addWatchFile(fileId)
          const source = await readFile(fileId)
          const { code, exports: cssExports } = transform({
            filename: fileId,
            code: source,
            cssModules: { pattern: '[hash]_[local]' },
            minify: true,
          })
          const classMap: Record<string, string> = {}
          for (const [local, exp] of Object.entries(cssExports ?? {})) classMap[local] = exp.name
          const tagId = `${id}/${basename(fileId)}`
          return [
            `const css = ${JSON.stringify(code.toString())};`,
            `const tagId = ${JSON.stringify(tagId)};`,
            'if (typeof document !== \'undefined\' && document.querySelector(\'style[data-plugin-css=\' + JSON.stringify(tagId) + \']\') === null) {',
            '  const tag = document.createElement(\'style\');',
            `  tag.dataset.plugin = ${JSON.stringify(id)};`,
            '  tag.dataset.pluginCss = tagId;',
            '  tag.textContent = css;',
            '  document.head.appendChild(tag);',
            '}',
            `export default ${JSON.stringify(classMap)};`,
          ].join('\n')
        },
      },
    ],
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  }
}

/** Build the Node-half configuration: flatten src into a single ESM lib/index.js. */
function nodeConfig(id: string, entry: string): UserConfig {
  return {
    name: id,
    entry: { index: entry },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2022',
    dts: false,
    clean: false,
    fixedExtension: false,
    // SDK + framework dependencies stay external (resolved from node_modules at
    // run time); relative source modules are inlined into the single file.
    deps: {
      neverBundle: [
        '@deepseek-ai/cordis',
        '@deepseek-ai/dsh-settings',
        '@deepseek-ai/schemastery',
        'schemastery',
      ],
    },
  }
}

export default [
  nodeConfig('dsh-updater', 'src/index.ts'),
  clientConfig('dsh-updater', 'src/client/index.ts'),
]
