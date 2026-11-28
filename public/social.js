const socket = io({
  transports: ["polling", "websocket"], // ✅ cho phép fallback
  upgrade: true                          // ✅ cho upgrade
});


const feed = document.getElementById("lpFeed");
const auth = JSON.parse(localStorage.getItem("user_profile") || "{}");




/* ==========================================
   POST GIFTS - PREMIUM IMAGE COLLECTION
========================================== */

const POST_GIFTS = [

  {
    id: "rose",
    image: "/assets/social/gifts/rose.webp",
    coin: 10
  },

  {
    id: "beer",
    image: "/assets/social/gifts/beer.webp",
    coin: 20
  },

  {
    id: "cake",
    image: "/assets/social/gifts/cake.webp",
    coin: 50
  },

  {
    id: "diamond",
    image: "/assets/social/gifts/diamond.webp",
    coin: 100
  },

  {
    id: "rocket",
    image: "/assets/social/gifts/rocket.webp",
    coin: 200
  },

  {
    id: "crown",
    image: "/assets/social/gifts/crown.webp",
    coin: 500
  },

  {
    id: "car",
    image: "/assets/social/gifts/car.webp",
    coin: 1000
  },

  {
    id: "castle",
    image: "/assets/social/gifts/castle.webp",
    coin: 2000
  },

  {
    id: "sword",
    image: "/assets/social/gifts/sword.webp",
    coin: 5000
  },

  {
    id: "phoenix",
    image: "/assets/social/gifts/phoenix.webp",
    coin: 10000
  },

  {
    id: "dragon",
    image: "/assets/social/gifts/dragon.webp",
    coin: 20000
  }

];

let giftPostId = null;
let giftPostOwner = null;

let selectedPostGift = null;
let giftSendPending = false;


/* ==========================================
   SOCIAL GIFT PENDING TRANSACTION V1.3
========================================== */

const postGiftPendingKey =

  "lsp:post-gift:v13:" +
  String(auth.uid || "");


let postGiftPending = null;

let postGiftStorageError = false;


try {

  const raw = sessionStorage.getItem(
    postGiftPendingKey
  );


  if (raw !== null) {

    const p = JSON.parse(raw);


    if (

      !p ||

      p.fromUid !== auth.uid ||

      typeof p.postId !== "string" ||

      !p.postId ||

      typeof p.toUid !== "string" ||

      !p.toUid ||

      typeof p.giftId !== "string" ||

      !p.giftId ||

      !Number.isSafeInteger(p.coin) ||

      p.coin <= 0 ||

      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
        .test(p.requestId)

    ) {

      throw new Error(
        "INVALID_PENDING_GIFT"
      );

    }


    postGiftPending = p;

  }

} catch {

  postGiftStorageError = true;

}



let composeImages = []; // 🔥 danh sách ảnh đang preview
let isPosting = false;

window.allUsers = {};

function isAdminUser(uid){
  // fallback cực quan trọng
  if (auth?.role === "admin") return true;

  return window.allUsers?.[uid]?.role === "admin";
}


function verifiedBadge(uid) {
  const u = window.allUsers?.[uid];

  if (!u) return "";

  if (u.role === "admin") {
    return `
      <span
        class="lp-verified"
        title="Verified Admin"
      >✔︎</span>
    `;
  }

  return "";
}


function refreshPostBadges(){
  document.querySelectorAll(".lp-post").forEach(post=>{
    const uid = post.dataset.uid;
    const nameEl = post.querySelector(".lp-post-name");
    if(!uid || !nameEl) return;

    const badge = verifiedBadge(uid);

    // xoá badge cũ nếu có
    const old = nameEl.querySelector(".lp-verified");
    if(old) old.remove();

    if(badge){
      nameEl.insertAdjacentHTML("beforeend", badge);
    }
  });
}



function refreshCommentBadges(){
  // COMMENT
  document.querySelectorAll(".lp-comment").forEach(c=>{
    const uid = c.dataset.uid;
    if(!uid) return;

    const nameEl = c.querySelector(".lp-cm-name");
    if(!nameEl) return;

    const badge = verifiedBadge(uid);

    const old = nameEl.querySelector(".lp-verified");
    if(old) old.remove();

    if(badge){
      nameEl.insertAdjacentHTML("beforeend", badge);
    }
  });

  // REPLY + REPLY CHILD
  document.querySelectorAll(".lp-reply").forEach(r=>{
    const uid = r.dataset.uid;
    if(!uid) return;

    const nameEl = r.querySelector("b");
    if(!nameEl) return;

    const badge = verifiedBadge(uid);

    const old = nameEl.querySelector(".lp-verified");
    if(old) old.remove();

    if(badge){
      nameEl.insertAdjacentHTML("beforeend", badge);
    }
  });
}


socket.on("all-users", list=>{
  list.forEach(u=>{
    window.allUsers[u.uid] = u;
  });


   // 🔥 FIX TÍCH XANH MẤT KHI RELOAD
  refreshPostBadges();
  refreshCommentBadges();   // ✔️ comment + reply
  
document.querySelectorAll(".lp-post").forEach(p=>{
  const id = p.dataset.id;
  const data = window.lpPostMap?.[id];
  if(!data) return;

  // 🔄 chỉ refresh badge + avatar người tặng
  const giftBox = p.querySelector(".lp-gift-users");
  if (giftBox && data.gifts?.byUser) {
    giftBox.innerHTML = `
      🎁
      ${Object.entries(data.gifts.byUser)
        .slice(0,3)
        .map(([uid,amt]) => `<span class="gift-user">${amt}💎</span>`)
        .join(" ")}
      ${Object.keys(data.gifts.byUser).length > 3 ? "…" : ""}
    `;
  }
});


// ===== 🔥 FIX: ADMIN HIỆN NÚT XOÁ SAU KHI LOAD all-users =====
if (isAdminUser(auth.uid)) {
  document.querySelectorAll(".lp-post").forEach(post => {
    const postUid = post.dataset.uid;
    const postId  = post.dataset.id;

    // chỉ thêm cho bài của người khác
    if (!postUid || postUid === auth.uid) return;

    // đã có tools thì bỏ qua
    if (post.querySelector(".lp-post-tools")) return;

    const head = post.querySelector(".lp-post-head");
    if (!head) return;

    const tools = document.createElement("div");
    tools.className = "lp-post-tools";
    tools.innerHTML = `
      <span class="lp-del"
        onclick="adminDeletePost('${postId}')">🗑</span>
    `;

    head.appendChild(tools);
  });
}



});






if (auth.uid) {
  setInterval(() => {
    if (socket.connected) {
      socket.emit("auth-ping", {
        uid: auth.uid
      });
    }
  }, 20000);
}




const R2_PUBLIC_URL =
  "https://pub-a6a541cf3a9c4d0aa06613e3d1dc1c60.r2.dev";

const DEFAULT_AVATAR = "/icons/icon-192.png";

const LEGACY_DEFAULT_AVATAR =
  "https://i.ibb.co/GvJWn19q/icon-192.png";

function fixMedia(url) {

  if (typeof url !== "string" || !url.trim()) {
    return "";
  }

  url = url.trim();

  // Chuyển avatar mặc định cũ sang ảnh nội bộ
  if (
    url.startsWith(LEGACY_DEFAULT_AVATAR) ||
    url === "/icons/icon-192.png"
  ) {
    return DEFAULT_AVATAR;
  }

  // Giữ nguyên ảnh nội bộ
  if (
    url.startsWith("/assets/") ||
    url.startsWith("/icons/")
  ) {
    return url;
  }

  // Giữ nguyên hệ thống Cloudflare R2
  if (url.startsWith(location.origin + "/post-images/")) {
    return R2_PUBLIC_URL +
      url.replace(location.origin, "");
  }

  if (
    url.startsWith("/avatars/") ||
    url.startsWith("/covers/") ||
    url.startsWith("/post-images/")
  ) {
    return R2_PUBLIC_URL + url;
  }

  return url;
}

// Hàm dành riêng cho avatar
function fixAvatar(url) {
  return fixMedia(url) || DEFAULT_AVATAR;
}




document.getElementById("meAvatar").src = fixAvatar(auth.avatar);





socket.on("profile-update", data => {
  const auth = JSON.parse(localStorage.getItem("user_profile") || "{}");

  if (data.avatar) {
    auth.avatar = data.avatar;
    localStorage.setItem("user_profile", JSON.stringify(auth));

    // update avatar góc đăng bài
    const me = document.getElementById("meAvatar");

 if (me) me.src = fixAvatar(data.avatar);


    // 🔥 UPDATE TOÀN BỘ FEED CŨ
    document.querySelectorAll(".lp-post").forEach(post => {

      if (post.dataset.uid === auth.uid) {
    const ava = post.querySelector(".lp-ava");
    if (ava) ava.src = fixAvatar(data.avatar);
  }

  post.querySelectorAll(".lp-comment").forEach(c => {
    if (c.dataset.uid === auth.uid) {
      const img = c.querySelector(".lp-cm-ava");
      if (img) img.src = fixAvatar(data.avatar);
    }
  });

  post.querySelectorAll(".lp-reply").forEach(r => {
    if (r.dataset.uid === auth.uid) {
      const img = r.querySelector("img");
      if (img) img.src = fixAvatar(data.avatar);
    }
  });

 

    });
  }

  if (data.name) {
    auth.name = data.name;
    localStorage.setItem("user_profile", JSON.stringify(auth));
  }
});


function openReplyChild(postId, cIndex, replyId){
  const box = document.getElementById(`rp2_${replyId}`);
  if(!box) return;

  // nếu đã có input → chỉ toggle input, KHÔNG xoá reply cũ
  const exist = box.querySelector(".lp-reply-box");
  if(exist){
    exist.remove();
    return;
  }

  const div = document.createElement("div");
  div.className = "lp-reply-box";
  div.innerHTML = `
    <input id="ri2_${replyId}" placeholder="Write a reply...">
    <button onclick="sendReplyChild('${postId}',${cIndex},'${replyId}')">➤</button>
  `;

  box.appendChild(div);
}



function sendReplyChild(postId, cIndex, replyId){
  const input = document.getElementById(`ri2_${replyId}`);
  if(!input || !input.value.trim()) return;

  socket.emit("lp-reply-child",{
    postId,
    commentIndex: cIndex,
    replyId,
    uid: auth.uid,
    name: auth.name,
    avatar: fixAvatar(auth.avatar),
    text: input.value
  });

  // clear text
  input.value = "";

  // 🔥 đóng box trả lời cấp 2
  const box = document.getElementById(`rp2_${replyId}`);
  if(box){
    const inputBox = box.querySelector(".lp-reply-box");
    if(inputBox) inputBox.remove();
  }
}



function likeReply(postId, cIndex, replyId){
  socket.emit("lp-like-reply",{
    postId,
    commentIndex:cIndex,
    replyId,
    uid:auth.uid
  });
}

socket.on("lp-like-reply", ({ postId, commentIndex, replyId, likes })=>{
  const el = document.getElementById(`rl_${postId}_${commentIndex}_${replyId}`);

  if(el) el.textContent = likes;
});


function isPostOwner(postId){
  const el = document.querySelector(`.lp-post[data-id="${postId}"]`);
  return el && el.querySelector(".lp-del"); // có nút xóa bài => là chủ bài
}


function likePost(id){
  socket.emit("lp-like", {
    postId:id,
    uid: auth.uid
  });
}

socket.on("lp-like", ({ postId, likes })=>{
  const el = document.getElementById("like_"+postId);
  if(el) el.textContent = likes;
});

function toggleComments(id){
  document.getElementById("cm_"+id).classList.toggle("hidden");
}

function sendComment(id){
  const input = document.getElementById("ci_"+id);
  const text = input.value.trim();
  if(!text) return;

  socket.emit("lp-comment", {
    postId:id,
    uid:auth.uid,
    name:auth.name,
    avatar:auth.avatar,
    text
  });

  input.value="";
}


function openReply(postId, index){
  const box = document.getElementById(`rp_${postId}_${index}`);
  if(!box) return;

  // nếu đã có input thì toggle (đóng)
  const exist = box.querySelector(".lp-reply-box");
  if(exist){
    exist.remove();
    return;
  }

  // tạo input riêng, KHÔNG đụng reply cũ
  const div = document.createElement("div");
  div.className = "lp-reply-box";
  div.innerHTML = `
    <input id="ri_${postId}_${index}" placeholder="Write a reply...">
    <button onclick="sendReply('${postId}',${index})">➤</button>
  `;

  box.appendChild(div);
}


function sendReply(postId, index){
  const input = document.getElementById(`ri_${postId}_${index}`);
  const text = input.value.trim();
  if(!text) return;

  socket.emit("lp-reply",{
    postId,
    commentIndex:index,
    uid:auth.uid,
    name:auth.name,
    avatar:auth.avatar,
    text
  });

  // clear input
input.value="";

// 🔥 chỉ xóa input box, không xóa replies
const box = document.getElementById(`rp_${postId}_${index}`);
if(box){
  const inputBox = box.querySelector(".lp-reply-box");
  if(inputBox) inputBox.remove();
}


}


async function deleteComment(postId, index){
const ok = await showConfirmModal({
  title: "Delete Comment",
  body: "Are you sure you want to delete this comment?"
});
  if(!ok) return;

  socket.emit("lp-delete-comment", {
    postId,
    index,
    uid: auth.uid
  });
}


function likeComment(postId, index){
  socket.emit("lp-like-comment",{
    postId,
    index,
    uid: auth.uid
  });
}


async function deleteReply(postId, cIndex, replyId){
const ok = await showConfirmModal({
  title: "Delete Reply",
  body: "Are you sure you want to delete this reply?"
});
  if(!ok) return;

  socket.emit("lp-delete-reply",{
    postId,
    commentIndex:cIndex,
    replyId,
    uid:auth.uid
  });
}



async function deleteReplyChild(postId, cIndex, replyId, childId){
const ok = await showConfirmModal({
  title: "Delete Reply",
  body: "Are you sure you want to delete this reply?"
});
  if(!ok) return;

  socket.emit("lp-delete-reply-child",{
    postId,
    commentIndex:cIndex,
    replyId,
    childId,
    uid: auth.uid
  });
}



function likeReplyChild(postId, cIndex, replyId, childId){
  socket.emit("lp-like-reply-child",{
    postId,
    commentIndex: cIndex,
    replyId,
    childId,
    uid: auth.uid
  });
}


socket.on("social-name-sync", ({ uid, name }) => {
  document.querySelectorAll(".lp-post").forEach(post => {
    if (post.dataset.uid === uid) {
      const el = post.querySelector(".lp-post-name");
      if (el) el.textContent = name;
    }

    post.querySelectorAll(".lp-comment").forEach(c => {
      if (c.dataset.uid === uid) {
        const el = c.querySelector(".lp-cm-name");
        if (el) el.textContent = name;
      }
    });

    post.querySelectorAll(".lp-reply").forEach(r => {
      if (r.dataset.uid === uid) {
        const el = r.querySelector("b");
        if (el) el.textContent = name;
      }
    });
  });
});


socket.on("social-avatar-sync", ({ uid, avatar }) => {
  document.querySelectorAll(".lp-post").forEach(post => {
    if (post.dataset.uid === uid) {
      const img = post.querySelector(".lp-ava");
      if (img) img.src = fixAvatar(avatar);
    }

    post.querySelectorAll(".lp-comment").forEach(c => {
      if (c.dataset.uid === uid) {
        const img = c.querySelector(".lp-cm-ava");
        if (img) img.src = fixAvatar(avatar);
      }
    });

    post.querySelectorAll(".lp-reply").forEach(r => {
      if (r.dataset.uid === uid) {
        const img = r.querySelector("img");
        if (img) img.src = fixAvatar(avatar);
      }
    });
  });
});


socket.on("lp-like-reply-child", ({ postId, commentIndex, replyId, childId, likes })=>{
  const el = document.getElementById(`rcl_${postId}_${commentIndex}_${replyId}_${childId}`);
  if(el) el.textContent = likes;
});



/* =====================================
   ADMIN SOCIAL REALTIME UPDATES
===================================== */

socket.on("social-update", ({
  type,
  postId,
  commentId,
  replyId
}) => {

  if (type === "post-deleted") {
    const el = [...document.querySelectorAll(".lp-post")]
      .find(p => p.dataset.id === String(postId));

    if (el) el.remove();

    if (window.lpPostMap) {
      delete window.lpPostMap[postId];
    }

    return;
  }

  // Lấy lại bài và bình luận chính xác từ server
  if (
    type === "comment-deleted" ||
    type === "reply-deleted"
  ) {
    requestSocialFeed();
  }
});



socket.on("lp-delete-reply-child", ({ replyId, childId })=>{
  const el = document.querySelector(`#rp2_${replyId} .lp-reply[data-id="${childId}"]`);
  if(el) el.remove();
});



socket.on("lp-delete-reply", ({ postId, commentIndex, replyId })=>{
  const el = document.querySelector(`#rp_${postId}_${commentIndex} .lp-reply[data-id="${replyId}"]`);
  if(el) el.remove();
});




socket.on("lp-delete-comment", ({ postId, index }) => {
  // Đồng bộ lại bài và toàn bộ bình luận từ server.
  // Tránh lệch index của reply, like và nút xóa.
  requestSocialFeed();
});



socket.on("lp-like-comment", ({ postId, index, likes })=>{
  const el = document.getElementById(`cl_${postId}_${index}`);
  if(el) el.textContent = likes;
});


socket.on("lp-reply", ({ postId, commentIndex, reply })=>{
  const box = document.getElementById(`rp_${postId}_${commentIndex}`);
  if(!box) return;

  const div = document.createElement("div");
  div.className="lp-reply";
  div.dataset.id = reply.id;   // 🔥 bắt buộc

div.innerHTML=`


<img src="${fixAvatar(reply.avatar)}"
     onclick="openUserProfile('${reply.uid}')"
     style="cursor:pointer">
  <div>

 <b onclick="openUserProfile('${reply.uid}')"
   style="cursor:pointer">
  ${reply.name}
  ${verifiedBadge(reply.uid)}
</b>


${reply.text}

   <div class="lp-cm-actions">
  <span class="cm-like" onclick="likeReply('${postId}',${commentIndex},'${reply.id}')">
    ❤️ <b id="rl_${postId}_${commentIndex}_${reply.id}">${reply.likes?.length||0}</b>
  </span>
  <span onclick="openReplyChild('${postId}',${commentIndex},'${reply.id}')">💬</span>
 ${
  reply.uid === auth.uid || isAdminUser(auth.uid)
  ? `<span class="cm-del"
      onclick="${
        isAdminUser(auth.uid) && reply.uid !== auth.uid
          ? `adminDeleteReply(
  '${postId}',
  '${window.lpPostMap?.[postId]?.comments?.[commentIndex]?.id || ""}',
  '${reply.id}'
)`
          : `deleteReply('${postId}',${commentIndex},'${reply.id}')`
      }"
    >🗑</span>`
  : ``
}

</div>



    <div class="lp-replies" id="rp2_${reply.id}"></div>
  </div>
`;



  box.appendChild(div);
});


socket.on("lp-comment", ({ postId, postOwnerUid, comment, count })=>{



const cachedPost = window.lpPostMap?.[postId];

if (cachedPost) {
  cachedPost.comments ||= [];

  if (!cachedPost.comments.some(
    c => c.id && c.id === comment.id
  )) {
    cachedPost.comments.push(comment);
  }
}


  const countEl = document.getElementById("c_"+postId);
  if(countEl) countEl.textContent = count;

  const list = document.querySelector(`#cm_${postId} .lp-comment-list`);
  if(!list) return;

  const idx = list.children.length;   // 🔥 tạo index đúng

  const div = document.createElement("div");
  div.className = "lp-comment";
  div.dataset.index = idx;

  div.innerHTML = `

<img class="lp-cm-ava" src="${fixAvatar(comment.avatar)}"
     onclick="openUserProfile('${comment.uid}')"
     style="cursor:pointer">

    <div class="lp-cm-body">

     <div class="lp-cm-name"
     onclick="openUserProfile('${comment.uid}')"
     style="cursor:pointer">
  ${comment.name}
  ${verifiedBadge(comment.uid)}
</div>


      <div class="lp-cm-text">${comment.text}</div>

<div class="lp-cm-actions">
  <span class="cm-like" onclick="likeComment('${postId}',${idx})">
    ❤️ <b id="cl_${postId}_${idx}">${comment.likes?.length || 0}</b>
  </span>
  <span onclick="openReply('${postId}',${idx})">💬</span>

  ${
  comment.uid === auth.uid || isAdminUser(auth.uid)
  ? `<span class="cm-del"
      onclick="${
        isAdminUser(auth.uid) && comment.uid !== auth.uid
          ? `adminDeleteComment('${postId}','${comment.id}')`
          : `deleteComment('${postId}',${idx})`
      }"
    >🗑</span>`
  : ``
}

</div>





      <div class="lp-replies" id="rp_${postId}_${idx}"></div>
    </div>
  `;

  list.appendChild(div);
});


async function submitPost(){
  const text = postText.value.trim();
  const imageFiles = [...postImage.files];
  const videoFile = postVideo.files[0];

  if(!text && imageFiles.length === 0 && !videoFile) return;

  let imageUrls = [];
  let videoUrl = "";

  // 🔥 UPLOAD NHIỀU ẢNH
  for(const file of imageFiles){
    const fd = new FormData();
    fd.append("image", file);

    const r = await fetch("/api/upload-post-image", {
      method: "POST",
      body: fd
    });

    const data = await r.json();
    if(data.url) imageUrls.push(data.url);
  }

  // upload video (giữ nguyên)
  if(videoFile){
    const fd = new FormData();
    fd.append("video", videoFile);
    const r = await fetch("/api/upload-post-video", {
      method:"POST",
      body:fd
    });
    const data = await r.json();
    videoUrl = data.url;
  }

  const cur = JSON.parse(localStorage.getItem("user_profile"));

socket.emit("lp-post", {
  uid: cur.uid,
  name: cur.name,
  avatar: fixAvatar(cur.avatar),
  text,
  images: imageUrls,
  video: videoUrl,
  time: Date.now()
});


  // reset
  postText.value="";
  postImage.value="";
  postVideo.value="";

  clearComposeMedia(); // 🔥 đảm bảo preview luôn sạch

  return true;
}







/* =====================================
   SOCIAL FEED - FRIENDS + FOLLOW
===================================== */
function requestSocialFeed() {
  if (!auth.uid) return;

  socket.emit("lp-request-feed");
}

socket.on("lp-init", list => {
  if (!Array.isArray(list)) return;

  // Xóa feed cũ
  feed.replaceChildren();

  // Reset dữ liệu cache
  window.lpPostMap = {};

  // Hiển thị bài được phép xem
  list.forEach(post => {
    renderPost(post, false);
  });

  refreshPostBadges();
  refreshCommentBadges();
});

/* =====================================
   REFRESH ON SOCKET CONNECTION
===================================== */

socket.on("connect", () => {
  if (!auth.uid) return;

  socket.emit("auth-login", {
    uid: auth.uid
  });

  requestSocialFeed();
});




/* ==========================================
   DAILY SOCIAL MISSION NOTIFICATION
========================================== */

socket.on("daily-social-reward", data => {

  const amount = Number(data?.amount || 0);

  if (amount !== 100) return;

  showToast(
    "Daily mission completed! +100 Diamonds",
    "success",
    4500
  );

});




socket.on("lp-post", post=>{
  renderPost(post,true);
});


socket.on("lp-reply-child", ({ postId, commentIndex, replyId, child })=>{
  const box = document.getElementById(`rp2_${replyId}`);
  if(!box) return;

 const div = document.createElement("div");
div.className="lp-reply";
div.dataset.id = child.id;   // 🔥 bắt buộc
div.style.marginLeft="16px";

div.innerHTML = `
<img src="${fixAvatar(child.avatar)}"
     onclick="openUserProfile('${child.uid}')"
     style="cursor:pointer">


  <div>

   <b onclick="openUserProfile('${child.uid}')"
   style="cursor:pointer">
  ${child.name}
  ${verifiedBadge(child.uid)}
</b>
 

${child.text}

    <div class="lp-cm-actions">
      <span class="cm-like"
        onclick="likeReplyChild('${postId}',${commentIndex},'${replyId}','${child.id}')">
        ❤️ <b id="rcl_${postId}_${commentIndex}_${replyId}_${child.id}">
          ${child.likes?.length || 0}
        </b>
      </span>

      ${(child.uid === auth.uid || isPostOwner(postId)) ?
        `<span class="cm-del"
          onclick="deleteReplyChild('${postId}',${commentIndex},'${replyId}','${child.id}')">🗑</span>` : ``}
    </div>
  </div>
`;


  


  box.appendChild(div);
});


// ===== SOCIAL CONFIRM MODAL =====
function showConfirmModal({ title, body, input=false }) {
  return new Promise(resolve => {
    let modal = document.getElementById("socialConfirmModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "socialConfirmModal";
      modal.innerHTML = `
        <div class="scm-backdrop"></div>
        <div class="scm-box">
          <h3 id="scmTitle"></h3>
          <div id="scmBody"></div>
          <input id="scmInput" class="scm-input hidden" />
<div class="scm-actions">
  <button id="scmCancel">Cancel</button>
  <button id="scmOk">OK</button>
</div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    const titleEl = modal.querySelector("#scmTitle");
    const bodyEl  = modal.querySelector("#scmBody");
    const inputEl = modal.querySelector("#scmInput");

    titleEl.textContent = title || "Confirm";
    bodyEl.innerHTML = body || "";
    inputEl.classList.toggle("hidden", !input);
    inputEl.value = "";

    modal.classList.add("show");

    modal.querySelector("#scmOk").onclick = () => {
      modal.classList.remove("show");
      resolve(input ? inputEl.value : true);
    };
    modal.querySelector("#scmCancel").onclick = () => {
      modal.classList.remove("show");
      resolve(false);
    };
  });
}



async function adminDeleteComment(postId, commentId) {
const reason = await showConfirmModal({
  title: "Admin: Delete Comment",
  body: "Enter a reason (optional):",
  input: true
});
  if(reason === false) return;

  await fetch("/api/admin/delete-comment", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({
      adminUid: auth.uid,
      postId,
      commentId,
      reason
    })
  });
}

async function adminDeleteReply(postId, commentId, replyId) {
const reason = await showConfirmModal({
  title: "Admin: Delete Reply",
  body: "Enter a reason (optional):",
  input: true
});
  if(reason === false) return;

  await fetch("/api/admin/delete-comment", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({
      adminUid: auth.uid,
      postId,
      commentId,
      replyId,
      reason
    })
  });
}



/* ==========================================
   ADMIN DELETE POST - SECURE V2.0
========================================== */

async function adminDeletePost(postId) {

  const reason = await showConfirmModal({
    title: "Admin: Delete Post",
    body: "Enter a reason for deletion (optional):",
    input: true
  });

  if (reason === false) return;

  const ok = await showConfirmModal({
    title: "Confirm",
    body: "Are you sure you want to delete this post?"
  });

  if (!ok) return;

  try {

    const res = await fetch(
      "/api/social/admin/delete-post",
      {
        method: "POST",

        credentials: "same-origin",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          postId,
          reason
        })
      }
    );

    const data = await res.json();

    if (res.status === 401) {

      showToast(
        "Session expired. Please sign in again.",
        "error"
      );

      return;

    }

    if (res.status === 403) {

      showToast(
        "Admin permission required.",
        "error"
      );

      return;

    }

    if (!res.ok || !data.ok) {

      showToast(
        "Unable to delete the post.",
        "error"
      );

      return;

    }

    // REMOVE POST FROM CURRENT FEED
    const postEl = [
      ...document.querySelectorAll(".lp-post")
    ].find(
      el => el.dataset.id === String(postId)
    );

    if (postEl) {
      postEl.remove();
    }

    // CLEAR LOCAL CACHE
    if (window.lpPostMap) {
      delete window.lpPostMap[postId];
    }

    showToast(
      "Post deleted successfully.",
      "success"
    );

  } catch (error) {

    console.error(
      "[ADMIN DELETE POST]",
      error
    );

    showToast(
      "Connection error. Please try again.",
      "error"
    );

  }

}

async function deletePost(id){
const ok = await showConfirmModal({
  title: "Delete Post",
  body: "Are you sure you want to delete this post?"
});
  if(!ok) return;

  socket.emit("lp-delete", {
    postId: id,
    uid: auth.uid
  });
}


socket.on("lp-delete", ({ postId })=>{
  const el = document.querySelector(`.lp-post[data-id="${postId}"]`);
  if(el) el.remove();
});


function renderPost(p, top=false){

    // ⛔⛔⛔ CHẶN RENDER TRÙNG BÀI VIẾT
  if (document.querySelector(`.lp-post[data-id="${p.id}"]`)) {
    return;
  }

window.lpPostMap ||= {};
window.lpPostMap[p.id] = p;



  const div = document.createElement("div");
  div.className="lp-post";
  div.dataset.id = p.id;
  div.dataset.uid = p.uid;   // 🔥 rất quan trọng

const d = new Date(p.time);

const time = `
  ${d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit"
  })}
  ·
  ${d.toLocaleDateString("en-GB")}
`;


  
  const isAdmin = window.allUsers?.[p.uid]?.role === "admin";

 div.innerHTML=`

 <div class="lp-post-inner">


<div class="lp-post-head">

  <!-- AVATAR -->
  <img
    class="lp-ava"
    src="${fixAvatar(p.avatar)}"
    loading="eager"
    decoding="async"
    onclick="openUserProfile('${p.uid}')"
    style="cursor:pointer"
  >

  <!-- AUTHOR INFORMATION -->
  <div class="lp-post-author">

    <div
      class="lp-post-name"
      onclick="openUserProfile('${p.uid}')"
      style="cursor:pointer"
    >
      ${p.name}

      ${isAdmin
        ? `<span class="lp-verified"
                 title="Verified Admin">✔︎</span>`
        : ``
      }
    </div>

    <div class="lp-post-time">
      ${time}
    </div>

  </div>

  <!-- EDIT / DELETE -->
  ${
    p.uid === auth.uid || isAdminUser(auth.uid)
    ? `
      <div class="lp-post-tools">

        ${p.uid === auth.uid
          ? `
            <span
              class="lp-edit"
              onclick="editPost('${p.id}')"
            >✏️</span>
          `
          : ``
        }

        <span
          class="lp-del"
          onclick="${
            isAdminUser(auth.uid) &&
            p.uid !== auth.uid
              ? `adminDeletePost('${p.id}')`
              : `deletePost('${p.id}')`
          }"
        >🗑</span>

      </div>
    `
    : ``
  }

</div>



<div class="lp-post-text">${p.text.replace(/\n/g, "<br>")}</div>


${(p.images && p.images.length) ? `
<div class="lp-post-images fb-${Math.min(p.images.length, 5)}">

  ${p.images.slice(0,5).map((url, index) => `
    <div class="fb-img img-${index}"
         onclick='openFeedLightbox(${JSON.stringify(p.images)}, ${index})'>
      <img
  src="${fixMedia(url)}"
  loading="lazy"
  decoding="async"
  alt="Post image"
>

      ${
        index === 4 && p.images.length > 5
          ? `<div class="fb-more">+${p.images.length - 5}</div>`
          : ``
      }
    </div>
  `).join("")}

</div>
  ` : ""
}



${p.video ? `
<video class="lp-post-video" controls playsinline>
  <source src="${p.video}" type="video/mp4">
</video>` : ""}




<!-- ===== PREMIUM POST ACTIONS ===== -->

<div class="lp-actions">

  <!-- LIKE -->
  <button
    type="button"
    class="lp-action like"
    onclick="likePost('${p.id}')"
  >
    <svg class="lp-i">
      <use href="#ls-heart"></use>
    </svg>

    <span>Like</span>

    <b id="like_${p.id}">
      ${p.likes?.length || 0}
    </b>
  </button>

  <!-- COMMENT -->
  <button
    type="button"
    class="lp-action"
    onclick="toggleComments('${p.id}')"
  >
    <svg class="lp-i">
      <use href="#ls-chat"></use>
    </svg>

    <span>Comment</span>

    <b id="c_${p.id}">
      ${p.comments?.length || 0}
    </b>
  </button>

  <!-- GIFT -->
  <button
    type="button"
    class="lp-action gift"
    onclick="openGift('${p.id}', '${p.uid}')"
  >
    <svg class="lp-i">
      <use href="#ls-gift"></use>
    </svg>

    <span>Gift</span>

    <b id="g_${p.id}">
      ${p.gifts?.total || 0}
    </b>
  </button>

</div>



${p.gifts?.byUser ? `
<div class="lp-gift-users"
     onclick="openGiftUsers('${p.id}')">
  🎁
  ${Object.entries(p.gifts.byUser)
    .slice(0,3)
    .map(([uid,amt]) => {

      const u = window.allUsers?.[uid];

      const name = u?.name || uid;
      const avatar = fixAvatar(u?.avatar);
      return `
        <span class="gift-user">
          <img src="${avatar}" />
          <b>${name}</b>
          <i>${amt}💎</i>
        </span>
      `;
    }).join("")}

  ${Object.keys(p.gifts.byUser).length > 3
    ? "<span class='gift-more'>…</span>"
    : ""}
</div>
` : ``}






<div class="lp-comments hidden" id="cm_${p.id}">
  <div class="lp-comment-list"></div>

  <div class="lp-comment-box">
  <input
  id="ci_${p.id}"
  class="lp-comment-input"
  placeholder="Write a comment..."
>
  <button class="lp-comment-send" onclick="sendComment('${p.id}')">➤</button>
</div>
</div>

 </div>
`;


  if(top) feed.prepend(div);
  else feed.appendChild(div);

  // 🔥 Render lại comment đã có (khi reload)
if(p.comments && p.comments.length){
  const list = div.querySelector(".lp-comment-list");

  p.comments.forEach((comment, idx)=>{
    const c = document.createElement("div");
    c.className="lp-comment";
    c.dataset.index = idx;
    c.dataset.uid = comment.uid;

    c.innerHTML = `
<img class="lp-cm-ava" src="${fixAvatar(comment.avatar)}"
     onclick="openUserProfile('${comment.uid}')"
     style="cursor:pointer">

      <div class="lp-cm-body">

     <div class="lp-cm-name"
     onclick="openUserProfile('${comment.uid}')"
     style="cursor:pointer">
  ${comment.name}
  ${verifiedBadge(comment.uid)}
</div>


        <div class="lp-cm-text">${comment.text}</div>

<div class="lp-cm-actions">
  <span class="cm-like" onclick="likeComment('${p.id}',${idx})">
    ❤️ <b id="cl_${p.id}_${idx}">${comment.likes?.length || 0}</b>
  </span>
  <span onclick="openReply('${p.id}',${idx})">💬</span>

 ${
  comment.uid === auth.uid || isAdminUser(auth.uid)
  ? `<span class="cm-del"
      onclick="${
        isAdminUser(auth.uid) && comment.uid !== auth.uid
          ? `adminDeleteComment('${p.id}','${comment.id}')`
          : `deleteComment('${p.id}',${idx})`
      }"
    >🗑</span>`
  : ``
}

</div>



        <div class="lp-replies" id="rp_${p.id}_${idx}"></div>
      </div>
    `;

    list.appendChild(c);

    // 🔥 render replies nếu có
    if(comment.replies){
      const box = c.querySelector(".lp-replies");
      comment.replies.forEach(r=>{
        const rdiv = document.createElement("div");
        rdiv.className="lp-reply";
        rdiv.dataset.id = r.id;   // 🔥 bắt buộc
        rdiv.dataset.uid = r.uid;


     rdiv.innerHTML=`
<img src="${fixAvatar(r.avatar)}">

  <div>
    <b>${r.name}</b> ${r.text}

<div class="lp-cm-actions">
  <span class="cm-like" onclick="likeReply('${p.id}',${idx},'${r.id}')">
    ❤️ <b id="rl_${p.id}_${idx}_${r.id}">${r.likes?.length||0}</b>
  </span>
  <span onclick="openReplyChild('${p.id}',${idx},'${r.id}')">💬</span>

${
  r.uid === auth.uid ||
  p.uid === auth.uid ||
  isAdminUser(auth.uid)
    ? `<span class="cm-del"
        onclick="${
          isAdminUser(auth.uid) && r.uid !== auth.uid
            ? `adminDeleteReply('${p.id}','${comment.id || ""}','${r.id}')`
            : `deleteReply('${p.id}',${idx},'${r.id}')`
        }">🗑</span>`
    : ``
}

</div>



    <div class="lp-replies" id="rp2_${r.id}"></div>
  </div>
`;

        box.appendChild(rdiv);

        // 🔥 render reply-of-reply (cấp 2)
if(r.replies){
  const box2 = rdiv.querySelector(`#rp2_${r.id}`);

 r.replies.forEach(child=>{
  const c2 = document.createElement("div");
  c2.className="lp-reply";
  c2.dataset.id = child.id;   // 🔥 bắt buộc
  c2.dataset.uid = child.uid;

  c2.style.marginLeft="16px";

  c2.innerHTML = `
<img src="${fixAvatar(child.avatar)}"
     onclick="openUserProfile('${child.uid}')"
     style="cursor:pointer">


  <div>

   <b onclick="openUserProfile('${child.uid}')"
   style="cursor:pointer">
  ${child.name}
  ${verifiedBadge(child.uid)}
</b>

${child.text}

    <div class="lp-cm-actions">
      <span class="cm-like"
        onclick="likeReplyChild('${p.id}',${idx},'${r.id}','${child.id}')">
        ❤️ <b id="rcl_${p.id}_${idx}_${r.id}_${child.id}">
          ${child.likes?.length || 0}
        </b>
      </span>

     
${
  child.uid === auth.uid
    ? `<span class="cm-del"
         onclick="deleteReplyChild(
           '${p.id}',
           ${idx},
           '${r.id}',
           '${child.id}'
         )">🗑</span>`
    : ``
}

    </div>
  </div>
`;


  box2.appendChild(c2);
});
}

      });
    }
  });
}
}


/* ==========================================
   SOCIAL TAB BAR
   LIVESTREAM PRO SMOOTH TRANSITION
========================================== */

document.querySelectorAll(".lp-tab").forEach(tab => {
  tab.classList.remove("active");
});

document.querySelector(
  '.lp-tab[data-tab="social"]'
)?.classList.add("active");


document.querySelectorAll(".lp-tab").forEach(tab => {

  tab.onclick = () => {

    const t = tab.dataset.tab;

    // Không tải lại trang hiện tại
    if (t === "social") return;

const routes = {

  market: {
    url: "/market.html",
    label: "Opening Market..."
  },

  lobby: {
    url: "/lobby.html",
    label: "Opening LIVE Lobby..."
  },

  messages: {
    url: "/messages.html",
    label: "Opening Messages..."
  },

  profile: {
    url: "/profile.html",
    label: "Opening your profile..."
  }

};

    const route = routes[t];

    if (!route) return;

    // Có hiệu ứng chung
    if (window.LSPTransition?.go) {

      LSPTransition.go(route.url, {
        label: route.label
      });

    } else {

      // Dự phòng khi file hiệu ứng chưa tải
      window.location.href = route.url;

    }

  };

});





socket.on("inbox-clear", ()=>{
  document.getElementById("msgBadge")?.classList.add("hidden");
});



// ===== COMPOSE COLLAPSE ON SCROLL =====
const compose = document.querySelector(".lp-compose");
const textarea = document.getElementById("postText");

let lastY = window.scrollY;

window.addEventListener("scroll", () => {
  const y = window.scrollY;

  // vuốt xuống → thu gọn
  if (y > lastY + 10) {
    compose.classList.add("compact");
  }
  // vuốt lên → mở lại
  else if (y < lastY - 10) {
    compose.classList.remove("compact");
  }

  lastY = y;
}, { passive: true });

// focus textarea → luôn mở
textarea?.addEventListener("focus", () => {
  compose.classList.remove("compact");
});



const postText = document.getElementById("postText");
const modal = document.getElementById("composeModal");
const modalTextarea = document.getElementById("postTextModal");

/* MỞ MODAL */
postText.addEventListener("pointerdown", e => {
  e.preventDefault();       // chặn focus
  postText.blur();          // đảm bảo KHÔNG bật keyboard
  openComposeModal();
});





let scrollTopBeforeModal = 0;

function openComposeModal(){

  scrollTopBeforeModal = window.scrollY;

  modal.classList.remove("hidden");

  updateComposeViewport();

  modalTextarea.value = postText.value;

  /* ==========================================
     SYNC AUTHOR PROFILE
  ========================================== */

  let currentProfile = {};

  try {
    currentProfile = JSON.parse(
      localStorage.getItem("user_profile") || "{}"
    );
  } catch {}

  const composeAvatar =
    document.getElementById("composeAvatar");

  const composeName =
    document.getElementById("composeName");

  if (composeAvatar) {

    composeAvatar.onerror = function(){

      this.onerror = null;
      this.src = "/icons/icon-192.png";

    };

    composeAvatar.src = fixAvatar(
      currentProfile.avatar
    );

  }

  if (composeName) {

    composeName.textContent =
      currentProfile.name ||
      currentProfile.uid ||
      "Your Profile";

  }

  toggleSubmitBtn();

/* LOCK BACKGROUND SCROLL */

document.documentElement.classList.add(
  "lp-compose-open"
);

document.body.classList.add(
  "lp-compose-open"
);

requestAnimationFrame(updateComposeViewport);


}


function closeComposeModal(){

  modalTextarea.blur();

  modal.classList.add("hidden");

  modal.classList.remove("keyboard-open");

  modal.style.removeProperty("height");
  modal.style.removeProperty("top");

  modal.style.removeProperty("--compose-height");
  modal.style.removeProperty("--compose-top");

  postText.value = modalTextarea.value;

  /* UNLOCK BACKGROUND */

  document.documentElement.classList.remove(
    "lp-compose-open"
  );

  document.body.classList.remove(
    "lp-compose-open"
  );

  window.scrollTo(0, scrollTopBeforeModal);

}

async function submitFromModal(){
  if(isPosting) return;

  isPosting = true;
  submitBtn.classList.add("loading");
  submitBtn.disabled = true;

  postText.value = modalTextarea.value;

try {
  await submitPost();

  showToast("✅ Post published successfully");

} catch (e) {
  console.error(e);

  showToast("❌ Failed to publish the post");
}

  clearComposeMedia();             // 🔥 reset preview
  modalTextarea.value = "";

  isPosting = false;
  submitBtn.classList.remove("loading");
  submitBtn.disabled = false;

  closeComposeModal();
}




const modalText = document.getElementById("postTextModal");
const submitBtn = document.querySelector(".lp-submit.icon");

function toggleSubmitBtn(){
  submitBtn.disabled = !modalText.value.trim();
}

modalText.addEventListener("input", toggleSubmitBtn);
toggleSubmitBtn();


const modalImage = document.getElementById("modalImage");
const modalVideo = document.getElementById("modalVideo");


modalImage?.addEventListener("change", () => {
  document.getElementById("postImage").files = modalImage.files;
});

modalVideo?.addEventListener("change", () => {
  document.getElementById("postVideo").files = modalVideo.files;
});


/* ==========================================
   CREATE POST - STABLE VIEWPORT V3.0
========================================== */

function updateComposeViewport() {

  const composeModal =
    document.getElementById("composeModal");

  if (
    !composeModal ||
    composeModal.classList.contains("hidden")
  ) {
    return;
  }

  const viewport = window.visualViewport;

  const height = Math.round(
    viewport?.height || window.innerHeight
  );

  const top = Math.max(
    0,
    Math.round(viewport?.offsetTop || 0)
  );

  const active = document.activeElement;

  const editing =
    active &&
    composeModal.contains(active) &&
    active.matches("textarea, input");

  const keyboardOpen =
    editing &&
    window.innerHeight - height > 120;

  composeModal.classList.toggle(
    "keyboard-open",
    Boolean(keyboardOpen)
  );

  composeModal.style.setProperty(
    "--compose-height",
    `${height}px`
  );

  composeModal.style.setProperty(
    "--compose-top",
    `${top}px`
  );

}

/* VIEWPORT EVENTS */

let composeViewportFrame = 0;

function scheduleComposeViewport() {

  cancelAnimationFrame(composeViewportFrame);

  composeViewportFrame = requestAnimationFrame(
    updateComposeViewport
  );

}


window.visualViewport?.addEventListener(
  "resize",
  scheduleComposeViewport
);

window.visualViewport?.addEventListener(
  "scroll",
  scheduleComposeViewport
);

window.addEventListener(
  "resize",
  scheduleComposeViewport
);

window.addEventListener(
  "orientationchange",
  () => {
    setTimeout(updateComposeViewport, 400);
  }
);


document.addEventListener(
  "focusin",
  scheduleComposeViewport
);

document.addEventListener(
  "focusout",
  () => {
    setTimeout(updateComposeViewport, 350);
  }
);

const previewBox = document.getElementById("composePreview");
const previewImage = document.getElementById("previewImage");
const previewVideo = document.getElementById("previewVideo");

function showPreview(){
  previewBox.classList.remove("hidden");
}

function hidePreview(){
  previewBox.classList.add("hidden");
  previewImage.classList.add("hidden");
  previewVideo.classList.add("hidden");
}


function clearComposeMedia() {
  composeImages = [];

  // Chỉ xóa danh sách ảnh tạo động
  previewBox.querySelector(".lp-preview-grid")?.remove();

  // Giữ các phần tử HTML cố định
  previewImage.classList.add("hidden");
  previewImage.removeAttribute("src");

  previewVideo.pause();
  previewVideo.removeAttribute("src");
  previewVideo.load();
  previewVideo.classList.add("hidden");

  previewBox.classList.add("hidden");

  modalImage.value = "";
  modalVideo.value = "";
  postImage.value = "";
  postVideo.value = "";

  updateCenterMode();
}



/* ===== IMAGE PREVIEW ===== */
modalImage?.addEventListener("change", () => {
  const files = [...modalImage.files];
  if (!files.length) return;

  previewVideo.classList.add("hidden");
  previewImage.classList.add("hidden");

  files.forEach(file => {
    composeImages.push(file);
  });

  renderImagePreview();
});


/* ===== VIDEO PREVIEW ===== */
modalVideo?.addEventListener("change", () => {
  const file = modalVideo.files[0];
  if (!file) return;

  previewImage.classList.add("hidden");

  const url = URL.createObjectURL(file);
  previewVideo.src = url;
  previewVideo.classList.remove("hidden");

  showPreview();
});


const composeBody = document.querySelector(".lp-compose-body");

function updateCenterMode(){
  const hasImage =
    previewImage && !previewImage.classList.contains("hidden");
  const hasText =
    modalText && modalText.value.trim().length > 0;

  if (hasImage && !hasText) {
    composeBody.classList.add("center-image");
  } else {
    composeBody.classList.remove("center-image");
  }
}

/* gọi khi nhập text */
modalText.addEventListener("input", updateCenterMode);

/* gọi khi chọn ảnh */
modalImage?.addEventListener("change", () => {
  setTimeout(updateCenterMode, 50);
});



/* ==========================================
   CREATE POST - IOS RUBBER BAND FIX
========================================== */

let composeTouchY = 0;

modal.addEventListener("touchstart", e => {

  composeTouchY = e.touches[0].clientY;

}, { passive: true });


modal.addEventListener("touchmove", e => {

  if (e.touches.length !== 1) return;

  const currentY = e.touches[0].clientY;
  const deltaY = currentY - composeTouchY;

  composeTouchY = currentY;

  const scroller = e.target.closest(
    "textarea, .lp-compose-body"
  );

  if (!scroller) {

    if (e.cancelable) e.preventDefault();

    return;
  }

  const canScroll =
    scroller.scrollHeight >
    scroller.clientHeight + 1;

  const atTop =
    scroller.scrollTop <= 0;

  const atBottom =
    scroller.scrollTop +
    scroller.clientHeight >=
    scroller.scrollHeight - 1;

  if (
    !canScroll ||
    (atTop && deltaY > 0) ||
    (atBottom && deltaY < 0)
  ) {

    if (e.cancelable) e.preventDefault();

  }

}, { passive: false });


document.addEventListener("touchmove", e => {

  if (
    !modal.classList.contains("hidden") &&
    !modal.contains(e.target)
  ) {

    if (e.cancelable) e.preventDefault();

  }

}, { passive: false });

function renderImagePreview(){
  previewBox.classList.remove("hidden");
  previewBox.querySelector(".lp-preview-grid")?.remove();

  const grid = document.createElement("div");
  grid.className = "lp-preview-grid";

  composeImages.forEach((file, index) => {
    const wrap = document.createElement("div");
    wrap.className = "lp-preview-item";

    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);

    const del = document.createElement("button");
    del.className = "lp-preview-remove";
    del.textContent = "✕";
    del.onclick = () => removePreviewImage(index);

   img.onclick = () => openImageLightboxByIndex(index);

wrap.appendChild(img);


    wrap.appendChild(del);
    grid.appendChild(wrap);
  });

  previewBox.appendChild(grid);

  // 🔥 sync lại FileList cho submit
  syncPostImageFiles();
}


function removePreviewImage(index){
  composeImages.splice(index, 1);

  if(composeImages.length === 0){
    clearComposeMedia();
    return;
  }

  renderImagePreview();
}


function syncPostImageFiles(){
  const dt = new DataTransfer();

  composeImages.forEach(file => {
    dt.items.add(file);
  });

  postImage.files = dt.files;
}


const imgLightbox = document.getElementById("imgLightbox");
const imgLightboxView = document.getElementById("imgLightboxView");

function openImageLightbox(src){
  imgLightboxView.src = src;
  imgLightbox.classList.remove("hidden");

  // 🔒 khóa scroll nền
  document.body.style.overflow = "hidden";
}

function closeImageLightbox(){
  imgLightbox.classList.add("hidden");
  imgLightboxView.src = "";
  document.body.style.overflow = "";

  feedImages = [];
  feedLightboxIndex = 0;

  updateIndicator(0, 0); // 🔥 ẩn indicator
}



// click nền → đóng
imgLightbox?.addEventListener("click", e => {
  if(e.target === imgLightbox){
    closeImageLightbox();
  }
});


let lightboxIndex = 0;

function openImageLightboxByIndex(index){
  if(!composeImages.length) return;

  lightboxIndex = (index + composeImages.length) % composeImages.length;

  const file = composeImages[lightboxIndex];
  const src = URL.createObjectURL(file);

  openImageLightbox(src);
  updateIndicator(lightboxIndex + 1, composeImages.length);

}

function nextLightboxImage(){
  openImageLightboxByIndex(lightboxIndex + 1);
  updateIndicator(lightboxIndex + 1, composeImages.length);
}


function prevLightboxImage(){
  openImageLightboxByIndex(lightboxIndex - 1);
  updateIndicator(lightboxIndex + 1, composeImages.length);
}



let touchStartX = 0;
let touchEndX = 0;

imgLightbox?.addEventListener("touchstart", e => {
  touchStartX = e.changedTouches[0].screenX;
},{ passive:true });

imgLightbox?.addEventListener("touchend", e => {
  touchEndX = e.changedTouches[0].screenX;
  handleSwipe();
},{ passive:true });

function handleSwipe(){
  const diff = touchEndX - touchStartX;
  if(Math.abs(diff) < 40) return;

  if(feedImages.length){
    if(diff < 0) nextFeedImage();
    else prevFeedImage();
  }else{
    if(diff < 0) nextLightboxImage();
    else prevLightboxImage();
  }
}



document.addEventListener("keydown", e => {
  if(imgLightbox.classList.contains("hidden")) return;

  if(e.key === "ArrowRight"){
    feedImages.length ? nextFeedImage() : nextLightboxImage();
  }

  if(e.key === "ArrowLeft"){
    feedImages.length ? prevFeedImage() : prevLightboxImage();
  }

  if(e.key === "Escape") closeImageLightbox();
});



let feedImages = [];
let feedLightboxIndex = 0;

function openFeedLightbox(images, index){
  if(!images || !images.length) return;

  feedImages = images;
  feedLightboxIndex = index;

  imgLightboxView.src = fixMedia(feedImages[feedLightboxIndex]);

  imgLightbox.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  updateIndicator(feedLightboxIndex + 1, feedImages.length);
}


function nextFeedImage(){
  if(!feedImages.length) return;

  feedLightboxIndex = (feedLightboxIndex + 1) % feedImages.length;
 imgLightboxView.src = fixMedia(feedImages[feedLightboxIndex]);


  updateIndicator(feedLightboxIndex + 1, feedImages.length);
}


function prevFeedImage(){
  if(!feedImages.length) return;

  feedLightboxIndex =
    (feedLightboxIndex - 1 + feedImages.length) % feedImages.length;

  imgLightboxView.src = fixMedia(feedImages[feedLightboxIndex]);

  updateIndicator(feedLightboxIndex + 1, feedImages.length);
}




const imgIndicator = document.getElementById("imgIndicator");


function updateIndicator(current, total){
  if(!imgIndicator) return;

  if(total <= 1){
    imgIndicator.textContent = "";
    imgIndicator.style.display = "none";
    return;
  }

  imgIndicator.textContent = `${current} / ${total}`;
  imgIndicator.style.display = "block";
}



function showToast(text, timeout = 2000){
  const toast = document.createElement("div");
  toast.className = "lp-toast";
  toast.textContent = text;

  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(()=> toast.remove(), 300);
  }, timeout);
}



function editPost(postId){
  const postEl = document.querySelector(`.lp-post[data-id="${postId}"]`);
  if(!postEl) return;


  const oldImages = [...postEl.querySelectorAll(".lp-post-images img")]
  .map(img => fixMedia(img.src.replace(location.origin, "")));


  const textEl = postEl.querySelector(".lp-post-text");
  const oldText = textEl?.innerText || "";

  const modal = document.createElement("div");
  modal.className = "lp-compose-modal";

  modal.innerHTML = `
    <div class="lp-compose-sheet">
    
      <div class="lp-compose-header">
  <button class="lp-close">✕</button>

<div class="lp-header-title">Edit Post</div>

<button
  class="lp-submit icon"
  id="saveEdit"
  title="Save"
  disabled
>
  ✓
</button>

</div>


      <div class="lp-compose-body">
        <textarea id="editText"
          style="width:100%;height:100%;background:transparent;color:#fff;font-size:16px;">${oldText}</textarea>

            <!-- preview ảnh cũ -->
  <div id="editImagePreview" class="lp-preview-grid"></div>

      </div>
    </div>

<!-- footer -->
<div class="lp-compose-footer">
  <label class="lp-tool">
    📷
    <input type="file" id="editImageInput" accept="image/*" multiple hidden>
  </label>
</div>

  `;

  document.body.appendChild(modal);


// ===== EDIT IMAGE LOGIC (PHẢI Ở TRONG editPost) =====
let editImages = [...oldImages]; // string url hoặc { file, preview }

const preview = modal.querySelector("#editImagePreview");
const input = modal.querySelector("#editImageInput");

function renderEditImages(){
  preview.innerHTML = "";

  editImages.forEach((img, index) => {
    const wrap = document.createElement("div");
    wrap.className = "lp-preview-item";

    const src = typeof img === "string" ? img : img.preview;

    wrap.innerHTML = `
      <img src="${src}">
      <button class="lp-preview-remove">✕</button>
    `;

    wrap.querySelector("button").onclick = () => {
      editImages.splice(index, 1);
      renderEditImages();
      checkEditChanged();
    };

    preview.appendChild(wrap);
  });
}

renderEditImages();

input.onchange = () => {
  [...input.files].forEach(file => {
    editImages.push({
      file,
      preview: URL.createObjectURL(file)
    });
  });
  input.value = "";
  renderEditImages();
  checkEditChanged();
};






  const textarea = modal.querySelector("#editText");
const saveBtn  = modal.querySelector("#saveEdit");

const originalText = oldText.trim();

// trạng thái ban đầu
saveBtn.disabled = true;

function checkEditChanged(){
  const textChanged =
    textarea.value.trim() !== originalText;

  const imageChanged =
    editImages.length !== oldImages.length ||
    editImages.some((img, i) => img !== oldImages[i]);

  saveBtn.disabled = !(textChanged || imageChanged);
}

textarea.addEventListener("input", checkEditChanged);



  modal.querySelector(".lp-close").onclick = () => modal.remove();


saveBtn.onclick = async () => {
  if (saveBtn.disabled) return;

  const newText = textarea.value.trim();

  let imageUrls = [];

  for(const img of editImages){
    if(typeof img === "string"){
      imageUrls.push(img); // ảnh cũ
    }else{
      const fd = new FormData();
      fd.append("image", img.file);

      const r = await fetch("/api/upload-post-image", {
        method: "POST",
        body: fd
      });

      const d = await r.json();
      if(d.url) imageUrls.push(d.url);
    }
  }

  socket.emit("lp-edit-post", {
    postId,
    uid: auth.uid,
    text: newText,
    images: imageUrls
  });

  modal.remove();
};


}


socket.on("lp-edit-post", ({ postId, text, images })=>{
  const postEl = document.querySelector(`.lp-post[data-id="${postId}"]`);
  if(!postEl) return;

  // update text
  const textEl = postEl.querySelector(".lp-post-text");
  if(textEl){
    textEl.innerHTML = text.replace(/\n/g,"<br>");
  }

  // update images
if (images) {
  // 🔥 xoá TẤT CẢ ảnh cũ (1 ảnh hoặc nhiều ảnh)
  postEl.querySelector(".lp-post-images")?.remove();
  postEl.querySelector(".lp-post-img")?.remove();

  if (images.length) {
    const html = `
      <div class="lp-post-images fb-${Math.min(images.length, 5)}">
        ${images.slice(0,5).map((url, index) => `
          <div class="fb-img img-${index}"
            onclick='openFeedLightbox(${JSON.stringify(images)}, ${index})'>
           <img src="${fixMedia(url)}">

            ${index === 4 && images.length > 5
              ? `<div class="fb-more">+${images.length - 5}</div>`
              : ``}
          </div>
        `).join("")}
      </div>
    `;
    postEl.querySelector(".lp-post-text")
      .insertAdjacentHTML("afterend", html);
  }
}


  
  if(postEl.dataset.uid === auth.uid){
    showToast("Post updated successfully");
  }
});



// ===== HIDE TOPBAR + COMPOSE ON SCROLL =====
const topbar = document.querySelector(".lp-topbar");
const composeBar = document.querySelector(".lp-compose");

let lastScrollY = window.scrollY;

window.addEventListener("scroll", () => {
  const curY = window.scrollY;

  // 🔽 Vuốt xuống → hiện
  if (curY < lastScrollY - 10) {
    topbar?.classList.remove("hide");
    composeBar?.classList.remove("hide");
  }
  // 🔼 Vuốt lên → ẩn
  else if (curY > lastScrollY + 10) {
    topbar?.classList.add("hide");
    composeBar?.classList.add("hide");
  }

  // 🧲 Ở đầu trang → luôn hiện
  if (curY < 20) {
    topbar?.classList.remove("hide");
    composeBar?.classList.remove("hide");
  }

  lastScrollY = curY;
}, { passive: true });


// 🔔 NHẬN THÔNG BÁO CÓ TIN NHẮN MỚI
socket.on("inbox-new", (data={}) => {
  showMessageBadge(data.count);
  showMessageToast();
});


function showMessageBadge(count){
  const tab = document.querySelector('.lp-tab[data-tab="messages"]');
  if(!tab) return;

  let badge = tab.querySelector(".badge");
  if(!badge){
    badge = document.createElement("div");
    badge.className = "badge";
    tab.appendChild(badge);
  }

  // nếu có count thì dùng, không thì chỉ hiện chấm đỏ
  if (count && count > 0) {
    badge.textContent = count > 9 ? "9+" : count;
    badge.style.width = "18px";
    badge.style.height = "18px";
    badge.style.borderRadius = "999px";
    badge.style.fontSize = "11px";
    badge.style.display = "flex";
    badge.style.alignItems = "center";
    badge.style.justifyContent = "center";
    badge.style.color = "#fff";
  }
}


function showMessageToast(){
  // tránh spam nhiều toast
  if(document.querySelector(".msg-toast")) return;

  const div = document.createElement("div");
  div.className = "msg-toast";
 div.textContent = "💬 You have a new message";

  Object.assign(div.style,{
    position:"fixed",
    bottom:"90px",
    left:"50%",
    transform:"translateX(-50%)",
    background:"rgba(0,0,0,.85)",
    color:"#fff",
    padding:"10px 16px",
    borderRadius:"999px",
    fontSize:"14px",
    zIndex:10000,
    boxShadow:"0 0 14px rgba(255,59,107,.6)"
  });

  document.body.appendChild(div);

  setTimeout(()=>div.remove(),5000);
}

function clearMessageBadge(){
  const tab = document.querySelector('.lp-tab[data-tab="messages"]');
  const badge = tab?.querySelector(".badge");
  if(badge) badge.remove();
}





/* ==========================================
   SOCIAL LUXURY GIFT COLLECTION V2
========================================== */

const POST_GIFT_NAMES = {
  rose: "Rose",
  beer: "Cheers",
  cake: "Birthday Cake",
  diamond: "Diamond",
  rocket: "Rocket",
  crown: "Royal Crown",
  car: "Supercar",
  castle: "Royal Castle",
  sword: "Divine Sword",
  phoenix: "Phoenix",
  dragon: "Dragon"
};

function openGift(postId, ownerUid) {

  if (giftSendPending) return;


  if (postGiftStorageError) {

    return showToast(

      "Gift storage unavailable. Contact support.",

      "error"

    );

  }


  giftPostId =
    postGiftPending?.postId ?? postId;


  giftPostOwner =
    postGiftPending?.toUid ?? ownerUid;


  selectedPostGift = postGiftPending

    ? POST_GIFTS.find(
        g => g.id === postGiftPending.giftId
      ) ?? null

    : null;

  const modal = document.getElementById("giftModal");
  const box = document.getElementById("giftList");

  if (!modal || !box) return;

  document.getElementById("giftCount").textContent =
    `${POST_GIFTS.length} GIFTS`;

  // Generate gift collection

  box.innerHTML = "";

  POST_GIFTS.forEach(g => {

    const card = document.createElement("button");

    card.type = "button";
    card.className = "lp-gift-card";
    card.dataset.giftId = g.id;


const art = document.createElement("div");
art.className = "lp-gift-art";

const img = document.createElement("img");

img.src = g.image;
img.alt = POST_GIFT_NAMES[g.id] || g.id;

img.className = "lp-gift-image";

img.loading = "lazy";
img.decoding = "async";

img.draggable = false;

img.onerror = function() {
  this.onerror = null;
  this.style.display = "none";
  art.classList.add("lp-gift-art-missing");
};

art.appendChild(img);


    const name = document.createElement("span");
    name.className = "lp-gift-name";
    name.textContent =
      POST_GIFT_NAMES[g.id] || g.id;

    const price = document.createElement("span");
    price.className = "lp-gift-price";

    // Price comes from existing POST_GIFTS config
    price.textContent =
      `💎 ${Number(g.coin).toLocaleString("en-US")}`;

    card.append(art, name, price);

    card.addEventListener("click", () => {
      selectPostGift(g.id);
    });

    box.appendChild(card);

  });

  updateGiftSelection();

  modal.classList.remove("hidden");

}


/* ==========================================
   SELECT GIFT
========================================== */

function selectPostGift(giftId) {

  if (

    giftSendPending ||

    postGiftPending

  ) {

    return;

  }

  const gift = POST_GIFTS.find(
    g => g.id === giftId
  );

  if (!gift) return;

  selectedPostGift = gift;

  updateGiftSelection();

}


/* ==========================================
   UPDATE SELECTION
========================================== */

function updateGiftSelection() {

  const nameEl =
    document.getElementById("selectedGiftName");

  const costEl =
    document.getElementById("selectedGiftCost");

  const amountEl =
    document.getElementById("giftSendAmount");

  const sendBtn =
    document.getElementById("confirmGiftBtn");

  document.querySelectorAll(
    "#giftList .lp-gift-card"
  ).forEach(card => {

    const selected =
      selectedPostGift?.id === card.dataset.giftId;

    card.classList.toggle("selected", selected);

    card.setAttribute(
      "aria-pressed",
      String(selected)
    );

  });


  /* ==========================================
   SOCIAL GIFT RETRY INTERFACE
========================================== */

document.querySelectorAll(

  "#giftList .lp-gift-card"

).forEach(card => {

  card.disabled =

    giftSendPending ||

    Boolean(postGiftPending);

});


sendBtn.firstElementChild.textContent =
  "Send Gift";


if (postGiftPending) {

  nameEl.textContent =

    "Unconfirmed gift: " +

    (
      POST_GIFT_NAMES[postGiftPending.giftId] ||
      postGiftPending.giftId
    );


  costEl.textContent =

    postGiftPending.coin.toLocaleString(
      "en-US"
    );


  amountEl.textContent = "";


  sendBtn.firstElementChild.textContent =

    giftSendPending

      ? "CHECKING..."

      : "CHECK / RETRY";


  sendBtn.disabled = giftSendPending;

  return;

}


  if (!selectedPostGift) {

    nameEl.textContent = "Select a gift";
    costEl.textContent = "—";
    amountEl.textContent = "";

    sendBtn.disabled = true;

    return;
  }

  const g = selectedPostGift;

nameEl.textContent =
  POST_GIFT_NAMES[g.id] || g.id;

  costEl.textContent =
    Number(g.coin).toLocaleString("en-US");

  amountEl.textContent =
    `· ${Number(g.coin).toLocaleString("en-US")} 💎`;

  sendBtn.disabled = giftSendPending;

}


/* ==========================================
   SOCIAL GIFT CONFIRMATION V1.3
========================================== */

function confirmSelectedGift() {

  if (giftSendPending) return;


  if (postGiftStorageError) {

    return showToast(

      "Gift storage unavailable. Contact support.",

      "error"

    );

  }


  /* RETRY ORIGINAL TRANSACTION */

  if (postGiftPending) {

    return sendGift(

      postGiftPending.giftId,

      postGiftPending.coin

    );

  }


  if (

    !selectedPostGift ||

    !giftPostId ||

    !giftPostOwner

  ) {

    return;

  }


  sendGift(

    selectedPostGift.id,

    selectedPostGift.coin

  );

}


/* ==========================================
   SECURE SOCIAL GIFT SEND V1.3
========================================== */

function sendGift(giftId, coin) {

  if (

    giftSendPending ||

    postGiftStorageError ||

    !auth.uid

  ) {

    return;

  }


  if (!socket.connected) {

    return showToast(

      "Connection lost. Please retry.",

      "error"

    );

  }


  /* ======================================
     CREATE NEW TRANSACTION
  ====================================== */

  if (!postGiftPending) {

    const gift = POST_GIFTS.find(

      g => g.id === giftId

    );


    if (

      !giftPostId ||

      !giftPostOwner ||

      !gift ||

      gift.coin !== coin

    ) {

      return;

    }


    const p = {

      postId: giftPostId,

      toUid: giftPostOwner,

      fromUid: auth.uid,

      giftId: gift.id,

      coin: gift.coin,

      requestId: crypto.randomUUID()

    };


    /* SAVE BEFORE SENDING */

    try {

      sessionStorage.setItem(

        postGiftPendingKey,

        JSON.stringify(p)

      );


      postGiftPending = p;


    } catch {

      return showToast(

        "Unable to secure gift transaction.",

        "error"

      );

    }

  }


  const pending = postGiftPending;


  /* ======================================
     VERIFY ORIGINAL SENDER
  ====================================== */

  if (pending.fromUid !== auth.uid) {

    return showToast(

      "Gift sender account mismatch.",

      "error"

    );

  }


  giftSendPending = true;

  updateGiftSelection();


  /* ======================================
     SEND WITH SERVER ACKNOWLEDGEMENT
  ====================================== */

  socket.timeout(10000).emit(

    "lp-gift-post-v13",

    pending,

    (error, reply) => {


      giftSendPending = false;


      /* ==================================
         CONNECTION / COMMIT UNCERTAIN
      ================================== */

      if (

        error ||

        !reply ||

        reply.requestId !== pending.requestId ||

        reply.retrySameRequest === true ||

        (

          reply.ok !== true &&

          !(

            reply.ok === false &&

            reply.retrySameRequest === false

          )

        )

      ) {

        showToast(

          "Gift status unknown. Use CHECK / RETRY.",

          "warn"

        );


        updateGiftSelection();

        return;

      }


      /* ==================================
         CLEAR CONFIRMED TRANSACTION
      ================================== */

      try {

        sessionStorage.removeItem(
          postGiftPendingKey
        );

        postGiftPending = null;


      } catch {

        showToast(

          "Unable to clear pending gift. Retry to check.",

          "warn"

        );

        updateGiftSelection();

        return;

      }


      /* ==================================
         GIFT SUCCESS
      ================================== */

      if (reply.ok === true) {

        closeGift();

        requestSocialFeed();


        showToast(

          reply.postMissing

            ? "Gift paid. Original post is unavailable."

            : "Gift sent successfully.",

          "success"

        );

        return;

      }


      /* ==================================
         SERVER REJECTED TRANSACTION
      ================================== */

      const errors = {

        NOT_ENOUGH_COIN:
          "Insufficient diamonds.",

        GIFT_PRICE_CHANGED:
          "Gift price changed. Refresh this page.",

        POST_UNAVAILABLE:
          "This post is unavailable.",

        ACCOUNT_UNAVAILABLE:
          "Account unavailable."

      };


      const message = Object.hasOwn(
        errors,
        reply.error
      )

        ? errors[reply.error]

        : "Gift rejected. Please check and try again.";


      showToast(message, "error");

      updateGiftSelection();

    }

  );

}

/* ==========================================
   CLOSE GIFT COLLECTION
========================================== */

function closeGift() {

  if (giftSendPending) return;

  document.getElementById("giftModal")
    ?.classList.add("hidden");

  selectedPostGift = null;

  giftPostId = null;
  giftPostOwner = null;

}



// 🔁 REALTIME UPDATE QUÀ + NGƯỜI TẶNG
socket.on("lp-gift-post", ({

  postId,

  total,

  fromUid,

  byUserAmount

}) => {

  // 1️⃣ cập nhật tổng quà
  const el = document.getElementById("g_" + postId);
  if (el) el.textContent = total;

  // 2️⃣ cập nhật cache post
  const post = window.lpPostMap?.[postId];
  if (!post) return;

  post.gifts ||= { total: 0, byUser: {} };
  post.gifts.total = total;

  // 3️⃣ cập nhật người tặng (realtime)
/* ==========================================
   AUTHORITATIVE GIFT TOTAL
   PREVENT DUPLICATE UI INCREMENT
========================================== */

if (

  fromUid &&

  Number.isSafeInteger(byUserAmount) &&

  byUserAmount >= 0

) {

  post.gifts.byUser[fromUid] =
    byUserAmount;

} else {

  requestSocialFeed();

  return;

}

  // 4️⃣ update UI danh sách người tặng nếu đang mở
  const box = document.querySelector(
    `.lp-post[data-id="${postId}"] .lp-gift-users`
  );
  if (box) {
    box.innerHTML = `
      🎁
      ${Object.entries(post.gifts.byUser)
        .slice(0,3)
        .map(([uid,amt]) => `<span class="gift-user">${amt}💎</span>`)
        .join(" ")}
      ${Object.keys(post.gifts.byUser).length > 3 ? "…" : ""}
    `;
  }
});






/* ==========================================
   OPEN USER PROFILE
   SMOOTH PAGE TRANSITION
========================================== */

function openUserProfile(uid) {

  if (!uid) return;

  const url =
    "/profile.html?uid=" + encodeURIComponent(uid);

  if (window.LSPTransition?.go) {

    LSPTransition.go(url, {
      label: "Opening user profile..."
    });

  } else {

    window.location.href = url;

  }

}



socket.on("system-notify", data => {

  if (!data) return;

  // COIN TOP-UP
  if (data.type === "topup") {
    showToast(
      data.text || "Coins have been added to your account",
      "success"
    );
    return;
  }

  // COIN DEDUCTION
  if (data.type === "withdraw") {
    notifyWithdraw(data);
  }

  // ACCOUNT LOCKED
  if (data.type === "lock") {

    showToast(
      data.reason || "Your account has been locked",
      "error"
    );

    localStorage.removeItem("user_profile");
    localStorage.removeItem("login_uid");
    localStorage.removeItem("isGuest");

    setTimeout(() => {
      location.href = "/login.html";
    }, 2000);
  }

});



function showToast(text, type = "info", timeout = 3500){
  const box = document.getElementById("toast-container");
  if(!box) return;

  const icons = {
    info:"ℹ️",
    success:"✅",
    error:"❌",
    warn:"⚠️"
  };

  const div = document.createElement("div");
  div.className = `toast ${type}`;
  div.innerHTML = `
    <span class="icon">${icons[type] || "🔔"}</span>
    <span class="msg">${text}</span>
  `;

  box.appendChild(div);

  setTimeout(()=>div.remove(), timeout);
}



function showWithdrawNotify(data) {

  const text =
    data.text ||
    "Coins have been deducted from your account";

  openSysModal(text);

}

function notifyWithdraw(data) {

  const text =
    data?.text ||
    "Coins have been deducted from your account";

  if (typeof openSysModal === "function") {
    openSysModal(text);
    return;
  }

  if (typeof showToast === "function") {
    showToast(text, "error", 5000);
    return;
  }

}



/* ==========================================
   SOCIAL - PREMIUM GIFT SENDERS V2
========================================== */

function openGiftUsers(postId) {

  const post = window.lpPostMap?.[postId];

  if (!post) return;

  const byUser = post.gifts?.byUser || {};

  const modal =
    document.getElementById("giftUserModal");

  const list =
    document.getElementById("giftUserList");

  const totalEl =
    document.getElementById("giftUsersTotal");

  const countEl =
    document.getElementById("giftUsersCount");

  if (!modal || !list || !totalEl || !countEl) {
    return;
  }

  // Lấy người đã tặng và tổng tiền từng người
  const users = Object.entries(byUser)
    .map(([uid, amount]) => ({
      uid,
      amount: Number(amount) || 0
    }))
    .filter(u => u.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const total = users.reduce(
    (sum, u) => sum + u.amount,
    0
  );

  totalEl.textContent =
    `${total.toLocaleString("en-US")} 💎`;

  countEl.textContent =
    users.length.toLocaleString("en-US");

  list.replaceChildren();

  if (!users.length) {

    const empty = document.createElement("div");
    empty.className = "lp-gift-senders-empty";

    empty.textContent =
      "No gifts have been sent to this post yet.";

    list.appendChild(empty);

    modal.classList.remove("hidden");
    return;

  }

  users.forEach(({uid, amount}, index) => {

    const user = window.allUsers?.[uid];

    const name =
      user?.name || uid;

    const avatar = fixAvatar(user?.avatar);
 
    // CARD
    const card = document.createElement("button");

    card.type = "button";
    card.className = "lp-gift-sender-card";

    // AVATAR
    const img = document.createElement("img");

    img.className = "lp-gift-sender-avatar";
    img.src = avatar;
    img.alt = "";
    img.loading = "lazy";

  img.onerror = function() {
  this.onerror = null;
  this.src = DEFAULT_AVATAR;
};

    // INFO
    const info = document.createElement("div");
    info.className = "lp-gift-sender-info";

    const nameEl = document.createElement("div");
    nameEl.className = "lp-gift-sender-name";
    nameEl.textContent = name;

    const uidEl = document.createElement("div");
    uidEl.className = "lp-gift-sender-uid";
    uidEl.textContent = `UID ${uid}`;

    info.append(nameEl, uidEl);

    // RIGHT SIDE
    const right = document.createElement("div");
    right.className = "lp-gift-sender-right";

    const amountEl = document.createElement("div");
    amountEl.className = "lp-gift-sender-amount";

    amountEl.textContent =
      `${amount.toLocaleString("en-US")} 💎`;

    const rankEl = document.createElement("div");
    rankEl.className = "lp-gift-sender-rank";

    rankEl.textContent =
      `#${index + 1} SUPPORTER`;

    right.append(amountEl, rankEl);

    card.append(img, info, right);

    // Bấm vào xem hồ sơ người tặng
    card.addEventListener("click", () => {

      closeGiftUsers();

      openUserProfile(uid);

    });

    list.appendChild(card);

  });

  // Reset scroll mỗi lần mở
  list.scrollTop = 0;

  modal.classList.remove("hidden");

}


/* ==========================================
   CLOSE GIFT SENDERS
========================================== */

function closeGiftUsers() {

  const modal =
    document.getElementById("giftUserModal");

  modal?.classList.add("hidden");

}




function showForceLogoutModal(message){
  let modal = document.getElementById("forceLogoutModal");
  if(!modal){
    modal = document.createElement("div");
    modal.id = "forceLogoutModal";
    modal.innerHTML = `
      <div class="fl-backdrop"></div>
<div class="fl-box">

  <div class="fl-icon">🚫</div>

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

  modal.querySelector(".fl-msg").textContent = message;
  modal.classList.add("show");
}


socket.on("force-logout", (data) => {
  const msg = data?.message || "You have been signed out";

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


