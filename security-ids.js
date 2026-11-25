"use strict";

/* ==========================================
   LIVESTREAM PRO
   INTRUSION DETECTION SYSTEM V1.0
   MONITOR MODE
========================================== */

const crypto = require("crypto");
const net = require("net");

const WINDOW_MS = 5 * 60 * 1000;
const SOCKET_WINDOW_MS = 10000;

const MAX_TRACKED_IPS = 10000;
const MAX_EVENTS = 200;
const ALERT_COOLDOWN = 30000;

const startedAt = Date.now();

const tracked = new Map();
const events = [];

const WEIGHTS = Object.freeze({

  EDGE_DENIED: 15,

  HTTP_FORBIDDEN: 4,

  HTTP_UNAUTHORIZED: 2,

  HTTP_RATE_LIMIT: 10,

  LOGIN_FAILED: 8,

  TRANSACTION_AUTH_FAILED: 12,

  SESSION_INVALID: 5,

  SOCKET_FLOOD: 15

});

const stats = {

  httpRequests: 0,

  socketPackets: 0,

  threatSignals: 0,

  alerts: 0,

  highRiskAlerts: 0,

  droppedSignals: 0,

  loginFailures: 0,

  transactionFailures: 0,

  rateLimitResponses: 0,

  invalidSessions: 0,

  socketFloods: 0

};


/* ==========================================
   NORMALIZE CLIENT IP
========================================== */

function normalizeIP(value) {

  if (typeof value !== "string") {
    return null;
  }

  let ip = value.trim();

  if (ip.startsWith("::ffff:")) {

    const ipv4 = ip.slice(7);

    if (net.isIP(ipv4) === 4) {
      ip = ipv4;
    }

  }

  return net.isIP(ip) ? ip : null;

}


/* ==========================================
   RISK LEVEL
========================================== */

function riskLevel(score) {

  if (score >= 80) return "HIGH";

  if (score >= 40) return "ELEVATED";

  if (score >= 15) return "LOW";

  return "NORMAL";

}


/* ==========================================
   RISK WINDOW
========================================== */

function getState(ip, now) {

  let state = tracked.get(ip);

  if (
    state &&
    now - state.windowStart >= WINDOW_MS
  ) {

    tracked.delete(ip);

    state = null;

  }

  if (!state) {

    if (tracked.size >= MAX_TRACKED_IPS) {

      stats.droppedSignals++;

      return null;

    }

    state = {

      score: 0,

      signals: 0,

      types: Object.create(null),

      windowStart: now,

      lastSeen: now,

      lastAlertAt: 0,

      lastAlertLevel: "NORMAL"

    };

    tracked.set(ip, state);

  }

  return state;

}


/* ==========================================
   THREAT EVENT LOGGER
========================================== */

function record(type, rawIP, source = "HTTP") {

  if (!Object.hasOwn(WEIGHTS, type)) {
    return;
  }

  stats.threatSignals++;

  switch (type) {

    case "LOGIN_FAILED":
      stats.loginFailures++;
      break;

    case "TRANSACTION_AUTH_FAILED":
      stats.transactionFailures++;
      break;

    case "HTTP_RATE_LIMIT":
      stats.rateLimitResponses++;
      break;

    case "SESSION_INVALID":
      stats.invalidSessions++;
      break;

    case "SOCKET_FLOOD":
      stats.socketFloods++;
      break;

  }

  const ip = normalizeIP(rawIP);

  // Never score an unverified or invalid IP.

  if (!ip) return;

  const now = Date.now();

  const state = getState(ip, now);

  if (!state) return;

  state.score = Math.min(

    100,

    state.score + WEIGHTS[type]

  );

  state.signals++;

  state.lastSeen = now;

  state.types[type] =
    (state.types[type] || 0) + 1;

  const level = riskLevel(state.score);

  if (level === "NORMAL") return;

  const levelChanged =
    level !== state.lastAlertLevel;

  const cooldownPassed =
    now - state.lastAlertAt >= ALERT_COOLDOWN;

  if (!levelChanged && !cooldownPassed) {
    return;
  }

  state.lastAlertAt = now;
  state.lastAlertLevel = level;

  const event = {

    id: crypto.randomUUID(),

    time: now,

    type,

    source:
      source === "SOCKET" ? "SOCKET" : "HTTP",

    ip,

    score: state.score,

    level,

    signals: state.signals

  };

  events.unshift(event);

  if (events.length > MAX_EVENTS) {

    events.length = MAX_EVENTS;

  }

  stats.alerts++;

  if (level === "HIGH") {

    stats.highRiskAlerts++;

  }

}


/* ==========================================
   HTTP MONITOR
========================================== */

function installHttp(app, options = {}) {

  const getClientIp = options.getClientIp;

  if (typeof getClientIp !== "function") {

    throw new Error(
      "IDS requires a trusted IP resolver"
    );

  }

  app.use((req, res, next) => {

    const pathname = String(req.path || "");

    // Ignore routine health checks and
    // static assets to reduce overhead.

    if (
      pathname === "/healthz" ||
      !pathname.toLowerCase().startsWith("/api/")
    ) {

      return next();

    }

    stats.httpRequests++;

    res.once("finish", () => {

      try {

        const ip = getClientIp(req);

        const status = res.statusCode;

        if (status === 429) {

          record(
            "HTTP_RATE_LIMIT",
            ip
          );

        } else if (status === 403) {

          record(
            "HTTP_FORBIDDEN",
            ip
          );

        } else if (status === 401) {

          record(
            "HTTP_UNAUTHORIZED",
            ip
          );

        }

      } catch {

        // IDS must not interrupt requests.

      }

    });

    next();

  });

}


/* ==========================================
   SOCKET.IO FLOOD DETECTION
========================================== */

function installSocket(io, options = {}) {

  const getClientIp = options.getClientIp;

  if (typeof getClientIp !== "function") {

    throw new Error(
      "IDS requires a trusted socket IP resolver"
    );

  }

  io.on("connection", socket => {

    let windowStart = Date.now();

    let packetCount = 0;

    let reported = false;

    let ip = null;

    try {

      ip = normalizeIP(
        getClientIp(socket.request)
      );

    } catch {}

    socket.use((packet, next) => {

      try {

        stats.socketPackets++;

        const now = Date.now();

        if (
          now - windowStart >= SOCKET_WINDOW_MS
        ) {

          windowStart = now;

          packetCount = 0;

          reported = false;

        }

        packetCount++;

        // One signal per socket window.

        if (
          packetCount > 100 &&
          !reported
        ) {

          reported = true;

          record(
            "SOCKET_FLOOD",
            ip,
            "SOCKET"
          );

        }

      } catch {}

      // Monitor mode: never block packets.

      next();

    });

  });

}


/* ==========================================
   AUTOMATIC MEMORY CLEANUP
========================================== */

setInterval(() => {

  const now = Date.now();

  for (const [ip, state] of tracked) {

    if (
      now - state.windowStart >= WINDOW_MS
    ) {

      tracked.delete(ip);

    }

  }

}, 30000).unref();


/* ==========================================
   ADMIN STATISTICS
========================================== */

function getStats() {

  const now = Date.now();

  const active = [];

  let lowRisk = 0;
  let elevatedRisk = 0;
  let highRisk = 0;

  for (const [ip, state] of tracked) {

    if (
      now - state.windowStart >= WINDOW_MS
    ) {

      continue;

    }

    const level = riskLevel(state.score);

    if (level === "LOW") lowRisk++;

    if (level === "ELEVATED") elevatedRisk++;

    if (level === "HIGH") highRisk++;

    active.push({

      ip,

      score: state.score,

      level,

      signals: state.signals,

      lastSeen: state.lastSeen

    });

  }

  active.sort(

    (a, b) =>
      b.score - a.score ||
      b.lastSeen - a.lastSeen

  );

  return {

    version: "1.0.0",

    status: "ACTIVE",

    mode: "MONITOR",

    autoBan: false,

    startedAt,

    riskWindowMinutes:
      WINDOW_MS / 60000,

    trackedIPs: active.length,

    lowRisk,

    elevatedRisk,

    highRisk,

    ...stats,

    topRiskIPs: active.slice(0, 20),

    recentEvents: events
      .slice(0, 50)
      .map(event => ({ ...event }))

  };

}


module.exports = {

  record,

  installHttp,

  installSocket,

  getStats

};