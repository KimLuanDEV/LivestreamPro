"use strict";

/* ==========================================
   LIVESTREAM PRO
   WALLET STORAGE ADAPTER V1.0
   JSON PRODUCTION / SQLITE REHEARSAL
========================================== */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");

const fail = code => {
  throw new Error(code);
};

const hash = x => crypto
  .createHash("sha256")
  .update(JSON.stringify(x))
  .digest("hex");

const uidOK = x =>
  typeof x === "string" &&
  x.length > 0 &&
  x.length <= 128 &&
  x.trim() === x;

const uuidOK = x =>
  typeof x === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);

const amountOK = x =>
  Number.isSafeInteger(x) &&
  x > 0 &&
  x <= 1000000000;

const PAYMENT_ACTOR = "@lsp:payment";


/* ==========================================
   JSON PRODUCTION STORAGE ADAPTER
========================================== */

function createJsonWalletAdapter({ begin }) {

  if (typeof begin !== "function") {

    fail("JSON_BEGIN_REQUIRED");

  }

  return Object.freeze({

    mode: "JSON_ONLY",

    begin(uids) {

      return begin(uids);

    }

  });

}


/* ==========================================
   PERSISTENT PAYMENT REQUEST ID
========================================== */

function paymentId(invoice) {

  const b = crypto
    .createHash("sha256")
    .update("LSP_PAYMENT_V1:" + invoice)
    .digest()
    .subarray(0, 16);

  b[6] = (b[6] & 15) | 64;
  b[8] = (b[8] & 63) | 128;

  const h = b.toString("hex");

  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;

}


/* ==========================================
   VERIFY LEGACY RECEIPT INTEGRITY
========================================== */

function verifyLegacy(db) {

  const meta = key => db.prepare(

    "SELECT value FROM wallet_meta WHERE key=?"

  ).get(key)?.value;


  const m = JSON.parse(

    meta("legacy_receipt_manifest_v1") ||
    "null"

  );


  if (

    !m ||

    m.version !== 1 ||

    m.usersSha256 !==
      meta("migration_source_sha256")

  ) {

    fail("LEGACY_MANIFEST_REQUIRED");

  }


  /* ADMIN RECEIPTS */

  const a = db.prepare(

    "SELECT receipt_key,fingerprint," +

    "target_uid,kind,amount " +

    "FROM legacy_admin_receipts " +

    "ORDER BY receipt_key"

  ).all().map(Object.values);


  /* PAYMENT RECEIPTS */

  const p = db.prepare(

    "SELECT invoice,uid,diamonds,credited_at " +

    "FROM legacy_payment_receipts " +

    "ORDER BY invoice"

  ).all().map(Object.values);


  /* RECEIPT SOURCE RECORDS */

  const o = db.prepare(

    "SELECT receipt_key,owner_uid," +

    "source_kind,recorded_at " +

    "FROM legacy_admin_receipt_sources"

  ).all().map(Object.values);


  o.sort((a, b) => {

    for (let i = 0; i < 3; i++) {

      if (a[i] < b[i]) return -1;

      if (a[i] > b[i]) return 1;

    }

    return 0;

  });


  /* VERIFY MANIFEST AND CHECKSUM */

  if (

    a.length !== m.adminCount ||

    p.length !== m.paymentCount ||

    o.filter(r => r[2] === "admin")
      .length !== m.adminSources ||

    o.filter(r => r[2] === "legacy")
      .length !== m.legacySources ||

    hash([a, p, o]) !== m.receiptSha256

  ) {

    fail("LEGACY_RECEIPTS_INVALID");

  }


  return new Set(

    a.map(r => r[0])

  );

}


/* ==========================================
   LEGACY REQUEST ID CASE PROTECTION
========================================== */

function rejectAmbiguousCase(
  keys,
  actor,
  id
) {

  if (!keys.size) return;


  const chars = id
    .toLowerCase()
    .split("");


  const positions = chars

    .map((c, i) =>
      /[a-f]/.test(c) ? i : -1
    )

    .filter(i => i >= 0);


  // Limit expensive legacy hash lookups.
  // Fail closed if reconciliation is uncertain.

  if (positions.length > 12) {

    fail("LEGACY_REQUEST_CASE_UNRESOLVED");

  }


  for (

    let mask = 0;

    mask < 2 ** positions.length;

    mask++

  ) {

    for (

      let j = 0;

      j < positions.length;

      j++

    ) {

      const i = positions[j];

      chars[i] =

        (mask & (1 << j))

          ? chars[i].toUpperCase()

          : chars[i].toLowerCase();

    }


    if (

      keys.has(

        hash([actor, chars.join("")])

      )

    ) {

      fail("LEGACY_REQUEST_CASE_CONFLICT");

    }

  }

}


/* ==========================================
   SQLITE STORAGE ADAPTER
   REHEARSAL MODE ONLY
========================================== */

function openRehearsalAdapter(dir) {

  const root = fs.realpathSync(dir);

  const parent = path.dirname(root);


  const privateDir = p => {

    const st = fs.lstatSync(p);

    return (
      st.isDirectory() &&
      !(st.mode & 0o077)
    );

  };


  /* PROTECT PRODUCTION DATABASE */

  if (

    path.basename(root) !==
      "adapter-rehearsal" ||

    !path.basename(parent)
      .startsWith("lsp-wallet-migration-") ||

    path.dirname(parent) !==
      fs.realpathSync(os.tmpdir()) ||

    !privateDir(root) ||

    !privateDir(parent)

  ) {

    fail(
      "ADAPTER_REHEARSAL_DIRECTORY_REQUIRED"
    );

  }


  const {

    openWallet

  } = require("./wallet-engine");


  const {

    classifyAdmin,

    classifyPayment

  } = require("./wallet-legacy-receipts");


  const wallet = openWallet(

    path.join(root, "wallet-test.sqlite")

  );


  try {

    if (wallet.getBalance(PAYMENT_ACTOR)) {

      fail("RESERVED_ACTOR_COLLISION");

    }

    wallet.reconcile();

  } catch (e) {

    wallet.close();

    throw e;

  }


  /* ======================================
     ADMIN WALLET TRANSACTION
  ====================================== */

  function adminTransaction({

    actor,

    requestId,

    kind,

    targetUid,

    amount,

    note = ""

  }) {

    if (

      !uidOK(actor) ||

      actor === PAYMENT_ACTOR ||

      !uidOK(targetUid) ||

      !uuidOK(requestId) ||

      !amountOK(amount) ||

      !["topup", "withdraw"].includes(kind) ||

      typeof note !== "string" ||

      note.length > 500

    ) {

      fail("INVALID_ADMIN_OPERATION");

    }


    const delta =

      kind === "topup"

        ? {

            coins: amount,

            coin_deposit: amount

          }

        : {

            coins: -amount

          };


    return wallet.commit({

      actor,

      requestId,

      reason: "admin:" + hash([

        kind,

        targetUid,

        amount,

        note

      ]),

      changes: [

        {

          uid: targetUid,

          delta

        }

      ]

    }, db => {


      const keys = verifyLegacy(db);


      const decision = classifyAdmin(

        db,

        actor,

        requestId,

        kind,

        targetUid,

        amount,

        note

      );


      if (decision === "NOT_FOUND") {

        rejectAmbiguousCase(

          keys,

          actor,

          requestId

        );

      }


      return decision;

    });

  }


  /* ======================================
     PAYMENT WALLET CREDIT
  ====================================== */

  function paymentCredit({

    invoice,

    uid,

    diamonds

  }) {

    if (

      typeof invoice !== "string" ||

      !/^LSP[A-F0-9]{20}$/.test(invoice) ||

      !uidOK(uid) ||

      !amountOK(diamonds)

    ) {

      fail("INVALID_PAYMENT_OPERATION");

    }


    // Test only. Production caller must
    // authenticate and verify payment first.

    return wallet.commit({

      actor: PAYMENT_ACTOR,

      requestId: paymentId(invoice),

      reason: "payment:" + invoice,

      changes: [

        {

          uid,

          delta: {

            coins: diamonds,

            coin_deposit: diamonds

          }

        }

      ]

    }, db => {

      verifyLegacy(db);

      return classifyPayment(

        db,

        invoice,

        uid,

        diamonds

      );

    });

  }


  /* ======================================
     PUBLIC ADAPTER INTERFACE
  ====================================== */

  return Object.freeze({

    mode: "REHEARSAL_ONLY",

    activationAllowed: false,

    adminTransaction,

    paymentCredit,

    getBalance: uid =>
      wallet.getBalance(uid),

    reconcile: () =>
      wallet.reconcile(),

    close: () =>
      wallet.close()

  });

}


/* ==========================================
   MODULE EXPORTS
========================================== */

module.exports = {

  createJsonWalletAdapter,

  openRehearsalAdapter

};