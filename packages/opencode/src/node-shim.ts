// Node-runtime compatibility layer for Bun globals used by opencode.
//
// The official opencode binaries embed the Bun runtime, so the code can call
// `Bun.stringWidth`, `Bun.file`, `Bun.stdin`, etc. directly. To let the same
// source run under Node.js (e.g. for CPUs where the Bun runtime is
// unavailable), this module defines those globals when Bun is absent.
//
// This module is intentionally imported first by the CLI entrypoint and is a
// no-op when running under Bun.
import fs from "node:fs/promises"

if (!("Bun" in globalThis)) {
  globalThis.Bun = {
    stringWidth(str: string): number {
      let width = 0
      for (const ch of str) {
        width += (ch.codePointAt(0) ?? 0) > 0xff ? 2 : 1
      }
      return width
    },
    async write(path: string, content: string) {
      await fs.writeFile(path, content)
    },
    stdin: {
      async text(): Promise<string> {
        const chunks: Buffer[] = []
        for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
        return Buffer.concat(chunks).toString("utf8")
      },
    },
    file(path: string) {
      return {
        async text(): Promise<string> {
          return await fs.readFile(path, "utf8")
        },
        async json(): Promise<unknown> {
          return JSON.parse(await fs.readFile(path, "utf8"))
        },
        async write(content: string) {
          await fs.writeFile(path, content)
        },
      }
    },
    hash(value: string): number {
      let h = 5381
      for (let i = 0; i < value.length; i++) h = ((h << 5) + h + value.charCodeAt(i)) >>> 0
      return h
    },
  }
}