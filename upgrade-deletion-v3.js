"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const cp = require("child_process");

const root = process.cwd();

const hash = s =>
  crypto.createHash("sha256")
    .update(s)
    .digest("hex");

const normalize = s =>
  s.replace(/\r\n/g, "\n");

const plans = [];

function plan(file, before, after, groups) {
  plans.push({ file, before, after, groups });
}


/* ==========================================
   01. UPGRADE SERVER.JS
========================================== */

plan(
"server.js",

"410dabe603ee58df4726cb7ff3202ff494c2b547f4807dcfffd2d2a75ade160f",

"028e2bf747fab841d5262ade90e8bd104332ce45315db5ff3bccb3383bc226ee",

[

  [[[1,2]], `   ACCOUNT DELETION ENGINE V3.0 - ONLINE
   Single Node.js writer only.`],

  [[[4,17]], `const lspDeletionEngine = require("./account-deletion-engine");
const lspDeletionDataDir = "/opt/render/project/data";
const lspDeletionTombstones = lspDeletionEngine.loadTombstones(lspDeletionDataDir);
const lspDeletionQueue = new Set();
let lspDeletionAsyncInFlight = 0;
let lspDeletionRunning = false;

function lspDeletionGuardUserSave(db) {
  for (const uid of lspDeletionTombstones) {
    if (Object.hasOwn(db, uid)) throw new Error("DELETED_UID_WRITE_REJECTED");
  }
}`],


  /* ASYNC TRANSACTION TRACKING */

  [[3391,5446,5512,6954,7283,8359,8384,8414,8440,8466,8489,8600,8967,10467,10588,10599,12114,12215,12361,12889,13364,14064,15694,16081,16336,17081,17369,17466,17624,18434,18528,18798,18841,18893,19051,19107,20146,20431,21474,22549,22688,22739,22852,25866,25891,25913,26031,26059,26213,26238,26407],

  "  lspDeletionAsyncInFlight++;\n  try {\n"],


  [[3456,7301,8378,8402,8483,8506,9426,10488,10614,12211,12266,12606,15740,16324,16530,17150,17431,17609,17909,18481,18568,18837,18888,18939,19101,19325,20591,21598,22684,22735,22792,23174,25888,25995,26170,26320,26481],

  "\n  } finally { lspDeletionAsyncInFlight--; }"],


  [[5030],

  "      lspDeletionTombstones.has(String(socket.data.uid || \"\")) ||"],


  [[[5497,1],[5598,1],[6978,1],[8433,1],[8459,1],[8959,1],[13026,1],[13749,1],[14479,1],[20426,1]],

  "  \n  } finally { lspDeletionAsyncInFlight--; }\n}"],


  /* CENTRAL WALLET WRITE */

  [[[8887,42]], `      // Central wallet write (no await between final read and commit).
      saveUsers(db);
      securityTransaction.record("successfulTransactions", uid);
`],


  [[[10610,1]],

  "    \n  } finally { lspDeletionAsyncInFlight--; }\n}"],


  /* BLOCK PUSH FOR DELETED ACCOUNTS */

  [[[11106,1]],

  "  if(!uid || lspDeletionTombstones.has(String(uid))) return;"],


  /* CENTRAL USER DATABASE GUARD */

  [[11241],

  "  lspDeletionGuardUserSave(db);"],


  [[[11263,1]], `    const parent = fs.openSync(path.dirname(USERS_FILE), "r");
    try { fs.fsyncSync(parent); } finally { fs.closeSync(parent); }`],


  [[[11304,56]],

  "  return saveUsers(db);"],


  [[12828],

  "  if (filename === USERS_FILE) return saveUsers(data);"],


  [[[12829,7]],

  "  fs.writeFileSync(temp, JSON.stringify(data, null, 2), { mode: 0o600 });"],


  [[[12837,14],[15590,15],[15606,1],[15612,1],[15614,1]], null],


  /* PROTECT ADMIN & AGENT */

  [[[14517,1]], `    account.profile?.role === "admin" ||
    account.roles?.includes("admin") ||
    account.role === "agent" ||
    account.roles?.includes("agent")`],


  [[[14519,2]],

  "    issues.push(\"Tài khoản quản trị / đại lý cần xử lý riêng\");"],


  [[14838], `    const parent = fs.openSync(path.dirname(target), "r");
    try { fs.fsyncSync(parent); } finally { fs.closeSync(parent); }`],


  /* CHECK LIVE ROOMS */

  [[[14982,1]], `  if (Object.values(VIRTUAL_LIVE_ROOMS).some(r => r.ownerUid === uid)) {
    issues.push("Tài khoản đang được gán cho phòng live liên kết");
  }
  if ([...rooms.values()].some(r => r.ownerUid === uid || r.hostProfile?.uid === uid)) {
    issues.push("Còn phòng live cần đóng");
  }
  return [...new Set(issues)];`],


  [[15038], `engineMode: item.engineMode || null,
recoveryReady: item.engineState === "purging" && item.coreWriteReady === true && !profile,`],


  [[[15048,1]], `  item.engineState === "local_done" ||
  (item.engineState === "purging" && item.coreWriteReady && !profile)`],


  /* PREVENT LOCK DURING ACTIVE TRANSACTIONS */

  [[[15276,1]], `        if (lspDeletionAsyncInFlight || lspDeletionRunning) {
          return fail(409, "Hệ thống đang xử lý tác vụ. Thử lại để khóa tài khoản.");
        }`],


  /* ========================================
     ONLINE DELETION WORKER
  ======================================== */

  [[[15427,1]], `   ACCOUNT DELETION V3 - ONLINE WORKER
========================================== */

function lspDeletionReadJson(filename, fallback, validate) {
  let value;
  try { value = JSON.parse(fs.readFileSync(filename, "utf8")); }
  catch (e) { if (e.code !== "ENOENT") throw e; value = fallback; }
  if (!validate(value)) throw new Error("Invalid data: " + path.basename(filename));
  return value;
}
function lspDeletionObject(x) {
  return x && typeof x === "object" && !Array.isArray(x);
}
function lspDeletionReadCaches() {
  return {
    social: lspDeletionReadJson(SOCIAL_FILE, [], Array.isArray),
    inbox: lspDeletionReadJson(INBOX_FILE, {}, lspDeletionObject),
    wheel: lspDeletionReadJson(WHEEL8_USER_HISTORY_FILE, {}, lspDeletionObject)
  };
}
function lspDeletionApplyCache(name, value) {
  // Refresh the corresponding RAM cache immediately after its atomic disk write.
  if (name === "social") {
    lpPosts.length = 0;
    for (const post of value) lpPosts.push(post);
  } else if (name === "inbox") {
    userInbox = new Map(Object.entries(value));
  } else if (name === "wheel") {
    wheel8UserHistory = value;
  }
}
function lspRunDeletionQueue() {
  if (lspDeletionRunning || lspDeletionAsyncInFlight !== 0 || !lspDeletionQueue.size) return;
  const uid = lspDeletionQueue.values().next().value;
  lspDeletionRunning = true;
  try {
    const item = readAccountDeleteRequest(uid);
    if (!item || item.status !== "pending" || item.stage !== "ready" ||
        item.engineMode !== "online-v3" || !["queued", "purging"].includes(item.engineState)) {
      lspDeletionQueue.delete(uid);
      return;
    }
    const data = deletionManagerSnapshot();
    const account = data.users[uid];
    const recovery = !account && item.engineState === "purging" && item.coreWriteReady === true;
    if (!recovery) {
      if (!account?.profile?.accountBlocked) throw new Error("Account is not locked");
      const issues = deletionManagerIssues(uid, data);
      if (issues.length) throw new Error(issues.join("; "));
    }
    if ([...io.sockets.sockets.values()].some(s => s.data.uid === uid)) throw new Error("Account still connected");
    // Validate disk data, then pass authoritative RAM snapshots so unsaved inbox
    // notifications and seen flags belonging to other users are preserved.
    lspDeletionReadCaches();
    const liveCaches = {
      social: lpPosts,
      inbox: Object.fromEntries(userInbox),
      wheel: wheel8UserHistory
    };
    // No await from final check through commit and RAM refresh.
    function afterCommit() {
      lspDeletionTombstones.add(uid);
      pushSubs.delete(uid);
      activeUsers.delete(uid);
      securityAuth.invalidateCache();
    }
    try {
      lspDeletionEngine(lspDeletionDataDir, deletionBlockers, {
        uid,
        commitUsers: saveUsers,
        liveCaches,
        onCacheWritten: lspDeletionApplyCache,
        afterCommit
      });
    } catch (error) {
      // Recover after a partial file write without permitting a deleted UID to return.
      if (!Object.hasOwn(loadUsers(), uid)) afterCommit();
      // Any successfully written cache was already updated via onCacheWritten.
      // Preserve unpersisted changes in the other caches for the next retry.
      throw error;
    }
    const result = readAccountDeleteRequest(uid);
    if (result.engineState !== "local_done") throw new Error("Local cleanup did not complete");
    console.log("[DELETION V3] Local cleanup completed:", result.requestId);
  } catch (e) {
    try {
      const latest = readAccountDeleteRequest(uid);
      if (latest?.status === "pending" && latest.engineState !== "local_done") {
        deletionManagerSave({ ...latest,
          engineState: latest.engineState === "purging" ? "purging" : "error",
          engineError: String(e.message).slice(0, 500),
          updatedAt: new Date().toISOString()
        });
      }
    } catch (saveError) { console.error("[DELETION V3] Status save failed", saveError.name); }
    console.error("[DELETION V3] Cleanup paused", e.name);
  } finally {
    lspDeletionQueue.delete(uid);
    lspDeletionRunning = false;
  }
}

/* ==========================================
   ACCOUNT DELETION ENGINE V3.0`.replace("========================================== */\n\nfunction lspDeletionReadJson", "========================================== */\nfunction lspDeletionReadJson")],


  /* ADMIN QUEUE API */

  [[[15542,11]], `        if (![undefined, null, "error", "queued", "purging"].includes(item.engineState)) {
          return fail(409, "Yêu cầu đã được xử lý.");`],


  [[[15554,21]], `        const data = deletionManagerSnapshot();
        const account = data.users[uid];
        const recovery = !account && item.engineState === "purging" && item.coreWriteReady === true;
        if (!recovery) {
          if (!account?.profile?.accountBlocked || account.role === "admin" ||
              account.profile.role === "admin" || account.roles?.includes("admin")) {
            return fail(409, "Tài khoản chưa khóa hoặc được bảo vệ.");
          }
          const issues = deletionManagerIssues(uid, data);
          if (issues.length) return fail(409, issues.join("; "));`],


  [[[15576,13]], `        if ([...io.sockets.sockets.values()].some(s => s.data.uid === uid)) {
          return fail(409, "Tài khoản vẫn còn kết nối.");`],


  [[[15608,3]], `          engineMode: "online-v3",
          engineState: item.engineState === "purging" ? "purging" : "queued",`],


  [[[15616,1]], `        lspDeletionQueue.add(uid);
        // A synchronous worker can run now, or the interval will pick it up.
        lspRunDeletionQueue();
        const result = readAccountDeleteRequest(uid);
        return res.json({ok: true, engineState: result.engineState, engineError: result.engineError || null});`],


  /* PROTECT DELETED SOCKET IDENTITIES */

  [[[19486,1]], ` if (lspDeletionTombstones.has(String(uid)) || db[uid]?.profile?.accountBlocked ||
     (socket.data.authenticated === true && !db[uid]?.profile)) {`],


  [[[25988,1],[26159,1],[26313,1]],

  "  \n  } finally { lspDeletionAsyncInFlight--; }\n})();"],


  /* AUTO PROCESS QUEUE */

  [[26647], `// Restore authorized online jobs only. V2 queued records require a new admin confirmation.
for (const record of deletionManagerRecords()) {
  if (record.status === "pending" && record.stage === "ready" &&
      record.engineMode === "online-v3" && !record.engineError &&
      ["queued", "purging"].includes(record.engineState)) {
    lspDeletionQueue.add(record.uid);
  }
}
setInterval(lspRunDeletionQueue, 1000).unref();
`],

]);


/* ==========================================
   02. UPGRADE ACCOUNT DELETION ENGINE
========================================== */

plan(
"account-deletion-engine.js",

"a9bb8298da673ca386547b1fda06f7a83a092aece5fb9da86a75f9330aa70666",

"990b54599b0e3b2110cd2b046734dc8a4ded4a3916ff76ff4f92c1ed952f9d1b",

[

  [[[5,2]], `// V3: synchronous local purge. Caller MUST hold the exclusive in-process write window.
module.exports = function runDeletionEngine(dir, financialCheck, options) {
  if (!options || typeof options.uid !== "string" || typeof options.commitUsers !== "function") {
    throw new Error("Online deletion requires a selected UID and central user writer");
  }`],


  [[43], "      options.afterCommit?.();"],


  [[[52,3]], `    // Validate existing disk files. Live caches are authoritative for this process,
    // e.g. inbox notifications and seen flags may not yet have been persisted.
    const diskPosts = read(file("social_posts.json"), [], Array.isArray);
    const diskInbox = read(file("inbox.json"), {}, object);
    const diskWheel = read(file("wheel8_user_history.json"), {}, object);
    const posts = options.liveCaches ? structuredClone(options.liveCaches.social) : diskPosts;
    const inbox = options.liveCaches ? structuredClone(options.liveCaches.inbox) : diskInbox;
    const wheel = options.liveCaches ? structuredClone(options.liveCaches.wheel) : diskWheel;
    if (!Array.isArray(posts) || !object(inbox) || !object(wheel)) throw new Error("Invalid live cache snapshot");`],


  [[97], "    options.onCacheWritten?.(\"social\", remainingPosts);"],

  [[98], "    options.onCacheWritten?.(\"inbox\", inbox);"],

  [[99], "    options.onCacheWritten?.(\"wheel\", wheel);"],


  [[[104,1]], `    options.commitUsers(users);
    options.afterCommit?.();`],


  [[[109,1]], `  const selected = crypto.createHash("sha256").update(options.uid).digest("hex") + ".json";
  for (const name of names.filter(n => n === selected)) {`],


  [[120], "      throw e;"],


  /* PERMANENT UID TOMBSTONES */

  [[123], String.raw`
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
};`],

]);


/* ==========================================
   03. UPGRADE ADMIN.JS
========================================== */

plan(
"public/admin.js",

"57018ab6f1985128e8933c49582fe465f40ce042f439d20d1bd0bdfaa837e171",

"cf80c0b051c6d41fa6737c2a5d328463cd503e6d28b839619fac8ca2b548317b",

[

  [[[2006,1]],

  "      \"Đã khóa · Sẵn sàng xóa\","],


  [[[2009,1]],

  "      \"Đang chờ tác vụ đang chạy kết thúc\","],


  [[[2012,1]],

  "      \"Đang xử lý / có thể thử lại nếu lỗi\","],


  [[[2089,1]], `    ["ready", "error"].includes(state) ||
    (state === "queued" && r.engineMode !== "online-v3") ||
    (state === "purging" && (r.engineError || r.engineMode !== "online-v3"))`],


  [[[2096,1]],

  "      \"Xóa dữ liệu ngay\","],


  [[[2110,1]],

  "      (!r.blocked && !r.recoveryReady) ||"],


  [[[2392,1]],

  "        ? \"Đã đối soát tài sản, lưu chứng từ cần giữ và xác nhận xóa không thể hoàn tác. Server sẽ tự xử lý dữ liệu cục bộ khi không còn tác vụ đang chạy, không cần khởi động lại.\""],


  [[2468], `  // Refresh only while an online deletion is pending and this tab is open.
  setInterval(() => {
    if (!document.hidden && tab.classList.contains("active") && !busy &&
        rows.some(r => r.engineMode === "online-v3" && !r.engineError &&
          ["queued", "purging"].includes(r.engineState))) load();
  }, 3000);
`],

]);


/* ==========================================
   04. UPGRADE ADMIN HTML
========================================== */

plan(
"public/lsp-admin-128995.html",

"ccc7832540598f493779a6f97270b78c296bf31be376563942b5baab511b662f",

"a0eb7a90f76edf1f7c8d9566a56a3356bf656a46b4a2b6933e7c4eee92626a45",

[

  [[[3834,1]],

  "        <h2>Account Deletion Engine V3.0</h2>"],


  [[[3968,1]],

  "script.src = \"/admin.js?v=20261127-account-deletion-v3\";"],

]);


/* ==========================================
   05. VALIDATE ALL SOURCE FILES
========================================== */

const prepared = [];

for (const p of plans) {

  const file = path.join(root, p.file);

  const original =
    fs.readFileSync(file, "utf8");

  const text = normalize(original);


  // Already upgraded

  if (hash(text) === p.after) {

    console.log("Already V3:", p.file);

    continue;

  }


  // Prevent patching incorrect versions

  if (hash(text) !== p.before) {

    throw new Error(

      "File version mismatch: " + p.file

    );

  }


  const lines = text.split("\n");


  const edits = p.groups

    .flatMap(([positions, value]) =>

      positions.map(pos => {

        const [start, count] =

          Array.isArray(pos)

            ? pos

            : [pos, 0];

        return {
          start,
          count,
          value
        };

      })

    )

    .sort((a, b) => b.start - a.start);


  // Apply code insertions

  for (const e of edits) {

    lines.splice(

      e.start,

      e.count,

      ...(e.value === null

        ? []

        : e.value.split("\n"))

    );

  }


  const output = lines.join("\n");


  // Verify generated file

  if (hash(output) !== p.after) {

    throw new Error(

      "Patch validation failed: " + p.file

    );

  }


  prepared.push({

    file,

    original,

    output,

    name: p.file

  });

}


/* ==========================================
   06. DRY RUN
========================================== */

if (!prepared.length) {

  console.log("All files already V3");

  process.exit(0);

}


if (!process.argv.includes("--apply")) {

  console.log(

    "CHECK OK. Files to update:",

    prepared.map(x => x.name)

  );

  console.log(

    "Run again with --apply to insert changes."

  );

  process.exit(0);

}


/* ==========================================
   07. BACKUP SOURCE CODE
========================================== */

const backup = path.join(

  root,

  ".deletion-v3-backup-" + Date.now()

);


fs.mkdirSync(backup, {
  recursive: false
});


for (const p of prepared) {

  const b = path.join(backup, p.name);

  fs.mkdirSync(path.dirname(b), {
    recursive: true
  });

  fs.writeFileSync(b, p.original, {
    flag: "wx"
  });

}


/* ==========================================
   08. SYNTAX CHECK & APPLY UPGRADE
========================================== */

const staged = [];

try {

  for (const p of prepared) {

    const tmp =

      p.file +

      ".v3-" +

      crypto.randomUUID() +

      (
        p.name.endsWith(".js")
          ? ".js"
          : ".html"
      );


    staged.push({
      ...p,
      tmp
    });


    fs.writeFileSync(tmp, p.output, {
      flag: "wx"
    });


    // Check JS syntax before replacing files

    if (p.name.endsWith(".js")) {

      cp.execFileSync(

        process.execPath,

        ["--check", tmp],

        { stdio: "inherit" }

      );

    }

  }


  // Prevent concurrent source modifications

  for (const p of staged) {

    if (

      fs.readFileSync(p.file, "utf8") !==

      p.original

    ) {

      throw new Error(

        "Source changed: " + p.name

      );

    }

  }


  const committed = [];

  try {

    for (const p of staged) {

      fs.renameSync(p.tmp, p.file);

      committed.push(p);

    }

  } catch (err) {

    // Restore original source files

    for (const p of committed) {

      fs.copyFileSync(

        path.join(backup, p.name),

        p.file

      );

    }

    throw err;

  }

} finally {

  // Remove temporary source files

  for (const p of staged) {

    if (fs.existsSync(p.tmp)) {

      fs.unlinkSync(p.tmp);

    }

  }

}


/* ==========================================
   09. UPGRADE COMPLETE
========================================== */

console.log(
  "V3 code inserted. Backup:",
  backup
);