"use strict";

/* ==========================================
   LIVESTREAM PRO
   EXTERNAL FINANCIAL EVIDENCE V1.11A
   READ ONLY - MANUAL REVIEW
========================================== */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");


/* ==========================================
   VALIDATION HELPERS
========================================== */

const sha = x => crypto
  .createHash("sha256")
  .update(x)
  .digest("hex");

const hex = x =>
  typeof x === "string" &&
  /^[a-f0-9]{64}$/.test(x);

const obj = x =>
  x !== null &&
  typeof x === "object" &&
  !Array.isArray(x);

const text = x =>
  typeof x === "string" &&
  x.length > 0 &&
  x.length <= 256 &&
  x.trim() === x;

const pos = x =>
  Number.isSafeInteger(x) && x > 0;

const need = (ok, msg) => {

  if (!ok) throw Error(msg);

};

const digest = x =>
  sha(JSON.stringify(x));


/* ==========================================
   FINANCIAL EVIDENCE PACKET
========================================== */

function packet(s) {

  need(

    s?.scope === "JSON_ONLY" &&
    pos(s.createdAt) &&
    Array.isArray(s.files),

    "INVALID_SNAPSHOT"

  );


  const files = new Map(

    s.files.map(f => [f.name, f])

  );


  need(

    files.size === s.files.length,

    "DUPLICATE_SOURCE"

  );


  /* VERIFIED SOURCE FILES */

  function read(name) {

    const f = files.get(name);

    need(

      f,

      "MISSING_REQUIRED_SOURCE:" + name

    );


    const b = Buffer.from(

      f.content,

      "base64"

    );


    need(

      b.length === f.size &&
      sha(b) === f.sha256,

      "SOURCE_HASH_MISMATCH"

    );


    return JSON.parse(
      b.toString("utf8")
    );

  }


  const users = read("users.json");

  const requests = read(
    "withdraw_requests.json"
  );


  need(

    obj(users) &&
    Array.isArray(requests) &&
    requests.every(obj),

    "INVALID_SOURCE"

  );


  const ids = new Set();

  const cases = [];


  /* ======================================
     CREATE STABLE FINANCIAL CASE REFERENCE
  ====================================== */

  for (const r of requests) {

    need(

      text(r.id) &&
      !ids.has(r.id) &&
      text(r.uid) &&
      pos(r.amount) &&
      pos(r.createdAt),

      "INVALID_OR_DUPLICATE_REQUEST"

    );


    ids.add(r.id);


    const account =

      Object.hasOwn(users, r.uid)

        ? users[r.uid]

        : null;


    if (account) {

      need(

        obj(account) &&
        obj(account.profile),

        "INVALID_ACCOUNT"

      );

    }


    const hs =
      account?.profile.withdrawHold ?? [];


    need(

      Array.isArray(hs) &&
      hs.every(obj),

      "INVALID_HOLD_LIST"

    );


    /* IDENTIFY HOLD CANDIDATES */

    const linked = hs.filter(h =>

      h.id === r.id ||

      (

        (

          h.id === undefined ||
          h.id === null ||
          h.id === ""

        ) &&

        h.amount === r.amount &&

        (

          typeof h.ts === "string"

            ? Date.parse(h.ts)

            : h.ts

        ) === r.createdAt

      )

    );


    cases.push({

      caseRef:
        digest([r.uid, r.id]),

      requestSha256:
        digest(r),

      holdHashes:
        linked.map(digest).sort(),

      requestIndex:
        cases.length,

      createdAt:
        new Date(r.createdAt).toISOString(),

      amountDiamonds:
        r.amount,

      status:

        [
          "pending",
          "processing",
          "approved",
          "rejected"
        ].includes(r.status)

          ? r.status

          : "UNKNOWN",

      accountPresent:
        !!account

    });

  }


  return {

    mode:
      "EXTERNAL_EVIDENCE_PACKET_READ_ONLY",

    snapshotCreatedAt:
      new Date(s.createdAt).toISOString(),

    cases,

    externalSettlementVerified: false,

    liabilityCertified: false,

    replayAllowed: false,

    activationAllowed: false

  };

}


/* ==========================================
   SECURE PRIVATE EVIDENCE READER
========================================== */

function privateRead(file, limit) {

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

      st.uid === process.getuid() &&

      !(st.mode & 0o077) &&

      st.nlink === 1 &&

      st.size > 0 &&

      st.size <= limit,

      "UNSAFE_EVIDENCE_FILE"

    );


    const b = fs.readFileSync(fd);

    const end = fs.fstatSync(fd);


    need(

      b.length === st.size &&

      end.size === st.size &&

      end.mtimeMs === st.mtimeMs &&

      end.ctimeMs === st.ctimeMs,

      "EVIDENCE_CHANGED"

    );


    return b;


  } finally {

    fs.closeSync(fd);

  }

}


/* ==========================================
   EXTERNAL EVIDENCE MANIFEST VERIFICATION
========================================== */

function check(p, manifestPath) {

  const absolute =
    path.resolve(manifestPath);

  const dir =
    path.dirname(absolute);

  const st =
    fs.lstatSync(dir);


  need(

    fs.realpathSync(dir) === dir &&

    st.isDirectory() &&

    st.uid === process.getuid() &&

    !(st.mode & 0o077),

    "PRIVATE_REVIEW_DIRECTORY_REQUIRED"

  );


  const m = JSON.parse(

    privateRead(
      absolute,
      1024 * 1024
    ).toString("utf8")

  );


  need(

    m?.version === 1 &&

    Array.isArray(m.reviews) &&

    m.reviews.every(obj),

    "INVALID_REVIEW_MANIFEST"

  );


  const cases = new Map(

    p.cases.map(c => [c.caseRef, c])

  );


  const refs = new Set();

  const bankRefs = new Map();

  const rows = [];


  /* ======================================
     VERIFY INDIVIDUAL EVIDENCE REVIEW
  ====================================== */

  for (const r of m.reviews) {

    need(

      hex(r.caseRef) &&

      !refs.has(r.caseRef) &&

      cases.has(r.caseRef),

      "UNKNOWN_OR_DUPLICATE_CASE"

    );


    refs.add(r.caseRef);


    const c = cases.get(r.caseRef);

    const issues = [];


    /* DETECT STALE FINANCIAL EVIDENCE */

    if (

      r.requestSha256 !==
        c.requestSha256 ||

      JSON.stringify(r.holdHashes) !==
        JSON.stringify(c.holdHashes)

    ) {

      issues.push(
        "STALE_CASE_EVIDENCE"
      );

    }


    need(

      [

        "BANK_PAID_REVIEWED",

        "BANK_NO_MATCH_REVIEWED"

      ].includes(r.outcome),

      "INVALID_REVIEW_OUTCOME"

    );


    /* DOCUMENT INTEGRITY */

    need(

      typeof r.evidenceFile === "string" &&

      /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/
        .test(r.evidenceFile) &&

      hex(r.evidenceSha256),

      "INVALID_DOCUMENT_REFERENCE"

    );


    if (

      sha(

        privateRead(

          path.join(
            dir,
            r.evidenceFile
          ),

          32 * 1024 * 1024

        )

      ) !== r.evidenceSha256

    ) {

      issues.push(
        "DOCUMENT_HASH_MISMATCH"
      );

    }


    /* MANUAL REVIEW METADATA */

    if (

      !text(r.reviewer) ||

      !Number.isFinite(
        Date.parse(r.reviewedAt)
      )

    ) {

      issues.push(
        "REVIEW_METADATA_MISSING"
      );

    }


    /* ====================================
       BANK SETTLEMENT REVIEW
    ==================================== */

    if (r.outcome === "BANK_PAID_REVIEWED") {

      if (!hex(r.bankReferenceSha256)) {

        issues.push(
          "BANK_REFERENCE_MISSING"
        );

      } else {

        if (

          !bankRefs.has(
            r.bankReferenceSha256
          )

        ) {

          bankRefs.set(
            r.bankReferenceSha256,
            []
          );

        }


        bankRefs.get(

          r.bankReferenceSha256

        ).push(r.caseRef);

      }


      /* CHECK HISTORICAL PAYOUT AMOUNT */

      if (

        !pos(r.expectedVnd) ||

        !pos(r.observedVnd) ||

        r.expectedVnd !== r.observedVnd

      ) {

        issues.push(
          "VND_AMOUNT_NOT_MATCHED"
        );

      }


      /* REQUIRE MANUAL CHECKS */

      if (

        r.beneficiaryChecked !== true ||

        r.payoutTermsChecked !== true

      ) {

        issues.push(
          "MANUAL_CHECKS_MISSING"
        );

      }


      if (c.status !== "approved") {

        issues.push(
          "BANK_PAID_INTERNAL_STATUS_REVIEW"
        );

      }


    } else if (c.status === "approved") {

      issues.push(

        "APPROVED_WITHOUT_LOCATED_BANK_PAYMENT"

      );

    }


    rows.push({

      caseRef: r.caseRef,

      outcome: r.outcome,

      issues

    });

  }


  /* ======================================
     DUPLICATE SETTLEMENT DETECTION
  ====================================== */

  for (const group of bankRefs.values()) {

    if (group.length > 1) {

      for (const row of rows) {

        if (group.includes(row.caseRef)) {

          row.issues.push(
            "REUSED_BANK_REFERENCE"
          );

        }

      }

    }

  }


  /* ======================================
     FINAL REVIEW REPORT
  ====================================== */

  return {

    mode:
      "MANUAL_EVIDENCE_CHECK_READ_ONLY",

    cases: p.cases.length,

    submittedReviews: rows.length,

    notReviewed:
      p.cases.length - rows.length,

    reviewRowsWithoutDetectedIssues:

      rows.filter(
        r => !r.issues.length
      ).length,

    rows,

    externalSettlementVerified: false,

    liabilityCertified: false,

    replayAllowed: false,

    activationAllowed: false

  };

}


module.exports = {

  packet,

  check

};


/* ==========================================
   SYNTHETIC REGRESSION TEST
========================================== */

if (require.main === module) {

  need(

    process.argv[2] === "test",

    "Usage: test"

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


  const w = {

    id: "r1",

    uid: "A",

    amount: 10,

    createdAt: 1,

    status: "approved"

  };


  const s = {

    scope: "JSON_ONLY",

    createdAt: 2,

    files: [

      file("users.json", {

        A: {

          profile: {

            withdrawHold: [

              {
                amount: 10,
                ts: 1
              }

            ]

          }

        }

      }),

      file(

        "withdraw_requests.json",

        [
          w,
          {...w, id: "r2"}
        ]

      )

    ]

  };


  const p = packet(s);


  assert.equal(
    p.cases.length,
    2
  );


  assert.equal(
    p.cases[0].holdHashes.length,
    1
  );


  const dir = fs.mkdtempSync(

    path.join(

      require("node:os").tmpdir(),

      "lsp-external-test-"

    )

  );


  try {

    const doc = Buffer.from(

      "SYNTHETIC TEST DOCUMENT"

    );


    fs.writeFileSync(

      path.join(dir, "test.txt"),

      doc,

      {mode: 0o600}

    );


    const reviews = p.cases.map(c => ({

      caseRef: c.caseRef,

      requestSha256: c.requestSha256,

      holdHashes: c.holdHashes,

      outcome: "BANK_PAID_REVIEWED",

      evidenceFile: "test.txt",

      evidenceSha256: sha(doc),

      reviewer: "TEST",

      reviewedAt: "2026-01-01T00:00:00Z",

      bankReferenceSha256:
        sha("test-reference"),

      expectedVnd: 1000,

      observedVnd: 1000,

      beneficiaryChecked: true,

      payoutTermsChecked: true

    }));


    const f = path.join(
      dir,
      "reviews.json"
    );


    const save = () => fs.writeFileSync(

      f,

      JSON.stringify({

        version: 1,

        reviews

      }),

      {mode: 0o600}

    );


    save();


    /* DUPLICATE BANK REFERENCE TEST */

    assert(

      check(p, f).rows.every(r =>

        r.issues.includes(
          "REUSED_BANK_REFERENCE"
        )

      )

    );


    reviews.pop();

    save();


    assert.equal(

      check(p, f)
        .reviewRowsWithoutDetectedIssues,

      1

    );


    /* STALE EVIDENCE TEST */

    reviews[0].requestSha256 =
      sha("old");


    /* DOCUMENT INTEGRITY TEST */

    reviews[0].evidenceSha256 =
      sha("wrong");


    save();


    const r = check(p, f);


    assert(

      r.rows[0].issues.includes(
        "STALE_CASE_EVIDENCE"
      )

    );


    assert(

      r.rows[0].issues.includes(
        "DOCUMENT_HASH_MISMATCH"
      )

    );


    assert.equal(
      r.externalSettlementVerified,
      false
    );


    console.log(

      "[EXTERNAL EVIDENCE V1.11 TEST] PASS"

    );


  } finally {

    fs.rmSync(dir, {

      recursive: true,

      force: true

    });

  }

}