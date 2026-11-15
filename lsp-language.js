
/* ==========================================
   LIVESTREAM PRO
   GLOBAL APPLICATION LANGUAGE
   ENGLISH / VIETNAMESE
========================================== */

(function () {
  "use strict";

  const KEY = "lsp_app_language";
  const SUPPORTED = ["en", "vi"];

  // English -> Vietnamese.
  // Add new UI phrases here as pages are localized.
  const dictionary = {
    "Account Settings": "Cài đặt tài khoản",
    "Account & Security": "Tài khoản & bảo mật",
    "ACCOUNT & SECURITY": "TÀI KHOẢN & BẢO MẬT",
    "App Preferences": "Tùy chọn ứng dụng",
    "APP PREFERENCES": "TÙY CHỌN ỨNG DỤNG",
    "App Language": "Ngôn ngữ ứng dụng",
    "Choose Language": "Chọn ngôn ngữ",
    "Choose your preferred language":
      "Chọn ngôn ngữ bạn muốn sử dụng",
    "Manage your account and preferences":
      "Quản lý tài khoản và tùy chọn",
    "Withdraw": "Rút tiền",
    "Manage withdrawals": "Quản lý yêu cầu rút tiền",
    "Change Password": "Đổi mật khẩu",
    "Update account security":
      "Cập nhật bảo mật tài khoản",
    "Sign Out": "Đăng xuất",
    "Log Out": "Đăng xuất",
    "Logout": "Đăng xuất",
    "End your current session":
      "Kết thúc phiên đăng nhập hiện tại",
    "Close Settings": "Đóng cài đặt",

    "Home": "Trang chủ",
    "Profile": "Hồ sơ",
    "Social": "Cộng đồng",
    "Messages": "Tin nhắn",
    "Friends": "Bạn bè",
    "Settings": "Cài đặt",
    "Notifications": "Thông báo",
    "Market": "Cửa hàng",
    "Games": "Trò chơi",
    "Live": "Trực tiếp",
    "LIVE": "TRỰC TIẾP",
    "Lobby": "Sảnh chính",

    "Sign In": "Đăng nhập",
    "SIGN IN": "ĐĂNG NHẬP",
    "Register": "Đăng ký",
    "JOIN NOW": "THAM GIA NGAY",
    "Create Account": "Tạo tài khoản",
    "CREATE ACCOUNT": "TẠO TÀI KHOẢN",
    "Continue": "Tiếp tục",
    "Cancel": "Hủy",
    "Close": "Đóng",
    "Save": "Lưu",
    "Save Changes": "Lưu thay đổi",
    "Confirm": "Xác nhận",
    "Delete": "Xóa",
    "Edit": "Chỉnh sửa",
    "Search": "Tìm kiếm",
    "Back": "Quay lại",
    "Done": "Hoàn tất",
    "Loading...": "Đang tải...",
    "Retry": "Thử lại",

    "Post": "Đăng bài",
    "Create Post": "Tạo bài viết",
    "Write a comment...": "Viết bình luận...",
    "Write a reply...": "Viết câu trả lời...",
    "Like": "Thích",
    "Comment": "Bình luận",
    "Share": "Chia sẻ",
    "Send": "Gửi",
    "Follow": "Theo dõi",
    "Unfollow": "Bỏ theo dõi",
    "Add Friend": "Kết bạn",
    "Unfriend": "Hủy kết bạn",
    "Block": "Chặn",
    "Unblock": "Bỏ chặn",

    "Daily Social Mission": "Nhiệm vụ Social hằng ngày",
    "Publish one post on Social every day and earn 100 Diamonds.":
      "Đăng một bài viết trên Social mỗi ngày để nhận 100 kim cương.",
    "Daily mission completed! +100 Diamonds":
      "Hoàn thành nhiệm vụ hằng ngày! +100 kim cương",
    "DIAMONDS": "KIM CƯƠNG",
    "Diamonds": "Kim cương",
    "Balance": "Số dư"
  };

  const excludedSelector = [
    "script",
    "style",
    "noscript",
    "code",
    "pre",
    "textarea",
    "[contenteditable]",
    "[data-lsp-no-translate]",
    ".lp-post-text",
    ".lp-cm-text",
    ".lp-reply-text",
    ".chat-bubble",
    ".chat-line",
    ".message-text",
    ".user-message",
    ".username",
    ".lp-post-name",
    ".lp-cm-name"
  ].join(",");

  function currentLanguage() {
    try {
      return localStorage.getItem(KEY) === "vi"
        ? "vi"
        : "en";
    } catch {
      return "en";
    }
  }

  function addTranslations(entries) {
    if (!entries || typeof entries !== "object") {
      return;
    }

    for (const [english, vietnamese] of
      Object.entries(entries)) {

      if (
        typeof english === "string" &&
        typeof vietnamese === "string"
      ) {
        dictionary[english] = vietnamese;
      }
    }

    translatePage();
  }

  function translateValue(value, language) {
    if (typeof value !== "string") return value;

    const clean = value.trim();
    if (!clean) return value;

    let english = clean;

    if (!Object.hasOwn(dictionary, english)) {
      english = Object.keys(dictionary).find(
        key => dictionary[key] === clean
      );
    }

    if (!english) return value;

    const translated = language === "vi"
      ? dictionary[english]
      : english;

    if (!translated) return value;

    return value.replace(
      clean,
      translated
    );
  }

  function isExcluded(element) {
    return !!element?.closest?.(
      excludedSelector
    );
  }

  function translateTextNode(node, language) {
    if (
      !node ||
      node.nodeType !== Node.TEXT_NODE ||
      isExcluded(node.parentElement)
    ) {
      return;
    }

    const translated = translateValue(
      node.nodeValue,
      language
    );

    if (translated !== node.nodeValue) {
      node.nodeValue = translated;
    }
  }

  function translateElement(element, language) {
    if (
      !element ||
      element.nodeType !== Node.ELEMENT_NODE ||
      isExcluded(element)
    ) {
      return;
    }

    for (const attribute of [
      "placeholder",
      "title",
      "aria-label",
      "alt"
    ]) {
      if (!element.hasAttribute(attribute)) continue;

      const original = element.getAttribute(attribute);
      const translated = translateValue(
        original,
        language
      );

      if (translated !== original) {
        element.setAttribute(
          attribute,
          translated
        );
      }
    }

    if (
      element.matches(
        'input[type="button"], input[type="submit"]'
      )
    ) {
      const original = element.value;
      const translated = translateValue(
        original,
        language
      );

      if (translated !== original) {
        element.value = translated;
      }
    }
  }

  function translateTree(root, language) {
    if (!root) return;

    if (root.nodeType === Node.TEXT_NODE) {
      translateTextNode(root, language);
      return;
    }

    if (root.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    if (isExcluded(root)) return;

    translateElement(root, language);

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_ELEMENT |
      NodeFilter.SHOW_TEXT
    );

    let node;

    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) {
        translateTextNode(node, language);
      } else {
        translateElement(node, language);
      }
    }
  }

  function translatePage() {
    const language = currentLanguage();

    document.documentElement.lang = language;

    if (document.body) {
      translateTree(document.body, language);
    }

    document.querySelectorAll(
      "[data-lsp-language-current]"
    ).forEach(element => {
      element.textContent =
        language === "vi" ? "Tiếng Việt" : "English";
    });
  }

  function setLanguage(language) {
    if (!SUPPORTED.includes(language)) return;

    try {
      localStorage.setItem(KEY, language);
    } catch {
      return;
    }

    window.dispatchEvent(
      new CustomEvent("lsp-language-change", {
        detail: { language }
      })
    );

    translatePage();
  }

  let observer;

  function initialize() {
    translatePage();

    if (observer) return;

    observer = new MutationObserver(records => {
      const language = currentLanguage();

      for (const record of records) {
        if (record.type === "characterData") {
          translateTextNode(record.target, language);
        }

        if (record.type === "attributes") {
          translateElement(record.target, language);
        }

        if (record.type === "childList") {
          record.addedNodes.forEach(node => {
            translateTree(node, language);
          });
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        "placeholder",
        "title",
        "aria-label",
        "alt"
      ]
    });
  }

  window.LSPLanguage = {
    get: currentLanguage,
    set: setLanguage,
    refresh: translatePage,
    addTranslations
  };

  window.addEventListener("storage", event => {
    if (event.key === KEY) {
      translatePage();
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }

})();
