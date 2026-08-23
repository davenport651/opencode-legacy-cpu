# opencode-legacy-cpu

A fork of [opencode](https://github.com/anomalyco/opencode) that builds the CLI
for the **Node.js runtime** instead of the Bun runtime, so it runs on older
x86-64 CPUs that Bun cannot support.

## Why

The official opencode binaries embed the **Bun runtime**. Since Bun 1.1.28 the
runtime uses the `popcnt` (SSE4.2) instruction even in its "baseline" builds.
CPUs older than ~2011 (Intel Core 2 Duo "Penryn" and earlier, early Atoms, and
VMs with restricted CPU flags) crash with `Illegal instruction` on every
official binary — including `opencode-linux-x64-baseline`.

Node.js 22 runs on any x86-64 CPU, and opencode already ships a Node-compatible
layer in-tree (`.node.ts` implementations for native modules, Node export
conditions, and a `build-node.ts` for the server). This fork extends that to the
full CLI and packages it with a bundled Node runtime.

## What works

- `opencode run "..."` — run the agent non-interactively (the standard headless
  / CI mode)
- `opencode serve` — run the opencode server / HTTP API
- `opencode attach <url>` — attach to a running server
- `opencode models`, `opencode providers`, `opencode agent`, `opencode mcp`,
  `opencode debug`, etc.
- All provider integrations (OpenCode Go, Anthropic, OpenAI, xAI, Google, …)

## Limitations

- The **full-screen interactive TUI** (`opencode` with no subcommand) and
  `opencode --mini` require Bun's FFI to load the OpenTUI native renderer, which
  is not available under plain Node. Use `opencode run` or `opencode serve`
  instead — the supported headless modes.
- `.ts` tool plugins in a project's `.opencode/tool/` are loaded by Bun's
  TypeScript runtime; under Node they must be `.js`/`.mjs`.
- Only the Linux x64 build is produced by the release pipeline.

## Changes vs upstream (branch `node-runtime`)

| File | Change |
| --- | --- |
| `packages/opencode/src/index.ts`, `packages/opencode/src/cli/tui/worker.ts` | import Node shims first |
| `packages/opencode/src/node-shim.ts` | defines `Bun.*` globals when Bun is absent |
| `packages/opencode/src/node-worker.ts` | bridges Bun Web Worker API ↔ `node:worker_threads` |
| `packages/opencode/src/cli/cmd/run/footer.prompt.tsx`, `packages/tui/src/component/prompt/autocomplete.tsx`, `packages/tui/src/component/dialog-status.tsx` | `pathToFileURL`/`fileURLToPath` from `node:url` instead of `bun` |
| `packages/opencode/src/session/message-v2.ts` | local `SystemError` type instead of `bun` type |
| `packages/tui/src/bun-ffi.ts` | runtime-agnostic `bun:ffi` adapter |
| `packages/tui/src/terminal-win32.ts` | use `./bun-ffi` |
| `packages/tui/src/bun-sqlite.ts` | runtime-agnostic SQLite adapter (`bun:sqlite` / `node:sqlite`) |
| `packages/tui/src/editor-zed.ts` | use `./bun-sqlite` |
| `packages/opencode/script/build-node-cli.ts` | new: build the CLI for the Node target |
| `packages/opencode/script/package-node-cli.ts` | new: assemble portable package with bundled Node |
| `.github/workflows/build-node-legacy-cpu.yml` | new: build + release the Node variant |

Several of these (the `node:url` imports, the local `SystemError` type) are
safe to upstream into `anomalyco/opencode` since they work under both runtimes.

## Build it yourself

```bash
bun install
cd packages/opencode
OPENCODE_VERSION=1.18.21 OPENCODE_CHANNEL=latest bun run script/package-node-cli.ts
./dist/opencode-node/bin/opencode --version
```

## Releases

The `build-node-legacy-cpu` workflow builds on every `v*` tag and attaches
`opencode-linux-x64-node.tar.gz`. Unpack, add `bin/` to your `PATH`:

```bash
tar -xzf opencode-linux-x64-node.tar.gz
export PATH="$PWD/opencode-node/bin:$PATH"
opencode --version
```