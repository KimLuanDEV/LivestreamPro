"use strict";

/* ==========================================
   LIVESTREAM PRO
   ACCOUNT DELETION V4.1 AUTOMATIC TEST
   PRIVATE FIXTURE ONLY
========================================== */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");

const run =
  require("./account-deletion-engine");

const {
  openWallet
} = require("./wallet-engine");


/* PRIVATE TEST DIRECTORY */

const root = fs.mkdtempSync(
  path.join(
    os.tmpdir(),
    "lsp-deletion-v41-"
  )
);

const uid = "test-A";

const requestId =
  crypto.randomUUID();

const file = name =>
  path.join(root, name);

const recordFile = file(

  "account-deletion-requests/" +

  crypto.createHash("sha256")
    .update(uid)
    .digest("hex") +

  ".json"

);

const write = (f, x) =>

  fs.writeFileSync(
    f,
    JSON.stringify(x),
    { mode: 0o600 }
  );

const read = f =>

  JSON.parse(
    fs.readFileSync(f, "utf8")
  );


/* ==========================================
   TEST USER DATABASE
========================================== */

const users = {

  [uid]: {

    profile: {

      accountBlocked: true,

      coins: 0,

      coinReceived: 0

    }

  },

  B: {

    profile: {

      coins: 100

    }

  }

};


/* ==========================================
   TEST DELETION REQUEST
========================================== */

const queued = {

  uid,

  requestId,

  status: "pending",

  stage: "ready",

  engineState: "queued"

};

const ready = {

  ...queued,

  engineState: "purging",

  coreWriteReady: true

};

let wallet;

let completed = 0;


/* ==========================================
   TEST ENGINE OPTIONS
========================================== */

const options = {

  uid,

  readUsers: () =>
    read(file("users.json")),

  commitUsers: db =>
    write(file("users.json"), db),

  afterCommit: () =>
    completed++

};


const check = (id, u, withdrawals) =>

  withdrawals.length

    ? ["PENDING_WITHDRAWAL"]

    : [];


const invoke = extra =>

  run(
    root,
    check,
    {
      ...options,
      ...extra
    }
  );


/* ==========================================
   START AUTOMATIC TEST
========================================== */

try {

  fs.mkdirSync(

    file("account-deletion-requests"),

    { mode: 0o700 }

  );


  /* TEST 01 - MISSING USER DATABASE */

  write(recordFile, ready);

  assert.throws(

    () => invoke({
      readUsers: () => ({})
    }),

    /USERS_SOURCE_MISSING/

  );

  assert.throws(

    () => run.loadTombstones(root),

    /USERS_SOURCE_MISSING/

  );

  assert.equal(completed, 0);

  assert.equal(

    read(recordFile).engineState,

    "purging"

  );


  /* TEST 02 - INVALID DATABASE */

  write(file("users.json"), []);

  assert.throws(

    () => invoke(),

    /INVALID_USERS_SOURCE/

  );

  assert.throws(

    () => run.loadTombstones(root),

    /INVALID_USERS_SOURCE/

  );


  /* TEST 03 - INVALID SNAPSHOT */

  write(file("users.json"), users);

  assert.throws(

    () => invoke({
      readUsers: () => ({})
    }),

    /USERS_SNAPSHOT_MISMATCH/

  );

  assert.equal(completed, 0);

  write(recordFile, queued);


  /* CREATE SQLITE TEST WALLET */

  wallet = openWallet(

    file("wallet-test.sqlite"),

    {

      fixtures: [

        {

          uid,

          coins: 0,

          coin_received: 0,

          coin_sent: 10,

          coin_deposit: 10

        },

        {

          uid: "B",

          coins: 100,

          coin_received: 0,

          coin_sent: 0,

          coin_deposit: 100

        }

      ]

    }

  );


  /* TEST 04 - PENDING WITHDRAWAL */

  write(

    file("withdraw_requests.json"),

    [
      {
        uid,
        status: "pending"
      }
    ]

  );

  assert.throws(

    () => invoke({
      walletClosure: wallet
    }),

    /PENDING_WITHDRAWAL/

  );

  assert.equal(
    wallet.getClosure(uid),
    null
  );

  write(file("withdraw_requests.json"), []);

  write(recordFile, queued);


  /* TEST 05 - CORE COMMIT FAILURE */

  assert.throws(

    () => invoke({

      walletClosure: wallet,

      commitUsers: () => {}

    }),

    /USER_CORE_REMOVAL_NOT_CONFIRMED/

  );

  assert.equal(completed, 0);

  wallet.assertClosed(uid, requestId);


  /* TEST 06 - REQUIRED WALLET CLOSURE */

  assert.equal(

    read(recordFile).walletClosureRequired,

    true

  );

  assert.throws(

    () => invoke(),

    /WALLET_CLOSURE_REQUIRED/

  );


  /* TEST 07 - DATABASE RESTART */

  wallet.close();

  wallet = undefined;

  wallet = openWallet(

    file("wallet-test.sqlite")

  );


  /* RESUME ACCOUNT DELETION */

  invoke({

    walletClosure: wallet

  });

  assert.equal(completed, 1);

  assert.equal(

    read(recordFile).engineState,

    "local_done"

  );


  /* TEST 08 - PRESERVE OTHER ACCOUNTS */

  assert.deepEqual(

    read(file("users.json")),

    { B: users.B }

  );


  /* TEST 09 - TOMBSTONE PROTECTION */

  assert.ok(

    run.loadTombstones(root).has(uid)

  );


  /* PRESERVE FINANCIAL HISTORY */

  assert.equal(

    wallet.getBalance(uid).coin_deposit,

    10

  );

  assert.equal(

    wallet.reconcile().ok,

    true

  );


  /* TEST 10 - PARTIAL RECOVERY */

  write(recordFile, {

    ...ready,

    walletClosureRequired: true

  });

  invoke({

    walletClosure: wallet

  });

  assert.equal(completed, 2);

  assert.equal(

    read(recordFile).engineState,

    "local_done"

  );


  /* TEST 11 - ACCOUNT RESURRECTION */

  write(file("users.json"), users);

  assert.throws(

    () => run.loadTombstones(root),

    /Deleted UID found/

  );


  /* ALL TESTS COMPLETED */

  console.log(

    "[ACCOUNT DELETION V4.1 TEST] PASS " +

    "missing/invalid source, stale view, " +

    "pending withdrawal, failed core commit, " +

    "closure retry, tombstones, recovery"

  );


} finally {

  if (wallet) wallet.close();

  fs.rmSync(root, {

    recursive: true,

    force: true

  });

}