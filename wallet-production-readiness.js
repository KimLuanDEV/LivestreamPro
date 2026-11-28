"use strict";

/* ==========================================
   LIVESTREAM PRO
   PRODUCTION READINESS AUDIT V1.13
   READ ONLY - ACTIVATION BLOCKED
========================================== */

const guard = require("./wallet-activation-guard");
const evidence = require("./wallet-evidence-reconciliation");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");


function build(
  snapshot,
  source,
  anchor,
  queue,
  env,
  declared
) {

  /* SOURCE CODE AUDIT */

  const writers = guard.audit(source);

  /* FINANCIAL EVIDENCE AUDIT */

  const e = evidence.run(snapshot);

  const w = e.withdrawals;
  const p = e.payments;


  /* ======================================
     PAYMENT SOURCE CLASSIFICATION
  ====================================== */

  const config = [

    "SEPAY_PG_MERCHANT_ID",
    "SEPAY_PG_SECRET_KEY",
    "SEPAY_PG_IPN_SECRET"

  ].filter(k => Boolean(env[k])).length;


  const consistent =

    !p.sourcePresent &&
    p.creditMarkers === 0 &&
    config === 0;


  /* ======================================
     PRESERVE ALL ACTIVATION BLOCKERS
  ====================================== */

  const blockers = new Set(
    writers.blockers
  );


  blockers.add(
    "PLAYER_FAIRNESS_REVIEW_REQUIRED"
  );

  blockers.add(
    "EXTERNAL_SETTLEMENT_NOT_VERIFIED"
  );

  blockers.add(
    "PAYMENT_HISTORY_NOT_INDEPENDENTLY_VERIFIED"
  );


  /* LEGACY EVIDENCE */

  if (

    w.legacyCandidates ||
    w.missingHoldIds ||
    w.missingRequestIds ||
    w.missingTransferIds ||
    w.unmatchedHolds

  ) {

    blockers.add(
      "LEGACY_EVIDENCE_REVIEW_REQUIRED"
    );

  }


  /* WITHDRAWAL REVIEW */

  if (

    w.requests === null ||
    w.pendingRequests !== 0

  ) {

    blockers.add(
      "WITHDRAWAL_REVIEW_REQUIRED"
    );

  }


  /* INDEPENDENT ANCHOR */

  if (!anchor.matchesTrustedHead) {

    blockers.add(
      "CANDIDATE_NOT_AT_TRUSTED_HEAD"
    );

  }


  /* TOMBSTONE PROTECTION */

  if (

    anchor.resurrected ||
    anchor.missingTombstones ||
    anchor.ambiguousDeletionRecords

  ) {

    blockers.add(
      "TOMBSTONE_REVIEW_REQUIRED"
    );

  }


  /* ARCHIVE QUEUE */

  if (queue.pendingByMarker !== 0) {

    blockers.add(
      "ARCHIVE_QUEUE_REVIEW_REQUIRED"
    );

  }


  /* ======================================
     FINAL READINESS REPORT
  ====================================== */

  return {

    version: "1.13",

    mode:
      "PRODUCTION_READINESS_READ_ONLY",

    status: "BLOCKED",

    snapshotCreatedAt:
      e.snapshotCreatedAt,

    configuredStorageMode:

      env.LSP_WALLET_STORAGE_MODE ??
      "JSON_ONLY",


    /* SOURCE CODE AUDIT */

    sourceAudit: {

      sourceSha256:
        writers.sourceSha256,

      saveUsersReferences:
        writers.saveUsersReferences,

      adapterReferences:
        writers.adapterReferences,

      possibleBalanceAssignments:
        writers.possibleBalanceAssignments,

      coverageCertified: false

    },


    /* FINANCIAL AUDIT */

    financial: {

      accounts: e.accounts,

      requests: w.requests,

      holds: w.holds,

      legacyCandidates:
        w.legacyCandidates,

      exactMatches:
        w.exactMatches,

      unmatchedHolds:
        w.unmatchedHolds,

      missingHoldIds:
        w.missingHoldIds,

      missingRequestIds:
        w.missingRequestIds,

      missingTransferIds:
        w.missingTransferIds,

      refundReceipts:
        w.refundReceipts,

      pendingRequests:
        w.pendingRequests,

      pendingRecordedDiamonds:
        w.pendingRecordedDiamonds,

      approvedRecordedDiamonds:
        w.approvedRecordedDiamonds,

      requestRowsRequiringReview:

        w.requestDetails.filter(
          r => r.issues.length
        ).length,

      externalSettlementVerified:
        false,

      liabilityCertified:
        false

    },


    /* PAYMENT SOURCE */

    payments: {

      ownerDeclaredNeverUsed:
        declared === true,

      classification:

        declared && consistent

          ? "NEVER_USED_DECLARED_CONSISTENT_WITH_SNAPSHOT_AND_SHELL"

          : "REVIEW_REQUIRED",

      sourcePresent:
        p.sourcePresent,

      orders:
        p.orders,

      creditMarkers:
        p.creditMarkers,

      configuredKeyCountInShell:
        config,

      independentlyVerified:
        false

    },


    /* INDEPENDENT ANCHOR AUDIT */

    anchor: {

      chainVerified:
        anchor.chainVerified === true,

      matchesTrustedHead:
        anchor.matchesTrustedHead === true,

      olderThanTrustedHead:
        anchor.olderThanTrustedHead === true,

      sequence:
        anchor.sequence,

      anchoredTombstones:
        anchor.anchoredTombstones,

      resurrected:
        anchor.resurrected,

      missingTombstones:
        anchor.missingTombstones,

      ambiguousDeletionRecords:
        anchor.ambiguousDeletionRecords,

      latestProductionAnchorCertified:
        false

    },


    /* ARCHIVE QUEUE AUDIT */

    queue: {

      scope:
        "LOCAL_MARKER_SCAN_ONLY",

      pendingByMarker:
        queue.pendingByMarker,

      oldestPending:
        queue.oldestPending ?? null,

      allRemoteObjectsVerified:
        false

    },


    /* FINAL ACTIVATION PROTECTION */

    productionForwardRecoveryVerified:
      false,

    blockers:
      [...blockers],

    replayAllowed:
      false,

    activationAllowed:
      false

  };

}


module.exports = {

  build

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

      content: b.toString("base64"),

      sha256: crypto
        .createHash("sha256")
        .update(b)
        .digest("hex")

    };

  };


  const s = {

    scope: "JSON_ONLY",

    createdAt: 1,

    files: [

      file("users.json", {

        A: {
          profile: {
            coins: 0
          }
        }

      }),

      file(
        "withdraw_requests.json",
        []
      )

    ]

  };


  const a = {

    chainVerified: true,

    matchesTrustedHead: true,

    olderThanTrustedHead: false,

    sequence: 1,

    anchoredTombstones: 0,

    resurrected: 0,

    missingTombstones: 0,

    ambiguousDeletionRecords: 0

  };


  const q = {

    pendingByMarker: 0

  };


  const before =
    JSON.stringify(s);


  const r = build(
    s, "", a, q, {}, true
  );


  /* ACTIVATION MUST REMAIN BLOCKED */

  assert.equal(
    r.status,
    "BLOCKED"
  );

  assert.equal(
    r.activationAllowed,
    false
  );


  /* PAYMENT SOURCE TEST */

  assert.equal(
    r.payments.orders,
    null
  );

  assert.equal(

    r.payments.classification,

    "NEVER_USED_DECLARED_CONSISTENT_WITH_SNAPSHOT_AND_SHELL"

  );


  /* CONFLICTING PAYMENT CONFIGURATION */

  assert.equal(

    build(
      s,
      "",
      a,
      q,
      {
        SEPAY_PG_SECRET_KEY: "test"
      },
      true
    ).payments.classification,

    "REVIEW_REQUIRED"

  );


  /* TRUSTED HEAD MISMATCH */

  assert(

    build(
      s,
      "",
      {
        ...a,
        matchesTrustedHead: false
      },
      q,
      {},
      true
    ).blockers.includes(
      "CANDIDATE_NOT_AT_TRUSTED_HEAD"
    )

  );


  /* UNAVAILABLE ARCHIVE QUEUE */

  assert(

    build(
      s,
      "",
      a,
      {
        pendingByMarker: null
      },
      {},
      true
    ).blockers.includes(
      "ARCHIVE_QUEUE_REVIEW_REQUIRED"
    )

  );


  /* SOURCE MUST REMAIN UNCHANGED */

  assert.equal(

    JSON.stringify(s),

    before

  );


  console.log(

    "[PRODUCTION READINESS V1.13 TEST] PASS"

  );

}