"use strict";

/* ==========================================
   LIVESTREAM PRO
   FINANCIAL SAFETY AUDIT V1.14A
   READ ONLY
========================================== */

const crypto = require("node:crypto");
const assert = require("node:assert/strict");

const guard = require("./wallet-activation-guard");

const evidence = require(
  "./wallet-evidence-reconciliation"
);

const sha = b => crypto
  .createHash("sha256")
  .update(b)
  .digest("hex");

const FIELDS = [

  "coins",
  "coinReceived",
  "coinSent",
  "coinDeposit"

];


/* ==========================================
   FINANCIAL SAFETY AUDIT
========================================== */

function run(snapshot, source, env = {}) {

  const e = evidence.run(snapshot);

  const w = e.withdrawals;


  /* VERIFIED USER DATABASE */

  const f = snapshot.files.find(

    x => x.name === "users.json"

  );


  const raw = Buffer.from(

    f.content,

    "base64"

  );


  assert.equal(

    sha(raw),

    f.sha256,

    "SOURCE_HASH_MISMATCH"

  );


  const users = JSON.parse(

    raw.toString("utf8")

  );


  /* ======================================
     BALANCE VALIDATION
  ====================================== */

  const balances = Object.fromEntries(

    FIELDS.map(k => [

      k,

      {

        invalid: 0,

        missing: 0,

        numericStrings: 0

      }

    ])

  );


  let accountsWithInvalidBalances = 0;


  for (const u of Object.values(users)) {

    let invalid = false;


    for (const k of FIELDS) {

      const x = u.profile[k];

      const b = balances[k];


      /* MISSING BALANCE FIELD */

      if (x === undefined) {

        b.missing++;

        if (k === "coins") {

          invalid = true;

        }

        continue;

      }


      /* LEGACY NUMERIC STRING */

      const str =

        typeof x === "string" &&

        /^\d+$/.test(x);


      const n = str

        ? Number(x)

        : x;


      if (str) {

        b.numericStrings++;

      }


      /* INVALID BALANCE */

      if (

        !Number.isSafeInteger(n) ||

        n < 0

      ) {

        b.invalid++;

        invalid = true;

      }

    }


    if (invalid) {

      accountsWithInvalidBalances++;

    }

  }


  /* ======================================
     FINANCIAL EVIDENCE ISSUE INVENTORY
  ====================================== */

  const counts = Object.create(null);


  for (const row of [

    ...w.holdDetails,

    ...w.requestDetails,

    ...w.refundDetails

  ]) {

    for (const issue of row.issues) {

      counts[issue] =

        (counts[issue] || 0) + 1;

    }

  }


  /* ======================================
     SOURCE CODE AUDIT
  ====================================== */

  const writers = guard.audit(source);


  /* ======================================
     MANUAL REMEDIATION ACTIONS
  ====================================== */

  const actions = [];


  if (accountsWithInvalidBalances) {

    actions.push(

      "REVIEW_INVALID_BALANCES"

    );

  }


  if (w.requests === null) {

    actions.push(

      "LOCATE_WITHDRAWAL_SOURCE"

    );

  }


  if (

    w.legacyCandidates ||

    w.missingHoldIds ||

    w.unmatchedHolds ||

    Object.keys(counts).length

  ) {

    actions.push(

      "REVIEW_WITHDRAWAL_EVIDENCE"

    );

  }


  if (w.requests !== 0) {

    actions.push(

      "RECONCILE_BANK_STATEMENTS"

    );

  }


  actions.push(

    "PRESERVE_EXISTING_RECORDS",

    "DISABLE_OUTCOME_MANIPULATION_AND_REVIEW_PLAYER_HARM"

  );


  /* ======================================
     FINAL FINANCIAL SAFETY REPORT
  ====================================== */

  return {

    version: "1.14A",

    mode: "FINANCIAL_SAFETY_READ_ONLY",

    snapshotCreatedAt:
      e.snapshotCreatedAt,


    sourceAudit: {

      sourceSha256:
        writers.sourceSha256,

      saveUsersReferences:
        writers.saveUsersReferences,

      adapterReferences:
        writers.adapterReferences,

      possibleBalanceAssignments:
        writers.possibleBalanceAssignments,

      snapshotModeInShell:

        env.LSP_USERS_SNAPSHOT_MODE ||
        "monitor",

      coverageCertified: false

    },


    accounts: e.accounts,

    balances,

    accountsWithInvalidBalances,


    withdrawals: {

      requests: w.requests,

      holds: w.holds,

      legacyCandidates:
        w.legacyCandidates,

      unmatchedHolds:
        w.unmatchedHolds,

      pendingRequests:
        w.pendingRequests,

      pendingRecordedDiamonds:
        w.pendingRecordedDiamonds,

      approvedWithoutExternalVerification:

        w.requests === null

          ? null

          : w.requestDetails.filter(

              r => r.status === "approved"

            ).length,

      issueOccurrences:
        counts

    },


    paymentSourcePresent:
      e.payments.sourcePresent,

    creditMarkers:
      e.payments.creditMarkers,


    actions,

    blockers: writers.blockers,


    externalSettlementVerified: false,

    liabilityCertified: false,

    replayAllowed: false,

    activationAllowed: false

  };

}


module.exports = {

  run

};


/* ==========================================
   SYNTHETIC REGRESSION TEST
========================================== */

if (require.main === module) {

  assert.equal(

    process.argv[2],

    "test"

  );


  const file = (name, value) => {

    const b = Buffer.from(

      JSON.stringify(value)

    );


    return {

      name,

      size: b.length,

      sha256: sha(b),

      content: b.toString("base64")

    };

  };


  const s = {

    scope: "JSON_ONLY",

    createdAt: 2,

    files: [

      file("users.json", {

        A: {

          profile: {

            coins: -1,

            coinReceived: "10",

            withdrawHold: [

              {

                amount: 10,

                ts: 1

              }

            ]

          }

        }

      }),


      file("withdraw_requests.json", [

        {

          id: "r1",

          uid: "A",

          amount: 10,

          createdAt: 1,

          status: "approved"

        }

      ])

    ]

  };


  const before = JSON.stringify(s);


  const r = run(s, "", {});


  /* NEGATIVE BALANCE DETECTION */

  assert.equal(

    r.accountsWithInvalidBalances,

    1

  );


  /* LEGACY NUMBER FORMAT */

  assert.equal(

    r.balances.coinReceived.numericStrings,

    1

  );


  /* LEGACY WITHDRAWAL EVIDENCE */

  assert.equal(

    r.withdrawals.legacyCandidates,

    1

  );


  /* UNVERIFIED BANK SETTLEMENT */

  assert.equal(

    r.withdrawals.approvedWithoutExternalVerification,

    1

  );


  /* ACTIVATION PROTECTION */

  assert.equal(

    r.activationAllowed,

    false

  );


  /* ORIGINAL DATA UNCHANGED */

  assert.equal(

    JSON.stringify(s),

    before

  );


  /* MISSING WITHDRAWAL SOURCE */

  const missing = run({

    ...s,

    files: s.files.slice(0, 1)

  }, "", {});


  assert.equal(

    missing.withdrawals.requests,

    null

  );


  assert.equal(

    missing.withdrawals.approvedWithoutExternalVerification,

    null

  );


  assert(

    missing.actions.includes(

      "LOCATE_WITHDRAWAL_SOURCE"

    )

  );


  console.log(

    "[FINANCIAL SAFETY V1.14A TEST] PASS"

  );

}