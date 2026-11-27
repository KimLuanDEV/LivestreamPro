"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// V3: synchronous local purge. Caller MUST hold the exclusive in-process write window.
module.exports = function runDeletionEngine(dir, financialCheck, options) {
  if (!options || typeof options.uid !== "string" || typeof options.commitUsers !== "function") {
    throw new Error("Online deletion requires a selected UID and central user writer");
  }
  const requests = path.join(dir, "account-deletion-requests");
  const file = name => path.join(dir, name);
  const object = x => x && typeof x === "object" && !Array.isArray(x);
  function read(name, fallback, check) {
    let value;
    try { value = JSON.parse(fs.readFileSync(name, "utf8")); }
    catch (e) { if (e.code !== "ENOENT" || fallback === undefined) throw e; value = fallback; }
    if (!check(value)) throw new Error("Invalid data file: " + path.basename(name));
    return value;
  }
  function write(name, value) {
    const tmp = name + "." + crypto.randomUUID() + ".tmp";
    let fd;
    try {
      fd = fs.openSync(tmp, "wx", 0o600);
      fs.writeFileSync(fd, JSON.stringify(value, null, 2), "utf8");
      fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined;
      fs.renameSync(tmp, name);
      const parent = fs.openSync(path.dirname(name), "r");
      try { fs.fsyncSync(parent); } finally { fs.closeSync(parent); }
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
      try { fs.unlinkSync(tmp); } catch (e) { if (e.code !== "ENOENT") throw e; }
    }
  }
  const now = () => new Date().toISOString();
  function purge(record, requestFile) {
    const uid = record.uid;
    const users = read(file("users.json"), undefined, object);
    const account = Object.hasOwn(users, uid) ? users[uid] : null;
    const saveRequest = changes => {
      record = { ...record, ...changes, updatedAt: now() };
      write(requestFile, record);
    };
    if (!account) {
      if (!record.coreWriteReady || record.engineState !== "purging") throw new Error("Account missing before verified core removal");
      options.afterCommit?.();
      saveRequest({ engineState: "local_done", localDeletedAt: now(), engineError: null });
      return;
    }
    if (!account.profile?.accountBlocked || account.role === "admin" || account.profile.role === "admin" || account.roles?.includes("admin")) throw new Error("Account not safely locked or protected role");
    const issues = financialCheck(uid, users,
      read(file("withdraw_requests.json"), [], Array.isArray),
      read(file("market_booths.json"), {}, object),
      read(file("lsp_pg_orders.json"), {}, object));
    if (issues.length) throw new Error(issues.join("; "));
    // Validate existing disk files. Live caches are authoritative for this process,
    // e.g. inbox notifications and seen flags may not yet have been persisted.
    const diskPosts = read(file("social_posts.json"), [], Array.isArray);
    const diskInbox = read(file("inbox.json"), {}, object);
    const diskWheel = read(file("wheel8_user_history.json"), {}, object);
    const posts = options.liveCaches ? structuredClone(options.liveCaches.social) : diskPosts;
    const inbox = options.liveCaches ? structuredClone(options.liveCaches.inbox) : diskInbox;
    const wheel = options.liveCaches ? structuredClone(options.liveCaches.wheel) : diskWheel;
    if (!Array.isArray(posts) || !object(inbox) || !object(wheel)) throw new Error("Invalid live cache snapshot");
    // Collect candidates for manual R2 ownership verification BEFORE removing references.
    const media = new Set(record.mediaCandidates || []);
    function candidate(value) {
      if (typeof value === "string" && value.length <= 2048 && /(?:^|\/)(?:avatars|covers|posts\/images|posts\/videos|chat\/images|chat\/videos)\//.test(value)) media.add(value);
    }
    candidate(account.profile.avatar); candidate(account.profile.cover);
    for (const p of posts) if (p?.uid === uid) {
      candidate(p.image); candidate(p.video);
      if (Array.isArray(p.images)) p.images.forEach(candidate);
    }
    for (const entries of Object.values(inbox)) {
      if (!Array.isArray(entries)) throw new Error("Invalid inbox list");
      for (const m of entries) if (m?.from === uid && typeof m.text === "string") {
        const match = m.text.match(/^\/(?:img|video) (.+)$/); if (match) candidate(match[1]);
      }
    }
    saveRequest({ engineState: "purging", coreWriteReady: false, mediaCandidates: [...media], engineError: null });
    function cleanSocial(node) {
      if (!object(node)) throw new Error("Invalid social entry");
      if (Array.isArray(node.likes)) node.likes = node.likes.filter(x => x !== uid);
      for (const key of ["comments", "replies"]) if (Array.isArray(node[key])) {
        node[key] = node[key].map(cleanSocial).filter(Boolean);
      }
      if (node.uid === uid) {
        const children = node.replies || [];
        return children.length ? { id: node.id, uid: "", name: "Deleted account", text: "", likes: [], replies: children } : null;
      }
      // Keep aggregate gift totals; unlink donor identifier, not financial total.
      if (object(node.gifts?.byUser)) delete node.gifts.byUser[uid];
      return node;
    }
    const remainingPosts = posts.filter(p => p?.uid !== uid).map(cleanSocial);
    delete inbox[uid];
    for (const [owner, entries] of Object.entries(inbox)) {
      inbox[owner] = entries.filter(m => !m || ![m.from, m.to, m.peer, m.uid, m.fromUid, m.toUid].includes(uid));
    }
    delete wheel[uid];
    for (const u of Object.values(users)) for (const key of ["friends", "friendRequests", "blockedUsers"]) {
      if (Array.isArray(u?.profile?.[key])) u.profile[key] = u.profile[key].filter(x => x !== uid);
    }
    delete users[uid];
    write(file("social_posts.json"), remainingPosts);
    options.onCacheWritten?.("social", remainingPosts);
    write(file("inbox.json"), inbox);
    options.onCacheWritten?.("inbox", inbox);
    write(file("wheel8_user_history.json"), wheel);
    options.onCacheWritten?.("wheel", wheel);
    if (/^[A-Za-z0-9_-]{1,128}$/.test(uid)) {
      try { fs.unlinkSync(path.join(dir, "health", uid + ".json")); } catch (e) { if (e.code !== "ENOENT") throw e; }
    }
    // Core must be the LAST data file written. A crash can be safely retried.
    saveRequest({ coreWriteReady: true });
    options.commitUsers(users);
    options.afterCommit?.();
    saveRequest({ engineState: "local_done", localDeletedAt: now(), engineError: null });
  }
  let names;
  try { names = fs.readdirSync(requests); } catch (e) { if (e.code === "ENOENT") return; throw e; }
  const selected = crypto.createHash("sha256").update(options.uid).digest("hex") + ".json";
  for (const name of names.filter(n => n === selected)) {
    const requestFile = path.join(requests, name);
    const r = read(requestFile, undefined, object);
    if (r.status !== "pending" || r.stage !== "ready" || !["queued", "purging"].includes(r.engineState)) continue;
    if (typeof r.uid !== "string" || !r.uid || typeof r.requestId !== "string" || crypto.createHash("sha256").update(r.uid).digest("hex") + ".json" !== name) throw new Error("Invalid deletion request filename");
    try { purge(r, requestFile); }
    catch (e) {
      const latest = read(requestFile, undefined, object);
      // Preserve purging marker for restart recovery; do not claim completion.
      write(requestFile, { ...latest, engineState: latest.engineState === "purging" ? "purging" : "error", engineError: String(e.message).slice(0, 500), updatedAt: now() });
      console.error("[DELETION ENGINE] Pending cleanup:", r.requestId);
      throw e;
    }
  }
};

// Permanent UID guard for ordinary user saves; request records stay outside public/.
module.exports.loadTombstones = function loadTombstones(dir) {
  const fs = require("fs");
  const path = require("path");
  const crypto = require("crypto");
  const folder = path.join(dir, "account-deletion-requests");
  const result = new Set();
  let files;
  try { files = fs.readdirSync(folder); } catch (err) {
    if (err.code === "ENOENT") return result;
    throw err;
  }
  const usersFile = path.join(dir, "users.json");
  const users = fs.existsSync(usersFile) ? JSON.parse(fs.readFileSync(usersFile, "utf8")) : {};
  for (const name of files.filter(n => /^[a-f0-9]{64}\.json$/.test(n))) {
    const r = JSON.parse(fs.readFileSync(path.join(folder, name), "utf8"));
    if (typeof r.uid !== "string" || crypto.createHash("sha256").update(r.uid).digest("hex") + ".json" !== name) throw new Error("Invalid deletion record");
    if (r.status === "completed" || r.engineState === "local_done") {
      if (Object.hasOwn(users, r.uid)) throw new Error("Deleted UID found in restored users database; reconcile backup before starting");
      result.add(r.uid);
    } else if (r.engineState === "purging" && r.coreWriteReady && !Object.hasOwn(users, r.uid)) {
      result.add(r.uid);
    }
  }
  return result;
};
