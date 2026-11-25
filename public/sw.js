/* ==========================================
   LIVESTREAM PRO
   SECURE PUSH SERVICE WORKER V2.0
========================================== */

self.addEventListener("install", event => {

  event.waitUntil(self.skipWaiting());

});

self.addEventListener("activate", event => {

  event.waitUntil(self.clients.claim());

});


/* ==========================================
   VERIFY CURRENT ACCOUNT
========================================== */

async function getCurrentPushAccount() {

  try {

    const response = await fetch(
      "/api/push-current-account",
      {
        method: "GET",
        credentials: "include",
        cache: "no-store"
      }
    );

    if (!response.ok) return null;

    const result = await response.json();

    if (!result.ok || !result.uid) return null;

    return String(result.uid);

  } catch (error) {

    return null;

  }

}


/* ==========================================
   SECURE PUSH NOTIFICATION
========================================== */

self.addEventListener("push", event => {

  event.waitUntil((async () => {

    if (!event.data) return;

    let data;

    try {

      data = event.data.json();

    } catch {

      return;

    }

    const targetUid = String(
      data.targetUid || ""
    );

    // Reject notifications without account identity
    if (!targetUid) return;

    const currentUid =
      await getCurrentPushAccount();

    // Reject notifications from previous accounts
    if (
      !currentUid ||
      currentUid !== targetUid
    ) {

      console.log(
        "[PUSH] Account mismatch - ignored"
      );

      return;

    }

    const title =
      data.title || "Livestream Pro";

    const options = {

      body: data.body || "",

      icon: "/icons/icon-192.png",

      badge: "/icons/icon-192.png",

      data: {

        targetUid,

        url: data.url || "/messages.html",

        type: data.data?.type || null,

        fromUid: data.data?.fromUid || null

      }

    };

    await self.registration.showNotification(
      title,
      options
    );

  })());

});


/* ==========================================
   SECURE NOTIFICATION CLICK
========================================== */

self.addEventListener(
  "notificationclick",
  event => {

    event.notification.close();

    event.waitUntil((async () => {

      const {
        targetUid,
        url,
        type,
        fromUid
      } = event.notification.data || {};

      const currentUid =
        await getCurrentPushAccount();

      // Prevent opening notifications of old accounts
      if (
        !currentUid ||
        currentUid !== targetUid
      ) {
        return;
      }

      const clientList =
        await self.clients.matchAll({

          type: "window",

          includeUncontrolled: true

        });

      if (type === "chat" && fromUid) {

        for (const client of clientList) {

          if (client.url.includes("/messages")) {

            await client.focus();

            client.postMessage({

              type: "open-chat",

              fromUid

            });

            return;

          }

        }

        return self.clients.openWindow(
          `/messages.html?openChat=${encodeURIComponent(fromUid)}`
        );

      }

      const destination = new URL(
        url || "/messages.html",
        self.location.origin
      );

      if (
        destination.origin !==
        self.location.origin
      ) {
        return;
      }

      return self.clients.openWindow(
        destination.href
      );

    })());

  }
);