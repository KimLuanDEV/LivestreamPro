"use strict";

/* ==========================================
   LIVESTREAM PRO
   TRANSACTION SECURITY V1.0
========================================== */

const crypto = require("crypto");

const MAX_AMOUNT = 1000000000;

const SECURITY_LIMIT = 5;
const SECURITY_LOCK_MS = 15 * 60 * 1000;

const MAX_TRACKED_ACCOUNTS = 20000;

const attempts = new Map();
const activeChecks = new Set();

const recentEvents = [];

const stats = {
  startedAt: Date.now(),
  invalidAmounts: 0,
  invalidBalances: 0,
  securityFailures: 0,
  securityBlocked: 0,
  concurrentBlocked: 0,
  duplicateRequests: 0,
  successfulTransactions: 0,
  storageErrors: 0
};


/* ==========================================
   SECURITY EVENT LOGGER
========================================== */

function record(type, uid = "") {

  if (!Object.hasOwn(stats, type)) return;

  if (type === "startedAt") return;

  stats[type]++;

  recentEvents.unshift({

    id: crypto.randomUUID(),

    type,

    uid: String(uid).slice(0, 128),

    time: new Date().toISOString()

  });

  if (recentEvents.length > 100) {
    recentEvents.length = 100;
  }

}


/* ==========================================
   STRICT AMOUNT VALIDATION
========================================== */

function parseAmount(value, uid = "") {

  let amount = value;

  if (typeof value === "string") {

    if (!/^[1-9][0-9]{0,9}$/.test(value)) {

      record("invalidAmounts", uid);

      return null;

    }

    amount = Number(value);

  }

  if (
    typeof amount !== "number" ||
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    amount > MAX_AMOUNT
  ) {

    record("invalidAmounts", uid);

    return null;

  }

  return amount;

}


/* ==========================================
   BALANCE VALIDATION
========================================== */

function parseBalance(value, uid = "") {

  const balance = value ?? 0;

  if (
    typeof balance !== "number" ||
    !Number.isSafeInteger(balance) ||
    balance < 0
  ) {

    record("invalidBalances", uid);

    return null;

  }

  return balance;

}


function canDebit(balance, amount, uid = "") {

  const current = parseBalance(balance, uid);

  return (
    current !== null &&
    Number.isSafeInteger(amount) &&
    amount > 0 &&
    current >= amount
  );

}


function canCredit(balance, amount, uid = "") {

  const current = parseBalance(balance, uid);

  return (
    current !== null &&
    Number.isSafeInteger(amount) &&
    amount > 0 &&
    Number.isSafeInteger(current + amount)
  );

}


/* ==========================================
   TRANSACTION REQUEST ID
========================================== */

function isValidRequestId(value) {

  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(value)
  );

}


/* ==========================================
   SHARED SECURITY CODE PROTECTION
========================================== */

async function verifySecurityCode(
  uid,
  code,
  hash,
  compare
) {

  if (
    typeof uid !== "string" ||
    !uid ||
    typeof code !== "string" ||
    !code ||
    Buffer.byteLength(code, "utf8") > 72 ||
    typeof hash !== "string" ||
    typeof compare !== "function"
  ) {

    return {
      ok: false,
      error: "INVALID_SECURITY_CODE"
    };

  }

  const now = Date.now();

  let state = attempts.get(uid);

  if (state && state.expiresAt <= now) {

    attempts.delete(uid);

    state = null;

  }

  if (state && state.count >= SECURITY_LIMIT) {

    record("securityBlocked", uid);

    return {

      ok: false,

      error: "SECURITY_CODE_LOCKED",

      retryAfter: Math.max(
        1,
        Math.ceil(
          (state.expiresAt - now) / 1000
        )
      )

    };

  }

  if (activeChecks.has(uid)) {

    record("concurrentBlocked", uid);

    return {
      ok: false,
      error: "TRANSACTION_BUSY"
    };

  }

  if (
    !state &&
    attempts.size >= MAX_TRACKED_ACCOUNTS
  ) {

    return {
      ok: false,
      error: "SECURITY_BUSY"
    };

  }

  if (activeChecks.size >= 100) {

    return {
      ok: false,
      error: "SECURITY_BUSY"
    };

  }

  if (!state) {

    state = {
      count: 0,
      expiresAt: now + SECURITY_LOCK_MS
    };

    attempts.set(uid, state);

  }

  activeChecks.add(uid);

  try {

    const valid = await compare(code, hash);

    if (!valid) {

      state.count++;

      record("securityFailures", uid);

      if (state.count >= SECURITY_LIMIT) {

        state.expiresAt =
          Date.now() + SECURITY_LOCK_MS;

        return {
          ok: false,
          error: "SECURITY_CODE_LOCKED",
          retryAfter: SECURITY_LOCK_MS / 1000
        };

      }

      return {
        ok: false,
        error: "INVALID_SECURITY_CODE"
      };

    }

    attempts.delete(uid);

    return { ok: true };

  } catch {

    return {
      ok: false,
      error: "SECURITY_UNAVAILABLE"
    };

  } finally {

    activeChecks.delete(uid);

  }

}


/* ==========================================
   AUTOMATIC MEMORY CLEANUP
========================================== */

setInterval(() => {

  const now = Date.now();

  for (const [uid, state] of attempts) {

    if (
      !activeChecks.has(uid) &&
      state.expiresAt <= now
    ) {

      attempts.delete(uid);

    }

  }

}, 60000).unref();


/* ==========================================
   ADMIN SECURITY STATISTICS
========================================== */

function getStats() {

  const now = Date.now();

  let lockedAccounts = 0;

  for (const state of attempts.values()) {

    if (
      state.count >= SECURITY_LIMIT &&
      state.expiresAt > now
    ) {

      lockedAccounts++;

    }

  }

  return {

    version: "1.0.0",

    status: "ACTIVE",

    maxAmount: MAX_AMOUNT,

    securityLimit: SECURITY_LIMIT,

    securityLockMinutes:
      SECURITY_LOCK_MS / 60000,

    lockedAccounts,

    activeChecks: activeChecks.size,

    trackedAccounts: attempts.size,

    ...stats,

    recentEvents: recentEvents.map(
      event => ({ ...event })
    )

  };

}


module.exports = {

  parseAmount,
  parseBalance,

  canDebit,
  canCredit,

  isValidRequestId,

  verifySecurityCode,

  record,
  getStats

};