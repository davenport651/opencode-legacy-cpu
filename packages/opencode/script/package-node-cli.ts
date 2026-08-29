#!/usr/bin/env bun
/**
 * Assemble a portable opencode package for the Node.js runtime, including the
 * bundled Node binary and the native deps the CLI needs at runtime.
 *
 * Produces `./dist/opencode-node/` with:
 *   bin/node        (downloaded Node.js, stripped)
 *   bin/opencode    (launcher script)
 *   lib/            (bundled CLI)
 *   lib/node_modules/ (jsonc-parser, @lydell/node-pty, @opentui/*)
 *
 * Usage:
 *   bun run script/package-node-cli.ts --node-version 22.16.0
 */

import { $ } from "bun"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dir = path.resolve(__dirname, "..")

process.chdir(dir)

const nodeVersion = process.argv.includes("--node-version")
  ? process.argv[process.argv.indexOf("--node-version") + 1]
  : "22.16.0"

await $`rm -rf dist/opencode-node`
await $`mkdir -p dist/opencode-node/bin dist/opencode-node/lib/node_modules`

// 1. Ensure the native / external runtime deps are installed for linux-x64,
//    then build the Node CLI.
await $`bun install --os=linux --cpu=x64 @opentui/core-linux-x64@0.4.5 2>/dev/null || true`
await $`bun install --os=linux --cpu=x64 @lydell/node-pty-linux-x64@1.2.0-beta.12 2>/dev/null || true`
await $`bun run script/build-node-cli.ts --skip-install`

// 2. Copy the bundle.
await $`cp -r dist/node-cli/* dist/opencode-node/lib/`

// 3. Copy native / external runtime deps (dereference symlinks so the package
//    is self-contained and does not depend on the bun install cache).
await $`cp -rL node_modules/jsonc-parser dist/opencode-node/lib/node_modules/ 2>/dev/null || true`
await $`cp -rL node_modules/@lydell dist/opencode-node/lib/node_modules/ 2>/dev/null || true`
await $`cp -rL node_modules/@opentui dist/opencode-node/lib/node_modules/ 2>/dev/null || true`
// Trim opentui to only the linux-x64 native build (drop other-platform binaries).
await $`rm -rf dist/opencode-node/lib/node_modules/@opentui/core-darwin-* dist/opencode-node/lib/node_modules/@opentui/core-win32-* dist/opencode-node/lib/node_modules/@opentui/core-linux-arm64* dist/opencode-node/lib/node_modules/@opentui/core-linux-x64-musl 2>/dev/null || true`

// 4. Download and strip the Node runtime.
const nodeDir = `node-v${nodeVersion}-linux-x64`
const nodeTar = `${nodeDir}.tar.xz`
if (!(await Bun.file(nodeTar).exists())) {
  await $`curl -sL -o ${nodeTar} https://nodejs.org/dist/v${nodeVersion}/${nodeTar}`
}
await $`tar -xJf ${nodeTar}`
await $`cp ${nodeDir}/bin/node dist/opencode-node/bin/node`
await $`strip dist/opencode-node/bin/node`
await $`rm -rf ${nodeDir} ${nodeTar}`

// 5. Launcher script.
await Bun.write(
  "dist/opencode-node/bin/opencode",
  `#!/usr/bin/env bash
set -euo pipefail
SOURCE="\${BASH_SOURCE[0]}"
while [ -h "\$SOURCE" ]; do
  DIR="\$(cd -P "\$(dirname "\$SOURCE")" >/dev/null 2>&1 && pwd)"
  SOURCE="\$(readlink "\$SOURCE")"
  [[ \$SOURCE != /* ]] && SOURCE="\$DIR/\$SOURCE"
done
SCRIPT_DIR="\$(cd -P "\$(dirname "\$SOURCE")" >/dev/null 2>&1 && pwd)"
# The full-screen TUI is unavailable under the Node runtime, so a bare
# \`opencode\` invocation defaults to the web UI (server + browser).
if [ \$# -eq 0 ]; then
  set -- web
fi
exec "\${OPENCODE_NODE_BIN:-\$SCRIPT_DIR/node}" "\$(dirname "\$SCRIPT_DIR")/lib/index.js" "\$@"
`,
)
await $`chmod +x dist/opencode-node/bin/opencode`

console.log("Portable package assembled → ./dist/opencode-node")
console.log("  bin/opencode --version")