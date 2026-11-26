
/* =========================================
   LIVESTREAM PRO - LUXURY TOPUP
   ========================================= */

const auth = JSON.parse(
  localStorage.getItem("user_profile") || "{}"
);

if (!auth.uid) {
  location.href = "/login.html";
}

const socket = io();


/* ==========================================
   TOPUP - SOCKET PAGE LIFECYCLE
========================================== */

window.addEventListener("pagehide", () => {

  if (socket.connected || socket.active) {
    socket.disconnect();
  }

});

window.addEventListener("pageshow", () => {

  if (!socket.connected) {
    socket.connect();
  }

});



const $ = id => document.getElementById(id);

const myCoinEl = $("myCoin");
const agentList = $("agentList");
const sheetOverlay = $("sheetOverlay");
const qrSheet = $("qrSheet");
const sheetQr = $("sheetQr");
const qrUnavailable = $("qrUnavailable");
const sheetBankInfo = $("sheetBankInfo");
const btnTransferred = $("btnTransferred");
const transferStatus = $("transferStatus");

let currentAgent = null;
let agentsCache = [];

/* ===== SVG ICON ===== */

function tpIcon(name) {
  return `
    <svg class="icon" aria-hidden="true">
      <use href="#tp-${name}"></use>
    </svg>
  `;
}

/* ===== SỐ DƯ ===== */

/* =========================================
   DIAMOND BALANCE - ENGLISH FORMAT
========================================= */

function updateCoinBalance(coins) {

  const value = Number(coins);

  myCoinEl.textContent =
    (Number.isFinite(value) ? Math.max(0, value) : 0)
      .toLocaleString("en-US");

}

updateCoinBalance(auth.coins || 0);

/* ===== SOCKET LOGIN ===== */

socket.on("connect", () => {
  if (auth.uid) {
    socket.emit("socket-login", {
      uid: auth.uid
    });
  }
});

/* Cập nhật số dư khi server gửi dữ liệu mới */

socket.on("coin-update", data => {
  if (data && data.coins !== undefined) {
    updateCoinBalance(data.coins);
  }
});

/* ===== URL HÌNH ẢNH ===== */

function safeImageUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  if (/^data:image\/(png|jpeg|webp);base64,/i.test(value)) {
    return value;
  }

  try {
    const url = new URL(value, location.origin);

    if (url.protocol === "https:" || url.protocol === "http:") {
      return url.href;
    }
  } catch (e) {}

  return "";
}

/* ===== LOAD ĐẠI LÝ ===== */

async function loadAgents() {
  try {
    const response = await fetch("/api/topup-agents");

    if (!response.ok) {
      throw new Error("Failed to load the top-up agents.");
    }

    const data = await response.json();

    if (!data.ok) {
      throw new Error("Failed to load the top-up agents.");
    }

    agentsCache = Array.isArray(data.agents)
      ? data.agents
      : [];

    renderAgents(agentsCache);

  } catch (error) {
    console.error("Topup agents:", error);

agentList.innerHTML = `
  <div class="empty-agent">
    Unable to load the agent list.
    Please try again later.
  </div>
`;

    showToast(error.message, "error");
  }
}

/* ===== RENDER DANH SÁCH ===== */

function renderAgents(list) {
  agentList.replaceChildren();

if (!list.length) {

  agentList.innerHTML = `
    <div class="empty-agent">
      No top-up agents are currently available.
    </div>
  `;

  return;
}

  const fragment = document.createDocumentFragment();

  list.forEach(agent => {
    const card = document.createElement("button");

    card.type = "button";
    card.className = "agent-card";
    card.dataset.uid = String(agent.uid || "");

    card.innerHTML = `
      <div class="agent-avatar-placeholder">
        ${tpIcon("user")}
      </div>

      <div class="agent-info">
        <div class="agent-name"></div>
        <div class="agent-bank"></div>
        <div class="agent-status"></div>
      </div>

      <div class="agent-chevron">
        ${tpIcon("right")}
      </div>
    `;

   const name = String(agent.name || "Agent");

    card.querySelector(".agent-name").textContent = name;

card.querySelector(".agent-bank").textContent =
  [agent.bank, agent.account]
    .filter(Boolean)
    .join(" · ") || "Bank details unavailable";

    setAgentStatus(card, Boolean(agent.online));

    /* Avatar */
    const avatarSrc = safeImageUrl(agent.avatar);



/* ==========================================
   TOPUP - AGENT AVATAR LOADING FIX
========================================== */

if (avatarSrc) {

  const img = document.createElement("img");

  img.className = "agent-avatar";
  img.alt = "Profile picture of " + name;

  // Load immediately
  img.loading = "eager";
  img.decoding = "async";

  // Keep placeholder until image is ready
  const placeholder =
    card.querySelector(".agent-avatar-placeholder");

  img.style.display = "none";

  img.onload = () => {
    img.style.display = "";
    placeholder?.remove();
  };

  img.onerror = () => {
    img.remove();
  };

  img.src = avatarSrc;

  // Add to DOM so loading is not delayed
  placeholder?.after(img);

}


    card.onclick = () => openAgent(agent);

    fragment.appendChild(card);
  });

  agentList.appendChild(fragment);
}

/* ===== TRẠNG THÁI ONLINE ===== */

/* =========================================
   AGENT ONLINE STATUS
========================================= */

function setAgentStatus(card, online) {

  const status = card.querySelector(".agent-status");

  if (!status) return;

  status.textContent = online
    ? "Online"
    : "Offline";

  status.classList.toggle("offline", !online);

}

socket.on("agent-status", ({ uid, online }) => {
  const agent = agentsCache.find(
    a => String(a.uid) === String(uid)
  );

  if (agent) agent.online = Boolean(online);

  agentList.querySelectorAll(".agent-card").forEach(card => {
    if (card.dataset.uid === String(uid)) {
      setAgentStatus(card, Boolean(online));
    }
  });
});

/* ===== BẬT / TẮT PHƯƠNG THỨC ===== */

["agentOption", "cardOption"].forEach(id => {
  const option = $(id);
  if (!option) return;

  const header = option.querySelector(".option-header");
  const content = option.querySelector(".option-content");

  header.addEventListener("click", () => {
    const open = !option.classList.contains("open");

    option.classList.toggle("open", open);
    content.classList.toggle("hidden", !open);
    header.setAttribute("aria-expanded", String(open));
  });
});

/* ===== TẠO THÔNG TIN NGÂN HÀNG ===== */

function createBankRow(label, value, isCode = false) {
  const row = document.createElement("div");
  row.className = "bank-row";

  const title = document.createElement("span");
  title.className = "bank-label";
  title.textContent = label;

  const val = document.createElement(
    isCode ? "code" : "span"
  );

  val.className = "bank-value";
  val.textContent = String(value ?? "");

  if (isCode) {
    val.id = "transferText";
  }

  row.append(title, val);
  return row;
}

/* ===== MỞ QR ĐẠI LÝ ===== */

function openAgent(agent) {
  currentAgent = agent;

  const content = `NAP ${auth.uid}`;

  /* Mã QR thật từ đại lý */
  const qr = safeImageUrl(agent.qr);

  sheetQr.onload = () => {
    sheetQr.hidden = false;
    qrUnavailable.hidden = true;
  };

  sheetQr.onerror = () => {
    sheetQr.hidden = true;
    qrUnavailable.hidden = false;
  };

  sheetQr.hidden = true;
  qrUnavailable.hidden = !qr;

  if (qr) {
    sheetQr.src = qr;
  } else {
    sheetQr.removeAttribute("src");
  }

  /* Thông tin nhận tiền */
/* =========================================
   BANK TRANSFER DETAILS
========================================= */

sheetBankInfo.replaceChildren(

  createBankRow(
    "Agent",
    agent.name || "—"
  ),

  createBankRow(
    "Bank",
    agent.bank || "—"
  ),

  createBankRow(
    "Account",
    agent.account || "—"
  ),

  createBankRow(
    "Holder",
    agent.owner || "—"
  ),

  createBankRow(
    "Reference",
    content,
    true
  )

);

  /* Reset trạng thái xác nhận */
  const hasBankInfo = Boolean(
    agent.bank && agent.account
  );

  btnTransferred.disabled = !hasBankInfo;

btnTransferred.innerHTML =
  tpIcon("check") +
  "<span>I've Transferred</span>";

  transferStatus.classList.add("hidden");

  /* Mở sheet */
  sheetOverlay.classList.remove("hidden");
  qrSheet.classList.add("show");

  document.body.classList.add("sheet-open");
}

/* ===== ĐÓNG QR SHEET ===== */

function closeTopupSheet() {
  qrSheet.classList.remove("show");
  sheetOverlay.classList.add("hidden");

  document.body.classList.remove("sheet-open");
}

sheetOverlay.addEventListener("click", closeTopupSheet);

document.addEventListener("keydown", e => {
  if (e.key === "Escape" && qrSheet.classList.contains("show")) {
    closeTopupSheet();
  }
});

/* ===== COPY NỘI DUNG CHUYỂN KHOẢN ===== */

async function copyTransfer() {
  const text = $("transferText")?.textContent;

  if (!text) return;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const input = document.createElement("textarea");

      input.value = text;
      input.style.position = "fixed";
      input.style.opacity = "0";

      document.body.appendChild(input);
      input.select();

      const copied = document.execCommand("copy");
      input.remove();

      if (!copied) throw new Error("Copy failed");
    }

    showToast(
  "Transfer reference copied successfully.",
  "success"
);

  } catch (error) {
   showToast(
  "Unable to copy. Please try again.",
  "error"
);
  }
}

/* ===== XÁC NHẬN ĐÃ CHUYỂN KHOẢN ===== */

btnTransferred.addEventListener("click", () => {
  if (!currentAgent) {
    showToast(
  "Please select a top-up agent first.",
  "error"
);
    return;
  }

  if (!currentAgent.bank || !currentAgent.account) {
    showToast(
  "The agent's bank details are incomplete.",
  "error"
);
    return;
  }

  if (!socket.connected) {
  showToast(
  "Connection lost. Please try again.",
  "error"
);
    return;
  }

  socket.emit("topup-transferred", {
    fromUid: auth.uid,
    agentUid: currentAgent.uid,
    time: Date.now()
  });

  btnTransferred.disabled = true;

btnTransferred.innerHTML =
  tpIcon("clock") +
  "<span>Pending Confirmation</span>";

  transferStatus.classList.remove("hidden");

showToast(
  "Your transfer notification has been sent to the agent.",
  "success"
);
});

/* ===== NÚT QUAY LẠI ===== */

function goTopupBack() {
  if (history.length > 1) {
    history.back();
  } else {
    location.href = "/profile.html";
  }
}

/* ===== TOAST ===== */

function showToast(message, type = "info", duration = 3000) {
  const toast = document.createElement("div");

  toast.className = "toast toast-" +
    (["info", "success", "error"].includes(type)
      ? type
      : "info");

  toast.textContent = String(message || "Notification");

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

/* ===== ĐĂNG XUẤT BẮT BUỘC ===== */

function showForceLogoutModal(message) {
  let modal = $("forceLogoutModal");

  if (!modal) {
    modal = document.createElement("div");
    modal.id = "forceLogoutModal";

modal.innerHTML = `
  <div class="fl-backdrop"></div>

  <div class="fl-box">

    <div class="fl-icon">
      <svg class="icon"
           style="width:36px;height:36px">
        <use href="#tp-ban"></use>
      </svg>
    </div>

    <div class="fl-title">
      Session Ended
    </div>

    <div class="fl-msg"></div>

    <div class="fl-sub">
      You will be redirected to the login page...
    </div>

  </div>
`;

    document.body.appendChild(modal);
  }

modal.querySelector(".fl-msg").textContent =
  String(message || "Your login session has ended.");

  modal.classList.add("show");
}

/* =========================================
   FORCE LOGOUT - ENGLISH NOTIFICATION
========================================= */

socket.on("force-logout", data => {

  const message =
    data?.message ||
    "You have been signed out.";

  showForceLogoutModal(message);

  localStorage.removeItem("user_profile");
  localStorage.removeItem("login_uid");
  localStorage.removeItem("isGuest");

  setTimeout(() => {
    location.href = "/login.html";
  }, 3000);

});

/* ===== KHỞI TẠO ===== */

loadAgents();




/* =========================================
   CARD TOP-UP - LIVESTREAM PRO
========================================= */

let cardPackages = [];
let selectedCardPackage = null;
let cardPaymentPending = false;
let cardPaymentEnabled = false;

const cardPackageList =
  document.getElementById("cardPackageList");

const cardPayBtn =
  document.getElementById("cardPayBtn");

const cardSelectedDiamonds =
  document.getElementById("cardSelectedDiamonds");

const cardSelectedAmount =
  document.getElementById("cardSelectedAmount");

const cardPaymentStatus =
  document.getElementById("cardPaymentStatus");

const formatCardNumber = value =>
  Number(value).toLocaleString("en-US");

const formatCardVnd = value =>
  Number(value).toLocaleString("en-US") + " VND";

function showCardStatus(message) {
  cardPaymentStatus.textContent = message;
  cardPaymentStatus.classList.remove("hidden");
}

function renderCardPackages() {
  cardPackageList.replaceChildren();

  for (const pkg of cardPackages) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "card-package";

    if (selectedCardPackage?.id === pkg.id) {
      button.classList.add("selected");
    }

    const icon = document.createElement("span");
    icon.className = "card-package-icon";
    icon.textContent = "💎";

    const diamonds = document.createElement("strong");
    diamonds.className = "card-package-diamonds";
    diamonds.textContent = formatCardNumber(pkg.diamonds);

    const price = document.createElement("span");
    price.className = "card-package-price";
    price.textContent = formatCardVnd(pkg.amountVnd);

    button.append(icon, diamonds, price);


button.addEventListener("click", () => {

  selectedCardPackage = pkg;

  renderCardPackages();

  cardSelectedDiamonds.textContent =
    formatCardNumber(pkg.diamonds) + " Diamonds";

  cardSelectedAmount.textContent =
    formatCardVnd(pkg.amountVnd);

  // Enable payment only when the gateway is ready.
  cardPayBtn.disabled = !cardPaymentEnabled;

  if (cardPaymentEnabled) {

    cardPaymentStatus.classList.add("hidden");

  } else {

    showCardStatus(
      "Card payment is not available yet. " +
      "Please try again later."
    );

  }

});


    cardPackageList.appendChild(button);
  }
}



async function loadCardPackages() {
  try {
    const response = await fetch(
      "/api/card-topup/packages",
      { credentials: "same-origin", cache: "no-store" }
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        data.message || "Unable to load packages."
      );
    }

 cardPackages = Array.isArray(data.packages)
  ? data.packages
  : [];

cardPaymentEnabled = data.enabled === true;

renderCardPackages();

cardPayBtn.disabled =
  !cardPaymentEnabled || !selectedCardPackage;

if (!cardPaymentEnabled) {

  showCardStatus(
    "Card payments are temporarily unavailable."
  );
}

  } catch (error) {
    cardPackageList.textContent = error.message;
    cardPayBtn.disabled = true;
  }
}



/* ==========================================
   LIVESTREAM PRO - SEPAY CHECKOUT
========================================== */

let checkoutSelectedMethod = "CARD";
let checkoutBusy = false;


const CHECKOUT_METHODS = [
  {
    id: "CARD",
    name: "Visa / Mastercard / JCB",
    description: "Secure international card payment"
  }
];


function closeCardCheckout() {
  document.getElementById("lspCardCheckout")?.remove();
  document.body.classList.remove("checkout-open");
}

function openCardCheckout() {

  if (!selectedCardPackage) {
    showToast("Please select a diamond package.", "error");
    return;
  }

  closeCardCheckout();

  const checkout = document.createElement("div");

  checkout.id = "lspCardCheckout";
  checkout.className = "lsp-checkout show";

  checkout.innerHTML = `
    <section class="lsp-checkout-page"
             role="dialog"
             aria-modal="true">

      <header class="lsp-checkout-header">

        <button
          id="lspCheckoutBack"
          class="lsp-checkout-back"
          type="button"
          aria-label="Back">
          &#8592;
        </button>

        <div class="lsp-checkout-brand">
          <small>LIVESTREAM PRO</small>
          <h2>Checkout</h2>
        </div>

        <span class="lsp-checkout-lock">
          &#128274;
        </span>

      </header>

      <main class="lsp-checkout-body">

        <div class="lsp-order-card">

          <div class="lsp-order-heading">
            <span>Order</span>
            <small>DIAMOND TOP-UP</small>
          </div>

          <div class="lsp-order-product">

            <span class="lsp-order-diamond">
              &#128142;
            </span>

            <div class="lsp-order-name">
              <strong id="lspCheckoutDiamonds"></strong>
              <small>Livestream Pro Wallet</small>
            </div>

          </div>

          <div class="lsp-order-divider"></div>

          <div class="lsp-order-total">
            <span>Total</span>
            <strong id="lspCheckoutTotal"></strong>
          </div>

        </div>

        <h3 class="lsp-method-heading">
          Payment Method
        </h3>

        <div id="lspCheckoutMethods"
             class="lsp-checkout-methods">
        </div>

        <div class="lsp-checkout-security">
          <span>&#128274;</span>
          <div>
            <strong>Secure payment via SePay</strong>
            <small>
              Complete payment on the SePay checkout page.
              Diamonds will be credited after confirmation.
            </small>
          </div>
        </div>

      </main>

      <footer class="lsp-checkout-footer">

        <div class="lsp-checkout-footer-total">
          <span>Total</span>
          <strong id="lspCheckoutFooterTotal"></strong>
        </div>

        <button
          id="lspCheckoutConfirm"
          type="button">
          Pay Now
        </button>

      </footer>

    </section>
  `;

  document.body.appendChild(checkout);
  document.body.classList.add("checkout-open");

  const pkg = selectedCardPackage;

  checkout.querySelector("#lspCheckoutDiamonds")
    .textContent =
      formatCardNumber(pkg.diamonds) + " Diamonds";

  const price = formatCardVnd(pkg.amountVnd);

  checkout.querySelector("#lspCheckoutTotal")
    .textContent = price;

  checkout.querySelector("#lspCheckoutFooterTotal")
    .textContent = price;

  checkout.querySelector("#lspCheckoutBack")
    .addEventListener("click", closeCardCheckout);

  checkout.querySelector("#lspCheckoutConfirm")
    .addEventListener("click", () => {
      startCardPayment();
    });

  checkout.addEventListener("keydown", e => {
    if (e.key === "Escape" && !checkoutBusy) {
      closeCardCheckout();
    }
  });

  renderCheckoutMethods(checkout);
}

function renderCheckoutMethods(checkout) {

  const container = checkout.querySelector(
    "#lspCheckoutMethods"
  );

  container.replaceChildren();

  CHECKOUT_METHODS.forEach(method => {

    const button = document.createElement("button");

    button.type = "button";
    button.className = "lsp-payment-method";

    if (method.id === checkoutSelectedMethod) {
      button.classList.add("selected");
    }

    const info = document.createElement("span");
    info.className = "lsp-method-info";

    const title = document.createElement("strong");
    title.textContent = method.name;

    const description = document.createElement("small");
    description.textContent = method.description;

    info.append(title, description);
    button.append(info);

    button.addEventListener("click", () => {

      checkoutSelectedMethod = method.id;
      renderCheckoutMethods(checkout);

    });

    container.appendChild(button);
  });
}

/* ==========================================
   CREATE PAYMENT ORDER
========================================== */

async function startCardPayment() {

  if (checkoutBusy || !selectedCardPackage) return;

  const button = document.getElementById(
    "lspCheckoutConfirm"
  );

  checkoutBusy = true;

  if (button) {
    button.disabled = true;
    button.textContent = "Connecting...";
  }

  try {

    const response = await fetch(
      "/api/card-topup/create",
      {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          packageId: selectedCardPackage.id,
          paymentMethod: checkoutSelectedMethod
        })
      }
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        data.message || "Payment service unavailable."
      );
    }

    // Allow only official SePay checkout destinations.
const allowed = [
  "https://pay.sepay.vn/v1/init",
  "https://sandbox.pay.sepay.vn/v1/init"
];

    if (!allowed.includes(data.checkoutUrl)) {
      throw new Error("Invalid payment destination.");
    }

    // Submit the signed payment form to SePay.
    const form = document.createElement("form");

    form.method = "POST";
    form.action = data.checkoutUrl;
    form.style.display = "none";

    for (const [name, value] of Object.entries(
      data.fields || {}
    )) {

      const input = document.createElement("input");

      input.type = "hidden";
      input.name = name;
      input.value = String(value);

      form.appendChild(input);
    }

    document.body.appendChild(form);
    form.submit();

  } catch (error) {

    showToast(
      error.message || "Unable to start payment.",
      "error",
      5000
    );

    checkoutBusy = false;

    if (button) {
      button.disabled = false;
      button.textContent = "Pay Now";
    }
  }
}

/* ==========================================
   CHECK PAYMENT RETURN
========================================== */

async function checkPaymentReturn() {

  const params = new URLSearchParams(location.search);

  const invoice = params.get("invoice");
  const result = params.get("payment");

  if (!/^LSP[A-F0-9]{20}$/.test(invoice || "")) {
    return;
  }

  history.replaceState(null, "", location.pathname);

  if (result !== "success") {

    showToast(
      result === "cancel"
        ? "Payment cancelled."
        : "Payment was not completed.",
      "error"
    );

    return;
  }

  try {

    const response = await fetch(
      "/api/card-topup/status/" + invoice,
      {
        credentials: "same-origin",
        cache: "no-store"
      }
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error("Unable to verify payment.");
    }

    if (data.status === "paid") {

      showToast(
        "Payment confirmed! " +
        formatCardNumber(data.diamonds) +
        " diamonds added.",
        "success",
        6000
      );

    } else {

      showToast(
        "Payment verification is pending.",
        "info",
        6000
      );

    }

  } catch (error) {
    showToast(error.message, "error");
  }
}

/* ==========================================
   INITIALIZATION
========================================== */

cardPayBtn.addEventListener("click", openCardCheckout);




loadCardPackages();
checkPaymentReturn();
