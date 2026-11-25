/* ==========================================
   LIVESTREAM PRO
   SINGLE ACCOUNT PUSH NOTIFICATION V2.0
========================================== */

(function () {

  let pushSyncTask = null;
  let pushLoggingOut = false;

  async function syncCurrentPush() {

    if (pushLoggingOut) return;

    if (pushSyncTask) return pushSyncTask;

    pushSyncTask = (async () => {

      try {

        if (
          !("serviceWorker" in navigator) ||
          !("PushManager" in window) ||
          !("Notification" in window)
        ) {
          return;
        }

        const auth = JSON.parse(
          localStorage.getItem("user_profile") || "{}"
        );

        if (!auth?.uid) return;

        /* ======================================
           VERIFY AUTHENTICATED ACCOUNT
        ====================================== */

        const accountResponse = await fetch(
          "/api/push-current-account",
          {
            credentials: "same-origin",
            cache: "no-store"
          }
        );

        if (!accountResponse.ok) return;

        const account =
          await accountResponse.json();

        if (
          !account.ok ||
          String(account.uid) !== String(auth.uid)
        ) {
          return;
        }

        /* ======================================
           SERVICE WORKER
        ====================================== */

        const reg =
          await navigator.serviceWorker.getRegistration()
          || await navigator.serviceWorker.register("/sw.js");

        await navigator.serviceWorker.ready;

        let sub =
          await reg.pushManager.getSubscription();

        /* ======================================
           CREATE SUBSCRIPTION IF REQUIRED
        ====================================== */

        if (!sub) {

          let permission = Notification.permission;

          if (permission === "default") {

            permission =
              await Notification.requestPermission();

          }

          if (permission !== "granted") return;

          if (pushLoggingOut) return;

          sub = await reg.pushManager.subscribe({

            userVisibleOnly: true,

            applicationServerKey:
              "BPG9kTxtU0Fso5VZqUFhqn_ZZLvTeKM32km3pLDnH2UCdKce-owuTMZ5PLzrKyrw_patHMVavHdDM4axJ7L9N7E"

          });

        }

        /* ======================================
           REGISTER CURRENT ACCOUNT ONLY
        ====================================== */

        const currentAuth = JSON.parse(
          localStorage.getItem("user_profile") || "{}"
        );

        if (
          pushLoggingOut ||
          String(currentAuth.uid) !== String(auth.uid)
        ) {
          return;
        }

        const response = await fetch(
          "/api/push-subscribe",
          {

            method: "POST",

            credentials: "same-origin",

            cache: "no-store",

            headers: {
              "Content-Type": "application/json"
            },

            body: JSON.stringify({
              sub: sub.toJSON()
            })

          }
        );

        if (!response.ok) {

          throw new Error(
            "PUSH_REGISTER_FAILED"
          );

        }

        const result = await response.json();

        if (!result.ok) {

          throw new Error(
            "PUSH_REGISTER_REJECTED"
          );

        }

        console.log(
          "[PUSH] Active account:",
          account.uid
        );

      } catch (error) {

        console.warn(
          "[PUSH] Initialization failed:",
          error
        );

      }

    })();

    try {

      await pushSyncTask;

    } finally {

      pushSyncTask = null;

    }

  }


  /* ==========================================
     CLEANUP PUSH ON THIS DEVICE
  ========================================== */

  async function cleanupCurrentPush() {

    pushLoggingOut = true;

    if (!("serviceWorker" in navigator)) {
      return;
    }

    const reg =
      await navigator.serviceWorker.getRegistration();

    if (!reg) return;

    const sub =
      await reg.pushManager.getSubscription();

    if (sub) {

      try {

        await sub.unsubscribe();

      } catch (error) {

        console.warn(
          "[PUSH] Unsubscribe failed:",
          error
        );

      }

    }

    const notifications =
      await reg.getNotifications();

    notifications.forEach(
      notification => notification.close()
    );

    console.log(
      "[PUSH] Current device cleaned"
    );

  }


  /* ==========================================
     GLOBAL PUSH API
  ========================================== */

  window.LSPPush = {

    sync: syncCurrentPush,

    cleanup: cleanupCurrentPush

  };


  // Đồng bộ khi tải trang
  syncCurrentPush();


  // Đồng bộ khi quay lại trang
  window.addEventListener("pageshow", event => {

    if (event.persisted) {

      syncCurrentPush();

    }

  });


  // Đồng bộ khi thiết bị có mạng trở lại
  window.addEventListener(
    "online",
    syncCurrentPush
  );

})();