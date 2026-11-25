function getChatKey(a, b) {
  if (!a || !b) return null;
  return a < b
    ? "chat_" + a + "_" + b
    : "chat_" + b + "_" + a;
}



(() => {
  const auth = JSON.parse(localStorage.getItem("user_profile") || "{}");
  if (!auth?.uid) return;



/* ==========================================
   LIVESTREAM PRO - SHARED SOCKET CONNECTION
========================================== */


/* ==========================================
   LIVESTREAM PRO - WEBSOCKET DIRECT
========================================== */

window.socket = window.socket || io({
  autoConnect: true,

  // Connect directly without HTTP polling
  transports: ["websocket"],
  upgrade: false,

  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1500,
  reconnectionDelayMax: 10000,
  randomizationFactor: 0.5,

  timeout: 20000
});

const socket = window.socket;



// Register on every successful connection.
// Server derives the UID from its verified session.
function registerVerifiedSocket() {
  if (!socket.connected) return;

  socket.emit("auth-login");
}

socket.on("connect", () => {
  console.log("[SOCKET] Connected:", socket.id);

  registerVerifiedSocket();
});



socket.on("disconnect", reason => {

  if (
    socketPageLeaving ||
    reason === "io client disconnect"
  ) {
    return;
  }

  if (
    reason === "transport close" ||
    reason === "transport error" ||
    reason === "ping timeout"
  ) {
    console.debug(
      "[SOCKET] Connection interrupted:",
      reason
    );

    return;
  }

  console.warn(
    "[SOCKET] Disconnected:",
    reason
  );

});




socket.on("connect_error", error => {
  console.warn("[SOCKET] Connection error:", error.message);
});

// Handle an already connected shared socket.
registerVerifiedSocket();





/* ==========================================
   LIVESTREAM PRO - SAFE SOCKET LIFECYCLE
========================================== */

let socketPageLeaving = false;

function restorePageSocket() {

  if (socketPageLeaving) return;

  if (socket.connected) return;

  // Do not restart an active connection attempt
  if (socket.active) return;

  socket.connect();
}

// Close the connection before page navigation
window.addEventListener("pagehide", () => {

  socketPageLeaving = true;

  if (socket.active || socket.connected) {
    socket.disconnect();
  }

});

// Restore the page from BFCache
window.addEventListener("pageshow", () => {

  socketPageLeaving = false;

  restorePageSocket();

});

// Recover when returning to the tab
document.addEventListener("visibilitychange", () => {

  if (document.visibilityState !== "visible") {
    return;
  }

  restorePageSocket();

});




socket.on("offline-messages", msgs => {
  if (!Array.isArray(msgs) || !msgs.length) return;

  let notifyCount = 0;
  let lastFrom = null;

msgs.forEach(m => {

  if (!m?.id || !m.from || !m.to) return;

  const uid = String(auth.uid);

  if (String(m.to) !== uid) return;

  const peer = String(m.from);

  const key = getChatKey(uid, peer);

  if (!key) return;

  const clearKey =
    "lsp_chat_clear_" +
    JSON.stringify([uid, peer]);

  const clearTime = Number(
    localStorage.getItem(clearKey) || 0
  );

  const messageTime = Number(
    m.time || String(m.id).split("_")[0]
  );

  if (
    clearTime &&
    (
      !Number.isFinite(messageTime) ||
      messageTime <= clearTime
    )
  ) {
    return;
  }

  const arr = JSON.parse(
    localStorage.getItem(key) || "[]"
  );

  if (
    arr.some(item => item.id === m.id)
  ) {
    return;
  }

  arr.push({

    ...m,

    peer,

    seen: false

  });

  localStorage.setItem(
    key,
    JSON.stringify(arr)
  );

  notifyCount++;

  lastFrom = m.from;

});

/* ==========================================
   OFFLINE MESSAGE - BADGE ONLY
========================================== */

if (
  !location.pathname.includes("messages.html") &&
  notifyCount > 0
) {

  document
    .querySelector('[data-tab="chat"]')
    ?.classList.add("has-new");

}
});



setInterval(() => {
  if (!socket.connected) return;

  socket.emit("auth-ping", {
    uid: auth.uid
  });
}, 15000);


/* ==========================================
   GLOBAL PRIVATE MESSAGE RECEIVER V3.0
   SINGLE NOTIFICATION MODE
========================================== */

socket.on("private-message", ({
  from,
  text,
  msgId,
  time
}) => {

  if (!from?.uid || !msgId || !text) return;

  // Messages page has its own receiver
  if (
    location.pathname.includes("messages.html")
  ) {
    return;
  }

  const peer = String(from.uid);

  const key = getChatKey(
    auth.uid,
    peer
  );

  if (!key) return;

  /* ==========================================
     PREVENT RESTORING DELETED MESSAGES
  ========================================== */

  const clearKey =
    "lsp_chat_clear_" +
    JSON.stringify([
      String(auth.uid),
      peer
    ]);

  const clearTime = Number(
    localStorage.getItem(clearKey) || 0
  );

  const messageTime = Number(
    time || String(msgId).split("_")[0]
  );

  if (
    clearTime &&
    (
      !Number.isFinite(messageTime) ||
      messageTime <= clearTime
    )
  ) {
    return;
  }

  /* ==========================================
     PREVENT DUPLICATE MESSAGES
  ========================================== */

  const arr = JSON.parse(
    localStorage.getItem(key) || "[]"
  );

  const exists = arr.some(
    item => item.id === msgId
  );

  if (!exists) {

    arr.push({

      id: msgId,

      from: peer,

      to: auth.uid,

      text,

      time: Number.isFinite(messageTime)
        ? messageTime
        : Date.now(),

      peer,

      seen: false

    });

    localStorage.setItem(
      key,
      JSON.stringify(arr)
    );

  }

  /* ==========================================
     UPDATE INBOX BADGE ONLY
  ========================================== */

  document
    .querySelector('[data-tab="chat"]')
    ?.classList.add("has-new");

  // Web Push is handled exclusively by sw.js

});



})();




// 🔔 SYSTEM NOTIFY (ADMIN / SYSTEM)
socket.on("system-notify", data => {
  if (!data || !data.type) return;

  console.log("🔔 system-notify:", data);

  // ➖ COINS DEDUCTED
  if (data.type === "withdraw") {
    showSystemWithdraw(data);
  }

  // ➕ COINS ADDED (if applicable)
  if (data.type === "topup") {
    showSystemTopup(data);
  }
});


function showSystemWithdraw(data){
  const text =
    data.text ||
    "Coins have been deducted from your account";

  showMsg(text);
}

function showSystemTopup(data){
  const text =
    data.text ||
    "Coins have been added to your account";

  showMsg(text);
}
