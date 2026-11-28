"use strict";

/* ==========================================
   LIVESTREAM PRO
   FINANCIAL FORWARD RECOVERY V1.9C

   OFFLINE REHEARSAL ONLY
   NO PRODUCTION REPLAY
========================================== */

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");

const {
  execFileSync
} = require("node:child_process");

const {
  randomUUID
} = require("node:crypto");


const FIELDS = [

  "coins",
  "coinReceived",
  "coinSent",
  "coinDeposit"

];


const obj = x =>
  x !== null &&
  typeof x === "object" &&
  !Array.isArray(x);


const need = (ok, code) => {

  if (!ok) throw new Error(code);

};


/* ==========================================
   READ VERIFIED SNAPSHOT
========================================== */

function read(s, name, required = false) {

  const f = s.files.find(
    x => x.name === name
  );

  if (!f) {

    need(
      !required,
      "REQUIRED_SOURCE_MISSING"
    );

    return undefined;

  }

  return JSON.parse(

    Buffer.from(
      f.content,
      "base64"
    ).toString("utf8")

  );

}


/* ==========================================
   STRICT BALANCE VALIDATION
========================================== */

function amount(x, optional) {

  if (optional && x === undefined) {

    return 0;

  }

  if (

    typeof x === "string" &&
    /^\d+$/.test(x)

  ) {

    x = Number(x);

  }

  need(

    Number.isSafeInteger(x) &&
    x >= 0,

    "INVALID_BALANCE"

  );

  return x;

}


/* ==========================================
   FINANCIAL SNAPSHOT INVENTORY
========================================== */

function scan(s) {

  need(

    s.scope === "JSON_ONLY" &&

    Number.isSafeInteger(s.createdAt),

    "JSON_BACKUP_REQUIRED"

  );

  const users = read(
    s,
    "users.json",
    true
  );

  need(obj(users), "INVALID_USERS");

  const balances = new Map();

  const totals =
    FIELDS.map(() => 0n);


  let duplicateIdRows = 0;
  let missingIdRows = 0;
  let withdrawalHolds = 0;
  let pendingTransfers = 0;


  /* VALIDATE FINANCIAL LIST */

  function list(x) {

    if (x === undefined) return [];

    need(

      Array.isArray(x) &&
      x.every(obj),

      "INVALID_RECORD_LIST"

    );

    return x;

  }


  /* DUPLICATE ID DETECTION */

  function ids(rows) {

    const seen = new Set();

    for (const r of rows) {

      if (

        typeof r.id !== "string" ||
        !r.id

      ) {

        missingIdRows++;

      } else if (seen.has(r.id)) {

        duplicateIdRows++;

      } else {

        seen.add(r.id);

      }

    }

  }


  /* COUNT UNRESOLVED RECORD STATES */

  const open = (rows, terminal) =>

    rows.filter(
      r => !terminal.includes(r.status)
    ).length;


  /* ======================================
     ACCOUNT FINANCIAL INVENTORY
  ====================================== */

  for (

    const [uid, u] of Object.entries(users)

  ) {

    need(

      uid &&
      obj(u) &&
      obj(u.profile),

      "INVALID_ACCOUNT"

    );


    const row = FIELDS.map(

      (f, i) => amount(
        u.profile[f],
        i !== 0
      )

    );

    balances.set(uid, row);

    row.forEach(

      (v, i) =>
        totals[i] += BigInt(v)

    );


    /* WITHDRAWAL HOLDS */

    const holds = list(
      u.profile.withdrawHold
    );


    /* TRANSFER REQUESTS */

    const transfers = list(
      u.transferRequests
    );


    ids(holds);

    ids(transfers);


    withdrawalHolds += holds.length;

    pendingTransfers += open(

      transfers,

      ["approved", "rejected"]

    );

  }


  /* ======================================
     EXTERNAL FINANCIAL SOURCES
  ====================================== */

  const w = read(
    s,
    "withdraw_requests.json"
  );

  const p = read(
    s,
    "lsp_pg_orders.json"
  );

  const m = read(
    s,
    "market_booths.json"
  );


  ids(list(w));


  if (p !== undefined) {

    need(

      obj(p) &&
      Object.values(p).every(obj),

      "INVALID_PAYMENT_SOURCE"

    );

  }


  /* MARKET ORDER INVENTORY */

  let pendingMarketOrders =

    m === undefined ? null : 0;


  if (m !== undefined) {

    need(
      obj(m),
      "INVALID_MARKET_SOURCE"
    );

    for (const b of Object.values(m)) {

      if (b === null) continue;

      need(obj(b), "INVALID_BOOTH");

      pendingMarketOrders += open(

        list(b.orders),

        ["done", "refunded", "cancelled"]

      );

    }

  }


  /* AGGREGATE INVENTORY REPORT */

  return {

    balances,

    totals,

    report: {

      accounts: balances.size,

      withdrawalHolds,

      pendingTransfers,

      duplicateIdRows,

      missingIdRows,

      pendingWithdrawals:

        w === undefined

          ? null

          : open(
              w,
              ["approved", "rejected"]
            ),

      pendingPayments:

        p === undefined

          ? null

          : open(

              Object.values(p),

              ["paid", "sandbox_confirmed"]

            ),

      pendingMarketOrders,

      deletionDirectoryPresent:

        s.deletionDirectoryPresent === true

    }

  };

}


/* ==========================================
   BASE / NEWER BALANCE COMPARISON
========================================== */

function compare(base, newer) {

  need(

    base.createdAt < newer.createdAt,

    "STRICT_SNAPSHOT_ORDER_REQUIRED"

  );


  const a = scan(base);

  const b = scan(newer);


  let addedAccounts = 0;
  let removedAccounts = 0;
  let changedAccounts = 0;


  for (const [uid, row] of a.balances) {

    if (!b.balances.has(uid)) {

      removedAccounts++;

    } else if (

      row.some(

        (v, i) =>
          v !== b.balances.get(uid)[i]

      )

    ) {

      changedAccounts++;

    }

  }


  for (const uid of b.balances.keys()) {

    if (!a.balances.has(uid)) {

      addedAccounts++;

    }

  }


  return {

    base: a.report,

    newer: b.report,

    addedAccounts,

    removedAccounts,

    changedAccounts,


    balanceDeltaTotals:

      Object.fromEntries(

        FIELDS.map(

          (f, i) => [

            f,

            String(
              b.totals[i] - a.totals[i]
            )

          ]

        )

      )

  };

}


/* ==========================================
   PRIVATE MIGRATION COMMAND
========================================== */

function migration(cmd, dir) {

  try {

    execFileSync(

      process.execPath,

      [

        path.join(
          __dirname,
          "wallet-migration.js"
        ),

        cmd,

        dir

      ],

      {

        stdio: "pipe",

        timeout: 120000,

        maxBuffer: 1024 * 1024

      }

    );

  } catch {

    throw new Error(

      "PRIVATE_MIGRATION_" +

      cmd.toUpperCase() +

      "_FAILED"

    );

  }

}


/* ==========================================
   PRIVATE SQLITE RECOVERY REHEARSAL
========================================== */

async function rehearse(s, extract) {

  const dir = fs.mkdtempSync(

    path.join(

      os.tmpdir(),

      "lsp-wallet-migration-"

    )

  );

  try {


    /* EXTRACT AUTHENTICATED BACKUP */

    await extract(
      s,
      dir,
      true
    );


    /* CREATE PRIVATE SQLITE CANDIDATE */

    migration("create", dir);


    /* IMPORT FINANCIAL SOURCE RECORDS */

    const financial = require(
      "./wallet-financial-receipts"
    );

    financial.run(
      "import",
      dir
    );


    /* VERIFY FINANCIAL ARCHIVE */

    const f = financial.run(
      "verify",
      dir
    );


    /* ====================================
       LEGACY RECEIPT VERIFICATION
    ==================================== */

    let legacy =
      "SKIPPED_PAYMENT_SOURCE_MISSING";


    if (

      s.files.some(

        x => x.name ===
          "lsp_pg_orders.json"

      )

    ) {

      const l = require(
        "./wallet-legacy-receipts"
      );

      l.run("import", dir);

      l.run("verify", dir);

      legacy = "VERIFIED";

    }


    /* FINAL BALANCE VERIFICATION */

    migration("verify", dir);


    need(

      f.archiveVerified === true,

      "PRIVATE_ARCHIVE_NOT_VERIFIED"

    );


    return {

      openingBalancesVerified: true,

      financialArchiveVerified: true,

      records: f.records,

      missingOptionalFiles:
        f.missingOptionalFiles,

      legacyReceiptVerification:
        legacy,

      productionReplayPerformed:
        false

    };


  } finally {


    /* REMOVE PRIVATE TEST DATABASE */

    fs.rmSync(dir, {

      recursive: true,

      force: true

    });

  }

}


/* ==========================================
   FORWARD RECOVERY READINESS REPORT
========================================== */

async function run(
  base,
  newer,
  extract,
  auditAnchor
) {

  const delta = compare(
    base,
    newer
  );


  /* VERIFY BOTH SNAPSHOTS AGAINST R2 */

  const a = await auditAnchor(base);

  const b = await auditAnchor(newer);


  const anchorMatchesNewer =

    b.anchorVerified === true &&

    b.anchorSnapshotCreatedAt ===
      newer.createdAt &&

    b.anchorOnly === 0 &&

    b.candidateOnly === 0 &&

    b.sourceHashDifferences.length === 0 &&

    b.anchorDeletionDirectoryPresent ===
      b.candidateDeletionDirectoryPresent;


  /* BUILD ISOLATED DATABASE CANDIDATES */

  const baseRehearsal =

    await rehearse(base, extract);

  const newerRehearsal =

    await rehearse(newer, extract);


  return {

    mode:
      "FORWARD_RECOVERY_REHEARSAL_ONLY",

    ...delta,

    anchorMatchesNewer,

    baseAnchorAudit: a,

    newerAnchorAudit: b,

    baseRehearsal,

    newerRehearsal,

    latestAnchorCertified: false,

    forwardRecoveryVerified: false,

    replayAllowed: false,

    activationAllowed: false

  };

}


/* ==========================================
   SYNTHETIC FORWARD RECOVERY TEST

   NO REAL ACCOUNT DATA
========================================== */

function test() {

  const s = (createdAt, coins) => ({

    scope: "JSON_ONLY",

    createdAt,

    files: [{

      name: "users.json",

      content: Buffer.from(

        JSON.stringify({

          A: {

            profile: { coins }

          }

        })

      ).toString("base64")

    }]

  });


  /* TEST BALANCE DIFFERENCE */

  const d = compare(

    s(1, 100),

    s(2, 110)

  );


  assert.equal(
    d.changedAccounts,
    1
  );

  assert.equal(
    d.balanceDeltaTotals.coins,
    "10"
  );

  assert.equal(
    d.newer.pendingPayments,
    null
  );


  /* TEST INVALID SNAPSHOT ORDER */

  assert.throws(

    () => compare(
      s(2, 100),
      s(1, 110)
    ),

    /STRICT_SNAPSHOT_ORDER_REQUIRED/

  );


  /* TEST INVALID BALANCE */

  assert.throws(

    () => compare(
      s(1, 100),
      s(2, -1)
    ),

    /INVALID_BALANCE/

  );


  /* ======================================
     SYNTHETIC TRANSACTION REPLAY
  ====================================== */

  const root = fs.mkdtempSync(

    path.join(

      os.tmpdir(),

      "lsp-forward-test-"

    )

  );


  let w;


  try {

    const { openWallet } = require(
      "./wallet-engine"
    );


    const f = path.join(
      root,
      "wallet-test.sqlite"
    );

    const saved = path.join(
      root,
      "opening.sqlite"
    );


    /* CREATE SYNTHETIC ACCOUNT */

    w = openWallet(f, {

      fixtures: [{

        uid: "TEST_A",

        coins: 100,

        coin_received: 0,

        coin_sent: 0,

        coin_deposit: 0

      }]

    });


    w.close();

    w = null;


    /* SAVE OPENING DATABASE */

    fs.copyFileSync(

      f,

      saved,

      fs.constants.COPYFILE_EXCL

    );


    const op = {

      actor: "TEST_ADMIN",

      requestId: randomUUID(),

      reason: "synthetic-credit",

      changes: [{

        uid: "TEST_A",

        delta: {

          coins: 10,

          coin_deposit: 10

        }

      }]

    };


    /* ORIGINAL SYNTHETIC TRANSACTION */

    w = openWallet(f);

    assert.equal(
      w.commit(op).duplicate,
      false
    );


    const expected = w.getBalance(
      "TEST_A"
    );


    w.close();

    w = null;


    /* RESTORE OLD TEST DATABASE */

    fs.copyFileSync(saved, f);


    /* REAPPLY KNOWN SYNTHETIC OPERATION */

    w = openWallet(f);

    assert.equal(
      w.commit(op).duplicate,
      false
    );


    w.close();

    w = null;


    /* RESTART AND TEST DUPLICATE */

    w = openWallet(f);

    assert.equal(
      w.commit(op).duplicate,
      true
    );


    assert.deepEqual(

      w.getBalance("TEST_A"),

      expected

    );


    /* CONFLICTING REQUEST REJECTION */

    assert.throws(

      () => w.commit({

        ...op,

        changes: [{

          uid: "TEST_A",

          delta: {

            coins: 11

          }

        }]

      }),

      /REQUEST_ID_CONFLICT/

    );


    /* FINAL SYNTHETIC LEDGER CHECK */

    assert.deepEqual(

      w.reconcile(),

      {

        ok: true,

        accounts: 1,

        transactions: 1,

        entries: 1

      }

    );


    console.log(

      "[FORWARD RECOVERY V1.9C TEST] PASS"

    );


  } finally {

    w?.close();

    fs.rmSync(root, {

      recursive: true,

      force: true

    });

  }

}


module.exports = {

  run

};


/* ==========================================
   TEST COMMAND ONLY
========================================== */

if (require.main === module) {

  if (

    process.argv.length !== 3 ||

    process.argv[2] !== "test"

  ) {

    console.error("Usage: test");

    process.exitCode = 1;

  } else {

    try {

      test();

    } catch (e) {

      console.error(

        "[FORWARD RECOVERY TEST] FAILED",

        e.code || e.message

      );

      process.exitCode = 1;

    }

  }

}