// Runtime-agnostic SQLite wrapper.
//
// The official opencode binaries embed the Bun runtime, so they import
// `bun:sqlite` directly. To let the same source build for the Node.js runtime
// (e.g. for CPUs where Bun is unavailable), this exposes a minimal Database
// API that is backed by `bun:sqlite` under Bun and by Node's built-in
// `node:sqlite` elsewhere.
//
// Only the small surface used by the TUI (open a DB readonly, run a query,
// close) is implemented.
interface Row {
  [key: string]: unknown
}

interface Query {
  all(): Row[]
}

export class Database {
  private db: {
    prepare(sql: string): { all(): unknown[] }
    close(): void
  }

  constructor(path: string, opts?: { readonly?: boolean }) {
    if (process.versions.bun) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const bunSqlite = require("bun:sqlite") as {
        Database: new (path: string, opts?: { readonly?: boolean }) => {
          query(sql: string): { all(): unknown[] }
          close(): void
        }
      }
      this.db = new bunSqlite.Database(path, opts) as unknown as typeof this.db
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeSqlite = require("node:sqlite") as {
      DatabaseSync: new (path: string, opts?: { readOnly?: boolean }) => {
        prepare(sql: string): { all(): unknown[] }
        close(): void
      }
    }
    const sync = new nodeSqlite.DatabaseSync(path, { readOnly: opts?.readonly ?? false })
    this.db = {
      prepare: (sql) => ({ all: () => sync.prepare(sql).all() as unknown[] }),
      close: () => sync.close(),
    }
  }

  query(sql: string): Query {
    const stmt = this.db.prepare(sql)
    return {
      all: () => stmt.all() as Row[],
    }
  }

  close() {
    this.db.close()
  }
}