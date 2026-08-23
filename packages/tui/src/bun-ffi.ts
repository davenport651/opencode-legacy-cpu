// Runtime-agnostic wrapper around Bun's FFI (`bun:ffi`).
//
// The official opencode binaries embed the Bun runtime, so they can import
// `bun:ffi` directly. To let the same source build for the Node.js runtime
// (e.g. for CPUs where Bun is unavailable), these functions are resolved
// lazily: on Bun they use the real FFI, anywhere else they fail gracefully.
// All callers here are Windows-only code paths, so on non-Bun runtimes a
// "not available" result is acceptable.
export function dlopen(..._args: unknown[]): unknown {
  if (process.versions.bun) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffi = require("bun:ffi") as { dlopen: (...a: unknown[]) => unknown }
    return ffi.dlopen(..._args)
  }
  throw new Error("bun:ffi is not available on this runtime")
}

export function ptr(..._args: unknown[]): unknown {
  if (process.versions.bun) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffi = require("bun:ffi") as { ptr: (...a: unknown[]) => unknown }
    return ffi.ptr(..._args)
  }
  throw new Error("bun:ffi is not available on this runtime")
}

export function CString(..._args: unknown[]): unknown {
  if (process.versions.bun) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffi = require("bun:ffi") as { CString: (...a: unknown[]) => unknown }
    return ffi.CString(..._args)
  }
  throw new Error("bun:ffi is not available on this runtime")
}

export const FFIType: Record<string, unknown> = {}