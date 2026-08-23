#!/usr/bin/env bun
/**
 * Build the opencode CLI for the Node.js runtime.
 *
 * The official release pipeline embeds the Bun runtime in the CLI binary
 * (`bun build --compile --target=bun-*`). Bun's runtime requires SSE4.2
 * (POPCNT), so those binaries cannot start on older x86-64 CPUs (e.g. Core 2
 * Duo "Penryn" and earlier). This script instead builds the same CLI entry for
 * plain Node.js, which runs on any x86-64 CPU.
 *
 * The source tree already carries Node-specific export conditions and `.node.ts`
 * implementations for native modules (`#fff`, `#sqlite`, `#pty`), and the TUI
 * library ships Node builds. The remaining Bun-specific bits (`bun:ffi`,
 * `bun:sqlite` in platform-specific editor integrations) are routed through
 * runtime-agnostic adapters in this branch.
 *
 * Usage:
 *   bun run script/build-node-cli.ts            # build ./dist/node-cli
 *   OPENCODE_VERSION=1.18.21 bun run script/build-node-cli.ts
 */

import { Script } from "@opencode-ai/script"
import path from "path"
import { fileURLToPath } from "url"
import { createSolidTransformPlugin } from "@opentui/solid/bun-plugin"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dir = path.resolve(__dirname, "..")

process.chdir(dir)

const generated = await import("./generate.ts")
const pkg = await import("../package.json")

const singleFlag = process.argv.includes("--single")
const skipInstall = process.argv.includes("--skip-install")
const sourcemapsFlag = process.argv.includes("--sourcemaps")

await Bun.$`rm -rf dist/node-cli`

if (!skipInstall) {
  await Bun.$`bun install --os="*" --cpu="*" @opentui/core@${pkg.dependencies["@opentui/core"]}`
  await Bun.$`bun install --os="*" --cpu="*" @lydell/node-pty@${pkg.dependencies["@lydell/node-pty"]}`
}

const result = await Bun.build({
  target: "node",
  conditions: ["node"],
  tsconfig: "./tsconfig.json",
  plugins: [createSolidTransformPlugin()],
  // Native/optional modules are kept external: they must be present in the
  // runtime's node_modules (bundled alongside this build by the packager).
  // @parcel/watcher is bundled rather than external because Node's ESM loader
  // cannot resolve its extension-less `wrapper` subpath import.
  external: ["jsonc-parser", "@lydell/node-pty"],
  format: "esm",
  minify: true,
  sourcemap: sourcemapsFlag ? "linked" : "none",
  splitting: true,
  outdir: "./dist/node-cli",
  entrypoints: ["./src/index.ts", "./src/cli/tui/worker.ts"],
  define: {
    OPENCODE_MODELS_DEV: generated.modelsData,
    OPENCODE_VERSION: `'${Script.version}'`,
    OPENCODE_CHANNEL: `'${Script.channel}'`,
  },
})

if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}

console.log("Node CLI build complete → ./dist/node-cli")
console.log("Note: `opencode serve`/`opencode run` are fully supported. The")
console.log("full-screen TUI requires Bun's FFI for the OpenTUI native renderer")
console.log("and is not available under the Node runtime.")