
/* ==========================================
   LIVESTREAM PRO
   APP ENTRY GUARD
   INDEX FIRST ON NEW SESSION
========================================== */

(function () {
  "use strict";

  const INDEX = "/index.html";
  const LOGIN = "/login.html";

  const ENTRY_KEY = "lsp_app_entry_seen";

  const path = location.pathname.toLowerCase();

  const isIndex =
    path === "/" ||
    path === "/index.html";

  const PUBLIC_PAGES = new Set([
    "/",
    "/index.html",
    "/login.html",
    "/register.html"
  ]);

  /* ======================================
     FIRST ENTRY IN CURRENT SESSION
  ====================================== */

  let hasEntered = false;

  try {
    hasEntered =
      sessionStorage.getItem(ENTRY_KEY) === "1";

    if (!hasEntered) {
      sessionStorage.setItem(ENTRY_KEY, "1");
    }
  } catch (error) {
    // Storage may be unavailable in some contexts.
  }

  // Lần đầu vào phiên mới:
  // buộc mở trang giới thiệu trước.
  if (!hasEntered && !isIndex) {
    location.replace(INDEX);
    return;
  }

  /* ======================================
     PUBLIC PAGES
  ====================================== */

  if (PUBLIC_PAGES.has(path)) {
    return;
  }

  /* ======================================
     LOGIN CHECK
  ====================================== */

  let profile = null;

  try {
    profile = JSON.parse(
      localStorage.getItem("user_profile") || "null"
    );
  } catch (error) {
    profile = null;
  }

  const uid = String(profile?.uid || "").trim();

  const hasLocalProfile =
    Boolean(uid) &&
    !uid.toLowerCase().startsWith("guest");

  // Chưa có hồ sơ đăng nhập.
  if (!hasLocalProfile) {
    location.replace(LOGIN);
    return;
  }

  // Đã vào ứng dụng và có hồ sơ:
  // giữ nguyên trang đang truy cập.
})();
