"use strict";

/* ==========================================
   LIVESTREAM PRO
   FINANCIAL RECEIPT RETENTION V1.8A
========================================== */

const fs = require("node:fs");

const {
  isDeepStrictEqual: equal
} = require("node:util");

const obj = x =>
  x !== null &&
  typeof x === "object" &&
  !Array.isArray(x);

const need = (ok, code) => {
  if (!ok) throw new Error(code);
};


/* ==========================================
   PERSISTENT FINANCIAL RECEIPTS
========================================== */

const MAPS = [
  "lspAdminWalletReceipts",
  "lspWalletReceipts",
  "socialGiftReceipts",
  "marketWalletReceipts",
  "spiritPurchaseReceipts",
  "gameRewardReceipts",
  "profile.creditedPaymentInvoices",
  "profile.linkedGiftReceipts",
  "profile.sfuGiftReceipts"
];

const LISTS = [
  "withdrawRefundRecords",
  "transferRequests"
];


/* ==========================================
   MUTABLE FINANCIAL RECORDS
========================================== */

const OTHER_MAPS = [
  "spiritRewardReceipts",
  "gameWalletLedgerV16.entries"
];

const OTHER_LISTS = [
  "profile.withdrawHold",
  "profile.liveGiftHistory",
  "profile.depositLogs",
  "transferHistory",
  "spiritBeasts",
  "dtpHistory",
  "timeRaceHistory"
];

const SINGLES = [
  "wheel8DoubleOffer",
  "lspMarketPending"
];


/* ==========================================
   SAFE FIELD READER
========================================== */

function get(o, field) {

  for (const k of field.split(".")) {

    if (o === undefined) {
      return undefined;
    }

    need(
      obj(o),
      "INVALID_FINANCIAL_CONTAINER:" + field
    );

    o = Object.hasOwn(o, k)
      ? o[k]
      : undefined;

  }

  return o;

}


/* ==========================================
   VALIDATE FINANCIAL MAP
========================================== */

function map(v) {

  if (v === undefined) return [];

  need(
    obj(v) &&
    Object.values(v).every(obj),

    "INVALID_RECEIPT_MAP"
  );

  return Object.entries(v);

}


/* ==========================================
   VALIDATE FINANCIAL LIST
========================================== */

function list(v) {

  if (v === undefined) return [];

  need(
    Array.isArray(v) &&
    v.every(obj),

    "INVALID_FINANCIAL_LIST"
  );

  return v;

}


/* ==========================================
   ACCOUNT FINANCIAL INVENTORY
========================================== */

function inventory(u) {

  need(
    obj(u) && obj(u.profile),
    "INVALID_ACCOUNT"
  );

  const counts = {};

  for (const f of [...MAPS, ...OTHER_MAPS]) {

    counts[f] =
      map(get(u, f)).length;

  }

  for (const f of [...LISTS, ...OTHER_LISTS]) {

    counts[f] =
      list(get(u, f)).length;

  }

  for (const f of SINGLES) {

    const v = get(u, f);

    need(
      v === undefined || obj(v),
      "INVALID_FINANCIAL_RECORD"
    );

    counts[f] =
      v === undefined ? 0 : 1;

  }

  if (u.gameWalletLedgerV16 !== undefined) {

    need(
      u.gameWalletLedgerV16?.version === 1 &&
      obj(u.gameWalletLedgerV16.entries),

      "INVALID_GAME_LEDGER"
    );

  }

  return counts;

}


/* ==========================================
   ACCOUNT DELETION RETENTION GUARD
========================================== */

function deletionIssues(u) {

  try {

    return Object.values(inventory(u))
      .some(n => n > 0)

      ? [
          "Financial records require verified retention before deletion"
        ]

      : [];

  } catch {

    return [
      "Financial record inventory invalid; review required"
    ];

  }

}


/* ==========================================
   INDEX RECORDS BY STABLE ID
========================================== */

function indexed(v) {

  const result = new Map();

  for (const r of list(v)) {

    need(
      typeof r.id === "string" &&
      r.id.length > 0 &&
      !result.has(r.id),

      "INVALID_OR_DUPLICATE_RECORD_ID"
    );

    result.set(r.id, r);

  }

  return result;

}


/* ==========================================
   FINANCIAL RETENTION COMPARISON
   READ ONLY
========================================== */

function compare(older, newer) {

  need(
    obj(older) && obj(newer),
    "INVALID_USERS"
  );

  const result = {

    mode: "RETENTION_READ_ONLY",

    oldAccounts:
      Object.keys(older).length,

    currentAccounts:
      Object.keys(newer).length,

    missing: 0,

    changed: 0,

    pendingTransitions: 0,

    mutableChanges: 0,

    invalidAccounts: 0,

    currentAccountsWithRecords: 0,

    bySource: {},

    activationAllowed: false

  };

  const ids = new Set([
    ...Object.keys(older),
    ...Object.keys(newer)
  ]);

  for (const uid of ids) {

    const a = Object.hasOwn(older, uid)
      ? older[uid]
      : undefined;

    const b = Object.hasOwn(newer, uid)
      ? newer[uid]
      : undefined;

    try {

      if (a !== undefined) {
        inventory(a);
      }

      if (
        b !== undefined &&
        Object.values(inventory(b))
          .some(n => n > 0)
      ) {
        result.currentAccountsWithRecords++;
      }


      /* BUILD FINANCIAL INDEXES */

      const groups = [

        ...MAPS,

        ...OTHER_MAPS,

        ...LISTS

      ].map(f => {

        const build = u =>
          LISTS.includes(f)

            ? indexed(get(u, f))

            : new Map(map(get(u, f)));

        return [
          f,
          build(a),
          build(b)
        ];

      });


      /* COMPARE EXISTING RECORDS */

      for (const [f, before, after] of groups) {

        const c = result.bySource[f] ||= {

          missing: 0,

          changed: 0,

          pendingTransitions: 0,

          mutableChanges: 0

        };

        for (const [id, r] of before) {

          let kind;

          if (!after.has(id)) {

            kind = "missing";

          } else if (!equal(r, after.get(id))) {

            const n = after.get(id);

            if (OTHER_MAPS.includes(f)) {

              kind = "mutableChanges";

            } else if (

              f === "transferRequests" &&

              r.status === "pending" &&

              ["approved", "rejected"]
                .includes(n.status) &&

              [
                "id",
                "fromUid",
                "toUid",
                "amount",
                "createdAt"
              ].every(k => r[k] === n[k])

            ) {

              kind = "pendingTransitions";

            } else {

              kind = "changed";

            }

          }

          if (kind) {

            c[kind]++;

            result[kind]++;

          }

        }

      }

    } catch {

      result.invalidAccounts++;

    }

  }

  result.partial =
    result.invalidAccounts > 0;

  return result;

}


/* ==========================================
   SECURE READ ONLY DATABASE ACCESS
========================================== */

function readUsers(file) {

  const fd = fs.openSync(

    file,

    fs.constants.O_RDONLY |
    fs.constants.O_NOFOLLOW |
    fs.constants.O_NONBLOCK

  );

  try {

    const st = fs.fstatSync(fd);

    need(

      st.isFile() &&

      st.size > 0 &&

      st.size <= 64 * 1024 * 1024,

      "INVALID_USERS_FILE"

    );

    const raw = fs.readFileSync(fd);

    need(
      raw.length === st.size,
      "USERS_SOURCE_CHANGED"
    );

    const users = JSON.parse(
      raw.toString("utf8")
    );

    need(
      obj(users),
      "INVALID_USERS"
    );

    return users;

  } finally {

    fs.closeSync(fd);

  }

}


/* ==========================================
   RECEIPT RETENTION TEST
   SYNTHETIC DATA ONLY
========================================== */

function test() {

  const assert =
    require("node:assert/strict");

  const a = {

    A: {

      profile: {

        coins: 0,

        linkedGiftReceipts: {
          x: { amount: 5 }
        }

      },

      transferRequests: [{

        id: "t1",

        fromUid: "A",

        toUid: "B",

        amount: 5,

        createdAt: 1,

        status: "pending"

      }]

    },

    B: {
      profile: { coins: 0 }
    }

  };

  const b = structuredClone(a);


  /* PROTECT ACCOUNT WITH RECEIPTS */

  assert.equal(
    deletionIssues(a.A).length,
    1
  );

  assert.equal(
    deletionIssues(a.B).length,
    0
  );


  /* INVALID RECEIPT CONTAINER */

  assert.equal(

    deletionIssues({
      profile: {
        linkedGiftReceipts: null
      }
    }).length,

    1

  );


  /* DETECT STATE TRANSITION */

  b.A.transferRequests[0].status =
    "approved";

  assert.equal(
    compare(a, b).pendingTransitions,
    1
  );


  /* DETECT MODIFIED RECEIPT */

  b.A.profile.linkedGiftReceipts.x.amount++;

  assert.equal(
    compare(a, b).changed,
    1
  );


  /* DETECT MISSING FINANCIAL RECORDS */

  delete b.A;

  assert.equal(
    compare(a, b).missing,
    2
  );

  assert.equal(
    compare(a, b).partial,
    false
  );


  /* DUPLICATE RECORD DETECTION */

  assert.equal(

    compare(a, {

      A: {

        profile: {},

        transferRequests: [
          { id: "t" },
          { id: "t" }
        ]

      }

    }).partial,

    true

  );

  console.log(
    "[RECEIPT RETENTION TEST] PASS"
  );

}


/* ==========================================
   MODULE EXPORTS
========================================== */

module.exports = {

  deletionIssues,

  compare,

  readUsers

};


/* ==========================================
   COMMAND LINE TOOLS
========================================== */

if (require.main === module) {

  if (

    process.argv[2] === "test" &&

    process.argv.length === 3

  ) {

    test();

  } else {

    console.error(
      "Usage: node wallet-receipt-retention.js test"
    );

    process.exitCode = 1;

  }

}