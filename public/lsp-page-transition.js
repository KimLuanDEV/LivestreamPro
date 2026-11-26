
/* ==========================================
   LIVESTREAM PRO
   GLOBAL PAGE TRANSITION
========================================== */

(() => {
  "use strict";

  if (window.LSPTransition) return;

  const KEY = "lsp-transition-target-v3";

  // Thời gian chuyển trang
  // Thời gian màn chuyển cảnh đi vào và rời đi
const EXIT_MS = 220;
const ENTRY_MS = 280;

  const reduceMotion = !!window.matchMedia?.(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  let layer = null;
  let navigating = false;

  /* ======================================
     KIỂM TRA TRANG VỪA CHUYỂN ĐẾN
  ====================================== */

  let arriving = false;

  try {
    const saved = JSON.parse(
      sessionStorage.getItem(KEY) || "null"
    );

    sessionStorage.removeItem(KEY);

    arriving = !!saved &&
      saved.path ===
        location.pathname + location.search &&
      Date.now() - saved.time >= 0 &&
      Date.now() - saved.time < 90000;

  } catch (_) {}

  if (arriving) {
    document.documentElement.classList.add(
      "lsppt-arriving"
    );
  }

  /* ======================================
     CSS GIAO DIỆN CHUYỂN TRANG
  ====================================== */

  const style = document.createElement("style");


/* ==========================================
   LIVESTREAM PRO
   CINEMATIC LUXURY PAGE TRANSITION
========================================== */

/* ==========================================
   LIVESTREAM PRO
   CHAMPAGNE GOLD PAGE TRANSITION V1.0
========================================== */

style.textContent = `

/* ==========================================
   01. PREVENT DARK SCREEN FLASH
========================================== */

html.lsppt-arriving::before {
  content: "";

  position: fixed;
  inset: 0;

  z-index: 2147483646;

  background: #FAF6E9;

  pointer-events: auto;
}


/* ==========================================
   02. GLOBAL TRANSITION LAYER
========================================== */

#lsppt-layer,
#lsppt-layer *,
#lsppt-layer *::before,
#lsppt-layer *::after {
  box-sizing: border-box;
}

#lsppt-layer {

  --pt-bg: #FAF6E9;
  --pt-white: #FFFFFF;
  --pt-gold: #947025;
  --pt-line: #EAE0C8;
  --pt-muted: #857960;

  position: fixed;
  inset: 0;

  z-index: 2147483647;

  display: flex;
  align-items: center;
  justify-content: center;

  padding: 24px;

  overflow: hidden;
  isolation: isolate;

  background:
    radial-gradient(
      ellipse at 50% 28%,
      #F3E2B5 0%,
      transparent 52%
    ),
    linear-gradient(
      180deg,
      #FFFDF7 0%,
      #FAF6E9 75%
    );

  color: #29251D;

visibility: hidden;
pointer-events: none;

opacity: 0;
transform: none;

transition:
  opacity ${EXIT_MS}ms ease,
  visibility 0s linear ${EXIT_MS}ms;
}


/* ==========================================
   03. SMOOTH FADE TRANSITION V2.0
========================================== */

/* FADE IN */

#lsppt-layer.lsppt-open {
  visibility: visible;
  pointer-events: auto;

  opacity: 1;
  transform: none;

  transition:
    opacity ${EXIT_MS}ms ease;
}


/* FADE OUT */

#lsppt-layer.lsppt-close {
  visibility: visible;
  pointer-events: auto;

  opacity: 0;
  transform: none;

  transition:
    opacity ${ENTRY_MS}ms ease;
}


/* ARRIVING PAGE */

html.lsppt-arriving #lsppt-layer {
  visibility: visible;
  pointer-events: auto;

  opacity: 1;
  transform: none;

  transition: none;
}


/* ==========================================
   04. CENTER CONTENT
========================================== */

#lsppt-layer .lsppt-card {
  position: relative;

  z-index: 1;

  width: min(100%,380px);

  margin: 0;
  padding: 16px;

  display: flex;
  flex-direction: column;

  align-items: center;
  justify-content: center;

  text-align: center;

  background: transparent;
  border: none;
  box-shadow: none;

  font-family:
    system-ui,
    -apple-system,
    "Segoe UI",
    sans-serif;

opacity: 1;
transform: none;
transition: none;
}




/* ==========================================
   05. BRAND LOGO
========================================== */

#lsppt-layer .lsppt-logo {
  position: relative;

  width: 106px;
  height: 106px;

  margin: 0 0 22px;
  padding: 0;

  display: grid;
  place-items: center;

  background: transparent;

  border: none;
  border-radius: 24px;
}

#lsppt-layer .lsppt-logo-img {
  display: block;

  width: 100%;
  height: 100%;

  margin: 0;
  padding: 0;

  object-fit: contain;
  object-position: center;

  border: none;
  border-radius: 24px;

  background: transparent;

  filter:
    drop-shadow(0 8px 14px rgba(148,112,37,.12));

  user-select: none;
  -webkit-user-drag: none;

animation: none;
}


/* ==========================================
   06. BRAND TITLE
========================================== */

#lsppt-layer .lsppt-title {
  margin: 0;

  color: #70531D;

  font-family:
    Georgia,
    "Times New Roman",
    serif;

  font-size: clamp(20px,6vw,27px);
  font-weight: 700;

  line-height: 1.3;
  letter-spacing: 1px;

  white-space: normal;
  overflow-wrap: anywhere;
}


/* Bỏ dòng LOADING bị trùng */

#lsppt-layer .lsppt-sub {
  display: none;
}


/* ==========================================
   07. LOADING PROGRESS
========================================== */

#lsppt-layer .lsppt-track {
  width: min(150px,60vw);
  height: 3px;

  margin-top: 25px;

  overflow: hidden;

  border: none;
  border-radius: 20px;

  background: #EAE0C8;
}

#lsppt-layer .lsppt-bar {
  width: 40%;
  height: 100%;

  border-radius: inherit;

  background:
    linear-gradient(
      90deg,
      #D2AB55,
      #EED69A,
      #B58E3E
    );

  animation:
    lsppt-flow 1s ease-in-out infinite;
}


/* ==========================================
   08. STATUS TEXT
========================================== */

#lsppt-layer .lsppt-text {
  max-width: 100%;

  margin: 13px 0 0;

  color: var(--pt-muted);

  font-size: 12px;
  font-weight: 500;

  line-height: 1.5;
  letter-spacing: .2px;

  text-align: center;
  overflow-wrap: anywhere;
}


/* ==========================================
   09. ANIMATIONS
========================================== */

@keyframes lsppt-logo-float {

  0%, 100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-4px);
  }

}

@keyframes lsppt-flow {

  from {
    transform: translateX(-110%);
  }

  to {
    transform: translateX(260%);
  }

}


/* ==========================================
   10. MOBILE RESPONSIVE
========================================== */

@media (max-width: 480px) {

  #lsppt-layer .lsppt-logo {
    width: 92px;
    height: 92px;

    margin-bottom: 18px;
  }

  #lsppt-layer .lsppt-title {
    font-size: 23px;
    letter-spacing: .7px;
  }

  #lsppt-layer .lsppt-track {
    width: 135px;
    margin-top: 22px;
  }

  #lsppt-layer .lsppt-text {
    font-size: 11px;
  }

}

@media (max-height: 400px) {

  #lsppt-layer .lsppt-logo {
    width: 64px;
    height: 64px;

    margin-bottom: 12px;
  }

  #lsppt-layer .lsppt-track {
    margin-top: 15px;
  }

}


/* ==========================================
   11. REDUCED MOTION
========================================== */

@media (prefers-reduced-motion: reduce) {

  #lsppt-layer,
  #lsppt-layer *,
  #lsppt-layer *::before,
  #lsppt-layer *::after {

    animation: none !important;
    transition: none !important;

  }

}

`;

  document.head.appendChild(style);

  /* ======================================
     TẠO HOẠT CẢNH
  ====================================== */

  function getLayer() {

    if (layer) return layer;

    if (!document.body) return null;

    layer = document.createElement("div");

    layer.id = "lsppt-layer";

    layer.setAttribute(
      "role",
      "status"
    );

    layer.setAttribute(
      "aria-label",
      "Loading"
    );

layer.innerHTML = `

  <div class="lsppt-card">

    <div class="lsppt-logo">

      <img
        src="/icons/icon-512.png?v=20261126"
        alt="Livestream Pro"
        class="lsppt-logo-img"
        draggable="false"
      >

    </div>

    <div class="lsppt-title">
      LIVESTREAM PRO
    </div>

    <div class="lsppt-track"
         aria-hidden="true">

      <div class="lsppt-bar"></div>

    </div>

    <div class="lsppt-text">
      Loading...
    </div>

  </div>

`;



    document.body.appendChild(layer);

    return layer;
  }

  /* ======================================
     KIỂM TRA ĐƯỜNG DẪN NỘI BỘ
  ====================================== */

  function isInternalPage(url) {

    if (!/^https?:$/.test(url.protocol)) {
      return false;
    }

    if (url.origin !== location.origin) {
      return false;
    }

    if (url.pathname.startsWith("/api/")) {
      return false;
    }

    const ext = url.pathname.match(
      /\.([a-z0-9]{1,8})$/i
    )?.[1];

    return !ext || /^(html?|php)$/i.test(ext);
  }

  /* ======================================
     HÀM CHUYỂN TRANG CHÍNH
  ====================================== */

  function go(address, options = {}) {

    let url;

    try {
      url = new URL(address, location.href);
    } catch (_) {
      return false;
    }

    if (!/^https?:$/.test(url.protocol)) {
      return false;
    }

    // Đường dẫn ngoài ứng dụng
    if (!isInternalPage(url)) {

      if (options.replace) {
        location.replace(url.href);
      } else {
        location.assign(url.href);
      }

      return true;
    }

    // Link cùng trang
    if (
      url.pathname + url.search ===
      location.pathname + location.search
    ) {

      if (url.href !== location.href) {
        location.assign(url.href);
      }

      return false;
    }

    // Ngăn bấm nhiều lần
    if (navigating) return false;

    navigating = true;

    const el = getLayer();

    if (!el) {

      navigating = false;
      location.assign(url.href);

      return true;
    }

    // Nội dung trạng thái
    el.querySelector(
      ".lsppt-text"
    ).textContent =
      options.label || "Loading...";

    el.classList.remove("lsppt-close");
    el.classList.add("lsppt-open");

    // Chờ hoạt cảnh phủ trang cũ
    setTimeout(() => {

      try {

        sessionStorage.setItem(
          KEY,
          JSON.stringify({
            path: url.pathname + url.search,
            time: Date.now()
          })
        );

      } catch (_) {}

      if (options.replace) {
        location.replace(url.href);
      } else {
        location.assign(url.href);
      }

    }, reduceMotion ? 0 : EXIT_MS);

    return true;
  }

  /* ======================================
     NHẬN DIỆN ONCLICK ĐIỀU HƯỚNG
  ====================================== */

  function inlineNav(code) {

    if (!code) return null;

    let match = code.match(
      /^\s*(?:window\.)?location(?:\.href)?\s*=\s*(['"])([^'"\r\n]+)\1\s*;?\s*$/
    );

    if (match) {
      return {
        href: match[2]
      };
    }

    match = code.match(
      /^\s*(?:window\.)?location\.(assign|replace)\(\s*(['"])([^'"\r\n]+)\2\s*\)\s*;?\s*$/
    );

    if (match) {
      return {
        href: match[3],
        replace: match[1] === "replace"
      };
    }

    return null;
  }

  /* ======================================
     BẮT CLICK CHUYỂN TRANG TỰ ĐỘNG
  ====================================== */

  window.addEventListener(
    "click",
    event => {

      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      ) return;

      const target =
        event.target instanceof Element
          ? event.target
          : null;

      if (
        !target ||
        target.closest(
          "[data-lsp-no-transition]"
        )
      ) return;

      const el = target.closest(
        "[data-lsp-href],a[href],[onclick]"
      );

      if (!el) return;

      let nav = null;

      // Nút có data-lsp-href
      if (el.hasAttribute("data-lsp-href")) {

        nav = {
          href: el.getAttribute(
            "data-lsp-href"
          ),
          replace: el.hasAttribute(
            "data-lsp-replace"
          ),
          label: el.getAttribute(
            "data-lsp-label"
          )
        };

      }

      // Thẻ liên kết
      else if (el.matches("a[href]")) {

        if (
          el.hasAttribute("download") ||
          (el.target && el.target !== "_self") ||
          el.relList?.contains("external")
        ) return;

        const onclick =
          el.getAttribute("onclick");

        nav = onclick
          ? inlineNav(onclick)
          : {
              href: el.getAttribute("href")
            };

      }

      // Nút onclick chuyển trang trực tiếp
      else {

        nav = inlineNav(
          el.getAttribute("onclick")
        );

      }

      if (!nav?.href) return;

      let url;

      try {
        url = new URL(
          nav.href,
          location.href
        );
      } catch (_) {
        return;
      }

      if (!isInternalPage(url)) return;

      if (
        url.pathname + url.search ===
        location.pathname + location.search
      ) return;

      // Chặn chuyển tức thì
      event.preventDefault();
      event.stopImmediatePropagation();

      // Chạy hoạt cảnh
      go(url.href, nav);

    },
    true
  );

  /* ======================================
     HỖ TRỢ PHÍM ENTER
  ====================================== */

  window.addEventListener(
    "keydown",
    event => {

      if (
        event.key !== "Enter" &&
        event.key !== " "
      ) return;

      const target =
        event.target instanceof Element
          ? event.target
          : null;

      const el = target?.closest(
        "[data-lsp-href]"
      );

      if (
        !el ||
        el.matches("button,a,input") ||
        el.hasAttribute(
          "data-lsp-no-transition"
        )
      ) return;

      if (
        event.key === " " &&
        el.getAttribute("role") !== "link"
      ) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      go(el.getAttribute("data-lsp-href"), {
        label: el.getAttribute(
          "data-lsp-label"
        ),
        replace: el.hasAttribute(
          "data-lsp-replace"
        )
      });

    },
    true
  );

/* ==========================================
   SMOOTH PAGE ARRIVAL V2.0
========================================== */

function onPageReady() {

  const el = getLayer();

  if (!arriving || !el) return;

  el.classList.remove("lsppt-close");
  el.classList.add("lsppt-open");

  // Xác lập trạng thái hiển thị ban đầu
  void el.offsetHeight;

  requestAnimationFrame(() => {

    requestAnimationFrame(() => {

      document.documentElement.classList.remove(
        "lsppt-arriving"
      );

      el.classList.add("lsppt-close");
      el.classList.remove("lsppt-open");

      setTimeout(() => {

        el.classList.remove("lsppt-close");

        arriving = false;

      }, reduceMotion ? 0 : ENTRY_MS + 40);

    });

  });

}

  if (document.readyState === "loading") {

    document.addEventListener(
      "DOMContentLoaded",
      onPageReady,
      { once: true }
    );

  } else {

    onPageReady();

  }

  /* ======================================
     KHÔI PHỤC KHI BACK / FORWARD
  ====================================== */

  window.addEventListener(
    "pageshow",
    event => {

      if (!event.persisted) return;

      navigating = false;

      document.documentElement.classList.remove(
        "lsppt-arriving"
      );

      layer?.classList.remove(
        "lsppt-open",
        "lsppt-close"
      );

    }
  );

  /* ======================================
     HÀM DÙNG CHUNG TOÀN ỨNG DỤNG
  ====================================== */

  window.LSPTransition = Object.freeze({
    go
  });

})();
