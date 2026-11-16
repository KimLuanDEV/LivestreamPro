const me = JSON.parse(localStorage.getItem("user_profile") || "{}");

// 🔒 tạo deviceId cố định cho thiết bị
let deviceId = localStorage.getItem("device_id");
if (!deviceId) {
  deviceId = "dev_" + Math.random().toString(36).slice(2);
  localStorage.setItem("device_id", deviceId);
}

// 🔥 CONNECT SOCKET CÓ AUTH
const socket = io({
  auth: {
    uid: me.uid,
    deviceId
  }
});


function goInvest(asset){
  location.href = `/invest-detail.html?asset=${asset}`;
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


socket.on("force-logout", (data) => {
  const msg = data?.message || "Tài khoản của bạn đã bị đăng xuất";

  showForceLogoutModal(msg);

  // clear auth
  localStorage.removeItem("user_profile");
  localStorage.removeItem("login_uid");
  localStorage.removeItem("isGuest");

  // redirect sau 2s
  setTimeout(()=>{
    location.href = "/login.html";
  }, 3000);
});


// === PORTFOLIO SHEET ===
function openPortfolio(){
  const sheet = document.getElementById("portfolioSheet");
  if(sheet){
    sheet.classList.remove("hidden");
  }else{
    console.warn("❌ Không tìm thấy #portfolioSheet");
  }
}

function closePortfolio(){
  const sheet = document.getElementById("portfolioSheet");
  if(sheet){
    sheet.classList.add("hidden");
  }
}




// ==========================================
// GAME CENTER V2 - PAGE CONTROLLER
// ==========================================

let currentGameHubPage = 1;

function getGameHubPages() {
  const sheet = document.getElementById("gameHubSheet");
  if (!sheet) return [];

  return Array.from(
    sheet.querySelectorAll(".game-showroom-page")
  );
}


// ==========================================
// SET ACTIVE PAGE
// ==========================================

function setGameHubPage(pageNumber) {
  const pages = getGameHubPages();
  const totalPages = pages.length;

  if (!totalPages) return;

  const nextPage = Math.max(
    1,
    Math.min(totalPages, pageNumber)
  );

  currentGameHubPage = nextPage;

  pages.forEach((page, index) => {
    const active = index + 1 === nextPage;

    page.hidden = !active;
    page.classList.toggle("is-active", active);

    page.querySelectorAll("button").forEach(button => {
      button.tabIndex = active ? 0 : -1;
    });
  });

  // UPDATE COUNTER
  const counter = document.getElementById("gamePageCounter");

  if (counter) {
    counter.textContent =
      String(nextPage).padStart(2, "0") +
      " / " +
      String(totalPages).padStart(2, "0");
  }

  // UPDATE NAV BUTTONS
  const prev = document.getElementById("gamePagePrev");
  const next = document.getElementById("gamePageNext");

  if (prev) prev.disabled = nextPage === 1;
  if (next) next.disabled = nextPage === totalPages;

  // UPDATE PAGE DOTS
  const dots = document.getElementById("gamePageDots");

  if (dots) {
    dots.replaceChildren();

    for (let i = 1; i <= totalPages; i++) {
      const dot = document.createElement("span");

      dot.className =
        "game-page-dot" +
        (i === nextPage ? " is-active" : "");

      dots.appendChild(dot);
    }
  }
}


// ==========================================
// PREVIOUS / NEXT
// ==========================================

function changeGameHubPage(direction) {
  if (direction !== 1 && direction !== -1) return;

  setGameHubPage(currentGameHubPage + direction);
}


// ==========================================
// OPEN GAME CENTER
// ==========================================

function openGameHub() {
  const sheet = document.getElementById("gameHubSheet");
  if (!sheet) return;

  // Always open page 1
  setGameHubPage(1);

  sheet.classList.remove("hidden");
  document.body.classList.add("sheet-open");

  const box = sheet.querySelector(".game-showroom-box");

  if (box) box.scrollTop = 0;
}


// ==========================================
// CLOSE GAME CENTER
// ==========================================

function closeGameHub() {
  const sheet = document.getElementById("gameHubSheet");
  if (!sheet) return;

  sheet.classList.add("hidden");

  const portfolio =
    document.getElementById("portfolioSheet");

  if (!portfolio ||
      portfolio.classList.contains("hidden")) {
    document.body.classList.remove("sheet-open");
  }
}




function openWheelGame(){
  location.href = "/game-wheel.html";
}


function openPortfolio(){
  document.getElementById("portfolioSheet").classList.remove("hidden");
  document.body.classList.add("sheet-open");
}

function closePortfolio(){
  document.getElementById("portfolioSheet").classList.add("hidden");
  document.body.classList.remove("sheet-open");
}


function openRPSGame(){
  location.href = "/game-rps.html"; // trang game sau này
}

function openDiamondHunter(){

  location.href = "/game-diamond-hunter.html";
}


function openKingSlaveGame(){
  location.href = "/game-king-slave.html";
}


function openTimeRaceGame(){
  location.href = "/game-time-race.html";
}


function openDiamondFactoryGame(){
  location.href = "/game-starwar.html";
}




function openDragonTigerGame(){
  location.href = "/game-dragon-tiger-phoenix.html";
}


function openTimeStopGame(){
  location.href = "/game-time-stop.html";
}


function openWheel8Game(){
  location.href = "/game-military.html";
}