
/* ======================================
   LIVESTREAM PRO - PREMIUM SVG ICONS
   Không phụ thuộc thư viện bên ngoài
   ====================================== */

const WD_ICONS = {
  back: '<path d="m15 18-6-6 6-6"/>',

  gem: `
    <path d="M6 3h12l4 6-10 12L2 9l4-6Z"/>
    <path d="M2 9h20M12 21 8 9l2-6m2 18 4-12-2-6"/>
  `,

  crown: `
    <path d="m2 8 5 4 5-8 5 8 5-4-2 11H4L2 8Z"/>
    <path d="M4 22h16"/>
  `,

  wallet: `
    <rect x="3" y="5" width="18" height="15" rx="2"/>
    <path d="M3 9h18"/>
    <path d="M16 14h2"/>
  `,

  bank: `
    <path d="m3 10 9-7 9 7"/>
    <path d="M4 10h16M5 10v9m5-9v9m4-9v9m5-9v9M3 21h18"/>
  `,

  shield: `
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>
    <path d="m9 12 2 2 4-4"/>
  `,

  lock: `
    <rect x="5" y="10" width="14" height="11" rx="2"/>
    <path d="M8 10V7a4 4 0 0 1 8 0v3"/>
    <path d="M12 15v2"/>
  `,

  send: `
    <path d="M7 17 17 7M7 7h10v10"/>
    <path d="M20 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6"/>
  `,

  history: `
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8"/>
    <path d="M3 3v5h5"/>
    <path d="M12 7v5l3 2"/>
  `,

  clock: `
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 7v5l3 2"/>
  `,

  check: `
    <circle cx="12" cy="12" r="9"/>
    <path d="m8 12 3 3 5-6"/>
  `,

  error: `
    <circle cx="12" cy="12" r="9"/>
    <path d="m9 9 6 6m0-6-6 6"/>
  `,

  warning: `
    <path d="m10.3 3.7-8 14A2 2 0 0 0 4 20h16a2 2 0 0 0 1.7-2.3l-8-14a2 2 0 0 0-3.4 0Z"/>
    <path d="M12 9v4m0 4h.01"/>
  `,

  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',

  sparkle: `
    <path d="m12 2 1.8 8.2L22 12l-8.2 1.8L12 22l-1.8-8.2L2 12l8.2-1.8L12 2Z"/>
  `
};

/* Tạo icon SVG từ danh sách cố định */

function wdIcon(name, size = "") {
  const paths = WD_ICONS[name] || WD_ICONS.wallet;

  const allowedSizes = ["sm", "lg", "xl"];
  const sizeClass = allowedSizes.includes(size) ? size : "";

  return `
    <span class="wd-icon ${sizeClass}" aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg"
           viewBox="0 0 24 24"
           fill="none"
           stroke="currentColor"
           stroke-width="1.7"
           stroke-linecap="round"
           stroke-linejoin="round">
        ${paths}
      </svg>
    </span>
  `;
}

/* Đổ SVG vào các vị trí chỉ định trong HTML */

function wdRenderIcons(root = document) {
  root.querySelectorAll("[data-wd-icon]").forEach(el => {
    const name = el.dataset.wdIcon;
    const size = el.dataset.wdSize || "";

    el.innerHTML = wdIcon(name, size);
    el.removeAttribute("data-wd-icon");
  });
}

wdRenderIcons();



let socket = null;
let withdrawRequestId = null;
let withdrawSubmitting = false;
let withdrawRequestPayload = null;

const params = new URLSearchParams(location.search);
let received = Math.max(
  0,
  Math.floor(Number(params.get("received") || 0))
);

// 🔁 TỶ GIÁ (bạn chỉnh tùy ý)
const RATE = 0.00773; // 1 kim cương = 0.00773 / giá đô $
// ⛔ RÚT TỐI THIỂU
const MIN_WITHDRAW = 3000; // 💎 tối thiểu để được rút


const receivedVal = document.getElementById("receivedVal");
const moneyVal = document.getElementById("moneyVal");
const withdrawInput = document.getElementById("withdrawInput");
const btnSubmit = document.getElementById("btnSubmitWithdraw");


const BANK_LOGOS = {
  "Vietcombank": "/img/banks/vietcombank.png",
  "Techcombank": "/img/banks/techcombank.png",
  "BIDV": "/img/banks/bidv.png",
  "VietinBank": "/img/banks/vietinbank.png",
  "MB Bank": "/img/banks/mbbank.png",
  "ACB": "/img/banks/acb.png"
};

const WITHDRAW_PAGE_SIZE = 5;
let withdrawPage = 1;
let withdrawCache = [];


receivedVal.textContent = received.toLocaleString();

document.getElementById("minWithdrawVal").textContent =
  MIN_WITHDRAW.toLocaleString();



withdrawInput.max = received;
withdrawInput.value = received;


function updateBankLogo(bankName){
  const img = document.getElementById("bankLogo");
  if (!img) return;

  const src = BANK_LOGOS[bankName];
  if (src) {
    img.src = src;
    img.classList.remove("hidden");
  } else {
    img.classList.add("hidden");
  }
}




/* ==========================================
   WITHDRAW AMOUNT - ENGLISH INTERFACE
========================================== */

function updateMoney() {

  if (withdrawSubmitting) {

  btnSubmit.disabled = true;

  btnSubmit.innerHTML =
    wdIcon("clock") +
    "<span>PROCESSING...</span>";

  return;

}

  const val = Math.min(
    received,
    Number(withdrawInput.value || 0)
  );

  // Keep the original exchange rate
  moneyVal.textContent =
    (val * RATE).toLocaleString("en-US") + " $";

  // PENDING WITHDRAWAL
  if (withdrawInput.disabled) {

    btnSubmit.disabled = true;

    btnSubmit.innerHTML =
      wdIcon("clock") +
      "<span>PENDING APPROVAL</span>";

    return;
  }

  // BELOW MINIMUM
  if (val < MIN_WITHDRAW) {

    btnSubmit.disabled = true;

    btnSubmit.innerHTML =
      wdIcon("warning") +
      `<span>MINIMUM ${MIN_WITHDRAW.toLocaleString("en-US")} DIAMONDS</span>`;

  } else {

    btnSubmit.disabled = false;

    btnSubmit.innerHTML =
      wdIcon("send") +
      "<span>SUBMIT WITHDRAWAL REQUEST</span>";

  }
}



withdrawInput.oninput = updateMoney;
updateMoney();


btnSubmit.onclick = () => {
  openSecurityModal();
};

/* ==========================================
   SECURE WITHDRAWAL CLIENT V1.0
========================================== */



async function submitWithdraw(securityCode) {

  if (withdrawSubmitting) return;

  const amount = Number(
    withdrawInput.value || 0
  );

  const selectedBank =
    document.getElementById("bankName").value;

  const customBankName =
    document.getElementById("otherBankName")
      .value.trim();

  const bankName =
    selectedBank === "Other"
      ? customBankName
      : selectedBank;

  const bankAccount =
    document.getElementById("bankAccount")
      .value.trim();

  const bankOwner =
    document.getElementById("bankOwner")
      .value.trim();


  /* VALIDATE BANK DETAILS */

  if (!bankName || !bankAccount || !bankOwner) {

    showNotifyModal(
      "Please complete all required bank details.",
      "error",
      "Bank Details Required"
    );

    return;

  }


  /* VALIDATE AMOUNT */

  if (
    !Number.isSafeInteger(amount) ||
    amount < MIN_WITHDRAW ||
    amount > 1000000000
  ) {

    showNotifyModal(
      `Please enter a valid withdrawal amount of at least ${MIN_WITHDRAW.toLocaleString()} diamonds.`,
      "warn",
      "Invalid Amount"
    );

    return;

  }


  const me = JSON.parse(
    localStorage.getItem("user_profile") || "{}"
  );

  if (!me.uid) {

    showNotifyModal(
      "Please sign in again.",
      "error",
      "Session Required"
    );

    return;

  }


  const bank =
    `${bankName} | STK: ${bankAccount} | ${bankOwner}`;

  const payloadKey = JSON.stringify({
    uid: me.uid,
    amount,
    bank
  });


  /* PREVENT DUPLICATE WITHDRAWALS */

  if (
    withdrawRequestId &&
    withdrawRequestPayload !== payloadKey
  ) {

    showNotifyModal(
      "A previous withdrawal has not been confirmed. Retry the original request before changing its details.",
      "warn",
      "Pending Transaction"
    );

    return;

  }

  if (!withdrawRequestId) {

    withdrawRequestId =
      crypto.randomUUID();

    withdrawRequestPayload =
      payloadKey;

  }


  withdrawSubmitting = true;

  btnSubmit.disabled = true;

  btnSubmit.innerHTML =
    wdIcon("clock") +
    "<span>PROCESSING...</span>";


  /* SEND VERIFIED REQUEST */

  try {

    const res = await fetch(
      "/api/withdraw-request",
      {

        method: "POST",

        credentials: "same-origin",

        cache: "no-store",

        headers: {
          "Content-Type": "application/json",
          "x-uid": me.uid
        },

        body: JSON.stringify({

          amount,

          bank,

          securityCode,

          requestId: withdrawRequestId

        })

      }
    );

    const data = await res.json();


    /* TRANSACTION SUCCESS */

    if (res.ok && data.ok) {

      withdrawRequestId = null;

      withdrawRequestPayload = null;

      withdrawInput.disabled = true;

      openWithdrawModal();

      await loadWithdrawHistory();

      return;

    }


    /* TRANSACTION ERROR */

    const messages = {

      WITHDRAWAL_ALREADY_PENDING:
  "You already have a pending withdrawal request.",

WITHDRAWAL_RECOVERY_REQUIRED:
  "A previous transaction requires verification. Please contact support.",

INVALID_BANK:
  "Invalid bank information.",

ACCOUNT_STATE_CHANGED:
  "Your account information has changed. Please sign in again.",

INVALID_WALLET_BALANCE:
  "Unable to verify your wallet balance.",

SECURITY_UNAVAILABLE:
  "Security verification is temporarily unavailable.",

  
      AUTH_REQUIRED:
        "Please sign in again.",

      SESSION_EXPIRED:
        "Your session has expired.",

      INVALID_SECURITY_CODE:
        "Incorrect security code.",

      SECURITY_CODE_LOCKED:
        "Too many failed attempts. Please try again later.",

      TRANSACTION_BUSY:
        "Another transaction is being processed.",

      SECURITY_BUSY:
        "The system is busy. Please try again.",

      INVALID_TRANSACTION_ID:
        "Invalid transaction reference.",

      TRANSACTION_UNCONFIRMED:
        "The transaction could not be confirmed. Retry the same request.",

      TRANSACTION_ID_ALREADY_USED:
        "This transaction reference is already in use.",

      not_enough_received:
        "Insufficient wallet diamonds.",

      invalid_amount:
        "Invalid withdrawal amount."

    };


    showNotifyModal(

      messages[data.error] ||

      data.message ||

      data.error ||

      "Unable to process withdrawal.",

      "error",

      "Transaction Failed"

    );

  } catch (error) {

    console.error(
      "[SECURE WITHDRAW]",
      error.message
    );

    showNotifyModal(

      "Connection interrupted. Retry the same withdrawal request.",

      "error",

      "Transaction Unconfirmed"

    );

  } finally {

    withdrawSubmitting = false;

    updateMoney();

  }

}


async function loadBankDefault(){
  const me = JSON.parse(localStorage.getItem("user_profile") || "{}");
  if (!me.uid) return;

  const res = await fetch("/api/profile/bank-default", {
    headers: { "x-uid": me.uid }
  });

  const data = await res.json();
  if (!data.ok || !data.bank) return;


const savedBank = String(data.bank.name || "").trim();

const availableBanks = Array.from(bankSelect.options)
  .some(option =>
    option.value === savedBank &&
    option.value !== "Other"
  );

if (savedBank && !availableBanks) {
  bankSelect.value = "Other";
  otherBankInput.value = savedBank;
} else {
  bankSelect.value = savedBank;
}

document.getElementById("bankAccount").value =
  data.bank.account || "";

document.getElementById("bankOwner").value =
  data.bank.owner || "";

updateBankSelection();

}



/* ==========================================
   WITHDRAW HISTORY - 30 DAY RECORDS
========================================== */

let withdrawHistoryLoading = false;

async function loadWithdrawHistory(
  page = withdrawPage
) {

  if (withdrawHistoryLoading) return;

  withdrawHistoryLoading = true;

  try {

    const me = JSON.parse(
      localStorage.getItem("user_profile") || "{}"
    );

    if (!me.uid) return;

    const res = await fetch("/api/withdraw-history", {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",

      headers: {
        "x-uid": me.uid
      }
    });

    if (!res.ok) return;

    const data = await res.json();

    if (!data.ok) return;

    withdrawCache = Array.isArray(data.list)
      ? data.list
      : [];

    const totalPages = Math.max(
      1,
      Math.ceil(
        withdrawCache.length / WITHDRAW_PAGE_SIZE
      )
    );

    // Preserve the current pagination position
    withdrawPage = Math.min(
      Math.max(1, page),
      totalPages
    );

    renderWithdrawPage();

  } catch (error) {

    console.warn(
      "[WITHDRAW HISTORY] Refresh failed:",
      error.message
    );

  } finally {

    withdrawHistoryLoading = false;

  }

}



function getWithdrawNote(w) {
  const note = String(w.note || "").trim();

  if (note) return note;

  const notes = {
    pending: "Your withdrawal request is awaiting review.",
    processing: "Your withdrawal is being processed.",
    approved: "Your withdrawal has been approved.",
    rejected: "Your withdrawal request was rejected."
  };

  return notes[w.status] || "Status unavailable.";
}

function wdEscapeHTML(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]
  );
}




function renderWithdrawPage(){
  const body = document.getElementById("withdrawHistoryBody");
  const empty = document.getElementById("withdrawEmpty");
  const pager = document.getElementById("withdrawPagination");

  body.innerHTML = "";
  pager.innerHTML = "";

  if (!withdrawCache.length) {
    empty.style.display = "block";
    toggleWithdrawForm(true);
    return;
  }

  empty.style.display = "none";

  // kiểm tra pending
  const hasPending = withdrawCache.some(
  w => ["pending", "processing"].includes(w.status)
);
  toggleWithdrawForm(!hasPending);

  const totalPages = Math.ceil(withdrawCache.length / WITHDRAW_PAGE_SIZE);
  const start = (withdrawPage - 1) * WITHDRAW_PAGE_SIZE;
  const end = start + WITHDRAW_PAGE_SIZE;

  withdrawCache.slice(start, end).forEach(w => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${new Date(w.createdAt).toLocaleString("en-GB")}</td>
      <td>${w.amount.toLocaleString("en-US")}</td>
      <td>
        <img
          src="${wdEscapeHTML(
  BANK_LOGOS[
    String(w.bank || "").split(" | ")[0]
  ] || ""
)}"
          style="height:18px;vertical-align:middle;margin-right:6px"
        >
        ${wdEscapeHTML(
  String(w.bank || "")
    .replace(
      " | STK: ",
      " | Account No.: "
    )
)}
      </td>
      <td class="st-${w.status}">
        ${statusText(w.status)}
      </td>

      <td class="wd-transaction-note">
  ${wdEscapeHTML(getWithdrawNote(w))}
</td>
    `;
    body.appendChild(tr);
  });

  // render pagination
if (totalPages > 1) {
  const prev = document.createElement("button");
  prev.className = "pg-btn";
  prev.innerHTML = wdIcon("left");
prev.setAttribute("aria-label", "Previous page");
  prev.disabled = withdrawPage === 1;
  prev.onclick = () => {
    withdrawPage--;
    renderWithdrawPage();
  };

  const info = document.createElement("div");
  info.className = "pg-info";
 info.textContent =
  `Page ${withdrawPage} of ${totalPages}`;

  const next = document.createElement("button");
  next.className = "pg-btn";
  next.innerHTML = wdIcon("right");
next.setAttribute("aria-label", "Next page");
  next.disabled = withdrawPage === totalPages;
  next.onclick = () => {
    withdrawPage++;
    renderWithdrawPage();
  };

  pager.appendChild(prev);
  pager.appendChild(info);
  pager.appendChild(next);
}

}



function toggleWithdrawForm(enable) {
  const warnId = "withdrawPendingWarn";
  let warn = document.getElementById(warnId);

  const bankNameEl = document.getElementById("bankName");
  const bankAccountEl = document.getElementById("bankAccount");
  const bankOwnerEl = document.getElementById("bankOwner");

  withdrawInput.disabled = !enable;
  bankNameEl.disabled = !enable;
  bankAccountEl.disabled = !enable;
  bankOwnerEl.disabled = !enable;
  otherBankInput.disabled = !enable;


  if (!enable) {
    btnSubmit.disabled = true;
btnSubmit.innerHTML =
  wdIcon("clock") +
  "<span>PENDING APPROVAL</span>";

    if (!warn) {
      warn = document.createElement("div");
      warn.id = warnId;
      warn.className = "withdraw-warn";

warn.innerHTML =
  wdIcon("warning") +
  "<span>You already have a withdrawal request awaiting approval.</span>";

      btnSubmit.parentNode.insertBefore(warn, btnSubmit);
    }
  } else {
    if (warn) warn.remove();

    updateMoney();
  }
}




/* ==========================================
   WITHDRAWAL STATUS - ENGLISH
========================================== */

function statusText(s) {

  // PENDING
  if (s === "pending") {

    return `
      <span class="wd-status">
        ${wdIcon("clock")}
        Pending
      </span>
    `;

  }



// PROCESSING
if (s === "processing") {
  return `
    <span class="wd-status">
      ${wdIcon("clock")}
      Processing
    </span>
  `;
}


  // APPROVED
  if (s === "approved") {

    return `
      <span class="wd-status">
        ${wdIcon("check")}
        Approved
      </span>
    `;

  }

  // REJECTED
  if (s === "rejected") {

    return `
      <span class="wd-status">
        ${wdIcon("error")}
        Rejected
      </span>
    `;

  }

  return "Unknown";
}


// load lần đầu
loadWithdrawHistory();
loadBankDefault();





function goBack(){
  if (history.length > 1) {
    history.back();
  } else {
    location.href = "/profile.html";
  }
}



const bankSelect = document.getElementById("bankName");
const otherBankField = document.getElementById("otherBankField");
const otherBankInput = document.getElementById("otherBankName");

function updateBankSelection() {
  const isOther = bankSelect.value === "Other";

  otherBankField.classList.toggle("hidden", !isOther);
  otherBankInput.required = isOther;

  if (!isOther) {
    otherBankInput.value = "";
  }

  updateBankLogo(bankSelect.value);
}

bankSelect.addEventListener("change", updateBankSelection);
updateBankSelection();



function openWithdrawModal(){
  const modal = document.getElementById("withdrawSuccessModal");
  modal && modal.classList.remove("hidden");
}

function closeWithdrawModal(){
  const modal = document.getElementById("withdrawSuccessModal");
  modal && modal.classList.add("hidden");
}


function openSecurityModal(){
  const modal = document.getElementById("securityCodeModal");
  const input = document.getElementById("securityCodeModalInput");
  if (!modal || !input) return;

  input.value = "";
  modal.classList.remove("hidden");
  setTimeout(() => input.focus(), 100);
}

function closeSecurityModal(){
  const modal = document.getElementById("securityCodeModal");
  modal && modal.classList.add("hidden");
}


async function confirmWithdraw(){
  const securityCode =
    document.getElementById("securityCodeModalInput").value.trim();

  if (!securityCode) {
showNotifyModal(
  "Please enter your security code to confirm this withdrawal.",
  "warn",
  "Security Code Required"
);
    return;
  }

  closeSecurityModal();

  // 🔁 GỌI LẠI LOGIC RÚT CŨ
  await submitWithdraw(securityCode);
}




function showNotifyModal(message, type = "warn", title) {
  const modal = document.getElementById("notifyModal");
  const msgEl = document.getElementById("notifyMessage");
  const iconEl = document.getElementById("notifyIcon");
  const titleEl = document.getElementById("notifyTitle");

  if (!modal) return;

  msgEl.textContent = message;

  iconEl.className = "lp-modal-icon";

  if (type === "error") {
    iconEl.classList.add("is-error");
    iconEl.innerHTML = wdIcon("error", "xl");
    titleEl.textContent = title || "Transaction Failed";

  } else if (type === "success") {
    iconEl.classList.add("is-success");
    iconEl.innerHTML = wdIcon("check", "xl");
    titleEl.textContent = title || "Success";

  } else {
    iconEl.classList.add("is-warn");
    iconEl.innerHTML = wdIcon("warning", "xl");
    titleEl.textContent = title || "Notification";
  }

  modal.classList.remove("hidden");
}


function closeNotifyModal(){
  const modal = document.getElementById("notifyModal");
  modal && modal.classList.add("hidden");
}


function showForceLogoutModal(message){
  let modal = document.getElementById("forceLogoutModal");
  if(!modal){
    modal = document.createElement("div");
    modal.id = "forceLogoutModal";
    modal.innerHTML = `
      <div class="fl-backdrop"></div>
      <div class="fl-box">
        <div class="fl-icon">${wdIcon("error", "xl")}</div>
        <div class="fl-title">Session Ended</div>
        <div class="fl-msg"></div>
        <div class="fl-sub">You will be redirected to the login page...</div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  modal.querySelector(".fl-msg").textContent = message;
  modal.classList.add("show");
}


// 🔔 SOCKET AUTH + FORCE LOGOUT (BẮT BUỘC)
const me = JSON.parse(localStorage.getItem("user_profile") || "{}");

if (typeof io === "function" && me?.uid) {
  socket = io();

  socket.emit("auth", {
    uid: me.uid,
    deviceId: localStorage.getItem("device_id") || null
  });

  socket.on("withdraw-update", () => {
    loadWithdrawHistory();
  });

 socket.on("force-logout", (data) => {
  const msg =
  data?.message || "You have been signed out.";

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


}





/* ==========================================
   LIVESTREAM PRO - DIAMOND CONVERSION
   WALLET 100% -> GAME 75%
========================================== */

const WD_CONVERT_RATE = 75;

const wdConvertAmount =
  document.getElementById("wdConvertAmount");

const wdConvertButton =
  document.getElementById("wdConvertButton");

const wdConvertStatus =
  document.getElementById("wdConvertStatus");

const wdConvertModal =
  document.getElementById("wdConvertSecurityModal");

let wdConvertGameBalance = 0;
let wdConvertPending = false;
let wdConvertRequestId = null;

const wdConvertFormat = n =>
  Number(n || 0).toLocaleString("en-US");

function wdConvertCalculate(amount) {
  const receive = Math.floor(
    amount * WD_CONVERT_RATE / 100
  );

  return {
    receive,
    fee: amount - receive
  };
}

function wdConvertUpdatePreview() {

  const amount = Number(wdConvertAmount.value);

  const valid =
    Number.isSafeInteger(amount) &&
    amount > 0 &&
    amount <= received;

  const safeAmount = valid ? amount : 0;

  const result = wdConvertCalculate(safeAmount);

  document.getElementById(
    "wdConvertOriginal"
  ).textContent = wdConvertFormat(safeAmount);

  document.getElementById(
    "wdConvertFee"
  ).textContent = "-" + wdConvertFormat(result.fee);

  document.getElementById(
    "wdConvertReceive"
  ).textContent = "+" + wdConvertFormat(result.receive);

  wdConvertButton.disabled =
    !valid ||
    result.receive < 1 ||
    wdConvertPending;
}

function wdConvertSyncBalances(wallet, game) {

  received = Math.max(0, Math.floor(Number(wallet)));

  wdConvertGameBalance =
    Math.max(0, Math.floor(Number(game)));

  receivedVal.textContent = wdConvertFormat(received);

  document.getElementById(
    "wdConvertWallet"
  ).textContent = wdConvertFormat(received);

  document.getElementById(
    "wdConvertGame"
  ).textContent = wdConvertFormat(wdConvertGameBalance);

  withdrawInput.max = received;

  if (Number(withdrawInput.value) > received) {
    withdrawInput.value = received;
  }

  updateMoney();
  wdConvertUpdatePreview();
}

async function wdConvertLoadBalance() {

  try {

    const response = await fetch(
      "/api/diamonds/convert/state",
      {
        credentials: "same-origin",
        cache: "no-store"
      }
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        data.message || "Unable to load wallet."
      );
    }

    wdConvertSyncBalances(
      data.walletDiamonds,
      data.gameDiamonds
    );

    wdConvertStatus.textContent = "";

  } catch (error) {

    wdConvertStatus.textContent =
      error.message || "Unable to load wallet.";

    wdConvertButton.disabled = true;
  }
}

function wdConvertCloseModal() {

  if (wdConvertPending) return;

  wdConvertModal.classList.add("hidden");

  document.getElementById(
    "wdConvertSecurityCode"
  ).value = "";

  wdConvertRequestId = null;
}

function wdConvertOpenModal() {

  const amount = Number(wdConvertAmount.value);

  const valid =
    Number.isSafeInteger(amount) &&
    amount > 0 &&
    amount <= received;

  if (!valid || wdConvertPending) {
    return;
  }

  const { receive, fee } =
    wdConvertCalculate(amount);

  if (receive < 1) return;

  wdConvertRequestId = crypto.randomUUID();

  document.getElementById(
    "wdConvertConfirmText"
  ).textContent =
    `Convert ${wdConvertFormat(amount)} wallet diamonds ` +
    `into ${wdConvertFormat(receive)} game diamonds? ` +
    `A fee of ${wdConvertFormat(fee)} diamonds applies.`;

  wdConvertModal.classList.remove("hidden");

  const input = document.getElementById(
    "wdConvertSecurityCode"
  );

  input.value = "";
  input.focus();
}

async function wdConvertConfirm() {

  if (wdConvertPending || !wdConvertRequestId) {
    return;
  }

  const codeInput = document.getElementById(
    "wdConvertSecurityCode"
  );

  const securityCode = codeInput.value;

  if (!securityCode) {
    showNotifyModal(
      "Please enter your security code.",
      "warn",
      "Security Code Required"
    );
    return;
  }

  const amount = Number(wdConvertAmount.value);
  const requestId = wdConvertRequestId;

  wdConvertPending = true;
  wdConvertButton.disabled = true;

  const confirmButton = document.getElementById(
    "wdConvertConfirm"
  );

  confirmButton.disabled = true;

  try {

    const response = await fetch(
      "/api/diamonds/convert",
      {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount,
          requestId,
          securityCode
        })
      }
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        data.message || "Conversion failed."
      );
    }

    wdConvertSyncBalances(
      data.walletDiamonds,
      data.gameDiamonds
    );

    wdConvertAmount.value = "";

    wdConvertModal.classList.add("hidden");
    codeInput.value = "";
    wdConvertRequestId = null;

    wdConvertStatus.textContent =
      "Conversion completed successfully.";

    wdConvertUpdatePreview();

    showNotifyModal(
      `${wdConvertFormat(data.received)} game diamonds added to your balance.`,
      "success",
      "Conversion Successful"
    );

  } catch (error) {

    wdConvertStatus.textContent =
      "Conversion was not confirmed. " +
      "Please check your balance before retrying.";

    showNotifyModal(
      error.message || "Conversion failed.",
      "error",
      "Conversion Status"
    );

    // Keep requestId for retrying the same operation.
    await wdConvertLoadBalance();

  } finally {

    wdConvertPending = false;
    confirmButton.disabled = false;
    wdConvertUpdatePreview();

  }
}

wdConvertAmount.addEventListener(
  "input",
  wdConvertUpdatePreview
);

wdConvertButton.addEventListener(
  "click",
  wdConvertOpenModal
);

document.getElementById(
  "wdConvertCancel"
).addEventListener(
  "click",
  wdConvertCloseModal
);

document.getElementById(
  "wdConvertConfirm"
).addEventListener(
  "click",
  wdConvertConfirm
);

wdConvertLoadBalance();


/* ==========================================
   WITHDRAW HISTORY - AUTO REFRESH
========================================== */

// Refresh when returning to the page

document.addEventListener(
  "visibilitychange",
  () => {

    if (document.visibilityState === "visible") {
      loadWithdrawHistory();
    }

  }
);

// Refresh every 60 seconds while visible

setInterval(() => {

  if (document.visibilityState === "visible") {
    loadWithdrawHistory();
  }

}, 60 * 1000);

// Refresh after restoring from browser cache

window.addEventListener("pageshow", event => {

  if (event.persisted) {
    loadWithdrawHistory();
  }

});