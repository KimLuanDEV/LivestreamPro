"use strict";

/* ==========================================
   LIVESTREAM PRO
   SECURITY MONITORING CENTER V2.0
========================================== */

const fs = require("fs");
const fsp = fs.promises;

const path = require("path");
const os = require("os");
const crypto = require("crypto");

const {

  performance,

  monitorEventLoopDelay

} = require("perf_hooks");


/* ==========================================
   CONFIGURATION
========================================== */

const DATA_DIR =
  "/opt/render/project/data";

const LOG_DIR = path.join(

  DATA_DIR,

  "security-logs"

);

const LOG_FILE = path.join(

  LOG_DIR,

  "soc-events.json"

);

const SAMPLE_INTERVAL = 15000;

const LOG_RETENTION =
  30 * 24 * 60 * 60 * 1000;

const MAX_EVENTS = 2000;

const MAX_LOG_BYTES =
  2 * 1024 * 1024;

const startedAt = Date.now();

let providers = null;

let timer = null;

let collecting = false;

let snapshot = null;

let events = [];

let logDirty = false;

let logStatus = "WAITING";

let lastCollectionError = null;

const previousStatuses = new Map();


/* ==========================================
   EVENT LOOP MONITOR
========================================== */

const eventLoop = monitorEventLoopDelay({

  resolution: 20

});

let lastCPU = process.cpuUsage();

let lastCPUTime = performance.now();


/* ==========================================
   COMMON HELPERS
========================================== */

function round(value) {

  return Number.isFinite(value)

    ? Number(value.toFixed(2))

    : null;

}


function numberOrNull(value) {

  if (value == null) return null;

  const n = Number(value);

  return Number.isFinite(n)

    ? n

    : null;

}


function safeText(value, max = 160) {

  return String(value ?? "")

    .replace(/[\r\n\t]/g, " ")

    .slice(0, max);

}


/* ==========================================
   LOAD PERSISTENT SECURITY EVENTS
========================================== */

async function loadEvents() {

  try {

    await fsp.mkdir(LOG_DIR, {

      recursive: true,

      mode: 0o700

    });

    await fsp.chmod(LOG_DIR, 0o700);

    const info =
      await fsp.lstat(LOG_FILE);

    if (

      !info.isFile() ||

      info.size > MAX_LOG_BYTES

    ) {

      throw new Error(
        "Invalid security log file"
      );

    }

    const data = JSON.parse(

      await fsp.readFile(
        LOG_FILE,
        "utf8"
      )

    );

    if (!Array.isArray(data)) {

      throw new Error(
        "Invalid security log format"
      );

    }

    const cutoff =
      Date.now() - LOG_RETENTION;

    events = data

      .filter(item =>

        item &&

        typeof item.id === "string" &&

        Number.isFinite(item.time) &&

        item.time >= cutoff

      )

      .map(item => ({

        id: safeText(item.id, 100),

        time: item.time,

        source: safeText(item.source, 30),

        level: ["INFO", "WARNING", "CRITICAL"]
          .includes(item.level)
            ? item.level
            : "INFO",

        type: safeText(item.type, 80),

        message: safeText(item.message, 200)

      }))

      .sort((a, b) => b.time - a.time)

      .slice(0, MAX_EVENTS);

    logStatus = "ACTIVE";

  } catch (error) {

    if (error.code === "ENOENT") {

      logStatus = "ACTIVE";

      return;

    }

    logStatus = "DEGRADED";

    console.error(
      "[SOC LOG] Unable to load history"
    );

  }

}


/* ==========================================
   RECORD SECURITY EVENT
========================================== */

function recordEvent({

  id,

  time,

  source,

  level = "INFO",

  type,

  message

}) {

  const eventId =

    id || crypto.randomUUID();

  if (

    events.some(
      item => item.id === eventId
    )

  ) {

    return;

  }

  events.push({

    id: safeText(eventId, 100),

    time: Number.isFinite(time)

      ? time

      : Date.now(),

    source: safeText(source, 30),

    level: ["INFO", "WARNING", "CRITICAL"]
      .includes(level)
        ? level
        : "INFO",

    type: safeText(type, 80),

    message: safeText(message, 200)

  });

  events.sort(
    (a, b) => b.time - a.time
  );

  if (events.length > MAX_EVENTS) {

    events.length = MAX_EVENTS;

  }

  logDirty = true;

}


/* ==========================================
   PERSIST LOGS WITHOUT BLOCKING REQUESTS
========================================== */

async function persistEvents() {

  const cutoff =
    Date.now() - LOG_RETENTION;

  const filtered = events.filter(

    item => item.time >= cutoff

  );

  if (filtered.length !== events.length) {

    events = filtered;

    logDirty = true;

  }

  if (!logDirty) return;

  const temp =

    LOG_FILE +

    "." +

    crypto.randomUUID() +

    ".tmp";

  let handle;

  try {

    await fsp.mkdir(LOG_DIR, {

      recursive: true,

      mode: 0o700

    });

    const content = JSON.stringify(events);

    if (
      Buffer.byteLength(content) > MAX_LOG_BYTES
    ) {

      throw new Error(
        "Security log size limit exceeded"
      );

    }

    handle = await fsp.open(

      temp,

      "wx",

      0o600

    );

    await handle.writeFile(content);

    await handle.sync();

    await handle.close();

    handle = null;

    await fsp.rename(
      temp,
      LOG_FILE
    );

    logDirty = false;

    logStatus = "ACTIVE";

  } catch (error) {

    logStatus = "DEGRADED";

    console.error(
      "[SOC LOG] Persistence failed"
    );

  } finally {

    if (handle) {

      await handle.close()
        .catch(() => {});

    }

    await fsp.unlink(temp)
      .catch(() => {});

  }

}


/* ==========================================
   PROCESS CPU MONITOR
   100% = ONE LOGICAL CPU CORE
========================================== */

function getCPU() {

  const now = performance.now();

  const current = process.cpuUsage();

  const elapsed =
    (now - lastCPUTime) * 1000;

  const used =

    current.user - lastCPU.user +

    current.system - lastCPU.system;

  lastCPU = current;

  lastCPUTime = now;

  return elapsed > 0

    ? round(used / elapsed * 100)

    : null;

}


/* ==========================================
   SYSTEM RESOURCE MONITOR
========================================== */

function getSystem() {

  const memory =
    process.memoryUsage();

  const constrained =

    typeof process.constrainedMemory
      === "function"

      ? process.constrainedMemory()

      : 0;

  const memoryLimit =

    Number.isFinite(constrained) &&

    constrained > 0

      ? constrained

      : null;

  const loopP95 =

    eventLoop.count > 0

      ? round(
          eventLoop.percentile(95) / 1e6
        )

      : null;

  const loopMax =

    eventLoop.count > 0

      ? round(
          eventLoop.max / 1e6
        )

      : null;

  eventLoop.reset();

  return {

    uptimeSeconds:
      Math.floor(process.uptime()),

    cpuPercent:
      getCPU(),

    logicalCPUs:
      os.availableParallelism(),

    rssMB:
      round(memory.rss / 1048576),

    heapUsedMB:
      round(memory.heapUsed / 1048576),

    heapTotalMB:
      round(memory.heapTotal / 1048576),

    externalMB:
      round(memory.external / 1048576),

    memoryLimitMB:

      memoryLimit

        ? round(memoryLimit / 1048576)

        : null,

    memoryPercent:

      memoryLimit

        ? round(
            memory.rss /
            memoryLimit * 100
          )

        : null,

    eventLoopP95Ms:
      loopP95,

    eventLoopMaxMs:
      loopMax,

    connectedSockets:
      null

  };

}


/* ==========================================
   COLLECT SECURITY PROVIDER
========================================== */

async function readProvider(name) {

  try {

    const fn = providers?.[name];

    if (typeof fn !== "function") {

      throw new Error(
        "Provider unavailable"
      );

    }

    const data = await fn();

    if (!data || typeof data !== "object") {

      throw new Error(
        "Invalid provider data"
      );

    }

    return {

      available: true,

      data

    };

  } catch {

    return {

      available: false,

      data: null

    };

  }

}


/* ==========================================
   MODULE STATUS HELPERS
========================================== */

function moduleStatus(result) {

  if (!result.available) {

    return "UNAVAILABLE";

  }

  return safeText(

    result.data.status || "UNKNOWN",

    30

  );

}


function backupStatus(data) {

  if (!data) return "UNAVAILABLE";

  if (

    data.status === "DEGRADED" ||

    data.status === "NOT_CONFIGURED"

  ) {

    return data.status;

  }

  if (data.backupRunning) {

    return "BACKING_UP";

  }

  const verified =

    numberOrNull(data.lastVerifiedAt);

  if (!verified || verified <= 0) {

    return "WAITING";

  }

  const interval =

    numberOrNull(data.intervalMinutes) || 60;

  if (

    Date.now() - verified >

    interval * 2 * 60000

  ) {

    return "STALE";

  }

  return data.status === "ACTIVE"

    ? "VERIFIED"

    : "UNKNOWN";

}


function offsiteStatus(data) {

  if (!data) return "UNAVAILABLE";

  if (data.status !== "ACTIVE") {

    return safeText(

      data.status || "UNKNOWN",

      30

    );

  }

  const verified =

    numberOrNull(data.lastVerifiedAt);

  if (!verified || verified <= 0) {

    return "UNVERIFIED";

  }

  if (

    Date.now() - verified >

    120 * 60000

  ) {

    return "STALE";

  }

  return "VERIFIED";

}


/* ==========================================
   STATUS CHANGE DETECTION
========================================== */

function observeStatus(source, status) {

  const previous =
    previousStatuses.get(source);

  if (previous === status) return;

  previousStatuses.set(
    source,
    status
  );

  const critical = [

    "DEGRADED",

    "STALE",

    "UNAVAILABLE",

    "NOT_CONFIGURED",

    "CRITICAL"

  ].includes(status);

  const warning = [

    "WARNING",

    "UNKNOWN",

    "DISABLED",

    "TEST_MODE",

    "UNVERIFIED"

  ].includes(status);

  recordEvent({

    source,

    level: critical

      ? "CRITICAL"

      : warning

        ? "WARNING"

        : "INFO",

    type: "STATUS_CHANGE",

    message:

      `${source}: ` +

      `${previous || "INITIAL"} → ${status}`

  });

}


/* ==========================================
   IMPORT IDS EVENTS
   DO NOT STORE PASSWORDS OR TOKENS
========================================== */

function importIDSEvents(ids) {

  if (!Array.isArray(ids?.recentEvents)) {

    return;

  }

  for (const event of ids.recentEvents) {

    if (

      !event ||

      typeof event.id !== "string" ||

      !Number.isFinite(event.time)

    ) {

      continue;

    }

    recordEvent({

      id: `ids-${event.id}`,

      time: event.time,

      source: "IDS",

      level:

        event.level === "HIGH"

          ? "WARNING"

          : "INFO",

      type: safeText(event.type, 80),

      message:

        safeText(event.type, 80) +

        " | Risk: " +

        safeText(event.level, 20) +

        " | Score: " +

        String(
          numberOrNull(event.score) ?? "--"
        )

    });

  }

}


/* ==========================================
   SERVER HEALTH CLASSIFICATION
========================================== */

function getHealth(system, disk) {

  const mem =
    system.memoryPercent;

  const loop =
    system.eventLoopP95Ms;

  const usage =
    disk?.usedPercent ?? null;

  if (

    (mem != null && mem >= 90) ||

    (loop != null && loop >= 200) ||

    (usage != null && usage >= 95)

  ) {

    return "CRITICAL";

  }

  if (

    (mem != null && mem >= 75) ||

    (loop != null && loop >= 80) ||

    (usage != null && usage >= 80)

  ) {

    return "WARNING";

  }

  if (

    mem == null ||

    loop == null ||

    usage == null

  ) {

    return "PARTIAL";

  }

  return "NORMAL";

}


/* ==========================================
   COLLECT UNIFIED SECURITY SNAPSHOT
========================================== */

async function collect() {

  if (collecting) return;

  collecting = true;

  try {

    const [

      edge,

      firewall,

      auth,

      transaction,

      database,

      ids,

      sockets

    ] = await Promise.all([

      readProvider("edge"),

      readProvider("firewall"),

      readProvider("auth"),

      readProvider("transaction"),

      readProvider("database"),

      readProvider("ids"),

      readProvider("sockets")

    ]);

    const db = database.data;

    const idsData = ids.data;

    const system = getSystem();

    system.connectedSockets =

      numberOrNull(
        sockets.data?.connected
      );

    const storage =
      db?.storage || null;

    const health =
      getHealth(system, storage);

    const modules = {

      edge:

        edge.data?.enforced === true

          ? "ENFORCED"

          : edge.available

            ? "TEST_MODE"

            : "UNAVAILABLE",

      firewall:

        moduleStatus(firewall),

      authentication:

        moduleStatus(auth),

      transaction:

        moduleStatus(transaction),

      database:

        backupStatus(db),

      offsite:

        offsiteStatus(db?.offsite),

      ids:

        idsData?.status === "ACTIVE"

          ? safeText(
              idsData.mode || "ACTIVE",
              30
            )

          : moduleStatus(ids),

      server: health

    };

    for (

      const [name, status]

      of Object.entries(modules)

    ) {

      observeStatus(

        name.toUpperCase(),

        status

      );

    }

    importIDSEvents(idsData);

    await persistEvents();

    const healthyStates = [

      "ACTIVE",

      "ENFORCED",

      "VERIFIED",

      "MONITOR",

      "NORMAL"

    ];

    const criticalStates = [

      "CRITICAL",

      "DEGRADED",

      "STALE",

      "UNAVAILABLE",

      "NOT_CONFIGURED"

    ];

    const states = Object.values(modules);

    const overall =

      states.some(
        status =>
          criticalStates.includes(status)
      )

        ? "CHECK_REQUIRED"

        : states.every(
            status =>
              healthyStates.includes(status)
          ) && logStatus === "ACTIVE"

          ? "OPERATIONAL"

          : "ATTENTION";

    snapshot = {

      version: "2.0.0",

      status: overall,

      startedAt,

      collectedAt: Date.now(),

      intervalSeconds:
        SAMPLE_INTERVAL / 1000,

      modules,

      system,

      storage,

      threats: {

        low:

          numberOrNull(idsData?.lowRisk),

        elevated:

          numberOrNull(idsData?.elevatedRisk),

        high:

          numberOrNull(idsData?.highRisk),

        total:

          numberOrNull(idsData?.threatSignals),

        alerts:

          numberOrNull(idsData?.alerts),

        autoBan:

          idsData?.autoBan === false

            ? false

            : idsData?.autoBan === true

              ? true

              : null

      },

      backup: {

        lastLocalVerifiedAt:

          db?.lastVerifiedAt || null,

        lastOffsiteVerifiedAt:

          db?.offsite?.lastVerifiedAt || null,

        successfulBackups:

          numberOrNull(db?.successfulBackups),

        failedBackups:

          numberOrNull(db?.failedBackups),

        successfulUploads:

          numberOrNull(
            db?.offsite?.successfulUploads
          ),

        failedUploads:

          numberOrNull(
            db?.offsite?.failedUploads
          )

      },

      logging: {

        status: logStatus,

        retainedEvents:
          events.length,

        maximumEvents:
          MAX_EVENTS,

        retentionDays: 30

      },

      recentEvents:
        events.slice(0, 50)

    };

    lastCollectionError = null;

  } catch (error) {

    lastCollectionError =
      "COLLECTION_FAILED";

    console.error(
      "[SOC] Collection failed"
    );

  } finally {

    collecting = false;

  }

}


/* ==========================================
   ADMIN SECURITY SNAPSHOT
========================================== */

function getStats() {

  if (!snapshot) {

    return {

      version: "2.0.0",

      status: lastCollectionError

        ? "UNAVAILABLE"

        : "INITIALIZING",

      collectedAt: null

    };

  }

  const stale =

    Date.now() - snapshot.collectedAt >

    SAMPLE_INTERVAL * 3;

  return {

    ...snapshot,

    status:

      stale || lastCollectionError

        ? "STALE"

        : snapshot.status,

    stale

  };

}


/* ==========================================
   START SECURITY MONITOR
========================================== */

async function start(options = {}) {

  if (timer || providers) return;

  providers = options;

  await loadEvents();

  eventLoop.enable();

  lastCPU = process.cpuUsage();

  lastCPUTime = performance.now();

  recordEvent({

    source: "SOC",

    level: "INFO",

    type: "SYSTEM_START",

    message:
      "Security Monitoring Center V2.0 started"

  });

  await collect();

  timer = setInterval(

    () => void collect(),

    SAMPLE_INTERVAL

  );

  timer.unref();

  console.log(
    "[SECURITY MONITOR] V2.0 enabled"
  );

  console.log(
    "[SECURITY MONITOR] Collection interval: 15 seconds"
  );

}


module.exports = {

  start,

  getStats

};