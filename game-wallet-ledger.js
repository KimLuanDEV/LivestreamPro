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
   LIVESTREAM PRO
   GAME WALLET RECOVERY V1.6C
   READ ONLY RECOVERY AUDIT
========================================== */

function recoveryReport(users) {

  const report = auditUsers(users);

  let invalidBalances = 0;
  let legacyCompletedOffers = 0;
  let invalidOfferStates = 0;

  const pendingByGame = {

    wheel8: 0n,

    dtp: 0n,

    "time-race": 0n

  };


  /* ======================================
     ACCOUNT FINANCIAL INVENTORY
  ====================================== */

  for (const [uid, user] of Object.entries(users)) {

    if (!nonnegative(user?.profile?.coins)) {

      invalidBalances++;

    }


    /* LEGACY DOUBLE REWARD INVENTORY */

    const offer = user?.wheel8DoubleOffer;

    if (offer !== undefined) {

      if (offer?.status === "completed") {

        legacyCompletedOffers++;

      } else if (offer?.status !== "pending") {

        invalidOfferStates++;

      }

    }


    /* PENDING OBLIGATIONS BY GAME */

    try {

      for (
        const [, r] of inspectAccount(uid, user).entries
      ) {

        if (r.status === "pending") {

          pendingByGame[r.game] += BigInt(r.amount);

        }

      }

    } catch {

      // Invalid accounts are recorded by auditUsers.

    }

  }


  /* ======================================
     PRODUCTION ACTIVATION BLOCKERS
  ====================================== */

  const blockers = [

    "LIVE_ROUND_OBLIGATIONS_NOT_VERIFIED",

    "INDEPENDENT_FINANCIAL_EVIDENCE_NOT_VERIFIED",

    "BACKUP_FORWARD_RECOVERY_NOT_VERIFIED",

    "PRODUCTION_SETTLEMENT_NOT_ENABLED"

  ];


  if (

    report.invalidAccounts ||

    report.conflicts ||

    invalidBalances ||

    invalidOfferStates

  ) {

    blockers.push("INVALID_FINANCIAL_DATA");

  }


  if (

    report.pending ||

    report.pendingDoubleOffers

  ) {

    blockers.push("UNRESOLVED_OBLIGATIONS");

  }


  /* ======================================
     FINAL RECOVERY REPORT
  ====================================== */

  return {

    ...report,

    mode: "RECOVERY_READ_ONLY",

    invalidBalances,

    legacyCompletedOffers,

    invalidOfferStates,

    pendingByGame: Object.fromEntries(

      Object.entries(pendingByGame).map(

        ([k, v]) => [k, v.toString()]

      )

    ),

    pendingTotalsPartial:

      report.invalidAccounts > 0 ||

      report.conflicts > 0,

    blockers,

    activationAllowed: false

  };

}



/* ==========================================
   LIVESTREAM PRO
   SETTLEMENT & RECOVERY TEST V1.6C

   SYNTHETIC DATA ONLY
   NO PRODUCTION WALLET ACCESS
========================================== */

function recoveryTest() {

  const { createJsonWalletAdapter } =

    require("./wallet-storage-adapter");


  const root = fs.mkdtempSync(

    path.join(

      os.tmpdir(),

      "lsp-recovery-test-"

    )

  );


  const file = path.join(

    root,

    "users.json"

  );


  const uid = "TEST_A";

  const id = crypto.randomUUID();

  const roundKey = crypto.randomUUID();

  const evidenceId = crypto.randomUUID();


  /* ======================================
     SIMULATED INDEPENDENT REFUND EVIDENCE
  ====================================== */

  const evidence = Object.freeze({

    uid,

    id,

    roundKey,

    amount: 100,

    evidenceId

  });


  /* ======================================
     TEST ACCOUNT DATABASE
  ====================================== */

  const initial = {

    TEST_A: {

      profile: {

        coins: 900

      },

      [FIELD]: {

        version: 1,

        entries: {

          [id]: {

            id,

            uid,

            game: "wheel8",

            roundKey,

            amount: 100,

            createdAt: 1,

            status: "pending",

            resolution: null

          }

        }

      }

    },


    TEST_B: {

      profile: {

        coins: 500

      }

    }

  };


  let fault = "";


  /* ======================================
     ATOMIC TEST FILE STORAGE
  ====================================== */

  function writeFixture(users) {

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

        JSON.stringify(users)

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


  /* ======================================
     TEST WALLET ADAPTER

     USES REAL JSON ADAPTER INTERFACE
     WITH A SIMULATED STORAGE BACKEND
  ====================================== */

  function openAdapter() {

    return createJsonWalletAdapter({

      begin(uids) {

        need(

          uids.length === 1 &&

          uids[0] === uid,

          "TEST_UID_ONLY"

        );


        const before = fs.readFileSync(

          file,

          "utf8"

        );


        const snapshot = JSON.parse(before);


        const users = {

          [uid]: structuredClone(snapshot[uid])

        };


        let committed = false;


        return {

          users,


          commit(changed) {

            need(

              !committed &&

              changed.length === 1 &&

              changed[0] === uid,

              "TEST_COMMIT_INVALID"

            );


            need(

              fs.readFileSync(file, "utf8") === before,

              "TEST_STALE_SNAPSHOT"

            );


            /* FAILURE BEFORE COMMIT */

            if (fault === "before") {

              throw new Error(

                "TEST_BEFORE_COMMIT"

              );

            }


            snapshot[uid] = users[uid];


            /* DURABLE COMMIT */

            writeFixture(snapshot);

            committed = true;


            /* FAILURE AFTER COMMIT */

            if (fault === "after") {

              throw new Error(

                "TEST_AFTER_COMMIT"

              );

            }

          }

        };

      }

    });

  }


  /* ======================================
     REFUND SETTLEMENT REHEARSAL

     PRIVATE TEST FUNCTION ONLY
  ====================================== */

  function refundFixture(adapter, proof) {

    /* VERIFY SIMULATED TRUSTED EVIDENCE */

    need(

      proof &&

      Object.keys(evidence).every(

        k => proof[k] === evidence[k]

      ),

      "TEST_EVIDENCE_MISMATCH"

    );


    const tx = adapter.begin([uid]);

    const user = tx.users[uid];


    inspectAccount(uid, user);


    const r = user[FIELD].entries[id];


    /* VERIFY OBLIGATION */

    need(

      r &&

      r.uid === proof.uid &&

      r.roundKey === proof.roundKey &&

      r.amount === proof.amount,

      "TEST_OBLIGATION_MISMATCH"

    );


    /* ==================================
       DUPLICATE REFUND PROTECTION
    ================================== */

    if (r.status === "refunded") {

      need(

        r.resolution.evidenceId === proof.evidenceId &&

        r.resolution.amount === proof.amount,

        "TEST_RESOLUTION_CONFLICT"

      );


      return "duplicate";

    }


    /* ONLY REFUND PENDING OBLIGATIONS */

    need(

      r.status === "pending",

      "TEST_NOT_PENDING"

    );


    /* STRICT BALANCE VALIDATION */

    const coins = user.profile.coins;


    need(

      nonnegative(coins) &&

      nonnegative(coins + r.amount),

      "TEST_BALANCE_OVERFLOW"

    );


    /* CREDIT ORIGINAL AMOUNT */

    user.profile.coins = coins + r.amount;


    /* SAVE RESOLUTION RECEIPT */

    r.status = "refunded";


    r.resolution = {

      evidenceId: proof.evidenceId,

      amount: r.amount,

      at: Date.now()

    };


    inspectAccount(uid, user);


    /* ATOMIC WALLET + RECEIPT COMMIT */

    tx.commit([uid]);


    return "refunded";

  }


  /* ======================================
     RUN RECOVERY TEST SUITE
  ====================================== */

  try {

    writeFixture(initial);


    /* INITIAL PENDING INVENTORY */

    assert.equal(

      recoveryReport(
        readUsers(file)
      ).pendingAmount,

      "100"

    );


    /* REJECT INVALID REFUND EVIDENCE */

    assert.throws(

      () => refundFixture(

        openAdapter(),

        {

          ...evidence,

          amount: 99

        }

      ),

      /TEST_EVIDENCE_MISMATCH/

    );


    /* ==================================
       SIMULATE FAILURE BEFORE COMMIT
    ================================== */

    fault = "before";


    assert.throws(

      () => refundFixture(

        openAdapter(),

        evidence

      ),

      /TEST_BEFORE_COMMIT/

    );


    /* ORIGINAL DATA MUST BE UNCHANGED */

    assert.deepEqual(

      readUsers(file),

      initial

    );


    /* ==================================
       SIMULATE FAILURE AFTER COMMIT
    ================================== */

    fault = "after";


    assert.throws(

      () => refundFixture(

        openAdapter(),

        evidence

      ),

      /TEST_AFTER_COMMIT/

    );


    fault = "";


    /* ==================================
       REOPEN ADAPTER AND RETRY
    ================================== */

    assert.equal(

      refundFixture(

        openAdapter(),

        evidence

      ),

      "duplicate"

    );


    const result = readUsers(file);


    /* WALLET CREDIT EXACTLY ONCE */

    assert.equal(

      result.TEST_A.profile.coins,

      1000

    );


    /* PRESERVE OTHER ACCOUNTS */

    assert.deepEqual(

      result.TEST_B,

      initial.TEST_B

    );


    /* NO OUTSTANDING OBLIGATIONS */

    assert.equal(

      recoveryReport(result).pendingAmount,

      "0"

    );


    assert.equal(

      recoveryReport(result).refunded,

      1

    );


    /* PRODUCTION REMAINS DISABLED */

    assert.equal(

      recoveryReport(result).activationAllowed,

      false

    );


    /* FINANCIAL RECEIPT RETENTION */

    assert.equal(

      deletionIssues(

        uid,

        result.TEST_A

      ).length,

      1

    );


    /* CROSS-ACCOUNT EVIDENCE PROTECTION */

    assert.throws(

      () => refundFixture(

        openAdapter(),

        {

          ...evidence,

          uid: "TEST_B"

        }

      ),

      /TEST_EVIDENCE_MISMATCH/

    );


    /* ==================================
       WALLET OVERFLOW PROTECTION
    ================================== */

    const bad = structuredClone(initial);


    bad.TEST_A.profile.coins =

      Number.MAX_SAFE_INTEGER;


    writeFixture(bad);


    assert.throws(

      () => refundFixture(

        openAdapter(),

        evidence

      ),

      /TEST_BALANCE_OVERFLOW/

    );


    assert.deepEqual(

      readUsers(file),

      bad

    );


    console.log(

      "[GAME RECOVERY TEST] PASS"

    );


  } finally {

    fs.rmSync(root, {

      recursive: true,

      force: true

    });

  }

}




/* ==========================================
   LIVESTREAM PRO
   GAME FINANCIAL RECONCILIATION V1.6D
   READ ONLY
========================================== */

function financialReconciliation(
  users,
  wheelHistory = null
) {

  const report = recoveryReport(users);

  need(
    wheelHistory === null || obj(wheelHistory),
    "INVALID_WHEEL_HISTORY"
  );

  const legacy = {
    completed: 0,
    pending: 0,
    invalid: 0,
    completedWithoutReceipt: 0,
    matchingReceipt: 0,
    receiptConflict: 0,
    historyCandidateMatch: 0,
    historyMissing: 0,
    historyMismatchOrAmbiguous: 0,
    historyNotChecked: 0,
    recordedReward: "0"
  };

  const history = {
    dtp: 0,
    timeRace: 0,
    wheel8: 0,
    invalidLists: 0,
    invalidRows: 0,
    orphanWheelAccounts: 0,
    wheelHistoryAvailable: wheelHistory !== null
  };

  let reward = 0n;

  const wheelGroups = new Map();

  const sides = [
    "dragon",
    "tiger",
    "phoenix"
  ];


  /* ======================================
     WHEEL8 HISTORY INVENTORY
  ====================================== */

  if (wheelHistory !== null) {

    for (
      const [uid, rows] of Object.entries(wheelHistory)
    ) {

      if (!Object.hasOwn(users, uid)) {
        history.orphanWheelAccounts++;
      }

      if (!Array.isArray(rows)) {
        history.invalidLists++;
        continue;
      }

      const groups = new Map();

      wheelGroups.set(uid, groups);

      for (const r of rows) {

        history.wheel8++;

        if (
          !obj(r) ||
          !positive(r.roundId) ||
          !positive(r.ts) ||
          !positive(r.bet) ||
          !nonnegative(r.win)
        ) {

          history.invalidRows++;

          continue;

        }

        const key = `${r.roundId}:${r.ts}`;

        const g = groups.get(key) || {
          roundId: r.roundId,
          ts: r.ts,
          bet: 0n,
          win: 0n
        };

        g.bet += BigInt(r.bet);
        g.win += BigInt(r.win);

        groups.set(key, g);

      }

    }

  }


  /* ======================================
     ACCOUNT FINANCIAL INVENTORY
  ====================================== */

  for (const [uid, user] of Object.entries(users)) {

    /* DTP / TIME RACE HISTORY */

    for (const [field, counter] of [

      ["dtpHistory", "dtp"],

      ["timeRaceHistory", "timeRace"]

    ]) {

      const rows = user?.[field];

      if (rows === undefined) continue;

      if (!Array.isArray(rows)) {

        history.invalidLists++;

        continue;

      }

      for (const r of rows) {

        history[counter]++;

        const valid =

          obj(r) &&

          positive(r.ts) &&

          nonnegative(r.win) &&

          (
            counter === "dtp"

              ? positive(r.round) &&
                sides.every(k => nonnegative(r[k])) &&
                sides.includes(r.winner)

              : positive(r.roundId) &&
                positive(r.bet) &&
                Number.isFinite(r.stopMultiplier) &&
                r.stopMultiplier >= 0 &&
                ["win", "lose"].includes(r.result)
          );

        if (!valid) {
          history.invalidRows++;
        }

      }

    }


    /* ======================================
       LEGACY DOUBLE OFFER VALIDATION
    ====================================== */

    const o = user?.wheel8DoubleOffer;

    if (o === undefined) continue;

    if (o?.status === "completed") {
      legacy.completed++;
    }

    if (o?.status === "pending") {
      legacy.pending++;
    }

    const baseValid =

      obj(o) &&

      positive(o.roundId) &&

      positive(o.expiresAt) &&

      positive(o.totalBet) &&

      positive(o.totalWin) &&

      positive(o.profit) &&

      o.totalWin - o.totalBet === o.profit &&

      ["pending", "completed"].includes(o.status);

    if (!baseValid) {

      legacy.invalid++;

      continue;

    }


    /* ======================================
       COMPLETED OFFER RECEIPT VALIDATION
    ====================================== */

    if (o.status === "completed") {

      if (

        !positive(o.completedAt) ||

        !nonnegative(o.reward) ||

        !["keep", "red", "black"].includes(o.action)

      ) {

        legacy.invalid++;

        continue;

      }

      // Inspect recorded amounts only.
      // Do not certify game outcomes.

      if (
        o.action === "keep" &&
        o.reward !== o.profit
      ) {

        legacy.invalid++;

        continue;

      }

      reward += BigInt(o.reward);


      /* RECONSTRUCT V1.6A RECEIPT KEY */

      const key = crypto

        .createHash("sha256")

        .update(JSON.stringify([

          "WHEEL8_KEEP_V16",

          uid,

          o.roundId,

          o.expiresAt,

          o.totalBet,

          o.totalWin,

          o.profit

        ]))

        .digest("hex");


      const receipts = user.gameRewardReceipts;

      const r =

        obj(receipts) &&
        Object.hasOwn(receipts, key)

          ? receipts[key]

          : undefined;


      if (r === undefined) {

        legacy.completedWithoutReceipt++;

      } else if (

        o.action === "keep" &&

        obj(r) &&

        r.id === key &&

        r.game === "wheel8" &&

        r.kind === "existing_reward" &&

        r.roundId === o.roundId &&

        r.amount === o.reward &&

        r.ts === o.completedAt

      ) {

        legacy.matchingReceipt++;

      } else {

        legacy.receiptConflict++;

      }

    }


    /* ======================================
       HISTORICAL CANDIDATE MATCHING
       NOT INDEPENDENT PAYMENT EVIDENCE
    ====================================== */

    if (wheelHistory === null) {

      legacy.historyNotChecked++;

      continue;

    }

    const candidates = [

      ...(wheelGroups.get(uid)?.values() || [])

    ].filter(g =>

      g.roundId === o.roundId &&

      g.ts <= o.expiresAt &&

      o.expiresAt - g.ts <= 120000

    );

    if (!candidates.length) {

      legacy.historyMissing++;

    } else if (

      candidates.length === 1 &&

      candidates[0].bet === BigInt(o.totalBet) &&

      candidates[0].win === BigInt(o.totalWin)

    ) {

      legacy.historyCandidateMatch++;

    } else {

      legacy.historyMismatchOrAmbiguous++;

    }

  }


  /* ======================================
     RECONCILIATION SUMMARY
  ====================================== */

  legacy.recordedReward = reward.toString();

  const blockers = new Set(report.blockers);

  if (

    legacy.invalid ||

    legacy.receiptConflict ||

    history.invalidLists ||

    history.invalidRows

  ) {

    blockers.add("LEGACY_DATA_REVIEW_REQUIRED");

  }

  if (

    legacy.completedWithoutReceipt ||

    legacy.historyMissing ||

    legacy.historyMismatchOrAmbiguous

  ) {

    blockers.add("LEGACY_EVIDENCE_INCOMPLETE");

  }

  return {

    ...report,

    mode: "FINANCIAL_RECONCILIATION_READ_ONLY",

    legacy,

    history,

    blockers: [...blockers],

    activationAllowed: false

  };

}


/* ==========================================
   BACKUP FINANCIAL COMPARISON V1.6D
========================================== */

function compareBackupWithLive(archived) {

  const current = readUsers(
    "/opt/render/project/data/users.json"
  );

  return compareFinancialRecords(
    archived,
    current
  );

}


function compareFinancialRecords(
  archived,
  current
) {

  const equal =
    require("node:util").isDeepStrictEqual;

  const oldReport = recoveryReport(archived);

  const newReport = recoveryReport(current);

  const result = {

    missingLedgerEntries: 0,

    changedLedgerEntries: 0,

    pendingTransitionsToTerminal: 0,

    missingRewardReceipts: 0,

    changedRewardReceipts: 0,

    legacyOffersChangedOrMissing: 0,

    accountsMissingFromCurrent: 0,

    partial: Boolean(

      oldReport.invalidAccounts ||

      oldReport.conflicts ||

      newReport.invalidAccounts ||

      newReport.conflicts

    ),

    activationAllowed: false

  };


  /* ======================================
     COMPARE HISTORICAL ACCOUNTS
  ====================================== */

  for (
    const [uid, oldUser] of Object.entries(archived)
  ) {

    const currentUser =
      Object.hasOwn(current, uid)

        ? current[uid]

        : undefined;


    if (currentUser === undefined) {

      result.accountsMissingFromCurrent++;

    }


    let oldData;
    let newData;

    try {

      oldData = inspectAccount(uid, oldUser);

      newData = currentUser === undefined

        ? { entries: [] }

        : inspectAccount(uid, currentUser);

    } catch {

      result.partial = true;

      continue;

    }


    /* ======================================
       PERSISTENT LEDGER COMPARISON
    ====================================== */

    const entries = new Map(newData.entries);

    for (const [id, old] of oldData.entries) {

      const now = entries.get(id);

      if (!now) {

        result.missingLedgerEntries++;

      } else if (!equal(old, now)) {

        const fields = [

          "id",

          "uid",

          "game",

          "roundKey",

          "amount",

          "createdAt"

        ];


        if (

          old.status === "pending" &&

          ["settled", "refunded"].includes(now.status) &&

          fields.every(k => old[k] === now[k])

        ) {

          result.pendingTransitionsToTerminal++;

        } else {

          result.changedLedgerEntries++;

        }

      }

    }


    /* ======================================
       REWARD RECEIPT COMPARISON
    ====================================== */

    const receipts =
      currentUser?.gameRewardReceipts || {};

    for (
      const [id, old] of Object.entries(
        oldUser.gameRewardReceipts || {}
      )
    ) {

      if (!Object.hasOwn(receipts, id)) {

        result.missingRewardReceipts++;

      } else if (!equal(old, receipts[id])) {

        result.changedRewardReceipts++;

      }

    }


    /* ======================================
       LEGACY OFFER RETENTION
    ====================================== */

    if (

      oldUser.wheel8DoubleOffer !== undefined &&

      !equal(
        oldUser.wheel8DoubleOffer,
        currentUser?.wheel8DoubleOffer
      )

    ) {

      result.legacyOffersChangedOrMissing++;

    }

  }

  return result;

}



/* ==========================================
   FINANCIAL RECONCILIATION TEST V1.6D
   SYNTHETIC DATA ONLY
========================================== */

function reconciliationTest() {

  const uid = "TEST_A";

  const o = {

    roundId: 7,

    totalBet: 100,

    totalWin: 500,

    profit: 400,

    expiresAt: 1000000,

    status: "completed",

    action: "keep",

    reward: 400,

    completedAt: 1000001

  };


  const key = crypto

    .createHash("sha256")

    .update(JSON.stringify([

      "WHEEL8_KEEP_V16",

      uid,

      o.roundId,

      o.expiresAt,

      o.totalBet,

      o.totalWin,

      o.profit

    ]))

    .digest("hex");


  const id = crypto.randomUUID();


  const users = {

    [uid]: {

      profile: {
        coins: 1500
      },

      wheel8DoubleOffer: o,

      gameRewardReceipts: {

        [key]: {

          id: key,

          game: "wheel8",

          kind: "existing_reward",

          roundId: 7,

          amount: 400,

          ts: o.completedAt

        }

      },

      [FIELD]: {

        version: 1,

        entries: {

          [id]: {

            id,

            uid,

            game: "dtp",

            roundKey: crypto.randomUUID(),

            amount: 100,

            createdAt: 1,

            status: "pending",

            resolution: null

          }

        }

      }

    }

  };


  const wheel = {

    [uid]: [

      {

        roundId: 7,

        ts: 905000,

        bet: 100,

        win: 500

      }

    ]

  };


  const original = structuredClone(users);


  /* VALID RECEIPT MATCH */

  let r = financialReconciliation(
    users,
    wheel
  );

  assert.equal(r.legacy.matchingReceipt, 1);

  assert.equal(r.legacy.historyCandidateMatch, 1);

  assert.equal(r.activationAllowed, false);


  /* VERIFY READ ONLY BEHAVIOR */

  assert.deepEqual(users, original);


  /* MISSING HISTORY */

  assert.equal(

    financialReconciliation(users, {})
      .legacy.historyMissing,

    1

  );

  assert.equal(

    financialReconciliation(users)
      .legacy.historyNotChecked,

    1

  );


  /* INVALID LEGACY REWARD */

  const bad = structuredClone(users);

  bad[uid].wheel8DoubleOffer.reward = 399;

  assert.equal(

    financialReconciliation(bad)
      .legacy.invalid,

    1

  );


  /* MISSING FINANCIAL RECORDS */

  const missing = structuredClone(users);

  delete missing[uid].gameRewardReceipts[key];

  delete missing[uid][FIELD].entries[id];

  r = compareFinancialRecords(
    users,
    missing
  );

  assert.equal(r.missingRewardReceipts, 1);

  assert.equal(r.missingLedgerEntries, 1);


  /* CHANGED FINANCIAL RECEIPT */

  const changed = structuredClone(users);

  changed[uid].gameRewardReceipts[key].amount++;

  assert.equal(

    compareFinancialRecords(users, changed)
      .changedRewardReceipts,

    1

  );


  /* TERMINAL STATE TRANSITION */

  const terminal = structuredClone(users);

  terminal[uid][FIELD].entries[id].status =
    "refunded";

  terminal[uid][FIELD].entries[id].resolution = {

    evidenceId: crypto.randomUUID(),

    amount: 100,

    at: 2

  };

  assert.equal(

    compareFinancialRecords(users, terminal)
      .pendingTransitionsToTerminal,

    1

  );


  /* DETECT STATUS ROLLBACK */

  assert.equal(

    compareFinancialRecords(terminal, users)
      .changedLedgerEntries,

    1

  );


  console.log(
    "[GAME RECONCILIATION TEST] PASS"
  );

}


/* ==========================================
   MODULE EXPORTS
========================================== */

module.exports = {

  auditUsers,

  deletionIssues,

  recoveryReport,

  financialReconciliation,

  compareBackupWithLive,

  compareFinancialRecords

};


/* ==========================================
   GAME WALLET COMMAND LINE TOOLS V1.6C
========================================== */

if (require.main === module) {

  try {

    const command = process.argv[2];

    if (process.argv.length !== 3) {

      throw new Error("INVALID_ARGUMENTS");

    }


    /* V1.6B ORIGINAL TEST */

    if (command === "test") {

      test();


    /* V1.6C RECOVERY TEST */

    } else if (command === "recovery-test") {

      recoveryTest();


    /* V1.6B ORIGINAL AUDIT */

    } else if (command === "audit") {

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


    /* V1.6C RECOVERY AUDIT */

    } else if (command === "recovery-audit") {

      console.log(

        JSON.stringify(

          recoveryReport(

            readUsers(

              "/opt/render/project/data/users.json"

            )

          ),

          null,

          2

        )

      );


    /* ====================================
       V1.6D FINANCIAL RECONCILIATION TEST
    ==================================== */

    } else if (
      command === "reconciliation-test"
    ) {

      reconciliationTest();


    /* ====================================
       V1.6D PRODUCTION READ ONLY AUDIT
    ==================================== */

    } else if (
      command === "reconciliation-audit"
    ) {

      console.log(

        JSON.stringify(

          financialReconciliation(

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

        "Usage: test | audit | recovery-test | " +

        "recovery-audit | reconciliation-test | " +

        "reconciliation-audit"

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