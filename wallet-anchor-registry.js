"use strict";

/* ==========================================
   LIVESTREAM PRO
   INDEPENDENT ANCHOR REGISTRY V1.12
   READ ONLY RECOVERY VERIFICATION
========================================== */

const fs = require("node:fs");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");

const archive = require("./wallet-receipt-archive");

const hex = x =>
  typeof x === "string" &&
  /^[a-f0-9]{64}$/.test(x);

const sha = x => crypto
  .createHash("sha256")
  .update(x)
  .digest("hex");

const hash = x =>
  sha(JSON.stringify(x));

const need = (ok, code) => {

  if (!ok) throw Error(code);

};

const timeOK = x =>
  Number.isSafeInteger(x) && x > 0;

const GENESIS = "0".repeat(64);

const MAX = 16 * 1024 * 1024;


/* ==========================================
   VERIFIED SNAPSHOT INSPECTION
========================================== */

function inspect(s) {

  need(

    s?.scope === "JSON_ONLY" &&

    timeOK(s.createdAt) &&

    Array.isArray(s.files) &&

    typeof s.deletionDirectoryPresent === "boolean",

    "INVALID_SNAPSHOT"

  );


  const seen = new Set();
  const manifest = [];
  const deleted = [];

  let users;

  let ambiguous = 0;


  for (const f of s.files) {

    need(

      typeof f.name === "string" &&

      !seen.has(f.name),

      "DUPLICATE_SOURCE"

    );


    seen.add(f.name);


    const raw = Buffer.from(
      f.content,
      "base64"
    );


    need(

      raw.length === f.size &&

      sha(raw) === f.sha256,

      "SOURCE_HASH_MISMATCH"

    );


    manifest.push([

      f.name,

      f.size,

      f.sha256

    ]);


    /* READ USER INVENTORY */

    if (f.name === "users.json") {

      users = JSON.parse(raw);

    }


    /* INDEPENDENT TOMBSTONE INVENTORY */

    if (

      f.name.startsWith(
        "account-deletion-requests/"
      )

    ) {

      const r = JSON.parse(raw);


      need(

        typeof r.uid === "string" &&

        r.uid &&

        typeof r.requestId === "string" &&

        r.requestId &&

        f.name ===

          `account-deletion-requests/${sha(r.uid)}.json`,

        "INVALID_TOMBSTONE"

      );


      if (

        r.status === "completed" ||

        r.engineState === "local_done"

      ) {

        deleted.push([

          sha(r.uid),

          hash([r.uid, r.requestId])

        ]);

      } else {

        ambiguous++;

      }

    }

  }


  need(

    users &&

    typeof users === "object" &&

    !Array.isArray(users),

    "INVALID_USERS"

  );


  manifest.sort((a, b) =>

    a[0] < b[0]

      ? -1

      : a[0] > b[0]

        ? 1

        : 0

  );


  deleted.sort(

    (a, b) => a[0].localeCompare(b[0])

  );


  const userHashes = new Set(

    Object.keys(users).map(sha)

  );


  need(

    !deleted.some(
      ([u]) => userHashes.has(u)
    ),

    "DELETED_UID_PRESENT"

  );


  return {

    manifestSha256: hash([

      s.createdAt,

      s.deletionDirectoryPresent,

      manifest

    ]),

    deleted,

    userHashes,

    ambiguous,

    deletionDirectoryPresent:
      s.deletionDirectoryPresent

  };

}


/* ==========================================
   VERIFY INDEPENDENT ANCHOR CHAIN
========================================== */

function verifyChain(registry, expectedHead) {

  need(

    hex(expectedHead) &&

    registry?.version === 12 &&

    Array.isArray(registry.entries) &&

    registry.entries.length > 0 &&

    registry.entries.length <= 10000,

    "INVALID_REGISTRY"

  );


  let prev = GENESIS;

  let lastTime = 0;

  let old = new Map();


  for (

    const [i, e] of registry.entries.entries()

  ) {

    need(

      e &&

      e.seq === i + 1 &&

      e.previous === prev &&

      timeOK(e.snapshotCreatedAt) &&

      e.snapshotCreatedAt > lastTime &&

      hex(e.archiveId) &&

      hex(e.cipherSha256) &&

      hex(e.manifestSha256) &&

      Array.isArray(e.tombstones),

      "BROKEN_ANCHOR_CHAIN"

    );


    const next = new Map();


    for (const t of e.tombstones) {

      need(

        Array.isArray(t) &&

        t.length === 2 &&

        t.every(hex) &&

        !next.has(t[0]),

        "INVALID_TOMBSTONE_INDEX"

      );


      next.set(t[0], t[1]);

    }


    /* PREVENT TOMBSTONE REGRESSION */

    for (const [u, r] of old) {

      need(

        next.get(u) === r,

        "TOMBSTONE_CHAIN_REGRESSION"

      );

    }


    old = next;

    prev = hash(e);

    lastTime = e.snapshotCreatedAt;

  }


  /* EXTERNAL TRUSTED HEAD REQUIRED */

  need(

    registry.head === prev &&

    expectedHead === prev,

    "TRUSTED_HEAD_MISMATCH"

  );


  return registry.entries.at(-1);

}


/* ==========================================
   SECURE REGISTRY FILE READER
========================================== */

function readRegistry(file, expectedHead) {

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

      st.size <= MAX,

      "UNSAFE_REGISTRY_FILE"

    );


    const raw = fs.readFileSync(fd);

    const end = fs.fstatSync(fd);


    need(

      raw.length === st.size &&

      end.size === st.size &&

      end.mtimeMs === st.mtimeMs &&

      end.ctimeMs === st.ctimeMs,

      "REGISTRY_CHANGED"

    );


    const r = JSON.parse(raw);


    verifyChain(r, expectedHead);


    return r;


  } finally {

    fs.closeSync(fd);

  }

}


/* ==========================================
   PROPOSE NEXT INDEPENDENT ANCHOR
========================================== */

async function propose(

  s,

  id,

  digest,

  ctx,

  previous = null,

  expectedHead = null

) {

  const current = inspect(s);


  need(

    current.deletionDirectoryPresent,

    "DELETION_DIRECTORY_REQUIRED"

  );


  const last = previous

    ? verifyChain(previous, expectedHead)

    : null;


  /* VERIFY PREVIOUS ANCHOR */

  if (last) {

    need(

      s.createdAt > last.snapshotCreatedAt,

      "NON_INCREASING_SNAPSHOT"

    );


    const next = new Map(current.deleted);


    for (const [u, r] of last.tombstones) {

      need(

        next.get(u) === r &&

        !current.userHashes.has(u),

        "TOMBSTONE_CHAIN_REGRESSION"

      );

    }


    await archive.verify(

      last.archiveId,

      last.cipherSha256,

      ctx.key,

      ctx.store

    );

  }


  /* VERIFY CURRENT ARCHIVE FROM R2 */

  const a = await archive.auditRecovery(

    s,

    id,

    digest,

    ctx.key,

    ctx.store

  );


  need(

    a.anchorVerified &&

    a.anchorSnapshotCreatedAt === s.createdAt &&

    a.anchorOnly === 0 &&

    a.candidateOnly === 0 &&

    a.sourceHashDifferences.length === 0 &&

    a.anchorDeletionDirectoryPresent &&

    a.resurrected === 0 &&

    a.missingTombstones === 0,

    "ARCHIVE_NOT_EXACT_SNAPSHOT"

  );


  /* ======================================
     CREATE NEXT CHAIN ENTRY
  ====================================== */

  const e = {

    seq: last ? last.seq + 1 : 1,

    previous: last
      ? expectedHead
      : GENESIS,

    snapshotCreatedAt:
      s.createdAt,

    archiveId: id,

    cipherSha256: digest,

    manifestSha256:
      current.manifestSha256,

    tombstones:
      current.deleted

  };


  const r = {

    version: 12,

    entries: [

      ...(previous?.entries ?? []),

      e

    ],

    head: hash(e)

  };


  /* FINAL CHAIN VERIFICATION */

  verifyChain(r, r.head);


  need(

    Buffer.byteLength(

      JSON.stringify(r, null, 2)

    ) <= MAX,

    "REGISTRY_TOO_LARGE"

  );


  return r;

}


/* ==========================================
   TRUSTED HEAD RECOVERY AUDIT
========================================== */

async function audit(

  s,

  registry,

  expectedHead,

  ctx

) {

  const last = verifyChain(

    registry,

    expectedHead

  );


  const current = inspect(s);


  const a = await archive.auditRecovery(

    s,

    last.archiveId,

    last.cipherSha256,

    ctx.key,

    ctx.store

  );


  need(

    a.anchorVerified &&

    a.anchorSnapshotCreatedAt ===
      last.snapshotCreatedAt,

    "ANCHOR_TIME_MISMATCH"

  );


  const next = new Map(current.deleted);


  /* DETECT ACCOUNT RESURRECTION */

  const resurrected = last.tombstones.filter(

    ([u]) => current.userHashes.has(u)

  ).length;


  /* DETECT MISSING DELETION RECORDS */

  const missing = last.tombstones.filter(

    ([u, r]) => next.get(u) !== r

  ).length;


  /* FULL SNAPSHOT MANIFEST COMPARISON */

  const exact =

    current.manifestSha256 ===
      last.manifestSha256 &&

    s.createdAt ===
      last.snapshotCreatedAt &&

    a.anchorOnly === 0 &&

    a.candidateOnly === 0 &&

    a.sourceHashDifferences.length === 0 &&

    current.deletionDirectoryPresent &&

    a.anchorDeletionDirectoryPresent &&

    resurrected === 0 &&

    missing === 0;


  return {

    mode:
      "TRUSTED_HEAD_AUDIT_READ_ONLY",

    chainVerified: true,

    trustedHead: expectedHead,

    sequence: last.seq,

    anchorSnapshotCreatedAt:

      new Date(
        last.snapshotCreatedAt
      ).toISOString(),

    candidateSnapshotCreatedAt:

      new Date(
        s.createdAt
      ).toISOString(),

    olderThanTrustedHead:

      s.createdAt < last.snapshotCreatedAt,

    matchesTrustedHead: exact,

    anchoredTombstones:
      last.tombstones.length,

    resurrected,

    missingTombstones:
      missing,

    ambiguousDeletionRecords:
      current.ambiguous,

    anchorAudit: a,

    latestProductionAnchorCertified: false,

    replayAllowed: false,

    activationAllowed: false

  };

}


module.exports = {

  propose,

  audit,

  readRegistry

};


/* ==========================================
   SYNTHETIC REGRESSION TEST
========================================== */

async function test() {

  const key = crypto.randomBytes(32);

  const map = new Map();


  const ctx = {

    key,

    store: {

      async putIfAbsent(k, b) {

        if (!map.has(k)) map.set(k, b);

      },

      async get(k) {

        return map.get(k);

      }

    }

  };


  const file = (name, v) => {

    const raw = Buffer.from(
      JSON.stringify(v)
    );

    return {

      name,

      size: raw.length,

      sha256: sha(raw),

      content: raw.toString("base64")

    };

  };


  const snap = (t, deleted) => ({

    scope: "JSON_ONLY",

    createdAt: t,

    deletionDirectoryPresent: true,

    files: [

      file(

        "users.json",

        deleted

          ? {A: {profile: {coins: 0}}}

          : {

              A: {profile: {coins: 0}},

              B: {profile: {coins: 0}}

            }

      ),

      ...(deleted

        ? [

            file(

              `account-deletion-requests/${sha("B")}.json`,

              {

                uid: "B",

                requestId: "r1",

                status: "completed"

              }

            )

          ]

        : []

      )

    ]

  });


  const s1 = snap(1, false);

  const s2 = snap(2, true);


  const a1 = await archive.create(

    s1, key, ctx.store

  );


  const a2 = await archive.create(

    s2, key, ctx.store

  );


  /* CREATE GENESIS ANCHOR */

  const r1 = await propose(

    s1,

    a1.archiveId,

    a1.cipherSha256,

    ctx

  );


  /* EXTEND ANCHOR CHAIN */

  const r2 = await propose(

    s2,

    a2.archiveId,

    a2.cipherSha256,

    ctx,

    r1,

    r1.head

  );


  assert.equal(

    (await audit(s2, r2, r2.head, ctx))
      .matchesTrustedHead,

    true

  );


  /* DETECT OLDER BACKUP */

  const older = await audit(

    s1, r2, r2.head, ctx

  );


  assert.equal(
    older.olderThanTrustedHead,
    true
  );

  assert.equal(
    older.resurrected,
    1
  );

  assert.equal(
    older.missingTombstones,
    1
  );


  /* DETECT TRUNCATED REGISTRY */

  await assert.rejects(

    audit(s1, r1, r2.head, ctx),

    /TRUSTED_HEAD_MISMATCH/

  );


  /* DETECT MODIFIED HISTORY */

  const altered = structuredClone(r2);

  altered.entries[0].manifestSha256 =
    "a".repeat(64);


  await assert.rejects(

    audit(s2, altered, r2.head, ctx),

    /BROKEN_ANCHOR_CHAIN/

  );


  /* BLOCK OLDER ANCHOR APPEND */

  await assert.rejects(

    propose(

      s1,

      a1.archiveId,

      a1.cipherSha256,

      ctx,

      r2,

      r2.head

    ),

    /NON_INCREASING_SNAPSHOT/

  );


  /* BLOCK TOMBSTONE REGRESSION */

  const s3 = snap(3, false);

  const a3 = await archive.create(

    s3, key, ctx.store

  );


  await assert.rejects(

    propose(

      s3,

      a3.archiveId,

      a3.cipherSha256,

      ctx,

      r2,

      r2.head

    ),

    /TOMBSTONE_CHAIN_REGRESSION/

  );


  console.log(

    "[ANCHOR REGISTRY V1.12 TEST] PASS"

  );

}


if (require.main === module) {

  if (

    process.argv.length !== 3 ||

    process.argv[2] !== "test"

  ) {

    process.exitCode = 1;

  } else {

    test().catch(e => {

      console.error(e.message);

      process.exitCode = 1;

    });

  }

}