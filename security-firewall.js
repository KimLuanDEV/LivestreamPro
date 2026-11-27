
"use strict";

/* ==========================================
   LIVESTREAM PRO
   SECURITY FIREWALL V1.2
   CLOUDFLARE EDGE INTEGRATION
========================================== */

const net = require("net");

// Giới hạn bộ nhớ sử dụng
const MAX_ENTRIES = 20000;

const httpBuckets = new Map();
const socketBuckets = new Map();

const activeConnections = new Map();

const MAX_CONNECTIONS_PER_IP = 80;

/* ==========================================
   GAME EVENT RATE LIMIT CONFIGURATION
========================================== */

const GAME_EVENT_LIMITS = Object.freeze({
  "wheel8-bet": 100,
  "dtp-bet": 100,
  "time-race-bet": 100
});

const GAME_EVENT_WINDOW_MS = 10000;


const stats = {
  httpBlocked: 0,
  socketBlocked: 0,
  originBlocked: 0,
  startedAt: Date.now()
};

/* ==========================================
   RATE LIMIT ENGINE
========================================== */

function consume(store, key, limit, windowMs) {
  const now = Date.now();

  let entry = store.get(key);

  if (!entry || now >= entry.expiresAt) {

    if (!entry && store.size >= MAX_ENTRIES) {
      return false;
    }

    entry = {
      count: 0,
      expiresAt: now + windowMs
    };

    store.set(key, entry);
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count++;

  return true;
}

/* ==========================================
   AUTOMATIC MEMORY CLEANUP
========================================== */

setInterval(() => {

  const now = Date.now();

  for (const store of [
    httpBuckets,
    socketBuckets
  ]) {

    for (const [key, entry] of store) {

      if (entry.expiresAt <= now) {
        store.delete(key);
      }

    }
  }

}, 30000).unref();

/* ==========================================
   IP NORMALIZATION
========================================== */

function normalizeIP(value) {

  const ip = String(value || "")
    .replace(/^::ffff:/, "");

  return net.isIP(ip) ? ip : "unknown";
}

/* ==========================================
   SECURITY LOG
========================================== */

const logBuckets = new Map();

/* ==========================================
   SECURITY EVENT HISTORY
========================================== */

const MAX_SECURITY_EVENTS = 200;

const securityEvents = [];

/* ==========================================
   SECURITY EVENT LOGGER
========================================== */

function securityLog(type, ip) {

  // Limit repeated warnings
  if (!consume(
    logBuckets,
    `${type}:${ip}`,
    2,
    60000
  )) return;

  const entry = {

    type: String(type || "UNKNOWN"),

    ip: normalizeIP(ip),

    time: new Date().toISOString()

  };

  // Newest event first
  securityEvents.unshift(entry);

  // Protect server memory
  if (
    securityEvents.length >
    MAX_SECURITY_EVENTS
  ) {

    securityEvents.length =
      MAX_SECURITY_EVENTS;

  }

  // Render Logs
  console.warn(
    "[LSP FIREWALL]",
    entry
  );

}
setInterval(() => {

  for (const [key, entry] of logBuckets) {

    if (entry.expiresAt <= Date.now()) {
      logBuckets.delete(key);
    }

  }

}, 60000).unref();

/* ==========================================
   HTTP FIREWALL
========================================== */

function installHttp(app, options = {}) {

  const allowedOrigins = new Set(
    options.allowedOrigins || []
  );

  app.disable("x-powered-by");

  app.use((req, res, next) => {

const ip = normalizeIP(
  typeof options.getClientIp === "function"
    ? options.getClientIp(req)
    : req.ip || req.socket.remoteAddress
);

    const pathname = req.path.toLowerCase();

    // Security headers
    res.setHeader(
      "X-Content-Type-Options",
      "nosniff"
    );

    res.setHeader(
      "X-Frame-Options",
      "SAMEORIGIN"
    );

    res.setHeader(
      "Referrer-Policy",
      "strict-origin-when-cross-origin"
    );

    res.setHeader(
      "X-XSS-Protection",
      "0"
    );

    // Render health check
    if (pathname === "/healthz") {
      return next();
    }

    function reject(code, reason) {

      stats.httpBlocked++;

      securityLog(reason, ip);

      res.setHeader(
        "Cache-Control",
        "no-store"
      );

      if (code === 429) {
        res.setHeader("Retry-After", "60");
      }

      return res.status(code).json({
        ok: false,
        error: reason,
        message: code === 429
          ? "Too many requests. Please try again later."
          : "Request blocked by security policy."
      });
    }

    // Reject unsupported HTTP methods
    const allowedMethods = [
      "GET",
      "HEAD",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS"
    ];

    if (!allowedMethods.includes(req.method)) {
      return reject(405, "METHOD_NOT_ALLOWED");
    }

    // URL length protection
    if (req.originalUrl.length > 8192) {
      return reject(414, "URL_TOO_LONG");
    }

    let decodedPath;

    try {
      decodedPath = decodeURIComponent(pathname);
    } catch {
      return reject(400, "INVALID_URL");
    }

    // Block sensitive files
    if (
      /(?:^|\/)\.(?!well-known(?:\/|$))/
        .test(decodedPath) ||

/(?:^|\/)(?:node_modules|server\.js|security-firewall\.js|security-auth\.js|security-transaction\.js|security-database\.js|security-ids\.js|security-monitor\.js|security-backups|security-logs|soc-events\.json|package-lock\.json|package\.json)(?:\/|$)/
  .test(decodedPath) ||

      /\.(?:env|sql|sqlite|bak|lspbak|log|pem|key|map)$/i
        .test(decodedPath)
    ) {

      return reject(403, "PRIVATE_RESOURCE");
    }

    // Prevent path traversal
    if (
      /(?:^|[\/\\])\.\.(?:[\/\\]|$)/
        .test(decodedPath) ||
      decodedPath.includes("\0")
    ) {

      return reject(403, "INVALID_PATH");
    }

    // Only rate-limit API requests here.
    // Images, CSS and JS are not counted.
    if (!pathname.startsWith("/api/")) {
      return next();
    }

    res.setHeader("Cache-Control", "no-store");

    // General API limit
    if (!consume(
      httpBuckets,
      `api:${ip}`,
      300,
      60000
    )) {

      return reject(429, "API_RATE_LIMIT");
    }

    const unsafeMethod = ![
      "GET",
      "HEAD",
      "OPTIONS"
    ].includes(req.method);

    const origin = req.get("origin");

    // Reject requests from untrusted origins
    if (
      origin &&
      !allowedOrigins.has(origin)
    ) {

      stats.originBlocked++;

      return reject(403, "INVALID_ORIGIN");
    }

    if (
      unsafeMethod &&
      req.get("sec-fetch-site") === "cross-site"
    ) {

      stats.originBlocked++;

      return reject(403, "CROSS_SITE_REQUEST");
    }

    // Authentication endpoints
    const authPaths = new Set([
      "/api/login",
      "/api/prelogin",
      "/api/register",
      "/api/check-trusted",
      "/api/change-password",
      "/api/admin/auth/login"
    ]);

    if (authPaths.has(pathname)) {

      if (!consume(
        httpBuckets,
        `auth:${ip}:${pathname}`,
        10,
        60000
      )) {

        return reject(429, "AUTH_RATE_LIMIT");
      }

    }

    // Wallet and payment operations
    const financialPaths = new Set([
      "/api/diamonds/convert",
      "/api/withdraw-request",
      "/api/card-topup/create"
    ]);

    if (financialPaths.has(pathname)) {

      if (!consume(
        httpBuckets,
        `finance:${ip}`,
        20,
        60000
      )) {

        return reject(429, "FINANCE_RATE_LIMIT");
      }

    }

    // Upload rate limit
    if (pathname.startsWith("/api/upload-")) {

      if (!consume(
        httpBuckets,
        `upload:${ip}`,
        15,
        60000
      )) {

        return reject(429, "UPLOAD_RATE_LIMIT");
      }

    }

    next();

  });

}

/* ==========================================
   SOCKET.IO FIREWALL
========================================== */

function installSocket(io, options = {}) {

  io.use((socket, next) => {

const ip = normalizeIP(
  typeof options.getClientIp === "function"
    ? options.getClientIp(socket.request)
    : socket.handshake.address
);

    // Limit new socket handshakes
    if (!consume(
      socketBuckets,
      `connect:${ip}`,
      60,
      60000
    )) {

      stats.socketBlocked++;

      securityLog(
        "SOCKET_CONNECTION_LIMIT",
        ip
      );

      return next(
        new Error("CONNECTION_RATE_LIMIT")
      );
    }




    /* ==========================================
   CONCURRENT CONNECTION PROTECTION
========================================== */

socket.once("disconnect", () => {

  if (!socket.data.firewallCounted) return;

  socket.data.firewallCounted = false;

  const remaining = Math.max(
    0,
    (activeConnections.get(ip) || 0) - 1
  );

  if (remaining === 0) {
    activeConnections.delete(ip);
  } else {
    activeConnections.set(ip, remaining);
  }

});



    socket.use((packet, done) => {

      const event = packet[0];

      if (
        typeof event !== "string" ||
        event.length > 128
      ) {
        return done(
          new Error("INVALID_EVENT")
        );
      }

const uid =
  socket.data.authenticated === true &&
  socket.data.uid
    ? String(socket.data.uid)
    : null;

const actor = uid
  ? `user:${uid}`
  : options.getClientIp
    ? `guest:${ip}`
    : `guest:${socket.id}`;


function block(reason) {

  stats.socketBlocked++;

  securityLog(reason, ip);

  const message =
    "Too many requests. Please slow down.";

  // Return response to client callback
  const ack = packet[packet.length - 1];

  if (typeof ack === "function") {

    ack({
      ok: false,
      code: reason,
      error: reason,
      message
    });

  }

  // Prevent notification flooding
  if (consume(
    socketBuckets,
    `warning:${socket.id}`,
    1,
    5000
  )) {

    socket.emit("security-warning", {
      code: reason,
      message
    });

  }

  return done(new Error(reason));

}

      // General socket flood protection
      if (!consume(
        socketBuckets,
        `event:${actor}`,
        120,
        10000
      )) {

        return block("SOCKET_EVENT_LIMIT");
      }


      /* ==========================================
   SOCKET AUTHENTICATION PROTECTION
========================================== */

if ([
  "auth-login",
  "socket-login"
].includes(event)) {

  if (!consume(
    socketBuckets,
    `login:${actor}`,
    15,
    60000
  )) {

    return block("SOCKET_AUTH_LIMIT");

  }

}


      // Admin password protection
      if (/admin-login/i.test(event)) {

        if (!consume(
          socketBuckets,
          `admin:${ip}`,
          5,
          60000
        )) {

          return block("ADMIN_LOGIN_LIMIT");
        }

      }

      // Financial event protection
      if ([
        "coin-transfer",
        "lp-gift-post",
        "sfu:gift:send",
        "virtual-live:gift:send"
      ].includes(event)) {

        if (!consume(
          socketBuckets,
          `money:${actor}`,
          30,
          10000
        )) {

          return block("FINANCIAL_EVENT_LIMIT");
        }

      }

/* ==========================================
   GAME EVENT FLOOD PROTECTION V2.0
   INDEPENDENT GAME RATE LIMIT
========================================== */

if (Object.hasOwn(GAME_EVENT_LIMITS, event)) {

  const limit = GAME_EVENT_LIMITS[event];

  if (!consume(
    socketBuckets,
    `game:${actor}:${event}`,
    limit,
    GAME_EVENT_WINDOW_MS
  )) {

    return block("GAME_EVENT_LIMIT");

  }

}

      done();

    });

    next();

  });


io.on("connection", socket => {

  const ip = normalizeIP(
    typeof options.getClientIp === "function"
      ? options.getClientIp(socket.request)
      : socket.handshake.address
  );

  const current =
    activeConnections.get(ip) || 0;

  if (
  typeof options.getClientIp === "function" &&
  current >= MAX_CONNECTIONS_PER_IP
) {

    stats.socketBlocked++;

    securityLog(
      "CONCURRENT_CONNECTION_LIMIT",
      ip
    );

    socket.disconnect(true);

    return;

  }

  activeConnections.set(ip, current + 1);

  socket.data.firewallCounted = true;

});


}

/* ==========================================
   FIREWALL STATISTICS
========================================== */

function getStats() {

  const memory = process.memoryUsage();

  let totalConnections = 0;

  for (const count of activeConnections.values()) {
    totalConnections += count;
  }

  return {

    version: "1.3.0",

    status: "ACTIVE",

    ...stats,

    totalBlocked:
      stats.httpBlocked +
      stats.socketBlocked,

    httpTracked: httpBuckets.size,

    socketTracked: socketBuckets.size,

    activeIPs: activeConnections.size,

    activeConnections: totalConnections,

// Recent security warnings

recentEvents: securityEvents
  .slice(0, MAX_SECURITY_EVENTS)
  .map(event => ({ ...event })),

securityEventCount:
  securityEvents.length,

    memory: {
      rss: Math.round(memory.rss / 1048576),
      heapUsed: Math.round(
        memory.heapUsed / 1048576
      )
    },

    uptime: Math.floor(
      (Date.now() - stats.startedAt) / 1000
    )

  };

}
module.exports = {
  installHttp,
  installSocket,
  getStats
};
