"use strict";

/* ==========================================
   LIVESTREAM PRO
   WALLET MIGRATION ENGINE V1.0
   REHEARSAL MODE - 3B.4A
========================================== */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");

const { DatabaseSync } = require("node:sqlite");
const { openWallet } = require("./wallet-engine");

const deletion =
  require("./account-deletion-engine");


/* ==========================================
   MIGRATION CONFIGURATION
========================================== */

const MAX_BYTES = 64 * 1024 * 1024;

const FIELDS = [
  "coins",
  "coin_received",
  "coin_sent",
  "coin_deposit"
];

const fail = code => {
  throw new Error(code);
};

const object = x =>
  x !== null &&
  typeof x === "object" &&
  !Array.isArray(x);

const sha = b => crypto
  .createHash("sha256")
  .update(b)
  .digest("hex");


/* ==========================================
   PRIVATE MIGRATION DIRECTORY
========================================== */

function privateRoot(dir) {

  const root = fs.realpathSync(dir);
  const st = fs.statSync(root);

  if (
    path.dirname(root) !==
      fs.realpathSync(os.tmpdir()) ||

    !path.basename(root)
      .startsWith("lsp-wallet-migration-") ||

    !st.isDirectory() ||

    (st.mode & 0o077)
  ) {

    fail(
      "PRIVATE_MIGRATION_DIRECTORY_REQUIRED"
    );

  }

  return root;

}


/* ==========================================
   READ SOURCE DATABASE
========================================== */

function sourceBytes(root) {

  const fd = fs.openSync(

    path.join(root, "users.json"),

    fs.constants.O_RDONLY |
    fs.constants.O_NOFOLLOW

  );

  try {

    const st = fs.fstatSync(fd);

    if (

      !st.isFile() ||

      (st.mode & 0o077) ||

      st.size <= 0 ||

      st.size > MAX_BYTES

    ) {

      fail("INVALID_SOURCE_FILE");

    }

    const raw = fs.readFileSync(fd);

    if (

      raw.length !== st.size ||

      raw.length > MAX_BYTES

    ) {

      fail("SOURCE_CHANGED");

    }

    return raw;

  } finally {

    fs.closeSync(fd);

  }

}


/* ==========================================
   VALIDATE WALLET BALANCES
========================================== */

function amount(value, optional = false) {

  if (optional && value === undefined) {

    return 0;

  }

  if (

    typeof value === "string" &&

    /^\d+$/.test(value)

  ) {

    value = Number(value);

  }

  if (

    !Number.isSafeInteger(value) ||

    value < 0

  ) {

    fail("INVALID_WALLET_AMOUNT");

  }

  return value;

}


/* ==========================================
   MIGRATION PREFLIGHT INSPECTION
========================================== */

function inspect(root) {

  const raw = sourceBytes(root);

  let users;

  try {

    users = JSON.parse(
      raw.toString("utf8")
    );

  } catch {

    fail("INVALID_USERS_JSON");

  }


  if (!object(users)) {

    fail("INVALID_USERS_DB");

  }


  const rows = [];

  const sums = FIELDS.map(() => 0n);


  /* LEGACY RECEIPT INVENTORY */

  const markers = {

    admin: 0,

    legacy: 0,

    payments: 0

  };


  const count = (map, key) => {

    if (map === undefined) return;

    if (!object(map)) {

      fail("INVALID_RECEIPT_MAP");

    }

    markers[key] += Object.keys(map).length;

  };


  /* EXTRACT WALLET ACCOUNTS */

  for (

    const [uid, user] of Object.entries(users)

  ) {

    if (

      !uid ||

      uid.length > 128 ||

      uid.trim() !== uid ||

      !object(user?.profile)

    ) {

      fail(
        "ACCOUNT_REQUIRES_MANUAL_RECONCILIATION"
      );

    }


    const p = user.profile;


    const row = {

      uid,

      coins:
        amount(p.coins),

      coin_received:
        amount(p.coinReceived, true),

      coin_sent:
        amount(p.coinSent, true),

      coin_deposit:
        amount(p.coinDeposit, true)

    };


    FIELDS.forEach((f, i) => {

      sums[i] += BigInt(row[f]);

    });


    rows.push(row);


    count(
      user.lspAdminWalletReceipts,
      "admin"
    );


    count(
      user.lspWalletReceipts,
      "legacy"
    );


    count(
      p.creditedPaymentInvoices,
      "payments"
    );

  }


  if (!rows.length) {

    fail("EMPTY_SOURCE");

  }


  /* CHECK EXISTING DELETION TOMBSTONES */

  const folder = path.join(

    root,

    "account-deletion-requests"

  );


  let tombstones = null;


  if (fs.existsSync(folder)) {

    if (!fs.lstatSync(folder).isDirectory()) {

      fail("INVALID_TOMBSTONE_DIRECTORY");

    }

    tombstones =
      deletion.loadTombstones(root).size;

  }


  return {

    rows,

    digest: sha(raw),

    markers,

    tombstones,

    totals: Object.fromEntries(

      FIELDS.map((f, i) => [

        f,

        sums[i].toString()

      ])

    )

  };

}


/* ==========================================
   DURABLE DIRECTORY SYNC
========================================== */

function syncDir(dir) {

  const fd = fs.openSync(dir, "r");

  try {

    fs.fsyncSync(fd);

  } finally {

    fs.closeSync(fd);

  }

}


/* ==========================================
   FULL MIGRATION VERIFICATION
========================================== */

function verify(root, source = inspect(root)) {

  const dir = path.join(root, "candidate");

  const st = fs.lstatSync(dir);


  if (

    !st.isDirectory() ||

    (st.mode & 0o077)

  ) {

    fail("INVALID_CANDIDATE_DIRECTORY");

  }


  const filename = path.join(

    dir,

    "wallet-test.sqlite"

  );


  const wallet = openWallet(filename);


  try {


    /* VERIFY SQLITE LEDGER */

    assert.deepEqual(

      wallet.reconcile(),

      {

        ok: true,

        accounts: source.rows.length,

        transactions: 0,

        entries: 0

      }

    );


    /* VERIFY EVERY ACCOUNT */

    for (const row of source.rows) {

      assert.deepEqual(

        wallet.getBalance(row.uid),

        row,

        "BALANCE_MISMATCH"

      );


      assert.equal(

        wallet.getClosure(row.uid),

        null,

        "UNEXPECTED_CLOSURE"

      );

    }


  } finally {

    wallet.close();

  }


  /* VERIFY MIGRATION SOURCE CHECKSUM */

  const db = new DatabaseSync(

    filename,

    { readOnly: true }

  );


  try {

    assert.equal(

      db.prepare(

        "SELECT value FROM wallet_meta " +

        "WHERE key='migration_source_sha256'"

      ).get()?.value,

      source.digest,

      "SOURCE_DIGEST_MISMATCH"

    );

  } finally {

    db.close();

  }


  if (sha(sourceBytes(root)) !== source.digest) {

    fail("SOURCE_CHANGED");

  }


  return {

    mode: "REHEARSAL_ONLY",

    accounts: source.rows.length,

    totals: source.totals,

    legacyMarkers: source.markers,

    tombstonesInCopy: source.tombstones,

    sourceSha256: source.digest,

    activationAllowed: false

  };

}


/* ==========================================
   CREATE SQLITE MIGRATION CANDIDATE
========================================== */

function create(root) {

  const source = inspect(root);


  const dir = path.join(

    root,

    "candidate"

  );


  // Never overwrite an existing candidate.

  fs.mkdirSync(dir, {

    mode: 0o700

  });


  const filename = path.join(

    dir,

    "wallet-test.sqlite"

  );


  try {


    /* IMPORT OPENING BALANCES */

    const wallet = openWallet(filename, {

      fixtures: source.rows

    });


    wallet.close();


    /* SAVE SOURCE MIGRATION METADATA */

    const db = new DatabaseSync(filename);


    try {

      db.exec(

        "PRAGMA synchronous=FULL"

      );


      db.prepare(

        "INSERT INTO wallet_meta(key,value) " +

        "VALUES (?,?)"

      ).run(

        "migration_source_sha256",

        source.digest

      );


    } finally {

      db.close();

    }


    /* VERIFY BEFORE ACCEPTING CANDIDATE */

    const report = verify(root, source);


    syncDir(dir);

    syncDir(root);


    return report;


  } catch (e) {


    // Remove only the newly created candidate.

    fs.rmSync(dir, {

      recursive: true,

      force: true

    });


    throw e;

  }

}


/* ==========================================
   AUTOMATIC MIGRATION TEST
========================================== */

function selfTest() {

  const root = privateRoot(

    fs.mkdtempSync(

      path.join(

        os.tmpdir(),

        "lsp-wallet-migration-"

      )

    )

  );


  try {

    const source = path.join(

      root,

      "users.json"

    );


    const users = {

      A: {

        profile: {

          coins: "1000",

          coinReceived: 20,

          coinSent: 10,

          coinDeposit: 1100,

          creditedPaymentInvoices: {

            test: { diamonds: 100 }

          }

        },

        lspAdminWalletReceipts: {

          test: {}

        }

      },


      B: {

        profile: {

          coins: 500

        }

      }

    };


    fs.writeFileSync(

      source,

      JSON.stringify(users),

      {

        mode: 0o600,

        flag: "wx"

      }

    );


    const report = create(root);


    assert.equal(

      report.totals.coins,

      "1500"

    );


    assert.equal(

      report.legacyMarkers.admin,

      1

    );


    assert.equal(

      report.legacyMarkers.payments,

      1

    );


    assert.equal(

      report.activationAllowed,

      false

    );


    assert.deepEqual(

      verify(root),

      report

    );


    /* DETECT SOURCE RECEIPT CHANGES */

    users.A.profile
      .creditedPaymentInvoices.extra = {};


    fs.writeFileSync(

      source,

      JSON.stringify(users)

    );


    assert.throws(

      () => verify(root),

      /SOURCE_DIGEST_MISMATCH/

    );


    delete users.A.profile
      .creditedPaymentInvoices.extra;


    fs.writeFileSync(

      source,

      JSON.stringify(users)

    );


    assert.deepEqual(

      verify(root),

      report

    );


    /* PREVENT DATABASE OVERWRITE */

    assert.throws(

      () => create(root),

      /EEXIST/

    );


    /* DETECT PER-ACCOUNT MISMATCH */

    users.A.profile.coins = 999;

    users.B.profile.coins = 501;


    fs.writeFileSync(

      source,

      JSON.stringify(users)

    );


    assert.throws(

      () => verify(root),

      /BALANCE_MISMATCH/

    );


    /* REJECT INVALID BALANCE */

    users.A.profile.coins = -1;


    fs.writeFileSync(

      source,

      JSON.stringify(users)

    );


    assert.throws(

      () => inspect(root),

      /INVALID_WALLET_AMOUNT/

    );


    console.log(

      "[WALLET MIGRATION TEST] PASS"

    );


  } finally {

    fs.rmSync(root, {

      recursive: true,

      force: true

    });

  }

}


/* ==========================================
   MIGRATION COMMAND LINE INTERFACE
========================================== */

try {

  const [cmd, dir, ...extra] =

    process.argv.slice(2);


  if (

    cmd === "test" &&

    !dir &&

    !extra.length

  ) {

    selfTest();


  } else if (

    ["inspect", "create", "verify"]
      .includes(cmd) &&

    dir &&

    !extra.length

  ) {

    const root = privateRoot(dir);


    if (cmd === "inspect") {

      const {

        rows,

        digest,

        markers,

        tombstones,

        totals

      } = inspect(root);


      console.log(

        "[WALLET MIGRATION]",

        {

          accounts: rows.length,

          digest,

          markers,

          tombstones,

          totals,

          activationAllowed: false

        }

      );


    } else {

      console.log(

        "[WALLET MIGRATION]",

        cmd.toUpperCase(),

        cmd === "create"

          ? create(root)

          : verify(root)

      );

    }


  } else {

    fail(

      "Usage: node wallet-migration.js test | " +

      "inspect/create/verify PRIVATE_DIRECTORY"

    );

  }


} catch (e) {

  console.error(

    "[WALLET MIGRATION] FAILED",

    e.code === "ERR_ASSERTION"

      ? "RECONCILIATION_FAILED"

      : (e.code || e.message)

  );


  process.exitCode = 1;

}