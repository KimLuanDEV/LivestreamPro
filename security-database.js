"use strict";

/* ==========================================
   LIVESTREAM PRO
   DATABASE SECURITY & BACKUP V1.1
   RECOVERY & OFFSITE BACKUP
========================================== */

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");

const os = require("node:os");

const {
  execFileSync
} = require("node:child_process");

const { promisify } = require("util");

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

const DATA_DIR = "/opt/render/project/data";

const BACKUP_DIR = path.join(
  DATA_DIR,
  "security-backups"
);

const BACKUP_INTERVAL = 60 * 60 * 1000;

const MAX_HOURLY = 24;
const MAX_DAILY = 30;

const MAX_SOURCE_BYTES = 64 * 1024 * 1024;

const BACKUP_MAGIC = Buffer.from("LSPDB1");

const MAX_ENCRYPTED_BYTES =
  MAX_SOURCE_BYTES * 2;

const REQUIRED_FILES = [
  "users.json"
];

const BACKUP_FILES = [
  "users.json",
  "withdraw_requests.json",
  "lsp_pg_orders.json",
  "transfer_auto_settings.json",
  "market_booths.json",
  "inbox.json",
  "social_posts.json",
  "live_state.json",
  "wheel8_user_history.json",
  "wheel8_round_count.json",
  "wheel8_history.json",
  "dtp_round_count.json",
  "dtp_history.json",
  "time_race_round_count.json",
  "time_race_history.json"
];

const ARRAY_FILES = new Set([
  "withdraw_requests.json",
  "social_posts.json",
  "wheel8_history.json",
  "dtp_history.json",
  "time_race_history.json"
]);

let backupKey = null;
let backupTimer = null;
let backupRunning = false;

let lastManualBackup = 0;

const stats = {
  startedAt: Date.now(),
  lastBackupAt: null,
  lastBackupSize: 0,
  lastVerifiedAt: null,
  successfulBackups: 0,
  failedBackups: 0,
  integrityFailures: 0,
  lastError: null
};


/* ==========================================
   DATABASE ENCRYPTION KEY
========================================== */

function initializeKey() {

  const secret = String(
    process.env.LSP_DATABASE_BACKUP_KEY || ""
  );

  if (!/^[a-f0-9]{64}$/i.test(secret)) {

    throw new Error(
      "LSP_DATABASE_BACKUP_KEY must be 64 hexadecimal characters"
    );

  }

  backupKey = Buffer.from(secret, "hex");

}


/* ==========================================
   SHA-256 CHECKSUM
========================================== */

function checksum(buffer) {

  return crypto
    .createHash("sha256")
    .update(buffer)
    .digest("hex");

}


/* ==========================================
   VIETNAM DATE
========================================== */

function getVietnamDay() {

  return new Date(
    Date.now() + 7 * 60 * 60 * 1000
  ).toISOString().slice(0, 10);

}


/* ==========================================
   VALIDATE DATABASE
========================================== */

function validateJSON(filename, raw) {

  const data = JSON.parse(
    raw.toString("utf8")
  );

  if (ARRAY_FILES.has(filename)) {

    if (!Array.isArray(data)) {
      throw new Error(
        `Invalid array database: ${filename}`
      );
    }

  } else {

    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data)
    ) {

      throw new Error(
        `Invalid object database: ${filename}`
      );

    }

  }

  return data;

}


/* ==========================================
   CAPTURE DATABASE SNAPSHOT

   Synchronous capture prevents other callbacks
   in the same Node.js process from writing
   between these reads.
========================================== */
/* ==========================================
   LIVESTREAM PRO
   DATABASE SNAPSHOT ENGINE V2.1
========================================== */

const DELETION_DIR =
  "account-deletion-requests";

const DELETION_NAME =
  /^[a-f0-9]{64}\.json$/;

const DELETION_PATH =
  /^account-deletion-requests\/[a-f0-9]{64}\.json$/;

const SQLITE_PATH =
  "candidate/wallet-test.sqlite";

const MAX_DELETION_RECORDS = 10000;

const MAX_WALLET_BYTES =
  32 * 1024 * 1024;


/* ==========================================
   VALIDATE ACCOUNT DELETION RECORD
========================================== */

function validateDeletion(
  name,
  bytes,
  users
) {

  const r = validateJSON(name, bytes);

  if (

    typeof r.uid !== "string" ||

    !r.uid ||

    typeof r.requestId !== "string" ||

    !r.requestId ||

    !["pending", "completed"]
      .includes(r.status) ||

    name !== DELETION_DIR + "/" +

      checksum(Buffer.from(r.uid)) +

      ".json"

  ) {

    throw new Error(
      "INVALID_DELETION_RECORD"
    );

  }


  /* PREVENT DELETED ACCOUNT RESURRECTION */

  if (

    (

      r.status === "completed" ||

      r.engineState === "local_done"

    ) &&

    Object.hasOwn(users, r.uid)

  ) {

    throw new Error(
      "DELETED_UID_PRESENT"
    );

  }

  return r;

}


/* ==========================================
   CAPTURE DATABASE SNAPSHOT V2.1
========================================== */

function captureSnapshot(
  dataDir = DATA_DIR
) {

  const files = [];

  let totalBytes = 0;


  function capture(
    name,
    optional = false
  ) {

    const full = path.join(
      dataDir,
      name
    );

    let fd;


    try {

      fd = fs.openSync(

        full,

        fs.constants.O_RDONLY |
        fs.constants.O_NOFOLLOW

      );

    } catch (e) {

      if (

        optional &&

        e.code === "ENOENT"

      ) {

        return;

      }

      throw e;

    }


    try {

      const st = fs.fstatSync(fd);


      if (

        !st.isFile() ||

        totalBytes + st.size >
          MAX_SOURCE_BYTES

      ) {

        throw new Error(
          "INVALID_SOURCE_OR_SIZE"
        );

      }


      const raw = fs.readFileSync(fd);


      if (

        raw.length !== st.size ||

        totalBytes + raw.length >
          MAX_SOURCE_BYTES

      ) {

        throw new Error(
          "SOURCE_CHANGED_OR_TOO_LARGE"
        );

      }


      totalBytes += raw.length;


      validateJSON(name, raw);


      files.push({

        name,

        size: raw.length,

        sha256: checksum(raw),

        content:
          raw.toString("base64")

      });


    } finally {

      fs.closeSync(fd);

    }

  }


  /* CAPTURE STANDARD JSON DATABASES */

  for (const name of BACKUP_FILES) {

    capture(

      name,

      !REQUIRED_FILES.includes(name)

    );

  }


  /* ======================================
     ACCOUNT DELETION RECORDS
  ====================================== */

  const folder = path.join(

    dataDir,

    DELETION_DIR

  );


  let present = true;


  try {

    if (

      !fs.lstatSync(folder)
        .isDirectory()

    ) {

      throw new Error(
        "INVALID_DELETION_DIRECTORY"
      );

    }

  } catch (e) {

    if (e.code !== "ENOENT") {

      throw e;

    }

    present = false;

  }


  if (present) {

    const names = fs.readdirSync(folder)

      .filter(n => DELETION_NAME.test(n))

      .sort();


    if (

      names.length >
      MAX_DELETION_RECORDS

    ) {

      throw new Error(
        "TOO_MANY_DELETION_RECORDS"
      );

    }


    for (const name of names) {

      capture(
        DELETION_DIR + "/" + name
      );

    }

  }


  /* BUILD BACKUP MANIFEST */

  const snapshot = {

    version: "2.1.0",

    scope: "JSON_ONLY",

    createdAt: Date.now(),

    vietnamDay: getVietnamDay(),

    deletionDirectoryPresent: present,

    files

  };


  validateSnapshot(snapshot);


  return snapshot;

}


/* ==========================================
   BACKUP MANIFEST VALIDATION V2.1
   BACKWARD COMPATIBLE WITH V1
========================================== */

function validateSnapshot(snapshot) {

  const old =
    snapshot?.version === "1.0.0";

  const bundle =
    snapshot?.scope === "SQLITE_CANDIDATE";


  if (

    !snapshot ||

    (

      !old &&

      (

        snapshot.version !== "2.1.0" ||

        ![
          "JSON_ONLY",
          "SQLITE_CANDIDATE"
        ].includes(snapshot.scope) ||

        typeof snapshot
          .deletionDirectoryPresent !== "boolean"

      )

    ) ||

    (old && bundle) ||

    !Array.isArray(snapshot.files) ||

    !snapshot.files.length ||

    snapshot.files.length >

      BACKUP_FILES.length +
      MAX_DELETION_RECORDS + 1 ||

    !Number.isSafeInteger(
      snapshot.createdAt
    ) ||

    snapshot.createdAt <= 0

  ) {

    throw new Error(
      "INVALID_BACKUP_MANIFEST"
    );

  }


  const names = new Set();

  const deletions = [];

  let users;

  let total = 0;


  for (const item of snapshot.files) {

    const isDeletion =

      !old &&

      typeof item?.name === "string" &&

      DELETION_PATH.test(item.name);


    const isSQLite =

      !old &&

      bundle &&

      item?.name === SQLITE_PATH;


    if (

      !item ||

      typeof item.content !== "string" ||

      !Number.isSafeInteger(item.size) ||

      item.size < 0 ||

      !(

        BACKUP_FILES.includes(item.name) ||

        isDeletion ||

        isSQLite

      ) ||

      names.has(item.name)

    ) {

      throw new Error(
        "INVALID_BACKUP_ENTRY"
      );

    }


    names.add(item.name);

    total += item.size;


    if (total > MAX_SOURCE_BYTES) {

      throw new Error(
        "BACKUP_TOO_LARGE"
      );

    }


    const bytes = Buffer.from(

      item.content,

      "base64"

    );


    /* SHA-256 CHECKSUM VERIFICATION */

    if (

      bytes.length !== item.size ||

      checksum(bytes) !== item.sha256

    ) {

      throw new Error(
        "CHECKSUM_MISMATCH"
      );

    }


    /* SQLITE FORMAT VERIFICATION */

    if (isSQLite) {

      if (

        bytes.length > MAX_WALLET_BYTES ||

        !bytes.subarray(0, 16).equals(

          Buffer.from("SQLite format 3\0")

        )

      ) {

        throw new Error(
          "INVALID_SQLITE"
        );

      }


    } else {


      const value = validateJSON(

        item.name,

        bytes

      );


      if (item.name === "users.json") {

        users = value;

      }


      if (isDeletion) {

        deletions.push([

          item.name,

          bytes

        ]);

      }

    }

  }


  /* REQUIRED DATABASE PROTECTION */

  for (const name of REQUIRED_FILES) {

    if (!names.has(name)) {

      throw new Error(
        "REQUIRED_FILE_MISSING"
      );

    }

  }


  /* DELETION MANIFEST PROTECTION */

  if (

    deletions.length >
      MAX_DELETION_RECORDS ||

    (

      deletions.length &&

      !snapshot.deletionDirectoryPresent

    )

  ) {

    throw new Error(
      "INVALID_DELETION_MANIFEST"
    );

  }


  for (

    const [name, bytes] of deletions

  ) {

    validateDeletion(

      name,

      bytes,

      users

    );

  }


  /* SQLITE MIGRATION BUNDLE PROTECTION */

  if (

    bundle &&

    (

      !snapshot.deletionDirectoryPresent ||

      !names.has(SQLITE_PATH) ||

      !names.has("lsp_pg_orders.json")

    )

  ) {

    throw new Error(
      "INCOMPLETE_CANDIDATE_BUNDLE"
    );

  }


  return snapshot;

}


/* ==========================================
   LIVESTREAM PRO
   DATABASE RECOVERY ENGINE V2.1
========================================== */

async function extractSnapshot(

  snapshot,

  dest,

  alreadyCreated = false

) {


  /* CREATE PRIVATE RECOVERY DIRECTORY */

  if (!alreadyCreated) {

    await fsp.mkdir(dest, {

      mode: 0o700

    });

  }


  try {

    const dirs = [dest];


    /* RESTORE ACCOUNT DELETION RECORDS */

    if (snapshot.deletionDirectoryPresent) {

      const d = path.join(

        dest,

        DELETION_DIR

      );


      await fsp.mkdir(d, {

        mode: 0o700

      });


      dirs.push(d);

    }


    /* RESTORE SQLITE CANDIDATE */

    if (

      snapshot.scope ===
      "SQLITE_CANDIDATE"

    ) {

      const d = path.join(

        dest,

        "candidate"

      );


      await fsp.mkdir(d, {

        mode: 0o700

      });


      dirs.push(d);

    }


    /* RESTORE VERIFIED FILES */

    for (const item of snapshot.files) {

      const filename = path.join(

        dest,

        item.name

      );


      const handle = await fsp.open(

        filename,

        "wx",

        0o600

      );


      try {

        await handle.writeFile(

          Buffer.from(

            item.content,

            "base64"

          )

        );


        await handle.sync();


      } finally {

        await handle.close();

      }


      /* VERIFY RESTORED CHECKSUM */

      if (

        checksum(

          await fsp.readFile(filename)

        ) !== item.sha256

      ) {

        throw new Error(
          "EXTRACT_CHECKSUM_MISMATCH"
        );

      }

    }


    /* PERSIST DIRECTORY METADATA */

    const syncOrder = [

      ...dirs.reverse(),

      path.dirname(dest)

    ];


    for (const d of syncOrder) {

      const fd = await fsp.open(d, "r");


      try {

        await fd.sync();

      } finally {

        await fd.close();

      }

    }


  } catch (e) {

    await fsp.rm(dest, {

      recursive: true,

      force: true

    });


    throw e;

  }

}


/* ==========================================
   SQLITE MIGRATION CANDIDATE VERIFICATION
========================================== */

async function verifyCandidate(snapshot) {

  const root = fs.mkdtempSync(

    path.join(

      os.tmpdir(),

      "lsp-wallet-migration-"

    )

  );


  try {

    await extractSnapshot(

      snapshot,

      root,

      true

    );


    /* VERIFY BALANCES AND LEGACY RECEIPTS */

for (

  const script of [

    "wallet-migration.js",

    "wallet-legacy-receipts.js",

    "wallet-financial-receipts.js"

  ]

)
    {

      execFileSync(

        process.execPath,

        [

          path.join(__dirname, script),

          "verify",

          root

        ],

        {

          stdio: "ignore",

          timeout: 120000

        }

      );

    }


  } finally {

    fs.rmSync(root, {

      recursive: true,

      force: true

    });

  }

}


/* ==========================================
   INDEPENDENT TOMBSTONE VERIFICATION
========================================== */

function checkCurrentDeletionRecords(

  snapshot,

  trustedDir

) {

  if (!snapshot.deletionDirectoryPresent) {

    throw new Error(
      "BACKUP_HAS_NO_DELETION_DIRECTORY"
    );

  }


  const dir = fs.realpathSync(trustedDir);


  if (

    path.basename(dir) !== DELETION_DIR ||

    !fs.lstatSync(dir).isDirectory()

  ) {

    throw new Error(
      "TRUSTED_DELETION_DIRECTORY_REQUIRED"
    );

  }


  const names = fs.readdirSync(dir)

    .filter(n => DELETION_NAME.test(n))

    .sort();


  const archived = new Map(

    snapshot.files

      .filter(f => DELETION_PATH.test(f.name))

      .map(f => [

        path.basename(f.name),

        f.sha256

      ])

  );


  /* VERIFY DELETION RECORD COUNT */

  if (

    names.length !== archived.size ||

    names.length > MAX_DELETION_RECORDS

  ) {

    throw new Error(
      "DELETION_RECORD_SET_CHANGED"
    );

  }


  let total = 0;


  /* VERIFY EVERY DELETION RECORD */

  for (const name of names) {

    const fd = fs.openSync(

      path.join(dir, name),

      fs.constants.O_RDONLY |
      fs.constants.O_NOFOLLOW

    );


    try {

      const st = fs.fstatSync(fd);


      if (

        !st.isFile() ||

        total + st.size >
          MAX_SOURCE_BYTES

      ) {

        throw new Error(
          "UNSAFE_TRUSTED_RECORD"
        );

      }


      const raw = fs.readFileSync(fd);

      total += raw.length;


      if (

        raw.length !== st.size ||

        total > MAX_SOURCE_BYTES ||

        checksum(raw) !== archived.get(name)

      ) {

        throw new Error(
          "DELETION_RECORD_CHANGED"
        );

      }


    } finally {

      fs.closeSync(fd);

    }

  }


  console.log(

    "[RECOVERY] DELETION RECORDS MATCH; " +

    "activationAllowed=false"

  );

}


/* ==========================================
   SQLITE MIGRATION BACKUP BUNDLE V2.1
========================================== */

async function createCandidateBundle(dir) {

  const root = fs.realpathSync(dir);

  const st = fs.statSync(root);


  /* REQUIRE PRIVATE MIGRATION DIRECTORY */

  if (

    path.dirname(root) !==
      fs.realpathSync(os.tmpdir()) ||

    !path.basename(root)
      .startsWith("lsp-wallet-migration-") ||

    !st.isDirectory() ||

    (st.mode & 0o077)

  ) {

    throw new Error(
      "PRIVATE_MIGRATION_DIRECTORY_REQUIRED"
    );

  }


  const candidateDir = path.join(

    root,

    "candidate"

  );


  const cs = fs.lstatSync(candidateDir);


  const file = path.join(

    root,

    SQLITE_PATH

  );


  const info = fs.lstatSync(file);


  if (

    !cs.isDirectory() ||

    (cs.mode & 0o077) ||

    !info.isFile() ||

    (info.mode & 0o077) ||

    info.size > MAX_WALLET_BYTES

  ) {

    throw new Error(
      "UNSAFE_CANDIDATE"
    );

  }


  /* CAPTURE JSON DATABASES */

  const snapshot = captureSnapshot(root);


  const work = fs.mkdtempSync(

    path.join(root, ".bundle-")

  );


  try {

    const {

      DatabaseSync,

      backup

    } = require("node:sqlite");


    const dest = path.join(

      work,

      "snapshot.sqlite"

    );


    /* SQLITE ONLINE BACKUP */

    const db = new DatabaseSync(

      file,

      {

        readOnly: true

      }

    );


    try {

      await backup(db, dest);

    } finally {

      db.close();

    }


    if (

      fs.statSync(dest).size >
        MAX_WALLET_BYTES

    ) {

      throw new Error(
        "SQLITE_TOO_LARGE"
      );

    }


    const bytes = fs.readFileSync(dest);


    /* VERIFY JSON SOURCE DID NOT CHANGE */

    const after = captureSnapshot(root);


    if (

      JSON.stringify(after.files) !==
        JSON.stringify(snapshot.files) ||

      after.deletionDirectoryPresent !==
        snapshot.deletionDirectoryPresent

    ) {

      throw new Error(
        "BUNDLE_SOURCE_CHANGED"
      );

    }


    /* ADD SQLITE TO BACKUP MANIFEST */

    snapshot.scope =
      "SQLITE_CANDIDATE";


    snapshot.files.push({

      name: SQLITE_PATH,

      size: bytes.length,

      sha256: checksum(bytes),

      content: bytes.toString("base64")

    });


    validateSnapshot(snapshot);


    /* VERIFY BALANCES AND RECEIPTS */

    await verifyCandidate(snapshot);


    /* COMPRESS AND ENCRYPT */

    const encrypted = encryptBackup(

      await gzip(

        Buffer.from(

          JSON.stringify(snapshot)

        ),

        {

          level: 6

        }

      )

    );


    if (

      encrypted.length >
        MAX_ENCRYPTED_BYTES

    ) {

      throw new Error(
        "BACKUP_TOO_LARGE"
      );

    }


    const tmp = path.join(

      work,

      "bundle.lspbak"

    );


    await atomicWrite(tmp, encrypted);


    /* VERIFY ENCRYPTED BACKUP */

    await verifyBackup(tmp);


    /* PUBLISH WITHOUT OVERWRITING */

    await fsp.link(

      tmp,

      path.join(

        root,

        "migration-candidate.lspbak"

      )

    );


    const fd = await fsp.open(root, "r");


    try {

      await fd.sync();

    } finally {

      await fd.close();

    }


    console.log(

      "[RECOVERY] CANDIDATE BUNDLE VERIFIED; " +

      "activationAllowed=false"

    );


  } finally {

    fs.rmSync(work, {

      recursive: true,

      force: true

    });

  }

}


/* ==========================================
   AES-256-GCM ENCRYPTION
========================================== */

function encryptBackup(buffer) {

  if (!backupKey) {
    throw new Error("Backup key unavailable");
  }

  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    backupKey,
    iv
  );

  cipher.setAAD(BACKUP_MAGIC);

  const encrypted = Buffer.concat([

    cipher.update(buffer),

    cipher.final()

  ]);

  const tag = cipher.getAuthTag();

  return Buffer.concat([

    BACKUP_MAGIC,

    iv,

    tag,

    encrypted

  ]);

}


/* ==========================================
   BACKUP DECRYPTION
========================================== */

function decryptBackup(buffer) {

  const headerLength =
    BACKUP_MAGIC.length;

  const ivStart = headerLength;
  const ivEnd = ivStart + 12;

  const tagStart = ivEnd;
  const tagEnd = tagStart + 16;

  if (
    buffer.length <= tagEnd ||
    !buffer.subarray(0, headerLength)
      .equals(BACKUP_MAGIC)
  ) {

    throw new Error(
      "Invalid backup format"
    );

  }

  const iv = buffer.subarray(
    ivStart,
    ivEnd
  );

  const tag = buffer.subarray(
    tagStart,
    tagEnd
  );

  const encrypted =
    buffer.subarray(tagEnd);

  const decipher = crypto.createDecipheriv(

    "aes-256-gcm",

    backupKey,

    iv

  );

  decipher.setAAD(BACKUP_MAGIC);

  decipher.setAuthTag(tag);

  return Buffer.concat([

    decipher.update(encrypted),

    decipher.final()

  ]);

}


/* ==========================================
   ATOMIC BACKUP WRITING
========================================== */

async function atomicWrite(filename, buffer) {

  const tempFile =
    filename +
    "." +
    crypto.randomUUID() +
    ".tmp";

  let handle;

  try {

    handle = await fsp.open(
      tempFile,
      "wx",
      0o600
    );

    await handle.writeFile(buffer);

    await handle.sync();

    await handle.close();

    handle = null;

    await fsp.rename(
      tempFile,
      filename
    );

    // Persist directory metadata on Linux.

    const directory = await fsp.open(
      path.dirname(filename),
      "r"
    );

    try {

      await directory.sync();

    } finally {

      await directory.close();

    }

  } finally {

    if (handle) {

      await handle.close().catch(() => {});

    }

    await fsp.unlink(tempFile)
      .catch(() => {});

  }

}


/* ==========================================
   VERIFY ENCRYPTED BACKUP
========================================== */

/* ==========================================
   VERIFY ENCRYPTED BACKUP V2.1
========================================== */

async function verifyBackup(filename) {

  const info = await fsp.lstat(filename);


  if (

    !info.isFile() ||

    info.size > MAX_ENCRYPTED_BYTES

  ) {

    throw new Error(
      "Invalid backup file or size"
    );

  }


  const encrypted =

    await fsp.readFile(filename);


  if (

    encrypted.length > MAX_ENCRYPTED_BYTES

  ) {

    throw new Error(
      "Backup too large"
    );

  }


  /* AES-256-GCM DECRYPTION */

  const compressed =

    decryptBackup(encrypted);


  /* GZIP DECOMPRESSION */

  const raw = await gunzip(compressed, {

    maxOutputLength:

      MAX_SOURCE_BYTES * 2

  });


  const snapshot = JSON.parse(

    raw.toString("utf8")

  );


  /* VALIDATE BACKUP MANIFEST */

  validateSnapshot(snapshot);


  /* VERIFY SQLITE MIGRATION BUNDLE */

  if (

    snapshot.scope ===
    "SQLITE_CANDIDATE"

  ) {

    await verifyCandidate(snapshot);

  }


  return snapshot;

}
/* ==========================================
   LIVESTREAM PRO
   OFFSITE BACKUP ENGINE V1.1
   CLOUDFLARE R2 PRIVATE STORAGE
========================================== */

const offsite = {

  status: "DISABLED",

  successfulUploads: 0,

  failedUploads: 0,

  lastVerifiedAt: null,

  lastObject: null,

  lastError: null

};

let r2 = null;

let r2Commands = null;

const R2_PREFIX =
  "livestreampro/database/";

const backupNamePattern =
  /^(?:hourly-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z|daily-\d{4}-\d{2}-\d{2})\.lspbak$/;


/* ==========================================
   INITIALIZE PRIVATE R2 CONNECTION
========================================== */

function initOffsite() {

  if (
    process.env.LSP_R2_BACKUP_ENABLED !== "true"
  ) {

    return;

  }

  try {

    const account =
      process.env.LSP_R2_BACKUP_ACCOUNT_ID || "";

    const bucket =
      process.env.LSP_R2_BACKUP_BUCKET || "";

    const accessKeyId =
      process.env.LSP_R2_BACKUP_ACCESS_KEY_ID || "";

    const secretAccessKey =
      process.env.LSP_R2_BACKUP_SECRET_ACCESS_KEY || "";

    if (

      !/^[a-f0-9]{32}$/i.test(account) ||

      !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket) ||

      !accessKeyId ||

      !secretAccessKey

    ) {

      throw new Error(
        "Invalid R2 backup configuration"
      );

    }

    r2Commands =
      require("@aws-sdk/client-s3");

    r2 = new r2Commands.S3Client({

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

    offsite.status = "WAITING";

    console.log(
      "[DATABASE OFFSITE] R2 configured"
    );

  } catch (error) {

    offsite.status = "DEGRADED";

    offsite.lastError =
      "R2 configuration or SDK unavailable";

    console.error(
      "[DATABASE OFFSITE] Configuration failed"
    );

  }

}


/* ==========================================
   PERSISTENT UPLOAD RECEIPT
========================================== */

function receiptPath(filename) {

  return path.join(

    BACKUP_DIR,

    filename + ".r2-ok"

  );

}


/* ==========================================
   UPLOAD AND VERIFY ENCRYPTED BACKUP
========================================== */

async function uploadVerifiedBackup(filename) {

  if (!backupNamePattern.test(filename)) {

    throw new Error(
      "Invalid backup name"
    );

  }

  const local = path.join(
    BACKUP_DIR,
    filename
  );

/* ==========================================
   VERIFY OFFSITE BACKUP SCOPE
========================================== */

const verified =

  await verifyBackup(local);


if (

  verified.scope ===
  "SQLITE_CANDIDATE"

) {

  throw new Error(
    "INVALID_OFFSITE_SCOPE"
  );

}

  const bytes =
    await fsp.readFile(local);

  if (bytes.length > MAX_ENCRYPTED_BYTES) {

    throw new Error(
      "Backup too large"
    );

  }

  const digest = checksum(bytes);

  const Bucket =
    process.env.LSP_R2_BACKUP_BUCKET;

  const Key =
    R2_PREFIX + filename;

  const {

    PutObjectCommand,

    GetObjectCommand

  } = r2Commands;


  /* UPLOAD WITHOUT OVERWRITING */

  try {

    await r2.send(

      new PutObjectCommand({

        Bucket,

        Key,

        Body: bytes,

        ContentLength: bytes.length,

        ContentType:
          "application/octet-stream",

        IfNoneMatch: "*",

        Metadata: {

          sha256: digest

        }

      }),

      {

        abortSignal:
          AbortSignal.timeout(15000)

      }

    );

  } catch (error) {

    // Existing object: verify its content
    // instead of overwriting it.

const status =
  error.$metadata?.httpStatusCode;

const alreadyExists =
  status === 412;

const objectLocked =
  status === 409 &&
  (
    error.name === "ObjectLockedByBucketPolicy" ||
    error.Code === "ObjectLockedByBucketPolicy"
  );

if (!alreadyExists && !objectLocked) {

  throw error;

}

  }


  /* DOWNLOAD AND VERIFY R2 COPY */

  const signal =
    AbortSignal.timeout(15000);

  const result = await r2.send(

    new GetObjectCommand({

      Bucket,

      Key

    }),

    {

      abortSignal: signal

    }

  );

  const hash =
    crypto.createHash("sha256");

  let count = 0;

  const abortBody = () =>
    result.Body?.destroy?.();

  signal.addEventListener(

    "abort",

    abortBody,

    { once: true }

  );

  try {

    if (

      signal.aborted ||

      result.ContentLength !== bytes.length

    ) {

      throw new Error(
        "R2 size mismatch"
      );

    }

    for await (const chunk of result.Body) {

      if (signal.aborted) {

        throw new Error(
          "R2 verification timed out"
        );

      }

      count += chunk.length;

      if (count > bytes.length) {

        throw new Error(
          "R2 size mismatch"
        );

      }

      hash.update(chunk);

    }

    if (

      signal.aborted ||

      count !== bytes.length ||

      hash.digest("hex") !== digest

    ) {

      throw new Error(
        "R2 checksum mismatch"
      );

    }

  } finally {

    signal.removeEventListener(
      "abort",
      abortBody
    );

    result.Body?.destroy?.();

  }


  /* SAVE VERIFIED RECEIPT */

  await atomicWrite(

    receiptPath(filename),

    Buffer.from(digest)

  );


  /* UPDATE OFFSITE STATISTICS */

  offsite.successfulUploads++;

  offsite.lastVerifiedAt =
    Date.now();

  offsite.lastObject = Key;

  console.log(

    "[DATABASE OFFSITE] VERIFIED",

    filename

  );

}


/* ==========================================
   OFFSITE SYNCHRONIZATION
========================================== */

async function syncOffsite(currentName) {

  if (!r2) return;

  try {

    const entries = await fsp.readdir(

      BACKUP_DIR,

      { withFileTypes: true }

    );

    const pending = entries

      .filter(entry =>

        entry.isFile() &&

        backupNamePattern.test(entry.name) &&

        entry.name !== currentName &&

        !fs.existsSync(
          receiptPath(entry.name)
        )

      )

      .map(entry => entry.name)

      .sort()

      .reverse();

    offsite.status = "SYNCING";

    let failed = false;

    // Current backup first.
    // Retry one older backup per run.

    const queue = [

      currentName,

      ...pending.slice(0, 1)

    ];

    for (const name of queue) {

      try {

        await uploadVerifiedBackup(name);

      } catch (error) {

        failed = true;

        offsite.failedUploads++;

        offsite.lastError =
          "R2 upload or readback verification failed";

        console.error(

          "[DATABASE OFFSITE] FAILED",

          name,

          String(error.name || "Error"),

          error.$metadata?.httpStatusCode || ""

        );

        if (name === currentName) {

          break;

        }

      }

    }

    offsite.status = failed

      ? "DEGRADED"

      : "ACTIVE";

    if (!failed) {

      offsite.lastError = null;

    }

  } catch (error) {

    offsite.failedUploads++;

    offsite.status = "DEGRADED";

    offsite.lastError =
      "R2 synchronization failed";

  }

}

/* ==========================================
   BACKUP ROTATION
========================================== */

async function rotateBackups(prefix, limit) {

  const entries = await fsp.readdir(
    BACKUP_DIR,
    { withFileTypes: true }
  );

  const files = entries

    .filter(entry =>
      entry.isFile() &&
      entry.name.startsWith(prefix) &&
      entry.name.endsWith(".lspbak")
    )

    .map(entry => entry.name)

    .sort()

    .reverse();

for (const filename of files.slice(limit)) {

  await fsp.unlink(

    path.join(BACKUP_DIR, filename)

  );

  await fsp.unlink(

    receiptPath(filename)

  ).catch(() => {});

}

}


/* ==========================================
   CREATE DATABASE BACKUP
========================================== */

async function createBackup(reason = "automatic") {

  if (!backupKey) {

    return {
      ok: false,
      error: "BACKUP_NOT_CONFIGURED"
    };

  }

  if (backupRunning) {

    return {
      ok: false,
      error: "BACKUP_BUSY"
    };

  }

  if (reason === "manual") {

    if (
      Date.now() - lastManualBackup <
      5 * 60 * 1000
    ) {

      return {
        ok: false,
        error: "BACKUP_RATE_LIMIT"
      };

    }

    lastManualBackup = Date.now();

  }

  backupRunning = true;

  try {

    await fsp.mkdir(BACKUP_DIR, {

      recursive: true,

      mode: 0o700

    });

    /* CAPTURE CURRENT DATABASE */

    const snapshot = captureSnapshot();

    const raw = Buffer.from(
      JSON.stringify(snapshot),
      "utf8"
    );

    /* COMPRESS DATA */

    const compressed = await gzip(raw, {
      level: 6
    });

    /* ENCRYPT DATA */

    const encrypted =
      encryptBackup(compressed);

    const timestamp = new Date(
      snapshot.createdAt
    ).toISOString().replace(/[:.]/g, "-");

    const hourlyName =
      `hourly-${timestamp}.lspbak`;

    const hourlyPath = path.join(
      BACKUP_DIR,
      hourlyName
    );

    await atomicWrite(
      hourlyPath,
      encrypted
    );

    /* VERIFY BACKUP BEFORE ROTATION */

    try {

      await verifyBackup(hourlyPath);

    } catch (error) {

      stats.integrityFailures++;

      await fsp.unlink(hourlyPath)
        .catch(() => {});

      throw error;

    }

    /* DAILY BACKUP */

    const dailyPath = path.join(

      BACKUP_DIR,

      `daily-${snapshot.vietnamDay}.lspbak`

    );

    // Keep the first successful snapshot
    // of each Vietnam calendar day.

    if (!fs.existsSync(dailyPath)) {

      await atomicWrite(
        dailyPath,
        encrypted
      );

      await verifyBackup(dailyPath);

    }


    /* ==========================================
   OFFSITE BACKUP SYNCHRONIZATION
========================================== */

await syncOffsite(hourlyName);


    /* REMOVE OLD BACKUPS */

    await rotateBackups(
      "hourly-",
      MAX_HOURLY
    );

    await rotateBackups(
      "daily-",
      MAX_DAILY
    );

    stats.successfulBackups++;

    stats.lastBackupAt = Date.now();

    stats.lastVerifiedAt = Date.now();

    stats.lastBackupSize =
      encrypted.length;

    stats.lastError = null;

    console.log("[DATABASE BACKUP] SUCCESS", {

      reason,

      files: snapshot.files.length,

      bytes: encrypted.length

    });

return {

  ok: true,

  filename: hourlyName,

  files: snapshot.files.length,

  size: encrypted.length,

  createdAt: snapshot.createdAt,

  offsite: {

    ...offsite

  }

};

  } catch (error) {

    stats.failedBackups++;

    stats.lastError =
      String(error.message).slice(0, 300);

    console.error(

      "[DATABASE BACKUP] FAILED",

      stats.lastError

    );

    return {

      ok: false,

      error: "BACKUP_FAILED"

    };

  } finally {

    backupRunning = false;

  }

}


/* ==========================================
   DATABASE STORAGE STATISTICS
========================================== */

async function getStats() {

  let hourlyBackups = 0;
  let dailyBackups = 0;
  let backupBytes = 0;

  let latestSavedAt = null;

  const recentBackups = [];

  try {

    const entries = await fsp.readdir(
      BACKUP_DIR,
      { withFileTypes: true }
    );

    for (const entry of entries) {

      if (
        !entry.isFile() ||
        !entry.name.endsWith(".lspbak")
      ) {
        continue;
      }

      const info = await fsp.stat(
        path.join(BACKUP_DIR, entry.name)
      );

      backupBytes += info.size;

      if (entry.name.startsWith("hourly-")) {
        hourlyBackups++;
      }

      if (entry.name.startsWith("daily-")) {
        dailyBackups++;
      }

      latestSavedAt = Math.max(
        latestSavedAt || 0,
        info.mtimeMs
      );

      recentBackups.push({

        name: entry.name,

        size: info.size,

        createdAt: info.mtimeMs

      });

    }

  } catch (error) {

    if (error.code !== "ENOENT") {
      throw error;
    }

  }

  recentBackups.sort(
    (a, b) => b.createdAt - a.createdAt
  );

  let storage = null;

  try {

    const disk = await fsp.statfs(DATA_DIR);

    const total =
      disk.blocks * disk.bsize;

    const free =
      disk.bavail * disk.bsize;

    const used =
      (disk.blocks - disk.bfree) *
      disk.bsize;

    storage = {

      totalBytes: total,

      freeBytes: free,

      usedBytes: used,

      usedPercent: total > 0

        ? Number(
            (used / total * 100).toFixed(2)
          )

        : 0

    };

  } catch {

    // Storage statistics are optional.

  }

return {

version: "2.1.0",

  offsite: {

    ...offsite

  },

  status: !backupKey

      ? "NOT_CONFIGURED"

      : backupRunning

        ? "BACKING_UP"

        : stats.lastError

          ? "DEGRADED"

          : stats.lastVerifiedAt

            ? "ACTIVE"

            : "WAITING_FOR_BACKUP",

    encryption: "AES-256-GCM",

    compression: "GZIP",

    checksum: "SHA-256",

    intervalMinutes:
      BACKUP_INTERVAL / 60000,

    hourlyRetention: MAX_HOURLY,

    dailyRetention: MAX_DAILY,

    hourlyBackups,

    dailyBackups,

    totalBackups:
      hourlyBackups + dailyBackups,

    backupBytes,

    latestSavedAt,

    backupRunning,

    ...stats,

    storage,

    recentBackups:
      recentBackups.slice(0, 20)

  };

}


/* ==========================================
   START AUTOMATIC BACKUP SERVICE
========================================== */

function start() {

  if (backupTimer) return true;

  try {

    initializeKey();

    fs.mkdirSync(BACKUP_DIR, {

      recursive: true,

      mode: 0o700

    });

    fs.chmodSync(BACKUP_DIR, 0o700);

  } catch (error) {

    backupKey = null;

    stats.lastError = error.message;

    console.error(

      "[DATABASE SECURITY] DISABLED:",

      error.message

    );

    return false;

  }


/* INITIALIZE OFFSITE BACKUP */

initOffsite();

  backupTimer = setInterval(() => {

    void createBackup("automatic");

  }, BACKUP_INTERVAL);

  backupTimer.unref();

  // Initial backup after startup.

  setTimeout(() => {

    void createBackup("startup");

  }, 30000).unref();

console.log(

  "[DATABASE SECURITY] V2.1 JSON_ONLY enabled"

);


  console.log(
    "[DATABASE BACKUP] AES-256-GCM encryption enabled"
  );

  console.log(
    "[DATABASE BACKUP] Automatic interval: 60 minutes"
  );

  return true;

}


/* ==========================================
   EXPORT MODULE
========================================== */

module.exports = {

  start,

  createBackup,

  getStats

};

/* ==========================================
   LIVESTREAM PRO
   OFFLINE DATABASE RECOVERY V2.1
   NO PRODUCTION OVERWRITE
========================================== */

async function recoveryCli() {

  const [

    command,

    input,

    output,

    ...extra

  ] = process.argv.slice(2);


  /* ======================================
     SQLITE MIGRATION BACKUP BUNDLE
  ====================================== */

  if (

    command === "bundle" &&

    input &&

    !output &&

    !extra.length

  ) {

    initializeKey();

    return createCandidateBundle(input);

  }


  /* ======================================
     INDEPENDENT TOMBSTONE VERIFICATION
  ====================================== */

  if (

    command === "check-tombstones" &&

    input &&

    output &&

    !extra.length

  ) {

    initializeKey();


    const snapshot = await verifyBackup(

      path.resolve(input)

    );


    return checkCurrentDeletionRecords(

      snapshot,

      output

    );

  }



  /* ==========================================
   LIVESTREAM PRO
   VERIFIED BACKUP GAME RECONCILIATION V1.6D
   NO PRODUCTION OVERWRITE
========================================== */

if (

  command === "game-reconcile" &&

  input &&

  !output &&

  !extra.length

) {

  /* INITIALIZE EXISTING BACKUP KEY */

  initializeKey();


  /* AUTHENTICATE AND VERIFY BACKUP */

  const snapshot = await verifyBackup(

    path.resolve(input)

  );


  const ledger = require(
    "./game-wallet-ledger"
  );


  /* READ VERIFIED BACKUP DATA IN MEMORY */

  const readEntry = name => {

    const item = snapshot.files.find(

      f => f.name === name

    );

    return item

      ? JSON.parse(

          Buffer.from(
            item.content,
            "base64"
          ).toString("utf8")

        )

      : null;

  };


  const users = readEntry("users.json");

  const wheelHistory = readEntry(
    "wheel8_user_history.json"
  );


  /* ======================================
     PRINT AGGREGATED FINANCIAL REPORT
  ====================================== */

  console.log(

    JSON.stringify({

      mode:
        "VERIFIED_BACKUP_RECONCILIATION_READ_ONLY",

      backupVerified: true,

      createdAt:
        new Date(snapshot.createdAt).toISOString(),

      scope:
        snapshot.scope || "LEGACY_JSON_ONLY",

      deletionDirectoryPresent:
        snapshot.deletionDirectoryPresent ?? null,

      backupAudit:
        ledger.financialReconciliation(
          users,
          wheelHistory
        ),

      comparison:
        ledger.compareBackupWithLive(users),

      activationAllowed: false

    }, null, 2)

  );

  return;

}


/* ==========================================
   LIVESTREAM PRO
   FINANCIAL RECEIPT RETENTION AUDIT V1.8A
   READ ONLY
========================================== */

if (

  command === "receipt-retention-audit" &&

  input &&

  !output &&

  !extra.length

) {

  initializeKey();


  /* VERIFY ENCRYPTED BACKUP */

  const snapshot = await verifyBackup(

    path.resolve(input)

  );


  /* READ ARCHIVED USERS */

  const entry = snapshot.files.find(

    f => f.name === "users.json"

  );

  const archived = JSON.parse(

    Buffer.from(

      entry.content,

      "base64"

    ).toString("utf8")

  );


  /* LOAD RETENTION ENGINE */

  const retention = require(

    "./wallet-receipt-retention"

  );


  /* READ CURRENT PRODUCTION DATABASE */

  const current = retention.readUsers(

    path.join(

      DATA_DIR,

      "users.json"

    )

  );


  /* COMPARE FINANCIAL RECORDS */

  console.log(

    JSON.stringify({

      backupVerified: true,

      backupCreatedAt:

        new Date(
          snapshot.createdAt
        ).toISOString(),

      ...retention.compare(

        archived,

        current

      )

    }, null, 2)

  );

  return;

}


/* ==========================================
   LIVESTREAM PRO
   INDEPENDENT RECEIPT ARCHIVE V1.8B
========================================== */

if (

  command === "receipt-archive-create" &&

  input &&

  !output &&

  !extra.length

) {

  initializeKey();


  /* AUTHENTICATE EXISTING DATABASE BACKUP */

  const snapshot = await verifyBackup(

    path.resolve(input)

  );


  const archive = require(
    "./wallet-receipt-archive"
  );

  const ctx = archive.config();

  try {

    const report = await archive.create(

      snapshot,

      ctx.key,

      ctx.store

    );

    console.log(
      JSON.stringify(report, null, 2)
    );

  } finally {

    ctx.close();

  }

  return;

}


/* ==========================================
   INDEPENDENT REMOTE ARCHIVE VERIFICATION
========================================== */

if (

  command === "receipt-archive-verify" &&

  input &&

  output &&

  !extra.length

) {

  const archive = require(
    "./wallet-receipt-archive"
  );

  const ctx = archive.config();

  try {

    const report = await archive.verify(

      input,

      output,

      ctx.key,

      ctx.store

    );

    console.log(
      JSON.stringify(report, null, 2)
    );

  } finally {

    ctx.close();

  }

  return;

}



  /* VALIDATE COMMAND */

  if (

    extra.length ||

    !input ||

    !["verify", "extract"]
      .includes(command) ||

    (

      command === "extract"

        ? !output

        : Boolean(output)

    )

  ) {

    throw new Error(

      "Usage: node security-database.js " +

      "verify BACKUP | " +

      "extract BACKUP NEW_DIRECTORY | " +

      "bundle PRIVATE_MIGRATION_DIRECTORY | " +

      "check-tombstones BACKUP " +

      "TRUSTED_DELETION_DIRECTORY"

    );

  }


  /* INITIALIZE ENCRYPTION KEY */

  initializeKey();


  /* VERIFY BACKUP */

  const snapshot = await verifyBackup(

    path.resolve(input)

  );


  const names = snapshot.files.map(

    item => item.name

  );


  const missing = BACKUP_FILES.filter(

    name => !names.includes(name)

  );


  /* PRINT VERIFICATION REPORT */

  console.log(

    "[RECOVERY] VERIFIED",

    JSON.stringify({

      createdAt:

        new Date(snapshot.createdAt)
          .toISOString(),

      scope:

        snapshot.scope ||

        "LEGACY_JSON_ONLY",

      deletionDirectoryPresent:

        snapshot.deletionDirectoryPresent ??
        null,

      activationAllowed: false,

      files: names,

      missing

    }, null, 2)

  );


  console.warn(

    "[RECOVERY] Historical snapshot only. " +

    "Compare latest independent deletion " +

    "records and newer financial transactions " +

    "before any activation."

  );


  if (command === "verify") {

    return;

  }


  /* ======================================
     VALIDATE RECOVERY DESTINATION
  ====================================== */

  const target = path.resolve(output);


  const parent = await fsp.realpath(

    path.dirname(target)

  );


  const dest = path.join(

    parent,

    path.basename(target)

  );


  const isWithin = (candidate, root) =>

    candidate === root ||

    candidate.startsWith(

      root + path.sep

    );


  const appPublic = path.join(

    __dirname,

    "public"

  );


  const productionRoot =

    await fsp.realpath(DATA_DIR)

      .catch(() => DATA_DIR);


  const publicRoot =

    await fsp.realpath(appPublic)

      .catch(() => appPublic);


  /* BLOCK PRODUCTION OVERWRITE */

  if (

    isWithin(dest, DATA_DIR) ||

    isWithin(dest, productionRoot) ||

    isWithin(dest, appPublic) ||

    isWithin(dest, publicRoot)

  ) {

    throw new Error(

      "Recovery destination must be " +

      "outside live data and public directories"

    );

  }


  /* RESTORE VERIFIED BACKUP */

  await extractSnapshot(

    snapshot,

    dest

  );


  /* RECOVERY REPORT */

  console.log(

    "[RECOVERY] EXTRACTED AND VERIFIED",

    dest

  );


  console.log(

    "[RECOVERY] No production files were changed."

  );

}
/* ==========================================
   RUN CLI ONLY WHEN EXECUTED DIRECTLY
========================================== */

if (require.main === module) {

  recoveryCli().catch(error => {

    console.error(

      "[RECOVERY] FAILED",

      error.message

    );

    process.exitCode = 1;

  });

}

