"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const {
  execFileSync,
  spawnSync
} = require("node:child_process");

const {
  assertJsonOnly,
  audit,
  preflight
} = require("./wallet-activation-guard");


const root = fs.mkdtempSync(

  path.join(
    os.tmpdir(),
    "lsp-wallet-migration-"
  )

);


const oldKey =
  process.env.LSP_DATABASE_BACKUP_KEY;


process.env.LSP_DATABASE_BACKUP_KEY =

  crypto.randomBytes(32).toString("hex");


function run(script, ...args) {

  return execFileSync(

    process.execPath,

    [

      path.join(__dirname, script),

      ...args

    ],

    {

      stdio: "pipe",

      env: {

        ...process.env,

        LSP_R2_BACKUP_ENABLED: "false"

      },

      timeout: 180000

    }

  );

}


function write(name, value) {

  fs.writeFileSync(

    path.join(root, name),

    JSON.stringify(value),

    {

      mode: 0o600,

      flag: "wx"

    }

  );

}


try {


  /* TEST 01 - STORAGE MODE */

  assert.equal(

    assertJsonOnly("JSON_ONLY"),

    "JSON_ONLY"

  );


  for (

    const mode of [

      "SQLITE",

      "sqlite",

      "",

      "AUTO"

    ]

  ) {

    assert.throws(

      () => assertJsonOnly(mode),

      /WALLET_ACTIVATION_BLOCKED/

    );

  }


  /* TEST 02 - SOURCE AUDIT */

  const a = audit(

    "saveUsers(db);\n" +

    "lspWalletStorage.begin(ids);\n" +

    "p.coins += 1;"

  );


  assert.equal(a.saveUsersReferences, 1);

  assert.equal(a.adapterReferences, 1);

  assert.equal(a.possibleBalanceAssignments, 1);

  assert.equal(a.activationAllowed, false);


  /* CREATE PRIVATE FIXTURES */

  fs.mkdirSync(

    path.join(

      root,

      "account-deletion-requests"

    ),

    { mode: 0o700 }

  );


  write("users.json", {

    A: {

      profile: {

        coins: 100,

        withdrawHold: [

          { id: "h1" }

        ]

      },

      transferRequests: [

        { status: "pending" }

      ]

    }

  });


  write("lsp_pg_orders.json", {

    LSPAAAAAAAAAAAAAAAAAAAA: {

      uid: "A",

      diamonds: 100,

      status: "pending"

    }

  });


  write("withdraw_requests.json", [

    {

      uid: "A",

      id: "h1",

      status: "pending"

    }

  ]);


  write("market_booths.json", {

    B: {

      orders: [

        { status: "pending" }

      ]

    }

  });


  /* TEST 03 - CREATE MIGRATION */

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


  run(

    "security-database.js",

    "bundle",

    root

  );


  const bundle = path.join(

    root,

    "migration-candidate.lspbak"

  );


  const digest = () => crypto

    .createHash("sha256")

    .update(fs.readFileSync(bundle))

    .digest("hex");


  const before = digest();


  /* TEST 04 - PREFLIGHT */

  const r = preflight(bundle);


  assert.equal(r.backupVerified, true);

  assert.equal(r.pendingPayments, 1);

  assert.equal(r.pendingWithdrawals, 1);

  assert.equal(r.pendingTransferRecords, 1);

  assert.equal(r.unresolvedWithdrawalHolds, 1);

  assert.equal(r.pendingMarketOrders, 1);

  assert.equal(r.activationAllowed, false);


  /* SOURCE BACKUP MUST NOT CHANGE */

  assert.equal(digest(), before);


  /* TEST 05 - ACTIVATION BLOCK */

  const cli = spawnSync(

    process.execPath,

    [

      path.join(

        __dirname,

        "wallet-activation-guard.js"

      ),

      "preflight",

      bundle

    ],

    { encoding: "utf8" }

  );


  assert.equal(

    cli.status,

    2,

    cli.stderr

  );


  /* TEST 06 - CORRUPTED BACKUP */

  const bad = fs.readFileSync(bundle);

  bad[bad.length - 1] ^= 1;


  const badFile = path.join(

    root,

    "bad.lspbak"

  );


  fs.writeFileSync(

    badFile,

    bad,

    { mode: 0o600 }

  );


  assert.throws(

    () => preflight(badFile)

  );


  console.log(

    "[WALLET ACTIVATION GUARD TEST] PASS"

  );


} finally {

  if (oldKey === undefined) {

    delete process.env.LSP_DATABASE_BACKUP_KEY;

  } else {

    process.env.LSP_DATABASE_BACKUP_KEY =
      oldKey;

  }


  fs.rmSync(root, {

    recursive: true,

    force: true

  });

}