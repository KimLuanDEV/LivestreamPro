/* ==========================================
   LIVESTREAM PRO
   WALLET DATABASE MIGRATION STAGING
========================================== */

const fs = require("node:fs");

const crypto = require("node:crypto");

const assert = require("node:assert/strict");

const {
  DatabaseSync
} = require("node:sqlite");


const [source, destination] =
  process.argv.slice(2);


if (!source || !destination) {

  throw new Error(

    "Usage: node wallet-stage.js " +
    "<users-copy.json> <new-wallet.sqlite>"

  );

}


/* ==========================================
   READ SOURCE DATABASE
========================================== */

const raw =
  fs.readFileSync(source);

const users =
  JSON.parse(raw.toString("utf8"));


if (

  !users ||

  typeof users !== "object" ||

  Array.isArray(users)

) {

  throw new Error("INVALID_USERS_DB");

}


/* ==========================================
   VALIDATE WALLET AMOUNTS
========================================== */

function amount(value, optional = false) {

  if (
    optional &&
    value === undefined
  ) {

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

    throw new Error(
      "INVALID_WALLET_AMOUNT"
    );

  }

  return value;

}


/* ==========================================
   EXTRACT WALLET DATA
========================================== */

const rows = [];

let withoutProfile = 0;


for (
  const [uid, user] of Object.entries(users)
) {

  if (!user?.profile) {

    withoutProfile++;

    continue;

  }

  const p = user.profile;

  rows.push([

    uid,

    amount(p.coins),

    amount(p.coinReceived, true),

    amount(p.coinSent, true),

    amount(p.coinDeposit, true)

  ]);

}


/* ==========================================
   CREATE SECURE SQLITE FILE
========================================== */

// Không cho phép ghi đè file ví đã tồn tại

fs.closeSync(

  fs.openSync(
    destination,
    "wx",
    0o600
  )

);


let db;


try {

  db = new DatabaseSync(destination);

  db.exec(`

    PRAGMA journal_mode = DELETE;

    PRAGMA synchronous = FULL;


    CREATE TABLE wallet_accounts (

      uid TEXT PRIMARY KEY NOT NULL,

      coins INTEGER NOT NULL
        CHECK(coins >= 0),

      coin_received INTEGER NOT NULL
        CHECK(coin_received >= 0),

      coin_sent INTEGER NOT NULL
        CHECK(coin_sent >= 0),

      coin_deposit INTEGER NOT NULL
        CHECK(coin_deposit >= 0)

    ) STRICT;


    CREATE TABLE wallet_meta (

      key TEXT PRIMARY KEY NOT NULL,

      value TEXT NOT NULL

    ) STRICT;


    BEGIN IMMEDIATE;

  `);


  /* ======================================
     IMPORT WALLET BALANCES
  ====================================== */

  const insert = db.prepare(

    "INSERT INTO wallet_accounts " +
    "VALUES (?, ?, ?, ?, ?)"

  );


  for (const row of rows) {

    insert.run(...row);

  }


  /* ======================================
     MIGRATION METADATA
  ====================================== */

  const meta = db.prepare(

    "INSERT INTO wallet_meta VALUES (?, ?)"

  );

  meta.run(

    "source_sha256",

    crypto
      .createHash("sha256")
      .update(raw)
      .digest("hex")

  );

  meta.run(

    "created_at",

    new Date().toISOString()

  );

  meta.run(

    "mode",

    "STAGING_ONLY"

  );


  /* ======================================
     VERIFY EVERY WALLET ACCOUNT
  ====================================== */

  const select = db.prepare(

    "SELECT * FROM wallet_accounts " +
    "WHERE uid = ?"

  );


  for (const row of rows) {

    const record = select.get(row[0]);

    assert.deepEqual(

      Object.values(record),

      row

    );

  }


  assert.equal(

    db.prepare(

      "SELECT COUNT(*) AS n " +
      "FROM wallet_accounts"

    ).get().n,

    rows.length

  );


  db.exec("COMMIT");


  console.log(

    "[WALLET STAGING] VERIFIED",

    {

      accounts: rows.length,

      withoutProfile

    }

  );


} catch (error) {

  if (db) {

    try {

      db.exec("ROLLBACK");

    } catch {}

  }

  throw error;


} finally {

  if (db) db.close();

}