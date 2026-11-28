"use strict";

/* ==========================================
   LIVESTREAM PRO
   LEGACY RECEIPT MIGRATION TEST V1.0
========================================== */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");

const { execFileSync } = require("node:child_process");

const { DatabaseSync } = require("node:sqlite");

const {

  run,

  classifyAdmin,

  classifyPayment

} = require("./wallet-legacy-receipts");


const {

  openWallet

} = require("./wallet-engine");


/* ==========================================
   PRIVATE TEST DIRECTORY
========================================== */

const root = fs.mkdtempSync(

  path.join(

    os.tmpdir(),

    "lsp-wallet-migration-"

  )

);


const hash = x => crypto

  .createHash("sha256")

  .update(JSON.stringify(x))

  .digest("hex");


/* ==========================================
   TEST REQUEST IDS
========================================== */

const id = crypto.randomUUID();

const id2 = crypto.randomUUID();


const invoice =

  "LSP" + "A".repeat(20);


const invoice2 =

  "LSP" + "B".repeat(20);


const key = hash([

  "admin",

  id

]);


const key2 = hash([

  "admin",

  id2

]);


/* ==========================================
   LEGACY RECEIPT FIXTURE
========================================== */

const rec = {

  fingerprint: hash([

    "topup",

    "A",

    250,

    "test"

  ]),

  kind: "topup",

  amount: 250,

  at: 123

};


/* ==========================================
   TEST USER DATABASE
========================================== */

const users = {

  admin: {

    profile: {

      coins: 0

    },

    lspAdminWalletReceipts: {

      [key]: {

        ...rec,

        targetUid: "A"

      },

      [key2]: {

        ...rec,

        targetUid: "A"

      }

    }

  },


  A: {

    profile: {

      coins: 1250,

      creditedPaymentInvoices: {

        [invoice]: {

          diamonds: 100,

          at: 456

        }

      }

    },

    lspWalletReceipts: {

      [key]: rec

    }

  },


  B: {

    profile: {

      coins: 100

    }

  }

};


/* ==========================================
   TEST PAYMENT ORDERS
========================================== */

const orders = {

  [invoice]: {

    uid: "A",

    diamonds: 100,

    status: "pending"

  },


  [invoice2]: {

    uid: "B",

    diamonds: 100,

    status: "pending"

  }

};


const write = (name, value) =>

  fs.writeFileSync(

    path.join(root, name),

    JSON.stringify(value),

    {

      mode: 0o600

    }

  );


/* ==========================================
   START AUTOMATIC TEST
========================================== */

try {


  /* CREATE JSON FIXTURES */

  write("users.json", users);

  write("lsp_pg_orders.json", orders);


  /* ======================================
     CREATE MIGRATION CANDIDATE
  ====================================== */

  execFileSync(

    process.execPath,

    [

      path.join(

        __dirname,

        "wallet-migration.js"

      ),

      "create",

      root

    ],

    {

      stdio: "ignore"

    }

  );


  /* ======================================
     TEST 01 - IMPORT LEGACY RECEIPTS
  ====================================== */

  const m = run(

    "import",

    root

  );


  assert.equal(m.adminCount, 2);

  assert.equal(m.adminSources, 2);

  assert.equal(m.legacySources, 1);

  assert.equal(m.pendingCredited, 1);

  assert.equal(m.pendingUncredited, 1);

  assert.equal(m.activationAllowed, false);


  /* ======================================
     TEST 02 - REPEATED IMPORT PROTECTION
  ====================================== */

  assert.deepEqual(

    run("import", root),

    m

  );


  /* ======================================
     TEST 03 - RECEIPT VERIFICATION
  ====================================== */

  assert.deepEqual(

    run("verify", root),

    m

  );


  const file = path.join(

    root,

    "candidate",

    "wallet-test.sqlite"

  );


  let db = new DatabaseSync(file);


  try {


    /* ====================================
       TEST 04 - ADMIN DUPLICATE REQUEST
    ==================================== */

    assert.equal(

      classifyAdmin(

        db,

        "admin",

        id,

        "topup",

        "A",

        250,

        "test"

      ),

      "DUPLICATE"

    );


    /* ====================================
       TEST 05 - ADMIN REQUEST CONFLICT
    ==================================== */

    assert.equal(

      classifyAdmin(

        db,

        "admin",

        id,

        "topup",

        "A",

        251,

        "test"

      ),

      "CONFLICT"

    );


    /* ====================================
       TEST 06 - UNKNOWN REQUEST
    ==================================== */

    assert.equal(

      classifyAdmin(

        db,

        "admin",

        crypto.randomUUID(),

        "topup",

        "A",

        250,

        "test"

      ),

      "NOT_FOUND"

    );


    /* ====================================
       TEST 07 - PAYMENT DUPLICATE
    ==================================== */

    assert.equal(

      classifyPayment(

        db,

        invoice,

        "A",

        100

      ),

      "DUPLICATE"

    );


    /* ====================================
       TEST 08 - PAYMENT UID CONFLICT
    ==================================== */

    assert.equal(

      classifyPayment(

        db,

        invoice,

        "B",

        100

      ),

      "CONFLICT"

    );


    /* ====================================
       TEST 09 - UNKNOWN PAYMENT RECEIPT
    ==================================== */

    assert.equal(

      classifyPayment(

        db,

        invoice2,

        "B",

        100

      ),

      "NOT_FOUND"

    );


  } finally {

    db.close();

  }


  /* ======================================
     TEST 10 - BALANCE PRESERVATION
  ====================================== */

  const w = openWallet(file);


  try {

    assert.equal(

      w.getBalance("A").coins,

      1250

    );


    assert.deepEqual(

      w.reconcile(),

      {

        ok: true,

        accounts: 3,

        transactions: 0,

        entries: 0

      }

    );


  } finally {

    w.close();

  }


  /* ======================================
     TEST 11 - MISSING PAID ORDER RECEIPT
  ====================================== */

  orders[invoice2].status = "paid";


  write(

    "lsp_pg_orders.json",

    orders

  );


  assert.throws(

    () => run("verify", root),

    /PAID_ORDER_WITHOUT_RECEIPT/

  );


  orders[invoice2].status = "pending";


  write(

    "lsp_pg_orders.json",

    orders

  );


  assert.deepEqual(

    run("verify", root),

    m

  );


  /* ======================================
     TEST 12 - RECEIPT TAMPERING DETECTION
  ====================================== */

  db = new DatabaseSync(file);


  try {

    db.exec(

      "UPDATE legacy_admin_receipts " +

      "SET amount=99"

    );

  } finally {

    db.close();

  }


  assert.throws(

    () => run("verify", root),

    /RECEIPT_RECONCILIATION_FAILED/

  );


  /* ======================================
     ALL TESTS COMPLETED
  ====================================== */

  console.log(

    "PASS import, retry, verification, " +

    "duplicate/conflict lookup, pending counts, " +

    "balance unchanged, missing paid receipt, " +

    "tampering"

  );


} finally {


  /* REMOVE TEMPORARY TEST DATA */

  fs.rmSync(root, {

    recursive: true,

    force: true

  });

}