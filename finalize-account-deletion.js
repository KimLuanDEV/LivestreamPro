#!/usr/bin/env node

"use strict";

/* ==========================================
   LIVESTREAM PRO
   FINALIZE ACCOUNT DELETION V1.0

   OFFLINE MAINTENANCE ONLY
========================================== */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");


/* ==========================================
   01. FINANCIAL SAFETY CHECK
========================================== */

function deletionBlockers(
  uid,
  users,
  withdrawals,
  market,
  payments
) {

  const account = users[uid];

  const profile = account?.profile;

  const issues = [];


  if (!profile) {

    return ["Không tìm thấy tài khoản"];

  }


  /* ========================================
     PROTECT ADMIN ACCOUNT
  ======================================== */

  if (

    account.role === "admin" ||

    account.roles?.includes("admin")

  ) {

    issues.push("Tài khoản quản trị");

  }


  /* ========================================
     CHECK DIAMOND BALANCE
  ======================================== */

  for (const [key, label] of [

    ["coins", "Kim cương sử dụng"],

    ["coinReceived", "Ví rút tiền"]

  ]) {

    const value = Number(
      profile[key] ?? 0
    );

    if (

      !Number.isSafeInteger(value) ||

      value !== 0

    ) {

      issues.push(
        label + " chưa về 0"
      );

    }

  }


  /* ========================================
     CHECK FINISHED STATUS
  ======================================== */

  const finished = (status, states) =>

    states.includes(status);


  /* ========================================
     PENDING WITHDRAWALS
  ======================================== */

  if (

    withdrawals.some(w =>

      w.uid === uid &&

      !finished(
        w.status,
        ["approved", "rejected"]
      )

    )

  ) {

    issues.push(
      "Rút tiền chưa hoàn tất"
    );

  }


  /* ========================================
     WITHDRAW HOLD
  ======================================== */

  if (

    (profile.withdrawHold || []).some(w =>

      !withdrawals.some(x =>

        x.id === w.id &&

        x.uid === uid &&

        finished(
          x.status,
          ["approved", "rejected"]
        )

      )

    )

  ) {

    issues.push(
      "Khoản giữ rút tiền cần đối soát"
    );

  }


  /* ========================================
     PENDING TRANSFERS
  ======================================== */

  if (

    Object.entries(users).some(([owner, u]) =>

      (u?.transferRequests || []).some(t =>

        (

          owner === uid ||

          t.fromUid === uid ||

          t.toUid === uid

        ) &&

        !finished(
          t.status,
          ["approved", "rejected"]
        )

      )

    )

  ) {

    issues.push(
      "Chuyển kim cương chưa hoàn tất"
    );

  }


  /* ========================================
     PAYMENT ORDERS
  ======================================== */

  if (

    Object.values(payments).some(o =>

      o?.uid === uid &&

      !finished(
        o.status,
        ["paid", "sandbox_confirmed"]
      )

    )

  ) {

    issues.push(
      "Đơn nạp tiền cần đối soát"
    );

  }


  /* ========================================
     MARKET ORDERS
  ======================================== */

  if (

    Object.values(market).some(b =>

      b &&

      (

        b.ownerUid === uid ||

        (b.orders || []).some(o =>

          o.buyerUid === uid &&

          !finished(
            o.status,
            ["done", "refunded", "cancelled"]
          )

        )

      )

    )

  ) {

    issues.push(
      "Gian hàng hoặc đơn hàng cần xử lý"
    );

  }


  /* ========================================
     SPIRIT BEAST
  ======================================== */

  if (

    (account.spiritBeasts || []).length

  ) {

    issues.push(
      "Còn linh thú cần xử lý"
    );

  }


  /* ========================================
     UNSETTLED GAME REWARDS
  ======================================== */

  if (

    account.wheel8DoubleOffer?.status ===
    "pending"

  ) {

    issues.push(
      "Thưởng chưa quyết toán"
    );

  }


  return issues;

}


/* ==========================================
   02. COMMAND LINE ARGUMENTS
========================================== */

const [

  dir,

  uid,

  requestId,

  flag,

  confirmText

] = process.argv.slice(2);


/* ==========================================
   ERROR HANDLER
========================================== */

function abort(message) {

  console.error(message);

  process.exit(1);

}


/* ==========================================
   VALIDATE COMMAND
========================================== */

if (

  !dir ||

  !uid ||

  !requestId ||

  flag !== "--offline-cleanup-verified" ||

  confirmText !== "DELETE " + uid

) {

  abort(

    'Usage: node finalize-account-deletion.js ' +

    'DATA_DIR UID REQUEST_ID ' +

    '--offline-cleanup-verified "DELETE UID"'

  );

}


/* ==========================================
   03. DATABASE PATHS
========================================== */

const userFile = path.join(

  dir,

  "users.json"

);


const requestFile = path.join(

  dir,

  "account-deletion-requests",

  crypto

    .createHash("sha256")

    .update(uid)

    .digest("hex") + ".json"

);


/* ==========================================
   04. READ JSON DATABASE
========================================== */

function read(file, fallback) {

  try {

    return JSON.parse(

      fs.readFileSync(

        file,

        "utf8"

      )

    );

  } catch (error) {

    if (

      error.code === "ENOENT" &&

      fallback !== undefined

    ) {

      return fallback;

    }

    throw error;

  }

}


/* ==========================================
   05. ATOMIC DATABASE WRITE
========================================== */

function write(file, data) {

  const temp =

    file +

    "." +

    crypto.randomUUID() +

    ".tmp";


  let fd;


  try {

    fd = fs.openSync(

      temp,

      "wx",

      0o600

    );


    fs.writeFileSync(

      fd,

      JSON.stringify(data, null, 2),

      "utf8"

    );


    fs.fsyncSync(fd);


    fs.closeSync(fd);

    fd = undefined;


    fs.renameSync(

      temp,

      file

    );


  } finally {

    if (fd !== undefined) {

      try {

        fs.closeSync(fd);

      } catch {}

    }


    try {

      fs.unlinkSync(temp);

    } catch {}

  }

}


/* ==========================================
   06. EXECUTE ACCOUNT DELETION
========================================== */

try {


  /* ========================================
     LOAD DATABASE
  ======================================== */

  const item = read(requestFile);

  const users = read(userFile);


  /* ========================================
     VERIFY DELETION REQUEST
  ======================================== */

  if (

    item.uid !== uid ||

    item.requestId !== requestId ||

    item.stage !== "ready" ||

    item.status !== "pending"

  ) {

    abort(

      "Request not ready or does not match."

    );

  }


  /* ========================================
     VERIFY USER DATABASE
  ======================================== */

  if (

    !users ||

    typeof users !== "object" ||

    Array.isArray(users)

  ) {

    abort(

      "Invalid user database."

    );

  }


  /* ========================================
     CHECK ACCOUNT EXISTS
  ======================================== */

  if (Object.hasOwn(users, uid)) {


    /* ======================================
       ACCOUNT MUST BE LOCKED
    ====================================== */

    if (

      !users[uid]?.profile?.accountBlocked

    ) {

      abort(

        "Account is not locked."

      );

    }


    /* ======================================
       FINAL FINANCIAL CHECK
    ====================================== */

    const blockers = deletionBlockers(

      uid,

      users,

      read(

        path.join(
          dir,
          "withdraw_requests.json"
        ),

        []

      ),

      read(

        path.join(
          dir,
          "market_booths.json"
        ),

        {}

      ),

      read(

        path.join(
          dir,
          "lsp_pg_orders.json"
        ),

        {}

      )

    );


    if (blockers.length) {

      abort(

        blockers.join("; ")

      );

    }


    /* ======================================
       DELETE CORE ACCOUNT
    ====================================== */

    delete users[uid];


    /* ======================================
       REMOVE SOCIAL RELATIONSHIPS
    ====================================== */

    for (const user of Object.values(users)) {

      for (const key of [

        "friends",

        "friendRequests",

        "blockedUsers"

      ]) {

        if (

          Array.isArray(
            user?.profile?.[key]
          )

        ) {

          user.profile[key] =

            user.profile[key].filter(

              value => value !== uid

            );

        }

      }

    }


    /* ======================================
       SAVE USERS DATABASE
    ====================================== */

    write(

      userFile,

      users

    );

  }


  /* ========================================
     07. MARK REQUEST COMPLETED

     Remaining data cleanup must have
     been verified by the operator.
  ======================================== */

  write(

    requestFile,

    {

      ...item,

      status: "completed",

      stage: "completed",

      completedAt:
        new Date().toISOString(),

      updatedAt:
        new Date().toISOString(),

      updatedBy:
        "offline-maintenance"

    }

  );


  console.log(

    "==================================="

  );

  console.log(

    "[ACCOUNT DELETION] COMPLETED"

  );

  console.log(

    "UID:", uid

  );

  console.log(

    "Request ID:", requestId

  );

  console.log(

    "Core account removed."

  );

  console.log(

    "External cleanup attested by operator."

  );

  console.log(

    "==================================="

  );


} catch (error) {

  abort(

    "Finalization failed: " +

    error.message

  );

}