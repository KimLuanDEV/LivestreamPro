"use strict";

/* ==========================================
   LIVESTREAM PRO
   PERSISTENT RECEIPT ARCHIVE QUEUE V1.9A
========================================== */

const fs = require("node:fs");
const fsp = fs.promises;
const path = require("node:path");
const crypto = require("node:crypto");

const HEX = /^[a-f0-9]{64}$/;

const HOURLY =
  /^hourly-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.lspbak$/;

const MAX = 128 * 1024 * 1024;


function createQueue({
  dir,
  verifyBackup,
  archiveBackup,
  atomicWrite
}) {

  let running = false;
  let lastError = null;


  /* SECURE BACKUP PATH */

  const file = name => {

    if (!HOURLY.test(name)) {

      throw new Error(
        "INVALID_HOURLY_NAME"
      );

    }

    return path.join(dir, name);

  };


  /* PERSISTENT ACKNOWLEDGEMENT */

  const ack = name =>
    file(name) + ".receipt-v19-ok";


  /* ======================================
     BACKUP INTEGRITY CHECK
  ====================================== */

  async function digest(name) {

    const h = await fsp.open(

      file(name),

      fs.constants.O_RDONLY |
      fs.constants.O_NOFOLLOW |
      fs.constants.O_NONBLOCK

    );

    try {

      const s = await h.stat();

      if (
        !s.isFile() ||
        s.size <= 0 ||
        s.size > MAX
      ) {

        throw new Error(
          "INVALID_QUEUE_FILE"
        );

      }

      const hash =
        crypto.createHash("sha256");

      let size = 0;

      for await (

        const chunk of h.createReadStream({
          autoClose: false
        })

      ) {

        size += chunk.length;

        if (size > s.size) {

          throw new Error(
            "QUEUE_FILE_CHANGED"
          );

        }

        hash.update(chunk);

      }

      const end = await h.stat();

      if (

        size !== s.size ||

        end.size !== s.size ||

        end.mtimeMs !== s.mtimeMs ||

        end.ctimeMs !== s.ctimeMs

      ) {

        throw new Error(
          "QUEUE_FILE_CHANGED"
        );

      }

      return {

        sha256: hash.digest("hex"),

        size,

        mtimeMs: s.mtimeMs

      };

    } finally {

      await h.close();

    }

  }


  /* ======================================
     READ PERSISTENT RECEIPT MARKER
  ====================================== */

  async function marker(name) {

    try {

      const s =
        await fsp.lstat(file(name));

      const h = await fsp.open(

        ack(name),

        fs.constants.O_RDONLY |
        fs.constants.O_NOFOLLOW |
        fs.constants.O_NONBLOCK

      );

      let r;

      try {

        const a = await h.stat();

        if (

          !a.isFile() ||

          a.size > 4096 ||

          a.mode & 0o077

        ) {

          return null;

        }

        r = JSON.parse(
          await h.readFile("utf8")
        );

      } finally {

        await h.close();

      }

      if (

        !s.isFile() ||

        r.version !== 19 ||

        r.filename !== name ||

        !HEX.test(r.archiveId) ||

        !HEX.test(r.cipherSha256) ||

        !HEX.test(r.backupSha256) ||

        r.size !== s.size ||

        r.mtimeMs !== s.mtimeMs ||

        !Number.isSafeInteger(
          r.snapshotCreatedAt
        )

      ) {

        return null;

      }

      return r;

    } catch {

      return null;

    }

  }


  /* ======================================
     RECOVER PENDING QUEUE FROM DISK
  ====================================== */

  async function pending() {

    const entries = await fsp.readdir(

      dir,

      { withFileTypes: true }

    );

    const names = entries

      .filter(e =>

        e.isFile() &&
        HOURLY.test(e.name)

      )

      .map(e => e.name)

      .sort();

    const out = [];

    for (const n of names) {

      if (!(await marker(n))) {

        out.push(n);

      }

    }

    return out;

  }


  /* ======================================
     AUTOMATIC QUEUE RETRY
  ====================================== */

  async function run(currentName) {

    if (running) return;

    running = true;

    let failed = false;

    try {

      const names = await pending();


      /* RETRY ONE OLDER BACKUP */

      const jobs = names

        .filter(n => n !== currentName)

        .slice(0, 1);


      /* PROCESS CURRENT BACKUP */

      if (names.includes(currentName)) {

        jobs.push(currentName);

      }


      for (const n of jobs) {

        try {

          const before =
            await digest(n);

          const s =
            await verifyBackup(file(n));

          if (s.scope !== "JSON_ONLY") {

            throw new Error(
              "INVALID_QUEUE_SCOPE"
            );

          }


          /* UPLOAD + REMOTE READBACK */

          const r =
            await archiveBackup(s);

          const after =
            await digest(n);


          /* VERIFY BEFORE ACK */

          if (

            !r ||

            r.archiveVerified !== true ||

            !HEX.test(r.archiveId) ||

            !HEX.test(r.cipherSha256) ||

            r.snapshotCreatedAt !==
              new Date(s.createdAt).toISOString() ||

            JSON.stringify(before) !==
              JSON.stringify(after)

          ) {

            throw new Error(
              "QUEUE_VERIFICATION_FAILED"
            );

          }


          /* DURABLE RECEIPT MARKER */

          await atomicWrite(

            ack(n),

            Buffer.from(JSON.stringify({

              version: 19,

              filename: n,

              archiveId: r.archiveId,

              cipherSha256:
                r.cipherSha256,

              backupSha256:
                after.sha256,

              size: after.size,

              mtimeMs: after.mtimeMs,

              snapshotCreatedAt:
                s.createdAt

            }))

          );


          console.log(

            "[RECEIPT QUEUE V1.9] ACK",

            n

          );

        } catch {

          failed = true;

          console.error(

            "[RECEIPT QUEUE V1.9] RETRY_REQUIRED",

            n

          );

        }

      }

    } catch {

      failed = true;

      console.error(

        "[RECEIPT QUEUE V1.9] SCAN_FAILED"

      );

    } finally {

      lastError = failed
        ? "QUEUE_RETRY_REQUIRED"
        : null;

      running = false;

    }

  }


  /* ======================================
     PREVENT PREMATURE BACKUP ROTATION
  ====================================== */

  async function canRotate(name) {

    if (!name.startsWith("hourly-")) {
      return true;
    }

    try {

      const r = await marker(name);

      if (!r) return false;

      const d = await digest(name);

      return (

        d.sha256 === r.backupSha256 &&

        d.size === r.size &&

        d.mtimeMs === r.mtimeMs

      );

    } catch {

      return false;

    }

  }


  /* ======================================
     QUEUE MONITORING
  ====================================== */

  async function stats() {

    try {

      const names = await pending();

      return {

        running,

        lastError,

        pendingByMarker: names.length,

        oldestPending:
          names[0] || null,

        status: lastError

          ? "DEGRADED"

          : running

            ? "ARCHIVING"

            : names.length

              ? "PENDING"

              : "IDLE"

      };

    } catch {

      return {

        running,

        status: "UNAVAILABLE",

        pendingByMarker: null

      };

    }

  }


  return {

    run,

    canRotate,

    stats,

    ack

  };

}


module.exports = {

  createQueue

};