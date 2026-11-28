"use strict";

/* ==========================================
   LIVESTREAM PRO
   WALLET STORAGE ADAPTER AUTOMATIC TEST
========================================== */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");

const { execFileSync } =
  require("node:child_process");

const { DatabaseSync } =
  require("node:sqlite");

const {
  createJsonWalletAdapter,
  openRehearsalAdapter
} = require("./wallet-storage-adapter");

const {
  openWallet
} = require("./wallet-engine");

const {
  run
} = require("./wallet-legacy-receipts");


/* ==========================================
   PRIVATE TEST DIRECTORY
========================================== */

const hash = x => crypto
  .createHash("sha256")
  .update(JSON.stringify(x))
  .digest("hex");


const root = fs.mkdtempSync(

  path.join(

    os.tmpdir(),

    "lsp-wallet-migration-"

  )

);


const oldId =
  "aaaaaaaa-1111-4111-8111-111111111111";


const invoice =
  "LSP" + "A".repeat(20);

const freshInvoice =
  "LSP" + "B".repeat(20);


const oldOp = {

  actor: "admin",

  requestId: oldId,

  kind: "topup",

  targetUid: "A",

  amount: 250,

  note: "old"

};


const fresh = {

  ...oldOp,

  requestId:
    "11111111-1111-4111-8111-111111111111",

  amount: 50,

  note: "new"

};


const write = (name, x) =>

  fs.writeFileSync(

    path.join(root, name),

    JSON.stringify(x),

    {

      mode: 0o600,

      flag: "wx"

    }

  );


let a;


try {


  /* ======================================
     TEST JSON ADAPTER
  ====================================== */

  const tx = {

    users: {},

    commit() {

      return "ok";

    }

  };


  const json = createJsonWalletAdapter({

    begin: uids => {

      assert.deepEqual(uids, ["A"]);

      return tx;

    }

  });


  assert.equal(

    json.mode,

    "JSON_ONLY"

  );


  assert.equal(

    json.begin(["A"]),

    tx

  );


  /* ======================================
     CREATE MIGRATION FIXTURES
  ====================================== */

  write("users.json", {

    admin: {

      profile: {

        coins: 0

      },

      lspAdminWalletReceipts: {

        [hash(["admin", oldId])]: {

          fingerprint: hash([

            "topup",

            "A",

            250,

            "old"

          ]),

          targetUid: "A",

          kind: "topup",

          amount: 250,

          at: 123

        }

      }

    },


    A: {

      profile: {

        coins: 1250,

        coinDeposit: 350,

        creditedPaymentInvoices: {

          [invoice]: {

            diamonds: 100,

            at: 456

          }

        }

      }

    },


    B: {

      profile: {

        coins: 100

      }

    }

  });


  write("lsp_pg_orders.json", {

    [invoice]: {

      uid: "A",

      diamonds: 100,

      status: "paid"

    },


    [freshInvoice]: {

      uid: "B",

      diamonds: 100,

      status: "pending"

    }

  });


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


  run("import", root);

  run("verify", root);


  /* ======================================
     CREATE SEPARATE ADAPTER TEST COPY
  ====================================== */

  const dir = path.join(

    root,

    "adapter-rehearsal"

  );


  fs.mkdirSync(dir, {

    mode: 0o700

  });


  const source = path.join(

    root,

    "candidate",

    "wallet-test.sqlite"

  );


  const file = path.join(

    dir,

    "wallet-test.sqlite"

  );


  // Only copy a closed fixture database.

  fs.copyFileSync(

    source,

    file,

    fs.constants.COPYFILE_EXCL

  );


  fs.chmodSync(file, 0o600);


  /* ======================================
     BLOCK DIRECT WALLET COMMIT
  ====================================== */

  const raw = openWallet(file);


  try {

    assert.throws(

      () => raw.commit({

        actor: "admin",

        requestId: fresh.requestId,

        reason: "raw",

        changes: [

          {

            uid: "A",

            delta: {

              coins: 1

            }

          }

        ]

      }),

      /WALLET_ADAPTER_REQUIRED/

    );

  } finally {

    raw.close();

  }


  /* ======================================
     OPEN SQLITE STORAGE ADAPTER
  ====================================== */

  a = openRehearsalAdapter(dir);


  /* LEGACY ADMIN DUPLICATE */

  assert.equal(

    a.adminTransaction(oldOp).legacy,

    true

  );


  assert.throws(

    () => a.adminTransaction({

      ...oldOp,

      amount: 251

    }),

    /REQUEST_ID_CONFLICT/

  );


  /* REQUEST ID CASE PROTECTION */

  assert.throws(

    () => a.adminTransaction({

      ...oldOp,

      requestId: oldId.toUpperCase()

    }),

    /LEGACY_REQUEST_CASE_CONFLICT/

  );


  /* LEGACY PAYMENT DUPLICATE */

  assert.equal(

    a.paymentCredit({

      invoice,

      uid: "A",

      diamonds: 100

    }).legacy,

    true

  );


  assert.throws(

    () => a.paymentCredit({

      invoice,

      uid: "B",

      diamonds: 100

    }),

    /REQUEST_ID_CONFLICT/

  );


  assert.equal(

    a.getBalance("A").coins,

    1250

  );


  /* ======================================
     NEW ADMIN TRANSACTION
  ====================================== */

  assert.equal(

    a.adminTransaction(fresh).duplicate,

    false

  );


  assert.equal(

    a.adminTransaction(fresh).duplicate,

    true

  );


  assert.throws(

    () => a.adminTransaction({

      ...fresh,

      note: "different"

    }),

    /REQUEST_ID_CONFLICT/

  );


  /* ======================================
     ADMIN DEBIT
  ====================================== */

  const debit = {

    ...fresh,

    requestId:
      "22222222-2222-4222-8222-222222222222",

    kind: "withdraw",

    amount: 20

  };


  a.adminTransaction(debit);


  assert.throws(

    () => a.adminTransaction({

      ...debit,

      requestId:
        "33333333-3333-4333-8333-333333333333",

      amount: 9999

    }),

    /INVALID_BALANCE/

  );


  /* ======================================
     NEW PAYMENT TRANSACTION
  ====================================== */

  const payment = {

    invoice: freshInvoice,

    uid: "B",

    diamonds: 100

  };


  a.paymentCredit(payment);


  assert.equal(

    a.paymentCredit(payment).duplicate,

    true

  );


  assert.throws(

    () => a.paymentCredit({

      ...payment,

      diamonds: 101

    }),

    /REQUEST_ID_CONFLICT/

  );


  assert.equal(

    a.getBalance("A").coins,

    1280

  );


  assert.equal(

    a.getBalance("B").coins,

    200

  );


  /* ======================================
     DATABASE RESTART PROTECTION
  ====================================== */

  a.close();

  a = undefined;


  a = openRehearsalAdapter(dir);


  assert.equal(

    a.adminTransaction(fresh).duplicate,

    true

  );


  assert.equal(

    a.paymentCredit(payment).duplicate,

    true

  );


  assert.deepEqual(

    a.reconcile(),

    {

      ok: true,

      accounts: 3,

      transactions: 3,

      entries: 3

    }

  );


  /* ======================================
     LEGACY RECEIPT TAMPERING DETECTION
  ====================================== */

  const db = new DatabaseSync(file);


  try {

    db.exec(

      "UPDATE legacy_admin_receipts " +

      "SET amount=999"

    );

  } finally {

    db.close();

  }


  assert.throws(

    () => a.adminTransaction(fresh),

    /LEGACY_RECEIPTS_INVALID/

  );


  /* ORIGINAL CANDIDATE REMAINS UNCHANGED */

  run("verify", root);


  console.log(

    "[WALLET ADAPTER TEST] PASS " +

    "JSON delegation, legacy duplicate/conflict, " +

    "new transactions, retry, rollback, " +

    "restart, receipt integrity, " +

    "original candidate unchanged"

  );


} finally {


  if (a) a.close();


  fs.rmSync(root, {

    recursive: true,

    force: true

  });

}