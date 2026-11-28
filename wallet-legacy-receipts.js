"use strict";

/* ==========================================
   LIVESTREAM PRO
   LEGACY TRANSACTION RECEIPT MIGRATION V1.0
   3B.4.2 - REHEARSAL MODE ONLY
========================================== */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");

const { execFileSync } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");


/* ==========================================
   SECURITY UTILITIES
========================================== */

const sha = b => crypto
  .createHash("sha256")
  .update(b)
  .digest("hex");

const hash = x => sha(JSON.stringify(x));

const fail = code => {
  throw new Error(code);
};

const obj = x =>
  x !== null &&
  typeof x === "object" &&
  !Array.isArray(x);

const hex = x =>
  typeof x === "string" &&
  /^[a-f0-9]{64}$/.test(x);

const uidOK = x =>
  typeof x === "string" &&
  x.length > 0 &&
  x.length <= 128 &&
  x.trim() === x;

const positive = x =>
  Number.isSafeInteger(x) &&
  x > 0;

const invoiceOK = x =>
  typeof x === "string" &&
  /^LSP[A-F0-9]{20}$/.test(x);

const equal = (a, b) =>
  JSON.stringify(a) === JSON.stringify(b);

const compareOrigin = (a, b) => {

  for (let i = 0; i < 3; i++) {

    if (a[i] < b[i]) return -1;

    if (a[i] > b[i]) return 1;

  }

  return 0;

};

const META = "legacy_receipt_manifest_v1";


/* ==========================================
   PRIVATE DIRECTORY PROTECTION
========================================== */

function privateDir(dir) {

  const st = fs.lstatSync(dir);

  if (
    !st.isDirectory() ||
    (st.mode & 0o077)
  ) {

    fail("UNSAFE_DIRECTORY");

  }

}


function rootCheck(dir) {

  const root = fs.realpathSync(dir);

  privateDir(root);

  if (

    path.dirname(root) !==
      fs.realpathSync(os.tmpdir()) ||

    !path.basename(root)
      .startsWith("lsp-wallet-migration-")

  ) {

    fail("REHEARSAL_DIRECTORY_REQUIRED");

  }

  return root;

}


/* ==========================================
   SECURE JSON SOURCE READER
========================================== */

function readJson(root, name) {

  const fd = fs.openSync(

    path.join(root, name),

    fs.constants.O_RDONLY |
    fs.constants.O_NOFOLLOW

  );

  try {

    const st = fs.fstatSync(fd);

    if (

      !st.isFile() ||

      (st.mode & 0o077) ||

      st.size <= 0 ||

      st.size > 64 * 1024 * 1024

    ) {

      fail("UNSAFE_SOURCE");

    }


    const raw = fs.readFileSync(fd);


    if (raw.length !== st.size) {

      fail("SOURCE_CHANGED");

    }


    const data = JSON.parse(
      raw.toString("utf8")
    );


    if (!obj(data)) {

      fail("INVALID_SOURCE_OBJECT");

    }


    return {

      data,

      digest: sha(raw)

    };

  } finally {

    fs.closeSync(fd);

  }

}


/* ==========================================
   VALIDATE LEGACY RECEIPT MAP
========================================== */

function pairs(map) {

  if (map === undefined) {

    return [];

  }


  if (!obj(map)) {

    fail("INVALID_RECEIPT_MAP");

  }


  return Object.entries(map);

}


/* ==========================================
   LEGACY RECEIPT INVENTORY
========================================== */

function inventory(root) {

  const u = readJson(

    root,

    "users.json"

  );


  const o = readJson(

    root,

    "lsp_pg_orders.json"

  );


  const admins = new Map();

  const payments = new Map();

  const origins = [];


  let adminSources = 0;

  let legacySources = 0;

  let pendingCredited = 0;

  let pendingUncredited = 0;


  /* ======================================
     EXTRACT ADMIN TRANSACTION RECEIPTS
  ====================================== */

  for (

    const [owner, user] of Object.entries(u.data)

  ) {

    if (

      !uidOK(owner) ||

      !obj(user?.profile)

    ) {

      fail("INVALID_ACCOUNT");

    }


    for (

      const [map, isLegacy] of [

        [
          user.lspAdminWalletReceipts,
          false
        ],

        [
          user.lspWalletReceipts,
          true
        ]

      ]

    ) {


      for (

        const [key, r] of pairs(map)

      ) {

        const target = isLegacy
          ? owner
          : r?.targetUid;


        if (

          !hex(key) ||

          !obj(r) ||

          !hex(r.fingerprint) ||

          !uidOK(target) ||

          !["topup", "withdraw"]
            .includes(r.kind) ||

          !positive(r.amount) ||

          !positive(r.at)

        ) {

          fail("INVALID_ADMIN_RECEIPT");

        }


        const row = [

          key,

          r.fingerprint,

          target,

          r.kind,

          r.amount

        ];


        /* DETECT CONFLICTING RECEIPTS */

        if (

          admins.has(key) &&

          !equal(admins.get(key), row)

        ) {

          fail("LEGACY_ADMIN_CONFLICT");

        }


        admins.set(key, row);


        origins.push([

          key,

          owner,

          isLegacy
            ? "legacy"
            : "admin",

          r.at

        ]);


        if (isLegacy) {

          legacySources++;

        } else {

          adminSources++;

        }

      }

    }


    /* ====================================
       EXTRACT PAYMENT INVOICE RECEIPTS
    ==================================== */

    for (

      const [invoice, r] of pairs(

        user.profile.creditedPaymentInvoices

      )

    ) {

      if (

        !invoiceOK(invoice) ||

        !obj(r) ||

        !positive(r.diamonds) ||

        !positive(r.at)

      ) {

        fail("INVALID_PAYMENT_RECEIPT");

      }


      if (payments.has(invoice)) {

        fail("DUPLICATE_PAYMENT_INVOICE");

      }


      payments.set(invoice, [

        invoice,

        owner,

        r.diamonds,

        r.at

      ]);

    }

  }


  /* ======================================
     PAYMENT ORDER RECONCILIATION
  ====================================== */

  for (

    const [invoice, r] of payments

  ) {

    const order = Object.hasOwn(
      o.data,
      invoice
    )

      ? o.data[invoice]

      : null;


    if (

      !obj(order) ||

      order.uid !== r[1] ||

      order.diamonds !== r[2] ||

      !["pending", "paid"]
        .includes(order.status)

    ) {

      fail("PAYMENT_ORDER_MISMATCH");

    }


    if (order.status === "pending") {

      pendingCredited++;

    }

  }


  /* ======================================
     DETECT MISSING PAYMENT RECEIPTS
  ====================================== */

  for (

    const [invoice, order] of Object.entries(o.data)

  ) {

    if (

      !invoiceOK(invoice) ||

      !obj(order) ||

      !uidOK(order.uid) ||

      !positive(order.diamonds) ||

      ![
        "pending",
        "paid",
        "sandbox_confirmed"
      ].includes(order.status)

    ) {

      fail("INVALID_PAYMENT_ORDER");

    }


    if (

      order.status === "paid" &&

      !payments.has(invoice)

    ) {

      fail("PAID_ORDER_WITHOUT_RECEIPT");

    }


    if (

      order.status === "pending" &&

      !payments.has(invoice)

    ) {

      pendingUncredited++;

    }

  }


  /* ======================================
     BUILD MIGRATION MANIFEST
  ====================================== */

  const sorted = m =>

    [...m.keys()]
      .sort()
      .map(k => m.get(k));


  const admin = sorted(admins);

  const payment = sorted(payments);


  origins.sort(compareOrigin);


  const manifest = {

    version: 1,

    usersSha256: u.digest,

    ordersSha256: o.digest,

    adminSources,

    legacySources,

    adminCount: admin.length,

    paymentCount: payment.length,

    pendingCredited,

    pendingUncredited,

    receiptSha256: hash([

      admin,

      payment,

      origins

    ])

  };


  return {

    admin,

    payment,

    origins,

    manifest

  };

}


/* ==========================================
   LEGACY ADMIN REQUEST LOOKUP
========================================== */

function classifyAdmin(

  db,

  actor,

  requestId,

  kind,

  target,

  amount,

  note = ""

) {

  if (

    !uidOK(actor) ||

    !uidOK(target) ||

    typeof requestId !== "string" ||

    !/^[A-Za-z0-9_-]{16,128}$/
      .test(requestId) ||

    !["topup", "withdraw"]
      .includes(kind) ||

    !positive(amount) ||

    typeof note !== "string" ||

    note.length > 500

  ) {

    fail("INVALID_LOOKUP");

  }


  /* ======================================
     PRESERVE ORIGINAL REQUEST ID SPELLING
  ====================================== */

  const receiptKey = hash([

    actor,

    requestId

  ]);


  const fingerprint = hash([

    kind,

    target,

    amount,

    note

  ]);


  const row = db.prepare(

    "SELECT fingerprint " +

    "FROM legacy_admin_receipts " +

    "WHERE receipt_key=?"

  ).get(receiptKey);


  if (!row) {

    return "NOT_FOUND";

  }


  if (row.fingerprint === fingerprint) {

    return "DUPLICATE";

  }


  return "CONFLICT";

}


/* ==========================================
   LEGACY PAYMENT INVOICE LOOKUP
========================================== */

function classifyPayment(

  db,

  invoice,

  uid,

  diamonds

) {

  if (

    !invoiceOK(invoice) ||

    !uidOK(uid) ||

    !positive(diamonds)

  ) {

    fail("INVALID_LOOKUP");

  }


  const row = db.prepare(

    "SELECT uid,diamonds " +

    "FROM legacy_payment_receipts " +

    "WHERE invoice=?"

  ).get(invoice);


  if (!row) {

    return "NOT_FOUND";

  }


  if (

    row.uid === uid &&

    row.diamonds === diamonds

  ) {

    return "DUPLICATE";

  }


  return "CONFLICT";

}


/* ==========================================
   LEGACY RECEIPT MIGRATION ENGINE
========================================== */

function run(command, dir) {

  if (

    !["import", "verify"]
      .includes(command)

  ) {

    fail("INVALID_COMMAND");

  }


  const root = rootCheck(dir);


  /* VERIFY PREVIOUS MIGRATION */

  execFileSync(

    process.execPath,

    [

      path.join(

        __dirname,

        "wallet-migration.js"

      ),

      "verify",

      root

    ],

    {

      stdio: "ignore"

    }

  );


  const s = inventory(root);


  const candidate = path.join(

    root,

    "candidate"

  );


  privateDir(candidate);


  const filename = path.join(

    candidate,

    "wallet-test.sqlite"

  );


  const st = fs.lstatSync(filename);


  if (

    !st.isFile() ||

    (st.mode & 0o077)

  ) {

    fail("UNSAFE_CANDIDATE");

  }


  /* ======================================
     OPEN SQLITE DATABASE
  ====================================== */

  const db = new DatabaseSync(

    filename,

    {

      readOnly: command === "verify"

    }

  );


  try {

    db.exec(`

      PRAGMA busy_timeout=1000;

      PRAGMA foreign_keys=ON;

    `);


    if (command === "import") {

      db.exec(

        "PRAGMA synchronous=FULL;"

      );

    }


    db.exec(

      command === "import"

        ? "BEGIN IMMEDIATE"

        : "BEGIN"

    );


    try {


      /* ==================================
         VERIFY MIGRATION METADATA
      ================================== */

      const meta = key =>

        db.prepare(

          "SELECT value FROM wallet_meta " +

          "WHERE key=?"

        ).get(key)?.value;


      if (

        meta("mode") !== "ENGINE_TEST_V1" ||

        meta("migration_source_sha256") !==
          s.manifest.usersSha256 ||

        db.prepare(

          "SELECT COUNT(*) AS n " +

          "FROM wallet_transactions"

        ).get().n !== 0

      ) {

        fail("CANDIDATE_MISMATCH");

      }


      const existing = meta(META);


      /* ==================================
         CREATE LEGACY RECEIPT TABLES
      ================================== */

      if (

        command === "import" &&

        existing === undefined

      ) {

        db.exec(`

          CREATE TABLE legacy_admin_receipts (

            receipt_key TEXT PRIMARY KEY,

            fingerprint TEXT NOT NULL,

            target_uid TEXT NOT NULL,

            kind TEXT NOT NULL
              CHECK(kind IN ('topup','withdraw')),

            amount INTEGER NOT NULL
              CHECK(amount>0)

          ) STRICT;


          CREATE TABLE legacy_admin_receipt_sources (

            receipt_key TEXT NOT NULL
              REFERENCES legacy_admin_receipts(receipt_key),

            owner_uid TEXT NOT NULL,

            source_kind TEXT NOT NULL
              CHECK(source_kind IN ('admin','legacy')),

            recorded_at INTEGER NOT NULL
              CHECK(recorded_at>0),

            PRIMARY KEY(
              receipt_key,
              owner_uid,
              source_kind
            )

          ) STRICT;


          CREATE TABLE legacy_payment_receipts (

            invoice TEXT PRIMARY KEY,

            uid TEXT NOT NULL,

            diamonds INTEGER NOT NULL
              CHECK(diamonds>0),

            credited_at INTEGER NOT NULL
              CHECK(credited_at>0)

          ) STRICT;

        `);


        /* ==================================
           IMPORT ADMIN RECEIPTS
        ================================== */

        const a = db.prepare(

          "INSERT INTO legacy_admin_receipts " +

          "VALUES(?,?,?,?,?)"

        );


        for (const row of s.admin) {

          a.run(...row);

        }


        /* ==================================
           IMPORT PAYMENT RECEIPTS
        ================================== */

        const p = db.prepare(

          "INSERT INTO legacy_payment_receipts " +

          "VALUES(?,?,?,?)"

        );


        for (const row of s.payment) {

          p.run(...row);

        }


        /* ==================================
           PRESERVE RECEIPT SOURCE RECORDS
        ================================== */

        const origin = db.prepare(

          "INSERT INTO legacy_admin_receipt_sources " +

          "VALUES(?,?,?,?)"

        );


        for (const row of s.origins) {

          origin.run(...row);

        }


        /* SAVE MIGRATION MANIFEST */

        db.prepare(

          "INSERT INTO wallet_meta VALUES(?,?)"

        ).run(

          META,

          JSON.stringify(s.manifest)

        );

      }


      /* ==================================
         VERIFY IMPORTED ADMIN RECEIPTS
      ================================== */

      const a = db.prepare(

        "SELECT receipt_key,fingerprint," +

        "target_uid,kind,amount " +

        "FROM legacy_admin_receipts " +

        "ORDER BY receipt_key"

      ).all().map(

        r => Object.values(r)

      );


      /* ==================================
         VERIFY IMPORTED PAYMENT RECEIPTS
      ================================== */

      const p = db.prepare(

        "SELECT invoice,uid,diamonds,credited_at " +

        "FROM legacy_payment_receipts " +

        "ORDER BY invoice"

      ).all().map(

        r => Object.values(r)

      );


      const origins = db.prepare(

        "SELECT receipt_key,owner_uid," +

        "source_kind,recorded_at " +

        "FROM legacy_admin_receipt_sources " +

        "ORDER BY receipt_key,owner_uid,source_kind"

      ).all().map(

        r => Object.values(r)

      ).sort(compareOrigin);


      /* ==================================
         FULL RECEIPT RECONCILIATION
      ================================== */

      if (

        meta(META) !==
          JSON.stringify(s.manifest) ||

        !equal(a, s.admin) ||

        !equal(p, s.payment) ||

        !equal(origins, s.origins)

      ) {

        fail("RECEIPT_RECONCILIATION_FAILED");

      }


      /* ==================================
         SQLITE INTEGRITY CHECK
      ================================== */

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


      /* VERIFY SOURCE DID NOT CHANGE */

      if (

        !equal(

          inventory(root).manifest,

          s.manifest

        )

      ) {

        fail("SOURCE_CHANGED");

      }


      /* ==================================
         COMMIT ALL LEGACY RECEIPTS
      ================================== */

      db.exec("COMMIT");


      return {

        ...s.manifest,

        mode: "REHEARSAL_ONLY",

        activationAllowed: false

      };


    } catch (e) {

      try {

        db.exec("ROLLBACK");

      } catch {}

      throw e;

    }


  } finally {

    db.close();

  }

}


/* ==========================================
   COMMAND LINE INTERFACE
========================================== */

if (require.main === module) {

  try {

    const [cmd, dir, ...extra] =

      process.argv.slice(2);


    if (!dir || extra.length) {

      fail(

        "Usage: node wallet-legacy-receipts.js " +

        "import|verify PRIVATE_DIRECTORY"

      );

    }


    console.log(

      "[LEGACY RECEIPTS]",

      run(cmd, dir)

    );


  } catch (e) {

    console.error(

      "[LEGACY RECEIPTS] FAILED",

      e.code || e.message

    );


    process.exitCode = 1;

  }

}


/* ==========================================
   MODULE EXPORTS
========================================== */

module.exports = {

  run,

  classifyAdmin,

  classifyPayment

};