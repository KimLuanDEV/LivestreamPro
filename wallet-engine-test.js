"use strict";

/* ==========================================
   LIVESTREAM PRO
   SQLITE WALLET AUTOMATIC TEST
========================================== */

const assert = require("node:assert/strict");

const fs = require("node:fs");

const os = require("node:os");

const path = require("node:path");

const { randomUUID } = require("node:crypto");

const { DatabaseSync } = require("node:sqlite");

const { openWallet } = require("./wallet-engine");


/* ==========================================
   PRIVATE TEST DATABASE
========================================== */

const dir = fs.mkdtempSync(

  path.join(

    os.tmpdir(),

    "lsp-wallet-test-"

  )

);


const filename = path.join(

  dir,

  "wallet-test.sqlite"

);


const fixture = (uid, coins) => ({

  uid,

  coins,

  coin_received: 0,

  coin_sent: 0,

  coin_deposit: 0

});


let wallet;


try {


  /* ======================================
     CREATE TEST ACCOUNTS
  ====================================== */

  wallet = openWallet(filename, {

    fixtures: [

      fixture("test-A", 1000),

      fixture("test-B", 500),

      fixture(

        "test-max",

        Number.MAX_SAFE_INTEGER

      )

    ]

  });


  /* ======================================
     TEST 01 - CREDIT BALANCE
  ====================================== */

  const op = {

    actor: "test-admin",

    requestId: randomUUID(),

    reason: "test-credit",

    changes: [

      {

        uid: "test-A",

        delta: {

          coins: 250,

          coin_deposit: 250

        }

      }

    ]

  };


  const first = wallet.commit(op);


  assert.equal(

    first.duplicate,

    false

  );


  assert.equal(

    wallet.getBalance("test-A").coins,

    1250

  );


  /* ======================================
     TEST 02 - DUPLICATE REQUEST
  ====================================== */

  assert.equal(

    wallet.commit(op).duplicate,

    true

  );


  assert.equal(

    wallet.getBalance("test-A").coins,

    1250

  );


  /* ======================================
     TEST 03 - REQUEST ID CONFLICT
  ====================================== */

  assert.throws(() => wallet.commit({

    ...op,

    changes: [

      {

        uid: "test-B",

        delta: {

          coins: 250

        }

      }

    ]

  }), /REQUEST_ID_CONFLICT/);


  /* ======================================
     TEST 04 - ATOMIC ROLLBACK
  ====================================== */

  assert.throws(() => wallet.commit({

    ...op,

    requestId: randomUUID(),

    changes: [

      {

        uid: "test-A",

        delta: {

          coins: 1

        }

      },

      {

        uid: "test-B",

        delta: {

          coins: -501

        }

      }

    ]

  }), /INVALID_BALANCE/);


  assert.equal(

    wallet.getBalance("test-A").coins,

    1250

  );


  assert.equal(

    wallet.getBalance("test-B").coins,

    500

  );


  /* ======================================
     TEST 05 - INTEGER OVERFLOW
  ====================================== */

  assert.throws(() => wallet.commit({

    ...op,

    requestId: randomUUID(),

    changes: [

      {

        uid: "test-max",

        delta: {

          coins: 1

        }

      }

    ]

  }), /INVALID_BALANCE/);


  /* ======================================
     TEST 06 - INVALID DECIMAL
  ====================================== */

  assert.throws(() => wallet.commit({

    ...op,

    requestId: randomUUID(),

    changes: [

      {

        uid: "test-A",

        delta: {

          coins: 0.5

        }

      }

    ]

  }), /INVALID_DELTA/);


  /* ======================================
     TEST 07 - ACCOUNT NOT FOUND
  ====================================== */

  assert.throws(() => wallet.commit({

    ...op,

    requestId: randomUUID(),

    changes: [

      {

        uid: "missing",

        delta: {

          coins: 1

        }

      }

    ]

  }), /ACCOUNT_NOT_FOUND/);


  /* ======================================
     TEST 08 - INVALID REQUEST ID
  ====================================== */

  assert.throws(() => wallet.commit({

    ...op,

    requestId: "invalid"

  }), /INVALID_TRANSACTION/);


  /* ======================================
     TEST 09 - MULTI ACCOUNT TRANSACTION
  ====================================== */

  const second = {

    actor: "test-admin",

    requestId: randomUUID(),

    reason: "test-transfer",

    changes: [

      {

        uid: "test-B",

        delta: {

          coins: 50

        }

      },

      {

        uid: "test-A",

        delta: {

          coins: -50

        }

      }

    ]

  };


  wallet.commit(second);


  assert.equal(

    wallet.commit({

      ...second,

      changes:
        [...second.changes].reverse()

    }).duplicate,

    true

  );


  /* ======================================
     TEST 10 - WALLET RECONCILIATION
  ====================================== */

  assert.deepEqual(

    wallet.reconcile(),

    {

      ok: true,

      accounts: 3,

      transactions: 2,

      entries: 3

    }

  );


  console.log(

    "[WALLET TEST] metrics:",

    wallet.getStats()

  );


  /* ======================================
     TEST 11 - DATABASE RESTART
  ====================================== */

  wallet.close();

  wallet = undefined;


  wallet = openWallet(filename);


  assert.equal(

    wallet.commit(op).duplicate,

    true

  );


  assert.equal(

    wallet.getBalance("test-A").coins,

    1200

  );


  assert.equal(

    wallet.getBalance("test-B").coins,

    550

  );


  assert.deepEqual(

    wallet.reconcile(),

    {

      ok: true,

      accounts: 3,

      transactions: 2,

      entries: 3

    }

  );


  /* ======================================
     TEST 12 - PREVENT DATABASE OVERWRITE
  ====================================== */

  assert.throws(

    () => openWallet(filename, {

      fixtures: []

    }),

    /EEXIST/

  );


  /* ======================================
     TEST 13 - DETECT BALANCE TAMPERING
  ====================================== */

  const raw =
    new DatabaseSync(filename);


  try {

    raw.exec(

      "UPDATE wallet_accounts " +

      "SET coins = 999 " +

      "WHERE uid = 'test-A'"

    );

  } finally {

    raw.close();

  }


  assert.throws(

    () => wallet.reconcile(),

    /BALANCE_MISMATCH/

  );


  /* ======================================
     TEST COMPLETED
  ====================================== */

  console.log(

    "[WALLET TEST] PASS: " +

    "commit, retry, conflict, rollback, " +

    "invalid balances, restart, " +

    "reconciliation, tamper detection"

  );


} finally {


  if (wallet) {

    wallet.close();

  }


  fs.rmSync(dir, {

    recursive: true,

    force: true

  });

}