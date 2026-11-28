"use strict";

/* ==========================================
   LIVESTREAM PRO
   INDEPENDENT FINANCIAL RECEIPT ARCHIVE V1.8B
   FINANCIAL EVIDENCE ONLY
========================================== */

const crypto = require("node:crypto");
const assert = require("node:assert/strict");

const MAGIC = Buffer.from("LSPRA18");
const LIMIT = 32 * 1024 * 1024;
const HEX = /^[a-f0-9]{64}$/;

const obj = v =>
  v !== null &&
  typeof v === "object" &&
  !Array.isArray(v);

const sha = v =>
  crypto.createHash("sha256")
    .update(v)
    .digest("hex");

const need = (ok, code) => {
  if (!ok) throw new Error(code);
};


/* ==========================================
   FINANCIAL DATA MINIMIZATION
========================================== */

const FIELDS = new Set([

  "id",
  "requestId",
  "uid",
  "fromUid",
  "toUid",
  "targetUid",
  "adminUid",
  "buyerUid",
  "sellerUid",

  "amount",
  "diamonds",
  "coins",
  "quantity",
  "unitCost",
  "price",
  "total",
  "escrow",

  "reward",
  "profit",
  "totalBet",
  "totalWin",
  "roundId",
  "roundKey",

  "kind",
  "status",
  "source",
  "game",
  "action",
  "direction",
  "giftId",
  "type",
  "beastId",
  "fingerprint",
  "invoice",

  "ts",
  "at",
  "createdAt",
  "completedAt",
  "processedAt",
  "expiresAt",
  "creditedAt",

  "lastCycle",
  "totalEarned",
  "engineState"

]);


function project(record) {

  need(obj(record), "INVALID_SOURCE_RECORD");

  const out = Object.fromEntries(

    Object.entries(record).filter(([k, v]) =>

      FIELDS.has(k) &&

      (
        typeof v === "string" && v.length <= 256 ||
        Number.isSafeInteger(v) ||
        typeof v === "boolean" ||
        v === null
      )

    )

  );

  if (obj(record.resolution)) {

    out.resolution = Object.fromEntries(

      Object.entries(record.resolution)
        .filter(([k, v]) =>

          ["evidenceId", "amount", "at"].includes(k) &&

          (
            typeof v === "string" && v.length <= 128 ||
            Number.isSafeInteger(v)
          )

        )

    );

  }

  return out;

}


/* ==========================================
   VERIFIED BACKUP RECEIPT INVENTORY
========================================== */

function collect(snapshot) {

  need(

    snapshot?.scope === "JSON_ONLY" &&

    Array.isArray(snapshot.files),

    "JSON_BACKUP_REQUIRED"

  );

  const files = new Map(

    snapshot.files.map(f => [f.name, f])

  );

  const sourceHashes = {};
  const rows = [];
  const counts = {};


  function read(name) {

    const f = files.get(name);

    if (!f) {

      sourceHashes[name] = null;

      return undefined;

    }

    const raw = Buffer.from(
      f.content,
      "base64"
    );

    need(

      sha(raw) === f.sha256 &&

      raw.length === f.size,

      "SOURCE_HASH_MISMATCH"

    );

    sourceHashes[name] = f.sha256;

    return JSON.parse(raw.toString("utf8"));

  }


  /* FINANCIAL RECORD COLLECTOR */

  function add(source, owner, key, r) {

    const data = project(r);

    rows.push([

      source,

      owner,

      String(key),

      sha(JSON.stringify(r)),

      data

    ]);

    counts[source] =
      (counts[source] || 0) + 1;

  }


  function map(source, owner, v) {

    if (v === undefined) return;

    need(obj(v), "INVALID_MAP:" + source);

    for (const [k, r] of Object.entries(v)) {

      add(source, owner, k, r);

    }

  }


  function list(source, owner, v) {

    if (v === undefined) return;

    need(Array.isArray(v), "INVALID_LIST:" + source);

    v.forEach((r, i) =>
      add(source, owner, i, r)
    );

  }


  /* ======================================
     ACCOUNT FINANCIAL RECEIPTS
  ====================================== */

  const users = read("users.json");

  need(obj(users), "INVALID_USERS");

  for (const [uid, u] of Object.entries(users)) {

    need(
      obj(u) && obj(u.profile),
      "INVALID_ACCOUNT"
    );


    /* ACCOUNT LEVEL RECEIPTS */

    for (const f of [

      "lspAdminWalletReceipts",
      "lspWalletReceipts",
      "socialGiftReceipts",
      "marketWalletReceipts",
      "spiritPurchaseReceipts",
      "spiritRewardReceipts",
      "gameRewardReceipts"

    ]) {

      map(f, uid, u[f]);

    }


    /* PROFILE LEVEL RECEIPTS */

    for (const f of [

      "creditedPaymentInvoices",
      "linkedGiftReceipts",
      "sfuGiftReceipts"

    ]) {

      map("profile." + f, uid, u.profile[f]);

    }


    /* ACCOUNT FINANCIAL HISTORY */

    for (const f of [

      "withdrawRefundRecords",
      "transferRequests",
      "transferHistory",
      "spiritBeasts",
      "dtpHistory",
      "timeRaceHistory"

    ]) {

      list(f, uid, u[f]);

    }


    /* PROFILE FINANCIAL HISTORY */

    for (const f of [

      "withdrawHold",
      "liveGiftHistory",
      "depositLogs"

    ]) {

      list("profile." + f, uid, u.profile[f]);

    }


    /* LEGACY FINANCIAL RECORDS */

    for (const f of [

      "wheel8DoubleOffer",
      "lspMarketPending"

    ]) {

      if (u[f] !== undefined) {

        add(f, uid, "record", u[f]);

      }

    }


    /* EXISTING GAME FINANCIAL EVIDENCE */

    if (u.gameWalletLedgerV16 !== undefined) {

      need(

        u.gameWalletLedgerV16?.version === 1 &&

        obj(u.gameWalletLedgerV16.entries),

        "INVALID_LEDGER"

      );

      map(

        "gameWalletLedgerV16.entries",

        uid,

        u.gameWalletLedgerV16.entries

      );

    }

  }


  /* ======================================
     EXTERNAL FINANCIAL DATABASES
  ====================================== */

  list(
    "withdraw_requests.json",
    "",
    read("withdraw_requests.json")
  );

  map(
    "lsp_pg_orders.json",
    "",
    read("lsp_pg_orders.json")
  );


  /* MARKET ORDER RECORDS */

  const market = read("market_booths.json");

  if (market !== undefined) {

    need(obj(market), "INVALID_MARKET");

    for (const [id, b] of Object.entries(market)) {

      if (b === null) continue;

      need(obj(b), "INVALID_BOOTH");

      list(
        "market_booths.json.orders",
        id,
        b.orders
      );

    }

  }


  /* HISTORICAL EVIDENCE */

  const wheel = read("wheel8_user_history.json");

  if (wheel !== undefined) {

    need(obj(wheel), "INVALID_WHEEL_HISTORY");

    for (const [uid, v] of Object.entries(wheel)) {

      list("wheel8_user_history.json", uid, v);

    }

  }


  /* ACCOUNT DELETION RECORDS */

  for (const name of [...files.keys()].sort()) {

    if (
      /^account-deletion-requests\/[a-f0-9]{64}\.json$/
        .test(name)
    ) {

      add(
        "deletion_record",
        "",
        name,
        read(name)
      );

    }

  }


  /* DETERMINISTIC RECORD ORDER */

  rows.sort((a, b) => {

    for (let i = 0; i < 3; i++) {

      if (a[i] < b[i]) return -1;

      if (a[i] > b[i]) return 1;

    }

    return 0;

  });


  return {

    version: 18,

    mode: "EVIDENCE_PROJECTION_ONLY",

    snapshotCreatedAt: snapshot.createdAt,

    sourceHashes,

    deletionDirectoryPresent:
      snapshot.deletionDirectoryPresent,

    accounts: Object.keys(users).length,

    counts,

    rows

  };

}


/* ==========================================
   AES-256-GCM ARCHIVE ENCRYPTION
========================================== */

function encode(doc, key) {

  const raw = Buffer.from(
    JSON.stringify(doc)
  );

  need(
    raw.length <= LIMIT,
    "ARCHIVE_TOO_LARGE"
  );

  const iv = crypto.randomBytes(12);

  const c = crypto.createCipheriv(
    "aes-256-gcm",
    key,
    iv
  );

  c.setAAD(MAGIC);

  const encrypted = Buffer.concat([

    c.update(raw),

    c.final()

  ]);

  return {

    id: sha(raw),

    bytes: Buffer.concat([

      MAGIC,

      iv,

      c.getAuthTag(),

      encrypted

    ])

  };

}


/* ==========================================
   AUTHENTICATED ARCHIVE DECRYPTION
========================================== */

function decode(bytes, key, id) {

  need(

    Buffer.isBuffer(bytes) &&

    bytes.length >= MAGIC.length + 28 &&

    bytes.length <= LIMIT + MAGIC.length + 28 &&

    bytes.subarray(0, MAGIC.length).equals(MAGIC),

    "INVALID_ARCHIVE"

  );

  let offset = MAGIC.length;

  const d = crypto.createDecipheriv(

    "aes-256-gcm",

    key,

    bytes.subarray(offset, offset + 12)

  );

  d.setAAD(MAGIC);

  offset += 12;

  d.setAuthTag(
    bytes.subarray(offset, offset + 16)
  );

  offset += 16;


  const raw = Buffer.concat([

    d.update(bytes.subarray(offset)),

    d.final()

  ]);

  need(
    sha(raw) === id,
    "ARCHIVE_ID_MISMATCH"
  );

  const doc = JSON.parse(
    raw.toString("utf8")
  );

  need(

    doc.version === 18 &&

    doc.mode === "EVIDENCE_PROJECTION_ONLY" &&

    Array.isArray(doc.rows),

    "INVALID_ARCHIVE_DOCUMENT"

  );

  return doc;

}


/* ==========================================
   ARCHIVE VERIFICATION REPORT
========================================== */

function report(doc, id, bytes) {

  return {

    mode: doc.mode,

    archiveId: id,

    cipherSha256: sha(bytes),

    accounts: doc.accounts,

    records: doc.rows.length,

    counts: doc.counts,

    missingSources:

      Object.keys(doc.sourceHashes)

        .filter(k => doc.sourceHashes[k] === null),

    snapshotCreatedAt:

      new Date(
        doc.snapshotCreatedAt
      ).toISOString(),

    archiveVerified: true,

    activationAllowed: false

  };

}


/* ==========================================
   DETERMINISTIC ARCHIVE OBJECT ID
========================================== */

function objectKey(id) {

  need(

    typeof id === "string" && HEX.test(id),

    "INVALID_ARCHIVE_ID"

  );

  return (

    "livestreampro/receipt-evidence-v18/" +

    id +

    ".lspra"

  );

}


/* ==========================================
   CREATE AND VERIFY INDEPENDENT ARCHIVE
========================================== */

async function create(snapshot, key, store) {

  const doc = collect(snapshot);

  const { id, bytes } = encode(doc, key);

  await store.putIfAbsent(
    objectKey(id),
    bytes
  );


  /* DOWNLOAD THE ACTUAL REMOTE OBJECT */

  const actual = await store.get(
    objectKey(id)
  );

  const readback = decode(actual, key, id);

  need(

    JSON.stringify(readback) ===
      JSON.stringify(doc),

    "READBACK_MISMATCH"

  );

  return report(readback, id, actual);

}


/* ==========================================
   INDEPENDENT ARCHIVE RECOVERY VERIFICATION
========================================== */

async function verify(id, digest, key, store) {

  need(

    typeof digest === "string" &&

    HEX.test(digest),

    "EXPECTED_CIPHER_SHA256_REQUIRED"

  );

  const bytes = await store.get(
    objectKey(id)
  );

  need(

    sha(bytes) === digest,

    "CIPHER_SHA256_MISMATCH"

  );

  return report(

    decode(bytes, key, id),

    id,

    bytes

  );

}


/* ==========================================
   CLOUDFLARE R2 RECEIPT ARCHIVE
========================================== */

function config() {

  const e = process.env;

  const secret =
    e.LSP_RECEIPT_ARCHIVE_KEY || "";

  const account =
    e.LSP_R2_BACKUP_ACCOUNT_ID || "";

  const bucket =
    e.LSP_R2_RECEIPT_ARCHIVE_BUCKET || "";

  const accessKeyId =
    e.LSP_R2_RECEIPT_ARCHIVE_ACCESS_KEY_ID || "";

  const secretAccessKey =
    e.LSP_R2_RECEIPT_ARCHIVE_SECRET_ACCESS_KEY || "";


  /* VALIDATE INDEPENDENT CONFIGURATION */

  need(

    HEX.test(secret) &&

    secret.toLowerCase() !==
      String(e.LSP_DATABASE_BACKUP_KEY || "")
        .toLowerCase() &&

    /^[a-f0-9]{32}$/i.test(account) &&

    /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/
      .test(bucket) &&

    bucket !== e.LSP_R2_BACKUP_BUCKET &&

    accessKeyId &&

    secretAccessKey,

    "ARCHIVE_CONFIG_INVALID"

  );


  const {

    S3Client,

    PutObjectCommand,

    GetObjectCommand

  } = require("@aws-sdk/client-s3");


  const client = new S3Client({

    region: "auto",

    endpoint:
      `https://${account}.r2.cloudflarestorage.com`,

    credentials: {

      accessKeyId,

      secretAccessKey

    },

    forcePathStyle: true,

    maxAttempts: 2,

    requestChecksumCalculation:
      "WHEN_REQUIRED",

    responseChecksumValidation:
      "WHEN_REQUIRED"

  });


  return {

    key: Buffer.from(secret, "hex"),

    close: () => client.destroy(),

    store: {

      /* ==================================
         WRITE WITHOUT OVERWRITING
      ================================== */

      async putIfAbsent(Key, Body) {

        try {

          await client.send(

            new PutObjectCommand({

              Bucket: bucket,

              Key,

              Body,

              ContentLength: Body.length,

              ContentType:
                "application/octet-stream",

              IfNoneMatch: "*"

            }),

            {

              abortSignal:
                AbortSignal.timeout(30000)

            }

          );

        } catch (e) {

          const status =
            e.$metadata?.httpStatusCode;

          if (

            status !== 412 &&

            !(

              status === 409 &&

              [e.name, e.Code]
                .includes("ObjectLockedByBucketPolicy")

            )

          ) {

            throw e;

          }

        }

      },


      /* ==================================
         BOUNDED REMOTE READBACK
      ================================== */

      async get(Key) {

        const signal =
          AbortSignal.timeout(30000);

        const r = await client.send(

          new GetObjectCommand({

            Bucket: bucket,

            Key

          }),

          { abortSignal: signal }

        );

        const chunks = [];

        let size = 0;

        const abort = () =>
          r.Body?.destroy?.();

        signal.addEventListener(

          "abort",

          abort,

          { once: true }

        );

        try {

          need(

            !signal.aborted &&

            Number.isSafeInteger(r.ContentLength) &&

            r.ContentLength >= MAGIC.length + 28 &&

            r.ContentLength <= LIMIT + MAGIC.length + 28,

            "INVALID_REMOTE_SIZE"

          );

          for await (const chunk of r.Body) {

            need(
              !signal.aborted,
              "READBACK_TIMEOUT"
            );

            size += chunk.length;

            need(

              size <= r.ContentLength,

              "INVALID_REMOTE_SIZE"

            );

            chunks.push(Buffer.from(chunk));

          }

          need(

            !signal.aborted &&

            size === r.ContentLength,

            "INVALID_REMOTE_SIZE"

          );

          return Buffer.concat(chunks, size);

        } finally {

          signal.removeEventListener(
            "abort",
            abort
          );

          abort();

        }

      }

    }

  };

}


/* ==========================================
   RECEIPT ARCHIVE TEST
   SYNTHETIC DATA ONLY
========================================== */

async function test() {

  const key = crypto.randomBytes(32);

  const objects = new Map();


  /* SIMULATED REMOTE STORAGE */

  const store = {

    async putIfAbsent(k, b) {

      if (!objects.has(k)) {

        objects.set(k, Buffer.from(b));

      }

    },

    async get(k) {

      need(objects.has(k), "NOT_FOUND");

      return Buffer.from(objects.get(k));

    }

  };


  const raw = Buffer.from(JSON.stringify({

    A: {

      profile: {

        coins: 99,

        linkedGiftReceipts: {

          r1: {

            id: "r1",

            amount: 5,

            fromUid: "A",

            toUid: "B",

            name: "PRIVATE",

            bankAccount: "SECRET"

          }

        }

      },

      wheel8DoubleOffer: {

        status: "completed",

        reward: 3

      }

    }

  }));


  const snapshot = {

    scope: "JSON_ONLY",

    createdAt: 1,

    deletionDirectoryPresent: false,

    files: [{

      name: "users.json",

      size: raw.length,

      sha256: sha(raw),

      content: raw.toString("base64")

    }]

  };


  /* ARCHIVE CREATION */

  const first = await create(
    snapshot,
    key,
    store
  );


  /* DUPLICATE ARCHIVE PROTECTION */

  const retry = await create(
    snapshot,
    key,
    store
  );

  assert.deepEqual(first, retry);

  assert.equal(objects.size, 1);

  assert.equal(first.records, 2);


  /* PRIVATE DATA MINIMIZATION */

  const doc = decode(

    await store.get(
      objectKey(first.archiveId)
    ),

    key,

    first.archiveId

  );

  assert.equal(

    JSON.stringify(doc).includes("SECRET"),

    false

  );

  assert.equal(

    JSON.stringify(doc).includes("PRIVATE"),

    false

  );


  /* INDEPENDENT VERIFICATION */

  assert.deepEqual(

    await verify(

      first.archiveId,

      first.cipherSha256,

      key,

      store

    ),

    first

  );


  /* WRONG KEY REJECTION */

  await assert.rejects(() =>

    verify(

      first.archiveId,

      first.cipherSha256,

      crypto.randomBytes(32),

      store

    )

  );


  /* TAMPERED ARCHIVE REJECTION */

  const b = objects.get(
    objectKey(first.archiveId)
  );

  b[b.length - 1] ^= 1;

  await assert.rejects(

    () => verify(

      first.archiveId,

      first.cipherSha256,

      key,

      store

    ),

    /CIPHER_SHA256_MISMATCH/

  );


  /* REJECT CONFLICTING REMOTE CONTENT */

  await assert.rejects(() =>

    create(snapshot, key, store)

  );

  console.log(
    "[RECEIPT ARCHIVE TEST] PASS"
  );

}


module.exports = {

  create,

  verify,

  config

};


if (require.main === module) {

  if (

    process.argv[2] === "test" &&

    process.argv.length === 3

  ) {

    test().catch(e => {

      console.error(e.message);

      process.exitCode = 1;

    });

  } else {

    console.error("Usage: test");

    process.exitCode = 1;

  }

}