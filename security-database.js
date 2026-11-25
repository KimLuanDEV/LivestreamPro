"use strict";

/* ==========================================
   LIVESTREAM PRO
   DATABASE SECURITY & BACKUP V1.0
========================================== */

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");

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

function captureSnapshot() {

  const files = [];

  let totalBytes = 0;

  for (const filename of BACKUP_FILES) {

    const fullPath = path.join(
      DATA_DIR,
      filename
    );

    let info;

    try {

      info = fs.lstatSync(fullPath);

    } catch (error) {

      if (
        error.code === "ENOENT" &&
        !REQUIRED_FILES.includes(filename)
      ) {
        continue;
      }

      throw error;

    }

    if (!info.isFile() || info.isSymbolicLink()) {

      throw new Error(
        `Invalid database file: ${filename}`
      );

    }

    totalBytes += info.size;

    if (totalBytes > MAX_SOURCE_BYTES) {

      throw new Error(
        "Database exceeds backup size limit"
      );

    }

    const raw = fs.readFileSync(fullPath);

    totalBytes += raw.length - info.size;

    if (totalBytes > MAX_SOURCE_BYTES) {

      throw new Error(
        "Database exceeds backup size limit"
      );

    }

    try {

      validateJSON(filename, raw);

    } catch {

      stats.integrityFailures++;

      throw new Error(
        `JSON integrity check failed: ${filename}`
      );

    }

    files.push({

      name: filename,

      size: raw.length,

      sha256: checksum(raw),

      content: raw.toString("base64")

    });

  }

  if (!files.length) {

    throw new Error(
      "No database files found"
    );

  }

  return {

    version: "1.0.0",

    createdAt: Date.now(),

    vietnamDay: getVietnamDay(),

    files

  };

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

async function verifyBackup(filename) {

  const encrypted =
    await fsp.readFile(filename);

  const compressed =
    decryptBackup(encrypted);

  const raw = await gunzip(compressed, {

    maxOutputLength:
      MAX_SOURCE_BYTES * 2

  });

  const snapshot = JSON.parse(
    raw.toString("utf8")
  );

  if (
    snapshot.version !== "1.0.0" ||
    !Array.isArray(snapshot.files) ||
    snapshot.files.length === 0
  ) {

    throw new Error(
      "Invalid backup manifest"
    );

  }

  const names = new Set();

  for (const item of snapshot.files) {

    if (
      !BACKUP_FILES.includes(item.name) ||
      names.has(item.name)
    ) {

      throw new Error(
        "Invalid backup file entry"
      );

    }

    names.add(item.name);

    const content = Buffer.from(
      item.content,
      "base64"
    );

    if (
      content.length !== item.size ||
      checksum(content) !== item.sha256
    ) {

      throw new Error(
        `Checksum mismatch: ${item.name}`
      );

    }

    validateJSON(item.name, content);

  }

  for (const required of REQUIRED_FILES) {

    if (!names.has(required)) {

      throw new Error(
        `Missing required database: ${required}`
      );

    }

  }

  return snapshot;

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

      createdAt: snapshot.createdAt

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

    version: "1.0.0",

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

  backupTimer = setInterval(() => {

    void createBackup("automatic");

  }, BACKUP_INTERVAL);

  backupTimer.unref();

  // Initial backup after startup.

  setTimeout(() => {

    void createBackup("startup");

  }, 30000).unref();

  console.log(
    "[DATABASE SECURITY] V1.0 enabled"
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