
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

    if (avatarSrc) {
      const img = new Image();

      img.className = "agent-avatar";
      img.alt = "Profile picture of " + name;
      img.loading = "lazy";

      img.onload = () => {
        card.querySelector(".agent-avatar-placeholder")
          ?.replaceWith(img);
      };

      img.src = avatarSrc;
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
    "Account Number",
    agent.account || "—"
  ),

  createBankRow(
    "Account Holder",
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
  "<span>I HAVE COMPLETED THE TRANSFER</span>";

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
  "<span>NOTIFICATION SENT</span>";

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

      cardPayBtn.disabled = false;
      cardPaymentStatus.classList.add("hidden");
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

    cardPackages = data.packages;
    renderCardPackages();

  } catch (error) {
    cardPackageList.textContent = error.message;
    cardPayBtn.disabled = true;
  }
}



/* ==========================================
   CARD TOP-UP - MAINTENANCE MODE
========================================== */

function showCardMaintenance() {

  let modal = document.getElementById(
    "cardMaintenanceModal"
  );

  if (!modal) {

    modal = document.createElement("div");

    modal.id = "cardMaintenanceModal";

    modal.className = "card-maintenance-modal";

    modal.innerHTML = `
      <div class="card-maintenance-box"
           role="dialog"
           aria-modal="true"
           aria-labelledby="cardMaintenanceTitle">

        <div class="card-maintenance-symbol">
          <svg viewBox="0 0 24 24"
               width="38"
               height="38"
               fill="none"
               stroke="currentColor"
               stroke-width="1.6"
               stroke-linecap="round"
               stroke-linejoin="round">
            <path d="M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5L15 12l-3-3z"/>
            <path d="M18 3v3M16.5 4.5h3"/>
          </svg>
        </div>

        <div class="card-maintenance-tag">
          TEMPORARILY UNAVAILABLE
        </div>

        <h2 id="cardMaintenanceTitle">
          SYSTEM MAINTENANCE
        </h2>

        <p>
          Card payment is currently undergoing
          maintenance and upgrades.
        </p>

        <p>
          Please use another available top-up method.
          Thank you for your patience.
        </p>

        <button
          type="button"
          id="cardMaintenanceClose">
          UNDERSTOOD
        </button>

      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector(
      "#cardMaintenanceClose"
    ).addEventListener("click", () => {
      modal.classList.remove("show");
    });

    modal.addEventListener("click", e => {
      if (e.target === modal) {
        modal.classList.remove("show");
      }
    });

    document.addEventListener("keydown", e => {
      if (
        e.key === "Escape" &&
        modal.classList.contains("show")
      ) {
        modal.classList.remove("show");
      }
    });

  }

  modal.classList.add("show");

  modal.querySelector(
    "#cardMaintenanceClose"
  ).focus();
}


/* ==========================================
   LIVESTREAM PRO - PAYMENT CHECKOUT PREVIEW
========================================== */

let checkoutLastFocus = null;
let checkoutSelectedMethod = "atm";

const CHECKOUT_METHODS = [
  {
    id: "atm",
    title: "Domestic ATM Card",
    subtitle: "Vietnamese bank cards",
    icon: "🏦"
  },
  {
    id: "visa",
    title: "Visa",
    subtitle: "International payment card",
    icon: "💳"
  },
  {
    id: "mastercard",
    title: "Mastercard",
    subtitle: "International payment card",
    icon: "💳"
  }
];

function closeCardCheckout() {

  const checkout = document.getElementById(
    "lspCardCheckout"
  );

  if (!checkout) return;

  checkout.classList.remove("show");
  document.body.classList.remove("checkout-open");

  checkoutLastFocus?.focus?.();
}

function openCardCheckout() {

  if (!selectedCardPackage) {
    showToast(
      "Please select a diamond package.",
      "error"
    );
    return;
  }

  checkoutLastFocus = document.activeElement;
  checkoutSelectedMethod = "atm";

  let checkout = document.getElementById(
    "lspCardCheckout"
  );

  if (!checkout) {

    checkout = document.createElement("div");
    checkout.id = "lspCardCheckout";
    checkout.className = "lsp-checkout";

    checkout.innerHTML = `
      <section class="lsp-checkout-page"
               role="dialog"
               aria-modal="true"
               aria-labelledby="lspCheckoutTitle">

        <header class="lsp-checkout-header">

          <button id="lspCheckoutBack"
                  type="button"
                  class="lsp-checkout-back"
                  aria-label="Back to top-up">
            &#8592;
          </button>

          <div class="lsp-checkout-brand">
            <small>LIVESTREAM PRO</small>
            <h2 id="lspCheckoutTitle">
              Secure Checkout
            </h2>
          </div>

          <span class="lsp-checkout-lock">
            &#128274;
          </span>

        </header>

        <main class="lsp-checkout-body">

       <div class="lsp-preview-label">
  CARD PAYMENT TEMPORARILY UNAVAILABLE
</div>

          <div class="lsp-order-card">

            <div class="lsp-order-heading">
              <span>Order Summary</span>
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
              <span>Total Payment</span>
              <strong id="lspCheckoutTotal"></strong>
            </div>

          </div>

          <h3 class="lsp-method-heading">
            SELECT PAYMENT METHOD
          </h3>

          <div id="lspCheckoutMethods"
               class="lsp-checkout-methods"
               role="radiogroup"
               aria-label="Payment method">
          </div>

          
<div class="lsp-checkout-security">
  <span>&#128274;</span>
  <div>
    <strong>Payment Service Notice</strong>
    <small>
      Card payments are currently undergoing
      maintenance. No payment will be processed.
    </small>
  </div>
</div>


        </main>

        <footer class="lsp-checkout-footer">
          <div class="lsp-checkout-footer-total">
            <span>Amount to pay</span>
            <strong id="lspCheckoutFooterTotal"></strong>
          </div>

          <button id="lspCheckoutConfirm"
                  type="button">
            CONFIRM PAYMENT
          </button>
        </footer>

      </section>
    `;

    document.body.appendChild(checkout);

    checkout.querySelector(
      "#lspCheckoutBack"
    ).addEventListener(
      "click",
      closeCardCheckout
    );

    checkout.addEventListener("click", event => {
      if (event.target === checkout) {
        closeCardCheckout();
      }
    });


checkout.querySelector(
  "#lspCheckoutConfirm"
).addEventListener("click", () => {

  closeCardCheckout();
  openDemoCardDetails();

});


    checkout.addEventListener("keydown", event => {

      if (event.key === "Escape") {
        closeCardCheckout();
        return;
      }

      if (event.key !== "Tab") return;

      const controls = [
        ...checkout.querySelectorAll(
          "button:not(:disabled)"
        )
      ];

      const first = controls[0];
      const last = controls[controls.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault();
        first.focus();
      }

    });

  }

  const pkg = selectedCardPackage;

  checkout.querySelector(
    "#lspCheckoutDiamonds"
  ).textContent =
    formatCardNumber(pkg.diamonds) + " Diamonds";

  checkout.querySelector(
    "#lspCheckoutTotal"
  ).textContent = formatCardVnd(pkg.amountVnd);

  checkout.querySelector(
    "#lspCheckoutFooterTotal"
  ).textContent = formatCardVnd(pkg.amountVnd);

  renderCheckoutMethods(checkout);

  checkout.classList.add("show");
  document.body.classList.add("checkout-open");

  checkout.querySelector(
    "#lspCheckoutBack"
  ).focus();

}

/* ==========================================
   PAYMENT METHOD SELECTION
========================================== */

function renderCheckoutMethods(checkout) {

  const container = checkout.querySelector(
    "#lspCheckoutMethods"
  );

  container.replaceChildren();

  CHECKOUT_METHODS.forEach(method => {

    const selected =
      method.id === checkoutSelectedMethod;

    const button = document.createElement("button");

    button.type = "button";
    button.className = "lsp-payment-method";
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", String(selected));

    if (selected) {
      button.classList.add("selected");
    }

    const icon = document.createElement("span");
    icon.className = "lsp-method-icon";
    icon.textContent = method.icon;

    const info = document.createElement("span");
    info.className = "lsp-method-info";

    const title = document.createElement("strong");
    title.textContent = method.title;

    const subtitle = document.createElement("small");
    subtitle.textContent = method.subtitle;

    info.append(title, subtitle);

    const check = document.createElement("span");
    check.className = "lsp-method-check";
    check.textContent = selected ? "●" : "○";

    button.append(icon, info, check);

    button.addEventListener("click", () => {

      checkoutSelectedMethod = method.id;

      renderCheckoutMethods(checkout);

      const buttons = [
        ...container.querySelectorAll(
          ".lsp-payment-method"
        )
      ];

      const index = CHECKOUT_METHODS.findIndex(
        m => m.id === method.id
      );

      buttons[index]?.focus();

    });

    button.addEventListener("keydown", event => {

      if (
        event.key !== "ArrowDown" &&
        event.key !== "ArrowUp" &&
        event.key !== "ArrowRight" &&
        event.key !== "ArrowLeft"
      ) return;

      event.preventDefault();

      const index = CHECKOUT_METHODS.findIndex(
        m => m.id === checkoutSelectedMethod
      );

      const direction =
        event.key === "ArrowDown" ||
        event.key === "ArrowRight" ? 1 : -1;

      const next = (
        index + direction + CHECKOUT_METHODS.length
      ) % CHECKOUT_METHODS.length;

      checkoutSelectedMethod = CHECKOUT_METHODS[next].id;
      renderCheckoutMethods(checkout);

      container.querySelectorAll(
        ".lsp-payment-method"
      )[next]?.focus();

    });

    container.appendChild(button);

  });

}

/* ==========================================
   MAIN PAY BUTTON
========================================== */

cardPayBtn.addEventListener("click", () => {
  openCardCheckout();
});

/* ==========================================
   INITIALIZE PACKAGES
========================================== */

loadCardPackages();



/* ==========================================
   LIVESTREAM PRO - CARD DETAILS PREVIEW V3
========================================== */

function closeDemoCardDetails() {

  document.getElementById(
    "lspDemoCardScreen"
  )?.remove();

  document.body.classList.remove("checkout-open");

}

function openDemoCardDetails() {

  document.getElementById(
    "lspDemoCardScreen"
  )?.remove();

  const screen = document.createElement("div");

  screen.id = "lspDemoCardScreen";
  screen.className = "lsp-demo-card-screen";

  const amount = selectedCardPackage
    ? formatCardVnd(selectedCardPackage.amountVnd)
    : "—";

  const currentYear = new Date().getFullYear();

  const monthOptions = Array.from(
    { length: 12 },
    (_, i) => String(i + 1).padStart(2, "0")
  ).map(month =>
    `<option value="${month}">${month}</option>`
  ).join("");

  const yearOptions = Array.from(
    { length: 11 },
    (_, i) => String(currentYear + i)
  ).map(year =>
    `<option value="${year.slice(-2)}">${year}</option>`
  ).join("");

  screen.innerHTML = `
    <section
      class="lsp-demo-card-page"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lspDemoCardTitle">

      <header class="lsp-demo-card-header">

        <button
          id="lspDemoCardBack"
          type="button"
          aria-label="Back to checkout">
          &#8592;
        </button>

        <div>
          <small>LIVESTREAM PRO</small>

          <h2 id="lspDemoCardTitle">
            Card Details
          </h2>
        </div>

      </header>

      <main class="lsp-demo-card-body">

  <div class="lsp-demo-warning">
  CARD PAYMENT UNDER MAINTENANCE
  · DO NOT ENTER SENSITIVE CARD DETAILS
</div>


        <!-- CARD PREVIEW -->

        <div class="lsp-demo-bank-card">

          <div class="lsp-demo-card-brand">
            <strong>LIVESTREAM PRO</strong>
            <span>&#128179;</span>
          </div>

          <div
            class="lsp-demo-card-number"
            id="lspPreviewNumber">
            •••• •••• •••• ••••
          </div>

          <div class="lsp-demo-card-bottom">

            <div>
              <small>CARD HOLDER</small>

              <strong id="lspPreviewName">
                YOUR NAME
              </strong>
            </div>

            <div>
              <small>EXPIRES</small>

              <strong id="lspPreviewExpiry">
                MM/YY
              </strong>
            </div>

          </div>

        </div>

        <!-- EDITABLE INFORMATION -->

        <div class="lsp-demo-fields">



<label for="lspCardLastFour">
  Card Number
</label>

<input
  id="lspCardLastFour"
  class="lsp-demo-field lsp-demo-input"
  type="text"
  inputmode="numeric"
  maxlength="4"
  autocomplete="off"
  placeholder="•••• •••• •••• 1234"
  aria-describedby="lspCardNumberHelp">

<small id="lspCardNumberHelp"
       class="lsp-card-number-help">
  Enter the last 4 digits only.
  Full card details are not required.
</small>


          <label for="lspCardHolderName">
            Cardholder Name
          </label>

          <input
            id="lspCardHolderName"
            class="lsp-demo-field lsp-demo-input"
            type="text"
            maxlength="60"
            autocomplete="off"
            placeholder="Enter cardholder name">

          <div class="lsp-demo-field-grid">

            <div>
              <label for="lspCardExpiryMonth">
                Expiry Month
              </label>

              <select
                id="lspCardExpiryMonth"
                class="lsp-demo-field lsp-demo-input">

                <option value="">MM</option>

                ${monthOptions}

              </select>
            </div>

            <div>
              <label for="lspCardExpiryYear">
                Expiry Year
              </label>

              <select
                id="lspCardExpiryYear"
                class="lsp-demo-field lsp-demo-input">

                <option value="">YY</option>

                ${yearOptions}

              </select>
            </div>

          </div>

          <label>CVV</label>

          <div class="lsp-demo-field">
            •••
            <span class="lsp-demo-nocollect">
              Not requested
            </span>
          </div>

        </div>

<p class="lsp-demo-description">
  Card payment services are temporarily unavailable
  while our system is being upgraded.
  Do not enter your full card number, CVV or OTP.
  Please use another available payment method.
</p>
      </main>

      <footer class="lsp-demo-card-footer">

        <div class="lsp-demo-amount">
          <span>Payment Amount</span>

          <strong id="lspDemoPaymentAmount">
          </strong>
        </div>

<button
  id="lspDemoCardConfirm"
  type="button">
  CONTINUE
</button>

      </footer>

    </section>
  `;

  document.body.appendChild(screen);

  document.body.classList.add("checkout-open");

  // Show selected payment amount.
  screen.querySelector(
    "#lspDemoPaymentAmount"
  ).textContent = amount;

  /* ======================================
     LIVE CARD NUMBER PREVIEW
  ====================================== */

  const cardLastFour = screen.querySelector(
    "#lspCardLastFour"
  );

  const previewNumber = screen.querySelector(
    "#lspPreviewNumber"
  );


/* ==========================================
   CARD NUMBER - MASKED PREVIEW
========================================== */

cardLastFour.addEventListener("input", () => {

  const last4 = cardLastFour.value
    .replace(/\D/g, "")
    .slice(0, 4);

  cardLastFour.value = last4;

  const displayedLast4 =
    last4.padEnd(4, "•");

  previewNumber.textContent =
    "•••• •••• •••• " + displayedLast4;

});


  /* ======================================
     LIVE CARDHOLDER NAME PREVIEW
  ====================================== */

  const cardHolderName = screen.querySelector(
    "#lspCardHolderName"
  );

  const previewName = screen.querySelector(
    "#lspPreviewName"
  );

  cardHolderName.addEventListener("input", () => {

    previewName.textContent =
      cardHolderName.value.trim().toUpperCase()
      || "YOUR NAME";

  });

  /* ======================================
     LIVE EXPIRY PREVIEW
  ====================================== */

  const expiryMonth = screen.querySelector(
    "#lspCardExpiryMonth"
  );

  const expiryYear = screen.querySelector(
    "#lspCardExpiryYear"
  );

  const previewExpiry = screen.querySelector(
    "#lspPreviewExpiry"
  );

  function updateExpiryPreview() {

    previewExpiry.textContent =
      (expiryMonth.value || "MM") +
      "/" +
      (expiryYear.value || "YY");

  }

  expiryMonth.addEventListener(
    "change",
    updateExpiryPreview
  );

  expiryYear.addEventListener(
    "change",
    updateExpiryPreview
  );

  /* ======================================
     BACK TO CHECKOUT
  ====================================== */

  screen.querySelector(
    "#lspDemoCardBack"
  ).addEventListener("click", () => {

    closeDemoCardDetails();

    openCardCheckout();

  });

  /* ======================================
     FINAL CONFIRMATION
  ====================================== */

  screen.querySelector(
    "#lspDemoCardConfirm"
  ).addEventListener("click", () => {

    // No card processing.
    // No API requests.
    // No transaction is created.

    closeDemoCardDetails();

    showCardMaintenance();

  });

  /* ======================================
     ESCAPE KEY
  ====================================== */

  screen.addEventListener("keydown", event => {

    if (event.key === "Escape") {

      closeDemoCardDetails();

      openCardCheckout();

    }

  });

  cardHolderName.focus();

}
