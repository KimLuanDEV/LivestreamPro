

// ==========================================
// ADMIN SESSION - PASSWORD AUTH
// ==========================================

const admin = {
  uid: window.__LSP_ADMIN_ACTOR_UID || ""
};


const PAGE_SIZE = 5;
let userPage = 1;
let userSearchKey = "";

// ===== WITHDRAW PAGINATION =====
const WITHDRAW_PAGE_SIZE = 5;
let withdrawPage = 1;
let WITHDRAWS = [];


let currentAdminTab = "users";

function gotoUserPage(page){
  let list = USERS;

  if (userSearchKey) {
list = USERS.filter(u =>
  (u.uid || "").toLowerCase().includes(userSearchKey) ||
  (u.name || "").toLowerCase().includes(userSearchKey)
);
  }

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));

  // 🔒 chặn vượt biên
  if (page < 1) page = 1;
  if (page > totalPages) page = totalPages;

  userPage = page;
  renderUserPage();
}


function renderUserPage(){
  let list = USERS;

  // 🔍 áp dụng search nếu có
  if (userSearchKey) {
list = USERS.filter(u =>
  (u.uid || "").toLowerCase().includes(userSearchKey) ||
  (u.name || "").toLowerCase().includes(userSearchKey)
);
  }

  const start = (userPage - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const slice = list.slice(start, end);

  if (currentAdminTab === "users") {
    renderUsers(slice);      // desktop
    renderUserCards(slice);  // mobile
  }

  const info = document.getElementById("userPageInfo");
  if (info) {
    info.textContent =
      `Trang ${userPage} / ${Math.max(1, Math.ceil(list.length / PAGE_SIZE))}`;
  }

  // 🔒 DISABLE PAGER BUTTON
  const pager = document.querySelector(".pager");
  if (pager) {
    const btnPrev = pager.querySelector("button:first-child");
    const btnNext = pager.querySelector("button:last-child");

    let totalList = USERS;
    if (userSearchKey) {
totalList = USERS.filter(u =>
  (u.uid || "").toLowerCase().includes(userSearchKey) ||
  (u.name || "").toLowerCase().includes(userSearchKey)
);
    }

    const totalPages = Math.max(1, Math.ceil(totalList.length / PAGE_SIZE));

    if (btnPrev) btnPrev.disabled = userPage <= 1;
    if (btnNext) btnNext.disabled = userPage >= totalPages;
  }




}





function renderUserCards(list) {
  const wrap = document.getElementById("userCardList");
  if (!wrap) return;

  wrap.innerHTML = "";

  list.forEach(u => {
    const card = document.createElement("div");
    card.className = "user-card";

    card.innerHTML = `
      <div class="user-card-header"
           onclick="this.nextElementSibling.classList.toggle('hidden')">

        <img src="${u.avatar || '/avatar-default.png'}"
             alt="Avatar">

        <div>
          <b>${u.name || u.uid}</b><br>
          <small>${u.uid}</small>
        </div>
      </div>

      <div class="user-card-detail hidden">

        <div class="lux-detail-grid">

          <div class="lux-detail-cell">
            <span>Số dư Coin</span>
            <strong>${Number(u.coins || 0).toLocaleString("vi-VN")}</strong>
          </div>

          <div class="lux-detail-cell">
            <span>Cấp độ</span>
            <strong>${u.level || 1}</strong>
          </div>

          <div class="lux-detail-cell">
            <span>EXP</span>
            <strong>${Number(u.exp || 0).toLocaleString("vi-VN")}</strong>
          </div>

          <div class="lux-detail-cell">
            <span>Coin đã tặng</span>
            <strong>${Number(u.coinSent || 0).toLocaleString("vi-VN")}</strong>
          </div>

          <div class="lux-detail-cell">
            <span>Coin đã nhận</span>
            <strong>${Number(u.coinReceived || 0).toLocaleString("vi-VN")}</strong>
          </div>

          <div class="lux-detail-cell">
            <span>Trạng thái</span>
            <strong>${u.blocked ? "Đã khóa" : "Hoạt động"}</strong>
          </div>

        </div>

        <div class="user-actions" style="margin-top:13px">

          <button class="action-btn"
            type="button"
            data-action="topup">
            Cộng Coin
          </button>

          <button class="action-btn"
            type="button"
            data-action="withdraw">
            Trừ Coin
          </button>

          <button class="action-btn ${u.blocked ? 'lux-action-success' : 'lux-action-danger'}"
            type="button"
            data-action="lock">
            ${u.blocked ? "Mở khóa" : "Khóa tài khoản"}
          </button>

        </div>

      </div>
    `;

    card.querySelector('[data-action="topup"]').onclick =
      e => {
        e.stopPropagation();
        quickTopup(u.uid);
      };

    card.querySelector('[data-action="withdraw"]').onclick =
      e => {
        e.stopPropagation();
        quickWithdraw(u.uid);
      };

    card.querySelector('[data-action="lock"]').onclick =
      e => {
        e.stopPropagation();
        toggleLock(u.uid, u.blocked);
      };

    wrap.appendChild(card);
  });
}



const adminUidLabel = document.getElementById("adminUid");

if (adminUidLabel) {
  adminUidLabel.textContent = "ĐÃ XÁC THỰC";
}


async function topup(){
  const uid = document.getElementById("uid").value.trim();
  const amount = Number(document.getElementById("amount").value);
  const note = document.getElementById("note").value;

  const res = await fetch("/api/admin/topup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      adminUid: admin.uid,
      targetUid: uid,
      amount,
      note
    })
  });

  const data = await res.json();

if (data.ok) {
  document.getElementById("log").textContent =
    `Đã nạp ${amount.toLocaleString()} coin cho ${uid}`;
  loadUsers(); // refresh bảng
} else {
  document.getElementById("log").textContent =
    "Nạp coin thất bại";
}


}


let USERS = [];

async function loadUsers(){
  const res = await fetch("/api/admin/users", {
    headers: {
      "x-uid": admin.uid
    }
  });
  const data = await res.json();
  if (!data.ok) return;

  USERS = data.users;


document.getElementById("statUsers").textContent = USERS.length;
document.getElementById("statCoins").textContent =
  USERS.reduce((s,u)=>s+(u.coins||0),0).toLocaleString();
document.getElementById("statBlocked").textContent =
  USERS.filter(u=>u.blocked).length;
document.getElementById("statAdmins").textContent =
  USERS.filter(u=>u.role==="admin").length;


  renderUserPage();

}

function renderUsers(list){
  const tbody = document.querySelector("#userTable tbody");
  tbody.innerHTML = "";

 list.forEach(u => {
  const tr = document.createElement("tr");

  if (u.blocked) {
    tr.style.opacity = "0.5";
    tr.style.filter = "grayscale(1)";
  }

  tr.innerHTML = `
    <td>
      <div class="user-row" onclick="toggleUserDetail(this)">
        <div class="user-cell">
          <img src="${u.avatar || '/avatar-default.png'}">
          <div>
            <b>${u.name}</b><br>
            <small>${u.uid}</small>
          </div>
        </div>

        <div class="user-detail hidden">
          <div class="user-meta">
            Số dư Coin:<b>${u.coins}</b> |
            Cấp độ: <b>${u.level}</b> |
            EXP: <b>${u.exp}</b><br>
            Đã tặng: <b>${u.coinSent}</b> |
            Đã nhận: <b>${u.coinReceived}</b><br>
            Vai trò:
            <b class="${u.role === "admin" ? "role-admin" : ""}">
              ${u.role}
            </b>
          </div>

          <div class="user-actions">
           
<button class="action-btn"
  onclick="event.stopPropagation(); quickTopup('${u.uid}')">
  Cộng Coin
</button>

<button class="action-btn"
  onclick="event.stopPropagation(); quickWithdraw('${u.uid}')">
  Trừ Coin
</button>

<button class="action-btn ${u.blocked ? 'lux-action-success' : 'lux-action-danger'}"
  onclick="event.stopPropagation(); toggleLock('${u.uid}', ${u.blocked})">
  ${u.blocked ? "Mở khóa" : "Khóa tài khoản"}
</button>

          </div>
        </div>
      </div>
    </td>
  `;

  tbody.appendChild(tr);
});




}





async function quickTopup(uid){
  const amount = await showModal({
    title: "Cộng Coin",
    body: "Nhập số coin:",
    input: true,
    confirm: true
  });
  if (!amount) return;

  await fetch("/api/admin/topup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      adminUid: admin.uid,
      targetUid: uid,
      amount: Number(amount)
    })
  });

  loadUsers();
}





async function toggleLock(uid, isBlocked){
  const reason = await showModal({
    title: isBlocked ? "Mở khoá tài khoản" : "Khoá tài khoản",
    body: "Nhập lý do:",
    input: true,
    confirm: true
  });

  if (reason === false) return;

  if (!isBlocked && !reason.trim()) {
    await showModal({
      title: "Thiếu lý do",
      body: "Vui lòng nhập lý do khoá tài khoản"
    });
    return;
  }

  const ok = await showModal({
    title: "Xác nhận",
    body: isBlocked
      ? "Bạn chắc chắn muốn MỞ KHOÁ tài khoản này?"
      : "Bạn chắc chắn muốn KHOÁ tài khoản này?",
    confirm: true
  });
  if (!ok) return;

  await fetch("/api/admin/lock-user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      adminUid: admin.uid,
      targetUid: uid,
      lock: !isBlocked,
      reason
    })
  });

  loadUsers();
}




const searchInput = document.getElementById("searchUser");

let searchTimer;

if (searchInput) {

  searchInput.addEventListener("input", e => {

    clearTimeout(searchTimer);

    searchTimer = setTimeout(()=>{

      userSearchKey = e.target.value.trim().toLowerCase();
      userPage = 1;
      renderUserPage();

    },120);

  });

}



loadUsers();

// ===== LIVE ROOMS (Realtime) =====
let LIVE_ROOMS = [];
let liveSocket = null;

function fmtTime(ts){
  try{
    return new Date(ts).toLocaleString("vi-VN");
  }catch{
    return "";
  }
}
function fmtDuration(ms){
  ms = Math.max(0, ms|0);
  const s = Math.floor(ms/1000);
  const m = Math.floor(s/60);
  const h = Math.floor(m/60);
  const mm = String(m%60).padStart(2,"0");
  const ss = String(s%60).padStart(2,"0");
  return h>0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

function renderLiveRooms(list){
  const tbody = document.querySelector("#liveTable tbody");
  if(!tbody) return;

  tbody.innerHTML = "";
  const now = Date.now();

  list.forEach(r=>{
    const tr = document.createElement("tr");

    const host = r.host || {};
    const hostName = host.name || "Host";
    const hostUid  = host.uid || "";
    const hostAva  = host.avatar || "/avatar-default.png";

    tr.innerHTML = `
      <td><b>${r.roomId}</b></td>

      <td>
        <div class="user-cell">
          <img src="${hostAva}" onerror="this.src='/avatar-default.png'">
          <div>
            <b>${hostName}</b><br>
            <small>${hostUid}</small>
          </div>
        </div>
      </td>

      <td><b style="color:#dfbd89">${r.viewers || 0}</b></td>
      <td>${fmtTime(r.liveStartTs)}</td>
      <td>${fmtDuration(now - (r.liveStartTs || now))}</td>

      <td>
        <button class="btn-mini"
          onclick="event.stopPropagation(); adminCloseRoom('${r.roomId}')">
          Đóng phòng
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

function filterLiveRooms(){
  const q = (document.getElementById("searchRoom")?.value || "").toLowerCase().trim();
  if(!q) return LIVE_ROOMS;

  return LIVE_ROOMS.filter(r=>{
    const rid = String(r.roomId||"").toLowerCase();
    const hostName = String(r.host?.name||"").toLowerCase();
    const hostUid  = String(r.host?.uid||"").toLowerCase();
    return rid.includes(q) || hostName.includes(q) || hostUid.includes(q);
  });
}

async function refreshLiveRooms(){
  const elLog = document.getElementById("liveLog");
  if(elLog) elLog.textContent = "⏳ Đang tải live rooms...";

  const res = await fetch("/api/admin/live-rooms", {
    headers: { "x-uid": admin.uid }
  });

  const data = await res.json();
  if(!data.ok){
    if(elLog) elLog.textContent = "❌ Không tải được live rooms";
    return;
  }

  LIVE_ROOMS = data.rooms || [];
  renderLiveRooms(filterLiveRooms());

  if(elLog) elLog.textContent =
    `✅ Live rooms: ${LIVE_ROOMS.length} (ts: ${fmtTime(data.ts)})`;
}

// realtime from server: io.emit("lobby-update", { rooms, ts })
function initLiveRoomsRealtime(){
  if(typeof io !== "function") return;

  liveSocket = io();

  liveSocket.on("connect", ()=>{
    // load lần đầu ngay khi connect
    refreshLiveRooms();
  });

  liveSocket.on("lobby-update", ({ rooms })=>{
    LIVE_ROOMS = rooms || [];
    renderLiveRooms(filterLiveRooms());
  });
}

async function adminCloseRoom(roomId){
  const reason = await showModal({
    title: "Đóng phòng live",
    body: "Nhập lý do (tuỳ chọn):",
    input: true,
    confirm: true
  });
  if (reason === false) return;

  const ok = await showModal({
    title: "Xác nhận",
    body: `Bạn chắc chắn muốn đóng room "${roomId}" ?`,
    confirm: true
  });
  if (!ok) return;

  const res = await fetch("/api/admin/close-room", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({
      adminUid: admin.uid,
      roomId,
      reason
    })
  });

  const data = await res.json();

  await showModal({
    title: data.ok ? "Thành công" : "Thất bại",
    body: data.ok ? `Đã đóng room ${roomId}` : "Không đóng được room"
  });
}




// search live rooms
const roomSearch = document.getElementById("searchRoom");
if(roomSearch){
  roomSearch.addEventListener("input", ()=>{
    renderLiveRooms(filterLiveRooms());
  });
}

// start realtime
initLiveRoomsRealtime();


async function closeLiveRoom(){
  const roomId = document.getElementById("closeRoomId").value.trim();
  const reason = document.getElementById("closeReason").value.trim();

  if(!roomId){
    alert("⚠️ Nhập roomId");
    return;
  }

  const ok = confirm(`Xác nhận đóng room "${roomId}" ?`);
  if(!ok) return;

  const res = await fetch("/api/admin/close-room", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      adminUid: admin.uid,
      roomId,
      reason
    })
  });

  const data = await res.json();

  document.getElementById("closeLog").textContent =
    data.ok
      ? `Đã đóng room ${roomId}`
      : `Lỗi: ${data.error || "fail"}`;
}


async function quickWithdraw(uid){
  const amount = await showModal({
    title: "Trừ Coin",
    body: "Nhập số coin cần rút:",
    input: true,
    confirm: true
  });
  if (!amount) return;

  const note = await showModal({
    title: "Ghi chú",
    body: "Nhập lý do rút coin:",
    input: true,
    confirm: true
  });
  if (note === false) return;

  await fetch("/api/admin/withdraw", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({
      adminUid: admin.uid,
      targetUid: uid,
      amount: Number(amount),
      note
    })
  });

  loadUsers();
}




function adminWithdrawEscape(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]
  );
}

function adminWithdrawNote(w) {
  const saved = String(w.note || "").trim();
  if (saved) return saved;

  const defaults = {
    pending: "Your withdrawal request is awaiting review.",
    processing: "Your withdrawal is being processed.",
    approved: "Your withdrawal has been approved.",
    rejected: "Your withdrawal request was rejected."
  };

  return defaults[w.status] || "-";
}

function adminWithdrawActions(w) {
  const status = w.status || "pending";
  const id = JSON.stringify(String(w.id));

  if (["approved", "rejected"].includes(status)) {
    return `<span class="muted">Đã kết thúc</span>`;
  }

  return `
    <button class="withdraw-note-action"
      onclick='withdrawAction(${id}, "note")'>
      Ghi chú
    </button>

    ${
      status === "pending"
      ? `
        <button class="withdraw-note-action"
          onclick='withdrawAction(${id}, "processing")'>
          Processing
        </button>
      `
      : ""
    }

    <button class="lux-action-success"
      onclick='withdrawAction(${id}, "approve")'>
      Phê duyệt
    </button>

    <button class="lux-action-danger"
      onclick='withdrawAction(${id}, "reject")'>
      Từ chối
    </button>
  `;
}



function renderWithdrawCards(list) {
  const wrap = document.getElementById("withdrawCardList");
  if (!wrap) return;

  wrap.innerHTML = "";

  if (!Array.isArray(list) || !list.length) {
    wrap.innerHTML =
      `<div class="muted">Chưa có yêu cầu rút tiền.</div>`;
    return;
  }

  list.forEach(w => {
    const card = document.createElement("div");
    card.className = "withdraw-card";

    const status = w.status || "pending";
    const time = w.createdAt
      ? new Date(w.createdAt).toLocaleString("vi-VN")
      : "-";

    const chipClass = {
      pending: "w-pending",
      processing: "w-processing",
      approved: "w-approved",
      rejected: "w-rejected"
    }[status] || "w-pending";

    card.innerHTML = `
      <div class="withdraw-card-head">
        <img src="/avatar-default.png" alt="">
        <div style="flex:1">
          <b>${adminWithdrawEscape(w.name || "Unknown")}</b>
          <div>
            <small>${adminWithdrawEscape(w.uid)}</small>
          </div>
        </div>

        <span class="w-chip ${chipClass}">
          ${adminWithdrawEscape(status)}
        </span>
      </div>

      <div class="withdraw-card-meta lux-withdraw-meta">
        <div class="lux-meta-row">
          <span>Số kim cương</span>
          <strong>${Number(w.amount || 0).toLocaleString()}</strong>
        </div>

        <div class="lux-meta-row">
          <span>Ngân hàng</span>
          <strong>${adminWithdrawEscape(w.bank || "-")}</strong>
        </div>

        <div class="lux-meta-row">
          <span>Thời gian</span>
          <strong>${time}</strong>
        </div>

        <div class="lux-meta-row">
          <span>Ghi chú</span>
          <strong class="withdraw-admin-note">
            ${adminWithdrawEscape(adminWithdrawNote(w))}
          </strong>
        </div>
      </div>

      <div class="withdraw-card-actions">
        ${adminWithdrawActions(w)}
      </div>
    `;

    wrap.appendChild(card);
  });
}



async function loadWithdraws() {
  try {
    const res = await fetch(
      "/api/admin/withdraw-requests",
      { credentials: "same-origin" }
    );

    const data = await res.json();

    if (!res.ok || !data.ok) {
      console.error(
        "Unable to load withdrawals:",
        data.error
      );
      return;
    }

    WITHDRAWS = Array.isArray(data.list)
      ? data.list
      : [];

    withdrawPage = 1;
    renderWithdrawPage();

  } catch (err) {
    console.error("Load withdrawals failed:", err);
  }
}




function renderWithdrawPage() {
  const totalPages = Math.max(
    1,
    Math.ceil(WITHDRAWS.length / WITHDRAW_PAGE_SIZE)
  );

  withdrawPage = Math.max(
    1,
    Math.min(withdrawPage, totalPages)
  );

  const start = (withdrawPage - 1) * WITHDRAW_PAGE_SIZE;
  const slice = WITHDRAWS.slice(
    start,
    start + WITHDRAW_PAGE_SIZE
  );

  const tbody = document.querySelector(
    "#withdrawTable tbody"
  );

  if (tbody) {
    tbody.innerHTML = "";

    slice.forEach(w => {
      const tr = document.createElement("tr");
      const status = w.status || "pending";

      const date = w.createdAt
        ? new Date(w.createdAt).toLocaleString("vi-VN")
        : "-";

      tr.innerHTML = `
        <td>
          <div class="withdraw-user">
            <img src="/avatar-default.png" alt="">
            <div>
              <b>${adminWithdrawEscape(w.name || "Unknown")}</b>
              <br>
              <small>${adminWithdrawEscape(w.uid)}</small>
            </div>
          </div>
        </td>

        <td>
          <b>${Number(w.amount || 0).toLocaleString()}</b>
        </td>

        <td>${adminWithdrawEscape(w.bank || "-")}</td>

        <td>${date}</td>

        <td>
          <span class="st-${adminWithdrawEscape(status)}">
            ${adminWithdrawEscape(status)}
          </span>
        </td>

        <td class="withdraw-admin-note">
          ${adminWithdrawEscape(adminWithdrawNote(w))}
        </td>

        <td class="withdraw-actions">
          ${adminWithdrawActions(w)}
        </td>
      `;

      tbody.appendChild(tr);
    });
  }

  // Mobile
  renderWithdrawCards(slice);

  // Pagination
  const info = document.getElementById(
    "withdrawPageInfo"
  );

  if (info) {
    info.textContent =
      `Trang ${withdrawPage} / ${totalPages}`;
  }

  const prev = document.getElementById("withdrawPrev");
  const next = document.getElementById("withdrawNext");

  if (prev) prev.disabled = withdrawPage <= 1;
  if (next) next.disabled = withdrawPage >= totalPages;
}



async function withdrawAction(id, action) {
  const item = WITHDRAWS.find(
    w => String(w.id) === String(id)
  );

  if (!item) return;

  const titles = {
    processing: "Chuyển sang đang xử lý",
    note: "Cập nhật ghi chú giao dịch",
    approve: "Phê duyệt yêu cầu rút tiền",
    reject: "Từ chối yêu cầu rút tiền"
  };

  const descriptions = {
    processing:
      "Nhập thông báo tiến độ gửi tới người dùng:",
    note:
      "Nhập ghi chú mới gửi tới người dùng:",
    approve:
      "Nhập ghi chú phê duyệt (tùy chọn):",
    reject:
      "Nhập lý do từ chối:"
  };

  const note = await showModal({
    title: titles[action] || "Cập nhật giao dịch",
    body: descriptions[action] || "Nhập ghi chú:",
    input: true,
    confirm: true
  });

  if (note === false) return;

  if (action === "reject" && !String(note).trim()) {
    await showModal({
      title: "Thiếu lý do",
      body: "Vui lòng nhập lý do từ chối giao dịch."
    });
    return;
  }

  if (action === "note" && !String(note).trim()) {
    await showModal({
      title: "Thiếu ghi chú",
      body: "Vui lòng nhập nội dung thông báo."
    });
    return;
  }

  if (["approve", "reject"].includes(action)) {
    const confirmed = await showModal({
      title: "Xác nhận thao tác",
      body: action === "approve"
        ? "Bạn chắc chắn muốn phê duyệt giao dịch này?"
        : "Bạn chắc chắn muốn từ chối và hoàn kim cương?",
      confirm: true
    });

    if (!confirmed) return;
  }

  try {
    const res = await fetch("/api/admin/withdraw-action", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "same-origin",
      body: JSON.stringify({
        withdrawId: id,
        action,
        note: String(note)
      })
    });

    const data = await res.json();

    await showModal({
      title: data.ok ? "Thành công" : "Thất bại",
      body: data.ok
        ? "Đã cập nhật giao dịch và thông báo."
        : "Lỗi: " + (data.error || "unknown")
    });

    if (data.ok) {
      await loadWithdraws();
    }

  } catch (err) {
    console.error("Withdraw action error:", err);

    await showModal({
      title: "Lỗi kết nối",
      body: "Không thể kết nối tới máy chủ."
    });
  }
}


loadWithdraws();


let withdrawSocket = null;

function initWithdrawRealtime(){
  if (typeof io !== "function") return;

  withdrawSocket = io();

  withdrawSocket.on("connect", () => {
    console.log("🔔 Withdraw realtime connected");
  });

  withdrawSocket.on("withdraw-update", ({ ts }) => {
  const ping = document.getElementById("withdrawPing");
  if (ping) ping.classList.remove("hidden");

  loadWithdraws();

  // tự tắt ping sau 2s
  setTimeout(() => {
    ping && ping.classList.add("hidden");
  }, 2000);
});



}

initWithdrawRealtime();


document.querySelectorAll(".admin-tabs .tab").forEach(tab=>{
  tab.onclick = ()=>{


    document.querySelectorAll(".admin-tabs .tab")
      .forEach(t=>t.classList.remove("active"));
    tab.classList.add("active");

    const key = tab.dataset.tab;
    currentAdminTab = key;

if (key === "withdraws") {
  loadWithdraws();   // 🔥 BẮT BUỘC
}



    document.querySelectorAll(".admin-section")
      .forEach(sec=>{
        sec.classList.toggle("hidden", sec.dataset.section !== key);
      });

    // 🔥 QUAN TRỌNG: ẨN / HIỆN USER CARD LIST
    const userCardList = document.getElementById("userCardList");
    if (userCardList) {
      userCardList.style.display =
        key === "users" ? "" : "none";
    }
  };
});





function toggleUserDetail(el){
  const detail = el.querySelector(".user-detail");
  if (!detail) return;

  detail.classList.toggle("hidden");
}



const wPrev = document.getElementById("withdrawPrev");
const wNext = document.getElementById("withdrawNext");

if (wPrev) {
  wPrev.onclick = () => {
    withdrawPage--;
    renderWithdrawPage();
  };
}

if (wNext) {
  wNext.onclick = () => {
    withdrawPage++;
    renderWithdrawPage();
  };
}


function adminGoBack(){
  if (history.length > 1) {
    history.back();
  } else {
    location.href = "/"; // fallback
  }
}


async function adminDeletePost(postId){
  const reason = await showModal({
    title: "Xoá bài đăng",
    body: "Nhập lý do xoá (tuỳ chọn):",
    input: true,
    confirm: true
  });
  if (reason === false) return;

  const ok = await showModal({
    title: "Xác nhận",
    body: "Bạn chắc chắn muốn xoá bài đăng này?",
    confirm: true
  });
  if (!ok) return;

  const res = await fetch("/api/admin/delete-post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      adminUid: admin.uid,
      postId,
      reason
    })
  });

  const data = await res.json();

  await showModal({
    title: data.ok ? "Thành công" : "Thất bại",
    body: data.ok ? "Đã xoá bài đăng" : "Không xoá được bài"
  });
}






function showModal({ title, body, input=false, confirm=false }) {
  return new Promise(resolve => {
    const modal = document.getElementById("adminModal");
    const titleEl = document.getElementById("modalTitle");
    const bodyEl  = document.getElementById("modalBody");
    const inputEl = document.getElementById("modalInput");
    const btnOk   = document.getElementById("modalOk");
    const btnCancel = document.getElementById("modalCancel");

    titleEl.textContent = title || "Thông báo";
    bodyEl.innerHTML = body || "";
    modal.classList.remove("hidden");

    inputEl.classList.toggle("hidden", !input);
    inputEl.value = "";

    btnCancel.classList.toggle("hidden", !confirm);

    btnOk.onclick = () => {
      modal.classList.add("hidden");
      resolve(input ? inputEl.value : true);
    };

    btnCancel.onclick = () => {
      modal.classList.add("hidden");
      resolve(false);
    };
  });
}



async function loadDisputes(){
  

  const res = await fetch("/api/admin/market/disputes",{
    headers:{ "x-uid": admin.uid }
  });
  const data = await res.json();
  if(!data.ok) return;

  const wrap = document.getElementById("disputeList");
  wrap.innerHTML = "";

  if(data.list.length === 0){
    wrap.innerHTML = `<div class="empty">Không có khiếu nại</div>`;
    return;
  }

  data.list.forEach(item=>{
    const o = item.order;

    const div = document.createElement("div");
    div.className = "admin-card";

const evidences = o.dispute?.evidences || [];

div.innerHTML = `
  <b>📦 ${o.productName} ×${o.qty}</b>
  <div>🏪 Gian hàng: ${item.boothName}</div>
  <div>👤 Buyer: ${o.buyerUid}</div>

  <div style="color:#ff9800;margin-top:4px">
    ⚠️ Lý do: ${o.dispute?.reason || ""}
  </div>

  ${
    evidences.length
      ? `
      <div style="
        margin-top:8px;
        display:grid;
        grid-template-columns:repeat(3,1fr);
        gap:6px
      ">
        ${evidences.map(m =>
          m.type === "video"
            ? `
              <video
                src="${m.url}"
                controls
                style="width:100%;border-radius:8px">
              </video>
            `
            : `
              <img
                src="${m.url}"
                style="
                  width:100%;
                  border-radius:8px;
                  cursor:zoom-in
                "
                onclick="openAdminImage('${m.url}')"
              >
            `
        ).join("")}
      </div>
      `
      : `<div class="muted" style="margin-top:6px">Không có bằng chứng đính kèm</div>`
  }

  <div style="display:flex;gap:8px;margin-top:10px">
    <button style="color:#ff5f6d"
      onclick="adminRefund('${o.id}')">
      Hoàn tiền
    </button>

    <button style="color:#25F09A"
      onclick="adminApprove('${o.id}')">
      Chấp nhận đơn
    </button>
  </div>
`;


    wrap.appendChild(div);
  });
}


async function adminRefund(orderId){
  

  const ok = await showModal({
    title:"Hoàn tiền",
    body:"Xác nhận hoàn tiền cho người mua?",
    confirm:true
  });
  if(!ok) return;

  const res = await fetch("/api/admin/market/refund",{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({
      adminUid: admin.uid,
      orderId
    })
  });

  const data = await res.json();
  if(data.ok){
    await showModal({
      title:"Đã hoàn tiền",
      body:"Hoàn tiền thành công."
    });
    loadDisputes();
  }
}




async function adminApprove(orderId){
 

  const ok = await showModal({
    title:"Chấp nhận đơn khiếu nại",
    body:"Xác nhận cho shop nhận tiền?",
    confirm:true
  });
  if(!ok) return;

  const res = await fetch("/api/admin/market/approve-dispute",{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({
      adminUid: admin.uid,
      orderId
    })
  });

  const data = await res.json();
  if(data.ok){
    await showModal({
      title:"Thành công",
      body:"Đơn hàng đã được chấp nhận."
    });
    loadDisputes();
  }else{
    showModal({
      title:"Lỗi",
      body:data.error || "Không xử lý được"
    });
  }
}



document.querySelector('[data-tab="disputes"]')?.addEventListener("click",()=>{
  loadDisputes();
});


function openAdminImage(url){
  showModal({
    title: "📎 Bằng chứng",
    body: `
      <img src="${url}"
        style="max-width:100%;border-radius:10px">
    `
  });
}


function showForceLogoutModal(message){
  let modal = document.getElementById("forceLogoutModal");
  if(!modal){
    modal = document.createElement("div");
    modal.id = "forceLogoutModal";
    modal.innerHTML = `
      <div class="fl-backdrop"></div>
      <div class="fl-box">
        <div class="fl-icon">🚫</div>
        <div class="fl-title">Phiên đăng nhập kết thúc</div>
        <div class="fl-msg"></div>
        <div class="fl-sub">Bạn sẽ được chuyển về trang đăng nhập…</div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  modal.querySelector(".fl-msg").textContent = message;
  modal.classList.add("show");
}





document.addEventListener("gesturestart", function(e){
  e.preventDefault();
});

let lastTouchEnd = 0;

document.addEventListener("touchend", function(e){

  const now = Date.now();

  if(now - lastTouchEnd <= 300){
    e.preventDefault();
  }

  lastTouchEnd = now;

}, false);




/* ==========================================
   ADMIN - DIAMOND TRANSFER MANAGEMENT
========================================== */

let ADMIN_TRANSFERS = [];
let adminTransferFilter = "pending";
let transferAdminBusy = false;

function transferAdminEscape(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]
  );
}


// Tải yêu cầu từ server
async function loadAdminTransfers() {

  const box = document.getElementById("adminTransferList");
  if (!box) return;

  try {

    const res = await fetch(
      "/api/admin/transfer-requests",
      { credentials: "same-origin" }
    );

    if (!res.ok) {
      throw new Error("HTTP " + res.status);
    }

    const data = await res.json();

    if (!data.ok) {
      throw new Error("Cannot load transfers");
    }

    ADMIN_TRANSFERS = Array.isArray(data.list)
      ? data.list
      : [];

    renderAdminTransfers();

  } catch (err) {
    console.error("[ADMIN TRANSFERS]", err);
    box.textContent = "Không thể tải danh sách giao dịch.";
  }
}


// Hiển thị danh sách
function renderAdminTransfers() {

  const box = document.getElementById("adminTransferList");
  const count = document.getElementById("transferPendingCount");

  if (!box) return;

  const pending = ADMIN_TRANSFERS.filter(
    x => x.status === "pending"
  ).length;

  if (count) {
    count.textContent = `${pending} Pending`;
  }

  const list = ADMIN_TRANSFERS.filter(
    x => adminTransferFilter === "all" ||
         x.status === adminTransferFilter
  );

  box.innerHTML = "";

  if (!list.length) {
    box.innerHTML = `
      <div class="admin-transfer-empty">
        Không có giao dịch trong mục này.
      </div>
    `;
    return;
  }

  list.forEach(t => {

    const status = ["pending", "approved", "rejected"]
      .includes(t.status) ? t.status : "pending";

    const card = document.createElement("div");
    card.className = "admin-transfer-item";

    card.innerHTML = `
      <div class="admin-transfer-top">
        <span class="admin-transfer-id">
          ${transferAdminEscape(t.id)}
        </span>

        <span class="admin-transfer-status ${status}">
          ${status.toUpperCase()}
        </span>
      </div>

      <div class="admin-transfer-route">

        <div class="admin-transfer-person">
          <small>FROM PLAYER</small>
          <strong>${transferAdminEscape(t.fromName)}</strong>
          <span>UID: ${transferAdminEscape(t.fromUid)}</span>
        </div>

        <div class="admin-transfer-arrow">→</div>

        <div class="admin-transfer-person">
          <small>TO PLAYER</small>
          <strong>${transferAdminEscape(t.toName)}</strong>
          <span>UID: ${transferAdminEscape(t.toUid)}</span>
        </div>

      </div>

      <div class="admin-transfer-bottom">
        <div class="admin-transfer-amount">
          ${Number(t.amount || 0).toLocaleString("en-US")}
          <small>DIAMONDS</small>
        </div>

        <span class="admin-transfer-id">
          ${new Date(t.createdAt).toLocaleString("vi-VN")}
        </span>
      </div>
    `;

    if (status === "pending") {

      const actions = document.createElement("div");
      actions.className = "admin-transfer-actions";

      const approve = document.createElement("button");
      approve.className = "admin-transfer-approve";
      approve.textContent = "APPROVE";
      approve.disabled = transferAdminBusy;

      approve.onclick = () =>
        adminTransferAction(t.id, "approve");

      const reject = document.createElement("button");
      reject.className = "admin-transfer-reject";
      reject.textContent = "REJECT";
      reject.disabled = transferAdminBusy;

      reject.onclick = () =>
        adminTransferAction(t.id, "reject");

      actions.append(approve, reject);
      card.appendChild(actions);
    }

    box.appendChild(card);
  });
}


// Admin xử lý duyệt hoặc từ chối
async function adminTransferAction(id, action) {

  if (transferAdminBusy) return;

  const item = ADMIN_TRANSFERS.find(x => x.id === id);

  if (!item || item.status !== "pending") return;

  const approve = action === "approve";

  const confirmed = await showModal({
    title: approve
      ? "Xác nhận duyệt chuyển kim cương"
      : "Xác nhận từ chối giao dịch",

    body: approve
      ? `Duyệt ${Number(item.amount).toLocaleString("vi-VN")} kim cương từ ${item.fromUid} đến ${item.toUid}?`
      : `Từ chối giao dịch và hoàn lại ${Number(item.amount).toLocaleString("vi-VN")} kim cương cho ${item.fromUid}?`,

    confirm: true
  });

  if (!confirmed) return;

  transferAdminBusy = true;
  renderAdminTransfers();

  try {

    const res = await fetch(
      "/api/admin/transfer-action",
      {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id,
          action
        })
      }
    );

    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(
        data.error || "Transfer approval failed"
      );
    }

    await showModal({
      title: "Giao dịch đã xử lý",
      body: approve
        ? "Đã duyệt và cộng kim cương cho người nhận."
        : "Đã từ chối và hoàn kim cương cho người gửi."
    });

  } catch (err) {

    await showModal({
      title: "Không thể xử lý",
      body: String(err.message || "Unknown error")
    });

  } finally {

    transferAdminBusy = false;
    await loadAdminTransfers();
  }
}


// Bộ lọc trạng thái
document.querySelectorAll(
  "[data-transfer-filter]"
).forEach(btn => {

  btn.addEventListener("click", () => {

    adminTransferFilter = btn.dataset.transferFilter;

    document.querySelectorAll(
      "[data-transfer-filter]"
    ).forEach(b => b.classList.remove("active"));

    btn.classList.add("active");

    renderAdminTransfers();
  });
});


// Load khi chọn tab quản trị
document.querySelector(
  '[data-tab="transfers"]'
)?.addEventListener("click", loadAdminTransfers);


// Realtime: dùng socket riêng như phần rút tiền
if (typeof io === "function") {

  const adminTransferSocket = io();

  adminTransferSocket.on(
    "diamond-transfer-update",
    () => loadAdminTransfers()
  );
}


/* ==========================================
   LIVESTREAM PRO
   AUTH PERFORMANCE MONITOR V1.1
========================================== */

(() => {

  const panel = document.getElementById(
    "authPerformancePanel"
  );

  if (!panel) return;

  // Prevent duplicate initialization
  if (panel.dataset.initialized === "true") {
    return;
  }

  panel.dataset.initialized = "true";

  const $ = id => document.getElementById(id);

  const refreshBtn = $("authPerfRefreshBtn");
  const statusEl = $("authPerfStatus");

  let loading = false;
  let refreshTimer = null;
  let sessionExpired = false;

  const REFRESH_INTERVAL = 10000;


  /* ========================================
     NUMBER FORMATTING
  ======================================== */

  function formatNumber(value) {

    if (value === null ||
        value === undefined) {
      return "--";
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {
      return "--";
    }

    return number.toLocaleString("en-US");

  }


  function setText(id, value) {

    const element = $(id);

    if (element) {
      element.textContent = value;
    }

  }


  /* ========================================
     STATUS
  ======================================== */

  function setStatus(text, state) {

    if (!statusEl) return;

    statusEl.textContent = text;

    statusEl.classList.toggle(
      "is-active",
      state === "active"
    );

    statusEl.classList.toggle(
      "is-error",
      state === "error"
    );

  }


  /* ========================================
     RENDER AUTH STATISTICS
  ======================================== */

  function renderStats(data) {

    const errors = Number(data.errors || 0);

    const hits = Number(data.hits || 0);
    const misses = Number(data.misses || 0);

    const hasSamples = hits + misses > 0;

    const hitRate = Math.max(
      0,
      Math.min(100, Number(data.hitRate) || 0)
    );

    setText(
      "authPerfHitRate",
      hasSamples
        ? `${hitRate.toFixed(2)}%`
        : "--"
    );

    const progress =
      $("authPerfProgressFill");

    if (progress) {

      progress.style.width =
        `${hasSamples ? hitRate : 0}%`;

      progress.parentElement?.setAttribute(
        "aria-valuenow",
        String(hasSamples ? hitRate : 0)
      );

    }

    setText(
      "authPerfAccounts",
      formatNumber(data.cachedAccounts)
    );

    setText(
      "authPerfHits",
      formatNumber(data.hits)
    );

    setText(
      "authPerfMisses",
      formatNumber(data.misses)
    );

    setText(
      "authPerfRefreshes",
      formatNumber(data.refreshes)
    );

    setText(
      "authPerfDenied",
      formatNumber(data.denied)
    );

    setText(
      "authPerfErrors",
      formatNumber(data.errors)
    );

    const ttl = Number(data.cacheTTL);

    setText(
      "authPerfTTL",
      Number.isFinite(ttl)
        ? `${ttl / 1000}s`
        : "--"
    );

    setText(
      "authPerfVersion",
      String(data.version || "--")
    );

    const errorsEl = $("authPerfErrors");

    if (errorsEl) {

      errorsEl.classList.toggle(
        "is-danger",
        errors > 0
      );

      errorsEl.classList.toggle(
        "is-success",
        errors === 0
      );

    }

    setStatus(
      data.status === "ACTIVE"
        ? "ACTIVE"
        : "UNKNOWN",
      data.status === "ACTIVE"
        ? "active"
        : "error"
    );

    setText(
      "authPerfUpdated",
      "Updated: " +
        new Date().toLocaleTimeString("en-GB")
    );

  }


  /* ========================================
     FETCH LIVE SERVER DATA
  ======================================== */

  async function loadAuthPerformance() {

    if (
      loading ||
      sessionExpired ||
      document.hidden
    ) {
      return;
    }

    loading = true;

    if (refreshBtn) {

      refreshBtn.disabled = true;

      refreshBtn.classList.add(
        "is-loading"
      );

    }

    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      8000
    );

    try {

      const response = await fetch(

        "/api/admin/security-auth/stats",

        {
          method: "GET",

          credentials: "same-origin",

          cache: "no-store",

          signal: controller.signal
        }

      );

      // Admin session is no longer valid
      if (
        response.status === 401 ||
        response.status === 403
      ) {

        sessionExpired = true;

        stopAutoRefresh();

        setStatus(
          "ACCESS DENIED",
          "error"
        );

        setText(
          "authPerfUpdated",
          "Admin authorization required."
        );

        return;

      }

      const data = await response.json();

      if (!response.ok || !data.ok) {

        throw new Error(
          "Unable to load auth statistics"
        );

      }

      renderStats(data);

    } catch (error) {

      setStatus(
        "UNAVAILABLE",
        "error"
      );

      setText(
        "authPerfUpdated",
        "Update failed. Retrying..."
      );

      console.warn(
        "[AUTH PERFORMANCE]",
        error.message
      );

    } finally {

      clearTimeout(timeout);

      loading = false;

      if (refreshBtn) {

        refreshBtn.disabled = false;

        refreshBtn.classList.remove(
          "is-loading"
        );

      }

    }

  }


  /* ========================================
     AUTO REFRESH
  ======================================== */

  function startAutoRefresh() {

    if (
      refreshTimer !== null ||
      sessionExpired ||
      document.hidden
    ) {
      return;
    }

    refreshTimer = setInterval(
      loadAuthPerformance,
      REFRESH_INTERVAL
    );

  }


  function stopAutoRefresh() {

    if (refreshTimer !== null) {

      clearInterval(refreshTimer);

      refreshTimer = null;

    }

  }


  /* ========================================
     MANUAL REFRESH
  ======================================== */

  refreshBtn?.addEventListener(
    "click",
    () => {

      sessionExpired = false;

      loadAuthPerformance();

      startAutoRefresh();

    }
  );


  /* ========================================
     SAVE SERVER RESOURCES
  ======================================== */

  document.addEventListener(
    "visibilitychange",
    () => {

      if (document.hidden) {

        stopAutoRefresh();

      } else {

        loadAuthPerformance();

        startAutoRefresh();

      }

    }
  );

  window.addEventListener(
    "pagehide",
    stopAutoRefresh
  );

  window.addEventListener(
    "pageshow",
    () => {

      loadAuthPerformance();

      startAutoRefresh();

    }
  );


  // INITIAL LOAD

  loadAuthPerformance();

  startAutoRefresh();

})();