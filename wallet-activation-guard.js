"use strict";

/* ==========================================
   LIVESTREAM PRO
   FINAL WALLET ACTIVATION GUARD V1.0
   3B.4.6 - PREACTIVATION
========================================== */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");

const {
  execFileSync
} = require("node:child_process");


/* ==========================================
   PRODUCTION STORAGE MODE PROTECTION
========================================== */

function assertJsonOnly(

  mode = process.env.LSP_WALLET_STORAGE_MODE
    ?? "JSON_ONLY"

) {

  if (mode !== "JSON_ONLY") {

    throw new Error(
      "WALLET_ACTIVATION_BLOCKED"
    );

  }

  return mode;

}


/* ==========================================
   CURRENT ACTIVATION BLOCKERS
========================================== */

const blockers = Object.freeze([

  "ALL_WALLET_WRITERS_NOT_MIGRATED",

  "PRODUCTION_SQLITE_MODE_NOT_IMPLEMENTED",

  "LEGACY_REQUEST_ID_CASE_NOT_RESOLVED",

  "DELETED_ACCOUNT_RECEIPT_RETENTION_NOT_VERIFIED",

  "ALL_WRITERS_QUIESCENCE_NOT_VERIFIED",

  "PRODUCTION_BACKUP_AND_FORWARD_RECOVERY_NOT_VERIFIED",

  "INDEPENDENT_LATEST_TOMBSTONES_NOT_VERIFIED",

"UNIFIED_RECEIPT_ARCHIVE_NOT_CERTIFIED"

]);


/* ==========================================
   WALLET SOURCE CODE AUDIT
========================================== */

function audit(source) {

  const find = re =>

    source.split(/\r?\n/)

      .flatMap((line, i) =>

        re.test(line)
          ? [i + 1]
          : []

      );


  const saves = find(

    /\bsaveUsers\s*\(/

  );


  const adapters = find(

    /\blspWalletStorage\.begin\s*\(/

  );


  const fields = find(

    /\b(?:coins|coinReceived|coinSent|coinDeposit)\s*(?:[+\-*/]?=(?!=)|\+\+|--)/

  );


  return {

    sourceSha256: crypto

      .createHash("sha256")

      .update(source)

      .digest("hex"),

    saveUsersReferences: saves.length,

    saveUsersLines: saves,

    adapterReferences: adapters.length,

    adapterLines: adapters,

    possibleBalanceAssignments: fields.length,

    possibleBalanceAssignmentLines: fields,

    activationAllowed: false,

    blockers

  };

}


/* ==========================================
   INSPECT VERIFIED RECOVERY DATA
========================================== */

function inspectExtracted(dir) {

  const missing = [];


  const obj = x =>

    x !== null &&

    typeof x === "object" &&

    !Array.isArray(x);


  const array = x =>
    Array.isArray(x);


  function read(

    name,

    validate,

    optional = false

  ) {

    let raw;


    try {

      raw = fs.readFileSync(

        path.join(dir, name),

        "utf8"

      );

    } catch (e) {

      if (

        optional &&

        e.code === "ENOENT"

      ) {

        missing.push(name);

        return null;

      }

      throw e;

    }


    const x = JSON.parse(raw);


    if (!validate(x)) {

      throw new Error(

        "INVALID_RECOVERY_FILE:" + name

      );

    }

    return x;

  }


  /* LOAD VERIFIED DATABASES */

  const users = read(
    "users.json",
    obj
  );

  const orders = read(
    "lsp_pg_orders.json",
    obj
  );

  const withdrawals = read(
    "withdraw_requests.json",
    array,
    true
  );

  const market = read(
    "market_booths.json",
    obj,
    true
  );


  /* RECORD VALIDATION */

  const list = v => {

    if (v === undefined) return [];

    if (!array(v) || !v.every(obj)) {

      throw new Error(
        "INVALID_RECORD_LIST"
      );

    }

    return v;

  };


  const open = (rows, terminal) => {

    if (!rows.every(obj)) {

      throw new Error(
        "INVALID_RECORD_LIST"
      );

    }

    return rows.filter(

      r => !terminal.includes(r.status)

    ).length;

  };


  /* ======================================
     PENDING FINANCIAL OBLIGATIONS
  ====================================== */

  let transfers = 0;

  let holds = 0;

  let doubleOffers = 0;

  let receiptOwners = 0;


  for (

    const [uid, u] of Object.entries(users)

  ) {

    if (!obj(u) || !obj(u.profile)) {

      throw new Error("INVALID_ACCOUNT");

    }


    /* PENDING TRANSFERS */

    transfers += open(

      list(u.transferRequests),

      ["approved", "rejected"]

    );


    /* WITHDRAWAL HOLDS */

    holds += list(

      u.profile.withdrawHold

    ).filter(h =>

      !withdrawals?.some(w =>

        w.uid === uid &&

        w.id === h.id &&

        ["approved", "rejected"]

          .includes(w.status)

      )

    ).length;


    /* UNSETTLED REWARDS */

    if (

      u.wheel8DoubleOffer?.status === "pending"

    ) {

      doubleOffers++;

    }


    /* HISTORICAL RECEIPT OWNERS */

    if ([

      u.lspAdminWalletReceipts,

      u.lspWalletReceipts,

      u.profile.creditedPaymentInvoices

    ].some(m =>

      obj(m) &&

      Object.keys(m).length

    )) {

      receiptOwners++;

    }

  }


  /* ======================================
     MARKET ORDER RECONCILIATION
  ====================================== */

  let marketOrders =

    market === null
      ? null
      : 0;


  for (

    const b of Object.values(market ?? {})

  ) {

    if (b === null) continue;


    if (!obj(b)) {

      throw new Error(
        "INVALID_MARKET_RECORD"
      );

    }


    marketOrders += open(

      list(b.orders),

      ["done", "refunded", "cancelled"]

    );

  }


  /* ======================================
     ACCOUNT DELETION VERIFICATION
  ====================================== */

  const requestDir = path.join(

    dir,

    "account-deletion-requests"

  );


  const names = fs.readdirSync(requestDir)

    .filter(n =>

      /^[a-f0-9]{64}\.json$/.test(n)

    );


  let pendingDeletions = 0;


  for (const n of names) {

    const r = read(

      "account-deletion-requests/" + n,

      obj

    );


    if (r.status !== "completed") {

      pendingDeletions++;

    }

  }


  /* ======================================
     FINAL INSPECTION REPORT
  ====================================== */

  return {

    accounts:
      Object.keys(users).length,

    pendingPayments:

      open(

        Object.values(orders),

        ["paid", "sandbox_confirmed"]

      ),

    pendingWithdrawals:

      withdrawals === null

        ? null

        : open(

            withdrawals,

            ["approved", "rejected"]

          ),

    pendingTransferRecords:
      transfers,

    unresolvedWithdrawalHolds:
      holds,

    pendingDoubleOffers:
      doubleOffers,

    pendingMarketOrders:
      marketOrders,

    pendingDeletionRecords:
      pendingDeletions,

    accountsWithLegacyReceipts:
      receiptOwners,

    tombstones:

      require("./account-deletion-engine")

        .loadTombstones(dir).size,

    missingOptionalFiles:
      missing

  };

}


/* ==========================================
   FINAL MIGRATION PREFLIGHT
========================================== */

function preflight(bundle) {

  const root = fs.mkdtempSync(

    path.join(

      os.tmpdir(),

      "lsp-wallet-preflight-"

    )

  );


  try {

    const dest = path.join(

      root,

      "restored"

    );


    /* ====================================
       VERIFY AND EXTRACT BACKUP V2.1
    ==================================== */

    execFileSync(

      process.execPath,

      [

        path.join(

          __dirname,

          "security-database.js"

        ),

        "extract",

        path.resolve(bundle),

        dest

      ],

      {

        stdio: "pipe",

        timeout: 180000

      }

    );


    /* REQUIRE SQLITE MIGRATION CANDIDATE */

    if (

      !fs.lstatSync(

        path.join(

          dest,

          "candidate",

          "wallet-test.sqlite"

        )

      ).isFile()

    ) {

      throw new Error(
        "SQLITE_CANDIDATE_REQUIRED"
      );

    }


    return {

      backupVerified: true,

      ...inspectExtracted(dest),

      activationAllowed: false,

      blockers

    };


  } finally {

    fs.rmSync(root, {

      recursive: true,

      force: true

    });

  }

}


/* ==========================================
   COMMAND LINE INTERFACE
========================================== */

if (require.main === module) {

  try {

    const [

      cmd,

      input,

      ...extra

    ] = process.argv.slice(2);


    if (!input || extra.length) {

      throw new Error(

        "Usage: audit SERVER_JS | preflight BUNDLE"

      );

    }


    if (cmd === "audit") {

      console.log(

        JSON.stringify(

          audit(

            fs.readFileSync(input, "utf8")

          ),

          null,

          2

        )

      );


    } else if (cmd === "preflight") {

      console.log(

        JSON.stringify(

          preflight(input),

          null,

          2

        )

      );


      // Verified rehearsal.
      // Activation remains blocked.

      process.exitCode = 2;


    } else {

      throw new Error("INVALID_COMMAND");

    }


  } catch (e) {

    console.error(

      "[WALLET PREFLIGHT] FAILED",

      e.code || e.message

    );

    process.exitCode = 1;

  }

}


/* ==========================================
   MODULE EXPORTS
========================================== */

module.exports = {

  assertJsonOnly,

  audit,

  preflight

};