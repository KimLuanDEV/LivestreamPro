"use strict";

/* ==========================================
   LIVESTREAM PRO
   FINANCIAL EVIDENCE RECONCILIATION V1.10
   READ ONLY
========================================== */

const crypto = require("node:crypto");
const assert = require("node:assert/strict");

const {
  isDeepStrictEqual
} = require("node:util");


/* ==========================================
   VALIDATION HELPERS
========================================== */

const obj = x =>
  x !== null &&
  typeof x === "object" &&
  !Array.isArray(x);

const need = (ok, code) => {
  if (!ok) throw Error(code);
};

const sha = x => crypto
  .createHash("sha256")
  .update(x)
  .digest("hex");

const idOK = x =>
  typeof x === "string" &&
  x.length > 0 &&
  x.length <= 256 &&
  x.trim() === x;

const positive = x =>
  Number.isSafeInteger(x) && x > 0;

const invoiceOK = x =>
  /^LSP[A-F0-9]{20}$/.test(x);


function time(x) {

  const n =

    typeof x === "number"

      ? x

      : typeof x === "string" &&
        /^\d{4}-\d{2}-\d{2}T.*Z$/.test(x)

        ? Date.parse(x)

        : NaN;

  return positive(n) ? n : null;

}


function list(x) {

  if (x === undefined) return [];

  need(
    Array.isArray(x) &&
    x.every(obj),
    "INVALID_RECORD_LIST"
  );

  return x;

}


function entries(x) {

  if (x === undefined) return [];

  need(
    obj(x) &&
    Object.values(x).every(obj),
    "INVALID_RECORD_MAP"
  );

  return Object.entries(x);

}


function group(rows, key) {

  const m = new Map();

  for (const r of rows) {

    const k = key(r);

    if (!idOK(k)) continue;

    if (!m.has(k)) m.set(k, []);

    m.get(k).push(r);

  }

  return m;

}


/* ==========================================
   FINANCIAL EVIDENCE AUDIT
========================================== */

function run(s) {

  need(
    s?.scope === "JSON_ONLY" &&
    positive(s.createdAt) &&
    Array.isArray(s.files),
    "JSON_BACKUP_REQUIRED"
  );


  /* AUTHENTICATED SOURCE FILES */

  const files = new Map(
    s.files.map(f => [f.name, f])
  );

  need(
    files.size === s.files.length,
    "DUPLICATE_SOURCE_FILE"
  );

  const hashes = {};


  function read(name) {

    const f = files.get(name);

    if (!f) {

      hashes[name] = null;

      return undefined;

    }

    const raw = Buffer.from(
      f.content,
      "base64"
    );

    need(
      raw.length === f.size &&
      sha(raw) === f.sha256,
      "SOURCE_HASH_MISMATCH"
    );

    hashes[name] = f.sha256;

    return JSON.parse(
      raw.toString("utf8")
    );

  }


  const users = read("users.json");

  need(obj(users), "INVALID_USERS");

  const withdraw = read(
    "withdraw_requests.json"
  );

  const orders = read(
    "lsp_pg_orders.json"
  );


  /* ======================================
     ACCOUNT FINANCIAL INVENTORY
  ====================================== */

  const holds = [];
  const refunds = [];
  const markers = [];
  const transfers = [];

  const accounts = new Map();


  for (const [uid, u] of Object.entries(users)) {

    need(
      idOK(uid) &&
      obj(u) &&
      obj(u.profile),
      "INVALID_ACCOUNT"
    );


    /* ANONYMOUS ACCOUNT REFERENCE */

    const account =
      `A${accounts.size + 1}`;

    accounts.set(uid, account);


    /* WITHDRAWAL HOLDS */

    for (
      const [i, r] of
      list(u.profile.withdrawHold).entries()
    ) {

      holds.push({

        uid,
        account,
        index: i,

        ref: `H${holds.length + 1}`,

        r

      });

    }


    /* REFUND RECEIPTS */

    for (
      const [i, r] of
      list(u.withdrawRefundRecords).entries()
    ) {

      refunds.push({

        uid,
        account,
        index: i,

        ref: `F${refunds.length + 1}`,

        r

      });

    }


    /* TRANSFER REQUESTS */

    for (
      const [i, r] of
      list(u.transferRequests).entries()
    ) {

      transfers.push({

        uid,
        account,
        index: i,
        r

      });

    }


    /* PAYMENT CREDIT MARKERS */

    for (
      const [invoice, r] of
      entries(u.profile.creditedPaymentInvoices)
    ) {

      markers.push({

        uid,
        account,
        invoice,
        r

      });

    }

  }


  /* ======================================
     WITHDRAWAL REQUEST INDEX
  ====================================== */

  const requests = list(withdraw).map(

    (r, index) => ({

      r,
      index,
      ref: `R${index + 1}`

    })

  );


  const wi = group(requests, x => x.r.id);

  const hi = group(holds, x => x.r.id);

  const fi = group(refunds, x => x.r.id);


  const used = new Set();

  const exact = new Map();


  /* ======================================
     EXACT ID MATCHING

     NEVER FALL BACK FROM CONFLICTING ID
  ====================================== */

  for (const h of holds) {

    if (!idOK(h.r.id)) continue;

    const options =
      wi.get(h.r.id) || [];


    options.forEach(
      w => used.add(w.ref)
    );


    if (

      options.length === 1 &&

      hi.get(h.r.id).length === 1

    ) {

      exact.set(
        h.ref,
        options[0]
      );

    }

  }


  /* ======================================
     LEGACY HOLD MATCHING

     UID + AMOUNT + EXACT TIMESTAMP
  ====================================== */

  const legacy = holds.filter(h =>

    h.r.id === undefined ||

    h.r.id === null ||

    h.r.id === ""

  );


  const candidates = new Map(

    legacy.map(h => [

      h.ref,

      requests.filter(w =>

        !used.has(w.ref) &&

        idOK(w.r.id) &&

        wi.get(w.r.id).length === 1 &&

        w.r.uid === h.uid &&

        positive(h.r.amount) &&

        h.r.amount === w.r.amount &&

        time(h.r.ts) !== null &&

        time(h.r.ts) === time(w.r.createdAt)

      )

    ])

  );


  /* ======================================
     WITHDRAWAL HOLD REPORT
  ====================================== */

  const holdDetails = holds.map(h => {

    let w = exact.get(h.ref);

    let match = w
      ? "EXACT_ID"
      : "UNMATCHED";

    const issues = [];


    if (!w && candidates.has(h.ref)) {

      const options =
        candidates.get(h.ref);


      if (

        options.length === 1 &&

        legacy.filter(k =>

          candidates.get(k.ref)
            .includes(options[0])

        ).length === 1

      ) {

        w = options[0];

        match = "LEGACY_CANDIDATE";

      } else {

        issues.push(

          options.length

            ? "AMBIGUOUS_CANDIDATE"

            : "NO_CANDIDATE"

        );

      }

    }


    if (!w && idOK(h.r.id)) {

      issues.push(
        "ID_MISSING_OR_DUPLICATED_IN_LINK"
      );

    }


    if (!idOK(h.r.id)) {

      issues.push(
        "HOLD_ID_MISSING_OR_INVALID"
      );

    }


    if (!positive(h.r.amount)) {

      issues.push(
        "INVALID_HOLD_AMOUNT"
      );

    }


    if (w) {

      if (w.r.uid !== h.uid) {

        issues.push("OWNER_CONFLICT");

      }


      if (w.r.amount !== h.r.amount) {

        issues.push("AMOUNT_CONFLICT");

      }


      if (

        time(h.r.ts) === null ||

        time(h.r.ts) !== time(w.r.createdAt)

      ) {

        issues.push("TIME_CONFLICT");

      }


      /* EMBEDDED RECOVERY REQUEST */

      if (h.r.request !== undefined) {

        const n = h.r.request;

        if (

          !obj(n) ||

          n.id !== w.r.id ||

          n.uid !== w.r.uid ||

          n.amount !== w.r.amount ||

          time(n.createdAt) === null ||

          time(n.createdAt) !==
            time(w.r.createdAt) ||

          !isDeepStrictEqual(
            n.bank,
            w.r.bank
          )

        ) {

          issues.push(
            "EMBEDDED_REQUEST_CONFLICT"
          );

        }

      } else {

        issues.push(
          "NO_EMBEDDED_REQUEST"
        );

      }

    } else if (withdraw === undefined) {

      issues.push(
        "WITHDRAWAL_SOURCE_MISSING"
      );

    }


    return {

      hold: h.ref,

      account: h.account,

      holdIndex: h.index,

      holdAt: time(h.r.ts),

      amount: positive(h.r.amount)
        ? h.r.amount
        : null,

      request: w?.ref ?? null,

      match,

      issues

    };

  });


  /* ======================================
     WITHDRAWAL STATUS & REFUND AUDIT
  ====================================== */

  const validStatuses = [

    "pending",

    "processing",

    "approved",

    "rejected"

  ];


  const requestDetails = requests.map(w => {

    const r = w.r;

    const issues = [];


    const rs = idOK(r.id)

      ? fi.get(r.id) || []

      : [];


    const linked = holdDetails.filter(

      h => h.request === w.ref

    );


    if (!idOK(r.id)) {

      issues.push("REQUEST_ID_INVALID");

    } else if (wi.get(r.id).length !== 1) {

      issues.push("DUPLICATE_REQUEST_ID");

    }


    if (!accounts.has(r.uid)) {

      issues.push("ACCOUNT_MISSING");

    }


    if (!positive(r.amount)) {

      issues.push("INVALID_REQUEST_AMOUNT");

    }


    if (time(r.createdAt) === null) {

      issues.push("INVALID_REQUEST_TIME");

    }


    if (!validStatuses.includes(r.status)) {

      issues.push("UNKNOWN_REQUEST_STATUS");

    }


    if (!linked.length) {

      issues.push("NO_UNIQUE_HOLD_LINK");

    }


    if (linked.some(h => h.issues.length)) {

      issues.push("HOLD_REVIEW_REQUIRED");

    }


    if (rs.length > 1) {

      issues.push("DUPLICATE_REFUND_RECEIPT");

    }


    if (rs.some(f =>

      f.uid !== r.uid ||

      f.r.amount !== r.amount

    )) {

      issues.push("REFUND_CONFLICT");

    }


    if (

      r.status === "rejected" &&

      !rs.length

    ) {

      issues.push("REFUND_RECEIPT_MISSING");

    }


    if (

      r.status !== "rejected" &&

      rs.length

    ) {

      issues.push("REFUND_STATUS_CONFLICT");

    }


    return {

      request: w.ref,

      requestIndex: w.index,

      createdAt: time(r.createdAt),

      account: accounts.get(r.uid) ?? null,

      amount: positive(r.amount)
        ? r.amount
        : null,

      status: validStatuses.includes(r.status)
        ? r.status
        : "UNKNOWN",

      holds: linked.map(h => h.hold),

      refunds: rs.map(f => f.ref),

      issues,

      externalSettlementVerified: false

    };

  });


  /* REFUND RECEIPT INVENTORY */

  const refundDetails = refunds.map(f => ({

    refund: f.ref,

    account: f.account,

    refundIndex: f.index,

    amount: positive(f.r.amount)
      ? f.r.amount
      : null,

    issues: [

      ...(

        !idOK(f.r.id) ||
        !positive(f.r.amount)

          ? ["INVALID_REFUND"]

          : []

      ),

      ...(

        (wi.get(f.r.id) || []).length !== 1

          ? ["NO_UNIQUE_REQUEST"]

          : []

      )

    ]

  }));


  /* ======================================
     PAYMENT ORDERS RECONCILIATION
  ====================================== */

  const mi = group(
    markers,
    x => x.invoice
  );

  const pi = new Map(
    entries(orders)
  );

  const paymentDetails = [];


  for (

    const invoice of new Set([

      ...mi.keys(),

      ...pi.keys()

    ])

  ) {

    const ms = mi.get(invoice) || [];

    const o = pi.get(invoice);

    const issues = [];


    if (!invoiceOK(invoice)) {

      issues.push("INVALID_INVOICE");

    }


    if (ms.length > 1) {

      issues.push(
        "DUPLICATE_CREDIT_MARKER"
      );

    }


    if (ms.some(m =>

      !positive(m.r.diamonds) ||

      !positive(m.r.at)

    )) {

      issues.push(
        "INVALID_CREDIT_MARKER"
      );

    }


    if (!o) {

      issues.push(

        orders === undefined

          ? "PAYMENT_SOURCE_MISSING"

          : "ORDER_MISSING"

      );

    }


    if (o) {

      if (

        !accounts.has(o.uid) ||

        !positive(o.diamonds) ||

        !positive(o.amountVnd) ||

        ![
          "pending",
          "paid",
          "sandbox_confirmed"
        ].includes(o.status)

      ) {

        issues.push("INVALID_ORDER");

      }


      if (ms.some(m =>

        m.uid !== o.uid ||

        m.r.diamonds !== o.diamonds

      )) {

        issues.push(
          "ORDER_MARKER_CONFLICT"
        );

      }


      if (

        o.status === "paid" &&

        !ms.length

      ) {

        issues.push(
          "PAID_WITHOUT_CREDIT_MARKER"
        );

      }


      if (

        o.status === "pending" &&

        ms.length

      ) {

        issues.push(
          "PENDING_WITH_CREDIT_MARKER"
        );

      }


      if (

        o.status === "sandbox_confirmed" &&

        ms.length

      ) {

        issues.push(
          "SANDBOX_WITH_CREDIT_MARKER"
        );

      }

    }


    paymentDetails.push({

      ref: `P${paymentDetails.length + 1}`,

      markerCount: ms.length,

      status:

        o && [
          "pending",
          "paid",
          "sandbox_confirmed"
        ].includes(o.status)

          ? o.status

          : null,

      issues,

      externalPaymentVerified: false

    });

  }


  const invalidMarkerKeys = markers.filter(

    m => !idOK(m.invoice)

  ).length;


  /* ======================================
     RECORDED WITHDRAWAL AMOUNTS
  ====================================== */

  const pending = requestDetails.filter(

    w => ["pending", "processing"]
      .includes(w.status)

  );


  const sum = rows =>

    rows.every(w => w.amount !== null)

      ? rows.reduce(

          (n, w) =>
            n + BigInt(w.amount),

          0n

        ).toString()

      : null;


  /* ======================================
     FINAL EVIDENCE REPORT
  ====================================== */

  return {

    mode: "FINANCIAL_EVIDENCE_READ_ONLY",

    snapshotCreatedAt:
      new Date(s.createdAt).toISOString(),

    sourceHashes: hashes,

    accounts: accounts.size,


    withdrawals: {

      requests:

        withdraw === undefined

          ? null

          : requests.length,

      holds: holds.length,

      refundReceipts: refunds.length,

      missingHoldIds:

        holds.filter(
          h => !idOK(h.r.id)
        ).length,

      missingRequestIds:

        requests.filter(
          w => !idOK(w.r.id)
        ).length,

      missingTransferIds:

        transfers.filter(
          t => !idOK(t.r.id)
        ).length,

      exactMatches:

        holdDetails.filter(

          h => h.match === "EXACT_ID"

        ).length,

      legacyCandidates:

        holdDetails.filter(

          h => h.match === "LEGACY_CANDIDATE"

        ).length,

      unmatchedHolds:

        holdDetails.filter(

          h => h.match === "UNMATCHED"

        ).length,

      pendingRequests:

        withdraw === undefined

          ? null

          : pending.length,

      pendingRecordedDiamonds:

        withdraw === undefined

          ? null

          : sum(pending),

      approvedRecordedDiamonds:

        withdraw === undefined

          ? null

          : sum(requestDetails.filter(

              w => w.status === "approved"

            )),

      holdDetails,

      requestDetails,

      refundDetails

    },


    payments: {

      sourcePresent:
        orders !== undefined,

      orders:

        orders === undefined

          ? null

          : pi.size,

      creditMarkers: markers.length,

      invalidMarkerKeys,

      pendingOrders:

        orders === undefined

          ? null

          : [...pi.values()].filter(

              o => o.status === "pending"

            ).length,

      details: paymentDetails

    },


    externalSettlementVerified: false,

    liabilityCertified: false,

    replayAllowed: false,

    activationAllowed: false

  };

}


/* ==========================================
   SYNTHETIC REGRESSION TEST
========================================== */

function test() {

  const users = {

    A: {

      profile: {

        withdrawHold: [

          {
            id: "r1",
            amount: 10,
            ts: 1
          },

          {
            amount: 20,
            ts: 2
          }

        ]

      }

    }

  };


  const w = [

    {

      id: "r1",
      uid: "A",
      amount: 10,
      createdAt: 1,
      status: "processing"

    },

    {

      id: "r2",
      uid: "A",
      amount: 20,
      createdAt: 2,
      status: "approved"

    }

  ];


  const snap = (u, rows, p) => ({

    scope: "JSON_ONLY",

    createdAt: 3,

    files: Object.entries({

      "users.json": u,

      "withdraw_requests.json": rows,

      ...(p === undefined

        ? {}

        : {"lsp_pg_orders.json": p}

      )

    }).map(([name, v]) => {

      const b = Buffer.from(
        JSON.stringify(v)
      );

      return {

        name,

        size: b.length,

        sha256: sha(b),

        content: b.toString("base64")

      };

    })

  });


  const s = snap(users, w);

  const before = JSON.stringify(s);

  const r = run(s);


  assert.equal(r.withdrawals.exactMatches, 1);

  assert.equal(r.withdrawals.legacyCandidates, 1);

  assert.equal(r.withdrawals.pendingRecordedDiamonds, "10");

  assert.equal(r.payments.orders, null);

  assert.equal(r.activationAllowed, false);

  assert.equal(JSON.stringify(s), before);


  /* AMBIGUOUS LEGACY MATCH */

  assert.equal(

    run(snap(users, [

      ...w,

      {...w[1], id: "r3"}

    ])).withdrawals.legacyCandidates,

    0

  );


  /* ACCOUNT OWNERSHIP CONFLICT */

  assert(

    run(snap(users, [

      {...w[0], uid: "B"},

      w[1]

    ])).withdrawals.holdDetails[0]
      .issues.includes("OWNER_CONFLICT")

  );


  /* MISSING REFUND RECEIPT */

  assert(

    run(snap(users, [

      w[0],

      {...w[1], status: "rejected"}

    ])).withdrawals.requestDetails[1]
      .issues.includes("REFUND_RECEIPT_MISSING")

  );


  /* MISSING PAYMENT CREDIT MARKER */

  const inv = "LSP" + "A".repeat(20);


  assert(

    run(snap(users, w, {

      [inv]: {

        uid: "A",

        diamonds: 100,

        amountVnd: 1000,

        status: "paid"

      }

    })).payments.details[0]
      .issues.includes("PAID_WITHOUT_CREDIT_MARKER")

  );


  /* INVALID SOURCE CHECKSUM */

  assert.throws(

    () => run({

      ...s,

      files: s.files.map(

        f => ({...f, sha256: "bad"})

      )

    }),

    /SOURCE_HASH_MISMATCH/

  );


  console.log(

    "[FINANCIAL EVIDENCE V1.10 TEST] PASS"

  );

}


module.exports = {

  run

};


if (require.main === module) {

  if (

    process.argv.length !== 3 ||

    process.argv[2] !== "test"

  ) {

    console.error("Usage: test");

    process.exitCode = 1;

  } else {

    test();

  }

}