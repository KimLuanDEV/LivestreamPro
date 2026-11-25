

"use strict";

/* ==========================================
   SECURITY CENTER ENGINE
========================================== */

const $ = id => document.getElementById(id);

const REFRESH_INTERVAL = 15000;
let activeTab = "overview";
const detailLoaders = Object.create(null);
let socEvents = [];
let leaving = false;

let refreshTimer = null;
let isAuthenticated = false;
let isLoading = false;
let generation = 0;

let recentEvents = [];
let activitySamples = [];

let previousTotal = null;
let previousStart = null;

/* ==========================================
   API REQUEST
========================================== */

async function adminApi(endpoint, options = {}) {

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 8000);

  try {

    const response = await fetch(
      "/api/admin/" + endpoint,
      {
        ...options,
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal
      }
    );

    const data = await response
      .json()
      .catch(() => ({}));

    if (!response.ok) {

      const error = new Error(
        data.message ||
        data.error ||
        "HTTP " + response.status
      );

      error.status = response.status;

      throw error;

    }

    return data;

  } finally {

    clearTimeout(timeout);

  }

}

/* ==========================================
   HELPERS
========================================== */

function showMessage(message, error = false) {

  const el = $("systemMessage");

  el.textContent = message;

  el.className =
    "notice" + (error ? " error" : "");

  el.hidden = !message;

}

function formatNumber(value) {

  return Number.isFinite(value)
    ? value.toLocaleString("en-US")
    : "—";

}

function formatUptime(seconds) {

  if (!Number.isFinite(seconds)) return "—";

  const days = Math.floor(seconds / 86400);

  const hours = Math.floor(
    seconds % 86400 / 3600
  );

  const minutes = Math.floor(
    seconds % 3600 / 60
  );

  return `${days}d ${hours}h ${minutes}m`;

}

function setProgress(id, percentage) {

  const value = Number.isFinite(percentage)
    ? Math.max(0, Math.min(100, percentage))
    : 0;

  $(id).style.width = value + "%";

}

/* ==========================================
   ADMIN ACCESS
========================================== */

function showLogin(message = "") {

  generation++;
  if ($("socConfirm").open) $("socConfirm").close("cancel");
  leaving = true;
  socEvents = [];
  $("socTimeline").replaceChildren();
  $("socExport").disabled = true;
  isAuthenticated = false;

  clearTimeout(refreshTimer);

  $("dashboard").hidden = true;
  $("loginPanel").hidden = false;

  recentEvents = [];
  activitySamples = [];

  previousTotal = null;
  previousStart = null;

  $("securityLogs").replaceChildren();
  $("activityLine").setAttribute("points", "");
  $("exportBtn").disabled = true;

  document.querySelectorAll(".metric-value")
    .forEach(el => {
      el.textContent = "—";
    });

  showMessage(message);

}

function showDashboard() {

  leaving = false;
  isAuthenticated = true;

  $("loginPanel").hidden = true;
  $("dashboard").hidden = false;

  showMessage("");

  refreshFirewall();

}

async function checkAdminSession() {

  try {

    const data = await adminApi(
      "auth/status"
    );

    if (data.authenticated === true) {

      showDashboard();

    } else {

      showLogin("");

    }

  } catch (error) {

    showLogin(
      "Unable to verify admin session."
    );

  }

}

/* ==========================================
   ADMIN LOGIN
========================================== */

$("loginForm").addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    const password =
      $("adminPassword").value;

    const button = $("unlockBtn");

    if (!password) return;

    button.disabled = true;

    button.textContent = "AUTHENTICATING...";

    try {

      const data = await adminApi(
        "auth/login",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify({
            password
          })
        }
      );

      if (!data.ok) {

        throw new Error(
          "Authentication failed."
        );

      }

      location.reload();

    } catch (error) {

      showMessage(error.message, true);

    } finally {

      $("adminPassword").value = "";

      button.disabled = false;

      button.textContent =
        "UNLOCK SECURITY CENTER";

    }

  }
);

/* ==========================================
   RENDER SECURITY METRICS
========================================== */

function renderFirewall(data) {

  const firewall = data.firewall;

  if (!data.ok || !firewall) {

    throw new Error(
      "Invalid firewall response."
    );

  }

  const fields = [
    "totalBlocked",
    "httpBlocked",
    "socketBlocked",
    "originBlocked",
    "activeConnections",
    "activeIPs",
    "httpTracked",
    "socketTracked"
  ];

  for (const key of fields) {

    $(key).textContent =
      formatNumber(firewall[key]);

  }

  $("firewallVersion").textContent =
    "Version " +
    (firewall.version || "Unknown");

  const status = $("firewallStatus");

  const active =
    firewall.status === "ACTIVE";

  status.textContent =
    active ? "ACTIVE" : "UNKNOWN";

  status.className =
    "status-pill" +
    (active ? " active" : "");

  const rss =
    firewall.memory?.rss ??
    data.memory?.rss;

  const heap =
    firewall.memory?.heapUsed ??
    data.memory?.heapUsed;

  $("memoryRSS").textContent =
    Number.isFinite(rss)
      ? formatNumber(rss) + " MB"
      : "—";

  $("memoryHeap").textContent =
    Number.isFinite(heap)
      ? formatNumber(heap) + " MB"
      : "—";

  $("uptime").textContent =
    formatUptime(firewall.uptime);

  $("lastUpdated").textContent =
    "Updated " +
    new Date().toLocaleTimeString(
      "en-GB"
    );

  /* TRAFFIC DISTRIBUTION */

  const http =
    Number(firewall.httpBlocked) || 0;

  const socket =
    Number(firewall.socketBlocked) || 0;

  const total = http + socket;

  const httpPercent =
    total ? http / total * 100 : 0;

  const socketPercent =
    total ? socket / total * 100 : 0;

  $("httpShare").textContent =
    httpPercent.toFixed(1) + "%";

  $("socketShare").textContent =
    socketPercent.toFixed(1) + "%";

  setProgress(
    "httpProgress",
    httpPercent
  );

  setProgress(
    "socketProgress",
    socketPercent
  );

  /* STORAGE CAPACITY */

  setProgress(
    "httpCapacity",
    firewall.httpTracked / 200
  );

  setProgress(
    "socketCapacity",
    firewall.socketTracked / 200
  );

  /* ACTIVITY CHART */

  updateActivityChart(firewall);

  /* SECURITY LOGS */

  const logsAvailable =
    Array.isArray(firewall.recentEvents);

  recentEvents = logsAvailable
    ? firewall.recentEvents.slice(0, 200)
    : [];

  renderSecurityLogs();

  if (!logsAvailable) {

    $("emptyLogs").hidden = false;

    $("emptyLogs").textContent =
      "Security log module is not installed.";

  }

  $("exportBtn").disabled =
    recentEvents.length === 0;

}

/* ==========================================
   ACTIVITY CHART
========================================== */

function updateActivityChart(firewall) {

  const total = firewall.totalBlocked;

  if (!Number.isFinite(total)) return;

  if (
    previousStart !== firewall.startedAt ||
    (
      previousTotal !== null &&
      total < previousTotal
    )
  ) {

    activitySamples = [];

    previousTotal = null;

  }

  if (previousTotal !== null) {

    activitySamples.push(
      Math.max(0, total - previousTotal)
    );

  }

  previousStart = firewall.startedAt;
  previousTotal = total;

  activitySamples =
    activitySamples.slice(-30);

  const max = Math.max(
    1,
    ...activitySamples
  );

  const points = activitySamples.map(
    (value, index) => {

      const x = index * 300 / 29;

      const y =
        99 - value / max * 94;

      return `${x},${y}`;

    }
  );

  $("activityLine").setAttribute(
    "points",
    points.join(" ")
  );

  $("chartDescription").textContent =
    activitySamples.length

      ? "Latest sample: " +
        formatNumber(
          activitySamples[
            activitySamples.length - 1
          ]
        ) +
        " blocked operations"

      : "Collecting security samples...";

}

/* ==========================================
   SECURITY EVENT LOG
========================================== */

function renderSecurityLogs() {

  const container = $("securityLogs");

  const keyword = $("logSearch")
    .value
    .trim()
    .toLowerCase();

  const filtered = recentEvents.filter(
    event => {

      return [
        event.type,
        event.ip
      ].some(value =>
        String(value || "")
          .toLowerCase()
          .includes(keyword)
      );

    }
  );

  container.replaceChildren();

  $("logCount").textContent =
    filtered.length + " records";

  $("emptyLogs").hidden =
    filtered.length > 0;

  $("emptyLogs").textContent =
    recentEvents.length
      ? "No matching security events."
      : "No sampled security events recorded.";

  for (const event of filtered) {

    const row = document.createElement("div");

    row.className = "log-item";

    const icon = document.createElement("div");

    icon.className = "log-icon";
    icon.textContent = "!";

    const info = document.createElement("div");

    info.className = "log-info";

    const type = document.createElement("div");

    type.className = "log-type";

    type.textContent =
      String(event.type || "UNKNOWN");

    const ip = document.createElement("div");

    ip.className = "log-ip";

    ip.textContent =
      String(event.ip || "Unknown IP");

    const time = document.createElement("div");

    time.className = "log-time";

    const date = new Date(event.time);

    time.textContent =
      Number.isFinite(date.getTime())
        ? date.toLocaleString("en-GB")
        : "—";

    info.append(type, ip);

    row.append(icon, info, time);

    container.appendChild(row);

  }

}

$("logSearch").addEventListener(
  "input",
  renderSecurityLogs
);

/* ==========================================
   REFRESH FIREWALL
========================================== */

async function refreshFirewall() {

  if (
    !isAuthenticated ||
    leaving ||
    isLoading ||
    document.hidden
  ) return;

  clearTimeout(refreshTimer);

  isLoading = true;

  const currentGeneration = generation;
    const requestedTab = activeTab;

  $("refreshBtn").disabled = true;

  try {

    const tab = activeTab;
    showMessage("");
    if (detailLoaders[tab]) {
      await detailLoaders[tab]();
      if (generation === currentGeneration) $("lastUpdated").textContent = "See selected monitor for sample status";
      return;
    }
    if (tab === "overview" || tab === "logs") {
      const results = await Promise.allSettled([adminApi("security-center/stats"), ...(tab === "logs" ? [adminApi("firewall/status")] : [])]);
      if (generation !== currentGeneration || leaving) return;
      for (const result of results) if (result.status === "rejected" && [401,403].includes(result.reason?.status)) throw result.reason;
      if (results[0].status === "fulfilled") renderSOC(results[0].value);
      else { renderSOC({status:"UNAVAILABLE"}); showMessage("SOC overview unavailable. Check V2.0 backend.", true); }
      if (tab === "logs") {
        if (results[1]?.status === "fulfilled") renderFirewall(results[1].value);
        else { recentEvents=[]; renderSecurityLogs(); $("exportBtn").disabled=true; showMessage("Firewall logs unavailable.",true); }
      }
      return;
    }
    const data = await adminApi("firewall/status");

    if (
      generation !== currentGeneration
    ) return;

    renderFirewall(data);

    showMessage("");

  } catch (error) {

    if (
      generation !== currentGeneration
    ) return;

    if (
      error.status === 401 ||
      error.status === 403
    ) {

      showLogin(
        "Admin session expired. Please sign in."
      );

      return;

    }

    if (requestedTab === "overview" || requestedTab === "logs") renderSOC({status:"UNAVAILABLE"});
    $("exportBtn").disabled = true;
    $("firewallStatus").textContent =
      "STALE";

    $("firewallStatus").className =
      "status-pill offline";

    showMessage(
      "Unable to refresh firewall data. " +
      "Displayed information may be outdated.",
      true
    );

  } finally {

    isLoading = false;

    $("refreshBtn").disabled = false;

    if (
      isAuthenticated &&
      !document.hidden
    ) {

      refreshTimer = setTimeout(
        refreshFirewall,
        requestedTab === activeTab && generation === currentGeneration ? REFRESH_INTERVAL : 0
      );

    }

  }

}

$("refreshBtn").addEventListener(
  "click",
  refreshFirewall
);

/* ==========================================
   EXPORT SECURITY LOGS
========================================== */

$("exportBtn").addEventListener(
  "click",
  () => {

    if (
      !isAuthenticated || leaving ||
      !recentEvents.length
    ) return;

    const data = {

      exportedAt:
        new Date().toISOString(),

      source:
        "LSP Security Firewall",

      events: recentEvents

    };

    const blob = new Blob(
      [JSON.stringify(data, null, 2)],
      {
        type: "application/json"
      }
    );

    const url = URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;

    link.download =
      "lsp-security-logs-" +
      Date.now() +
      ".json";

    document.body.appendChild(link);

    link.click();
    link.remove();

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);

  }
);

/* ==========================================
   ADMIN LOGOUT
========================================== */

$("logoutBtn").addEventListener(
  "click",
  async () => {

    $("logoutBtn").disabled = true;
    leaving = true;
    generation++;
    clearTimeout(refreshTimer);

    try {

      const data = await adminApi(
        "auth/logout",
        {
          method: "POST"
        }
      );

      if (!data.ok) {

        throw new Error(
          "Sign out failed."
        );

      }

      showLogin("Signed out successfully.");
      location.reload();

    } catch (error) {

      showMessage(error.message, true);

    } finally {

      $("logoutBtn").disabled = false;
      if (isAuthenticated) { leaving = false; refreshFirewall(); }

    }

  }
);

/* ==========================================
   MOBILE VISIBILITY OPTIMIZATION
========================================== */

document.addEventListener(
  "visibilitychange",
  () => {

    clearTimeout(refreshTimer);

    if (
      !document.hidden &&
      isAuthenticated
    ) {

      refreshFirewall();

    }

  }
);

window.addEventListener(
  "pagehide",
  () => {

    clearTimeout(refreshTimer);

  }
);

window.addEventListener(
  "pageshow",
  event => {

    if (event.persisted) {

      location.reload();

    }

  }
);

/* START */


function setSOC(id,value) { const el=$(id); if(el) el.textContent=value == null ? '—' : String(value); }
function socState(id,value) { setSOC(id,value || 'UNKNOWN'); const el=$(id); if(el) el.dataset.state=['ACTIVE','ENFORCED','VERIFIED','NORMAL','MONITOR','OPERATIONAL'].includes(value)?'good':['DEGRADED','STALE','UNAVAILABLE','CRITICAL','CHECK_REQUIRED','NOT_CONFIGURED'].includes(value)?'bad':'warn'; }
function renderSOC(data) {
 const valid=data.ok===true && !data.stale && data.status!=='STALE' && Number.isFinite(data.collectedAt) && Date.now()-data.collectedAt<=45000 && data.collectedAt<=Date.now()+10000;
 socState('socOverall',valid?data.status:(data.status==='INITIALIZING'?'INITIALIZING':'UNAVAILABLE'));
 setSOC('socSample',valid && data.collectedAt ? 'Server sample: '+new Date(data.collectedAt).toLocaleString('en-GB',{timeZone:'Asia/Ho_Chi_Minh'}):'No current verified sample');
 for(const key of ['edge','firewall','authentication','transaction','database','offsite','ids','server']) socState('socmod-'+key,valid?data.modules?.[key]:'UNKNOWN');
 for(const key of ['cpuPercent','memoryPercent','disk','rssMB','heapUsedMB','eventLoopP95Ms','eventLoopMaxMs','connectedSockets','uptimeSeconds']) setSOC('socres-'+key,valid?formatNumber(key==='disk'?data.storage?.usedPercent:data.system?.[key]):'—');
 socEvents=valid && Array.isArray(data.recentEvents)?data.recentEvents.slice(0,50):[];
 setSOC('socLogInfo',valid && data.logging ? `${data.logging.status} · ${data.logging.retainedEvents}/${data.logging.maximumEvents} stored · up to ${data.logging.retentionDays} days · latest 50 shown`:'Persistent history unavailable');
 $('socExport').disabled=!socEvents.length; renderSOCTimeline();
 setSOC('lastUpdated',valid?'SOC sample received':'SOC sample unavailable');
}
function renderSOCTimeline(){const q=$('socLogSearch').value.trim().toLowerCase(); const list=$('socTimeline');list.replaceChildren(); for(const item of socEvents){if(!item||![item.source,item.level,item.type,item.message].some(v=>String(v||'').toLowerCase().includes(q)))continue;const row=document.createElement('div');row.className='log-item';const info=document.createElement('div');info.className='log-info';const title=document.createElement('div');title.className='log-type';title.textContent=String(item.message||item.type||'Security event');const meta=document.createElement('div');meta.className='log-ip';meta.textContent=String(item.source||'SOC')+' · '+String(item.level||'INFO')+' · '+new Date(item.time).toLocaleString('en-GB',{timeZone:'Asia/Ho_Chi_Minh'});info.append(title,meta);row.append(info);list.append(row);}if(!list.childElementCount)list.textContent='No matching SOC events.';}
$('socLogSearch').addEventListener('input',renderSOCTimeline);
$('socExport').addEventListener('click',()=>{if(!isAuthenticated||leaving||!socEvents.length)return;const url=URL.createObjectURL(new Blob([JSON.stringify({source:'SOC',exportedAt:new Date().toISOString(),events:socEvents},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='lsp-soc-events.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
function showModal({title,body}){const d=$('socConfirm'); if(d.open||!isAuthenticated||leaving)return Promise.resolve(false);$('socConfirmTitle').textContent=title;$('socConfirmBody').textContent=body;d.returnValue='cancel';return new Promise(resolve=>{d.addEventListener('close',()=>resolve(d.returnValue==='confirm'),{once:true});d.showModal();});}
async function socFetch(url,options){const g=generation;if(!isAuthenticated||leaving)throw new Error('ADMIN_AUTH_REQUIRED');const response=await fetch(url,options);if(g!==generation||leaving)throw new Error('SESSION_CHANGED');if([401,403].includes(response.status)){showLogin('Admin session expired. Please sign in.');}return response;}
function selectTab(tab){if(!isAuthenticated||leaving)return;activeTab=tab;document.querySelectorAll('[data-soc-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.socTab===tab)));document.querySelectorAll('[data-soc-pane]').forEach(p=>p.hidden=p.dataset.socPane!==tab);showMessage('');if(!isLoading)refreshFirewall();else {clearTimeout(refreshTimer);}}
document.querySelectorAll('[data-soc-tab]').forEach(b=>b.addEventListener('click',()=>selectTab(b.dataset.socTab)));

(() => {

  console.log(
    "[AUTH PERFORMANCE] Monitor V1.1 initializing"
  );

  const panel = document.getElementById(
    "authPerformancePanel"
  );

  if (!panel) {

    console.error(
      "[AUTH PERFORMANCE] Panel not found"
    );

    return;

  }

  console.log(
    "[AUTH PERFORMANCE] Panel detected"
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

  const REFRESH_INTERVAL = 60000;


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

      const response = await socFetch(

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

const contentType =
  response.headers.get("content-type") || "";

if (!contentType.includes("application/json")) {

  throw new Error(
    `Invalid API response (HTTP ${response.status})`
  );

}

const data = await response.json();

if (!response.ok || !data.ok) {

  throw new Error(
    data.error || `HTTP ${response.status}`
  );

}

console.log("[AUTH PERFORMANCE] Updated", {
  version: data.version,
  cachedAccounts: data.cachedAccounts,
  hits: data.hits,
  misses: data.misses,
  hitRate: data.hitRate
});

if (isAuthenticated && !leaving) renderStats(data);


    } catch (error) {

      setStatus(
        "UNAVAILABLE",
        "error"
      );

setText(
  "authPerfUpdated",
  "Update failed: " + error.message
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


  function stopAutoRefresh() {}
  detailLoaders["auth"] = async () => {  await loadAuthPerformance(); };
  refreshBtn?.addEventListener("click", refreshFirewall);
})();

(() => {

  const panel = document.getElementById(
    "transactionSecurityPanel"
  );

  if (!panel) return;

  if (panel.dataset.initialized === "true") {
    return;
  }

  panel.dataset.initialized = "true";

  const $ = id => document.getElementById(id);

  const refreshBtn = $("txSecRefreshBtn");
  const statusEl = $("txSecStatus");

  const REFRESH_INTERVAL = 60000;

  let loading = false;
  let refreshTimer = null;
  let sessionExpired = false;


  /* ========================================
     NUMBER FORMATTING
  ======================================== */

  function formatNumber(value) {

    if (
      value === null ||
      value === undefined
    ) {
      return "--";
    }

    const number = Number(value);

    return Number.isFinite(number)
      ? number.toLocaleString("en-US")
      : "--";

  }


  function setText(id, value) {

    const element = $(id);

    if (element) {
      element.textContent = value;
    }

  }


  /* ========================================
     MODULE STATUS
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
     SECURITY COUNTERS
  ======================================== */

  function renderCounter(id, value, alert = false) {

    const element = $(id);

    if (!element) return;

    element.textContent =
      formatNumber(value);

    const valid =
      value !== null &&
      value !== undefined &&
      Number.isFinite(Number(value));

    element.classList.toggle(

      "is-danger",

      valid &&
      alert &&
      Number(value) > 0

    );

    element.classList.toggle(

      "is-success",

      valid &&
      alert &&
      Number(value) === 0

    );

  }


  /* ========================================
     RECENT SECURITY EVENTS
  ======================================== */

  const EVENT_TYPES = {

    successfulTransactions: {
      title: "Transaction operation recorded",
      state: "success"
    },

    duplicateRequests: {
      title: "Duplicate transaction detected",
      state: "warning"
    },

    invalidAmounts: {
      title: "Invalid transaction amount",
      state: "danger"
    },

    invalidBalances: {
      title: "Invalid wallet balance",
      state: "danger"
    },

    securityFailures: {
      title: "Security code verification failed",
      state: "danger"
    },

    securityBlocked: {
      title: "Transaction security blocked",
      state: "danger"
    },

    concurrentBlocked: {
      title: "Concurrent security check blocked",
      state: "warning"
    },

    storageErrors: {
      title: "Transaction storage or processing error",
      state: "danger"
    }

  };


  function renderEvents(events) {

    const list = $("txSecEventList");

    if (!list) return;

    const records = Array.isArray(events)
      ? events
      : [];

    // Display only 20 recent events
    const visibleRecords = records.slice(0, 20);

    setText(
      "txSecEventCount",
      `${visibleRecords.length} / ${records.length}`
    );

    list.replaceChildren();

    if (!visibleRecords.length) {

      const empty =
        document.createElement("div");

      empty.className = "tx-sec-empty";

      empty.textContent =
        "No security events recorded.";

      list.appendChild(empty);

      return;

    }

    const fragment =
      document.createDocumentFragment();

    for (const event of visibleRecords) {

      if (!event || typeof event !== "object") {
        continue;
      }

      const meta = Object.hasOwn(
        EVENT_TYPES,
        event.type
      )
        ? EVENT_TYPES[event.type]
        : {
            title: "Security event",
            state: "warning"
          };

      const row =
        document.createElement("div");

      row.className =
        `tx-sec-event is-${meta.state}`;

      const dot =
        document.createElement("span");

      dot.className = "tx-sec-event-dot";

      const info =
        document.createElement("div");

      info.className = "tx-sec-event-info";

      const title =
        document.createElement("strong");

      title.textContent = meta.title;

      const uid =
        document.createElement("small");

      uid.textContent = event.uid
        ? `UID: ${String(event.uid)}`
        : "SYSTEM";

      const time =
        document.createElement("time");

      const date = new Date(event.time);

      time.textContent =
        Number.isFinite(date.getTime())

          ? date.toLocaleTimeString("en-GB")

          : "--";

      info.append(title, uid);

      row.append(dot, info, time);

      fragment.appendChild(row);

    }

    list.appendChild(fragment);

  }


  /* ========================================
     RENDER TRANSACTION STATISTICS
  ======================================== */

  function renderStats(data) {

    setText(
      "txSecSuccess",
      formatNumber(
        data.successfulTransactions
      )
    );

    renderCounter(
      "txSecDuplicates",
      data.duplicateRequests,
      true
    );

    renderCounter(
      "txSecInvalidAmounts",
      data.invalidAmounts,
      true
    );

    renderCounter(
      "txSecFailures",
      data.securityFailures,
      true
    );

    renderCounter(
      "txSecLocked",
      data.lockedAccounts,
      true
    );

    renderCounter(
      "txSecStorageErrors",
      data.storageErrors,
      true
    );

    renderCounter(
      "txSecConcurrent",
      data.concurrentBlocked,
      true
    );

    renderCounter(
      "txSecInvalidBalances",
      data.invalidBalances,
      true
    );

    renderCounter(
      "txSecBlocked",
      data.securityBlocked,
      true
    );

    renderCounter(
      "txSecActiveChecks",
      data.activeChecks
    );

    renderCounter(
      "txSecTracked",
      data.trackedAccounts
    );


    /* SECURITY CONFIGURATION */

    setText(

      "txSecLimit",

      `${formatNumber(data.securityLimit)} attempts`

    );

    setText(

      "txSecLockTime",

      `${formatNumber(data.securityLockMinutes)} minutes`

    );

    setText(

      "txSecMaxAmount",

      `${formatNumber(data.maxAmount)} 💎`

    );

    setText(

      "txSecVersion",

      `Transaction Protection V${data.version || "--"}`

    );

    const startedAt = new Date(
      Number(data.startedAt)
    );

    setText(

      "txSecStarted",

      Number.isFinite(startedAt.getTime())

        ? startedAt.toLocaleString("en-GB")

        : "--"

    );


    /* RECENT EVENTS */

    renderEvents(data.recentEvents);


    /* STATUS */

    const active =
      data.status === "ACTIVE";

    setStatus(

      active ? "ACTIVE" : "UNKNOWN",

      active ? "active" : "error"

    );

    setText(

      "txSecUpdated",

      "Updated: " +
        new Date().toLocaleTimeString("en-GB")

    );

  }


  /* ========================================
     FETCH LIVE TRANSACTION DATA
  ======================================== */

  async function loadTransactionSecurity() {

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

    const controller =
      new AbortController();

    const timeout = setTimeout(

      () => controller.abort(),

      8000

    );

    try {

      const response = await socFetch(

        "/api/admin/security-transaction/stats",

        {

          method: "GET",

          credentials: "same-origin",

          cache: "no-store",

          signal: controller.signal

        }

      );


      /* ADMIN AUTHORIZATION */

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

          "txSecUpdated",

          "Admin authorization required."

        );

        // Remove previous sensitive event details
        $("txSecEventList")?.replaceChildren();

        setText("txSecEventCount", "--");

        return;

      }


      /* VERIFY API RESPONSE */

      const contentType =
        response.headers.get("content-type") || "";

      if (
        !contentType.includes("application/json")
      ) {

        throw new Error(

          `Invalid API response (HTTP ${response.status})`

        );

      }

      const data = await response.json();

      if (!response.ok || data.ok !== true) {

        throw new Error(

          data.error ||
          `HTTP ${response.status}`

        );

      }

      if (isAuthenticated && !leaving) renderStats(data);

    } catch (error) {

      setStatus(
        "UNAVAILABLE",
        "error"
      );

      setText(

        "txSecUpdated",

        "Update failed: " +
          error.message +
          " — Previous data may be outdated."

      );

      console.warn(

        "[TRANSACTION SECURITY]",

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


  function stopAutoRefresh() {}
  detailLoaders["finance"] = async () => {  await loadTransactionSecurity(); };
  refreshBtn?.addEventListener("click", refreshFirewall);
})();

(() => {

  const panel = document.getElementById(
    "databaseSecurityPanel"
  );

  if (!panel) return;

  if (panel.dataset.initialized === "true") {
    return;
  }

  panel.dataset.initialized = "true";

  const $ = id => document.getElementById(id);

  const backupBtn = $("dbSecBackupBtn");
  const refreshBtn = $("dbSecRefreshBtn");

  const REFRESH_INTERVAL = 60000;

  let refreshTimer = null;
  let loading = false;
  let manualBackupRunning = false;
  let confirmingBackup = false;
  let sessionExpired = false;
  let serverBackupRunning = false;
  let backupAvailable = false;
  let cooldownUntil = 0;


  /* ========================================
     NUMBER FORMATTING
  ======================================== */

  function formatNumber(value) {

    if (
      value === null ||
      value === undefined
    ) {
      return "--";
    }

    const number = Number(value);

    return Number.isFinite(number)

      ? number.toLocaleString("en-US")

      : "--";

  }


  /* ========================================
     BYTE FORMATTING
  ======================================== */

  function formatBytes(value) {

    if (value == null) return "--";

    const bytes = Number(value);

    if (
      !Number.isFinite(bytes) ||
      bytes < 0
    ) {
      return "--";
    }

    if (bytes === 0) return "0 B";

    const units = [
      "B",
      "KB",
      "MB",
      "GB",
      "TB"
    ];

    let size = bytes;
    let index = 0;

    while (
      size >= 1024 &&
      index < units.length - 1
    ) {

      size /= 1024;
      index++;

    }

    return (
      size.toFixed(index === 0 ? 0 : 2) +
      " " +
      units[index]
    );

  }


  /* ========================================
     DATE FORMATTING
  ======================================== */

  function formatDate(value) {

    if (!value) return "--";

    const date = new Date(Number(value));

    if (!Number.isFinite(date.getTime())) {
      return "--";
    }

    return date.toLocaleString(
      "en-GB",
      {
        timeZone: "Asia/Ho_Chi_Minh"
      }
    );

  }


  function setText(id, value) {

    const element = $(id);

    if (element) {
      element.textContent = value;
    }

  }


  /* ========================================
     MODULE STATUS
  ======================================== */

  function setStatus(text, state) {

    const element = $("dbSecStatus");

    if (!element) return;

    element.textContent = text;

    element.classList.toggle(
      "is-active",
      state === "active"
    );

    element.classList.toggle(
      "is-error",
      state === "error"
    );

  }


  /* ========================================
     ERROR MESSAGE
  ======================================== */

  function showError(message = "") {

    const element = $("dbSecError");

    if (!element) return;

    element.textContent = message;

    element.classList.toggle(
      "hidden",
      !message
    );

  }


  /* ========================================
     RENDER COUNTERS
  ======================================== */

  function renderCounter(
    id,
    value,
    alert = false
  ) {

    const element = $(id);

    if (!element) return;

    element.textContent =
      formatNumber(value);

    const valid =
      value != null &&
      Number.isFinite(Number(value));

    element.classList.toggle(
      "is-danger",
      valid && alert && Number(value) > 0
    );

    element.classList.toggle(
      "is-success",
      valid && alert && Number(value) === 0
    );

  }


  /* ========================================
     STORAGE MONITOR
  ======================================== */

  function renderStorage(storage) {

    const fill = $("dbSecDiskFill");

    if (
      !storage ||
      !Number.isFinite(
        Number(storage.usedPercent)
      )
    ) {

      setText("dbSecDiskPercent", "--");

      setText("dbSecFree", "--");

      setText(
        "dbSecDiskInfo",
        "Storage information unavailable."
      );

      if (fill) {

        fill.style.width = "0%";

        fill.classList.remove(
          "is-warning",
          "is-danger"
        );

        fill.parentElement?.removeAttribute(
          "aria-valuenow"
        );

      }

      return;

    }

    const percent = Math.max(

      0,

      Math.min(
        100,
        Number(storage.usedPercent)
      )

    );

    setText(

      "dbSecDiskPercent",

      percent.toFixed(1) + "%"

    );

    setText(

      "dbSecFree",

      formatBytes(storage.freeBytes)

    );

    setText(

      "dbSecDiskInfo",

      `${formatBytes(storage.usedBytes)} / ` +
      `${formatBytes(storage.totalBytes)} used`

    );

    if (fill) {

      fill.style.width = `${percent}%`;

      fill.classList.toggle(

        "is-warning",

        percent >= 75 && percent < 90

      );

      fill.classList.toggle(

        "is-danger",

        percent >= 90

      );

      fill.parentElement?.setAttribute(

        "aria-valuenow",

        String(percent)

      );

    }

  }


  /* ========================================
     RECENT BACKUP FILES
  ======================================== */

  function renderBackups(backups, total) {

    const list = $("dbSecBackupList");

    if (!list) return;

    const records = Array.isArray(backups)

      ? backups.slice(0, 20)

      : [];

    setText(

      "dbSecBackupCount",

      `${records.length} / ${formatNumber(total)}`

    );

    list.replaceChildren();

    if (!records.length) {

      const empty =
        document.createElement("div");

      empty.className = "tx-sec-empty";

      empty.textContent =
        "No backup files available.";

      list.appendChild(empty);

      return;

    }

    const fragment =
      document.createDocumentFragment();

    for (const backup of records) {

      if (!backup || typeof backup !== "object") {
        continue;
      }

      const filename = String(
        backup.name || ""
      );

      const isDaily =
        filename.startsWith("daily-");

      const row =
        document.createElement("div");

      row.className = "tx-sec-event";

      const icon =
        document.createElement("div");

      icon.className = "db-sec-file-icon";

      // Fixed SVG, not server-generated HTML.

      icon.innerHTML = `
        <svg viewBox="0 0 24 24"
             fill="none"
             stroke="currentColor"
             stroke-width="1.6"
             stroke-linecap="round"
             stroke-linejoin="round">

          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>

          <path d="M14 2v6h6"/>

          <rect x="8" y="13"
                width="8" height="6"
                rx="1"/>

          <path d="M10 13v-2a2 2 0 0 1 4 0v2"/>

        </svg>
      `;

      const info =
        document.createElement("div");

      info.className = "tx-sec-event-info";

      const title =
        document.createElement("strong");

      title.textContent = isDaily

        ? "Daily Backup"

        : "Hourly Backup";

      const date =
        document.createElement("small");

      date.textContent =
        formatDate(backup.createdAt);

      const name =
        document.createElement("small");

      name.textContent = filename;

      const size =
        document.createElement("span");

      size.className =
        "db-sec-file-size";

      size.textContent =
        formatBytes(backup.size);

      info.append(title, date, name);

      row.append(icon, info, size);

      fragment.appendChild(row);

    }

    list.appendChild(fragment);

  }


  /* ========================================
     UPDATE BACKUP BUTTON
  ======================================== */

  function updateBackupButton() {

    if (!backupBtn) return;

    const cooldown = Math.max(

      0,

      Math.ceil(
        (cooldownUntil - Date.now()) / 1000
      )

    );

    backupBtn.disabled =

      loading ||

      manualBackupRunning ||

      confirmingBackup ||

      serverBackupRunning ||

      sessionExpired ||

      !backupAvailable ||

      cooldown > 0;

    let text = "BACKUP NOW";

    if (
      manualBackupRunning ||
      serverBackupRunning
    ) {

      text = "CREATING BACKUP...";

    } else if (sessionExpired) {

      text = "ACCESS DENIED";

    } else if (!backupAvailable) {

      text = "BACKUP UNAVAILABLE";

    } else if (cooldown > 0) {

      const minutes =
        Math.ceil(cooldown / 60);

      text =
        `AVAILABLE IN ${minutes} MIN`;

    }

    setText(
      "dbSecBackupBtnText",
      text
    );

  }


  /* ========================================
     RENDER DATABASE STATISTICS
  ======================================== */


  /* ==========================================
   OFFSITE BACKUP MONITOR V1.1
========================================== */

function renderOffsiteSecurity(
  data,
  unavailableState = ""
) {

  const offsite = data?.offsite;

  const statusEl =
    $("dbOffsiteStatus");


  /* RESET STATUS COLORS */

  const setOffsiteStatus = (
    label,
    state = ""
  ) => {

    if (!statusEl) return;

    statusEl.textContent = label;

    statusEl.classList.toggle(

      "is-active",

      state === "success"

    );

    statusEl.classList.toggle(

      "is-error",

      state === "danger"

    );

  };


  const setIndicator = (
    id,
    label,
    state = ""
  ) => {

    const element = $(id);

    if (!element) return;

    element.textContent = label;

    element.classList.toggle(

      "is-success",

      state === "success"

    );

    element.classList.toggle(

      "is-danger",

      state === "danger"

    );

  };


  /* LOCAL BACKUP STATUS */

  const localVerified =

    data?.status === "ACTIVE" &&

    Number(data?.lastVerifiedAt) > 0;

  setIndicator(

    "dbOffsiteLocal",

    unavailableState

      ? "--"

      : localVerified

        ? "VERIFIED"

        : data?.backupRunning

          ? "BACKING UP"

          : data?.status === "DEGRADED"

            ? "CHECK REQUIRED"

            : "WAITING",

    unavailableState

      ? ""

      : localVerified

        ? "success"

        : data?.status === "DEGRADED"

          ? "danger"

          : ""

  );


  /* ERROR DISPLAY */

  const errorEl =
    $("dbOffsiteError");

  const setOffsiteError = message => {

    if (!errorEl) return;

    errorEl.textContent =
      String(message || "").slice(0, 300);

    errorEl.classList.toggle(

      "hidden",

      !message

    );

  };


  /* UNAVAILABLE OR OLD BACKEND */

  if (
    unavailableState ||
    !offsite ||
    typeof offsite !== "object"
  ) {

    setOffsiteStatus(

      unavailableState ||
      "NOT AVAILABLE",

      "danger"

    );

    setIndicator(
      "dbOffsiteRemote",
      "--"
    );

    setIndicator(
      "dbOffsiteSuccess",
      "--"
    );

    setIndicator(
      "dbOffsiteFailed",
      "--"
    );

    setText(
      "dbOffsiteVerifiedAt",
      "--"
    );

    setText(
      "dbOffsiteLastObject",
      "--"
    );

    setOffsiteError(

      unavailableState

        ? "Unable to verify current offsite status."

        : "Offsite statistics are unavailable. Check the V1.1 backend."

    );

    return;

  }


  /* R2 CONNECTION STATUS */

  const status = String(

    offsite.status || "UNKNOWN"

  );

  const lastVerified =
    Number(offsite.lastVerifiedAt);

  const hasVerification =

    Number.isFinite(lastVerified) &&

    lastVerified > 0;

  const verificationAge =

    Date.now() - lastVerified;

  const intervalMs =

    (Number(data.intervalMinutes) > 0

      ? Number(data.intervalMinutes)

      : 60) * 60000;

  // Warn if no verification has occurred
  // for more than two backup intervals.

  const stale =

    hasVerification &&

    verificationAge > intervalMs * 2;


  /* STATUS LABELS */

  const statusLabels = {

    ACTIVE: "ACTIVE",

    WAITING: "WAITING",

    SYNCING: "SYNCING",

    DEGRADED: "DEGRADED",

    DISABLED: "DISABLED"

  };

  const remoteVerified =

    status === "ACTIVE" &&

    hasVerification &&

    !stale;

  setOffsiteStatus(

    status === "ACTIVE" && stale

      ? "STALE"

      : status === "ACTIVE" && !hasVerification

        ? "UNVERIFIED"

        : statusLabels[status] || "UNKNOWN",

    remoteVerified

      ? "success"

      : stale ||
        status === "DEGRADED" ||
        status === "UNKNOWN"

        ? "danger"

        : ""

  );


  /* REMOTE BACKUP INDICATOR */

  setIndicator(

    "dbOffsiteRemote",

    remoteVerified

      ? "VERIFIED"

      : status === "SYNCING"

        ? "SYNCING"

        : status === "DISABLED"

          ? "DISABLED"

          : stale

            ? "STALE"

            : status === "DEGRADED"

              ? "CHECK REQUIRED"

              : "WAITING",

    remoteVerified

      ? "success"

      : status === "DEGRADED" || stale

        ? "danger"

        : ""

  );


  /* UPLOAD COUNTERS */

  setIndicator(

    "dbOffsiteSuccess",

    formatNumber(
      offsite.successfulUploads
    ),

    Number(offsite.successfulUploads) > 0

      ? "success"

      : ""

  );

  renderCounter(

    "dbOffsiteFailed",

    offsite.failedUploads,

    true

  );


  /* LAST VERIFIED BACKUP */

  setText(

    "dbOffsiteVerifiedAt",

    hasVerification

      ? formatDate(lastVerified)

      : "--"

  );

  const objectName = String(

    offsite.lastObject || ""

  ).split("/").pop();

  setText(

    "dbOffsiteLastObject",

    objectName || "--"

  );


  /* ERROR REPORT */

  setOffsiteError(

    offsite.lastError ||

    (stale

      ? "Offsite verification is older than two backup intervals."

      : "")

  );

}


  function renderStats(data) {

    const status = String(
      data.status || "UNKNOWN"
    );

    serverBackupRunning =

      data.backupRunning === true ||

      status === "BACKING_UP";

    backupAvailable = [

      "ACTIVE",

      "BACKING_UP",

      "DEGRADED",

      "WAITING_FOR_BACKUP"

    ].includes(status);


    /* STATUS */

    const statusLabels = {

      ACTIVE: "ACTIVE",

      BACKING_UP: "BACKING UP",

      DEGRADED: "DEGRADED",

      NOT_CONFIGURED: "NOT CONFIGURED",

      WAITING_FOR_BACKUP: "WAITING"

    };

    setStatus(

      statusLabels[status] || "UNKNOWN",

      status === "ACTIVE"

        ? "active"

        : [
            "DEGRADED",
            "NOT_CONFIGURED"
          ].includes(status)

          ? "error"

          : "normal"

    );


    /* BACKUP VERIFICATION */

    const verification =
      $("dbSecVerification");

    let verificationText =
      "WAITING FOR BACKUP";

    let verificationState = "";

    if (status === "NOT_CONFIGURED") {

      verificationText =
        "BACKUP NOT CONFIGURED";

      verificationState = "danger";

    } else if (status === "DEGRADED") {

      verificationText =
        "BACKUP CHECK REQUIRED";

      verificationState = "danger";

    } else if (serverBackupRunning) {

      verificationText =
        "BACKUP IN PROGRESS";

    } else if (
      status === "ACTIVE" &&
      data.lastVerifiedAt
    ) {

      verificationText =
        "BACKUP VERIFIED";

      verificationState = "success";

    }

    if (verification) {

      verification.textContent =
        verificationText;

      verification.classList.toggle(
        "is-success",
        verificationState === "success"
      );

      verification.classList.toggle(
        "is-danger",
        verificationState === "danger"
      );

    }

    setText(

      "dbSecVerifiedAt",

      data.lastVerifiedAt

        ? "Last verified: " +
          formatDate(data.lastVerifiedAt)

        : "No verification in this server session."

    );


    /* BACKUP COUNTERS */

    renderCounter(
      "dbSecTotal",
      data.totalBackups
    );

    renderCounter(
      "dbSecHourly",
      data.hourlyBackups
    );

    renderCounter(
      "dbSecDaily",
      data.dailyBackups
    );

    renderCounter(
      "dbSecSuccess",
      data.successfulBackups
    );

    renderCounter(
      "dbSecFailed",
      data.failedBackups,
      true
    );

    renderCounter(
      "dbSecIntegrity",
      data.integrityFailures,
      true
    );

    setText(

      "dbSecBytes",

      formatBytes(data.backupBytes)

    );


    /* CONFIGURATION */

    setText(

      "dbSecVersion",

      `Encrypted Backup System V${data.version || "--"}`

    );

    setText(

      "dbSecEncryption",

      data.encryption || "--"

    );

    setText(

      "dbSecCompression",

      data.compression || "--"

    );

    setText(

      "dbSecChecksum",

      data.checksum || "--"

    );

    setText(

      "dbSecInterval",

      `${formatNumber(data.intervalMinutes)} minutes`

    );

    setText(

      "dbSecRetention",

      `${formatNumber(data.hourlyRetention)} hourly / ` +
      `${formatNumber(data.dailyRetention)} daily`

    );

    setText(

      "dbSecLastBackup",

      formatDate(data.lastBackupAt)

    );

    setText(

      "dbSecLastSize",

      data.lastBackupAt
        ? formatBytes(data.lastBackupSize)
        : "--"

    );


/* STORAGE AND HISTORY */

renderStorage(data.storage);

renderBackups(
  data.recentBackups,
  data.totalBackups
);


/* OFFSITE BACKUP V1.1 */

renderOffsiteSecurity(data);

    showError(data.lastError || "");

    setText(

      "dbSecUpdated",

      "Updated: " +
        new Date().toLocaleTimeString(
          "en-GB",
          {
            timeZone: "Asia/Ho_Chi_Minh"
          }
        )

    );

    updateBackupButton();

  }


  /* ========================================
     ACCESS DENIED
  ======================================== */

  function handleAccessDenied() {

    sessionExpired = true;

    backupAvailable = false;

    /* CLEAR OFFSITE INFORMATION */

renderOffsiteSecurity(
  null,
  "ACCESS DENIED"
);


    stopAutoRefresh();

    setStatus(
      "ACCESS DENIED",
      "error"
    );

    $("dbSecBackupList")
      ?.replaceChildren();

    setText(
      "dbSecBackupCount",
      "--"
    );

    setText(
      "dbSecVerification",
      "ACCESS DENIED"
    );

    setText(

      "dbSecUpdated",

      "Admin authorization required."

    );

    showError(
      "Please authenticate again."
    );

    updateBackupButton();

  }


  /* ========================================
     FETCH DATABASE STATISTICS
  ======================================== */

  async function loadDatabaseSecurity() {

    if (
      loading ||
      manualBackupRunning ||
      sessionExpired ||
      document.hidden
    ) {
      return;
    }

    loading = true;

    updateBackupButton();

    if (refreshBtn) {

      refreshBtn.disabled = true;

      refreshBtn.classList.add(
        "is-loading"
      );

    }

    const controller =
      new AbortController();

    const timeout = setTimeout(

      () => controller.abort(),

      8000

    );

    try {

      const response = await socFetch(

        "/api/admin/security-database/stats",

        {

          method: "GET",

          credentials: "same-origin",

          cache: "no-store",

          signal: controller.signal

        }

      );

      if (
        response.status === 401 ||
        response.status === 403
      ) {

        handleAccessDenied();

        return;

      }

      const contentType =
        response.headers.get("content-type") || "";

      if (
        !contentType.includes("application/json")
      ) {

        throw new Error(
          `Invalid API response (HTTP ${response.status})`
        );

      }

      const data = await response.json();

      if (
        !response.ok ||
        data.ok !== true
      ) {

        throw new Error(

          data.error ||
          `HTTP ${response.status}`

        );

      }

      if (isAuthenticated && !leaving) renderStats(data);

    } catch (error) {

      backupAvailable = false;
/* OFFSITE STATUS UNAVAILABLE */

renderOffsiteSecurity(

  null,

  "UNAVAILABLE"

);

      setStatus(
        "UNAVAILABLE",
        "error"
      );



      setText(

        "dbSecVerification",

        "STATUS UNAVAILABLE"

      );

      setText(

        "dbSecUpdated",

        "Update failed. Previous data may be outdated."

      );

      showError(error.message);

      console.warn(

        "[DATABASE SECURITY]",

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

      updateBackupButton();

    }

  }


  /* ========================================
     CREATE MANUAL BACKUP
  ======================================== */

  async function createManualBackup() {

    if (

      loading ||

      manualBackupRunning ||

      confirmingBackup ||

      serverBackupRunning ||

      sessionExpired ||

      !backupAvailable ||

      Date.now() < cooldownUntil

    ) {
      return;
    }


    /* CONFIRM BACKUP */

    confirmingBackup = true;

    updateBackupButton();

    let confirmed = false;

    try {

      confirmed = await showModal({

        title: "DATABASE BACKUP",

        body:
          "Create a new encrypted database backup now?",

        confirm: true

      });

    } finally {

      confirmingBackup = false;

      updateBackupButton();

    }

    if (

      !confirmed || !isAuthenticated || leaving || activeTab !== "backup" ||

      loading ||

      manualBackupRunning ||

      sessionExpired ||

      serverBackupRunning ||

      !backupAvailable ||

      Date.now() < cooldownUntil

    ) {
      return;
    }


    manualBackupRunning = true;

    updateBackupButton();

    showError("");

    setStatus(
      "BACKING UP",
      "normal"
    );

    setText(

      "dbSecVerification",

      "BACKUP IN PROGRESS"

    );

    setText(

      "dbSecUpdated",

      "Creating encrypted backup..."

    );

    // The server may need more time than
    // a regular statistics request.

    const controller =
      new AbortController();

    const timeout = setTimeout(

      () => controller.abort(),

      120000

    );

    let resultMessage = "";

    try {

      const response = await socFetch(

        "/api/admin/security-database/backup",

        {

          method: "POST",

          credentials: "same-origin",

          cache: "no-store",

          signal: controller.signal

        }

      );

      if (
        response.status === 401 ||
        response.status === 403
      ) {

        handleAccessDenied();

        return;

      }

      const contentType =
        response.headers.get("content-type") || "";

      if (
        !contentType.includes("application/json")
      ) {

        throw new Error(
          `Invalid API response (HTTP ${response.status})`
        );

      }

      const data = await response.json();

      if (
        !response.ok ||
        data.ok !== true
      ) {

        if (data.error === "BACKUP_RATE_LIMIT") {

          cooldownUntil =
            Date.now() + 5 * 60 * 1000;

          throw new Error(
            "Manual backup is limited to once every 5 minutes."
          );

        }

        if (data.error === "BACKUP_BUSY") {

          throw new Error(
            "Another backup is already running."
          );

        }

        if (data.error === "BACKUP_NOT_CONFIGURED") {

          backupAvailable = false;

          throw new Error(
            "Database backup is not configured."
          );

        }

        throw new Error(

          data.error ||
          "BACKUP_FAILED"

        );

      }


      /* VERIFIED SERVER RESPONSE */

      cooldownUntil =
        Date.now() + 5 * 60 * 1000;

      resultMessage =

        `Backup successfully created. ` +

        `${formatNumber(data.files)} files, ` +

        `${formatBytes(data.size)} encrypted.`;

      console.log(

        "[DATABASE BACKUP] SUCCESS",

        {

          files: data.files,

          bytes: data.size

        }

      );

    } catch (error) {

      if (error.name === "AbortError") {

        resultMessage =
          "Backup result is unconfirmed. Check the backup list before retrying.";

      } else {

        resultMessage =
          "Backup request: " + error.message;

      }

      // Prevent immediate repeated requests
      // when the result may be uncertain.

      cooldownUntil = Math.max(

        cooldownUntil,

        Date.now() + 30000

      );

    } finally {

      clearTimeout(timeout);

      manualBackupRunning = false;

      updateBackupButton();

      if (!sessionExpired && isAuthenticated && !leaving && activeTab === "backup") {

        await refreshFirewall();

        if (resultMessage) {

          setText(

            "dbSecUpdated",

            resultMessage

          );

        }

      }

    }

  }


  function stopAutoRefresh() {}
  detailLoaders["backup"] = async () => { updateBackupButton(); await loadDatabaseSecurity(); };
  refreshBtn?.addEventListener("click", refreshFirewall);
  backupBtn?.addEventListener("click", createManualBackup);
  updateBackupButton();
})();

(() => {

  const panel = document.getElementById(
    "idsSecurityPanel"
  );

  if (!panel) return;

  if (panel.dataset.initialized === "true") {
    return;
  }

  panel.dataset.initialized = "true";

  const $ = id => document.getElementById(id);

  const refreshBtn = $("idsRefreshBtn");

  const REFRESH_INTERVAL = 60000;

  let loading = false;
  let timer = null;
  let sessionExpired = false;

  const COUNTERS = {

    idsThreats: "threatSignals",

    idsLow: "lowRisk",

    idsElevated: "elevatedRisk",

    idsHigh: "highRisk",

    idsHttp: "httpRequests",

    idsPackets: "socketPackets",

    idsLogin: "loginFailures",

    idsRateLimit: "rateLimitResponses",

    idsTransactions: "transactionFailures",

    idsFlood: "socketFloods",

    idsSessions: "invalidSessions",

    idsHighAlerts: "highRiskAlerts",

    idsTracked: "trackedIPs",

    idsDropped: "droppedSignals"

  };

  const LABELS = {

    EDGE_DENIED:
      "Edge authentication denied",

    HTTP_FORBIDDEN:
      "HTTP access forbidden",

    HTTP_UNAUTHORIZED:
      "Unauthorized API request",

    HTTP_RATE_LIMIT:
      "HTTP rate limit triggered",

    LOGIN_FAILED:
      "Login verification failed",

    TRANSACTION_AUTH_FAILED:
      "Transaction verification failed",

    SESSION_INVALID:
      "Invalid socket session",

    SOCKET_FLOOD:
      "Socket flood detected"

  };


  /* ========================================
     COMMON HELPERS
  ======================================== */

  function setText(id, value) {

    const element = $(id);

    if (element) {
      element.textContent = value;
    }

  }


  function formatNumber(value) {

    if (value == null) return "--";

    const number = Number(value);

    return Number.isFinite(number)

      ? number.toLocaleString("en-US")

      : "--";

  }


  function formatTime(value) {

    if (!value) return "--";

    const date = new Date(Number(value));

    if (!Number.isFinite(date.getTime())) {
      return "--";
    }

    return date.toLocaleString(

      "en-GB",

      {
        timeZone: "Asia/Ho_Chi_Minh"
      }

    );

  }


  function setStatus(label, state = "") {

    const element = $("idsStatus");

    if (!element) return;

    element.textContent = label;

    element.classList.toggle(

      "is-active",

      state === "active"

    );

    element.classList.toggle(

      "is-error",

      state === "error"

    );

  }


  function levelClass(level) {

    if (level === "HIGH") {
      return "ids-high";
    }

    if (level === "ELEVATED") {
      return "ids-elevated";
    }

    if (level === "LOW") {
      return "ids-low";
    }

    return "";

  }


  function showEmpty(list, message) {

    if (!list) return;

    const empty =
      document.createElement("div");

    empty.className = "tx-sec-empty";

    empty.textContent = message;

    list.replaceChildren(empty);

  }


  /* ========================================
     RENDER IP RISK SCORES
  ======================================== */

  function renderRiskList(records) {

    const list = $("idsRiskList");

    if (!list) return;

    const items = Array.isArray(records)

      ? records.filter(
          item =>
            item &&
            Number(item.score) >= 15
        ).slice(0, 20)

      : [];

    if (!items.length) {

      showEmpty(

        list,

        "No elevated security activity detected."

      );

      return;

    }

    const fragment =
      document.createDocumentFragment();

    for (const item of items) {

      const score = Math.max(

        0,

        Math.min(
          100,
          Number(item.score) || 0
        )

      );

      const row =
        document.createElement("div");

      row.className = "ids-ip-row";

      const head =
        document.createElement("div");

      head.className = "ids-ip-head";

      const ip =
        document.createElement("strong");

      ip.className = "ids-ip-address";

      ip.textContent =
        String(item.ip || "--");

      const value =
        document.createElement("span");

      value.className =

        "ids-ip-score " +
        levelClass(item.level);

      value.textContent =
        `${score}/100`;

      head.append(ip, value);

      const progress =
        document.createElement("div");

      progress.className =
        "ids-risk-progress";

      const fill =
        document.createElement("div");

      fill.className =
        levelClass(item.level);

      fill.style.width =
        `${score}%`;

      progress.appendChild(fill);

      const meta =
        document.createElement("small");

      meta.className = "ids-ip-meta";

      meta.textContent =

        `${item.level || "UNKNOWN"} · ` +

        `${formatNumber(item.signals)} signals · ` +

        formatTime(item.lastSeen);

      row.append(
        head,
        progress,
        meta
      );

      fragment.appendChild(row);

    }

    list.replaceChildren(fragment);

  }


  /* ========================================
     RENDER THREAT EVENTS
  ======================================== */

  function renderEvents(records) {

    const list = $("idsEventList");

    if (!list) return;

    const items = Array.isArray(records)

      ? records.filter(Boolean).slice(0, 20)

      : [];

    if (!items.length) {

      showEmpty(

        list,

        "No threat alerts recorded."

      );

      return;

    }

    const fragment =
      document.createDocumentFragment();

    for (const item of items) {

      const row =
        document.createElement("div");

      row.className = "tx-sec-event";

      const dot =
        document.createElement("span");

      dot.className = "tx-sec-event-dot";

      dot.style.backgroundColor =

        item.level === "HIGH"

          ? "#ff9292"

          : item.level === "ELEVATED"

            ? "#e1bc7e"

            : "#82d6a2";

      const info =
        document.createElement("div");

      info.className =
        "tx-sec-event-info";

      const title =
        document.createElement("strong");

      title.textContent =

        Object.hasOwn(LABELS, item.type)

          ? LABELS[item.type]

          : "Security signal";

      const detail =
        document.createElement("small");

      detail.textContent =

        `${item.ip || "--"} · ` +

        `${item.source || "--"} · ` +

        formatTime(item.time);

      const level =
        document.createElement("span");

      level.className =

        "ids-event-level " +

        levelClass(item.level);

      level.textContent =
        String(item.level || "UNKNOWN");

      info.append(title, detail);

      row.append(dot, info, level);

      fragment.appendChild(row);

    }

    list.replaceChildren(fragment);

  }


  /* ========================================
     RENDER STATISTICS
  ======================================== */

  function renderStats(data) {

    for (
      const [id, key] of Object.entries(COUNTERS)
    ) {

      setText(

        id,

        formatNumber(data[key])

      );

    }

    setText(

      "idsMode",

      data.mode || "--"

    );

    setText(

      "idsWindow",

      `${formatNumber(
        data.riskWindowMinutes
      )} minutes`

    );

    setText(

      "idsAutoBan",

      data.autoBan === true

        ? "ENABLED"

        : data.autoBan === false

          ? "DISABLED"

          : "--"

    );

    renderRiskList(
      data.topRiskIPs
    );

    renderEvents(
      data.recentEvents
    );

    const active =
      data.status === "ACTIVE";

    setStatus(

      active ? "MONITOR" : "UNKNOWN",

      active ? "active" : "error"

    );

    setText(

      "idsUpdated",

      "Updated: " +
        formatTime(Date.now())

    );

  }


  /* ========================================
     CLEAR UNAVAILABLE DATA
  ======================================== */

  function clearStats(message) {

    for (const id of Object.keys(COUNTERS)) {

      setText(id, "--");

    }

    setText("idsMode", "--");

    setText("idsWindow", "--");

    setText("idsAutoBan", "--");

    showEmpty(
      $("idsRiskList"),
      message
    );

    showEmpty(
      $("idsEventList"),
      message
    );

  }


  /* ========================================
     FETCH IDS STATISTICS
  ======================================== */

  async function loadIDS() {

    if (
      loading ||
      document.hidden ||
      sessionExpired
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

    const controller =
      new AbortController();

    const timeout = setTimeout(

      () => controller.abort(),

      8000

    );

    try {

      const response = await socFetch(

        "/api/admin/security-ids/stats",

        {

          method: "GET",

          credentials: "same-origin",

          cache: "no-store",

          signal: controller.signal

        }

      );

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

        clearStats(
          "Admin authorization required."
        );

        setText(

          "idsUpdated",

          "Please authenticate again."

        );

        return;

      }

      const contentType =
        response.headers.get(
          "content-type"
        ) || "";

      if (
        !contentType.includes("application/json")
      ) {

        throw new Error(

          `Invalid response (HTTP ${response.status})`

        );

      }

      const data = await response.json();

      if (
        !response.ok ||
        data.ok !== true
      ) {

        throw new Error(
          data.error || "IDS_UNAVAILABLE"
        );

      }

      if (isAuthenticated && !leaving) renderStats(data);

    } catch (error) {

      setStatus(
        "UNAVAILABLE",
        "error"
      );

      clearStats(
        "Unable to verify current IDS status."
      );

      setText(

        "idsUpdated",

        "Update failed: " +
          error.message

      );

      console.warn(

        "[IDS MONITOR]",

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


  function stopAutoRefresh() {}
  detailLoaders["ids"] = async () => {  await loadIDS(); };
  refreshBtn?.addEventListener("click", refreshFirewall);
})();
checkAdminSession();
