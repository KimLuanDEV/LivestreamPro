"use strict";

/* ==========================================
   LIVESTREAM PRO
   SQLITE WALLET ENGINE V1.0
   INDEPENDENT TEST MODE
========================================== */

const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");

const { performance } = require("node:perf_hooks");
const { DatabaseSync } = require("node:sqlite");

const MODE = "ENGINE_TEST_V1";

const FIELDS = [
  "coins",
  "coin_received",
  "coin_sent",
  "coin_deposit"
];

const MAX = Number.MAX_SAFE_INTEGER;


/* ==========================================
   SECURITY UTILITIES
========================================== */

const HASH = value => crypto
  .createHash("sha256")
  .update(JSON.stringify(value))
  .digest("hex");

const fail = code => {
  throw new Error(code);
};

function validText(s, max) {

  return (
    typeof s === "string" &&
    s.length > 0 &&
    s.length <= max &&
    s.trim() === s
  );

}

function validBalance(n) {

  return (
    Number.isSafeInteger(n) &&
    n >= 0
  );

}

function values(row) {

  return FIELDS.map(f => row[f]);

}

function validateBalances(a) {

  if (
    !Array.isArray(a) ||
    a.length !== 4 ||
    !a.every(validBalance)
  ) {

    fail("INVALID_BALANCE");

  }

  return a;

}


/* ==========================================
   ATOMIC TRANSACTION ENGINE
========================================== */

function atomic(db, fn, write = true) {

  db.exec(
    write
      ? "BEGIN IMMEDIATE"
      : "BEGIN"
  );

  try {

    const result = fn();

    db.exec("COMMIT");

    return result;

  } catch (error) {

    try {

      db.exec("ROLLBACK");

    } catch {}

    throw error;

  }

}


/* ==========================================
   OPEN WALLET DATABASE
========================================== */

function openWallet(
  filename,
  { fixtures } = {}
) {

  // Chỉ sử dụng database thử nghiệm

  if (
    path.basename(filename) !==
    "wallet-test.sqlite"
  ) {

    fail("TEST_DATABASE_REQUIRED");

  }


  const create =
    fixtures !== undefined;


  if (
    create &&
    !Array.isArray(fixtures)
  ) {

    fail("INVALID_FIXTURES");

  }


  /* ======================================
     CREATE SECURE DATABASE FILE
  ====================================== */

  if (create) {

    fs.closeSync(

      fs.openSync(
        filename,
        "wx",
        0o600
      )

    );

  }


  const info =
    fs.lstatSync(filename);


  if (
    !info.isFile() ||
    (info.mode & 0o077) !== 0
  ) {

    fail("UNSAFE_TEST_FILE");

  }


  const db =
    new DatabaseSync(filename);


  const columns = FIELDS.map(f =>

    `${f} INTEGER NOT NULL
     CHECK(${f} BETWEEN 0 AND ${MAX})`

  ).join(", ");


  try {


    /* ====================================
       SQLITE CONFIGURATION
    ==================================== */

    db.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 1000;
    `);


    if (!create) {

      const mode = db.prepare(

        "SELECT value FROM wallet_meta " +
        "WHERE key = 'mode'"

      ).get();


      if (mode?.value !== MODE) {

        fail("INVALID_WALLET_MODE");

      }

    }


    db.exec(`
      PRAGMA journal_mode = DELETE;
      PRAGMA synchronous = FULL;
    `);


    /* ====================================
       CREATE DATABASE SCHEMA
    ==================================== */

    if (create) atomic(db, () => {

      db.exec(`

        CREATE TABLE wallet_meta (

          key TEXT PRIMARY KEY,

          value TEXT NOT NULL

        ) STRICT;


        CREATE TABLE wallet_accounts (

          uid TEXT PRIMARY KEY,

          ${columns}

        ) STRICT;


        CREATE TABLE wallet_opening (

          uid TEXT PRIMARY KEY
            REFERENCES wallet_accounts(uid),

          ${columns}

        ) STRICT;


        CREATE TABLE wallet_transactions (

          seq INTEGER PRIMARY KEY,

          actor TEXT NOT NULL,

          request_id TEXT NOT NULL,

          reason TEXT NOT NULL,

          fingerprint TEXT NOT NULL,

          change_count INTEGER NOT NULL
            CHECK(change_count BETWEEN 1 AND 100),

          created_at INTEGER NOT NULL,

          UNIQUE(actor, request_id)

        ) STRICT;


        CREATE TABLE wallet_entries (

          tx_seq INTEGER NOT NULL
            REFERENCES wallet_transactions(seq),

          uid TEXT NOT NULL
            REFERENCES wallet_accounts(uid),

          before_json TEXT NOT NULL,

          after_json TEXT NOT NULL,

          PRIMARY KEY(tx_seq, uid)

        ) STRICT;

        CREATE TABLE wallet_closures (

  uid TEXT PRIMARY KEY
    REFERENCES wallet_accounts(uid),

  request_id TEXT NOT NULL UNIQUE,

  closed_at INTEGER NOT NULL
    CHECK(closed_at > 0),

  last_tx_seq INTEGER NOT NULL
    CHECK(last_tx_seq >= 0)

) STRICT;



        CREATE INDEX wallet_entries_uid

        ON wallet_entries(uid, tx_seq);

      `);


      /* DATABASE METADATA */

      db.prepare(

        "INSERT INTO wallet_meta VALUES (?, ?)"

      ).run("mode", MODE);


      /* OPENING BALANCES */

      const a = db.prepare(

        "INSERT INTO wallet_accounts " +
        "VALUES (?, ?, ?, ?, ?)"

      );


      const b = db.prepare(

        "INSERT INTO wallet_opening " +
        "VALUES (?, ?, ?, ?, ?)"

      );


      for (const f of fixtures) {

        if (!validText(f.uid, 128)) {

          fail("INVALID_UID");

        }


        const n =
          validateBalances(values(f));


        a.run(f.uid, ...n);

        b.run(f.uid, ...n);

      }

    });


    /* ====================================
       PREPARED STATEMENTS
    ==================================== */

    const account = db.prepare(

      "SELECT * FROM wallet_accounts " +
      "WHERE uid = ?"

    );


    const update = db.prepare(`

      UPDATE wallet_accounts

      SET ${FIELDS.map(f => `${f}=?`).join(",")}

      WHERE uid = ?

    `);


    const findTx = db.prepare(

      "SELECT * FROM wallet_transactions " +
      "WHERE actor = ? AND request_id = ?"

    );


    const addTx = db.prepare(`

      INSERT INTO wallet_transactions (

        actor,

        request_id,

        reason,

        fingerprint,

        change_count,

        created_at

      )

      VALUES (?, ?, ?, ?, ?, ?)

    `);


    const addEntry = db.prepare(

      "INSERT INTO wallet_entries " +
      "VALUES (?, ?, ?, ?)"

    );


    const entries = db.prepare(

      "SELECT * FROM wallet_entries " +
      "WHERE tx_seq = ? ORDER BY uid"

    );


    /* ====================================
       PERFORMANCE METRICS
    ==================================== */


/* ==========================================
   LIVESTREAM PRO
   WALLET CLOSURE ENGINE V4.0
   TEST MODE ONLY
========================================== */

const findClosure = db.prepare(
  "SELECT * FROM wallet_closures WHERE uid = ?"
);

const findClosureRequest = db.prepare(
  "SELECT * FROM wallet_closures WHERE request_id = ?"
);

const latestSeq = db.prepare(
  "SELECT COALESCE(MAX(seq), 0) AS seq FROM wallet_transactions"
);

const insertClosure = db.prepare(
  "INSERT INTO wallet_closures " +
  "(uid, request_id, closed_at, last_tx_seq) VALUES (?, ?, ?, ?)"
);


/* ==========================================
   VALIDATE CLOSURE REQUEST ID
========================================== */

const closureId = id => {

  if (

    typeof id !== "string" ||

    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(id)

  ) {

    fail("INVALID_CLOSURE_REQUEST_ID");

  }

  return id.toLowerCase();

};


/* ==========================================
   GET WALLET CLOSURE STATUS
========================================== */

function getClosure(uid) {

  if (!validText(uid, 128)) {

    fail("INVALID_UID");

  }

  const row = findClosure.get(uid);

  return row
    ? { ...row }
    : null;

}


/* ==========================================
   VERIFY CLOSED WALLET
========================================== */

function assertClosed(uid, requestId) {

  const id = closureId(requestId);

  const row = getClosure(uid);


  if (!row || row.request_id !== id) {

    fail(
      "WALLET_CLOSURE_MISSING_OR_MISMATCH"
    );

  }


  const balance = account.get(uid);


  if (

    !balance ||

    balance.coins !== 0 ||

    balance.coin_received !== 0

  ) {

    fail("CLOSED_WALLET_BALANCE_INVALID");

  }

  return row;

}


/* ==========================================
   PERMANENT WALLET CLOSURE
========================================== */

// Caller must verify authorization
// and outstanding financial obligations first.

function closeWallet(uid, requestId) {

  if (!validText(uid, 128)) {

    fail("INVALID_UID");

  }


  const id = closureId(requestId);


  return atomic(db, () => {


    /* DUPLICATE CLOSURE PROTECTION */

    const existing =
      findClosure.get(uid);


    if (existing) {

      if (existing.request_id !== id) {

        fail("WALLET_ALREADY_CLOSED");

      }


      return {

        ...assertClosed(uid, id),

        duplicate: true

      };

    }


    /* REQUEST ID CONFLICT */

    if (findClosureRequest.get(id)) {

      fail(
        "CLOSURE_REQUEST_ID_CONFLICT"
      );

    }


    /* VERIFY CURRENT WALLET */

    const balance = account.get(uid);


    if (!balance) {

      fail("ACCOUNT_NOT_FOUND");

    }


    validateBalances(

      values(balance)

    );


    /* PROTECT REMAINING FUNDS */

    if (

      balance.coins !== 0 ||

      balance.coin_received !== 0

    ) {

      fail("WALLET_BALANCE_NOT_ZERO");

    }


    /* PERSIST WALLET CLOSURE */

    insertClosure.run(

      uid,

      id,

      Date.now(),

      latestSeq.get().seq

    );


    return {

      ...assertClosed(uid, id),

      duplicate: false

    };

  });

}


    const stats = {

      commits: 0,

      duplicates: 0,

      failures: 0,

      totalMs: 0,

      maxMs: 0

    };


    const uidSort = (a, b) =>

      a.uid < b.uid
        ? -1
        : a.uid > b.uid
          ? 1
          : 0;


    /* ====================================
       NORMALIZE TRANSACTION
    ==================================== */

    function normalize(op) {

      if (

        !op ||

        !validText(op.actor, 128) ||

        !validText(op.reason, 128) ||

        typeof op.requestId !== "string" ||

        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
          .test(op.requestId) ||

        !Array.isArray(op.changes) ||

        op.changes.length < 1 ||

        op.changes.length > 100

      ) {

        fail("INVALID_TRANSACTION");

      }


      const seen = new Set();


      const changes = op.changes.map(c => {

        if (

          !c ||

          !validText(c.uid, 128) ||

          seen.has(c.uid) ||

          !c.delta ||

          typeof c.delta !== "object" ||

          Array.isArray(c.delta) ||

          Object.keys(c.delta).some(

            k => !FIELDS.includes(k)

          )

        ) {

          fail("INVALID_CHANGE");

        }


        seen.add(c.uid);


        const delta = FIELDS.map(f =>

          Object.hasOwn(c.delta, f)
            ? c.delta[f]
            : 0

        );


        if (

          !delta.every(Number.isSafeInteger) ||

          delta.every(n => n === 0)

        ) {

          fail("INVALID_DELTA");

        }


        return {

          uid: c.uid,

          delta

        };

      }).sort(uidSort);


      return {

        actor: op.actor,

        requestId:
          op.requestId.toLowerCase(),

        reason: op.reason,

        changes

      };

    }


    /* ====================================
       TRANSACTION RECEIPT
    ==================================== */

    function receipt(tx, duplicate) {

      return {

        ok: true,

        duplicate,

        requestId: tx.request_id,

        actor: tx.actor,

        changes: entries.all(tx.seq)

          .sort(uidSort)

          .map(e => ({

            uid: e.uid,

            before:
              JSON.parse(e.before_json),

            after:
              JSON.parse(e.after_json)

          }))

      };

    }


    /* ====================================
       WALLET TRANSACTION COMMIT
    ==================================== */

    function commit(input, legacyGuard) {

      const started =
        performance.now();


      try {

        const op =
          normalize(input);


        const fingerprint =
          HASH(op);


        const result = atomic(db, () => {


            /* ==========================================
   WALLET STORAGE ADAPTER V1.0
   LEGACY RECEIPT GUARD
========================================== */

const migrated = db.prepare(

  "SELECT value FROM wallet_meta " +

  "WHERE key='migration_source_sha256'"

).get();


if (

  migrated ||

  legacyGuard !== undefined

) {


  /* REQUIRE TRUSTED STORAGE ADAPTER */

  if (

    !migrated ||

    typeof legacyGuard !== "function"

  ) {

    fail("WALLET_ADAPTER_REQUIRED");

  }


  /* VERIFY HISTORICAL RECEIPTS */

  const status = legacyGuard(db);


  if (status === "CONFLICT") {

    fail("REQUEST_ID_CONFLICT");

  }


  /* HISTORICAL DUPLICATE */

  if (status === "DUPLICATE") {

    return {

      ok: true,

      duplicate: true,

      legacy: true,

      actor: op.actor,

      requestId: op.requestId,

      changes: []

    };

  }


  if (status !== "NOT_FOUND") {

    fail("INVALID_LEGACY_DECISION");

  }

}



          /* DUPLICATE PROTECTION */

          const existing = findTx.get(

            op.actor,

            op.requestId

          );


          if (existing) {

            if (
              existing.fingerprint !==
              fingerprint
            ) {

              fail("REQUEST_ID_CONFLICT");

            }

            return receipt(
              existing,
              true
            );

          }



          /* ==========================================
   CLOSED WALLET TRANSACTION PROTECTION
========================================== */

if (findClosure.get(op.actor)) {

  fail("WALLET_ACTOR_CLOSED");

}


for (const c of op.changes) {

  if (findClosure.get(c.uid)) {

    fail("WALLET_ACCOUNT_CLOSED");

  }

}


          /* CREATE TRANSACTION RECORD */

          const inserted = addTx.run(

            op.actor,

            op.requestId,

            op.reason,

            fingerprint,

            op.changes.length,

            Date.now()

          );


          /* UPDATE ACCOUNT BALANCES */

          for (const c of op.changes) {

            const row =
              account.get(c.uid);


            if (!row) {

              fail("ACCOUNT_NOT_FOUND");

            }


            const before =

              validateBalances(

                values(row)

              );


            const after =

              validateBalances(

                before.map(

                  (v, i) => v + c.delta[i]

                )

              );


            if (

              update.run(
                ...after,
                c.uid
              ).changes !== 1

            ) {

              fail("UPDATE_FAILED");

            }


            /* SAVE TRANSACTION LEDGER */

            addEntry.run(

              inserted.lastInsertRowid,

              c.uid,

              JSON.stringify(before),

              JSON.stringify(after)

            );

          }


          return receipt(

            findTx.get(
              op.actor,
              op.requestId
            ),

            false

          );

        });


        stats[
          result.duplicate
            ? "duplicates"
            : "commits"
        ]++;


        return result;


      } catch (error) {

        stats.failures++;

        throw error;


      } finally {

        const ms =

          performance.now() - started;


        stats.totalMs += ms;

        stats.maxMs =
          Math.max(stats.maxMs, ms);

      }

    }


    /* ====================================
       WALLET RECONCILIATION ENGINE
    ==================================== */

    function reconcile() {

      return atomic(db, () => {


        /* SQLITE INTEGRITY CHECK */

        if (

          db.prepare(
            "PRAGMA integrity_check"
          ).all().some(

            r => r.integrity_check !== "ok"

          ) ||

          db.prepare(
            "PRAGMA foreign_key_check"
          ).all().length

        ) {

          fail("SQLITE_INTEGRITY_FAILED");

        }


        /* LOAD OPENING BALANCES */

        const balances = new Map(

          db.prepare(

            "SELECT * FROM wallet_opening"

          ).all().map(r => [

            r.uid,

            validateBalances(values(r))

          ])

        );


        const txs = db.prepare(

          "SELECT * FROM wallet_transactions " +
          "ORDER BY seq"

        ).all();


        let count = 0;


        /* VERIFY TRANSACTION HISTORY */

        for (const t of txs) {

          const rows = entries.all(t.seq)

            .sort(uidSort);


          if (
            rows.length !== t.change_count
          ) {

            fail("LEDGER_COUNT_MISMATCH");

          }


          const changes = [];


          for (const e of rows) {

            const before = validateBalances(

              JSON.parse(e.before_json)

            );


            const after = validateBalances(

              JSON.parse(e.after_json)

            );


            if (

              JSON.stringify(
                balances.get(e.uid)
              ) !==

              JSON.stringify(before)

            ) {

              fail("LEDGER_CHAIN_MISMATCH");

            }


            changes.push({

              uid: e.uid,

              delta: after.map(

                (v, i) => v - before[i]

              )

            });


            balances.set(

              e.uid,

              after

            );


            count++;

          }


          if (

            HASH({

              actor: t.actor,

              requestId: t.request_id,

              reason: t.reason,

              changes

            }) !== t.fingerprint

          ) {

            fail(
              "LEDGER_FINGERPRINT_MISMATCH"
            );

          }

        }


/* ==========================================
   VERIFY CLOSED WALLET ACCOUNTS
========================================== */

const closures = db.prepare(

  "SELECT * FROM wallet_closures"

).all();


const laterEntry = db.prepare(

  "SELECT 1 FROM wallet_entries " +

  "WHERE uid = ? AND tx_seq > ? LIMIT 1"

);


const laterActor = db.prepare(

  "SELECT 1 FROM wallet_transactions " +

  "WHERE actor = ? AND seq > ? LIMIT 1"

);


for (const c of closures) {

  if (

    !Number.isSafeInteger(c.last_tx_seq) ||

    c.last_tx_seq < 0 ||

    c.last_tx_seq > latestSeq.get().seq ||

    !Number.isSafeInteger(c.closed_at) ||

    c.closed_at <= 0

  ) {

    fail("INVALID_CLOSURE_RECORD");

  }


  assertClosed(

    c.uid,

    c.request_id

  );


  if (

    laterEntry.get(

      c.uid,

      c.last_tx_seq

    ) ||

    laterActor.get(

      c.uid,

      c.last_tx_seq

    )

  ) {

    fail(

      "TRANSACTION_AFTER_WALLET_CLOSURE"

    );

  }

}




        /* VERIFY CURRENT BALANCES */

        const current = db.prepare(

          "SELECT * FROM wallet_accounts"

        ).all();


        if (
          current.length !== balances.size
        ) {

          fail("ACCOUNT_COUNT_MISMATCH");

        }


        for (const row of current) {

          if (

            JSON.stringify(values(row)) !==

            JSON.stringify(
              balances.get(row.uid)
            )

          ) {

            fail("BALANCE_MISMATCH");

          }

        }


        return {

          ok: true,

          accounts: current.length,

          transactions: txs.length,

          entries: count

        };

      }, false);

    }


    /* ====================================
       PUBLIC WALLET INTERFACE
    ==================================== */

    return Object.freeze({

      getBalance(uid) {

        const row =
          account.get(uid);

        return row
          ? { ...row }
          : null;

      },


commit,

/* ACCOUNT DELETION V4.0 */

closeWallet,

getClosure,

assertClosed,

reconcile,


      getStats() {

        return {

          ...stats,

          avgMs:

            stats.totalMs /

            Math.max(

              1,

              stats.commits +

              stats.duplicates +

              stats.failures

            )

        };

      },


      close() {

        db.close();

      }

    });


  } catch (error) {

    db.close();

    throw error;

  }

}


/* ==========================================
   MODULE EXPORTS
========================================== */

module.exports = {

  openWallet

};