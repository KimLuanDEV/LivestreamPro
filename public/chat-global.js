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
    const key = getChatKey(m.from, m.to);
    if (!key) return;

    const arr = JSON.parse(localStorage.getItem(key) || "[]");
    arr.push(m);
    localStorage.setItem(key, JSON.stringify(arr));

    notifyCount++;
    lastFrom = m.from;
  });

// 🔔 Show a single combined notification
if (!location.pathname.includes("messages.html") && notifyCount > 0) {
  if (notifyCount === 1) {
    showMsg(`📩 Message from ${lastFrom}`);
  } else {
    showMsg(`📩 You have ${notifyCount} new messages`);
  }
}
});



setInterval(() => {
  if (!socket.connected) return;

  socket.emit("auth-ping", {
    uid: auth.uid
  });
}, 15000);


  // ===== RECEIVE PRIVATE MESSAGE ANYWHERE =====
  socket.on("private-message", ({ from, text, msgId }) => {

    if (!from?.uid || !text) return;


    const a = auth.uid;
    const b = from.uid;
    const key = a < b ? "chat_" + a + "_" + b : "chat_" + b + "_" + a;

    const arr = JSON.parse(localStorage.getItem(key) || "[]");
    arr.push({
      from: from.uid,
      to: a,
      text,
      time: Date.now(),
      peer: from.uid
    });
    localStorage.setItem(key, JSON.stringify(arr));

if (!location.pathname.includes("messages.html")) {
  showMsg(`📩 Message from ${from.name}: ${text.slice(0, 60)}`);
  document.querySelector('[data-tab="chat"]')?.classList.add("has-new");
}

    socket.emit("msg-seen", { to: from.uid, msgId });
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
