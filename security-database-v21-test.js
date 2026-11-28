"use strict";

/* ==========================================
   LIVESTREAM PRO
   DATABASE BACKUP V2.1 AUTOMATIC TEST

   PRIVATE FIXTURE ONLY
   NO PRODUCTION DATA ACCESS
========================================== */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const zlib = require("node:zlib");

const {
  execFileSync
} = require("node:child_process");

const {
  DatabaseSync
} = require("node:sqlite");


/* ==========================================
   PRIVATE TEST DIRECTORIES
========================================== */

const root = fs.mkdtempSync(

  path.join(

    os.tmpdir(),

    "lsp-wallet-migration-"

  )

);


const walletRoot = fs.mkdtempSync(

  path.join(

    os.tmpdir(),

    "lsp-wallet-backup-"

  )

);


/* ==========================================
   TEST ENCRYPTION KEY
========================================== */

const key = crypto.randomBytes(32);


const env = {

  ...process.env,

  LSP_DATABASE_BACKUP_KEY:

    key.toString("hex"),

  LSP_WALLET_TEST_BACKUP_KEY:

    key.toString("hex"),

  LSP_R2_BACKUP_ENABLED:

    "false"

};


process.env.LSP_DATABASE_BACKUP_KEY =

  env.LSP_DATABASE_BACKUP_KEY;


process.env.LSP_R2_BACKUP_ENABLED =

  "false";


/* ==========================================
   TEST UTILITIES
========================================== */

const run = (script, ...args) =>

  execFileSync(

    process.execPath,

    [

      path.join(__dirname, script),

      ...args

    ],

    {

      env,

      encoding: "utf8",

      stdio: [

        "ignore",

        "pipe",

        "pipe"

      ]

    }

  );


const sha = b => crypto

  .createHash("sha256")

  .update(b)

  .digest("hex");


const write = (name, obj) =>

  fs.writeFileSync(

    path.join(root, name),

    JSON.stringify(obj),

    {

      mode: 0o600

    }

  );


const uid = "deleted-fixture";


const record =

  "account-deletion-requests/" +

  sha(uid) +

  ".json";


const dbFile = path.join(

  root,

  "candidate/wallet-test.sqlite"

);


const source = path.join(

  __dirname,

  "security-database.js"

);


/* ==========================================
   START AUTOMATIC BACKUP TEST
========================================== */

(async () => {

  try {


    /* CREATE TEST DATABASE */

    fs.mkdirSync(

      path.join(

        root,

        "account-deletion-requests"

      ),

      {

        mode: 0o700

      }

    );


    write("users.json", {

      A: {

        profile: {

          coins: 100

        }

      }

    });


    write("lsp_pg_orders.json", {});


    /* CREATE DELETION RECORD */

    const deletion = {

      uid,

      requestId: crypto.randomUUID(),

      status: "completed",

      engineState: "completed"

    };


    write(record, deletion);


    /* ====================================
       TEST 01 - LEGACY V1 BACKUP
    ==================================== */

    const raw = fs.readFileSync(

      path.join(root, "users.json")

    );


    const manifest = {

      version: "1.0.0",

      createdAt: Date.now(),

      files: [

        {

          name: "users.json",

          size: raw.length,

          sha256: sha(raw),

          content: raw.toString("base64")

        }

      ]

    };


    const magic = Buffer.from("LSPDB1");

    const iv = crypto.randomBytes(12);


    const cipher = crypto.createCipheriv(

      "aes-256-gcm",

      key,

      iv

    );


    cipher.setAAD(magic);


    const enc = Buffer.concat([

      cipher.update(

        zlib.gzipSync(

          Buffer.from(

            JSON.stringify(manifest)

          )

        )

      ),

      cipher.final()

    ]);


    const old = path.join(

      root,

      "old.lspbak"

    );


    fs.writeFileSync(

      old,

      Buffer.concat([

        magic,

        iv,

        cipher.getAuthTag(),

        enc

      ]),

      {

        mode: 0o600

      }

    );


    assert(

      run(

        "security-database.js",

        "verify",

        old

      ).includes("LEGACY_JSON_ONLY")

    );


    /* ====================================
       TEST 02 - JSON BACKUP V2.1

       Redirect a temporary module copy
       to private fixture storage.
    ==================================== */

    const original = fs.readFileSync(

      source,

      "utf8"

    );


    const anchor =

      'const DATA_DIR = "/opt/render/project/data";';


    assert.equal(

      original.split(anchor).length,

      2

    );


    const fixtureModule = path.join(

      root,

      "backup-fixture.cjs"

    );


    fs.writeFileSync(

      fixtureModule,

      original.replace(

        anchor,

        `const DATA_DIR = ${JSON.stringify(root)};`

      ),

      {

        mode: 0o600

      }

    );


    const service = require(fixtureModule);


    assert(service.start());


    const b = await service.createBackup(

      "automatic"

    );


    assert(b.ok);


    const archive = path.join(

      root,

      "security-backups",

      b.filename

    );


    /* ====================================
       TEST 03 - JSON RECOVERY
    ==================================== */

    const dest = path.join(

      root,

      "json-recovery"

    );


    run(

      "security-database.js",

      "extract",

      archive,

      dest

    );


    assert.deepEqual(

      JSON.parse(

        fs.readFileSync(

          path.join(dest, record)

        )

      ),

      deletion

    );


    /* ====================================
       TEST 04 - TOMBSTONE VERIFICATION
    ==================================== */

    const trusted = path.join(

      root,

      "account-deletion-requests"

    );


    assert(

      run(

        "security-database.js",

        "check-tombstones",

        archive,

        trusted

      ).includes("DELETION RECORDS MATCH")

    );


    /* DETECT CHANGED DELETION RECORD */

    write(record, {

      ...deletion,

      updatedAt: "fixture-change"

    });


    assert.throws(

      () => run(

        "security-database.js",

        "check-tombstones",

        archive,

        trusted

      ),

      /DELETION_RECORD_CHANGED/

    );


    write(record, deletion);


    /* ====================================
       TEST 05 - DELETED UID PROTECTION
    ==================================== */

    write("users.json", {

      A: {

        profile: {

          coins: 100

        }

      },

      [uid]: {

        profile: {

          coins: 0

        }

      }

    });


    assert.equal(

      (

        await service.createBackup(

          "automatic"

        )

      ).ok,

      false

    );


    /* RESTORE VALID FIXTURE */

    write("users.json", {

      A: {

        profile: {

          coins: 100

        }

      }

    });


    /* ====================================
       TEST 06 - SQLITE MIGRATION
    ==================================== */

    run(

      "wallet-migration.js",

      "create",

      root

    );


    run(

      "wallet-legacy-receipts.js",

      "import",

      root

    );


    const bundle = path.join(

      root,

      "migration-candidate.lspbak"

    );


    /* ====================================
       TEST 07 - SQLITE BACKUP BUNDLE
    ==================================== */

    assert(

      run(

        "security-database.js",

        "bundle",

        root

      ).includes(

        "CANDIDATE BUNDLE VERIFIED"

      )

    );


    assert(

      run(

        "security-database.js",

        "verify",

        bundle

      ).includes("SQLITE_CANDIDATE")

    );


    /* ====================================
       TEST 08 - BUNDLE RECOVERY
    ==================================== */

    const out = path.join(

      root,

      "bundle-recovery"

    );


    run(

      "security-database.js",

      "extract",

      bundle,

      out

    );


    assert(

      fs.existsSync(

        path.join(

          out,

          "candidate/wallet-test.sqlite"

        )

      )

    );


    assert(

      fs.existsSync(

        path.join(out, record)

      )

    );


    /* ====================================
       TEST 09 - OVERWRITE PROTECTION
    ==================================== */

    assert.throws(

      () => run(

        "security-database.js",

        "extract",

        bundle,

        out

      ),

      /EEXIST/

    );


    assert.throws(

      () => run(

        "security-database.js",

        "bundle",

        root

      ),

      /EEXIST/

    );


    /* ====================================
       TEST 10 - CORRUPTED BACKUP
    ==================================== */

    const corrupt = fs.readFileSync(

      bundle

    );


    corrupt[corrupt.length - 1] ^= 1;


    const bad = path.join(

      root,

      "corrupt.lspbak"

    );


    fs.writeFileSync(

      bad,

      corrupt,

      {

        mode: 0o600

      }

    );


    assert.throws(

      () => run(

        "security-database.js",

        "verify",

        bad

      )

    );


    /* ====================================
       TEST 11 - WALLET BACKUP V2.1
    ==================================== */

    const walletFile = path.join(

      walletRoot,

      "wallet-test.sqlite"

    );


    fs.copyFileSync(

      dbFile,

      walletFile,

      fs.constants.COPYFILE_EXCL

    );


    fs.chmodSync(walletFile, 0o600);


    run(

      "wallet-backup.js",

      "create",

      walletRoot

    );


    run(

      "wallet-backup.js",

      "restore",

      walletRoot

    );


    /* ====================================
       TEST 12 - LEGACY MANIFEST TAMPERING
    ==================================== */

    for (

      const f of [

        walletFile,

        dbFile

      ]

    ) {

      const db = new DatabaseSync(f);


      try {

        db.exec(

          "UPDATE wallet_meta " +

          "SET value='{}' " +

          "WHERE key=" +

          "'legacy_receipt_manifest_v1'"

        );

      } finally {

        db.close();

      }

    }


    assert.throws(

      () => run(

        "wallet-backup.js",

        "create",

        walletRoot

      ),

      /LEGACY_MANIFEST_REQUIRED/

    );


    assert.throws(

      () => run(

        "security-database.js",

        "bundle",

        root

      )

    );


    /* ====================================
       ALL TESTS COMPLETED
    ==================================== */

    console.log(

      "[BACKUP V2.1 TEST] PASS JSON, " +

      "V1 compatibility, tombstones, " +

      "candidate bundle, legacy integrity, " +

      "corruption, no overwrite"

    );


  } finally {


    /* CLEAN PRIVATE TEST DATABASES */

    fs.rmSync(root, {

      recursive: true,

      force: true

    });


    fs.rmSync(walletRoot, {

      recursive: true,

      force: true

    });

  }

})().catch(error => {

  console.error(error);

  process.exitCode = 1;

});