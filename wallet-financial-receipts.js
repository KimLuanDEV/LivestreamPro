"use strict";

/* ==========================================
   LIVESTREAM PRO
   FINANCIAL RECEIPT MIGRATION V1.7
   SQLITE REHEARSAL ONLY
========================================== */

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const META = "financial_source_manifest_v17";
const TABLE = "financial_source_records_v17";

const LIMIT = 64 * 1024 * 1024;

const obj = x =>
  x !== null &&
  typeof x === "object" &&
  !Array.isArray(x);

const sha = x =>
  crypto.createHash("sha256")
    .update(x)
    .digest("hex");

function need(ok, code) {
  if (!ok) throw new Error(code);
}


/* ==========================================
   PRIVATE DATABASE PROTECTION
========================================== */

function privatePath(p, directory) {

  const s = fs.lstatSync(p);

  need(
    (directory ? s.isDirectory() : s.isFile()) &&
    !(s.mode & 0o077) &&
    s.uid === process.getuid() &&
    (directory || s.nlink === 1),

    "UNSAFE_PRIVATE_PATH"
  );

}

function rootCheck(dir) {

  const root = fs.realpathSync(dir);

  need(
    root === path.resolve(dir) &&
    path.dirname(root) === fs.realpathSync(os.tmpdir()) &&
    path.basename(root).startsWith("lsp-wallet-migration-"),

    "PRIVATE_MIGRATION_DIRECTORY_REQUIRED"
  );

  privatePath(root, true);

  return root;

}


/* ==========================================
   FINANCIAL SOURCE INVENTORY
========================================== */

function inventory(root) {

  const hashes = {};
  const rows = [];
  const counts = {};

  let bytes = 0;


  /* SECURE JSON READER */

  function read(name, optional = false) {

    let fd;

    try {

      fd = fs.openSync(
        path.join(root, name),

        fs.constants.O_RDONLY |
        fs.constants.O_NOFOLLOW |
        fs.constants.O_NONBLOCK
      );

    } catch (e) {

      if (optional && e.code === "ENOENT") {

        hashes[name] = null;

        return undefined;

      }

      throw e;

    }

    try {

      const st = fs.fstatSync(fd);

      need(
        st.isFile() &&
        !(st.mode & 0o077) &&
        st.uid === process.getuid() &&
        st.size > 0 &&
        bytes + st.size <= LIMIT,

        "INVALID_SOURCE_FILE"
      );

      const raw = fs.readFileSync(fd);

      need(
        raw.length === st.size,
        "SOURCE_CHANGED"
      );

      bytes += raw.length;

      hashes[name] = sha(raw);

      return JSON.parse(raw.toString("utf8"));

    } finally {

      fs.closeSync(fd);

    }

  }


  /* ======================================
     FINANCIAL RECORD COLLECTOR
  ====================================== */

  function add(source, owner, key, value) {

    need(
      obj(value),
      "INVALID_RECORD:" + source
    );

    const payload = JSON.stringify(value);

    rows.push([

      source,

      owner,

      String(key),

      payload,

      sha(payload)

    ]);

    counts[source] =
      (counts[source] || 0) + 1;

  }


  function map(source, owner, value) {

    if (value === undefined) return;

    need(
      obj(value),
      "INVALID_MAP:" + source
    );

    for (const [k, v] of Object.entries(value)) {

      add(source, owner, k, v);

    }

  }


  function list(source, owner, value) {

    if (value === undefined) return;

    need(
      Array.isArray(value),
      "INVALID_LIST:" + source
    );

    value.forEach((v, i) =>

      add(source, owner, i, v)

    );

  }


  function single(source, owner, value) {

    if (value !== undefined) {

      add(source, owner, "record", value);

    }

  }


  /* ======================================
     WALLET BALANCE VALIDATION
  ====================================== */

  const balances = [];

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

    need(
      Number.isSafeInteger(value) && value >= 0,
      "INVALID_WALLET_AMOUNT"
    );

    return value;

  }


  /* ======================================
     READ ACCOUNT DATABASE
  ====================================== */

  const users = read("users.json");

  need(
    obj(users) &&
    Object.keys(users).length > 0,

    "INVALID_USERS"
  );


  for (const [uid, u] of Object.entries(users)) {

    need(
      uid && obj(u) && obj(u.profile),
      "INVALID_ACCOUNT"
    );

    const p = u.profile;


    /* PRESERVE FOUR WALLET FIELDS */

    balances.push([

      uid,

      amount(p.coins),

      amount(p.coinReceived, true),

      amount(p.coinSent, true),

      amount(p.coinDeposit, true)

    ]);


    /* ====================================
       ACCOUNT LEVEL RECEIPTS
    ==================================== */

    for (const field of [

      "lspAdminWalletReceipts",

      "lspWalletReceipts",

      "socialGiftReceipts",

      "marketWalletReceipts",

      "spiritPurchaseReceipts",

      "spiritRewardReceipts",

      "gameRewardReceipts"

    ]) {

      map(field, uid, u[field]);

    }


    /* ====================================
       PROFILE LEVEL RECEIPTS
    ==================================== */

    for (const field of [

      "creditedPaymentInvoices",

      "sfuGiftReceipts",

      "linkedGiftReceipts"

    ]) {

      map("profile." + field, uid, p[field]);

    }


    /* ====================================
       ACCOUNT FINANCIAL RECORDS
    ==================================== */

    for (const field of [

      "withdrawRefundRecords",

      "transferRequests",

      "transferHistory",

      "spiritBeasts",

      "dtpHistory",

      "timeRaceHistory"

    ]) {

      list(field, uid, u[field]);

    }


    /* ====================================
       PROFILE FINANCIAL RECORDS
    ==================================== */

    for (const field of [

      "withdrawHold",

      "liveGiftHistory",

      "depositLogs"

    ]) {

      list("profile." + field, uid, p[field]);

    }


    /* LEGACY DOUBLE OFFER */

    single(
      "wheel8DoubleOffer",
      uid,
      u.wheel8DoubleOffer
    );


    /* MARKET RECOVERY JOURNAL */

    single(
      "lspMarketPending",
      uid,
      u.lspMarketPending
    );


    /* ====================================
       GAME WALLET LEDGER
    ==================================== */

    if (u.gameWalletLedgerV16 !== undefined) {

      need(
        u.gameWalletLedgerV16?.version === 1 &&
        obj(u.gameWalletLedgerV16.entries),

        "INVALID_GAME_LEDGER"
      );

      map(
        "gameWalletLedgerV16.entries",
        uid,
        u.gameWalletLedgerV16.entries
      );

    }

  }


  /* ======================================
     WITHDRAWAL DATABASE
  ====================================== */

  list(
    "withdraw_requests.json",
    "",
    read("withdraw_requests.json", true)
  );


  /* ======================================
     PAYMENT ORDER DATABASE
  ====================================== */

  map(
    "lsp_pg_orders.json",
    "",
    read("lsp_pg_orders.json", true)
  );


  /* ======================================
     MARKET ORDER DATABASE
  ====================================== */

  const market = read(
    "market_booths.json",
    true
  );

  if (market !== undefined) {

    need(obj(market), "INVALID_MARKET");

    for (const [id, b] of Object.entries(market)) {

      if (b === null) continue;

      need(obj(b), "INVALID_BOOTH");

      list(
        "market_booths.json.orders",
        id,
        b.orders
      );

    }

  }


  /* ======================================
     WHEEL8 DISPLAY HISTORY
  ====================================== */

  const wheel = read(
    "wheel8_user_history.json",
    true
  );

  if (wheel !== undefined) {

    need(
      obj(wheel),
      "INVALID_WHEEL_HISTORY"
    );

    for (
      const [uid, records] of Object.entries(wheel)
    ) {

      list(
        "wheel8_user_history.json",
        uid,
        records
      );

    }

  }


  /* ======================================
     ACCOUNT DELETION RECORDS
  ====================================== */

  const deletionDir = path.join(
    root,
    "account-deletion-requests"
  );

  let hasDeletionDir = false;

  try {

    privatePath(deletionDir, true);

    hasDeletionDir = true;

  } catch (e) {

    if (e.code !== "ENOENT") throw e;

  }

  if (hasDeletionDir) {

    for (
      const name of fs.readdirSync(deletionDir).sort()
    ) {

      if (!/^[a-f0-9]{64}\.json$/.test(name)) {
        continue;
      }

      const rel =
        "account-deletion-requests/" + name;

      add(
        "deletion_record",
        "",
        name,
        read(rel)
      );

    }

  }


  /* ======================================
     DETERMINISTIC RECORD ORDER
  ====================================== */

  function sortRows(a, b) {

    for (let i = 0; i < 3; i++) {

      if (a[i] < b[i]) return -1;

      if (a[i] > b[i]) return 1;

    }

    return 0;

  }

  rows.sort(sortRows);


  /* ======================================
     FINANCIAL MANIFEST
  ====================================== */

  const manifest = {

    version: 17,

    accounts: Object.keys(users).length,

    records: rows.length,

    counts,

    sourceHashes: hashes,

    deletionDirectoryPresent: hasDeletionDir,

    recordsSha256: sha(JSON.stringify(rows))

  };

  return {

    rows,

    manifest,

    sortRows,

    balances

  };

}


/* ==========================================
   SQLITE RECEIPT MIGRATION
========================================== */

function run(command, dir) {

  need(
    ["inspect", "import", "verify"].includes(command),
    "INVALID_COMMAND"
  );

  const root = rootCheck(dir);

  const s = inventory(root);


  /* AGGREGATE REPORT ONLY */

  const report = () => ({

    mode: "REHEARSAL_ONLY",

    accounts: s.manifest.accounts,

    records: s.manifest.records,

    counts: s.manifest.counts,

    sourceSha256:
      s.manifest.sourceHashes["users.json"],

    recordsSha256:
      s.manifest.recordsSha256,

    missingOptionalFiles:
      Object.keys(s.manifest.sourceHashes)
        .filter(k => s.manifest.sourceHashes[k] === null),

    deletionDirectoryPresent:
      s.manifest.deletionDirectoryPresent,

    activationAllowed: false

  });

  if (command === "inspect") {

    return report();

  }


  /* ======================================
     OPEN PRIVATE SQLITE CANDIDATE
  ====================================== */

  const candidate = path.join(root, "candidate");

  privatePath(candidate, true);

  const file = path.join(
    candidate,
    "wallet-test.sqlite"
  );

  privatePath(file, false);

  const db = new DatabaseSync(file, {

    readOnly: command === "verify"

  });


  try {

    db.exec(
      "PRAGMA busy_timeout=1000; PRAGMA foreign_keys=ON;"
    );

    if (command === "import") {

      db.exec("PRAGMA synchronous=FULL;");

    }


    db.exec(

      command === "import"

        ? "BEGIN IMMEDIATE"

        : "BEGIN"

    );


    try {

      const meta = key => db.prepare(

        "SELECT value FROM wallet_meta WHERE key=?"

      ).get(key)?.value;


      /* ==================================
         VERIFY CANDIDATE IDENTITY
      ================================== */

      need(

        meta("mode") === "ENGINE_TEST_V1" &&

        meta("migration_source_sha256") ===
          s.manifest.sourceHashes["users.json"] &&

        db.prepare(
          "SELECT COUNT(*) AS n FROM wallet_transactions"
        ).get().n === 0 &&

        db.prepare(
          "SELECT COUNT(*) AS n FROM wallet_entries"
        ).get().n === 0 &&

        db.prepare(
          "SELECT COUNT(*) AS n FROM wallet_accounts"
        ).get().n === s.manifest.accounts,

        "CANDIDATE_MISMATCH"

      );


      need(

        db.prepare(
          "SELECT COUNT(*) AS n FROM wallet_closures"
        ).get().n === 0,

        "UNEXPECTED_CLOSURE"

      );


      /* ==================================
         VERIFY EVERY WALLET BALANCE
      ================================== */

      for (const table of [

        "wallet_accounts",

        "wallet_opening"

      ]) {

        const q = db.prepare(`

          SELECT

            uid,

            coins,

            coin_received,

            coin_sent,

            coin_deposit

          FROM ${table}

          WHERE uid=?

        `);


        need(

          db.prepare(
            `SELECT COUNT(*) AS n FROM ${table}`
          ).get().n === s.balances.length,

          "BALANCE_COUNT_MISMATCH"

        );


        for (const row of s.balances) {

          const found = q.get(row[0]);

          need(

            found &&

            JSON.stringify(Object.values(found)) ===
              JSON.stringify(row),

            "BALANCE_MISMATCH"

          );

        }

      }


      /* ==================================
         CREATE FINANCIAL SOURCE ARCHIVE
      ================================== */

      if (

        command === "import" &&

        meta(META) === undefined

      ) {

        db.exec(`

          CREATE TABLE ${TABLE} (

            source TEXT NOT NULL,

            owner_uid TEXT NOT NULL,

            record_key TEXT NOT NULL,

            payload TEXT NOT NULL,

            payload_sha256 TEXT NOT NULL,

            PRIMARY KEY(
              source,
              owner_uid,
              record_key
            )

          ) STRICT;

        `);


        const insert = db.prepare(

          `INSERT INTO ${TABLE} VALUES (?,?,?,?,?)`

        );

        for (const r of s.rows) {

          insert.run(...r);

        }


        db.prepare(

          "INSERT INTO wallet_meta(key,value) VALUES (?,?)"

        ).run(

          META,

          JSON.stringify(s.manifest)

        );

      }


      /* ==================================
         VERIFY ALL IMPORTED RECORDS
      ================================== */

      const actual = db.prepare(`

        SELECT

          source,

          owner_uid,

          record_key,

          payload,

          payload_sha256

        FROM ${TABLE}

      `).all().map(Object.values);


      actual.sort(s.sortRows);


      need(

        meta(META) === JSON.stringify(s.manifest) &&

        actual.length === s.rows.length &&

        sha(JSON.stringify(actual)) ===
          s.manifest.recordsSha256 &&

        actual.every(r => sha(r[3]) === r[4]),

        "FINANCIAL_ARCHIVE_MISMATCH"

      );


      /* ==================================
         VERIFY SOURCE DID NOT CHANGE
      ================================== */

      need(

        JSON.stringify(inventory(root).manifest) ===
          JSON.stringify(s.manifest),

        "SOURCE_CHANGED"

      );


      db.exec("COMMIT");


      return {

        ...report(),

        archiveVerified: true

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
   FINANCIAL MIGRATION TEST
   SYNTHETIC DATA ONLY
========================================== */

function test() {

  const assert = require("node:assert/strict");

  const { openWallet } =
    require("./wallet-engine");

  const root = fs.mkdtempSync(

    path.join(
      os.tmpdir(),
      "lsp-wallet-migration-"
    )

  );

  try {

    const source = path.join(root, "users.json");

    const raw = JSON.stringify({

      TEST_A: {

        profile: {

          coins: 900,

          withdrawHold: [
            { id: "w1", amount: 100 }
          ]

        },

        socialGiftReceipts: {

          r1: { amount: 20 }

        },

        transferRequests: [
          { id: "t1", amount: 50 }
        ]

      }

    });

    fs.writeFileSync(
      source,
      raw,
      { mode: 0o600 }
    );


    const candidate = path.join(
      root,
      "candidate"
    );

    fs.mkdirSync(
      candidate,
      { mode: 0o700 }
    );


    const file = path.join(
      candidate,
      "wallet-test.sqlite"
    );


    const wallet = openWallet(file, {

      fixtures: [{

        uid: "TEST_A",

        coins: 900,

        coin_received: 0,

        coin_sent: 0,

        coin_deposit: 0

      }]

    });

    wallet.close();


    function change(sql, ...args) {

      const db = new DatabaseSync(file);

      try {

        db.prepare(sql).run(...args);

      } finally {

        db.close();

      }

    }


    change(

      "INSERT INTO wallet_meta VALUES (?,?)",

      "migration_source_sha256",

      sha(raw)

    );


    /* INVENTORY TEST */

    assert.equal(

      run("inspect", root).records,

      3

    );


    /* IMPORT TEST */

    assert.equal(

      run("import", root).archiveVerified,

      true

    );


    /* DUPLICATE IMPORT TEST */

    assert.equal(

      run("import", root).archiveVerified,

      true

    );


    /* READ ONLY VERIFICATION */

    assert.equal(

      run("verify", root).archiveVerified,

      true

    );


    /* SOURCE CHANGE DETECTION */

    fs.writeFileSync(source, raw + "\n");

    assert.throws(

      () => run("verify", root),

      /CANDIDATE_MISMATCH/

    );

    fs.writeFileSync(source, raw);


    /* BALANCE CHANGE DETECTION */

    change(
      "UPDATE wallet_accounts SET coins=901"
    );

    assert.throws(

      () => run("verify", root),

      /BALANCE_MISMATCH/

    );

    change(
      "UPDATE wallet_accounts SET coins=900"
    );


    /* FINANCIAL RECORD TAMPERING TEST */

    change(

      `UPDATE ${TABLE}
       SET payload='{}'
       WHERE source='socialGiftReceipts'`

    );

    assert.throws(

      () => run("verify", root),

      /FINANCIAL_ARCHIVE_MISMATCH/

    );


    /* DO NOT OVERWRITE CONFLICTING ARCHIVE */

    assert.throws(

      () => run("import", root),

      /FINANCIAL_ARCHIVE_MISMATCH/

    );


    console.log(

      "[FINANCIAL RECEIPTS TEST] PASS"

    );


  } finally {

    fs.rmSync(root, {

      recursive: true,

      force: true

    });

  }

}


/* ==========================================
   COMMAND LINE TOOLS
========================================== */

if (require.main === module) {

  try {

    const [cmd, dir, ...extra] =
      process.argv.slice(2);

    if (

      cmd === "test" &&

      !dir &&

      !extra.length

    ) {

      test();

    } else {

      need(

        dir && !extra.length,

        "Usage: test | inspect/import/verify PRIVATE_DIRECTORY"

      );

      console.log(

        JSON.stringify(
          run(cmd, dir),
          null,
          2
        )

      );

    }

  } catch (e) {

    console.error(

      "[FINANCIAL RECEIPTS V1.7]",

      e.code || e.message

    );

    process.exitCode = 1;

  }

}

module.exports = { run };