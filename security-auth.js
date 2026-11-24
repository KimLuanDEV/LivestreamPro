"use strict";

/* ==========================================
   LIVESTREAM PRO
   SECURITY AUTH V1.0
========================================== */

const crypto = require("crypto");

function createAuth(options = {}) {

  const secret = String(options.secret || "");
  const loadUsers = options.loadUsers;
  const allowedOrigins = new Set(
    options.allowedOrigins || []
  );

  const COOKIE_NAME = "lsp_spirit_sid";

  if (secret.length < 32) {
    throw new Error(
      "[SECURITY AUTH] Invalid session secret"
    );
  }

  if (typeof loadUsers !== "function") {
    throw new Error(
      "[SECURITY AUTH] loadUsers is required"
    );
  }


  /* ==========================================
     VERIFY SIGNED SESSION
  ========================================== */

  function verifySession(cookieHeader) {

    try {

      const raw = String(cookieHeader || "");

      if (raw.length > 16384) return null;

      const entries = raw
        .split(";")
        .map(item => item.trim())
        .filter(item =>
          item.startsWith(COOKIE_NAME + "=")
        );

      if (entries.length !== 1) return null;

      const token = entries[0].slice(
        COOKIE_NAME.length + 1
      );

      if (token.length > 2048) return null;

      const parts = token.split(".");

      if (parts.length !== 2) return null;

      const [payload, signature] = parts;

      if (
        !/^[A-Za-z0-9_-]+$/.test(payload) ||
        !/^[A-Za-z0-9_-]{43}$/.test(signature)
      ) {
        return null;
      }

      const expected = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("base64url");

      const a = Buffer.from(signature);
      const b = Buffer.from(expected);

      if (
        a.length !== b.length ||
        !crypto.timingSafeEqual(a, b)
      ) {
        return null;
      }

      const session = JSON.parse(
        Buffer.from(payload, "base64url")
          .toString("utf8")
      );

      if (
        typeof session.uid !== "string" ||
        !session.uid ||
        session.uid.length > 128 ||
        !Number.isSafeInteger(session.exp) ||
        session.exp <= Date.now() ||
        typeof session.nonce !== "string" ||
        !/^[a-f0-9]{32}$/.test(session.nonce)
      ) {
        return null;
      }

      return {
        uid: session.uid,
        expiresAt: session.exp,
        sessionVersion: session.ver,
        sessionId: crypto
          .createHash("sha256")
          .update(token)
          .digest("hex")
      };

    } catch {
      return null;
    }

  }


  /* ==========================================
     SERVER-SIDE ACCOUNT VERIFICATION
  ========================================== */

  function verifyAccount(session) {

    if (!session) return null;

    const users = loadUsers();

    if (!Object.hasOwn(users, session.uid)) {
      return null;
    }

    const account = users[session.uid];

    if (
      !account?.profile ||
      account.profile.accountBlocked
    ) {
      return null;
    }

    // Existing sessions are accepted only
    // until the account version changes.
    const currentVersion =
      account.authVersion || "legacy";

    const sessionVersion =
      session.sessionVersion || "legacy";

    if (currentVersion !== sessionVersion) {
      return null;
    }

    return {
      uid: session.uid,
      role: account.role || "user",
      expiresAt: session.expiresAt,
      sessionId: session.sessionId
    };

  }


  function getIdentity(cookieHeader) {

    return verifyAccount(
      verifySession(cookieHeader)
    );

  }


  /* ==========================================
     HTTP AUTHENTICATION
  ========================================== */

  function requireAuth(req, res, next) {

    res.setHeader(
      "Cache-Control",
      "no-store"
    );

    try {

      const identity = getIdentity(
        req.headers.cookie
      );

      if (!identity) {

        return res.status(401).json({
          ok: false,
          error: "AUTH_REQUIRED",
          message: "Please sign in again."
        });

      }

      const claimedUid =
        req.headers["x-uid"];

      if (
        claimedUid !== undefined &&
        claimedUid !== identity.uid
      ) {

        return res.status(403).json({
          ok: false,
          error: "UID_MISMATCH",
          message: "Unauthorized account."
        });

      }

      // CSRF protection for write operations
      if (
        !["GET", "HEAD", "OPTIONS"]
          .includes(req.method)
      ) {

        if (!allowedOrigins.has(
          req.headers.origin
        )) {

          return res.status(403).json({
            ok: false,
            error: "INVALID_ORIGIN"
          });

        }

      }

      req.auth = Object.freeze(identity);

      // Compatibility with existing APIs
      req.headers["x-uid"] = identity.uid;
      req.spiritUid = identity.uid;

      next();

    } catch {

      return res.status(503).json({
        ok: false,
        error: "AUTH_UNAVAILABLE"
      });

    }

  }


  /* ==========================================
     RESOURCE OWNERSHIP PROTECTION
  ========================================== */

  function requireSelf(req, res, next) {

    if (
      !req.auth ||
      String(req.params.uid) !== req.auth.uid
    ) {

      return res.status(403).json({
        ok: false,
        error: "ACCESS_DENIED"
      });

    }

    next();

  }


  /* ==========================================
     SOCKET SESSION VERIFICATION
  ========================================== */

  function getSocketIdentity(socket) {

    try {

      const identity = getIdentity(
        socket.handshake.headers.cookie
      );

      if (!identity) return null;

      if (
        socket.data.authenticated !== true ||
        identity.uid !== socket.data.uid ||
        identity.sessionId !== socket.data.sessionId
      ) {
        return null;
      }

      return identity;

    } catch {
      return null;
    }

  }


  /* ==========================================
     REVOKE ACCOUNT SESSIONS
  ========================================== */

  function revokeAccount(account) {

    if (!account) {
      throw new Error("Account required");
    }

    account.authVersion = crypto
      .randomBytes(32)
      .toString("hex");

    // Revoke previously trusted devices
    account.trusted = {};

  }


  return {
    verifySession,
    getIdentity,
    requireAuth,
    requireSelf,
    getSocketIdentity,
    revokeAccount
  };

}

module.exports = {
  createAuth
};