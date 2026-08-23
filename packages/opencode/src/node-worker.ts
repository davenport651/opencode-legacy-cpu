// Node-runtime Web Worker compatibility layer.
//
// opencode's TUI spawns a Bun Web Worker (`new Worker(url, { env })`) whose
// entrypoint uses the standard worker globals (`onmessage`, `postMessage`).
// Node's worker_threads exposes `parentPort` and `MessagePort` instead.
// This module bridges both shapes when running under Node, and is a no-op
// under Bun.
import { Worker as ThreadWorker, parentPort, isMainThread } from "node:worker_threads"

if (!isMainThread) {
  // ---- worker thread side: expose postMessage / onmessage ----
  if (parentPort) {
    globalThis.postMessage = (data: unknown) => parentPort.postMessage(data)
    globalThis.onmessage = null
    parentPort.on("message", (data) => {
      if (typeof globalThis.onmessage === "function") {
        ;(globalThis.onmessage as (ev: { data: unknown }) => void)({ data })
      }
    })
  }
} else if (!("Worker" in globalThis)) {
  // ---- main thread side: Web Worker class backed by worker_threads ----
  globalThis.Worker = class Worker {
    onmessage: ((ev: { data: unknown }) => void) | null = null
    onerror: ((err: unknown) => void) | null = null

    private worker: ThreadWorker

    constructor(url: string | URL, options?: { env?: Record<string, string>; workerData?: unknown }) {
      const worker = new ThreadWorker(url, {
        env: options?.env,
        workerData: options?.workerData,
      })
      this.worker = worker
      worker.on("message", (data) => {
        if (this.onmessage) this.onmessage({ data })
      })
      worker.on("error", (err) => {
        if (this.onerror) this.onerror(err)
      })
    }

    postMessage(data: unknown) {
      this.worker.postMessage(data)
    }

    terminate() {
      return this.worker.terminate()
    }

    addEventListener(type: string, fn: (ev: { data: unknown }) => void) {
      if (type === "message") this.onmessage = fn
      if (type === "error") this.onerror = fn
    }

    removeEventListener(type: string, fn: (ev: { data: unknown }) => void) {
      if (type === "message" && this.onmessage === fn) this.onmessage = null
      if (type === "error" && this.onerror === fn) this.onerror = null
    }
  }
}