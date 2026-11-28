"use strict";

/* ==========================================
   LIVESTREAM PRO
   FINANCIAL EVIDENCE REMEDIATION V1.14B
   READ ONLY - MANUAL RECONCILIATION
========================================== */

const crypto = require("node:crypto");
const assert = require("node:assert/strict");

const reconciliation = require(
  "./wallet-evidence-reconciliation"
);

const external = require(
  "./wallet-external-evidence"
);

const sha = x => crypto
  .createHash("sha256")
  .update(x)
  .digest("hex");

const hash = x =>
  sha(JSON.stringify(x));


/* ==========================================
   FINANCIAL REMEDIATION AUDIT
========================================== */

function run(s, manifestPath = null) {

  // Validate original snapshot sources.

  const e = reconciliation.run(s);

  const w = e.withdrawals;

  const packet = external.packet(s);

  const review = manifestPath

    ? external.check(packet, manifestPath)

    : null;


  const reviewed = new Map(

    (review?.rows ?? []).map(

      r => [r.caseRef, r]

    )

  );


  /* ORIGINAL FINANCIAL RECORDS */

  const read = name => JSON.parse(

    Buffer.from(

      s.files.find(
        f => f.name === name
      ).content,

      "base64"

    )

  );


  const users = read("users.json");

  const requests = read(
    "withdraw_requests.json"
  );


  /* ======================================
     SHARED HOLD CANDIDATE DETECTION
  ====================================== */

  const candidates = new Map();


  for (const c of packet.cases) {

    const uid =
      requests[c.requestIndex].uid;


    for (

      const h of new Set(c.holdHashes)

    ) {

      const key =
        JSON.stringify([uid, h]);


      if (!candidates.has(key)) {

        candidates.set(
          key,
          new Set()
        );

      }


      candidates.get(key)
        .add(c.caseRef);

    }

  }


  /* ======================================
     INDIVIDUAL FINANCIAL CASE REVIEW
  ====================================== */

  const rows = packet.cases.map(c => {

    const r =
      w.requestDetails[c.requestIndex];

    const original =
      requests[c.requestIndex];


    assert.equal(

      r.requestIndex,

      c.requestIndex,

      "CASE_INDEX_MISMATCH"

    );


    const linked = w.holdDetails.filter(

      h => h.request === r.request

    );


    const internalIssues = new Set([

      ...r.issues,

      ...linked.flatMap(h => h.issues)

    ]);


    const matchedHashes = [];


    /* VERIFY HOLD OWNERSHIP */

    for (const h of linked) {

      if (

        h.account !== r.account ||

        !c.accountPresent

      ) {

        internalIssues.add(
          "HOLD_OWNER_REVIEW_REQUIRED"
        );

        continue;

      }


      const rawHold =

        users[original.uid]
          .profile.withdrawHold?.[h.holdIndex];


      if (!rawHold) {

        internalIssues.add(
          "HOLD_SOURCE_NOT_FOUND"
        );

        continue;

      }


      matchedHashes.push(
        hash(rawHold)
      );

    }


    /* VERIFY EXACT EVIDENCE MATCH */

    if (

      linked.length !== 1 ||

      c.holdHashes.length !== 1 ||

      JSON.stringify(
        matchedHashes.sort()
      ) !==

      JSON.stringify(
        c.holdHashes
      )

    ) {

      internalIssues.add(

        "HOLD_LINK_NOT_UNIQUE_OR_PACKET_MISMATCH"

      );

    }


    /* DETECT SHARED HOLD CANDIDATES */

    if (

      c.holdHashes.some(h =>

        candidates.get(

          JSON.stringify([
            original.uid,
            h
          ])

        ).size > 1

      )

    ) {

      internalIssues.add(

        "HOLD_CANDIDATE_SHARED_ACROSS_CASES"

      );

    }


    /* REFUND HISTORY PROTECTION */

    if (r.refunds.length) {

      internalIssues.add(

        "REFUND_HISTORY_REVIEW_REQUIRED"

      );

    }


    /* ====================================
       EXTERNAL BANK EVIDENCE
    ==================================== */

    const bank =
      reviewed.get(c.caseRef);


    const bankIssues = bank

      ? [...bank.issues]

      : ["BANK_REVIEW_NOT_SUBMITTED"];


    if (

      bank?.outcome ===
        "BANK_NO_MATCH_REVIEWED"

    ) {

      bankIssues.push(

        "NO_MATCH_IS_NOT_PROOF_OF_NONPAYMENT"

      );

    }


    /* POSSIBLE DOUBLE SETTLEMENT */

    if (

      bank?.outcome ===
        "BANK_PAID_REVIEWED" &&

      r.refunds.length

    ) {

      bankIssues.push(

        "POSSIBLE_PAYMENT_AND_REFUND_CONFLICT"

      );

    }


    /* INDIVIDUAL REVIEW RESULT */

    return {

      caseRef:
        c.caseRef,

      request:
        r.request,

      requestSha256:
        c.requestSha256,

      holdHashes:
        c.holdHashes,

      createdAt:
        c.createdAt,

      amountDiamonds:
        c.amountDiamonds,

      status:
        c.status,

      holdLink:

        linked.length === 1

          ? linked[0].match

          : "UNRESOLVED",

      internalIssues:
        [...internalIssues],

      refundReceiptCount:
        r.refunds.length,

      bankOutcome:

        bank?.outcome ??
        "NOT_REVIEWED",

      bankIssues,

      nextAction:
        "MANUAL_RECONCILIATION_REQUIRED",

      settlementCertified:
        false

    };

  });


  /* ======================================
     FINAL REMEDIATION REPORT
  ====================================== */

  return {

    version: "1.14B",

    mode:
      "FINANCIAL_REMEDIATION_READ_ONLY",

    snapshotCreatedAt:
      e.snapshotCreatedAt,

    sourceHashes:
      e.sourceHashes,

    cases:
      rows.length,

    legacyCandidates:
      w.legacyCandidates,

    unmatchedHolds:
      w.unmatchedHolds,

    unmatchedHoldDetails:

      w.holdDetails.filter(

        h => h.match === "UNMATCHED"

      ),

    refundIssues:

      w.refundDetails.filter(

        f => f.issues.length

      ),

    bankReviewsSubmitted:

      review?.submittedReviews ?? 0,

    bankReviewsNotSubmitted:

      rows.length -
      (review?.submittedReviews ?? 0),

    casesWithInternalIssues:

      rows.filter(

        r => r.internalIssues.length

      ).length,

    reusedBankReferenceCases:

      rows.filter(r =>

        r.bankIssues.includes(
          "REUSED_BANK_REFERENCE"
        )

      ).length,

    rows,

    externalSettlementVerified:
      false,

    liabilityCertified:
      false,

    replayAllowed:
      false,

    activationAllowed:
      false

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


  const file = (name, v) => {

    const b = Buffer.from(
      JSON.stringify(v)
    );


    return {

      name,

      size: b.length,

      sha256: sha(b),

      content: b.toString("base64")

    };

  };


  const a = {

    id: "r1",

    uid: "A",

    amount: 10,

    createdAt: 1,

    status: "approved"

  };


  const b = {

    id: "r2",

    uid: "A",

    amount: 20,

    createdAt: 2,

    status: "processing"

  };


  const snap = (reqs, refunds = []) => ({

    scope: "JSON_ONLY",

    createdAt: 3,

    files: [

      file("users.json", {

        A: {

          profile: {

            withdrawHold: [

              {

                id: a.id,

                amount: a.amount,

                ts: a.createdAt,

                request: a

              },

              {

                amount: b.amount,

                ts: b.createdAt

              }

            ]

          },

          withdrawRefundRecords:
            refunds

        }

      }),

      file(
        "withdraw_requests.json",
        reqs
      )

    ]

  });


  const s = snap([a, b]);

  const before = JSON.stringify(s);

  const r = run(s);


  /* EXACT ID TEST */

  assert.equal(

    r.rows[0].holdLink,

    "EXACT_ID"

  );


  assert.equal(

    r.rows[0].internalIssues.length,

    0

  );


  /* LEGACY HOLD TEST */

  assert.equal(

    r.rows[1].holdLink,

    "LEGACY_CANDIDATE"

  );


  /* MISSING BANK REVIEW */

  assert.equal(

    r.bankReviewsNotSubmitted,

    2

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


  /* SHARED HOLD CANDIDATE TEST */

  const shared = run(

    snap([
      a,
      b,
      {...b, id: "r3"}
    ])

  );


  assert(

    shared.rows[1].internalIssues.includes(

      "HOLD_CANDIDATE_SHARED_ACROSS_CASES"

    )

  );


  /* REFUND STATUS CONFLICT TEST */

  const refunded = run(

    snap(

      [a, b],

      [{

        id: a.id,

        amount: 10,

        createdAt: 2

      }]

    )

  );


  assert(

    refunded.rows[0].internalIssues.includes(

      "REFUND_STATUS_CONFLICT"

    )

  );


  /* SOURCE INTEGRITY TEST */

  const bad = structuredClone(s);

  bad.files[0].sha256 =
    "0".repeat(64);


  assert.throws(

    () => run(bad),

    /SOURCE_HASH_MISMATCH/

  );


  console.log(

    "[FINANCIAL REMEDIATION V1.14B TEST] PASS"

  );

}