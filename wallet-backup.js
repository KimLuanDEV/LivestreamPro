"use strict";

/* ==========================================
   LIVESTREAM PRO
   SQLITE DATABASE BACKUP V2.0
   INDEPENDENT TEST MODE
========================================== */

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const zlib = require("node:zlib");
const assert = require("node:assert/strict");

const {
  DatabaseSync,
  backup
} = require("node:sqlite");

const {
  openWallet
} = require("./wallet-engine");


/* ==========================================
   BACKUP CONFIGURATION
========================================== */

const DB = "wallet-test.sqlite";

const BAK = "wallet-test.lspbak";

const MAGIC = Buffer.from("LSPW2TEST");

const MAX = 32 * 1024 * 1024;

const LIMIT = 2 * MAX;

const hash = b => crypto
  .createHash("sha256")
  .update(b)
  .digest("hex");


/* ==========================================
   PRIVATE DIRECTORY PROTECTION
========================================== */

function rootCheck(dir) {

  const root = fs.realpathSync(dir);
  const st = fs.statSync(root);

  if (

    path.dirname(root) !==
      fs.realpathSync(os.tmpdir()) ||

    !path.basename(root)
      .startsWith("lsp-wallet-backup-") ||

    !st.isDirectory() ||

    (st.mode & 0o077)

  ) {

    throw new Error(
      "PRIVATE_TEST_DIRECTORY_REQUIRED"
    );

  }

  return root;

}


/* ==========================================
   SECURE FILE READING
========================================== */

function readPrivate(file, limit) {

  const st = fs.lstatSync(file);

  if (

    !st.isFile() ||

    (st.mode & 0o077) ||

    st.size > limit

  ) {

    throw new Error(
      "UNSAFE_FILE_OR_SIZE"
    );

  }

  const b = fs.readFileSync(file);

  if (!b.length || b.length > limit) {

    throw new Error("INVALID_SIZE");

  }

  return b;

}


/* ==========================================
   DURABLE FILE WRITING
========================================== */

function writePrivate(file, data) {

  const fd = fs.openSync(
    file,
    "wx",
    0o600
  );

  try {

    fs.writeFileSync(fd, data);

    fs.fsyncSync(fd);

  } finally {

    fs.closeSync(fd);

  }

}


function syncDir(dir) {

  const fd = fs.openSync(dir, "r");

  try {

    fs.fsyncSync(fd);

  } finally {

    fs.closeSync(fd);

  }

}


/* ==========================================
   WALLET INTEGRITY & RECONCILIATION
========================================== */

/* ==========================================
   LIVESTREAM PRO
   WALLET BACKUP RECONCILIATION V2.1
========================================== */

function reconcile(file) {

  const wallet = openWallet(file);

  let report;


  /* ======================================
     WALLET LEDGER VERIFICATION
  ====================================== */

  try {

    report = wallet.reconcile();

  } finally {

    wallet.close();

  }


  /* ======================================
     LEGACY RECEIPT VERIFICATION
  ====================================== */

  const db = new DatabaseSync(file, {

    readOnly: true

  });


  try {

    const meta = db.prepare(

      "SELECT value FROM wallet_meta " +

      "WHERE key=?"

    );


    const migration = meta.get(

      "migration_source_sha256"

    );


    const manifest = meta.get(

      "legacy_receipt_manifest_v1"

    );


    /* CHECK LEGACY RECEIPT TABLES */

    const tables = db.prepare(

      "SELECT COUNT(*) AS n " +

      "FROM sqlite_schema " +

      "WHERE type='table' " +

      "AND name IN (" +

      "'legacy_admin_receipts'," +

      "'legacy_admin_receipt_sources'," +

      "'legacy_payment_receipts'" +

      ")"

    ).get().n;


    /* MIGRATED WALLET PROTECTION */

    if (

      migration ||

      manifest ||

      tables

    ) {

      if (

        !migration ||

        !manifest ||

        tables !== 3

      ) {

        throw new Error(

          "INCOMPLETE_LEGACY_RECEIPTS"

        );

      }


      /* VERIFY LEGACY RECEIPT INTEGRITY */

      require("./wallet-storage-adapter")

        .verifyLegacy(db);

    }


    return report;


  } finally {

    db.close();

  }

}

/* ==========================================
   AES-256-GCM BACKUP ENCRYPTION
========================================== */

function encode(raw, key) {

  if (!raw.length || raw.length > MAX) {

    throw new Error("INVALID_SIZE");

  }


  const manifest = {

    version: 2,

    mode: "ENGINE_TEST_V1",

    createdAt: Date.now(),

    size: raw.length,

    sha256: hash(raw),

    content: raw.toString("base64")

  };


  /* GZIP COMPRESSION */

  const compressed = zlib.gzipSync(

    Buffer.from(
      JSON.stringify(manifest)
    )

  );


  /* RANDOM INITIALIZATION VECTOR */

  const iv = crypto.randomBytes(12);


  const cipher = crypto.createCipheriv(

    "aes-256-gcm",

    key,

    iv

  );


  cipher.setAAD(MAGIC);


  const encrypted = Buffer.concat([

    cipher.update(compressed),

    cipher.final()

  ]);


  const out = Buffer.concat([

    MAGIC,

    iv,

    cipher.getAuthTag(),

    encrypted

  ]);


  if (out.length > LIMIT) {

    throw new Error("BACKUP_TOO_LARGE");

  }

  return out;

}


/* ==========================================
   BACKUP DECRYPTION & VALIDATION
========================================== */

function decode(blob, key) {

  const n = MAGIC.length;

  if (

    blob.length <= n + 28 ||

    blob.length > LIMIT ||

    !blob.subarray(0, n).equals(MAGIC)

  ) {

    throw new Error("INVALID_BACKUP");

  }


  const d = crypto.createDecipheriv(

    "aes-256-gcm",

    key,

    blob.subarray(n, n + 12)

  );


  d.setAAD(MAGIC);

  d.setAuthTag(

    blob.subarray(n + 12, n + 28)

  );


  const compressed = Buffer.concat([

    d.update(blob.subarray(n + 28)),

    d.final()

  ]);


  /* DECOMPRESSION SIZE PROTECTION */

  const m = JSON.parse(

    zlib.gunzipSync(compressed, {

      maxOutputLength: LIMIT

    }).toString("utf8")

  );


  /* VALIDATE BACKUP MANIFEST */

  if (

    m.version !== 2 ||

    m.mode !== "ENGINE_TEST_V1" ||

    !Number.isSafeInteger(m.createdAt) ||

    m.createdAt <= 0 ||

    !Number.isSafeInteger(m.size) ||

    m.size <= 0 ||

    m.size > MAX ||

    typeof m.content !== "string"

  ) {

    throw new Error("INVALID_MANIFEST");

  }


  const raw = Buffer.from(
    m.content,
    "base64"
  );


  /* SHA-256 INTEGRITY CHECK */

  if (

    raw.length !== m.size ||

    hash(raw) !== m.sha256

  ) {

    throw new Error(
      "CHECKSUM_MISMATCH"
    );

  }

  return raw;

}


/* ==========================================
   VERIFY ENCRYPTED BACKUP
========================================== */

function verify(root, blob, key) {

  const raw = decode(blob, key);

  const work = fs.mkdtempSync(

    path.join(root, ".verify-")

  );


  try {

    const file = path.join(work, DB);

    writePrivate(file, raw);

    return {

      raw,

      report: reconcile(file)

    };

  } finally {

    fs.rmSync(work, {

      recursive: true,

      force: true

    });

  }

}


/* ==========================================
   SQLITE ONLINE BACKUP ENGINE
========================================== */

async function create(root, key) {

  const source = path.join(root, DB);

  readPrivate(source, MAX);


  const work = fs.mkdtempSync(

    path.join(root, ".snapshot-")

  );


  try {

    const snapshot = path.join(work, DB);


    /* OPEN SOURCE DATABASE READ-ONLY */

    const db = new DatabaseSync(source, {

      readOnly: true

    });


    try {

      await backup(db, snapshot);

    } finally {

      db.close();

    }


    fs.chmodSync(snapshot, 0o600);


    /* READ CONSISTENT SQLITE SNAPSHOT */

    const raw = readPrivate(
      snapshot,
      MAX
    );


    /* ENCRYPT BACKUP */

    const blob = encode(raw, key);


    /* VERIFY BEFORE PUBLICATION */

    const { report } = verify(

      root,

      blob,

      key

    );


    const temp = path.join(work, BAK);

    writePrivate(temp, blob);


    /* ATOMIC BACKUP PUBLICATION
       NEVER OVERWRITE EXISTING BACKUP */

    fs.linkSync(

      temp,

      path.join(root, BAK)

    );


    syncDir(root);

    return report;


  } finally {

    fs.rmSync(work, {

      recursive: true,

      force: true

    });

  }

}


/* ==========================================
   SQLITE RECOVERY ENGINE
========================================== */

function restore(root, key) {

  const { raw, report } = verify(

    root,

    readPrivate(

      path.join(root, BAK),

      LIMIT

    ),

    key

  );


  /* RESTORE TO NEW DIRECTORY ONLY */

  const dest = path.join(

    root,

    "restored"

  );


  fs.mkdirSync(dest, {

    mode: 0o700

  });


  try {

    const file = path.join(dest, DB);

    writePrivate(file, raw);


    /* VERIFY RESTORED DATABASE */

    reconcile(file);


    syncDir(dest);

    syncDir(root);

    return report;


  } catch (error) {

    fs.rmSync(dest, {

      recursive: true,

      force: true

    });

    throw error;

  }

}


/* ==========================================
   INITIALIZE TEST FIXTURES
========================================== */

function init(root) {

  const wallet = openWallet(

    path.join(root, DB),

    {

      fixtures: [

        {

          uid: "test-A",

          coins: 1000,

          coin_received: 0,

          coin_sent: 0,

          coin_deposit: 0

        }

      ]

    }

  );


  try {

    const op = {

      actor: "test-admin",

      requestId: crypto.randomUUID(),

      reason: "test-credit",

      changes: [

        {

          uid: "test-A",

          delta: {

            coins: 250,

            coin_deposit: 250

          }

        }

      ]

    };


    wallet.commit(op);

    return op;

  } finally {

    wallet.close();

  }

}


/* ==========================================
   AUTOMATIC BACKUP SELF-TEST
========================================== */

async function selfTest() {

  const root = rootCheck(

    fs.mkdtempSync(

      path.join(

        os.tmpdir(),

        "lsp-wallet-backup-"

      )

    )

  );


  const key = crypto.randomBytes(32);


  try {

    const op = init(root);

    const source = path.join(root, DB);

    const before = hash(

      readPrivate(source, MAX)

    );


    const expected = {

      ok: true,

      accounts: 1,

      transactions: 1,

      entries: 1

    };


    /* CREATE BACKUP */

    assert.deepEqual(

      await create(root, key),

      expected

    );


    const blob = readPrivate(

      path.join(root, BAK),

      LIMIT

    );


    /* VERIFY BACKUP */

    assert.deepEqual(

      verify(root, blob, key).report,

      expected

    );


    /* RESTORE BACKUP */

    assert.deepEqual(

      restore(root, key),

      expected

    );


    /* VERIFY RESTORED REQUEST ID */

    const wallet = openWallet(

      path.join(root, "restored", DB)

    );


    try {

      assert.equal(

        wallet.commit(op).duplicate,

        true

      );

      assert.equal(

        wallet.getBalance("test-A").coins,

        1250

      );

    } finally {

      wallet.close();

    }


    /* DETECT CORRUPTED BACKUP */

    const corrupt = Buffer.from(blob);

    corrupt[corrupt.length - 1] ^= 1;


    assert.throws(

      () => verify(root, corrupt, key)

    );


    /* REJECT INVALID ENCRYPTION KEY */

    assert.throws(

      () => verify(

        root,

        blob,

        crypto.randomBytes(32)

      )

    );


    /* PREVENT BACKUP OVERWRITE */

    await assert.rejects(

      () => create(root, key),

      /EEXIST/

    );


    /* PREVENT RESTORE OVERWRITE */

    assert.throws(

      () => restore(root, key),

      /EEXIST/

    );


    /* VERIFY SOURCE WAS NOT MODIFIED */

    assert.equal(

      hash(readPrivate(source, MAX)),

      before

    );


    /* DETECT INCONSISTENT LEDGER */

    const db = new DatabaseSync(source);


    try {

      db.exec(

        "UPDATE wallet_accounts " +

        "SET coins=999 " +

        "WHERE uid='test-A'"

      );

    } finally {

      db.close();

    }


    await assert.rejects(

      () => create(root, key),

      /BALANCE_MISMATCH/

    );


    console.log(

      "[WALLET BACKUP TEST] PASS",

      expected

    );


  } finally {

    fs.rmSync(root, {

      recursive: true,

      force: true

    });

  }

}


/* ==========================================
   COMMAND LINE INTERFACE
========================================== */

async function main() {

  const [cmd, dir, ...extra] =

    process.argv.slice(2);


  if (

    cmd === "test" &&

    !dir &&

    !extra.length

  ) {

    return selfTest();

  }


  if (

    !dir ||

    extra.length ||

    ![

      "init",

      "create",

      "verify",

      "restore"

    ].includes(cmd)

  ) {

    throw new Error(

      "Usage: node wallet-backup.js test | " +

      "init/create/verify/restore " +

      "PRIVATE_TEST_DIRECTORY"

    );

  }


  const root = rootCheck(dir);


  if (cmd === "init") {

    init(root);

    console.log(

      "[WALLET BACKUP] TEST FIXTURE READY"

    );

    return;

  }


  /* TEST BACKUP ENCRYPTION KEY */

  const hex =

    process.env.LSP_WALLET_TEST_BACKUP_KEY ||

    "";


  if (!/^[a-f0-9]{64}$/i.test(hex)) {

    throw new Error(

      "INVALID_TEST_BACKUP_KEY"

    );

  }


  const key = Buffer.from(hex, "hex");


  const result =

    cmd === "create"

      ? await create(root, key)

      : cmd === "restore"

        ? restore(root, key)

        : verify(

            root,

            readPrivate(

              path.join(root, BAK),

              LIMIT

            ),

            key

          ).report;


  console.log(

    "[WALLET BACKUP]",

    cmd.toUpperCase(),

    result

  );

}


/* ==========================================
   START COMMAND LINE ENGINE
========================================== */

main().catch(error => {

  console.error(

    "[WALLET BACKUP] FAILED",

    error.message

  );

  process.exitCode = 1;

});