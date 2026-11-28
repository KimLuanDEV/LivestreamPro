"use strict";

/* ==========================================
   LIVESTREAM PRO
   ACCOUNT DELETION V4.0
   AUTOMATIC INTEGRATION TEST
========================================== */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const {
  execFileSync
} = require("node:child_process");

const {
  openWallet
} = require("./wallet-engine");

const runDeletion =
  require("./account-deletion-engine");


/* PRIVATE TEST DIRECTORY */

const root = fs.mkdtempSync(

  path.join(

    os.tmpdir(),

    "lsp-wallet-backup-v4-"

  )

);


const file = name =>
  path.join(root, name);


const read = name =>

  JSON.parse(

    fs.readFileSync(
      file(name),
      "utf8"
    )

  );


const write = (name, value) =>

  fs.writeFileSync(

    file(name),

    JSON.stringify(value),

    { mode: 0o600 }

  );


const uid = "test-A";

const requestId =
  crypto.randomUUID();


const requestFile =

  "account-deletion-requests/" +

  crypto.createHash("sha256")

    .update(uid)

    .digest("hex") +

  ".json";


const fixture = (
  uid,
  coins,
  coin_received = 0
) => ({

  uid,

  coins,

  coin_received,

  coin_sent: 0,

  coin_deposit: 20

});


let wallet;

let oldWallet;


/* ==========================================
   TEST FINANCIAL OBLIGATIONS
========================================== */

// Fixture-only check.
// Production uses deletionBlockers().

function financialCheck(
  id,
  users,
  withdrawals
) {

  const p = users[id]?.profile;


  if (

    !p ||

    p.coins !== 0 ||

    p.coinReceived !== 0 ||

    withdrawals.some(w =>

      w.uid === id &&

      !["approved", "rejected"]
        .includes(w.status)

    )

  ) {

    return ["FINANCIAL_OBLIGATIONS"];

  }

  return [];

}


/* ==========================================
   TEST DELETION COORDINATOR
========================================== */

function purgeFixture(
  simulateFailure = false
) {

  const record = read(requestFile);

  const users = read("users.json");


  assert.equal(record.uid, uid);

  assert.equal(
    record.requestId,
    requestId
  );

  assert.equal(
    record.status,
    "pending"
  );

  assert.equal(
    record.stage,
    "ready"
  );

  assert.ok(

    ["queued", "purging"]
      .includes(record.engineState)

  );


  if (Object.hasOwn(users, uid)) {

    assert.equal(

      users[uid].profile.accountBlocked,

      true

    );


    if (

      financialCheck(

        uid,

        users,

        read("withdraw_requests.json")

      ).length

    ) {

      throw new Error(
        "FINANCIAL_OBLIGATIONS"
      );

    }


    wallet.closeWallet(
      uid,
      requestId
    );


  } else {

    wallet.assertClosed(
      uid,
      requestId
    );

  }


  /* CALL EXISTING V3 DELETION ENGINE */

  runDeletion(

    root,

    financialCheck,

    {

      uid,

      readUsers: () =>
        read("users.json"),

      commitUsers: db => {

        if (simulateFailure) {

          throw new Error(
            "SIMULATED_CORE_FAILURE"
          );

        }

        write("users.json", db);

      }

    }

  );

}


/* ==========================================
   AUTOMATIC TEST
========================================== */

try {


  /* CREATE WALLET FIXTURES */

  wallet = openWallet(

    file("wallet-test.sqlite"),

    {

      fixtures: [

        fixture(uid, 10),

        fixture("test-B", 100),

        fixture("test-C", 0, 1),

        fixture("test-D", 0)

      ]

    }

  );


  const op = {

    actor: "test-admin",

    requestId: crypto.randomUUID(),

    reason: "fixture-settlement",

    changes: [

      {

        uid,

        delta: {

          coins: -10

        }

      }

    ]

  };


  wallet.commit(op);


  /* PRE-CLOSURE DATABASE SNAPSHOT */

  wallet.close();

  wallet = undefined;


  fs.mkdirSync(file("old"), {

    mode: 0o700

  });


  fs.copyFileSync(

    file("wallet-test.sqlite"),

    file("old/wallet-test.sqlite")

  );


  fs.chmodSync(

    file("old/wallet-test.sqlite"),

    0o600

  );


  wallet = openWallet(

    file("wallet-test.sqlite")

  );


  /* CREATE DELETION REQUEST */

  fs.mkdirSync(

    file("account-deletion-requests"),

    { mode: 0o700 }

  );


  write(requestFile, {

    uid,

    requestId,

    status: "pending",

    stage: "ready",

    engineState: "queued"

  });


  write("users.json", {

    [uid]: {

      profile: {

        accountBlocked: true,

        coins: 0,

        coinReceived: 0

      }

    },

    "test-B": {

      profile: {

        coins: 100

      }

    }

  });


  /* TEST PENDING WITHDRAWAL */

  write("withdraw_requests.json", [

    {

      uid,

      status: "pending"

    }

  ]);


  assert.throws(

    () => purgeFixture(),

    /FINANCIAL_OBLIGATIONS/

  );


  assert.equal(

    wallet.getClosure(uid),

    null

  );


  /* TEST NON-ZERO BALANCES */

  assert.throws(

    () => wallet.closeWallet(

      "test-B",

      crypto.randomUUID()

    ),

    /WALLET_BALANCE_NOT_ZERO/

  );


  assert.throws(

    () => wallet.closeWallet(

      "test-C",

      crypto.randomUUID()

    ),

    /WALLET_BALANCE_NOT_ZERO/

  );


  write("withdraw_requests.json", []);


  /* TEST PARTIAL DELETION FAILURE */

  assert.throws(

    () => purgeFixture(true),

    /SIMULATED_CORE_FAILURE/

  );


  assert.ok(

    Object.hasOwn(

      read("users.json"),

      uid

    )

  );


  wallet.assertClosed(
    uid,
    requestId
  );


  /* TEST DATABASE RESTART */

  wallet.close();

  wallet = undefined;

  wallet = openWallet(

    file("wallet-test.sqlite")

  );


  assert.equal(

    wallet.closeWallet(

      uid,

      requestId

    ).duplicate,

    true

  );


  assert.throws(

    () => wallet.closeWallet(

      uid,

      crypto.randomUUID()

    ),

    /WALLET_ALREADY_CLOSED/

  );


  assert.throws(

    () => wallet.closeWallet(

      "test-D",

      requestId

    ),

    /CLOSURE_REQUEST_ID_CONFLICT/

  );


  /* RESUME ACCOUNT DELETION */

  purgeFixture();


  assert.equal(

    Object.hasOwn(

      read("users.json"),

      uid

    ),

    false

  );


  assert.equal(

    read("users.json")["test-B"]
      .profile.coins,

    100

  );


  assert.equal(

    read(requestFile).engineState,

    "local_done"

  );


  assert.ok(

    runDeletion.loadTombstones(root)
      .has(uid)

  );


  /* VERIFY HISTORICAL RECEIPTS */

  assert.equal(

    wallet.commit(op).duplicate,

    true

  );


  /* BLOCK NEW TRANSACTIONS */

  assert.throws(

    () => wallet.commit({

      ...op,

      requestId: crypto.randomUUID(),

      changes: [

        {

          uid,

          delta: {

            coins: 1

          }

        }

      ]

    }),

    /WALLET_ACCOUNT_CLOSED/

  );


  assert.throws(

    () => wallet.commit({

      ...op,

      actor: uid,

      requestId: crypto.randomUUID(),

      changes: [

        {

          uid: "test-B",

          delta: {

            coins: 1

          }

        }

      ]

    }),

    /WALLET_ACTOR_CLOSED/

  );


  /* VERIFY FINANCIAL HISTORY */

  assert.equal(

    wallet.getBalance(uid)
      .coin_deposit,

    20

  );


  assert.deepEqual(

    wallet.reconcile(),

    {

      ok: true,

      accounts: 4,

      transactions: 1,

      entries: 1

    }

  );


  /* TEST OLD BACKUP PROTECTION */

  oldWallet = openWallet(

    file("old/wallet-test.sqlite")

  );


  assert.equal(

    oldWallet.reconcile().ok,

    true

  );


  assert.throws(

    () => oldWallet.assertClosed(

      uid,

      requestId

    ),

    /WALLET_CLOSURE_MISSING_OR_MISMATCH/

  );


  oldWallet.close();

  oldWallet = undefined;


  wallet.close();

  wallet = undefined;


  /* TEST BACKUP V2.0 COMPATIBILITY */

  const env = {

    ...process.env,

    LSP_WALLET_TEST_BACKUP_KEY:

      crypto.randomBytes(32)
        .toString("hex")

  };


  for (const command of [

    "create",

    "restore"

  ]) {

    execFileSync(

      process.execPath,

      [

        path.join(

          __dirname,

          "wallet-backup.js"

        ),

        command,

        root

      ],

      {

        env,

        stdio: "inherit"

      }

    );

  }


  /* VERIFY RESTORED CLOSURE */

  wallet = openWallet(

    file("restored/wallet-test.sqlite")

  );


  wallet.assertClosed(
    uid,
    requestId
  );


  assert.equal(

    wallet.reconcile().ok,

    true

  );


  assert.equal(

    wallet.commit(op).duplicate,

    true

  );


  console.log(

    "[ACCOUNT DELETION V4 TEST] PASS"

  );


} finally {

  if (oldWallet) oldWallet.close();

  if (wallet) wallet.close();


  fs.rmSync(root, {

    recursive: true,

    force: true

  });

}