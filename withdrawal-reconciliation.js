"use strict";

/* ==========================================
   LIVESTREAM PRO
   WITHDRAWAL LEDGER RECONCILIATION V1.0
   READ ONLY - REHEARSAL MODE
========================================== */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");


/* ==========================================
   VALIDATION UTILITIES
========================================== */

const obj = x =>

  x !== null &&
  typeof x === "object" &&
  !Array.isArray(x);


const list = x => {

  if (
    !Array.isArray(x) ||
    !x.every(obj)
  ) {

    throw new Error(
      "INVALID_RECORD_LIST"
    );

  }

  return x;

};


const idOK = x =>

  typeof x === "string" &&
  x.length > 0;


const amountOK = x =>

  Number.isSafeInteger(x) &&
  x > 0;


/* NORMALIZE TIMESTAMP */

const time = x => {

  const n =

    typeof x === "number"
      ? x
      : typeof x === "string"
        ? Date.parse(x)
        : NaN;

  return Number.isSafeInteger(n) && n > 0
    ? n
    : null;

};


/* TERMINAL WITHDRAWAL STATUS */

const settled = x =>

  ["approved", "rejected"].includes(x);


/* ==========================================
   WITHDRAWAL RECONCILIATION ENGINE
========================================== */

function reconcile(users, withdrawals) {

  if (!obj(users)) {

    throw new Error("INVALID_USERS");

  }


  /* ======================================
     LOAD WITHDRAWAL REQUESTS
  ====================================== */

  const requests = list(withdrawals)

    .map((w, i) => {

      if (

        !idOK(w.id) ||

        !idOK(w.uid) ||

        !amountOK(w.amount)

      ) {

        throw new Error(
          "INVALID_WITHDRAWAL"
        );

      }

      return {

        ...w,

        ref: `REQUEST_${i + 1}`

      };

    });


  /* DUPLICATE REQUEST PROTECTION */

  if (

    new Set(
      requests.map(w => w.id)
    ).size !== requests.length

  ) {

    throw new Error(
      "DUPLICATE_REQUEST_ID"
    );

  }


  /* ======================================
     LOAD WALLET HOLDS AND REFUNDS
  ====================================== */

  const holds = [];

  const aliases = new Map();

  const refunds = new Map();

  const seen = new Set();


  for (

    const [uid, u] of Object.entries(users)

  ) {

    if (

      !obj(u) ||

      !obj(u.profile)

    ) {

      throw new Error(
        "INVALID_ACCOUNT"
      );

    }


    /* PROTECT USER PRIVACY */

    aliases.set(

      uid,

      `ACCOUNT_${aliases.size + 1}`

    );


    /* LOAD REFUND RECEIPTS */

    refunds.set(

      uid,

      list(

        u.withdrawRefundRecords === undefined

          ? []

          : u.withdrawRefundRecords

      )

    );


    /* LOAD WITHDRAWAL HOLDS */

    for (

      const h of list(

        u.profile.withdrawHold === undefined

          ? []

          : u.profile.withdrawHold

      )

    ) {

      if (!amountOK(h.amount)) {

        throw new Error(
          "INVALID_HOLD_AMOUNT"
        );

      }


      /* DUPLICATE HOLD PROTECTION */

      if (idOK(h.id)) {

        const key = JSON.stringify([

          uid,

          h.id

        ]);


        if (seen.has(key)) {

          throw new Error(
            "DUPLICATE_HOLD_ID"
          );

        }

        seen.add(key);

      }


      holds.push({

        uid,

        data: h,

        ref: `HOLD_${holds.length + 1}`

      });

    }

  }


  /* ======================================
     MATCHING STORAGE
  ====================================== */

  const matches = new Map();

  const used = new Set();


  /* ======================================
     STEP 1 - EXACT ID MATCHING
  ====================================== */

  for (const h of holds) {

    const w =

      idOK(h.data.id) &&

      requests.find(

        w => w.id === h.data.id

      );


    if (!w) continue;


    /* VERIFY REQUEST OWNER */

    if (w.uid !== h.uid) {

      throw new Error(
        "REQUEST_OWNER_CONFLICT"
      );

    }


    matches.set(

      h.ref,

      {

        w,

        type: "EXACT_ID"

      }

    );


    used.add(w.ref);

  }


  /* ======================================
     STEP 2 - LEGACY TRANSACTION MATCHING
  ====================================== */

  const remaining = holds.filter(

    h => !matches.has(h.ref)

  );


  const available = requests.filter(

    w => !used.has(w.ref)

  );


  /* MATCH UID + AMOUNT + EXACT TIMESTAMP */

  const candidates = h =>

    available.filter(w =>

      w.uid === h.uid &&

      w.amount === h.data.amount &&

      time(h.data.ts) !== null &&

      time(h.data.ts) === time(w.createdAt)

    );


  const edges = new Map(

    remaining.map(h => [

      h.ref,

      candidates(h)

    ])

  );


  for (const h of remaining) {

    const options = edges.get(h.ref);


    /* REQUIRE ONE UNIQUE CANDIDATE */

    if (options.length !== 1) {

      continue;

    }


    const w = options[0];


    /* PREVENT MULTIPLE HOLDS MATCHING
       THE SAME WITHDRAWAL REQUEST */

    if (

      remaining.filter(k =>

        edges.get(k.ref).some(

          r => r.ref === w.ref

        )

      ).length !== 1

    ) {

      continue;

    }


    matches.set(

      h.ref,

      {

        w,

        type: "LEGACY_CANDIDATE"

      }

    );


    used.add(w.ref);

  }


  /* ======================================
     STEP 3 - FINANCIAL INTEGRITY CHECK
  ====================================== */

  const details = holds.map(h => {

    const m = matches.get(h.ref);

    const w = m?.w;

    const issues = [];


    const status =

      w?.status ?? "MISSING";


    /* UNMATCHED WITHDRAWAL */

    if (!w) {

      issues.push(

        edges.get(h.ref)?.length

          ? "AMBIGUOUS_MATCH"

          : "REQUEST_MISSING"

      );

    } else {


      /* LEGACY MATCH VERIFICATION */

      if (m.type === "LEGACY_CANDIDATE") {

        issues.push(

          "MANUAL_CONFIRMATION_REQUIRED"

        );

      }


      /* AMOUNT VERIFICATION */

      if (w.amount !== h.data.amount) {

        issues.push("AMOUNT_MISMATCH");

      }


      /* TIMESTAMP VERIFICATION */

      if (

        time(h.data.ts) === null ||

        time(h.data.ts) !== time(w.createdAt)

      ) {

        issues.push("TIMESTAMP_MISMATCH");

      }


      /* WITHDRAWAL SETTLEMENT */

      if (!settled(status)) {

        issues.push("REQUEST_NOT_SETTLED");

      }


      /* STATUS VALIDATION */

      if (

        ![

          "pending",

          "processing",

          "approved",

          "rejected"

        ].includes(status)

      ) {

        issues.push("UNKNOWN_REQUEST_STATUS");

      }


      /* ==================================
         REFUND RECEIPT VERIFICATION
      ================================== */

      const rr = refunds.get(h.uid)

        .filter(r =>

          r.id === w.id ||

          (

            idOK(h.data.id) &&

            r.id === h.data.id

          )

        );


      /* DUPLICATE REFUND */

      if (rr.length > 1) {

        issues.push("DUPLICATE_REFUND");

      }


      /* REFUND AMOUNT MISMATCH */

      if (

        rr.some(

          r => r.amount !== h.data.amount

        )

      ) {

        issues.push("REFUND_AMOUNT_MISMATCH");

      }


      /* REFUND STATE MISMATCH */

      if (

        rr.length &&

        status !== "rejected"

      ) {

        issues.push("REFUND_STATE_MISMATCH");

      }


      /* MISSING REFUND RECEIPT */

      if (

        !rr.length &&

        status === "rejected"

      ) {

        issues.push("REFUND_RECEIPT_MISSING");

      }

    }


    /* BUILD ANONYMOUS REPORT */

    return {

      hold: h.ref,

      request: w?.ref ?? null,

      account: aliases.get(h.uid),

      amount: h.data.amount,

      status,

      match: m?.type ?? "UNMATCHED",

      issues

    };

  });


  /* ======================================
     FINAL RECONCILIATION REPORT
  ====================================== */

  return {

    mode: "READ_ONLY_REHEARSAL",

    totalRequests: requests.length,

    totalHolds: holds.length,


    exactMatches:

      details.filter(

        r => r.match === "EXACT_ID"

      ).length,


    legacyCandidates:

      details.filter(

        r => r.match === "LEGACY_CANDIDATE"

      ).length,


    unmatchedHolds:

      details.filter(

        r => r.match === "UNMATCHED"

      ).length,


    unmatchedRequests:

      requests.filter(

        w => !used.has(w.ref)

      ).map(w => w.ref),


    pendingRequests:

      requests.filter(

        w => !settled(w.status)

      ).length,


    activationAllowed: false,

    details

  };

}


/* ==========================================
   PRIVATE MIGRATION DATABASE READER
========================================== */

function readCopy(dir) {

  if (!dir) {

    throw new Error(
      "TEST_DIR_REQUIRED"
    );

  }


  const root = fs.realpathSync(dir);

  const st = fs.lstatSync(root);


  /* BLOCK PRODUCTION DIRECTORY ACCESS */

  if (

    path.dirname(root) !==
      fs.realpathSync(os.tmpdir()) ||

    !path.basename(root)
      .startsWith("lsp-wallet-migration-") ||

    !st.isDirectory() ||

    (st.mode & 0o077)

  ) {

    throw new Error(
      "INVALID_TEST_DIRECTORY"
    );

  }


  /* SECURE READ-ONLY FILE ACCESS */

  const read = name => {

    const fd = fs.openSync(

      path.join(root, name),

      fs.constants.O_RDONLY |

      fs.constants.O_NOFOLLOW |

      fs.constants.O_NONBLOCK

    );


    try {

      const st = fs.fstatSync(fd);


      if (

        !st.isFile() ||

        (st.mode & 0o077) ||

        st.size > 64 * 1024 * 1024

      ) {

        throw new Error(
          "UNSAFE_SOURCE_FILE"
        );

      }


      return JSON.parse(

        fs.readFileSync(fd, "utf8")

      );


    } finally {

      fs.closeSync(fd);

    }

  };


  return reconcile(

    read("users.json"),

    read("withdraw_requests.json")

  );

}


/* ==========================================
   AUTOMATIC RECONCILIATION TEST
========================================== */

function test() {

  const users = {

    A: {

      profile: {

        withdrawHold: [

          {

            id: "new",

            amount: 100,

            ts: 1000

          },

          {

            id: "old",

            amount: 100,

            ts: 2000

          }

        ]

      }

    }

  };


  const rows = [

    {

      id: "new",

      uid: "A",

      amount: 100,

      createdAt: 1000,

      status: "processing"

    },

    {

      id: "legacy",

      uid: "A",

      amount: 100,

      createdAt: 2000,

      status: "approved"

    }

  ];


  const before = JSON.stringify([

    users,

    rows

  ]);


  const r = reconcile(users, rows);


  /* TEST EXACT MATCH */

  assert.equal(r.exactMatches, 1);


  /* TEST LEGACY MATCH */

  assert.equal(r.legacyCandidates, 1);


  /* TEST PENDING WITHDRAWALS */

  assert.equal(r.pendingRequests, 1);


  /* PREVENT PRODUCTION ACTIVATION */

  assert.equal(r.activationAllowed, false);


  /* VERIFY SOURCE DATA UNCHANGED */

  assert.equal(

    JSON.stringify([users, rows]),

    before

  );


  /* TEST AMBIGUOUS MATCH */

  assert.equal(

    reconcile(users, [

      ...rows,

      {

        ...rows[1],

        id: "ambiguous"

      }

    ]).unmatchedHolds,

    1

  );


  /* TEST DUPLICATE REQUEST */

  assert.throws(

    () => reconcile(users, [

      ...rows,

      rows[0]

    ]),

    /DUPLICATE_REQUEST_ID/

  );


  /* TEST INVALID REQUEST OWNER */

  assert.throws(

    () => reconcile(users, [

      {

        ...rows[0],

        uid: "B"

      },

      rows[1]

    ]),

    /REQUEST_OWNER_CONFLICT/

  );


  /* TEST INVALID AMOUNT */

  assert(

    reconcile(users, [

      {

        ...rows[0],

        amount: 101

      },

      rows[1]

    ]).details[0].issues.includes(

      "AMOUNT_MISMATCH"

    )

  );


  /* TEST MISSING REFUND RECEIPT */

  assert(

    reconcile(users, [

      rows[0],

      {

        ...rows[1],

        status: "rejected"

      }

    ]).details[1].issues.includes(

      "REFUND_RECEIPT_MISSING"

    )

  );


  console.log(

    "[WITHDRAWAL RECONCILIATION TEST] PASS"

  );

}


/* ==========================================
   COMMAND LINE INTERFACE
========================================== */

if (require.main === module) {

  try {

    const [

      cmd,

      dir,

      ...extra

    ] = process.argv.slice(2);


    if (

      cmd === "test" &&

      !dir &&

      !extra.length

    ) {

      test();

    } else if (

      cmd === "audit" &&

      dir &&

      !extra.length

    ) {

      console.log(

        JSON.stringify(

          readCopy(dir),

          null,

          2

        )

      );

    } else {

      throw new Error(

        "Usage: test | audit PRIVATE_MIGRATION_DIR"

      );

    }


  } catch (e) {

    console.error(

      "[WITHDRAWAL RECONCILIATION] FAILED",

      e.code ||

      (

        e instanceof SyntaxError

          ? "INVALID_JSON"

          : e.message

      )

    );


    process.exitCode = 1;

  }

}


/* ==========================================
   MODULE EXPORTS
========================================== */

module.exports = {

  reconcile

};