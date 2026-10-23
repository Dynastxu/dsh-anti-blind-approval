/**
 * Build preset for the bundle: the Host entry as ESM, and the browser entry as
 * the `window.__ModuleLoader__` factory the Web client's module table loads.
 *
 * The browser artifact reproduces the closure-factory wrapper the shipped UI
 * packages emit: running it only registers a factory, and `require` answers
 * module-table specifiers. React and the UI primitives stay imports because the
 * shell seeds both into that table; everything else is bundled in.
 *
 * @module dsh-ai-approval-review/tsdown.config
 */
import { defineConfig } from 'tsdown'

/** Loader id of the browser bundle: the package name, as the module table keys it. */
const ID = 'dsh-ai-approval-review'

/** Browser module-table specifiers the client bundle leaves to the shell. */
const BASELINE = [/^react(\/|$)/u, /^@deepseek-ai\/dsh-client-ui-primitives$/u]

export default defineConfig([
  {
    name: ID,
    entry: ['src/index.ts'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
    sourcemap: true,
  },
  {
    name: `${ID}/client`,
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2024',
    dts: false,
    clean: false,
    sourcemap: true,
    deps: { neverBundle: BASELINE, alwaysBundle: specifier => !BASELINE.some(pattern => pattern.test(specifier)) },
    // The artifact must not depend on which tsconfig the bundler discovers:
    // JSX compiles to the module table's `react/jsx-runtime` entry.
    inputOptions: { transform: { jsx: 'react-jsx' } },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
