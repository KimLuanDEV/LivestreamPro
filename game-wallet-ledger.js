/* ==========================================
   LIVESTREAM PRO
   PERSISTENT GAME LEDGER V1.6B

   READ ONLY AUDIT
   OFFLINE REHEARSAL
   ACCOUNT RECEIPT PROTECTION
========================================== */

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");


/* ==========================================
   LEDGER CONFIGURATION
========================================== */

const FIELD = "gameWalletLedgerV16";

const UUID =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

const GAMES = new Set([
  "wheel8",
  "dtp",
  "time-race"
]);


/* ==========================================
   VALIDATION HELPERS
========================================== */

const obj = x =>
  x !== null &&
  typeof x === "object" &&
  !Array.isArray(x);

const positive = x =>
  Number.isSafeInteger(x) && x > 0;

const nonnegative = x =>
  Number.isSafeInteger(x) && x >= 0;


function need(ok, code) {

  if (!ok) {

    throw new Error(code);

  }

}


/* ==========================================
   ACCOUNT LEDGER VALIDATION
========================================== */

function inspectAccount(uid, user) {

  need(

    typeof uid === "string" &&

    uid &&

    obj(user) &&

    obj(user.profile),

    "INVALID_ACCOUNT"

  );


  const ledger = user[FIELD] === undefined

    ? {

        version: 1,

        entries: {}

      }

    : user[FIELD];


  need(

    obj(ledger) &&

    ledger.version === 1 &&

    obj(ledger.entries),

    "INVALID_LEDGER"

  );


  const entries = Object.entries(
    ledger.entries
  );


  /* ======================================
     VALIDATE FINANCIAL OBLIGATIONS
  ====================================== */

  for (const [key, r] of entries) {

    need(

      UUID.test(key) &&

      obj(r) &&

      r.id === key &&

      r.uid === uid &&

      GAMES.has(r.game) &&

      typeof r.roundKey === "string" &&

      UUID.test(r.roundKey) &&

      positive(r.amount) &&

      positive(r.createdAt),

      "INVALID_OBLIGATION"

    );


    need(

      [
        "pending",
        "refunded",
        "settled"
      ].includes(r.status),

      "INVALID_STATUS"

    );


    /* PENDING OBLIGATION */

    if (r.status === "pending") {

      need(

        r.resolution === null,

        "PENDING_WITH_RESOLUTION"

      );


    /* COMPLETED OBLIGATION */

    } else {

      const s = r.resolution;


      need(

        obj(s) &&

        typeof s.evidenceId === "string" &&

        UUID.test(s.evidenceId) &&

        nonnegative(s.amount) &&

        positive(s.at) &&

        s.at >= r.createdAt,

        "INVALID_RESOLUTION"

      );


      /* FULL REFUND VALIDATION */

      need(

        r.status !== "refunded" ||

        s.amount === r.amount,

        "REFUND_AMOUNT_MISMATCH"

      );

    }

  }


  /* ======================================
     V1.6A REWARD RECEIPT COMPATIBILITY
  ====================================== */

  const receipts =
    user.gameRewardReceipts === undefined

      ? {}

      : user.gameRewardReceipts;


  need(

    obj(receipts),

    "INVALID_REWARD_RECEIPTS"

  );


  for (const [key, r] of Object.entries(receipts)) {

    need(

      /^[a-f0-9]{64}$/.test(key) &&

      obj(r) &&

      r.id === key &&

      r.game === "wheel8" &&

      r.kind === "existing_reward" &&

      positive(r.roundId) &&

      positive(r.amount) &&

      positive(r.ts),

      "INVALID_LEGACY_REWARD_RECEIPT"

    );

  }


  return {

    entries,

    rewardReceipts:
      Object.keys(receipts).length

  };

}


/* ==========================================
   GLOBAL GAME LEDGER AUDIT
========================================== */

function auditUsers(users) {

  need(

    obj(users),

    "INVALID_USERS"

  );


  const report = {

    mode: "READ_ONLY",

    accounts: 0,

    ledgerEntries: 0,

    pending: 0,

    refunded: 0,

    settled: 0,

    invalidAccounts: 0,

    conflicts: 0,

    pendingAmount: "0",

    rewardReceipts: 0,

    pendingDoubleOffers: 0,

    activationAllowed: false

  };


  let pending = 0n;


  const ids = new Set();

  const evidence = new Set();

  const rounds = new Map();


  /* ======================================
     ACCOUNT INVENTORY
  ====================================== */

  for (const [uid, user] of Object.entries(users)) {

    report.accounts++;


    if (user?.wheel8DoubleOffer?.status === "pending") {

      report.pendingDoubleOffers++;

    }


    let data;


    try {

      data = inspectAccount(uid, user);

    } catch {

      report.invalidAccounts++;

      continue;

    }


    report.rewardReceipts +=
      data.rewardReceipts;


    /* ====================================
       GLOBAL DUPLICATE DETECTION
    ==================================== */

    for (const [id, r] of data.entries) {

      report.ledgerEntries++;

      report[r.status]++;


      /* DUPLICATE TRANSACTION ID */

      if (ids.has(id)) {

        report.conflicts++;

      }

      ids.add(id);


      /* ROUND ID CONFLICT */

      if (

        rounds.has(r.roundKey) &&

        rounds.get(r.roundKey) !== r.game

      ) {

        report.conflicts++;

      }

      rounds.set(

        r.roundKey,

        r.game

      );


      /* DUPLICATE RESOLUTION EVIDENCE */

      if (r.resolution) {

        if (evidence.has(r.resolution.evidenceId)) {

          report.conflicts++;

        }


        evidence.add(
          r.resolution.evidenceId
        );

      }


      /* PENDING AMOUNT */

      if (r.status === "pending") {

        pending += BigInt(r.amount);

      }

    }

  }


  report.pendingAmount =
    pending.toString();


  return report;

}


/* ==========================================
   ACCOUNT DELETION PROTECTION
========================================== */

function deletionIssues(uid, user) {

  try {

    const d = inspectAccount(uid, user);


    /* ACTIVE OBLIGATIONS */

    if (

      d.entries.some(

        ([, r]) => r.status === "pending"

      )

    ) {

      return [

        "Game obligation requires reconciliation"

      ];

    }


    /* FINANCIAL RECEIPT RETENTION */

    if (

      d.entries.length ||

      d.rewardReceipts

    ) {

      return [

        "Game financial receipts require verified retention"

      ];

    }


    return [];


  } catch {

    return [

      "Game ledger invalid; reconciliation required"

    ];

  }

}


/* ==========================================
   READ ONLY USERS DATABASE
========================================== */

function readUsers(file) {

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

      st.size <= 64 * 1024 * 1024,

      "INVALID_USERS_FILE"

    );


    return JSON.parse(

      fs.readFileSync(fd, "utf8")

    );


  } finally {

    fs.closeSync(fd);

  }

}


/* ==========================================
   OFFLINE LEDGER REHEARSAL
   SYNTHETIC DATA ONLY
========================================== */

function test() {

  const root = fs.mkdtempSync(

    path.join(

      os.tmpdir(),

      "lsp-game-ledger-test-"

    )

  );


  const file = path.join(

    root,

    "users.json"

  );


  /* ======================================
     TEST DATABASE WRITER

     ONLY WRITES INSIDE TEMP TEST DIRECTORY
  ====================================== */

  function writeFixture(data) {

    const tmp = path.join(

      root,

      crypto.randomUUID() + ".tmp"

    );


    const fd = fs.openSync(

      tmp,

      "wx",

      0o600

    );


    try {

      fs.writeFileSync(

        fd,

        JSON.stringify(data)

      );

      fs.fsyncSync(fd);


    } finally {

      fs.closeSync(fd);

    }


    fs.renameSync(tmp, file);


    const dir = fs.openSync(root, "r");


    try {

      fs.fsyncSync(dir);

    } finally {

      fs.closeSync(dir);

    }

  }


  try {

    const id = crypto.randomUUID();

    const roundKey = crypto.randomUUID();


    /* SYNTHETIC FINANCIAL RECORD */

    const r = {

      id,

      uid: "TEST_A",

      game: "wheel8",

      roundKey,

      amount: 100,

      createdAt: 1,

      status: "pending",

      resolution: null

    };


    const users = {

      TEST_A: {

        profile: {

          coins: 900

        },

        [FIELD]: {

          version: 1,

          entries: {

            [id]: r

          }

        }

      },


      TEST_B: {

        profile: {

          coins: 500

        }

      }

    };


    /* SAVE AND RELOAD FIXTURE */

    writeFixture(users);

    const loaded = readUsers(file);


    assert.equal(

      auditUsers(loaded).pendingAmount,

      "100"

    );


    assert.equal(

      deletionIssues(
        "TEST_A",
        loaded.TEST_A
      ).length,

      1

    );


    /* SYNTHETIC REFUND EVIDENCE */

    const closed =

      loaded.TEST_A[FIELD].entries[id];


    closed.status = "refunded";

    closed.resolution = {

      evidenceId: crypto.randomUUID(),

      amount: 100,

      at: 2

    };


    // Test evidence only.
    // No wallet balance changes.

    writeFixture(loaded);


    /* RELOAD PERSISTED RECORDS */

    const restarted = readUsers(file);


    assert.equal(

      auditUsers(restarted).refunded,

      1

    );


    assert.equal(

      auditUsers(restarted).pendingAmount,

      "0"

    );


    /* CONFIRM NO WALLET MUTATION */

    assert.equal(

      restarted.TEST_A.profile.coins,

      900

    );


    assert.equal(

      restarted.TEST_B.profile.coins,

      500

    );


    /* RECEIPT RETENTION */

    assert.equal(

      deletionIssues(

        "TEST_A",

        restarted.TEST_A

      ).length,

      1

    );


    assert.equal(

      deletionIssues(

        "TEST_B",

        restarted.TEST_B

      ).length,

      0

    );


    /* INVALID REFUND DETECTION */

    const bad = structuredClone(restarted);

    bad.TEST_A[FIELD]
      .entries[id]
      .resolution.amount = 99;


    assert.equal(

      auditUsers(bad).invalidAccounts,

      1

    );


    /* DUPLICATE TRANSACTION DETECTION */

    const conflict = structuredClone(restarted);


    conflict.TEST_B[FIELD] = {

      version: 1,

      entries: {

        [id]: {

          ...r,

          uid: "TEST_B"

        }

      }

    };


    assert.equal(

      auditUsers(conflict).conflicts,

      1

    );


    /* LEGACY REWARD RECEIPT TEST */

    const hash = "a".repeat(64);

    const legacy = structuredClone(restarted);


    legacy.TEST_B.gameRewardReceipts = {

      [hash]: {

        id: hash,

        game: "wheel8",

        kind: "existing_reward",

        roundId: 1,

        amount: 10,

        ts: 1

      }

    };


    assert.equal(

      auditUsers(legacy).rewardReceipts,

      1

    );


    assert.equal(

      deletionIssues(

        "TEST_B",

        legacy.TEST_B

      ).length,

      1

    );


    /* PREVENT PRODUCTION ACTIVATION */

    assert.equal(

      auditUsers(restarted).activationAllowed,

      false

    );


    console.log(

      "[GAME LEDGER TEST] PASS"

    );


  } finally {

    fs.rmSync(root, {

      recursive: true,

      force: true

    });

  }

}


/* ==========================================
   MODULE EXPORTS
========================================== */

module.exports = {

  auditUsers,

  deletionIssues

};


/* ==========================================
   COMMAND LINE TOOLS
========================================== */

if (require.main === module) {

  try {

    if (

      process.argv[2] === "test" &&

      process.argv.length === 3

    ) {

      test();


    } else if (

      process.argv[2] === "audit" &&

      process.argv.length === 3

    ) {

      console.log(

        JSON.stringify(

          auditUsers(

            readUsers(

              "/opt/render/project/data/users.json"

            )

          ),

          null,

          2

        )

      );


    } else {

      throw new Error(

        "Usage: test | audit"

      );

    }


  } catch (error) {

    console.error(

      "[GAME LEDGER] FAILED",

      error.code || error.message

    );


    process.exitCode = 1;

  }

}