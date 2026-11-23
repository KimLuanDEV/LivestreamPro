

const MAX_VIEWERS = 5;
const SOFT_CAP = 4;

const bcrypt = require("bcrypt");
const crypto = require("crypto");


const ROOM_RELEASE_DELAY = 30000; // 30 giây (tuỳ bạn)

const multer = require("multer");
const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const {
  AccessToken,
  RoomServiceClient,
  TrackSource
} = require("livekit-server-sdk");

const twilio = require("twilio");


const fs = require("fs");









// ================================
// 📜 WHEEL8 USER BET HISTORY
// ================================
const WHEEL8_USER_HISTORY_FILE =
"/opt/render/project/data/wheel8_user_history.json"

function loadWheel8UserHistory(){

try{

if(!fs.existsSync(WHEEL8_USER_HISTORY_FILE))
return {}

return JSON.parse(
fs.readFileSync(WHEEL8_USER_HISTORY_FILE,"utf8")
)

}catch(e){

console.error("❌ Load wheel8 user history failed",e)
return {}

}

}

function saveWheel8UserHistory(db){

try{

fs.writeFileSync(
WHEEL8_USER_HISTORY_FILE,
JSON.stringify(db,null,2)
)

}catch(e){

console.error("❌ Save wheel8 user history failed",e)

}

}



function getAdminWheel8Data(){

  const users = loadUsers()

  const slotPool = [0,0,0,0,0,0,0,0]

  const map = {}

  wheel8Round.bets.forEach(b=>{

    // tổng pool
    slotPool[b.slot-1] += b.bet

    // gom theo user
    if(!map[b.uid]){
   map[b.uid] = {
  name: users[b.uid]?.profile?.name || "Player",
  coins: users[b.uid]?.profile?.coins || 0,
  total: 0,
  slots: [0,0,0,0,0,0,0,0]
}
    }

    map[b.uid].slots[b.slot-1] += b.bet
    map[b.uid].total += b.bet

  })

  return {
    round: wheel8Round.id,
    pool: slotPool,
    players: Object.values(map)
  }
}



function getTimeRaceBetList(){

 
  const list = {}

  // 👤 PLAYER
  timeRaceRound.bets.forEach(b=>{
    if(!list[b.uid]){
      list[b.uid] = {
        name: "???",
        total: 0
      }
    }
    list[b.uid].total += b.bet
  })

  // 🤖 BOT (KHÔNG RANDOM LẠI)
  if(timeRaceRound.bots){
    timeRaceRound.bots.forEach(bot=>{
      list[bot.uid] = bot
    })
  }

  return Object.values(list)
}



let wheel8UserHistory = loadWheel8UserHistory()
let wheel8NeedReset = false


const WHEEL8_ROUND_FILE =
"/opt/render/project/data/wheel8_round_count.json"

function loadWheel8Round(){

try{

if(!fs.existsSync(WHEEL8_ROUND_FILE)){
return {
dayTs: getTodayStartTsVN(),
count: 0
}
}

return JSON.parse(
fs.readFileSync(WHEEL8_ROUND_FILE,"utf8")
)

}catch(e){

console.error("Load wheel8 round failed",e)

return {
dayTs: getTodayStartTsVN(),
count: 0
}

}

}

function saveWheel8Round(data){

try{

fs.writeFileSync(
WHEEL8_ROUND_FILE,
JSON.stringify(data,null,2)
)

}catch(e){
console.error("Save wheel8 round failed",e)
}

}

const WHEEL8_HISTORY_FILE =
"/opt/render/project/data/wheel8_history.json"

const MAX_WHEEL8_HISTORY = 500


function loadWheel8History(){
  try{
    if(!fs.existsSync(WHEEL8_HISTORY_FILE)) return []
    return JSON.parse(
      fs.readFileSync(WHEEL8_HISTORY_FILE,"utf8")
    )
  }catch(e){
    console.error("❌ Load wheel8 history failed",e)
    return []
  }
}

function saveWheel8History(list){
  try{
    fs.writeFileSync(
      WHEEL8_HISTORY_FILE,
      JSON.stringify(list,null,2)
    )
  }catch(e){
    console.error("❌ Save wheel8 history failed",e)
  }
}








// ================================
// 🧠 HEALTH DATA (PER USER)
// ================================
const HEALTH_DIR = path.join("/opt/render/project/data", "health");

if (!fs.existsSync(HEALTH_DIR)) {
  fs.mkdirSync(HEALTH_DIR, { recursive: true });
  console.log("📁 Created health data dir");
}




const ONE_DAY = 24 * 60 * 60 * 1000; // 🔥 24h


// ================================
// 🔢 RPS ROUND COUNT PERSIST (24H)
// ================================
const RPS_ROUND_COUNT_FILE =
  "/opt/render/project/data/rps_round_count.json";

function loadRpsRoundCount(){
  try{
    if (!fs.existsSync(RPS_ROUND_COUNT_FILE)) {
      return {
        dayTs: getTodayStartTsVN(),
        count: 0
      };
    }
    return JSON.parse(
      fs.readFileSync(RPS_ROUND_COUNT_FILE, "utf8")
    );
  }catch(e){
    console.error("❌ Load RPS round count failed", e);
    return {
      dayTs: getTodayStartTsVN(),
      count: 0
    };
  }
}

function saveRpsRoundCount(data){
  try{
    fs.writeFileSync(
      RPS_ROUND_COUNT_FILE,
      JSON.stringify(data, null, 2)
    );
  }catch(e){
    console.error("❌ Save RPS round count failed", e);
  }
}






function getTodayStartTsVN() {
  // VN = UTC+7
  const offsetMin = 7 * 60;

  const now = Date.now();

  // đổi sang "giờ VN"
  const vnNow = now + offsetMin * 60 * 1000;

  // lấy 00:00 theo VN (tính trên epoch VN)
  const vnDayStart = Math.floor(vnNow / ONE_DAY) * ONE_DAY;

  // trả về timestamp thật (UTC epoch)
  return vnDayStart - offsetMin * 60 * 1000;
}




/* ==========================================
   TIME RACE - DAILY BET HISTORY
   Vietnam Time GMT+7
========================================== */

function filterTimeRaceHistoryToday(list) {

  const todayStart = getTodayStartTsVN();
  const todayEnd = todayStart + 86400000;

  if (!Array.isArray(list)) {
    return [];
  }

  return list.filter(item => {

    const ts = Number(item?.ts);

    return (
      Number.isFinite(ts) &&
      ts >= todayStart &&
      ts < todayEnd
    );

  }).slice(0, 30);

}




// ================================
// ✊✋✌️ RPS HISTORY (GLOBAL)
// ================================
const RPS_HISTORY_FILE =
  "/opt/render/project/data/rps_history.json";

const MAX_RPS_HISTORY = 20;

function loadRpsHistory(){
  try{
    if(!fs.existsSync(RPS_HISTORY_FILE)) return [];
    return JSON.parse(fs.readFileSync(RPS_HISTORY_FILE,"utf8"));
  }catch(e){
    console.error("❌ Load RPS history failed", e);
    return [];
  }
}

function saveRpsHistory(list){
  try{
    fs.writeFileSync(
      RPS_HISTORY_FILE,
      JSON.stringify(list,null,2)
    );
  }catch(e){
    console.error("❌ Save RPS history failed", e);
  }
}

let rpsHistoryGlobal = loadRpsHistory();




// ================================
// 👑⚔ KING VS SLAVE (SOLO VS SERVER)
// ================================
let ksRoundId = 1;
let ksKingIndex = Math.floor(Math.random() * 5); // 🎯 random KING mỗi round
let ksSlaveIndex = Math.floor(Math.random() * 5);
const ksUserState = new Map();

// helper: tạo deck và pick index

function ksPickKingIndex(){
  // 5 lá: 4 common + 1 king => random 0..4
  return Math.floor(Math.random()*5);
}


function getFavIndex(history){

  if(!history || history.length < 5) return null;

  const count = {};

  history.forEach(i=>{
    count[i] = (count[i]||0)+1;
  });

  let maxIndex = null;
  let maxCount = 0;

  for(const k in count){
    if(count[k] > maxCount){
      maxCount = count[k];
      maxIndex = Number(k);
    }
  }

  // nếu 1 vị trí chiếm >50% lượt gần đây
  if(maxCount / history.length >= 0.6){
    return maxIndex;
  }

  return null;
}



function ksCardByIndex(role, idx){

  if(role === "king"){
    return idx === ksKingIndex
      ? "KING"
      : "Warrior";
  }

  if(role === "player"){
    return idx === ksSlaveIndex
      ? "SLAVE"
      : "Warrior";
  }

  return "Warrior";
}









const webpush = require("web-push");

const { uploadToR2 } = require("./r2");




const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "";

function normalizeAvatar(url) {
  if (!url) return "";

  // avatar legacy dạng /avatars/xxx.jpg
  if (url.startsWith("/avatars/")) {
    return R2_PUBLIC_URL + url;
  }

  return url;
}




const chatUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }
});

const avatarCoverUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

const postMediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB (video)
});



const LIVE_STATE_FILE = path.join("/opt/render/project/data", "live_state.json");
const SOCIAL_FILE = path.join("/opt/render/project/data", "social_posts.json");
const MEDIA_DIRS = [
  "/opt/render/project/data/post-images",
  "/opt/render/project/data/post-videos"
];

MEDIA_DIRS.forEach(dir=>{
  if(!fs.existsSync(dir)){
    fs.mkdirSync(dir,{ recursive:true });
    console.log("📁 Created", dir);
  }
});







const INBOX_FILE = "/opt/render/project/data/inbox.json";

function loadInbox(){
  try{
    if(!fs.existsSync(INBOX_FILE)) return {};
    const raw = fs.readFileSync(INBOX_FILE,"utf8");
    if(!raw.trim()) return {};
    return JSON.parse(raw);
  }catch(e){
    console.error("❌ Inbox JSON corrupted → reset", e.message);
    return {};
  }
}










const MARKET_FILE = "/opt/render/project/data/market_booths.json";

function loadMarket(){
  if(!fs.existsSync(MARKET_FILE)) return {};
  return JSON.parse(fs.readFileSync(MARKET_FILE,"utf8"));
}
function saveMarket(db){
  fs.writeFileSync(MARKET_FILE, JSON.stringify(db,null,2));
}


// 🔒 HELPER: CHẶN MỌI HÀNH ĐỘNG KHI BOOTH BỊ KHOÁ
function blockIfBoothLockedById(boothId, uid) {
  if (!boothId || !uid) return false;

  const market = loadMarket();
  const booth = market[boothId];
  if (!booth) return false;

  const users = loadUsers();
  const me = users[uid];
  const isAdmin = me?.role === "admin";

  return booth.locked && !isAdmin;
}


function blockSocketIfBoothLocked(socket, boothId) {
  const uid = socket.data.uid;
  if (!uid || !boothId) return false;

if (blockIfBoothLockedById(boothId, uid)) {
  socket.emit("booth-locked", {
    boothId,
    message: "This booth has been locked by an admin"
  });
    return true;
  }
  return false;
}



function cleanupExpiredBooths(){
  const market = loadMarket();
  let changed = false;
  const now = Date.now();

  Object.keys(market).forEach(id=>{
    const booth = market[id];
    if(!booth) return;

    if(booth.expireAt && booth.expireAt < now){
      console.log("⏱ Booth expired:", id);
      market[id] = null;
      changed = true;
    }
  });

  if(changed){
    saveMarket(market);
  }
}






const WITHDRAW_FILE = "/opt/render/project/data/withdraw_requests.json";

function loadWithdraws(){
  if(!fs.existsSync(WITHDRAW_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(WITHDRAW_FILE, "utf8"));
  } catch {
    return [];
  }
}


function saveWithdraws(list){
  fs.writeFileSync(WITHDRAW_FILE, JSON.stringify(list, null, 2));
}





function saveInbox(db){
  fs.writeFileSync(INBOX_FILE, JSON.stringify(db,null,2));
}

let userInbox = new Map(Object.entries(loadInbox()));









function loadLiveState() {
  try {
    if (!fs.existsSync(LIVE_STATE_FILE)) return {};
    return JSON.parse(fs.readFileSync(LIVE_STATE_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveLiveState(state) {
  try {
    fs.writeFileSync(LIVE_STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error("Save live state failed:", e);
  }
}

function loadSocial(){
  try{
    if(!fs.existsSync(SOCIAL_FILE)) return [];
    return JSON.parse(fs.readFileSync(SOCIAL_FILE,"utf8"));
  }catch(e){
    console.error("Load social failed",e);
    return [];
  }
}


function saveSocial() {
  try {
    fs.writeFileSync(
      SOCIAL_FILE,
      JSON.stringify(lpPosts, null, 2)
    );
    return true;

  } catch (error) {
    console.error("Save social failed", error);
    return false;
  }
}



const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });


/* ==========================================
   SOCKET.IO - ENGINE ERROR DIAGNOSTICS
========================================== */

io.engine.on("connection_error", err => {

  console.warn("[ENGINE.IO] Connection error", {
    code: err.code,
    message: err.message,
    context: err.context,
    transport: err.req?._query?.transport
  });

});



const activeUsers = new Map();




/* =========================================
   WHEEL8 - DAILY USER BET HISTORY
   RESET AT 00:00 VIETNAM TIME
========================================= */

let wheel8HistoryDayTs = null;

function cleanWheel8UserHistory(forceSave = false) {

  const todayStart = getTodayStartTsVN();
  const todayEnd = todayStart + 86400000;

  const isNewDay =
    wheel8HistoryDayTs !== null &&
    wheel8HistoryDayTs !== todayStart;

  // Không cần xử lý lại nếu vẫn cùng ngày
  if (!forceSave && wheel8HistoryDayTs === todayStart) {
    return;
  }

  const cleanedHistory = {};
  let changed = false;

  for (const [uid, list] of Object.entries(wheel8UserHistory || {})) {

    if (!Array.isArray(list)) {
      changed = true;
      continue;
    }

    // Chỉ giữ lịch sử thuộc ngày hôm nay
    const todayHistory = list.filter(item => {

      const ts = Number(item?.ts);

      return (
        Number.isFinite(ts) &&
        ts >= todayStart &&
        ts < todayEnd
      );

    });

    if (todayHistory.length !== list.length) {
      changed = true;
    }

    if (todayHistory.length > 0) {
      cleanedHistory[uid] = todayHistory;
    } else {
      changed = true;
    }

  }

  wheel8UserHistory = cleanedHistory;
  wheel8HistoryDayTs = todayStart;

  // Lưu dữ liệu đã được làm sạch
  if (changed || forceSave) {
    saveWheel8UserHistory(wheel8UserHistory);
  }

  // Thông báo tới tất cả người chơi khi qua ngày mới
  if (isNewDay) {

    console.log("WHEEL8: RESET DAILY BET HISTORY");

    io.emit("wheel8-my-history-reset", {
      dayTs: todayStart
    });

  }

}

// Làm sạch lịch sử ngay khi server khởi động
cleanWheel8UserHistory();

// Kiểm tra ngày mới mỗi giây
setInterval(() => {
  cleanWheel8UserHistory();
}, 1000);





// ================================
// 🎡 LUCKY WHEEL 8 ENGINE
// ================================

// load history
let wheel8History = loadWheel8History()

// chỉ giữ 24h
const ONE_DAYS = 24 * 60 * 60 * 1000

wheel8History = wheel8History.filter(
  h => Date.now() - h.ts <= ONE_DAYS
)

saveWheel8History(wheel8History)


// ================================
// ROUND STATE
// ================================

const wheel8State = loadWheel8Round()

let wheel8RoundCounter = wheel8State.count || 0
let wheel8RoundDayTs   = wheel8State.dayTs || getTodayStartTsVN()

const wheel8TodayStart = getTodayStartTsVN()

// reset khi qua ngày
if(wheel8TodayStart !== wheel8RoundDayTs){

  wheel8RoundCounter = 0
  wheel8RoundDayTs = wheel8TodayStart

  saveWheel8Round({
    dayTs: wheel8RoundDayTs,
    count: wheel8RoundCounter
  })

}


// ================================
// SLOT TABLE
// ================================

const WHEEL8_SLOTS = [
  { m:5,  w:19.6 },
  { m:10, w:10 },
  { m:15, w:6.6 },
  { m:25, w:4 },
  { m:45, w:1 },
  { m:5,  w:19.6 },
  { m:5,  w:19.6 },
  { m:5,  w:19.6 }
];


// ================================
// CREATE ROUND
// ================================




/* =====================================
   WHEEL8 ADMIN PASSWORD AUTHENTICATION
===================================== */

const WHEEL8_ADMIN_ROOM = "wheel8-admin";
const WHEEL8_ADMIN_PASSWORD =
  process.env.WHEEL8_ADMIN_PASSWORD || "";

function wheel8PasswordMatches(password) {
  if (!WHEEL8_ADMIN_PASSWORD) return false;
  if (typeof password !== "string") return false;
  if (password.length > 256) return false;

  const provided = crypto
    .createHash("sha256")
    .update(password, "utf8")
    .digest();

  const expected = crypto
    .createHash("sha256")
    .update(WHEEL8_ADMIN_PASSWORD, "utf8")
    .digest();

  return crypto.timingSafeEqual(provided, expected);
}

function emitWheel8Admin(event, data) {
  io.to(WHEEL8_ADMIN_ROOM).emit(event, data);
}





function createWheel8Round(){

  const todayStart = getTodayStartTsVN()

  // 🔥 nếu qua ngày → chỉ đánh dấu (KHÔNG reset ngay)
  if(todayStart !== wheel8RoundDayTs){
    wheel8NeedReset = true
  }

  // 🔥 nếu cần reset → reset TRƯỚC khi tạo round mới
  if(wheel8NeedReset){

    console.log("🌅 RESET AFTER ROUND FINISH")

    wheel8RoundCounter = 0
    wheel8RoundDayTs = todayStart
    wheel8NeedReset = false

    saveWheel8Round({
      dayTs: wheel8RoundDayTs,
      count: wheel8RoundCounter
    })
  }

  // 🔢 TĂNG ROUND
  wheel8RoundCounter++


const round = {
  id: wheel8RoundCounter,
  startAt: Date.now(),
  endAt: Date.now() + 35000,
  bets: [],
  slotPool: [0,0,0,0,0,0,0,0],

  // Chọn ngẫu nhiên một slot chỉ để hiển thị lửa
  hotSlot: crypto.randomInt(1, 9),

  hotSlotEmitted: false
};



  
  // 🔐 SECRET
  const result = pickWheel8()

  round.secret = {
    slot: result.slot,
    multiplier: result.multiplier,
    hash: crypto
      .createHash("sha256")
      .update(round.id + ":" + result.slot + ":" + result.multiplier)
      .digest("hex")
  }

  // 🔔 ADMIN
 emitWheel8Admin("admin-wheel8-secret", {
    roundId: round.id,
    slot: round.secret.slot,
    multiplier: round.secret.multiplier,
    hash: round.secret.hash,
    endAt: round.endAt
  })

  saveWheel8Round({
    dayTs: wheel8RoundDayTs,
    count: wheel8RoundCounter
  })

  return round
}

let wheel8Round = createWheel8Round()

let lastWheel8Result = null






function pickWheel8(){

const total = WHEEL8_SLOTS.reduce((s,x)=>s+x.w,0)

let r = Math.random()*total

for(let i=0;i<WHEEL8_SLOTS.length;i++){

const s = WHEEL8_SLOTS[i]

if((r-=s.w)<=0){
return {
slot:i+1,
multiplier:s.m
}
}

}

return {slot:1,multiplier:5}

}



/* ==========================================
   WHEEL8 - PREPARE FINAL STOP
========================================== */

function w8PrepareFinalStop(round) {
  if (!round || round.finalStop) return;

  let winSlots;
  let multiplier;
  let specialEvent = false;

  if (round.forcedEvent === "x5-all") {
    specialEvent = true;
    winSlots = [1, 6, 7, 8];
    multiplier = 5;

  } else if (round.forcedEvent === "x45-all") {
    specialEvent = true;
    winSlots = [2, 3, 4, 5];
    multiplier = 45;

  } else if (round.secret.overridden) {
    winSlots = [round.secret.slot];
    multiplier = round.secret.multiplier;

  } else if (Math.random() < 0.0001) {
    specialEvent = true;

    if (Math.random() < 0.5) {
      winSlots = [1, 6, 7, 8];
      multiplier = 5;
    } else {
      winSlots = [2, 3, 4, 5];
      multiplier = 45;
    }

  } else {
    winSlots = [round.secret.slot];
    multiplier = round.secret.multiplier;
  }

  round.finalStop = {
    winSlots,
    multiplier,
    specialEvent
  };


io.emit("wheel8-final-stop", {
  roundId: round.id,
  targetSlot: winSlots[0],
  winSlots: [...winSlots],
  endAt: round.endAt
});



}




// ================================
// ⏱ WHEEL8 TIMER REALTIME
// ================================

let w8LastTimerValue = null;

setInterval(() => {
  const remainingMs =
    Math.max(0, wheel8Round.endAt - Date.now());

  const remain = Math.max(
    0,
    Math.ceil(remainingMs / 1000)
  );

  // Phát timer khi số giây thay đổi
  if (remain !== w8LastTimerValue) {
    w8LastTimerValue = remain;
    io.emit("wheel8-timer", remain);
  }


// ==========================================
// HOT SLOT - TRIGGER AT 25 SECONDS
// ==========================================

if (
  remainingMs <= 25000 &&
  remainingMs > 0 &&
  !wheel8Round.hotSlotEmitted
) {
  wheel8Round.hotSlotEmitted = true;

  io.emit("wheel8-hot-slot", {
    roundId: wheel8Round.id,
    slot: wheel8Round.hotSlot
  });
}




  // Khóa kết quả trước khi bắt đầu giảm tốc
  if (
    remainingMs <= 5000 &&
    remainingMs > 0 &&
    !wheel8Round.finalStop
  ) {
    w8PrepareFinalStop(wheel8Round);
  }
}, 100);



// ================================
// 🎯 WHEEL8 PREDICTION
// ================================
function generateWheel8Prediction(){

  const arr = []

  while(arr.length < 3){

    const s = Math.floor(Math.random()*8)+1

    if(!arr.includes(s)){
      arr.push(s)
    }

  }

  return arr

}



/* ==========================================
   WHEEL8 - DOUBLE OR NOTHING ENGINE
========================================== */

const W8_DOUBLE_TIMEOUT = 60000;

// Thanh toán một lời mời nhân đôi
function settleWheel8Double(uid, action) {
  const users = loadUsers();
  const user = users[uid];

  if (!user?.profile) {
    return { ok: false, message: "Account not found" };
  }

  const offer = user.wheel8DoubleOffer;

  if (!offer || offer.status !== "pending") {
    return { ok: false, message: "No pending reward" };
  }

  if (!["keep", "red", "black"].includes(action)) {
    return { ok: false, message: "Invalid selection" };
  }

  const profit = Math.floor(Number(offer.profit));

  if (!Number.isSafeInteger(profit) || profit <= 0) {
    return { ok: false, message: "Invalid reward" };
  }

  // Hết thời gian thì tự động giữ phần lãi
  if (Date.now() >= offer.expiresAt) {
    action = "keep";
  }

  let color = null;
  let win = false;
  let reward = profit;

  if (action !== "keep") {
    color = crypto.randomInt(2) === 0
      ? "red"
      : "black";

    win = action === color;
    reward = win ? profit * 2 : 0;
  }

  if (!Number.isSafeInteger(reward)) {
    return { ok: false, message: "Reward exceeds limit" };
  }

  const balance = Number(user.profile.coins || 0);

  if (!Number.isSafeInteger(balance) ||
      !Number.isSafeInteger(balance + reward)) {
    return { ok: false, message: "Invalid balance" };
  }

  user.profile.coins = balance + reward;

  offer.status = "completed";
  offer.action = action;
  offer.color = color;
  offer.win = win;
  offer.reward = reward;
  offer.completedAt = Date.now();

  saveUsers(users);
  emitCoinUpdate(uid);

  const result = {
    ok: true,
    roundId: offer.roundId,
    action,
    color,
    win,
    profit,
    reward
  };

  emitToUser(uid, "wheel8-double-result", result);

  return result;
}

// Tự động trả phần lãi khi người chơi không lựa chọn
setInterval(() => {
  const users = loadUsers();
  const expired = [];

  for (const [uid, user] of Object.entries(users)) {
    const offer = user?.wheel8DoubleOffer;

    if (
      offer?.status === "pending" &&
      Date.now() >= offer.expiresAt
    ) {
      expired.push(uid);
    }
  }

  for (const uid of expired) {
    settleWheel8Double(uid, "keep");
  }
}, 15000);



// ================================
// 🎡 WHEEL8 AUTO ROUND
// ================================
setInterval(()=>{

const users = loadUsers()


// ==========================================
// USE PREPARED RESULT
// ==========================================

// Dự phòng khi timer bị trễ
if (!wheel8Round.finalStop) {
  w8PrepareFinalStop(wheel8Round);
}

const {
  winSlots,
  multiplier,
  specialEvent
} = wheel8Round.finalStop;

const resultSlot = winSlots[0] || 1;



// =======================
// 💰 PAYOUT
// =======================

wheel8Round.bets.forEach(o=>{

const me = users[o.uid]
if(!me?.profile) return

let win = 0

if(winSlots.includes(o.slot)){

  // lấy multiplier theo slot
  const slotMulti = WHEEL8_SLOTS[o.slot-1].m

  win = o.bet * slotMulti

 

}

// =====================
// 📜 SAVE USER HISTORY
// =====================

if(!wheel8UserHistory[o.uid])
wheel8UserHistory[o.uid] = []

wheel8UserHistory[o.uid].unshift({
roundId: wheel8Round.id,
slot: o.slot,
bet: o.bet,
multiplier: multiplier,
win: win,
winSlot: resultSlot,
event: specialEvent
  ? (winSlots.includes(1) ? "x5-all" : "x45-all")
  : null,
ts: Number(wheel8Round.startAt) || Date.now()
})


// ===========================
// 🔒 GIỮ 50 ROUND GẦN NHẤT
// ===========================

const roundMap = {}

wheel8UserHistory[o.uid].forEach(r=>{

if(!roundMap[r.roundId]){
roundMap[r.roundId] = []
}

roundMap[r.roundId].push(r)

})

const roundIds =
Object.keys(roundMap)
.sort((a,b)=>{

const ta = roundMap[a][0]?.ts || 0
const tb = roundMap[b][0]?.ts || 0

return tb - ta

})
.slice(0,50)

const newHistory = []

roundIds.forEach(id=>{
newHistory.push(...roundMap[id])
})

wheel8UserHistory[o.uid] = newHistory

})




// ==========================================
// DOUBLE REWARD - SETTLE ROUND PAYOUT
// ==========================================

const wheel8Totals = new Map();
const wheel8NewOffers = [];

for (const betEntry of wheel8Round.bets) {
  const uid = betEntry.uid;

  if (!wheel8Totals.has(uid)) {
    wheel8Totals.set(uid, {
      totalBet: 0,
      totalWin: 0
    });
  }

  const item = wheel8Totals.get(uid);

  item.totalBet += betEntry.bet;

  if (winSlots.includes(betEntry.slot)) {
    item.totalWin +=
      betEntry.bet * WHEEL8_SLOTS[betEntry.slot - 1].m;
  }
}

for (const [uid, totals] of wheel8Totals) {
  const user = users[uid];
  if (!user?.profile) continue;

  const previous = user.wheel8DoubleOffer;

  // Bảo vệ lời mời cũ chưa xử lý:
  // tự động nhận phần lãi trước khi tạo lời mời mới.
  if (previous?.status === "pending") {
    user.profile.coins += previous.profit;
    previous.status = "completed";
    previous.action = "keep";
    previous.reward = previous.profit;
    previous.completedAt = Date.now();
  }

  const profit = totals.totalWin - totals.totalBet;

  if (profit > 0) {
    // Chỉ trả phần vốn trước, giữ lãi chờ quyết định
    user.profile.coins += totals.totalBet;

    user.wheel8DoubleOffer = {
      roundId: wheel8Round.id,
      profit,
      totalBet: totals.totalBet,
      totalWin: totals.totalWin,
      expiresAt: Date.now() + W8_DOUBLE_TIMEOUT,
      status: "pending"
    };

    wheel8NewOffers.push({
      uid,
      offer: user.wheel8DoubleOffer
    });
  } else {
    // Không có lãi: thanh toán bình thường
    user.profile.coins += totals.totalWin;
  }
}


// 💾 LƯU LỊCH SỬ CHỈ TRONG NGÀY
cleanWheel8UserHistory(true)


// lưu user
saveUsers(users)


// Thông báo riêng cho từng người chơi có lãi
for (const item of wheel8NewOffers) {
  emitToUser(item.uid, "wheel8-double-offer", {
    roundId: item.offer.roundId,
    profit: item.offer.profit,
    expiresAt: item.offer.expiresAt
  });
}

// =======================
// 💎 REALTIME COIN UPDATE
// =======================

wheel8Round.bets.forEach(o=>{
emitCoinUpdate(o.uid)
})


// =======================
// 🏆 TOP WINNERS
// =======================

const winMap = {}

wheel8Round.bets.forEach(o=>{

  let win = 0

  if(winSlots.includes(o.slot)){
    const slotMulti = WHEEL8_SLOTS[o.slot-1].m
    win = o.bet * slotMulti
  }

  if(win > 0){

const users = loadUsers()
const user = users[o.uid]

let displayName = "???"

if(user?.profile?.showTopName){
  displayName = user.profile.name
}

if(!winMap[o.uid]){
  winMap[o.uid] = {
    uid:o.uid,
    name:displayName,
    win:0
  }
}

    winMap[o.uid].win += win
  }

})


// =======================
// 🤖 BOT CONFIG
// =======================

const botNames = [
  "???","???","???",
  "???","???","???"
]

function fakeWin(winSlots){

  let totalWin = 0

  // 🔥 detect event (multi-slot)
  const isEvent = winSlots.length > 1

  // =========================
  // 🎯 EVENT → cược nhiều slot
  // =========================
  if(isEvent){

    const betCount = Math.floor(Math.random()*3) + 2 // 2 → 4 slot

    for(let i=0;i<betCount;i++){

      const slotIndex =
        Math.floor(Math.random()*WHEEL8_SLOTS.length) + 1

      const slot = WHEEL8_SLOTS[slotIndex-1]
      const m = slot.m

      let betList

      if(m === 5){
        betList = [500,600,700,800,900,1000,1100,1200,1300,1400,1500,1600,1700,1800,1900,2000,2100,2200,2300,2400,2500,2600,2700,2800,2900,3000,3100,3200,3300,3400,3500,3600,3700,3800,3900,4000,4500,5000,5500,6000]
      }
      else if(m === 10 || m === 15){
        betList = [800,900,1000,1100,1200,1300,1400,1500,1600,1700,1800,1900,2000,2100,2200,2300,2400,2500,2600,2700,2800,2900,3000]
      }
      else if(m === 25){
        betList = [400,500,600,700,800,900,1000,1100,1200,1300,1400,1500,1600,1700,1800,1900,2000]
      }
      else if(m === 45){
        betList = [200,300,400,500,600,700,800,900,1000,1100,1200,1300,1400,1500]
      }
      else{
        betList = [500,600,700,800,900,1000]
      }

      const bet =
        betList[Math.floor(Math.random()*betList.length)]

      if(winSlots.includes(slotIndex)){
        totalWin += bet * m
      }

    }

  }

  // =========================
  // 🎯 NORMAL → chỉ 1 slot
  // =========================
  else{

    const slotIndex = winSlots[0]

    const slot = WHEEL8_SLOTS[slotIndex-1]
    const m = slot.m

    let betList

      if(m === 5){
        betList = [500,600,700,800,900,1000,1100,1200,1300,1400,1500,1600,1700,1800,1900,2000,2100,2200,2300,2400,2500,2600,2700,2800,2900,3000,3500,4000,4500,5000,5500,6000]
      }
      else if(m === 10 || m === 15){
        betList = [800,900,1000,1100,1200,1300,1400,1500,1600,1700,1800,1900,2000,2100,2200,2300,2400,2500,2600,2700,2800,2900,3000]
      }
      else if(m === 25){
        betList = [400,500,600,700,800,900,1000,1100,1200,1300,1400,1500,1600,1700,1800,1900,2000]
      }
      else if(m === 45){
        betList = [200,300,400,500,600,700,800,900,1000,1100,1200,1300,1400,1500]
      }
      else{
        betList = [500,600,700,800,900,1000]
      }

    const bet =
      betList[Math.floor(Math.random()*betList.length)]

    totalWin = bet * m
  }


  // 🔒 đảm bảo luôn có win
  if(totalWin === 0){
    return fakeWin(winSlots)
  }

  // 🔥 variance (top 1)
  if(Math.random() < 0.3){
    totalWin *= 2
  }

  return totalWin
}

// =======================
// 🤖 CREATE BOT FIRST
// ALLOW DUPLICATE WIN VALUES
// =======================

let botTop = []

while(botTop.length < 5){

  const win = fakeWin(winSlots)

  botTop.push({
    uid: "bot_" + Math.random(),
    name: botNames[Math.floor(Math.random()*botNames.length)],
    win,
    fake: true
  })

}


// =======================
// 🧑 PLAYER LIST
// =======================

let playerList = Object.values(winMap)


// =======================
// 🔥 MERGE LOGIC
// =======================

// 🔥 ghép bot trước
let merged = [...botTop]

// 🔥 chỉ add player nếu đủ mạnh
playerList.forEach(p=>{

  // nếu player thắng > bot yếu nhất → cho vào
  const minBotWin = Math.min(...merged.map(x=>x.win))

  if(p.win > minBotWin){
    merged.push(p)
  }

})


// =======================
// 🔥 SORT FINAL
// =======================

merged.sort((a,b)=>b.win - a.win)

const topWinners = merged.slice(0,5)

// =======================
// 🎡 EMIT RESULT
// =======================

lastWheel8Result = {
  slot: resultSlot,
  slots: winSlots,
  multiplier: multiplier,
  event: specialEvent
    ? (winSlots.includes(1) ? "x5-all" : "x45-all")
    : null,
  top: topWinners
}

io.emit("wheel8-result", lastWheel8Result)


// =======================
// 📜 SAVE HISTORY
// =======================

wheel8History.unshift({
  roundId: wheel8Round.id,
  slot: resultSlot,
  multi: multiplier,
  ts: Date.now(),
  slots: winSlots,
  event: specialEvent
    ? (winSlots.includes(1) ? "x5-all" : "x45-all")
    : null,

  // lưu top 3 của phiên vào lịch sử
  topWinners: topWinners
})

if(wheel8History.length > MAX_WHEEL8_HISTORY){
wheel8History.pop()
}

saveWheel8History(wheel8History)


io.emit("wheel8-history",wheel8History)


// =======================
// 🔄 NEW ROUND
// =======================

// 🔥 CHECK QUA NGÀY SAU KHI KẾT THÚC ROUND
const todayStart = getTodayStartTsVN()

if(todayStart !== wheel8RoundDayTs){
  wheel8NeedReset = true
}


wheel8Round = createWheel8Round()



saveWheel8Round({
dayTs: wheel8RoundDayTs,
count: wheel8RoundCounter
})



// gửi thông tin round mới
io.emit("wheel8-round-info",{
  roundId: wheel8Round.id,
  endAt: wheel8Round.endAt
})



io.emit("wheel8-pool-update",wheel8Round.slotPool)

io.emit("wheel8-round-new",{
roundId: wheel8Round.id
})


// 🎯 gửi gợi ý sau 5 giây
setTimeout(()=>{

  const prediction = generateWheel8Prediction()

  io.emit("wheel8-prediction",{
    slots: prediction
  })

},5000)


emitWheel8Admin("admin-wheel8-bets-update", getAdminWheel8Data())

},35000)



// ================================
// 🐉🐯🔥 DTP ROUND COUNT (24H)
// ================================



const DTP_ROUND_FILE =
"/opt/render/project/data/dtp_round_count.json";

const DTP_HISTORY_FILE =
"/opt/render/project/data/dtp_history.json";


let fakePool = {
  dragon: 0,
  tiger: 0,
  phoenix: 0
};



/* ======================================
   DTP ADMIN - PASSWORD AUTHENTICATION
====================================== */

const DTP_ADMIN_PASSWORD =
  process.env.DTP_ADMIN_PASSWORD || "";

const DTP_ADMIN_TTL_MS = 8 * 60 * 60 * 1000;
const dtpAdminAttempts = new Map();

// Dọn dữ liệu chống thử mật khẩu liên tục
setInterval(() => {
  const now = Date.now();

  for (const [ip, entry] of dtpAdminAttempts) {
    if (
      now - entry.lastAttempt > 30 * 60 * 1000 &&
      now > entry.blockedUntil
    ) {
      dtpAdminAttempts.delete(ip);
    }
  }
}, 10 * 60 * 1000).unref();

// So sánh mật khẩu phía server
function dtpPasswordMatches(password) {
  if (
    !DTP_ADMIN_PASSWORD ||
    typeof password !== "string" ||
    !password ||
    password.length > 256
  ) {
    return false;
  }

  const a = crypto
    .createHash("sha256")
    .update(password, "utf8")
    .digest();

  const b = crypto
    .createHash("sha256")
    .update(DTP_ADMIN_PASSWORD, "utf8")
    .digest();

  return crypto.timingSafeEqual(a, b);
}

// Kiểm tra quyền trên từng kết nối
function isDtpAdminSocket(socket) {
  const expiresAt = Number(
    socket.data.dtpAdminUntil || 0
  );

  if (expiresAt > Date.now()) {
    return true;
  }

  socket.data.dtpAdminUntil = 0;
  return false;
}

// Dữ liệu đầy đủ của bảng quản trị
function getDtpAdminSnapshot() {
  return {
    round: dtpRound.id,
    secret: dtpRound.secretResult,
    endAt: dtpRound.endAt,
    pool: getDtpPool(),
    bets: getAdminDtpBetList()
  };
}

// Chỉ gửi sự kiện cho kết nối đã xác thực
function emitToDtpAdmins(event, data) {
  for (const client of io.sockets.sockets.values()) {
    if (isDtpAdminSocket(client)) {
      client.emit(event, data);
    }
  }
}


function getDtpPool(){

  const pool = {
    dragon: fakePool.dragon,
    tiger: fakePool.tiger,
    phoenix: fakePool.phoenix
  };

  dtpRound.bets.forEach(b=>{
    pool[b.side] += b.bet;
  });

  return pool;
}


function getAdminDtpBetList(){

const users = loadUsers();

const map = {};

dtpRound.bets.forEach(b=>{

if(!map[b.uid]){
  map[b.uid] = {
    name: users[b.uid]?.profile?.name || "Player",
    dragon:0,
    tiger:0,
    phoenix:0
  };
}

map[b.uid][b.side] += b.bet;

});

return Object.values(map).map(p=>({

name:p.name,
dragon:p.dragon,
tiger:p.tiger,
phoenix:p.phoenix,
total:p.dragon + p.tiger + p.phoenix

}));

}



function emitAdminDtpBets() {

  emitToDtpAdmins(
    "admin-dtp-bets-update",
    {
      round: dtpRound.id,
      pool: getDtpPool(),
      bets: getAdminDtpBetList()
    }
  );

}



setInterval(()=>{

  const remain =
    Math.floor((dtpRound.endAt - Date.now())/1000);

  const elapsed =
    Math.floor((Date.now() - dtpRound.startAt)/1000);

  // ❌ 5s đầu: animation result
  if(elapsed < 5) return;

  // ❌ 5s cuối: khóa cược
  if(remain <= 5) return;

  const sides = ["dragon","tiger","phoenix"];
  const side = sides[Math.floor(Math.random()*3)];

  const fakeBet = (Math.floor(Math.random()*100) + 1) * 10;

  fakePool[side] += fakeBet;

  io.emit("dtp-bet-update", getDtpPool());

},500);



let dtpHistory = loadDtpHistory();
const MAX_DTP_HISTORY = 8;


function loadDtpHistory(){
  try{
    if(!fs.existsSync(DTP_HISTORY_FILE)) return [];
    return JSON.parse(
      fs.readFileSync(DTP_HISTORY_FILE,"utf8")
    );
  }catch(e){
    console.error("❌ Load DTP history failed",e);
    return [];
  }
}

function saveDtpHistory(list){
  try{
    fs.writeFileSync(
      DTP_HISTORY_FILE,
      JSON.stringify(list,null,2)
    );
  }catch(e){
    console.error("❌ Save DTP history failed",e);
  }
}


function loadDtpRoundCount(){
  try{
    if(!fs.existsSync(DTP_ROUND_FILE)){
      return {
        dayTs: getTodayStartTsVN(),
        count: 0
      };
    }
    return JSON.parse(
      fs.readFileSync(DTP_ROUND_FILE,"utf8")
    );
  }catch(e){
    return {
      dayTs: getTodayStartTsVN(),
      count: 0
    };
  }
}

function saveDtpRoundCount(data){
  fs.writeFileSync(
    DTP_ROUND_FILE,
    JSON.stringify(data,null,2)
  );
}


function pickDtpWinner(){

  const r = Math.random();

  if(r < 0.333) return "dragon";
  if(r < 0.666) return "tiger";
  return "phoenix";

}



const dtpRoundState = loadDtpRoundCount();

let dtpRoundCount =
  dtpRoundState.count || 0;

let dtpRoundDayTs =
  dtpRoundState.dayTs || getTodayStartTsVN();


// ================================
// 🐉🐯🔥 DRAGON TIGER PHOENIX ROUND
// ================================

dtpRoundCount++;

saveDtpRoundCount({
  dayTs: dtpRoundDayTs,
  count: dtpRoundCount
});

let dtpRound = {
  id: dtpRoundCount,
  startAt: Date.now(),
  endAt: Date.now() + 35000,
  bets: [],
  secretResult: pickDtpWinner()
};



setInterval(()=>{

  const users = loadUsers();

const winner = dtpRound.secretResult || pickDtpWinner();

dtpRound.bets.forEach(o=>{

  const me = users[o.uid];
  if(!me?.profile) return;

  let win = 0;

  if(o.side === winner){

    win = o.bet * 3;

    me.profile.coins += win;

  }

  // =====================
  // SAVE USER HISTORY
  // =====================

/* ==========================================
   DTP - DAILY BET HISTORY
   Vietnam Time (GMT+7)
========================================== */

const dtpTodayStart = getTodayStartTsVN();
const dtpTodayEnd = dtpTodayStart + 86400000;

// Only keep records from today
me.dtpHistory = (
  Array.isArray(me.dtpHistory)
    ? me.dtpHistory
    : []
).filter(r => {

  const ts = Number(r?.ts);

  return (
    Number.isFinite(ts) &&
    ts >= dtpTodayStart &&
    ts < dtpTodayEnd
  );

});

// Find existing record in current round
let row = me.dtpHistory.find(r =>
  r.round === dtpRound.id &&
  r.ts >= dtpTodayStart
);




if (!row) {

  row = {
    round: dtpRound.id,
    ts: Date.now(),
    dragon: 0,
    tiger: 0,
    phoenix: 0,
    win: 0,
    winner: winner
  };

  me.dtpHistory.unshift(row);

}


// cộng bet theo cửa
row[o.side] += o.bet;

// cộng tiền thắng
row.win += win;

// giữ tối đa 30 round
me.dtpHistory = me.dtpHistory.slice(0,30);

});

  

  saveUsers(users);

  dtpRound.bets.forEach(o=>{
    emitCoinUpdate(o.uid);
  });

  io.emit("dtp-result",{
    roundId: dtpRound.id,
    winner
  });


  // =====================
// SAVE HISTORY
// =====================

dtpHistory.unshift(winner);

if(dtpHistory.length > MAX_DTP_HISTORY){
  dtpHistory.pop();
}

saveDtpHistory(dtpHistory); // 🔥 thêm dòng này

io.emit("dtp-history-update", dtpHistory);



  // new round
const todayStart = getTodayStartTsVN();

if(todayStart !== dtpRoundDayTs){
  dtpRoundCount = 0;
  dtpRoundDayTs = todayStart;
}

dtpRoundCount++;

saveDtpRoundCount({
  dayTs: dtpRoundDayTs,
  count: dtpRoundCount
});

dtpRound = {
  id: dtpRoundCount,
  startAt: Date.now(),
  endAt: Date.now() + 35000,
  bets: [],
  secretResult: pickDtpWinner()   // 🔥 thêm dòng này
};



function randomPool(){
  return 0;
}

fakePool = {
  dragon: randomPool(),
  tiger: randomPool(),
  phoenix: randomPool()
};


  io.emit("dtp-round-new",{
    roundId: dtpRound.id
  });

emitAdminDtpBets();

},35000);



setInterval(()=>{

  const remain =
    Math.max(
      0,
      Math.floor((dtpRound.endAt - Date.now())/1000)
    );

  io.emit("dtp-timer", remain);

},1000);





// ================================
// 🔢 RPS ROUND COUNT STATE
// ================================
const rpsRoundState = loadRpsRoundCount();

let rpsRoundCount = rpsRoundState.count || 0;
let rpsRoundDayTs = rpsRoundState.dayTs || getTodayStartTsVN();







const RPS_BET_LOCK_BEFORE_MS = 5000; // 🔒 khóa trước 5s


// ================================
// ✊✋✌️ RPS ROUND STATE (GLOBAL)
// ================================
const todayStart = getTodayStartTsVN();
if (todayStart !== rpsRoundDayTs) {
  rpsRoundCount = 0;
  rpsRoundDayTs = todayStart;

  saveRpsRoundCount({
    dayTs: rpsRoundDayTs,
    count: rpsRoundCount
  });
}

rpsRoundCount++;

let rpsRound = {
  id: rpsRoundCount,          // ✅ round trong ngày
  startAt: Date.now(),
  endAt: Date.now() + 60000,
  secretHand: pickRpsHand(),
  bets: []
};


function pickRpsHand(){
  return ["rock","paper","scissors"][
    Math.floor(Math.random()*3)
  ];
}

function calcRps(me, enemy){
  if(me === enemy) return "draw";
  if(
    (me==="rock" && enemy==="scissors") ||
    (me==="paper" && enemy==="rock") ||
    (me==="scissors" && enemy==="paper")
  ) return "win";
  return "lose";
}






// ================================
// ⏱️ AUTO RPS RESULT EVERY 60s
// ================================
setInterval(() => {
  try {
    const users = loadUsers();
    const enemy = rpsRound.secretHand;

    // =========================
    // 1️⃣ TÍNH KẾT QUẢ & CẬP NHẬT COIN
    // =========================
rpsRound.bets.forEach(o => {
  const me = users[o.uid];
  if (!me?.profile) return;

  const result = calcRps(o.hand, enemy);
  let win = 0;

  if (result === "win") {
    win = o.bet * 2;           // 🔥 thắng x2
    me.profile.coins = Math.floor(
  Number(me.profile.coins || 0) + win
);
  } else if (result === "draw") {
    me.profile.coins += o.bet; // 🔄 hoàn tiền
  }
  // ❌ lose: không cộng gì

  me.rpsHistory ||= [];

  // ✅ TẠO 1 OBJECT DUY NHẤT
  const historyItem = {
    roundId: rpsRound.id,
    ts: Date.now(),
    myHand: o.hand,
    enemy,
    bet: o.bet,
    result,
    win
  };

  // 📜 LƯU VÀO USER
  me.rpsHistory.unshift(historyItem);

  // 🔒 GIỚI HẠN LỊCH SỬ (VD 30)
  if (me.rpsHistory.length > 30) {
    me.rpsHistory.length = 30;
  }

  // 🔥 REALTIME APPEND CHO RIÊNG USER
  emitToUser(o.uid, "rps-my-history-append", historyItem);
});


    // =========================
    // 2️⃣ LƯU USER TRƯỚC
    // =========================
    saveUsers(users);

    // =========================
    // 3️⃣ EMIT COIN REALTIME (SAU KHI SAVE)
    // =========================
    rpsRound.bets.forEach(o=>{
      emitCoinUpdate(o.uid);
    });

    // =========================
    // 4️⃣ EMIT KẾT QUẢ ROUND
    // =========================
    io.emit("rps-round-result",{
      roundId: rpsRound.id,
      enemyHand: enemy
    });


// =========================
// 📜 LƯU LỊCH SỬ ROUND (DÙ CÓ BET HAY KHÔNG)
// =========================
rpsHistoryGlobal.unshift({
  roundId: rpsRound.id,
  ts: Date.now(),
  enemy: enemy,
  betCount: rpsRound.bets.length,
  hasBet: rpsRound.bets.length > 0
});


// chỉ giữ N round
rpsHistoryGlobal = rpsHistoryGlobal.slice(0, MAX_RPS_HISTORY);

// 💾 lưu file
saveRpsHistory(rpsHistoryGlobal);

// 🔔 realtime push cho client
io.emit("rps-history-update", rpsHistoryGlobal);




// 🔁 RESET ROUND KHI QUA NGÀY MỚI (0H VN)
const todayStart = getTodayStartTsVN();
if (todayStart !== rpsRoundDayTs) {
  rpsRoundCount = 0;
  rpsRoundDayTs = todayStart;
}

// ➕ ROUND MỚI
rpsRoundCount++;

saveRpsRoundCount({
  dayTs: rpsRoundDayTs,
  count: rpsRoundCount
});

rpsRound = {
  id: rpsRoundCount,          // ✅ #1 → #N trong ngày
  startAt: Date.now(),
  endAt: Date.now() + 60000,
  secretHand: pickRpsHand(),
  bets: []
};


// 🔔 ADMIN REALTIME – ROUND MỚI
io.emit("admin-rps-secret-update", {
  roundId: rpsRound.id,
  secretHand: rpsRound.secretHand,
  endAt: rpsRound.endAt,
  overridden: false
});


io.emit("admin-rps-bet-reset", {
  roundId: rpsRound.id
});




io.emit("rps-round-new",{
  roundId: rpsRound.id,
  endAt: rpsRound.endAt
});




  } catch(e){
    console.error("❌ RPS ROUND ERROR", e);
  }
}, 60000);





// ================================
// 🔢 TIME RACE ROUND COUNT (24H)
// ================================
const TIME_RACE_ROUND_FILE =
  "/opt/render/project/data/time_race_round_count.json";

function loadTimeRaceRoundCount(){
  try{
    if(!fs.existsSync(TIME_RACE_ROUND_FILE)){
      return {
        dayTs: getTodayStartTsVN(),
        count: 0
      };
    }
    return JSON.parse(
      fs.readFileSync(TIME_RACE_ROUND_FILE,"utf8")
    );
  }catch(e){
    return {
      dayTs: getTodayStartTsVN(),
      count: 0
    };
  }
}

function saveTimeRaceRoundCount(data){
  try{
    fs.writeFileSync(
      TIME_RACE_ROUND_FILE,
      JSON.stringify(data,null,2)
    );
  }catch(e){}
}


/* ==========================================
   TIME RACE - RANDOM 20 TO 30 BOTS PER ROUND
========================================== */

function startFakeBotFlow() {

  if (!timeRaceRound) return;

  const round = timeRaceRound;
  const roundId = round.id;

  // Mỗi phiên chọn ngẫu nhiên từ 20 đến 30 bot
  const botCount =
    Math.floor(Math.random() * 11) + 20;


  // Mệnh giá phổ biến xuất hiện nhiều lần hơn
  const betList = [
    50, 50, 50,
    100, 100, 100, 100,
    200, 200, 200,
    500, 500, 500, 500,
    1000, 1000, 1000, 1000,
    2000, 2000,
    3000, 3000,
    4000, 4000,
    5000, 5000,
    6000, 6000,
    10000, 15000, 20000
  ];

  // Mệnh giá dùng chung cho một nhóm bot trong phiên
  const sharedBet = betList[
    Math.floor(Math.random() * betList.length)
  ];


  round.bots = [];

// Chờ 3 giây đầu phiên.
// Tạo đủ bot trước khi đóng cược 3 giây.
// Dự phòng 500ms cho bộ hẹn giờ.
const availableTime = Math.max(
  1000,
  round.betEndAt - Date.now() - 6500
);

  const spawnDelay = Math.floor(
    availableTime / botCount
  );

  let botIndex = 0;

  function spawnOne() {

    // Không tạo bot cho phiên đã kết thúc
    if (timeRaceRound !== round) return;
    if (timeRaceRound.id !== roundId) return;

    // Dừng khi đã đủ số lượng
    if (botIndex >= botCount) return;

    // Không tạo bot sau khi đóng cược
    if (Date.now() >= round.betEndAt - 3000) {
      return;
    }


const isSharedBet = botIndex % 4 === 0;

const botAmount = isSharedBet
  ? sharedBet
  : betList[
      Math.floor(Math.random() * betList.length)
    ];

const bot = {
  uid: "bot_" + roundId + "_" + botIndex,
  name: "???",
  total: botAmount,
  simulated: true
};


    round.bots.push(bot);
    botIndex++;

    // Gửi danh sách mới cho tất cả người xem
    io.emit(
      "time-race-bet-list",
      getTimeRaceBetList()
    );

    if (botIndex < botCount) {
      setTimeout(spawnOne, spawnDelay);
    }
  }


  // Bắt đầu tạo bot sau 3 giây kể từ đầu phiên
setTimeout(() => {

  // Chỉ chạy nếu vẫn đúng phiên hiện tại
  if (timeRaceRound !== round) return;

  spawnOne();

}, 3000);
}



const timeRaceRoundState = loadTimeRaceRoundCount();

let timeRaceRoundCount =
  timeRaceRoundState.count || 0;

let timeRaceRoundDayTs =
  timeRaceRoundState.dayTs || getTodayStartTsVN();




// ================================
// 📜 TIME RACE HISTORY (GLOBAL)
// ================================
const TIME_RACE_HISTORY_FILE =
  "/opt/render/project/data/time_race_history.json";

const MAX_TIME_RACE_HISTORY = 20;

function loadTimeRaceHistory(){
  try{
    if(!fs.existsSync(TIME_RACE_HISTORY_FILE)) return [];
    return JSON.parse(
      fs.readFileSync(TIME_RACE_HISTORY_FILE,"utf8")
    );
  }catch(e){
    console.error("❌ Load time race history failed",e);
    return [];
  }
}

function saveTimeRaceHistory(list){
  try{
    fs.writeFileSync(
      TIME_RACE_HISTORY_FILE,
      JSON.stringify(list,null,2)
    );
  }catch(e){
    console.error("❌ Save time race history failed",e);
  }
}

let timeRaceHistory = loadTimeRaceHistory();



// ================================
// ⏱️ TIME RACE (CRASH GAME)
// ================================

const TIME_RACE_TOTAL = 60000;   // 60s 1 round
const TIME_RACE_BET = 15000;     // 15s đặt cược
const TIME_RACE_TICK = 100;      // update mỗi 100ms

function pickCrashPoint(){

  const houseEdge = 0.05; // 5% nhà cái

  const r = Math.random();

  // 1% auto crash tại x1.00 (tăng cảm giác kịch tính)
if(r < 0.01){
  return 0;
}

  const crash = (1 - houseEdge) / (1 - r);

  return Number(Math.max(1, crash).toFixed(2));
}

function createTimeRaceRound(){

  const todayStart = getTodayStartTsVN();
  if(todayStart !== timeRaceRoundDayTs){
    timeRaceRoundCount = 0;
    timeRaceRoundDayTs = todayStart;
  }

  const now = Date.now();

  return {
    id: timeRaceRoundCount + 1,   // ✅ dùng round trong ngày
    startAt: now,
    betEndAt: now + TIME_RACE_BET,
    endAt: now + TIME_RACE_TOTAL,
    crashPoint: pickCrashPoint(),
    currentMultiplier: 1,
    bets: [],
    stopped: [],
    crashed: false,
    overridden: false, // ✅ THÊM DÒNG NÀY
      // ✅ CHÈN NGAY ĐÂY
    bots: []
  };
}

let timeRaceRound = createTimeRaceRound();

// Tạo bot ngay cho vòng đầu tiên khi server khởi động
startFakeBotFlow();

function emitTimeRacePlayers(){

  const users = loadUsers();

  const list = timeRaceRound.bets.map(b=>{
    const me = users[b.uid];
    return {
      uid: b.uid,
      name: me?.profile?.name || "Player",
      bet: b.bet,
      stopped: timeRaceRound.stopped.includes(b.uid)
    };
  });

  io.emit("admin-time-race-players",{
    roundId: timeRaceRound.id,
    players: list
  });
}



// 🔔 Emit secret round đầu tiên cho admin
io.on("connection", socket => {
  const usersNow = loadUsers();
  const uid = socket.data?.uid;
  if (!uid) return;

  const me = usersNow[uid];
  if (me?.role === "admin") {
    socket.emit("admin-time-race-secret-update", {
      roundId: timeRaceRound.id,
      crashPoint: timeRaceRound.crashPoint,
      betEndAt: timeRaceRound.betEndAt,
      endAt: timeRaceRound.endAt,
      crashed: timeRaceRound.crashed
    });
  }
});



setInterval(()=>{

  const now = Date.now();

  if(timeRaceRound.crashed) return;

  if(now < timeRaceRound.betEndAt) return;

  const elapsed = (now - timeRaceRound.betEndAt)/1000;

  const multiplier = Number((Math.exp(elapsed * 0.045)).toFixed(2));

  timeRaceRound.currentMultiplier = multiplier;

  io.emit("time-race-tick",{
    multiplier
  });

if(multiplier >= timeRaceRound.crashPoint){

  timeRaceRound.crashed = true;

  // 📜 LƯU HISTORY GLOBAL
  timeRaceHistory.unshift({
    roundId: timeRaceRoundCount + 1,
    crashPoint: timeRaceRound.crashPoint,
    ts: Date.now()
  });

  timeRaceHistory =
    timeRaceHistory.slice(0, MAX_TIME_RACE_HISTORY);

  saveTimeRaceHistory(timeRaceHistory);

  io.emit("time-race-history-update",
    timeRaceHistory
  );

  const users = loadUsers();

  // 🔥 xử lý tất cả người chơi
  timeRaceRound.bets.forEach(b=>{

    const me = users[b.uid];
    if(!me?.profile) return;

    const stopped =
      timeRaceRound.stopped.includes(b.uid);

    if(!stopped){

      // ❌ emit thua
      emitToUser(b.uid,"time-race-lost",{
        crashPoint: timeRaceRound.crashPoint
      });


/* ==========================================
   TIME RACE - SAVE LOSS HISTORY
========================================== */

me.timeRaceHistory = filterTimeRaceHistoryToday(
  me.timeRaceHistory
);

me.timeRaceHistory.unshift({
  roundId: timeRaceRound.id,
  ts: Date.now(),
  bet: b.bet,
  stopMultiplier: timeRaceRound.crashPoint,
  win: 0,
  result: "lose"
});

me.timeRaceHistory =
  filterTimeRaceHistoryToday(me.timeRaceHistory);

      

      // 🔥 cập nhật realtime cho user
      emitToUser(
        b.uid,
        "time-race-my-history",
        me.timeRaceHistory
      );
    }

  });

  saveUsers(users);


const displayCrash =
  timeRaceRound.crashPoint <= 1
    ? 0
    : timeRaceRound.crashPoint;

io.emit("time-race-crash",{
  crashPoint: displayCrash
});

  setTimeout(()=>{

    timeRaceRoundCount++;

    saveTimeRaceRoundCount({
      dayTs: timeRaceRoundDayTs,
      count: timeRaceRoundCount
    });

    

timeRaceRound = createTimeRaceRound();

// Xóa danh sách cũ trước khi tạo bot mới
io.emit("time-race-bet-list", []);

// Phát thông tin vòng mới như logic phía dưới


    emitTimeRacePlayers();

    io.emit("admin-time-race-secret-update", {
      roundId: timeRaceRound.id,
      crashPoint: timeRaceRound.crashPoint,
      betEndAt: timeRaceRound.betEndAt,
      endAt: timeRaceRound.endAt,
      crashed: false
    });

    io.emit("time-race-round-count",{
      roundCountToday: timeRaceRoundCount
    });

    io.emit("time-race-new",{
      roundId: timeRaceRound.id,
      betEndAt: timeRaceRound.betEndAt,
      serverNow: Date.now()
    });

    // Tạo 20-30 bot cho phiên vừa bắt đầu
startFakeBotFlow();

    io.emit("time-race-tick",{
      multiplier:1
    });

  },5000);

}


}, TIME_RACE_TICK);


// ================================
// 🔐 SOCKET AUTH & FORCE LOGOUT (FIX)
// ================================
io.on("connection", socket => {



  
// UID was verified by Socket.IO middleware
const uid = socket.data.uid;

// Device identifier is client metadata only
const deviceId =
  socket.handshake.auth?.deviceId || null;

socket.data.deviceId = deviceId;


// =======================================
// DTP ADMIN - LOGIN BẰNG MẬT KHẨU
// =======================================

socket.data.dtpAdminUntil = 0;

socket.on("dtp-admin-login", (data, callback) => {

  const reply = typeof callback === "function"
    ? callback
    : () => {};

  const ip = String(
    socket.handshake.address || "unknown"
  );

  const now = Date.now();

  const record = dtpAdminAttempts.get(ip) || {
    failures: 0,
    blockedUntil: 0,
    lastAttempt: now
  };

  record.lastAttempt = now;

  // Khóa tạm thời khi thử quá nhiều lần
  if (now < record.blockedUntil) {
    return reply({
      ok: false,
      message: "Too many attempts. Please try again in 15 minutes."
    });
  }

  if (!DTP_ADMIN_PASSWORD) {
    return reply({
      ok: false,
      message: 	"DTP_ADMIN_PASSWORD has not been configured on the server."
    });
  }

  if (!dtpPasswordMatches(data?.password)) {

    record.failures++;

    if (record.failures >= 5) {
      record.failures = 0;
      record.blockedUntil =
        now + 15 * 60 * 1000;
    }

    dtpAdminAttempts.set(ip, record);

    return reply({
      ok: false,
      message: "Incorrect admin password."
    });
  }

  // Xác thực thành công
  dtpAdminAttempts.delete(ip);

  socket.data.dtpAdminUntil =
    now + DTP_ADMIN_TTL_MS;

  return reply({
    ok: true,
    ...getDtpAdminSnapshot()
  });

});


// =======================================
// DTP ADMIN - GET CURRENT STATE
// =======================================

socket.on("dtp-admin-get-state", (_data, callback) => {

  const reply = typeof callback === "function"
    ? callback
    : () => {};

  if (!isDtpAdminSocket(socket)) {
    return reply({
      ok: false,
      code: "AUTH_REQUIRED",
      message: "Please enter your password again."
    });
  }

  reply({
    ok: true,
    ...getDtpAdminSnapshot()
  });

});


// =======================================
// DTP ADMIN - OVERRIDE RESULT
// =======================================

socket.on("dtp-admin-override", (data, callback) => {

  const reply = typeof callback === "function"
    ? callback
    : () => {};

  // BẮT BUỘC ĐÃ XÁC THỰC
  if (!isDtpAdminSocket(socket)) {
    return reply({
      ok: false,
      code: "AUTH_REQUIRED",
      message: "Your authentication session has expired."
    });
  }

  const winner = data?.winner;

  if (!["dragon", "tiger", "phoenix"].includes(winner)) {
    return reply({
      ok: false,
      message: "Invalid result."
    });
  }

  if (Date.now() >= dtpRound.endAt) {
    return reply({
      ok: false,
      message: "The current round has ended."
    });
  }

  // Cập nhật kết quả hiện tại
  dtpRound.secretResult = winner;

  console.warn(
    "[DTP ADMIN] Change result",
    dtpRound.id,
    winner
  );

  const snapshot = getDtpAdminSnapshot();

  reply({
    ok: true,
    ...snapshot
  });

  // Đồng bộ riêng cho admin
  emitToDtpAdmins(
    "dtp-admin-secret-update",
    snapshot
  );

});


// =======================================
// DTP ADMIN - LOGOUT
// =======================================

socket.on("dtp-admin-logout", (_data, callback) => {

  socket.data.dtpAdminUntil = 0;

  if (typeof callback === "function") {
    callback({ ok: true });
  }

});

  
// ========================================
// 🔐 WHEEL8 ADMIN - PASSWORD LOGIN
// ========================================

socket.data.wheel8Admin = false;

let wheel8LoginFailures = 0;
let wheel8LoginBlockedUntil = 0;

socket.on("wheel8-admin-login", async (data, callback) => {
  const reply = typeof callback === "function"
    ? callback
    : () => {};

  if (socket.data.wheel8Admin) {
    return reply({ ok: true });
  }

  const now = Date.now();

  if (now < wheel8LoginBlockedUntil) {
    return reply({
      ok: false,
      message: "Too many attempts. Please try again later."
    });
  }

  if (!WHEEL8_ADMIN_PASSWORD) {
    return reply({
      ok: false,
      message: "The Wheel8 admin password has not been configured on the server."
    });
  }

  const password = data?.password;

  if (!wheel8PasswordMatches(password)) {
    wheel8LoginFailures++;

    if (wheel8LoginFailures >= 5) {
      wheel8LoginBlockedUntil = Date.now() + 60000;
      wheel8LoginFailures = 0;
    }

    return reply({
      ok: false,
      message: "Incorrect admin password."
    });
  }

  wheel8LoginFailures = 0;
  wheel8LoginBlockedUntil = 0;

  socket.data.wheel8Admin = true;
  socket.join(WHEEL8_ADMIN_ROOM);

  reply({ ok: true });

  // Gửi dữ liệu hiện tại sau khi xác thực
  if (wheel8Round?.secret) {
    socket.emit("admin-wheel8-secret", {
      roundId: wheel8Round.id,
      slot: wheel8Round.secret.slot,
      multiplier: wheel8Round.secret.multiplier,
      hash: wheel8Round.secret.hash,
      endAt: wheel8Round.endAt,
      overridden: wheel8Round.secret.overridden || false,
      event: wheel8Round.forcedEvent || null
    });
  }

  socket.emit(
    "admin-wheel8-bets-update",
    getAdminWheel8Data()
  );
});

// ========================================
// 🛠 WHEEL8 ADMIN OVERRIDE - PASSWORD AUTH
// ========================================

socket.on("admin-wheel8-override", (data, callback) => {

  const reply = typeof callback === "function"
    ? callback
    : () => {};

  // 🔒 Chỉ kết nối đã nhập đúng mật khẩu
  if (!socket.data.wheel8Admin) {
    return reply({
      ok: false,
      message: "You have not authenticated with the admin password."
    });
  }

  if (!wheel8Round?.secret) {
    return reply({
      ok: false,
      message: "No Wheel8 round is currently available."
    });
  }

  const validEvents = ["x5-all", "x45-all"];
  const event = data?.event;
  const isEvent = validEvents.includes(event);

  const slot = Number(data?.slot);

  if (!isEvent &&
      (!Number.isInteger(slot) || slot < 1 || slot > 8)) {
    return reply({
      ok: false,
      message: "Invalid slot."
    });
  }

  const remain = Math.max(
    0,
    Math.floor((wheel8Round.endAt - Date.now()) / 1000)
  );


  if (remain <= 5 || wheel8Round.finalStop) {
    return reply({
      ok: false,
      message: "The customization window has expired."
    });
  }

  const selectedSlot = isEvent
    ? (event === "x5-all" ? 1 : 2)
    : slot;

  const multiplier = isEvent
    ? (event === "x5-all" ? 5 : 45)
    : WHEEL8_SLOTS[selectedSlot - 1].m;

  wheel8Round.forcedEvent = isEvent ? event : null;

  wheel8Round.secret = {
    slot: selectedSlot,
    multiplier,
    event: wheel8Round.forcedEvent,

    hash: crypto
      .createHash("sha256")
      .update(
        wheel8Round.id + ":" +
        selectedSlot + ":" +
        multiplier + ":" +
        (wheel8Round.forcedEvent || "")
      )
      .digest("hex"),

    overridden: true
  };

  console.log("🛠 WHEEL8 ADMIN OVERRIDE:", {
    roundId: wheel8Round.id,
    slot: selectedSlot,
    multiplier,
    event: wheel8Round.forcedEvent
  });

  emitWheel8Admin("admin-wheel8-secret", {
    roundId: wheel8Round.id,
    slot: selectedSlot,
    multiplier,
    hash: wheel8Round.secret.hash,
    endAt: wheel8Round.endAt,
    overridden: true,
    event: wheel8Round.forcedEvent
  });

  reply({
    ok: true,
    message: 	"The Wheel8 result has been updated."
  });
});



  if (!uid) return;


// ================================
// 🎡 RESTORE WHEEL8 BETS WHEN RELOAD
// ================================



socket.on("toggle-top-name", ()=>{

  const uid = socket.data.uid
  if(!uid) return

  const users = loadUsers()
  const me = users[uid]

  if(!me?.profile) return

  me.profile.showTopName = !me.profile.showTopName

  saveUsers(users)

  socket.emit("top-name-status", me.profile.showTopName)

})




/* ==========================================
   WHEEL8 DOUBLE REWARD - SOCKET EVENTS
========================================== */

socket.on("wheel8-double-get", () => {
  const uid = socket.data.uid;
  if (!uid) return;

  const users = loadUsers();
  const offer = users[uid]?.wheel8DoubleOffer;

  if (!offer || offer.status !== "pending") return;

  if (Date.now() >= offer.expiresAt) {
    settleWheel8Double(uid, "keep");
    return;
  }

  socket.emit("wheel8-double-offer", {
    roundId: offer.roundId,
    profit: offer.profit,
    expiresAt: offer.expiresAt
  });
});

socket.on("wheel8-double-select", (data, callback) => {
  const reply = typeof callback === "function"
    ? callback
    : () => {};

  const uid = socket.data.uid;

  if (!uid) {
    return reply({
      ok: false,
      message: "Authentication required"
    });
  }

  const action = data?.action;

  if (!["keep", "red", "black"].includes(action)) {
    return reply({
      ok: false,
      message: "Invalid selection"
    });
  }

  const result = settleWheel8Double(uid, action);
  reply(result);
});


socket.on("wheel8-get-history",()=>{
socket.emit("wheel8-history",wheel8History)
})


socket.emit("wheel8-round-info",{
  roundId: wheel8Round.id,
  endAt: wheel8Round.endAt
})

// ================================
// 📜 SEND USER BET HISTORY
// ================================

socket.on("wheel8-get-my-history", () => {

  const uid = socket.data.uid;
  if (!uid) return;

  // Đồng bộ lịch sử theo ngày hiện tại
  cleanWheel8UserHistory();

  // Chỉ gửi dữ liệu còn hiệu lực
  socket.emit(
    "wheel8-my-history",
    wheel8UserHistory[uid] || []
  );

});





// gửi round hiện tại khi user vào game
socket.emit("wheel8-round-new",{
roundId: wheel8Round.id
})


// Người vào khi đồng hồ đã qua mốc 20s
// vẫn nhìn thấy HOT SLOT hiện tại.

if (
  wheel8Round.hotSlotEmitted &&
  wheel8Round.endAt > Date.now()
) {
  socket.emit("wheel8-hot-slot", {
    roundId: wheel8Round.id,
    slot: wheel8Round.hotSlot
  });
}



socket.emit("wheel8-history",wheel8History)



const myWheelBets = [0,0,0,0,0,0,0,0];

wheel8Round.bets
.filter(b => b.uid === uid)
.forEach(b => {
  myWheelBets[b.slot - 1] += b.bet;
});

socket.emit("wheel8-my-bets", myWheelBets);



// 🔥 gửi danh sách cược hiện tại cho admin
emitAdminDtpBets();

// ==========================================
// SECURE SOCKET USER BINDING
// ==========================================

if (
  socket.data.authenticated === true &&
  socket.data.uid
) {
  bindSocketToUser(
    socket.data.uid,
    socket
  );
}




  const usersNow = loadUsers();
  const meNow = usersNow[uid];







// ================================
// 💎 SEND DIAMOND WHEN CONNECT
// ================================
if (meNow?.profile) {

  meNow.profile.diamonds = Math.floor(
    Number(meNow.profile.diamonds || 0)
  );

    meNow.profile.coins = Math.floor(
    Number(meNow.profile.coins || 0)
  );


socket.emit("coin-update", {
  coins: meNow.profile.coins
});
}

// ================================
// 👑 RESTORE KING VS SLAVE STATE
// ================================
const ksState = ksUserState.get(uid);

if(ksState && ksState.bet > 0){

  socket.emit("ks-state",{
    roundId: ksRoundId,
    myBet: ksState.bet,
    playerUsed: ksState.playerUsed || [],
    kingUsed: ksState.kingUsed || []
  });

}else{

  socket.emit("ks-state",{
    roundId: ksRoundId,
    myBet: 0,
    playerUsed: [],
    kingUsed: []
  });

}




// ================================
// 💣 SEND CURRENT TIME RACE SECRET TO ADMIN
// ================================
if (meNow?.role === "admin" && timeRaceRound) {

  socket.emit("admin-time-race-secret-update", {
    roundId: timeRaceRound.id,
    crashPoint: timeRaceRound.crashPoint,
    betEndAt: timeRaceRound.betEndAt,
    endAt: timeRaceRound.endAt,
    crashed: timeRaceRound.crashed
  });

}




  // 🔥 GỬI COIN NGAY KHI CONNECT (QUAN TRỌNG)
  const users = loadUsers();
  const me = users[uid];

  const coins = Number(me?.profile?.coins || 0);





// ================================
// 🎡 WHEEL8 BET
// ================================

const betCooldown = new Map()

socket.on("wheel8-bet",({slot,bet})=>{

const uid = socket.data.uid
if(!uid) return

// =====================
// 🚫 ANTI SPAM
// =====================
const now = Date.now()
const last = betCooldown.get(uid) || 0

if(now - last < 80){
return
}

betCooldown.set(uid, now)


// =====================
// ⏱ TIME CHECK
// =====================
const remain = Math.max(
0,
Math.floor((wheel8Round.endAt - Date.now()) / 1000)
)

if(remain <= 5){
socket.emit("wheel8-bet-fail",{
  message:"Betting closed"
})
return
}


// =====================
// 👤 USER
// =====================
const users = loadUsers()
const me = users[uid]

if(!me?.profile) return


// =====================
// 🔧 FIX INPUT
// =====================
slot = Number(slot) || 0
bet  = Math.floor(Number(bet) || 0)

if(slot < 1 || slot > 8){
socket.emit("wheel8-bet-fail",{message:"Invalid slot"})
return
}

if(bet <= 0){
socket.emit("wheel8-bet-fail",{message:"Invalid bet"})
return
}


// =====================
// 💰 CHECK COIN
// =====================
if(me.profile.coins < bet){
socket.emit("wheel8-bet-fail",{
  message:"Not enough coins"
})
return
}


// =====================
// 💸 TRỪ COIN
// =====================
me.profile.coins -= bet


// =====================
// 📥 LƯU BET (THEO USER)
// =====================

// 🔥 FIX QUAN TRỌNG
if(!wheel8Round.userBets){
  wheel8Round.userBets = {}
}

if(!wheel8Round.userBets[uid]){
  wheel8Round.userBets[uid] = [0,0,0,0,0,0,0,0]
}

wheel8Round.userBets[uid][slot-1] += bet


// =====================
// 📦 LƯU LOG (GIỮ NGUYÊN)
// =====================
wheel8Round.bets.push({
uid,
slot,
bet
})


// =====================
// 💎 POOL
// =====================
wheel8Round.slotPool ||= [0,0,0,0,0,0,0,0]
wheel8Round.slotPool[slot-1] += bet


// =====================
// 💾 SAVE
// =====================
saveUsers(users)


// =====================
// 💰 UPDATE COIN
// =====================
emitCoinUpdate(uid)


// =====================
// 🎡 UPDATE POOL
// =====================
io.emit("wheel8-pool-update", wheel8Round.slotPool)


// =====================
// ✅ CONFIRM
// =====================
socket.emit("wheel8-bet-ok")


// =====================
// 🔥 SYNC CHUẨN (ANTI LỆCH)
// =====================
socket.emit("wheel8-my-bets",
  wheel8Round.userBets[uid]
)



emitWheel8Admin("admin-wheel8-bets-update", getAdminWheel8Data())

})





//=====DTP=====

// =====================
// SEND CURRENT BETS
// =====================

const betSummary = {
  dragon:0,
  tiger:0,
  phoenix:0
};

const myBetRestore = {
  dragon:0,
  tiger:0,
  phoenix:0
};

dtpRound.bets.forEach(b=>{

  // tổng bet toàn phòng
  if(betSummary[b.side] !== undefined){
     betSummary[b.side] += b.bet;
  }

  // bet của chính user
  if(b.uid === uid){
     if(myBetRestore[b.side] !== undefined){
        myBetRestore[b.side] += b.bet;
     }
  }

});






/* ==========================================
   DTP - GET TODAY'S BET HISTORY
========================================== */

socket.on("dtp-get-my-history", () => {

  const uid = socket.data.uid;

  if (!socket.data.authenticated || !uid) {
    socket.emit("dtp-my-history", []);
    return;
  }

  const users = loadUsers();
  const user = users[uid];

  if (!user) {
    socket.emit("dtp-my-history", []);
    return;
  }

  const todayStart = getTodayStartTsVN();
  const todayEnd = todayStart + 86400000;

  const list = Array.isArray(user.dtpHistory)
    ? user.dtpHistory.filter(r => {

        const ts = Number(r?.ts);

        return (
          Number.isFinite(ts) &&
          ts >= todayStart &&
          ts < todayEnd
        );

      }).slice(0, 30)
    : [];

  socket.emit("dtp-my-history", list);

});



socket.emit("dtp-round-new",{
  roundId: dtpRound.id
});

socket.emit("dtp-history-update", dtpHistory);

socket.emit("dtp-bet-update", betSummary);

// restore cược user
socket.emit("dtp-my-bet", myBetRestore);


socket.on("dtp-bet", ({ side, bet }) => {

  const uid = socket.data.uid;
  if (!uid) return;

  // Khóa cược trong 5 giây cuối phiên
  const remainMs = dtpRound.endAt - Date.now();

  if (remainMs <= 5000) {
    socket.emit("notify", {
      type: "bad",
      message: "Betting closed"
    });
    return;
  }

  // Kiểm tra cửa cược hợp lệ
  if (!["dragon", "tiger", "phoenix"].includes(side)) {
    return;
  }

  bet = Number(bet);

  if (!Number.isSafeInteger(bet) || bet <= 0) {
    return;
  }

  const users = loadUsers();


  const me = users[uid];
  if(!me?.profile) return;

  bet = Number(bet || 0);

  if(me.profile.coins < bet){
    socket.emit("notify",{
      type:"bad",
      message:"Not enough coins"
    });
    return;
  }

  // trừ coin
  me.profile.coins -= bet;

  dtpRound.bets.push({
    uid,
    side,
    bet
  });

  emitAdminDtpBets();
  saveUsers(users);
  emitCoinUpdate(uid);

  // =====================
  // UPDATE POOL (REAL + FAKE)
  // =====================

  io.emit("dtp-bet-update", getDtpPool());

  // =====================
  // UPDATE MY BET
  // =====================

  const myBet = {
    dragon:0,
    tiger:0,
    phoenix:0
  };

  dtpRound.bets.forEach(b=>{
    if(b.uid === uid){
      if(myBet[b.side] !== undefined){
        myBet[b.side] += b.bet;
      }
    }
  });

  socket.emit("dtp-my-bet", myBet);

});











socket.emit("coin-update", { coins });



// ================================
// 🔄 RESTORE TIME RACE STATE
// ================================

if(timeRaceRound){

  const uidNow = socket.data.uid;

  const myBetObj = timeRaceRound.bets.find(
    b => b.uid === uidNow
  );

  const hasStopped =
    timeRaceRound.stopped.includes(uidNow);

  socket.emit("time-race-restore",{
    roundId: timeRaceRound.id,
    betEndAt: timeRaceRound.betEndAt,
    serverNow: Date.now(),
    multiplier: timeRaceRound.currentMultiplier,
    crashed: timeRaceRound.crashed,
    hasBet: !!myBetObj,
    stopped: hasStopped,
    myBet: myBetObj?.bet || 0   // 🔥 THÊM DÒNG NÀY
  });

}


// ================================
// ⏱️ SEND TIME RACE STATE
// ================================
socket.emit("time-race-state",{
  roundId: timeRaceRound.id,
  betEndAt: timeRaceRound.betEndAt,
  multiplier: timeRaceRound.currentMultiplier,
  crashed: timeRaceRound.crashed,
  serverNow: Date.now()
});


socket.emit("time-race-history",
  timeRaceHistory
);


socket.emit(
  "time-race-my-history",
  filterTimeRaceHistoryToday(
    me?.timeRaceHistory
  )
);


/* ==========================================
   TIME RACE - GET TODAY'S HISTORY
========================================== */

socket.on("time-race-get-my-history", () => {

  const uid = socket.data.uid;

  if (!socket.data.authenticated || !uid) {
    socket.emit("time-race-my-history", []);
    return;
  }

  const users = loadUsers();
  const me = users[uid];

  if (!me) {
    socket.emit("time-race-my-history", []);
    return;
  }

  const history = filterTimeRaceHistoryToday(
    me.timeRaceHistory
  );

  socket.emit("time-race-my-history", history);

});



socket.emit("time-race-round-count",{
  roundCountToday: timeRaceRoundCount + 1
});


// ✊✋✌️ gửi lịch sử RPS cho user mới vào
socket.emit("rps-history", rpsHistoryGlobal);

// ✊✋✌️ gửi lịch sử RPS của RIÊNG USER
socket.emit("rps-my-history", me?.rpsHistory || []);






// ================================
// 👑⚔ KING VS SLAVE – SOCKET
// ================================


// 🔥 GỬI THÔNG TIN ROUND & SLAVE INDEX KHI USER CONNECT
socket.emit("ks-init",{
  roundId: ksRoundId,
  slaveIndex: ksSlaveIndex
});


socket.on("ks-get-state", ()=>{
  const uid = socket.data.uid;
  if(!uid) return;

  const st = ksUserState.get(uid);

  if(!st){
    return socket.emit("ks-state",{
      roundId: ksRoundId,
      myBet: 0,
      playerUsed: [],
      kingUsed: []
    });
  }

  socket.emit("ks-state",{
    roundId: ksRoundId,
    myBet: st.bet || 0,
    playerUsed: st.playerUsed || [],
    kingUsed: st.kingUsed || []
  });
});


socket.on("ks-reset", ()=>{
  const uid = socket.data.uid;
  if(!uid) return;

  ksUserState.set(uid, {
  bet:0,
  playerUsed: [],
  kingUsed: []
});

  socket.emit("ks-round-new",{ roundId: ksRoundId });
});


socket.on("ks-bet", (data)=>{

  const uid = socket.data.uid;
  if(!uid)
    return socket.emit("ks-error",{ message:"NOT_LOGIN" });

  const bet = Math.floor(Number(data?.bet));
  if(!bet || bet <= 0)
    return socket.emit("ks-error",{ message:"BET_INVALID" });

  const users = loadUsers();
  const me = users[uid];
  if(!me?.profile)
    return socket.emit("ks-error",{ message:"USER_INVALID" });

  me.profile.coins = Math.floor(Number(me.profile.coins || 0));

  if(me.profile.coins < bet)
    return socket.emit("ks-error",{ message:"NOT_ENOUGH_COIN" });

  // trừ coin
  me.profile.coins -= bet;

  saveUsers(users);

  emitToUser(uid, "coin-update", {
    coins: me.profile.coins
  });


const old = ksUserState.get(uid);

ksUserState.set(uid, {
  bet,
  playerUsed: old?.playerUsed || [],
  kingUsed: old?.kingUsed || [],
  drawStreak: old?.drawStreak || 0   // 🔥 thêm dòng này
});

  socket.emit("ks-bet-ok",{
    roundId: ksRoundId,
    bet
  });

});

socket.on("ks-pick", (data)=>{

  const uid = socket.data.uid;
  if(!uid) return;

  const st = ksUserState.get(uid);
  if(!st?.bet)
    return socket.emit("ks-error",{ message:"NEED_BET" });

  const youIndex = Math.floor(Number(data?.index));
  if(!(youIndex >= 0 && youIndex <= 4))
    return socket.emit("ks-error",{ message:"PICK_INVALID" });

  // ❌ chặn dùng lại bài cũ
  if(st.playerUsed.includes(youIndex))
    return socket.emit("ks-error",{ message:"CARD_USED" });

  st.playerUsed.push(youIndex);

  // ============================
  // 🔥 LƯU PICK HISTORY
  // ============================
  st.pickHistory ||= [];
  st.pickHistory.push(youIndex);
  if(st.pickHistory.length > 10){
    st.pickHistory.shift();
  }

  // 🎯 chọn king chưa dùng
  const available = [0,1,2,3,4].filter(
    i => !st.kingUsed.includes(i)
  );

  if(available.length === 0){
    return socket.emit("ks-error",{ message:"NO_CARD_LEFT" });
  }

  // ============================
  // 🔥 ANTI NUÔI SLOT
  // ============================

  let kingPickIndex;
  const fav = getFavIndex(st.pickHistory);

  if(fav !== null && Math.random() < 0.65){

    // 65% tránh vị trí đang bị nuôi
    const safe = available.filter(i => i !== fav);

    if(safe.length > 0){
      kingPickIndex =
        safe[Math.floor(Math.random()*safe.length)];
    }else{
      kingPickIndex =
        available[Math.floor(Math.random()*available.length)];
    }

  }else{

    kingPickIndex =
      available[Math.floor(Math.random()*available.length)];
  }

  st.kingUsed.push(kingPickIndex);

  const you  = ksCardByIndex("player", youIndex);
  const king = ksCardByIndex("king", kingPickIndex);

  let result = "draw";

  if(you === "SLAVE" && king === "KING") result = "win";
  else if(you === "Warrior" && king === "Warrior") result = "draw";
  else result = "lose";

  const users = loadUsers();
  const me = users[uid];
  if(!me?.profile) return;

  let win = 0;

  // ==============================
  // 🔥 DRAW STREAK LOGIC
  // ==============================
  if(result === "draw"){
      st.drawStreak = (st.drawStreak || 0) + 1;
  } else {
      st.drawStreak = 0;
  }

  // ==============================
  // 🏆 WIN
  // ==============================
  if(result === "win"){

      win = st.bet * 5;
      me.profile.coins = Math.floor(
  Number(me.profile.coins || 0) + win
);

      saveUsers(users);
      emitToUser(uid,"coin-update",{ coins: me.profile.coins });

      ksUserState.set(uid,{
          bet: 0,
          playerUsed: [],
          kingUsed: [],
          drawStreak: 0,
          pickHistory: []
      });

  }
  // ==============================
  // ❌ LOSE
  // ==============================
  else if(result === "lose"){

      ksUserState.set(uid,{
          bet: 0,
          playerUsed: [],
          kingUsed: [],
          drawStreak: 0,
          pickHistory: []
      });

  }
  // ==============================
  // ⚖️ DRAW → giữ nguyên state
  // ==============================
  else {
      ksUserState.set(uid, st);
  }

  socket.emit("ks-result",{
    roundId: ksRoundId,
    you,
    king,
    youIndex,
    kingIndex: kingPickIndex,
    result,
    bet: st.bet,
    win,
    drawStreak: st.drawStreak || 0
  });

  if(result === "draw"){
    socket.emit("ks-open-pick",{
      drawStreak: st.drawStreak
    });
  }

});


// ================================
// 🏳️ KS RETREAT (sau khi draw)
// ================================
socket.on("ks-retreat", ()=>{

  const uid = socket.data.uid;
  if(!uid) return;

  const st = ksUserState.get(uid);
  if(!st?.bet) return;

  // ❌ Không cho retreat nếu chưa hòa lần nào
  if(!st.drawStreak || st.drawStreak <= 0){
    return socket.emit("ks-error",{ message:"RETREAT_NOT_ALLOWED" });
  }

  // ❌ Khóa retreat sau draw thứ 3
  if(st.drawStreak > 3){
    return socket.emit("ks-error",{ message:"RETREAT_LOCKED" });
  }

  const users = loadUsers();
  const me = users[uid];
  if(!me?.profile) return;

  // 🎯 Multiplier theo số draw
  let multiplier = 1.2;     // draw 1

  if(st.drawStreak === 2) multiplier = 1.3;
  if(st.drawStreak === 3) multiplier = 1.45;

  const reward = Math.floor(st.bet * multiplier);

  me.profile.coins += reward;

  saveUsers(users);
  emitToUser(uid,"coin-update",{ coins: me.profile.coins });

  // 🔥 Reset toàn bộ state
  ksUserState.set(uid,{
    bet: 0,
    playerUsed: [],
    kingUsed: [],
    drawStreak: 0
  });

  socket.emit("ks-retreat-ok",{ 
    reward,
    multiplier,
    streak: st.drawStreak
  });

  socket.emit("ks-state",{
    roundId: ksRoundId,
    myBet: 0,
    playerUsed: [],
    kingUsed: []
  });

});


socket.on("ks-next", ()=>{

  const uid = socket.data.uid;
  if(!uid) return;

  ksRoundId++;
  ksKingIndex = Math.floor(Math.random() * 5);
  ksSlaveIndex = Math.floor(Math.random() * 5);

  // ✅ reset state cho round mới
  ksUserState.set(uid,{
    bet: 0,
    playerUsed: [],
    kingUsed: []
  });

  socket.emit("ks-init",{
    roundId: ksRoundId,
    slaveIndex: ksSlaveIndex
  });

  socket.emit("ks-round-new",{
    roundId: ksRoundId
  });
});



socket.on("time-race-bet", data=>{
  const uid = socket.data.uid;
  if(!uid) return;

  // 🔒 khóa đặt cược khi còn <= 3s
  if(timeRaceRound.betEndAt - Date.now() <= 3000){
    return socket.emit("time-race-error",{message:"BET_CLOSED"});
  }

  if(Date.now() > timeRaceRound.betEndAt)
    return socket.emit("time-race-error",{message:"BET_CLOSED"});

  const bet = Math.floor(Number(data?.bet));
  if(!bet || bet <= 0)
    return socket.emit("time-race-error",{message:"BET_INVALID"});

  const users = loadUsers();
  const me = users[uid];
  if(!me?.profile) return;

  if(timeRaceRound.bets.some(b=>b.uid===uid))
    return socket.emit("time-race-error",{message:"ALREADY_BET"});

  if(me.profile.coins < bet)
    return socket.emit("time-race-error",{message:"NOT_ENOUGH_COIN"});

  // =========================
  // 💸 TRỪ COIN
  // =========================
  me.profile.coins -= bet;
  saveUsers(users);
  emitCoinUpdate(uid);

  // =========================
  // 📥 LƯU BET
  // =========================
  timeRaceRound.bets.push({uid, bet});

  // =========================
  // 📊 DANH SÁCH NGƯỜI CƯỢC
  // =========================


  // (giữ lại nếu bạn đang dùng UI cũ)
  emitTimeRacePlayers();

  socket.emit("time-race-bet-ok");

  io.emit("time-race-bet-list", getTimeRaceBetList())
});

socket.on("time-race-stop", ()=>{
  const uid = socket.data.uid;
  if(!uid) return;

if(
  timeRaceRound.crashed ||
  timeRaceRound.currentMultiplier >= timeRaceRound.crashPoint
){
  return;
}

  const bet = timeRaceRound.bets.find(b=>b.uid===uid);
  if(!bet) return;

if(timeRaceRound.stopped.includes(uid)) return;

timeRaceRound.stopped.push(uid);
emitTimeRacePlayers();

  const win = Math.floor(
    bet.bet * timeRaceRound.currentMultiplier
  );

  const users = loadUsers();
  const me = users[uid];
  if(!me?.profile) return;

  me.profile.coins = Math.floor(
  Number(me.profile.coins || 0) + win
);



/* ==========================================
   TIME RACE - SAVE WIN HISTORY
========================================== */

me.timeRaceHistory = filterTimeRaceHistoryToday(
  me.timeRaceHistory
);

me.timeRaceHistory.unshift({
  roundId: timeRaceRound.id,
  ts: Date.now(),
  bet: bet.bet,
  stopMultiplier: timeRaceRound.currentMultiplier,
  win,
  result: "win"
});

me.timeRaceHistory =
  filterTimeRaceHistoryToday(me.timeRaceHistory);



socket.emit("time-race-my-history",
  me.timeRaceHistory
);



  saveUsers(users);
  emitCoinUpdate(uid);

  socket.emit("time-race-stopped",{
    multiplier: timeRaceRound.currentMultiplier,
    win
  });
});


  
// ✊✋✌️ RPS ROUND INFO

const myBet = rpsRound.bets.find(b => b.uid === uid);

socket.emit("rps-round-state",{
  roundId: rpsRound.id,
  endAt: rpsRound.endAt,

  hasBet: !!myBet,
  myHand: myBet?.hand || null,
  bet: myBet?.bet || 0
});












  socket.on("disconnect", () => {
    const uid = socket.data.uid;
    if (!uid) return;

    const set = activeUsers.get(uid);
    if (set) {
      set.delete(socket.id);
      if (set.size === 0) {
        activeUsers.delete(uid);
      }
    }
  });
});





/* ==========================================
   SECURE SESSION MANAGEMENT
========================================== */

function kickOldSessions(uid, newSocket) {

  const sockets = activeUsers.get(uid);
  if (!sockets) return;

  for (const sid of [...sockets]) {

    // Never disconnect the current socket
    if (sid === newSocket.id) {
      continue;
    }

    const oldSocket = io.sockets.sockets.get(sid);

    // Remove stale socket references
    if (!oldSocket) {
      sockets.delete(sid);
      continue;
    }

    // Same verified login session: allow
    if (
      newSocket.data.sessionId &&
      oldSocket.data.sessionId &&
      newSocket.data.sessionId ===
        oldSocket.data.sessionId
    ) {
      continue;
    }

    oldSocket.emit("force-logout", {
      reason: "logged_in_elsewhere",
      message: "Your account was signed in on another device."
    });

    sockets.delete(sid);
    oldSocket.disconnect(true);
  }
}


function emitToUser(uid, event, data) {
  const sockets = activeUsers.get(uid);
  if (!sockets) return;

  for (const sid of sockets) {
    const s = io.sockets.sockets.get(sid);
    if (s) s.emit(event, data);
  }
}




/* ==========================================
   SECURE SOCKET USER BINDING
========================================== */

function bindSocketToUser(uid, socket) {

  const verifiedUid = socket.data.uid;

  // Only authenticated sockets may bind
  if (
    !socket.data.authenticated ||
    !verifiedUid
  ) {
    socket.emit("auth-error", {
      message: "Authentication required."
    });

    return false;
  }

  // Prevent binding to another account
  if (String(uid) !== String(verifiedUid)) {

    console.warn(
      "[SECURITY] UID mismatch:",
      socket.id
    );

    socket.emit("auth-error", {
      message: "Unauthorized account."
    });

    return false;
  }

  const db = loadUsers();
  const account = db[verifiedUid];

  if (
    !account?.profile ||
    account.profile.accountBlocked
  ) {
    socket.emit("auth-error", {
      message: "Account unavailable."
    });

    return false;
  }


  
// Reject invalid identity
if (!socket.data.sessionId) {
  socket.emit("auth-error", {
    message: "Invalid login session."
  });
  return false;
}

// Only apply session policy on first binding
let set = activeUsers.get(verifiedUid);

if (set?.has(socket.id)) {
  return true;
}

// Disconnect older independent sessions first
kickOldSessions(verifiedUid, socket);

// Create active user entry if necessary
set = activeUsers.get(verifiedUid);

if (!set) {
  set = new Set();
  activeUsers.set(verifiedUid, set);
}

set.add(socket.id);


  socket.data.role =
    account.role ||
    account.profile.role ||
    "user";


  return true;
}




/* ==========================================
   LIVESTREAM PRO - MAINTENANCE SYSTEM
========================================== */

const LSP_MAINTENANCE =
  process.env.LSP_MAINTENANCE === "true";

const LSP_MAINTENANCE_PAGE =
  path.join(__dirname, "public", "maintenance.html");

// Health endpoint for browser recovery checks
app.get("/api/lsp-status", (req, res) => {
  res.set("Cache-Control", "no-store");

  if (LSP_MAINTENANCE) {
    return res.status(503).json({
      ready: false,
      maintenance: true
    });
  }

  return res.status(200).json({
    ready: true,
    maintenance: false
  });
});

// Render HTTP health check
// Only reports success when maintenance is disabled
app.get("/healthz", (req, res) => {
  res.set("Cache-Control", "no-store");

  if (LSP_MAINTENANCE) {
    return res.status(503).send("MAINTENANCE");
  }

  return res.status(200).send("OK");
});

// Block HTTP requests during manual maintenance
app.use((req, res, next) => {
  if (!LSP_MAINTENANCE) return next();

  if (
    req.path === "/maintenance.html" &&
    (req.method === "GET" || req.method === "HEAD")
  ) {
    return res.sendFile(LSP_MAINTENANCE_PAGE);
  }

  res.set("Cache-Control", "no-store");
  res.set("Retry-After", "30");

  const isPageRequest =
    req.method === "GET" &&
    (
      req.accepts(["html", "json"]) === "html" ||
      req.headers["sec-fetch-mode"] === "navigate"
    );

  if (isPageRequest) {
    return res.status(503).sendFile(LSP_MAINTENANCE_PAGE);
  }

  return res.status(503).json({
    ok: false,
    error: "SYSTEM_MAINTENANCE",
    message: "Livestream Pro is temporarily unavailable."
  });
});




// 🔧 Parse JSON body (BẮT BUỘC cho admin API)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));




/* ==========================================
   SPIRIT BEAST - SIGNED SESSION
========================================== */

const SPIRIT_SECRET = process.env.SPIRIT_SESSION_SECRET;

function spiritSign(value) {
  return crypto.createHmac("sha256", SPIRIT_SECRET)
    .update(value).digest("base64url");
}

function spiritCreateSession(uid) {
  if (!SPIRIT_SECRET || SPIRIT_SECRET.length < 32) {
    throw new Error("SPIRIT_SESSION_SECRET is missing");
  }

  const payload = Buffer.from(JSON.stringify({
    uid: String(uid),
    exp: Date.now() + 7 * 86400000,
    nonce: crypto.randomBytes(16).toString("hex")
  })).toString("base64url");

  return payload + "." + spiritSign(payload);
}

function spiritAuth(req, res, next) {
  if (!SPIRIT_SECRET || SPIRIT_SECRET.length < 32) {
    return res.status(503).json({
      ok: false, error: "GAME_NOT_CONFIGURED"
    });
  }

  try {
    const raw = (req.headers.cookie || "")
      .split(";")
      .map(s => s.trim())
      .find(s => s.startsWith("lsp_spirit_sid="));

    if (!raw) throw Error("Missing session");

    const token = raw.slice("lsp_spirit_sid=".length);
    const parts = token.split(".");
    if (parts.length !== 2) throw Error("Invalid token");

    const [payload, signature] = parts;
    const expected = spiritSign(payload);

    const a = Buffer.from(signature);
    const b = Buffer.from(expected);

    if (a.length !== b.length ||
        !crypto.timingSafeEqual(a, b)) {
      throw Error("Invalid signature");
    }

    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString()
    );

    if (session.exp <= Date.now()) {
      throw Error("Expired session");
    }

    const db = loadUsers();
    const user = db[session.uid];

    if (!user?.profile || user.profile.accountBlocked) {
      throw Error("Account unavailable");
    }

    req.spiritUid = session.uid;
    next();

  } catch {
    res.status(401).json({
      ok: false,
      error: "SESSION_EXPIRED",
      message: "Please sign in again."
    });
  }
}




/* ==========================================
   VERIFIED TRANSFER IDENTITY
========================================== */

function getVerifiedTransferUid(socket) {

  if (!SPIRIT_SECRET || SPIRIT_SECRET.length < 32) {
    return null;
  }

  try {
    const cookie = String(
      socket.handshake.headers.cookie || ""
    );

    const entry = cookie.split(";")
      .map(s => s.trim())
      .find(s => s.startsWith("lsp_spirit_sid="));

    if (!entry) return null;

    const token = entry.slice("lsp_spirit_sid=".length);
    const parts = token.split(".");

    if (parts.length !== 2) return null;

    const [payload, signature] = parts;

    const expected = spiritSign(payload);

    const a = Buffer.from(signature);
    const b = Buffer.from(expected);

    if (
      a.length !== b.length ||
      !crypto.timingSafeEqual(a, b)
    ) {
      return null;
    }

    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    );

    if (
      !session.uid ||
      !Number.isFinite(session.exp) ||
      session.exp <= Date.now()
    ) {
      return null;
    }

    return String(session.uid);

  } catch {
    return null;
  }
}



/* ==========================================
   LIVESTREAMPRO - VERIFIED SOCKET IDENTITY
   NEVER TRUST CLIENT-SUPPLIED UID
========================================== */

io.use((socket, next) => {
  try {

    // Reset identity before authentication
    socket.data.uid = null;
    socket.data.role = "guest";
    socket.data.profile = null;



    // Signed session identity, never use client deviceId
const rawCookie = String(
  socket.handshake.headers.cookie || ""
);

const sessionCookie = rawCookie
  .split(";")
  .map(s => s.trim())
  .find(s => s.startsWith("lsp_spirit_sid="));

const signedToken = sessionCookie
  ? sessionCookie.slice("lsp_spirit_sid=".length)
  : "";

socket.data.sessionId = null;


    // Identity comes from signed HTTP-only cookie
    const verifiedUid = getVerifiedTransferUid(socket);

    // Allow anonymous connection for public features
    if (!verifiedUid) {
      socket.data.authenticated = false;
      return next();
    }

    const db = loadUsers();
    const account = db[verifiedUid];

    if (
      !account?.profile ||
      account.profile.accountBlocked
    ) {
      socket.data.authenticated = false;
      return next();
    }

    socket.data.uid = String(verifiedUid);


// Only assign after successful session verification
socket.data.sessionId = crypto
  .createHash("sha256")
  .update(signedToken)
  .digest("hex");

    socket.data.role =
      account.role ||
      account.profile.role ||
      "user";

    socket.data.profile = account.profile;
    socket.data.authenticated = true;

    return next();

  } catch (error) {

    console.error(
      "[SOCKET AUTH] Verification failed:",
      error.message
    );

    socket.data.uid = null;
    socket.data.role = "guest";
    socket.data.authenticated = false;

    return next();
  }
});



/* ============================================
   LSP MAIN ADMIN - PASSWORD SESSION
   Không yêu cầu người truy cập đăng nhập UID
============================================ */

const LSP_ADMIN_COOKIE = "lsp_admin_sid";
const LSP_ADMIN_TTL = 8 * 60 * 60 * 1000;
const lspAdminSessions = new Map();
const lspAdminAttempts = new Map();

// Render sử dụng reverse proxy
app.set("trust proxy", 1);

function getLspAdminActorUid() {
  const users = loadUsers();

  const selected =
    String(process.env.LSP_ADMIN_ACTOR_UID || "").trim();

  if (selected) {
    return users[selected]?.role === "admin"
      ? selected
      : null;
  }

  // Tự lấy nếu hệ thống chỉ có một admin
  const admins = Object.keys(users).filter(
    uid => users[uid]?.role === "admin"
  );

  return admins.length === 1 ? admins[0] : null;
}

function lspAdminPasswordValid(password) {
  const expected = process.env.LSP_ADMIN_PASSWORD;

  if (
    typeof expected !== "string" ||
    !expected ||
    typeof password !== "string" ||
    !password ||
    password.length > 256
  ) {
    return false;
  }

  const a = crypto
    .createHash("sha256")
    .update(password, "utf8")
    .digest();

  const b = crypto
    .createHash("sha256")
    .update(expected, "utf8")
    .digest();

  return crypto.timingSafeEqual(a, b);
}

function lspAdminTokenHash(token) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function getLspAdminSession(req) {
  const cookies = String(req.headers.cookie || "");

  const match = cookies.match(
    /(?:^|;\s*)lsp_admin_sid=([a-f0-9]{64})(?:;|$)/
  );

  if (!match) return null;

  const key = lspAdminTokenHash(match[1]);
  const session = lspAdminSessions.get(key);

  if (!session) return null;

  if (session.expiresAt <= Date.now()) {
    lspAdminSessions.delete(key);
    return null;
  }

  return {
    key,
    session
  };
}

function setLspAdminCookie(req, res, token, maxAge) {
  const https =
    req.secure ||
    String(req.headers["x-forwarded-proto"] || "")
      .split(",")[0].trim() === "https";

  const cookie = [
    `${LSP_ADMIN_COOKIE}=${token}`,
    "HttpOnly",
    "SameSite=Strict",
    "Path=/api/admin",
    `Max-Age=${maxAge}`,
    ...(https ? ["Secure"] : [])
  ].join("; ");

  res.setHeader("Set-Cookie", cookie);
}

function lspAdminSameOrigin(req) {
  const origin = req.get("origin");

  if (!origin) return true;

  try {
    return new URL(origin).host === req.get("host");
  } catch {
    return false;
  }
}

// ĐĂNG NHẬP BẰNG MẬT KHẨU
app.post("/api/admin/auth/login", (req, res) => {
  if (!lspAdminSameOrigin(req)) {
    return res.status(403).json({
      ok: false,
      error: "INVALID_ORIGIN"
    });
  }

  const ip = req.ip || req.socket.remoteAddress;
  const now = Date.now();

  let attempt = lspAdminAttempts.get(ip);

  if (!attempt || now > attempt.resetAt) {
    attempt = {
      failures: 0,
      resetAt: now + 15 * 60 * 1000
    };
  }

  if (attempt.failures >= 8) {
    return res.status(429).json({
      ok: false,
      error: "TOO_MANY_ATTEMPTS",
      message: "Please try again after the time limit expires."
    });
  }

  const actorUid = getLspAdminActorUid();

  if (!actorUid) {
    return res.status(503).json({
      ok: false,
      error: "ADMIN_NOT_CONFIGURED",
      message: "The internal admin account has not been configured."
    });
  }

  if (!lspAdminPasswordValid(req.body?.password)) {
    attempt.failures += 1;
    lspAdminAttempts.set(ip, attempt);

    return res.status(401).json({
      ok: false,
      error: "INVALID_PASSWORD",
      message: "Incorrect admin password."
    });
  }

  lspAdminAttempts.delete(ip);

  // Dọn phiên đã hết hạn
  for (const [key, value] of lspAdminSessions) {
    if (value.expiresAt <= now) {
      lspAdminSessions.delete(key);
    }
  }

  // Giới hạn số phiên tồn tại trong bộ nhớ
  if (lspAdminSessions.size >= 100) {
    const oldestKey = lspAdminSessions.keys().next().value;
    if (oldestKey) lspAdminSessions.delete(oldestKey);
  }

  const token = crypto.randomBytes(32).toString("hex");

  lspAdminSessions.set(lspAdminTokenHash(token), {
    actorUid,
    expiresAt: now + LSP_ADMIN_TTL
  });

  setLspAdminCookie(
    req,
    res,
    token,
    Math.floor(LSP_ADMIN_TTL / 1000)
  );

  res.json({
    ok: true,
    actorUid
  });
});



/* ==========================================
   KIỂM TRA TRẠNG THÁI PHIÊN ADMIN
========================================== */

app.get("/api/admin/auth/status", (req, res) => {
  res.set("Cache-Control", "no-store");

  const auth = getLspAdminSession(req);
  const actorUid = getLspAdminActorUid();

  const authenticated = Boolean(
    auth &&
    actorUid &&
    auth.session.actorUid === actorUid
  );

  return res.status(200).json({
    ok: authenticated,
    authenticated,
    ...(authenticated ? { actorUid } : {})
  });
});




// ĐĂNG XUẤT
app.post("/api/admin/auth/logout", (req, res) => {
  if (!lspAdminSameOrigin(req)) {
    return res.status(403).json({ ok: false });
  }

  const auth = getLspAdminSession(req);

  if (auth) {
    lspAdminSessions.delete(auth.key);
  }

  setLspAdminCookie(req, res, "", 0);

  res.json({ ok: true });
});

// BẢO VỆ TOÀN BỘ API /api/admin/*
app.use("/api/admin", (req, res, next) => {
  if (!lspAdminSameOrigin(req)) {
    return res.status(403).json({
      ok: false,
      error: "INVALID_ORIGIN"
    });
  }

  const auth = getLspAdminSession(req);
  const actorUid = getLspAdminActorUid();

  if (
    !auth ||
    !actorUid ||
    auth.session.actorUid !== actorUid
  ) {
    return res.status(401).json({
      ok: false,
      error: "ADMIN_AUTH_REQUIRED"
    });
  }

  // UID được gán từ server, không tin UID gửi từ client
  req.headers["x-uid"] = actorUid;

  if (req.body && typeof req.body === "object") {
    req.body.adminUid = actorUid;
  }

  req.lspAdminActorUid = actorUid;

  next();
});



app.use(express.static(path.join(__dirname, "public")));


app.use("/data", (req, res, next) => {
  const blockedFiles = new Set([
    "users.json",
    "social_posts.json",
    "inbox.json"
  ]);

  const fileName = path.posix.basename(req.path).toLowerCase();

  if (blockedFiles.has(fileName)) {
    return res.sendStatus(403);
  }

  next();
}, express.static(path.join(__dirname, "data")));





app.post("/api/admin/deposit",(req,res)=>{


const { username, amount } = req.body;

const uid = String(username || "").trim();
const add = Number(amount);

if (
  !uid ||
  !Number.isSafeInteger(add) ||
  add <= 0
) {
  return res.status(400).json({
    success: false,
    message: "Invalid member UID or deposit amount."
  });
}


const users = loadUsers()

const user = users[username]

if(!user || !user.profile){
return res.json({
success:false,
message:"User not found"
})
}



if(add <= 0){
return res.json({
success:false,
message:"Amount invalid"
})
}

// 💎 cộng coin
user.profile.coins =
(user.profile.coins || 0) + add

// 💳 cộng tổng đã nạp
user.profile.coinDeposit =
(user.profile.coinDeposit || 0) + add



const depositTodayStart = getTodayStartTsVN();
const depositTodayEnd = depositTodayStart + 86400000;

user.profile.depositLogs = (
  Array.isArray(user.profile.depositLogs)
    ? user.profile.depositLogs
    : []
).filter(item => {
  const ts = Number(item?.time);

  return Number.isFinite(ts) &&
    ts >= depositTodayStart &&
    ts < depositTodayEnd;
});

user.profile.depositLogs.unshift({
  amount: add,
  time: Date.now(),
  type: "deposit"
});



saveUsers(users)

// 🔄 realtime update client
emitCoinUpdate(user.profile.uid)

res.json({
success:true,
message:"Successfully added " + add + " diamonds"
})

})





app.post("/api/rps/bet",(req,res)=>{
  const uid = req.headers["x-uid"];
  const { bet, hand } = req.body;

// ⏱️ SERVER-SIDE TIME CHECK (ANTI-LAG)
const now = Date.now();
const remainMs = rpsRound.endAt - now;

if (remainMs <= RPS_BET_LOCK_BEFORE_MS) {
  return res.json({
    ok: false,
    message: "The betting period has ended"
  });
}


  if(!uid || !hand)
    return res.json({ ok:false });

  const users = loadUsers();
  const me = users[uid];
  if(!me?.profile)
    return res.json({ ok:false });

  const coin = Math.floor(Number(bet));
  if(!coin || coin <= 0)
    return res.json({ ok:false });

  if(me.profile.coins < coin)
    return res.json({ ok:false, message:"NOT_ENOUGH_COIN" });

  // ⛔ mỗi round chỉ 1 lệnh
  if (rpsRound.bets.some(b => b.uid === uid))
    return res.json({ ok:false, message:"ALREADY_BET" });

  // 🔻 trừ coin NGAY
  me.profile.coins -= coin;
  saveUsers(users);
  emitCoinUpdate(uid);

  rpsRound.bets.push({
    uid,
    hand,
    bet: coin
  });

// 🔔 REALTIME PUSH CHO ADMIN
io.emit("admin-rps-bet-new", {
  roundId: rpsRound.id,
  uid,
  hand,
  bet: coin,
  name: me.profile.name || "Player"
});



  return res.json({
    ok:true,
    roundId: rpsRound.id,
    endAt: rpsRound.endAt
  });
});


app.post("/api/admin/time-race/override", (req, res) => {

  const uid = req.headers["x-uid"];
  const { crashPoint } = req.body;

  if (!uid) 
    return res.status(401).json({ ok:false });

  const cp = Number(crashPoint);

  if (!cp || cp < 1)
    return res.json({ ok:false, message:"INVALID_CRASH" });

  if (!timeRaceRound || timeRaceRound.crashed)
    return res.json({ ok:false, message:"ROUND_ENDED" });

  // ✅ Override trực tiếp
  timeRaceRound.crashPoint = Number(cp.toFixed(2));
  timeRaceRound.overridden = true;

  console.log("💣 OVERRIDE CRASH:", cp);

  io.emit("admin-time-race-secret-update", {
    roundId: timeRaceRound.id,
    crashPoint: timeRaceRound.crashPoint,
    betEndAt: timeRaceRound.betEndAt,
    endAt: timeRaceRound.endAt,
    crashed: timeRaceRound.crashed,
    overridden: true
  });

  return res.json({ ok:true });
});




app.post("/api/admin/dtp-override", express.json(), (req,res)=>{

const { winner } = req.body;

if(!["dragon","tiger","phoenix"].includes(winner)){
  return res.json({ ok:false });
}

// 🔥 ghi đè kết quả round hiện tại
dtpRound.secretResult = winner;

console.log("ADMIN OVERRIDE:", winner);

res.json({
  ok:true,
  round: dtpRound.id,
  winner
});

});







app.get("/admin-time-race.html",(req,res)=>{
  res.sendFile(
    path.join(__dirname,"public/admin-time-race.html")
  );
});



app.get("/api/deposit-history",(req,res)=>{

  const uid = req.headers["x-uid"];

  if(!uid) return res.json({history:[]});

  const users = loadUsers();
  const user = users[uid];

  if(!user) return res.json({history:[]});

  
const todayStart = getTodayStartTsVN();
const todayEnd = todayStart + 86400000;

const history = Array.isArray(user.profile?.depositLogs)
  ? user.profile.depositLogs.filter(item => {

      const ts = Number(item?.time);

      return (
        Number.isFinite(ts) &&
        ts >= todayStart &&
        ts < todayEnd
      );

    })
  : [];

return res.json({ history });


});





/* ==========================================
   ADMIN - MEMBER ACCOUNT OVERVIEW
   Trả dữ liệu nhân vật cho phiên Admin
========================================== */

app.get("/api/admin/deposit-user-info", (req, res) => {

  res.set("Cache-Control", "no-store");

  const uid = String(req.query.uid || "").trim();

  if (!uid || uid.length > 100) {
    return res.status(400).json({
      ok: false,
      error: "INVALID_UID"
    });
  }

  const users = loadUsers();

  // Tra cứu đúng UID trong users.json.
  const account = users[uid];

  if (!account || !account.profile) {
    return res.status(404).json({
      ok: false,
      error: "MEMBER_NOT_FOUND"
    });
  }

  const p = account.profile;

  const safeNumber = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  return res.json({
    ok: true,

    user: {
      uid: uid,
      name: p.name || uid,
      avatar: p.avatar || "/avatar-default.png",

      level: safeNumber(p.level, 1),
      exp: safeNumber(p.exp),

      coinDeposit: safeNumber(p.coinDeposit),
      coinSent: safeNumber(p.coinSent),
      coinReceived: safeNumber(p.coinReceived),

      coins: safeNumber(p.coins)
    }
  });

});




app.get("/api/user-info",(req,res)=>{

const q = String(req.query.uid || "").toLowerCase()

const users = loadUsers()

let found = null

for(const uid in users){

const u = users[uid]

if(
uid.toLowerCase() === q ||
u.profile?.name?.toLowerCase() === q
){
found = u
break
}

}

if(!found){
return res.json({
success:false
})
}

res.json({
success:true,
user:{
uid: found.profile.uid,
name: found.profile.name,
avatar: found.profile.avatar,
coins: found.profile.coins
}
})

})



app.get("/api/wheel8-round",(req,res)=>{

res.json({
roundId: wheel8Round.id
})

})




app.get("/api/time-race/my-history",(req,res)=>{

  const uid = req.headers["x-uid"];
  if(!uid) return res.json([]);

  const users = loadUsers();
  const me = users[uid];

  res.json(
  filterTimeRaceHistoryToday(
    me?.timeRaceHistory
  )
);
});


// 🔐 ADMIN – GET CURRENT RPS BETS
app.get("/api/admin/rps/bets", (req, res) => {

  const uid = req.headers["x-uid"];
  if (!uid) return res.status(401).json({ ok:false });

  const users = loadUsers();
  const me = users[uid];

  if (me?.role !== "admin")
    return res.status(403).json({ ok:false });

  if (!rpsRound || !Array.isArray(rpsRound.bets)) {
    return res.json({ ok:true, list: [] });
  }

  const list = rpsRound.bets.map(b => {
    const u = users[b.uid];
    return {
      uid: b.uid,
      name: u?.profile?.name || "Player",
      bet: b.bet,
      hand: b.hand
    };
  });

  res.json({
    ok:true,
    roundId: rpsRound.id,
    list
  });
});




// ================================
// 🔐 ADMIN – XEM TRƯỚC KẾT QUẢ RPS
// ================================
app.get("/api/admin/rps/secret", (req, res) => {

  const uid = req.headers["x-uid"];
  if (!uid) return res.status(401).json({ ok:false });

  const users = loadUsers();
  const me = users[uid];

  if (me?.role !== "admin") {
    return res.status(403).json({ ok:false });
  }

  if (!rpsRound) {
    return res.json({ ok:false, message:"NO_ACTIVE_ROUND" });
  }

  return res.json({
    ok: true,
    roundId: rpsRound.id,
    endAt: rpsRound.endAt,
    secretHand: rpsRound.secretHand
  });
});



app.get("/api/admin/dtp-bets",(req,res)=>{

const users = loadUsers();

const map = {};

dtpRound.bets.forEach(b=>{

  if(!map[b.uid]){
    map[b.uid] = {
      name: users[b.uid]?.profile?.name || "Player",
      dragon:0,
      tiger:0,
      phoenix:0
    };
  }

  map[b.uid][b.side] += b.bet;

});

// gộp theo user
const list = Object.values(map).map(p=>({

  name: p.name,
  dragon: p.dragon,
  tiger: p.tiger,
  phoenix: p.phoenix,
  total: p.dragon + p.tiger + p.phoenix

}));

// 🔥 tính pool toàn phòng
const pool = {
  dragon:0,
  tiger:0,
  phoenix:0
};

dtpRound.bets.forEach(b=>{
  pool[b.side] += b.bet;
});

// trả dữ liệu
res.json({
  round: dtpRound.id,
  bets: list,
  pool: pool   // 🔥 THÊM DÒNG NÀY
});

});



// 🛑 ADMIN OVERRIDE RPS RESULT (DANGEROUS)
app.post("/api/admin/rps/override", (req, res) => {

  const uid = req.headers["x-uid"];
  const { hand } = req.body;

  if (!uid) return res.status(401).json({ ok:false });

  const users = loadUsers();
  const me = users[uid];

  if (me?.role !== "admin") {
    return res.status(403).json({ ok:false });
  }

  if (!rpsRound) {
    return res.json({ ok:false, message:"NO_ACTIVE_ROUND" });
  }

  // ⛔ Không cho override khi round đã kết thúc
  if (Date.now() >= rpsRound.endAt) {
    return res.json({ ok:false, message:"ROUND_ENDED" });
  }

  const allowed = ["rock","paper","scissors"];
  if (!allowed.includes(hand)) {
    return res.json({ ok:false, message:"INVALID_HAND" });
  }

  // 🔥 OVERRIDE THẲNG
  rpsRound.secretHand = hand;

// 🔔 REALTIME PUSH CHO ADMIN
io.emit("admin-rps-secret-update", {
  roundId: rpsRound.id,
  secretHand: rpsRound.secretHand,
  endAt: rpsRound.endAt,
  overridden: true
});



  console.warn(
    "🛑 [RPS OVERRIDE]",
    "round", rpsRound.id,
    "→", hand,
    "by", uid
  );

  res.json({
    ok:true,
    roundId: rpsRound.id,
    secretHand: rpsRound.secretHand
  });
});





// Admin DTP ===//
app.get("/api/admin/dtp-secret",(req,res)=>{

res.json({
round: dtpRound.id,
secret: dtpRound.secretResult,
endAt: dtpRound.endAt
});

});


// ================================
// 🧠 HEALTH – GET DATA
// ================================
app.get("/api/health/:uid", (req, res) => {
  const { uid } = req.params;

  if (!uid) {
    return res.status(400).json({ ok: false, error: "NO_UID" });
  }

  const file = path.join(HEALTH_DIR, `${uid}.json`);

  if (!fs.existsSync(file)) {
    return res.json({
      ok: true,
      healthData: {}
    });
  }

  try {
    const raw = fs.readFileSync(file, "utf8");
    const json = raw ? JSON.parse(raw) : {};
    return res.json({
      ok: true,
      healthData: json.healthData || {}
    });
  } catch (e) {
    console.error("❌ Load health failed:", e);
    return res.status(500).json({
      ok: false,
      error: "READ_HEALTH_FAILED"
    });
  }
});






// ================================
// 🧠 HEALTH – SAVE DATA
// ================================
app.post("/api/health/:uid", (req, res) => {
  const { uid } = req.params;
  const healthData = req.body;

  if (!uid) {
    return res.status(400).json({ ok: false, error: "NO_UID" });
  }

  if (!healthData || typeof healthData !== "object") {
    return res.status(400).json({
      ok: false,
      error: "INVALID_DATA"
    });
  }

  const file = path.join(HEALTH_DIR, `${uid}.json`);

  try {
    fs.writeFileSync(
      file,
      JSON.stringify(
        {
          uid,
          healthData,
          updatedAt: Date.now()
        },
        null,
        2
      )
    );

    return res.json({ ok: true });
  } catch (e) {
    console.error("❌ Save health failed:", e);
    return res.status(500).json({
      ok: false,
      error: "SAVE_HEALTH_FAILED"
    });
  }
});







// ===== GET INBOX (SYNC KHI MỞ MESSAGES) =====
app.get("/api/inbox", (req, res) => {
  const uid = req.headers["x-uid"];
  if (!uid) return res.status(403).json({ error: "no_auth" });

  const list = userInbox.get(uid) || [];

  res.json({
    ok: true,
    list
  });
});



app.get("/api/withdraw-history", (req, res) => {
  const uid = req.headers["x-uid"];
  if (!uid) return res.status(403).json({ error: "no_auth" });

  const list = loadWithdraws();

  // 🔒 chỉ trả về của chính user
  const mine = list.filter(w => w.uid === uid);

  res.json({
    ok: true,
    list: mine
  });
});


// 🔐 BẢO VỆ TRANG ADMIN
app.get("/lsp-admin-128995.html", (req, res) => {
  const uid = req.headers["x-uid"];
  if (!uid) return res.status(403).send("Forbidden");

  const db = loadUsers();
  const acc = db[uid];

  if (!acc || acc.role !== "admin") {
    return res.status(403).send("Not allowed");
  }

  res.sendFile(path.join(__dirname, "public", "lsp-admin-128995.html"));
});


app.post("/api/admin/market/approve-dispute", (req,res)=>{
  const { adminUid, orderId } = req.body;

  const users = loadUsers();
  if(!users[adminUid] || users[adminUid].role !== "admin")
    return res.status(403).json({ error:"not_admin" });

  const market = loadMarket();
  let found, booth, boothId;

  for(const [id,b] of Object.entries(market)){
    const o = (b.orders||[]).find(x=>x.id===orderId);
    if(o){
      found=o; booth=b; boothId=id;
      break;
    }
  }

  if(!found || found.status !== "dispute"){
    return res.json({ ok:false, error:"NOT_DISPUTE" });
  }

  // ✅ set done
  found.status = "done";
  found.doneAt = Date.now();
  found.adminApproved = true;   // 🧑‍⚖️ ĐÁNH DẤU ADMIN DUYỆT
  found.adminApprovedAt = Date.now();


  // 💰 trả tiền cho seller
  const seller = users[booth.ownerUid];
  const amount = Number(found.escrow || 0);

  if(seller?.profile && amount > 0){
    seller.profile.coinReceived =
      (seller.profile.coinReceived || 0) + amount;
    found.escrow = 0;
  }

  saveUsers(users);
  saveMarket(market);

  emitCoinUpdate(booth.ownerUid);

  io.emit("order-updated",{ boothId, order: found });

  // 🔔 notify buyer + seller
  sendPushToUser(found.buyerUid,{
    title:"Dispute resolved",
    body:"An admin has approved the order.",
    tag:"dispute-approved"
  });

  sendPushToUser(booth.ownerUid,{
    title:"Order approved",
    body:`An admin has approved order ${found.productName}`,
    tag:"dispute-approved"
  });

  res.json({ ok:true });
});



app.get("/api/admin/market/disputes", (req,res)=>{
  const adminUid = req.headers["x-uid"];
  const users = loadUsers();

  if(!users[adminUid] || users[adminUid].role !== "admin")
    return res.status(403).json({ error:"not_admin" });

  const market = loadMarket();
  const list = [];

  for(const [boothId, booth] of Object.entries(market)){
    (booth?.orders || []).forEach(o=>{
      if(o.status === "dispute"){
        list.push({
          boothId,
          boothName: booth.name,
          ownerUid: booth.ownerUid,
          order: o
        });
      }
    });
  }

  res.json({ ok:true, list });
});




// ===== ADMIN LIST USERS =====
app.get("/api/admin/users", (req, res) => {
  const adminUid = req.headers["x-uid"];
  if (!adminUid) return res.status(403).json({ error: "no_auth" });

  const db = loadUsers();
  const admin = db[adminUid];

  if (!admin || admin.role !== "admin") {
    return res.status(403).json({ error: "not_admin" });
  }

  const users = Object.values(db).map(u => ({
    uid: u.profile?.uid,
    name: u.profile?.name || "",
    coins: u.profile?.coins || 0,
    level: u.profile?.level || 1,
    exp: u.profile?.exp || 0,
    coinSent: u.profile?.coinSent || 0,
    coinReceived: u.profile?.coinReceived || 0,
    role: u.role || "user",
    blocked: !!u.profile?.accountBlocked


  }));

  res.json({ ok: true, users });
});

// ===== ADMIN: LIVE ROOMS =====
app.get("/api/admin/live-rooms", (req, res) => {
  const adminUid = req.headers["x-uid"];
  if (!adminUid) return res.status(403).json({ error: "no_auth" });

  const db = loadUsers();
  const admin = db[adminUid];

  if (!admin || admin.role !== "admin") {
    return res.status(403).json({ error: "not_admin" });
  }

  res.json({
    ok: true,
    rooms: getLobbyList(),
    ts: Date.now()
  });
});

app.get("/api/market", (req,res)=>{
  cleanupExpiredBooths();
  const market = loadMarket();

  // 🔧 đảm bảo product nào cũng có images[]
  Object.values(market).forEach(booth=>{
    (booth?.products || []).forEach(p=>{
      if (!Array.isArray(p.images) || p.images.length === 0) {
        p.images = p.image ? [p.image] : [];
      }
    });
  });

  res.json({ ok:true, market });
});


app.post("/api/market/order/received", (req,res)=>{
  const uid = req.headers["x-uid"];
  const { orderId } = req.body;

  if(!uid) return res.json({ ok:false, error:"NOT_LOGIN" });

  const market = loadMarket();
  let found, booth, boothId;

  for(const [id,b] of Object.entries(market)){
    const o = (b.orders || []).find(x=>x.id===orderId);
    if(o){
      found = o;
      booth = b;
      boothId = id;
      break;
    }
  }

  if(!found) return res.json({ ok:false, error:"ORDER_NOT_FOUND" });
  if(found.buyerUid !== uid)
    return res.json({ ok:false, error:"NO_PERMISSION" });

  if(found.status !== "contacted"){
    return res.json({
      ok:false,
      error:"INVALID_STATUS",
      message:"You can confirm only after the seller has contacted the buyer."
    });
  }


  found.status = "buyer_received";
  found.receivedAt = Date.now();

  saveMarket(market);

  io.emit("order-updated",{ boothId, order: found });


// =========================
// 🔔 NOTIFY SELLER: BUYER ĐÃ NHẬN HÀNG
// =========================
const notifyText =
  `The buyer has confirmed receipt of: ${found.productName} ×${found.qty}`;

// 1️⃣ REALTIME (nếu seller đang online)
const sockets = activeUsers.get(booth.ownerUid);
if (sockets) {
  for (const sid of sockets) {
    io.to(sid).emit("system-notify", {
      type: "order-received",
      boothId,
      orderId: found.id,
      text: notifyText,
      ts: Date.now()
    });
  }
}

// 2️⃣ PUSH NOTIFICATION (offline / tab khác)
sendPushToUser(booth.ownerUid, {
  title: "The buyer has received the order",
  body: notifyText,
  tag: "order-received"
});

  res.json({ ok:true });
});




app.post("/api/market/order/dispute", (req,res)=>{
  const uid = req.headers["x-uid"];
  const { orderId, reason } = req.body;

  if(!uid) return res.json({ ok:false, error:"NOT_LOGIN" });

  const market = loadMarket();
  let found, booth, boothId;

  for(const [id,b] of Object.entries(market)){
    const o = (b.orders||[]).find(x=>x.id===orderId);
    if(o){
      found=o; booth=b; boothId=id;
      break;
    }
  }

  if(!found) return res.json({ ok:false, error:"ORDER_NOT_FOUND" });
  if(found.buyerUid !== uid)
    return res.json({ ok:false, error:"NO_PERMISSION" });

  if(!["contacted","buyer_received"].includes(found.status)){
    return res.json({
      ok:false,
      message:"You cannot file a dispute in the current order status."
    });
  }

  // 🔒 gắn dispute
  found.status = "dispute";

found.dispute = {
  reason,
  evidences: Array.isArray(req.body.evidences)
    ? req.body.evidences
    : [],
  ts: Date.now()
};


  saveMarket(market);

  io.emit("order-updated",{ boothId, order: found });

  // 🔔 notify seller
  sendPushToUser(booth.ownerUid,{
    title:"Order disputed",
    body:`${found.productName} ×${found.qty}`,
    tag:"order-dispute"
  });

  res.json({ ok:true });
});



app.post("/api/admin/market/refund", (req,res)=>{
  const { adminUid, orderId } = req.body;

  const users = loadUsers();
  if(!users[adminUid] || users[adminUid].role!=="admin")
    return res.status(403).json({ error:"not_admin" });

  const market = loadMarket();
  let found, booth, boothId;

  for(const [id,b] of Object.entries(market)){
    const o=(b.orders||[]).find(x=>x.id===orderId);
    if(o){
      found=o; booth=b; boothId=id;
      break;
    }
  }

  if(!found || found.status!=="dispute")
    return res.json({ ok:false, error:"NOT_DISPUTE" });

  const buyer = users[found.buyerUid];
  if(buyer?.profile){
    buyer.profile.coins += found.escrow;
  }

  found.status = "refunded";
  found.escrow = 0;
  found.refundedAt = Date.now();

  saveUsers(users);
  saveMarket(market);

  emitCoinUpdate(found.buyerUid);

  io.emit("order-updated",{ boothId, order: found });

  res.json({ ok:true });
});


app.post("/api/market/order/hide", (req, res) => {
  const uid = req.headers["x-uid"];
  const { orderId, role } = req.body; 
  // role = "buyer" | "seller"

  if (!uid) return res.json({ ok: false, error: "NOT_LOGIN" });

  const market = loadMarket();
  let order, booth, boothId;

  // ✅ PHẢI LẤY boothId TỪ KEY
  for (const [id, b] of Object.entries(market)) {
    const o = (b.orders || []).find(x => x.id === orderId);
    if (o) {
      order = o;
      booth = b;
      boothId = id; // 🔥 CHÍNH LÀ CHỖ NÀY
      break;
    }
  }

  if (!order) return res.json({ ok:false, error:"ORDER_NOT_FOUND" });

// 🔒 CHỈ CHO XOÁ KHI ĐƠN ĐÃ HOÀN TẤT HOẶC ĐÃ HUỶ
if (!["done", "cancelled", "refunded"].includes(order.status)) {

  return res.json({
    ok: false,
    error: "ORDER_NOT_ALLOWED",
    message: "Order history can only be deleted after the order is completed or canceled."
  });
}




  if (role === "buyer") {
    if (order.buyerUid !== uid)
      return res.json({ ok:false, error:"NO_PERMISSION" });
    order.hiddenByBuyer = true;
  }

  if (role === "seller") {
    if (booth.ownerUid !== uid)
      return res.json({ ok:false, error:"NO_PERMISSION" });
    order.hiddenBySeller = true;
  }

  saveMarket(market);

  // 🔄 realtime update ĐÚNG boothId
  io.emit("order-updated", {
    boothId,
    order
  });

  res.json({ ok:true });
});


// 📎 UPLOAD BẰNG CHỨNG KHIẾU NẠI (ảnh / video)
app.post("/api/upload-dispute-media", postMediaUpload.single("file"), async (req, res) => {

    if (!req.file)
      return res.status(400).json({ error: "NO_FILE" });

    const safeName = req.file.originalname
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_");

    const key = `disputes/${Date.now()}_${safeName}`;

    const url = await uploadToR2(
      req.file.buffer,
      key,
      req.file.mimetype
    );

    res.json({
      ok: true,
      url,
      type: req.file.mimetype.startsWith("video")
        ? "video"
        : "image"
    });
  }
);





app.post("/api/market/order/done", (req, res) => {
  const uid = req.headers["x-uid"];
  const { orderId } = req.body;

  if (!uid) return res.json({ ok: false, error: "NOT_LOGIN" });

  const market = loadMarket();
  let found, booth, boothId;

  // 🔍 tìm đơn + boothId ĐÚNG
  for (const [id, b] of Object.entries(market)) {
    const o = (b.orders || []).find(x => x.id === orderId);
    if (o) {
      found = o;
      booth = b;
      boothId = id;
      break;
    }
  }

  if (!found) return res.json({ ok: false, error: "ORDER_NOT_FOUND" });

  // 🔒 chỉ chủ shop
  if (booth.ownerUid !== uid)
    return res.json({ ok: false, error: "NO_PERMISSION" });

  // 🔒 chỉ khi người mua đã nhận hàng
  if (found.status !== "buyer_received") {
    return res.json({
      ok: false,
      error: "WAIT_BUYER",
      message: "Waiting for the buyer to confirm receipt."
    });
  }

  // =========================
  // ✅ 1️⃣ cập nhật trạng thái
  // =========================
  found.status = "done";
  found.doneAt = Date.now();

  // =========================
  // 💰 2️⃣ TRẢ TIỀN CHO SELLER
  // =========================
  const users = loadUsers();
  const seller = users[booth.ownerUid];

  const amount = Number(found.escrow || found.totalPrice || 0);

  if (seller && seller.profile && amount > 0) {
    seller.profile.coinReceived =
      (seller.profile.coinReceived || 0) + amount;

    // 🔓 giải phóng escrow
    found.escrow = 0;
  }

  saveUsers(users);
  saveMarket(market);

  // 🔄 realtime update ĐÚNG boothId
  io.emit("order-updated", {
    boothId,
    order: found
  });

  // 🔄 realtime update coin cho seller
  emitCoinUpdate(booth.ownerUid);

  // =========================
  // 🔔 notify buyer
  // =========================
 const notifyText = `Order completed: ${found.productName} ×${found.qty}`;

  const sockets = activeUsers.get(found.buyerUid);
  if (sockets) {
    for (const sid of sockets) {
      io.to(sid).emit("system-notify", {
        type: "order-done",
        boothId,
        text: notifyText,
        ts: Date.now()
      });
    }
  }

  sendPushToUser(found.buyerUid, {
    title: "Order completed",
    body: notifyText,
    tag: "order-done"
  });

  res.json({ ok: true });
});





app.post("/api/market/order/contact", (req, res) => {
  const uid = req.headers["x-uid"];
  const { orderId } = req.body;

  if (!uid) return res.json({ ok:false, error:"NOT_LOGIN" });

  const market = loadMarket();
  let found, booth;

  for (const b of Object.values(market)) {
    const o = (b.orders || []).find(x => x.id === orderId);
    if (o) {
      found = o;
      booth = b;
      break;
    }
  }

  if (!found) return res.json({ ok:false, error:"ORDER_NOT_FOUND" });

  // 🔒 chỉ chủ gian
  if (booth.ownerUid !== uid)
    return res.json({ ok:false, error:"NO_PERMISSION" });

  // 🔒 chỉ khi pending
  if (found.status !== "pending") {
    return res.json({
      ok:false,
      error:"INVALID_STATUS",
      message:"This order cannot be confirmed."
    });
  }

  // ✅ cập nhật trạng thái
  found.status = "contacted";
  found.contactedAt = Date.now();

  saveMarket(market);

  // 🔄 realtime update booth
io.emit("order-updated", {
  boothId: booth.boothId,
  order: found
});



  // 🔔 notify buyer
  const notifyText = `The seller has contacted the buyer about: ${found.productName}`;

  const sockets = activeUsers.get(found.buyerUid);
  if (sockets) {
    for (const sid of sockets) {
      io.to(sid).emit("system-notify", {
        type: "order-contacted",
        boothId: booth.id,
        text: notifyText,
        ts: Date.now()
      });
    }
  }

  sendPushToUser(found.buyerUid, {
    title: "Order contact confirmed",
    body: notifyText,
    tag: "order-contacted"
  });

  res.json({ ok:true });
});



app.post("/api/market/order/cancel", (req,res)=>{
  const uid = req.headers["x-uid"];
  const { orderId } = req.body;

  if(!uid) return res.json({ ok:false, error:"NOT_LOGIN" });

  const market = loadMarket();
  let found, booth, product;

  for(const b of Object.values(market)){
    const o = (b.orders || []).find(x => x.id === orderId);
    if(o){
      found = o;
      booth = b;
      product = (b.products || []).find(p => p.id === o.productId);
      break;
    }
  }

  if(!found) return res.json({ ok:false, error:"ORDER_NOT_FOUND" });
  if(found.buyerUid !== uid)
    return res.json({ ok:false, error:"NO_PERMISSION" });

if(found.status === "contacted"){
  return res.json({
    ok:false,
    error:"ORDER_CONTACTED",
    message:"The seller has already contacted the buyer. This order cannot be canceled."
  });
}

if(found.status !== "pending"){
  return res.json({
    ok:false,
    error:"CANNOT_CANCEL",
    message:"This order cannot be canceled."
  });
}


  // =========================
  // 1️⃣ cập nhật trạng thái
  // =========================
  found.status = "cancelled";
  found.cancelledAt = Date.now();

  // =========================
  // 2️⃣ hoàn stock
  // =========================
  if(product) product.stock += found.qty;

  // =========================
  // 3️⃣ HOÀN / ĐIỀU CHỈNH COIN
  // =========================
  const users = loadUsers();

  // 👤 BUYER
  const buyer = users[found.buyerUid];
  if(buyer && buyer.profile){
    buyer.profile.coins += found.totalPrice;
    buyer.profile.coinSent = Math.max(
      0,
      (buyer.profile.coinSent || 0) - found.totalPrice
    );
  }

  // 🏪 SELLER
  const owner = users[booth.ownerUid];
  if(owner && owner.profile){
    owner.profile.coinReceived = Math.max(
      0,
      (owner.profile.coinReceived || 0) - found.totalPrice
    );
  }

  saveUsers(users);
  saveMarket(market);

  // 🔄 REALTIME UPDATE COIN
  emitCoinUpdate(found.buyerUid);
  emitCoinUpdate(booth.ownerUid);

  // =========================
  // 4️⃣ notify chủ gian
  // =========================
  const notifyText = `Order canceled: ${found.productName} ×${found.qty}`;

  const sockets = activeUsers.get(booth.ownerUid);
  if(sockets){
    for(const sid of sockets){
      io.to(sid).emit("system-notify",{
        type:"order-cancel",
        boothId: booth.id,
        text: notifyText,
        ts: Date.now()
      });
    }
  }

  sendPushToUser(booth.ownerUid,{
    title:"Order canceled",
    body: notifyText,
    tag:"order-cancel"
  });


// 🔄 REALTIME ORDER UPDATE (KHÔNG RELOAD)
io.emit("order-updated", {
  boothId: booth.boothId,
  order: found
});




  res.json({ ok:true });
});





app.post("/api/upload-product-image",
  postMediaUpload.single("image"),
  async (req, res) => {

  if (!req.file)
    return res.status(400).json({ error: "No file" });

  const safeName = req.file.originalname
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");

  const key = `products/${Date.now()}_${safeName}`;

  const url = await uploadToR2(
    req.file.buffer,
    key,
    req.file.mimetype
  );

  res.json({ url });
});





// ===== ADD PRODUCT TO BOOTH =====
app.post("/api/market/product/add", (req, res) => {
  const uid = req.headers["x-uid"];
  const { boothId, product } = req.body || {};

  if (!uid || !boothId || !product)
    return res.status(400).json({ error: "missing" });

  // 🔒 booth bị khoá thì chặn
  if (blockIfBoothLockedById(boothId, uid)) {
    return res.status(403).json({ error: "booth_locked" });
  }

  const users = loadUsers();
  const me = users[uid];
  if (!me || !me.profile)
    return res.status(403).json({ error: "no_auth" });

  const market = loadMarket();
  const booth = market[boothId];

  if (!booth)
    return res.status(404).json({ error: "booth_not_found" });

  if (booth.ownerUid !== uid)
    return res.status(403).json({ error: "not_owner" });

  // ✅ đảm bảo có mảng products
  booth.products ||= [];

const images =
  Array.isArray(product.images) && product.images.length
    ? product.images
    : (product.image ? [product.image] : []);

const newProduct = {
  id: "p_" + Date.now(),
  name: String(product.name || "").trim(),
  price: Number(product.price || 0),

  image: images[0] || "",   // ảnh đại diện
  images: images,           // ✅ LƯU TẤT CẢ ẢNH

  desc: product.desc || "",
  stock: Number(product.stock || 0),
  createdAt: Date.now()
};


  booth.products.unshift(newProduct);

  saveMarket(market);
  emitMarketUpdate("product-add", boothId);

  res.json({
    ok: true,
    product: newProduct
  });
});


// ===== UPDATE PRODUCT =====
app.post("/api/market/product/update", (req, res) => {
  const uid = req.headers["x-uid"];
  const { boothId, productId, product } = req.body || {};

  if (!uid || !boothId || !productId || !product)
    return res.status(400).json({ error: "missing" });

  if (blockIfBoothLockedById(boothId, uid))
    return res.status(403).json({ error: "booth_locked" });

  const market = loadMarket();
  const booth = market[boothId];
  if (!booth) return res.status(404).json({ error: "booth_not_found" });

  if (booth.ownerUid !== uid)
    return res.status(403).json({ error: "not_owner" });

  const p = (booth.products || []).find(x => x.id === productId);
  if (!p) return res.status(404).json({ error: "product_not_found" });

  // ✏️ update fields
  p.name  = String(product.name || p.name).trim();
  p.price = Number(product.price ?? p.price);
  p.desc  = product.desc ?? p.desc;
  p.stock = Number(product.stock ?? p.stock);

  // 🖼️ update gallery nếu có gửi lên
if (Array.isArray(product.images) && product.images.length) {
  p.images = product.images;
  p.image  = product.images[0];
}


  saveMarket(market);
  emitMarketUpdate("product-update", boothId);

  res.json({ ok: true });
});


// ===== BUY PRODUCT =====
// ===== BUY PRODUCT =====
// ===== BUY PRODUCT (FIXED) =====
app.post("/api/market/product/buy", (req, res) => {
  const buyerUid = req.headers["x-uid"];
  const { boothId, productId, buyerInfo } = req.body || {};

  if (!buyerUid || !boothId || !productId || !buyerInfo)
    return res.status(400).json({ error: "missing" });

  const qty = Math.max(1, Number(buyerInfo.qty || 1));

  const users = loadUsers();
  const buyer = users[buyerUid];
  if (!buyer || !buyer.profile)
    return res.status(403).json({ error: "no_auth" });

  const market = loadMarket();

  const booth = market[boothId];
  if (!booth)
    return res.status(404).json({ error: "booth_not_found" });

  // 🔒 BOOTH BỊ KHOÁ → KHÔNG CHO MUA
if (blockIfBoothLockedById(boothId, buyerUid)) {
  return res.status(403).json({
    ok: false,
    error: "booth_locked"
  });
}


  const product = (booth.products || []).find(p => p.id === productId);
  if (!product)
    return res.status(404).json({ error: "product_not_found" });

  if (product.stock < qty)
    return res.json({ ok: false, error: "out_of_stock" });

  const price = Number(product.price || 0);
  const totalPrice = price * qty;
  const buyerCoins = Number(buyer.profile.coins || 0);

  if (buyerCoins < totalPrice)
    return res.json({ ok: false, error: "not_enough_coin" });

  // 💎 TRỪ COIN NGƯỜI MUA
  buyer.profile.coins -= totalPrice;
  buyer.profile.coinSent =
    (buyer.profile.coinSent || 0) + totalPrice;


  // 📦 TRỪ STOCK
  product.stock -= qty;

  // 🧾 LƯU ĐƠN HÀNG
  booth.orders ||= [];
  booth.orders.unshift({
    id: "o_" + Date.now(),
    productId,
    productName: product.name,
    price,
    qty,
    totalPrice,
    buyerUid,
    buyerInfo,
    status: "pending", // pending | contacted | done
    escrow: totalPrice,
    createdAt: Date.now()
  });

  saveUsers(users);
  saveMarket(market);

  emitMarketUpdate("product-buy", boothId);
  emitCoinUpdate(buyerUid);
  emitCoinUpdate(booth.ownerUid);

  // 🔔 INBOX CHO CHỦ SHOP
  if (!userInbox.has(booth.ownerUid))
    userInbox.set(booth.ownerUid, []);

  userInbox.get(booth.ownerUid).unshift({
    type: "market-order",
    boothId,
    text: `New order: ${product.name} ×${qty}`,
    time: Date.now(),
    read: false
  });

  saveInbox(Object.fromEntries(userInbox));



// ===============================
// 🔔 REALTIME + PUSH NOTIFY CHỦ GIAN
// ===============================
const notifyText = `New order: ${product.name} ×${qty}`;

// 1️⃣ REALTIME NẾU CHỦ GIAN ĐANG ONLINE
const sockets = activeUsers.get(booth.ownerUid);
if (sockets) {
  for (const sid of sockets) {
    io.to(sid).emit("system-notify", {
      type: "market-order",
      boothId,
      productId,
      text: notifyText,
      ts: Date.now()
    });
  }
}

// 2️⃣ PUSH NOTIFICATION (KHI OFFLINE / TAB KHÁC)
sendPushToUser(booth.ownerUid, {
  title: "New order",
  body: `${product.name} ×${qty} — ${totalPrice.toLocaleString()} 💎`,
  tag: "market-order"
});



  res.json({ ok: true });



  
});




app.get("/api/me/coin", (req, res) => {
  const uid = req.headers["x-uid"];
  if (!uid) return res.json({ ok:false });

  const users = loadUsers();
  const me = users[uid];
  if (!me || !me.profile) return res.json({ ok:false });

  res.json({
    ok: true,
    coins: Number(me.profile.coins) || 0
  });
});




// ===== DELETE PRODUCT =====
app.post("/api/market/product/delete", (req, res) => {
  const uid = req.headers["x-uid"];
  const { boothId, productId } = req.body || {};

  if (!uid || !boothId || !productId)
    return res.status(400).json({ error: "missing" });

  if (blockIfBoothLockedById(boothId, uid))
    return res.status(403).json({ error: "booth_locked" });

  const market = loadMarket();
  const booth = market[boothId];
  if (!booth) return res.status(404).json({ error: "booth_not_found" });

  if (booth.ownerUid !== uid)
    return res.status(403).json({ error: "not_owner" });

  booth.products = (booth.products || []).filter(p => p.id !== productId);

  saveMarket(market);
  emitMarketUpdate("product-delete", boothId);

  res.json({ ok: true });
});


app.post("/api/market/extend", (req, res) => {
  const uid = req.headers["x-uid"];
  const { boothId, days, price } = req.body || {};

  if (!uid || !boothId || !days || !price)
    return res.status(400).json({ error: "missing" });

  const users = loadUsers();
  const user = users[uid];
  if (!user || !user.profile)
    return res.status(403).json({ error: "no_auth" });

  if ((user.profile.coins || 0) < price)
    return res.status(400).json({ error: "not_enough_coin" });

  const market = loadMarket();
  const booth = market[boothId];

  if (!booth)
    return res.status(404).json({ error: "booth_not_found" });

  if (booth.ownerUid !== uid)
    return res.status(403).json({ error: "not_owner" });

// 🔒 BOOTH BỊ KHOÁ → KHÔNG CHO GIA HẠN
if (blockIfBoothLockedById(boothId, uid)) {
  return res.status(403).json({ error: "booth_locked" });
}


  
  // ➕ GIA HẠN
  booth.expireAt = Math.max(booth.expireAt, Date.now())
    + days * 24 * 60 * 60 * 1000;

  // ➖ TRỪ COIN
  user.profile.coins -= price;
  user.profile.coinSent = (user.profile.coinSent || 0) + price;

  saveUsers(users);
  saveMarket(market);
  emitCoinUpdate(uid);
  emitMarketUpdate("extend", boothId);

  res.json({
    ok: true,
    expireAt: booth.expireAt,
    coins: user.profile.coins
  });
});



app.get("/api/market/booth/:id", (req, res) => {
  const boothId = req.params.id;
  const uid = req.headers["x-uid"];

  const users = loadUsers();
  const me = uid ? users[uid] : null;
  const isAdmin = me?.role === "admin";

  const market = loadMarket();
  const booth = market[boothId];

  if (!booth) {
    return res.status(404).json({
      ok: false,
      message: "Booth not found"
    });
  }

  // 🔒 Booth bị khoá
  if (booth.locked && !isAdmin) {
    return res.status(403).json({
      ok: false,
      locked: true,
      message: "This booth has been locked by an admin"
    });
  }

// 🔧 đảm bảo product nào cũng có images[]
(booth.products || []).forEach(p=>{
  if (!Array.isArray(p.images) || p.images.length === 0) {
    p.images = p.image ? [p.image] : [];
  }
});

res.json({
  ok: true,
  booth
});

});




app.post("/api/admin/market/lock", (req,res)=>{
  const uid = req.headers["x-uid"];
  const { boothId, lock } = req.body || {};

  const users = loadUsers();
  if(!users[uid] || users[uid].role !== "admin")
    return res.status(403).json({ error:"no_permission" });

  const market = loadMarket();
  if(!market[boothId])
    return res.status(404).json({ error:"not_found" });


  market[boothId].locked = !!lock;
  saveMarket(market);

  emitMarketUpdate(lock ? "lock" : "unlock", boothId); // 🔥 REALTIME


// 🚨 KICK REALTIME TOÀN BỘ USER ĐANG TRONG BOOTH
io.emit("booth-force-locked", {
  boothId,
  locked: !!lock,
  ts: Date.now()
});




// 🔔 NOTIFY CHỦ GIAN
const booth = market[boothId];
const ownerUid = booth.ownerUid;

if (ownerUid) {
  const msg = lock
    ? `🔒 Your booth #${boothId} has been locked by an admin`
    : `🔓 Your booth #${boothId} has been unlocked by an admin`;

  // 1️⃣ LƯU INBOX (offline vẫn thấy)
  if (!userInbox.has(ownerUid)) userInbox.set(ownerUid, []);
  userInbox.get(ownerUid).unshift({
    type: "market-booth",
    boothId,
    action: lock ? "lock" : "unlock",
    text: msg,
    time: Date.now(),
    read: false
  });
  saveInbox(Object.fromEntries(userInbox));

  // 2️⃣ REALTIME NẾU ONLINE
  const sockets = activeUsers.get(ownerUid);
  if (sockets) {
    for (const sid of sockets) {
      io.to(sid).emit("system-notify", {
        type: "market-booth",
        boothId,
        action: lock ? "lock" : "unlock",
        text: msg
      });
    }
  }

  // 3️⃣ PUSH NOTIFICATION (KHI OFFLINE)
  sendPushToUser(ownerUid, {
    title: lock ? "Booth locked" : "Booth unlocked",
    body: msg,
    tag: "market-booth"
  });
}






  res.json({ ok:true });


});


app.post("/api/admin/market/revoke", (req,res)=>{
  const uid = req.headers["x-uid"];
  const { boothId } = req.body || {};

  const users = loadUsers();
  if(!users[uid] || users[uid].role !== "admin")
    return res.status(403).json({ error:"no_permission" });

  const market = loadMarket();
  if(!market[boothId])
    return res.status(404).json({ error:"not_found" });

market[boothId] = null;
saveMarket(market);

emitMarketUpdate("revoke", boothId); // 🔥 REALTIME

res.json({ ok:true });


});



app.post("/api/market/rent", (req,res)=>{
  const uid = req.headers["x-uid"];
  const { boothId, days, price, trial } = req.body || {};

  if(!uid || !boothId || !days)
    return res.status(400).json({ error:"missing" });

  const db = loadUsers();
  const user = db[uid];
  if(!user || !user.profile)
    return res.status(403).json({ error:"no_auth" });

  const market = loadMarket();

  // 🔒 MỖI USER CHỈ ĐƯỢC 1 GIAN
  const alreadyHaveBooth = Object.values(market).some(
    b => b && b.ownerUid === uid
  );
  if (alreadyHaveBooth) {
    return res.status(400).json({ error: "already_have_booth" });
  }

  if(market[boothId])
    return res.status(400).json({ error:"already_rented" });

  // =================================================
  // 🎁 TRIAL MODE – DÙNG THỬ MIỄN PHÍ 30 NGÀY
  // =================================================
  if(trial === true){

    if(user.profile.hasUsedTrial){
      return res.status(400).json({ error:"trial_used" });
    }

    market[boothId] = {
      boothId,
      ownerUid: uid,
      name: user.profile.name,
      logo: user.profile.avatar,
      expireAt: Date.now() + 30*24*60*60*1000,
      locked: false,
      trial: true,
      products: []
    };

    user.profile.hasUsedTrial = true;

    saveUsers(db);
    saveMarket(market);

    emitMarketUpdate("rent", boothId);

    return res.json({
      ok: true,
      trial: true,
      booth: market[boothId]
    });
  }

  // =================================================
  // 💎 RENT THƯỜNG – TRỪ COIN
  // =================================================
  const cost = Number(price || 0);
  const coins = Number(user.profile.coins || 0);

  if(cost <= 0)
    return res.status(400).json({ error:"invalid_price" });

  if(coins < cost)
    return res.status(400).json({ error:"not_enough_coin" });

  // ➖ TRỪ COIN
  user.profile.coins -= cost;
  user.profile.coinSent = (user.profile.coinSent || 0) + cost;

  market[boothId] = {
    boothId,
    ownerUid: uid,
    name: user.profile.name,
    logo: user.profile.avatar,
    expireAt: Date.now() + days*24*60*60*1000,
    locked: false,
    products: []
  };

  saveUsers(db);
  saveMarket(market);

  emitCoinUpdate(uid);
  emitMarketUpdate("rent", boothId);

  res.json({
    ok:true,
    booth: market[boothId],
    coins: user.profile.coins
  });
});




// ===== ADMIN DELETE COMMENT / REPLY =====
app.post("/api/admin/delete-comment", (req, res) => {
  const { adminUid, postId, commentId, replyId, reason } = req.body || {};

  if (!adminUid || !postId || !commentId) {
    return res.status(400).json({ error: "missing" });
  }

  const db = loadUsers();
  const admin = db[adminUid];

  if (!admin || admin.role !== "admin") {
    return res.status(403).json({ error: "not_admin" });
  }

  const post = lpPosts.find(p => p.id === postId);
  if (!post || !Array.isArray(post.comments)) {
    return res.status(404).json({ error: "post_not_found" });
  }

  const cmt = post.comments.find(c => c.id === commentId);
  if (!cmt) {
    return res.status(404).json({ error: "comment_not_found" });
  }

  // 🔹 XOÁ REPLY
  if (replyId) {
    const idx = (cmt.replies || []).findIndex(r => r.id === replyId);
    if (idx === -1) {
      return res.status(404).json({ error: "reply_not_found" });
    }

    const reply = cmt.replies[idx];
    cmt.replies.splice(idx, 1);

    saveSocial();

    // 🔔 inbox user bị xoá reply
    if (reply.uid) {
      userInbox.set(reply.uid, userInbox.get(reply.uid) || []);
      userInbox.get(reply.uid).unshift({
        type: "reply-deleted",
        text: `Your reply was deleted by an admin${reason ? `\nReason: ${reason}` : ""}`,
        time: Date.now(),
        read: false
      });
      saveInbox(Object.fromEntries(userInbox));
    }

   
emitPrivateSocialEvent(
  "social-update",
  post,
  {
    type: "reply-deleted",
    postId,
    commentId,
    replyId
  }
);


    return res.json({ ok: true });
  }

  // 🔸 XOÁ COMMENT
  const idx = post.comments.findIndex(c => c.id === commentId);
  const removed = post.comments[idx];
  post.comments.splice(idx, 1);
  saveSocial();

  // 🔔 inbox user bị xoá comment
  if (removed.uid) {
    userInbox.set(removed.uid, userInbox.get(removed.uid) || []);
    userInbox.get(removed.uid).unshift({
      type: "comment-deleted",
      text: `Your comment was deleted by an admin${reason ? `\nReason: ${reason}` : ""}`,
      time: Date.now(),
      read: false
    });
    saveInbox(Object.fromEntries(userInbox));
  }


emitPrivateSocialEvent(
  "social-update",
  post,
  {
    type: "comment-deleted",
    postId,
    commentId
  }
);


  res.json({ ok: true });
});


// ===== ADMIN DELETE POST =====
app.post("/api/admin/delete-post", (req, res) => {
  const { adminUid, postId, reason } = req.body || {};

  if (!adminUid || !postId) {
    return res.status(400).json({ error: "missing" });
  }

  const db = loadUsers();
  const admin = db[adminUid];

  // 🔒 chỉ admin
  if (!admin || admin.role !== "admin") {
    return res.status(403).json({ error: "not_admin" });
  }

  const idx = lpPosts.findIndex(p => p.id === postId);
  if (idx === -1) {
    return res.status(404).json({ error: "post_not_found" });
  }

  const post = lpPosts[idx];

  // 🧾 log admin action (nên có)
  post.adminDeleted = {
    by: adminUid,
    reason: reason || "",
    ts: Date.now()
  };

  // ❌ xoá khỏi danh sách hiển thị
  lpPosts.splice(idx, 1);
  saveSocial();

  // 🔔 thông báo cho chủ bài đăng (nếu còn tồn tại)
  const ownerUid = post.uid;
  if (ownerUid) {
    if (!userInbox.has(ownerUid)) userInbox.set(ownerUid, []);
    userInbox.get(ownerUid).unshift({
      type: "post-deleted",
      text: `Your post was deleted by an admin${reason ? `\nReason: ${reason}` : ""}`,
      time: Date.now(),
      read: false
    });
    saveInbox(Object.fromEntries(userInbox));
  }

  
emitPrivateSocialEvent(
  "social-update",
  post,
  {
    type: "post-deleted",
    postId
  }
);


  res.json({ ok: true });
});


app.post("/api/admin/close-room", (req, res) => {
  const { adminUid, roomId, reason } = req.body || {};

  if(!adminUid || !roomId){
    return res.status(400).json({ error: "missing" });
  }

  const db = loadUsers();
  const admin = db[adminUid];

  if(!admin || admin.role !== "admin"){
    return res.status(403).json({ error: "not_admin" });
  }

  const rid = String(roomId).trim().toLowerCase();
  const room = rooms.get(rid);

  if(!room || !room.broadcasterId){
    return res.status(404).json({ error: "room_not_live" });
  }

  // 🚨 ĐÓNG ROOM
  closeRoom(rid, "admin_closed");

  // 🔔 notify host nếu có
  if(room.hostProfile?.uid){
    const uid = room.hostProfile.uid;

    // realtime
    const sockets = activeUsers.get(uid);
    if(sockets){
      for(const sid of sockets){
        io.to(sid).emit("system-notify", {
title: "🚫 Livestream room closed",
body: reason || "Your livestream room was closed by an admin",
        });
      }
    }

    // push offline
    sendPushToUser(uid, {
      title: "🚫 Phòng live bị đóng",
      body: reason || "Phòng live của bạn đã bị Admin đóng",
      tag: "admin-close-room"
    });
  }

  res.json({ ok:true });
});



// ===== ADMIN LOCK / UNLOCK USER =====
app.post("/api/admin/lock-user", (req, res) => {

const body = req.body || {};
const { adminUid, targetUid, lock, reason } = body;




  if (!adminUid || !targetUid) {
    return res.status(400).json({ error: "missing" });
  }

  const db = loadUsers();
  const admin = db[adminUid];
  const user = db[targetUid];

  if (!admin || admin.role !== "admin") {
    return res.status(403).json({ error: "not_admin" });
  }

  if (!user || !user.profile) {
    return res.status(404).json({ error: "user_not_found" });
  }

  // 🚫 KHÔNG CHO KHOÁ ADMIN
if (user.role === "admin" || targetUid === adminUid) {
  return res.status(403).json({ error: "cannot_lock_admin" });
}


  user.profile.accountBlocked = !!lock;

  user.profile.blockedAt = lock ? Date.now() : null;

// 🧾 LOG LÝ DO KHOÁ / MỞ KHOÁ
user.profile.blockLogs ||= [];
user.profile.blockLogs.unshift({
  by: adminUid,
  action: lock ? "lock" : "unlock",
  reason: reason || "",
  ts: Date.now()
});




  saveUsers(db);

// 🔔 PUSH NOTIFY KHI KHOÁ USER
if (lock) {
const msg = reason
  ? `Your account has been locked.\nReason: ${reason}`
  : "Your account has been locked. Please contact support.";

  // 1️⃣ realtime nếu online
  const sockets = activeUsers.get(targetUid);
  if (sockets) {
    for (const sid of sockets) {
      io.to(sid).emit("system-notify", {
        type: "blocked",
        text: msg
      });
    }
  }

  // 2️⃣ push notification (offline)
  sendPushToUser(targetUid, {
    title: "Account locked",
    body: msg,
    tag: "account-blocked"
  });
}


// 🔓 PUSH NOTIFY KHI MỞ KHOÁ USER
if (!lock) {
const msg = reason
  ? `🔓 Your account has been unlocked.\nNote: ${reason}`
  : "🔓 Your account has been unlocked. You can use the service again.";

  // 1️⃣ realtime nếu online
  const sockets = activeUsers.get(targetUid);
  if (sockets) {
    for (const sid of sockets) {
      io.to(sid).emit("system-notify", {
        type: "unblocked",
        text: msg
      });
    }
  }

  // 2️⃣ push notification (offline)
  sendPushToUser(targetUid, {
    title: "Account unlocked",
    body: msg,
    tag: "account-unblocked"
  });
}



  res.json({
    ok: true,
    uid: targetUid,
    blocked: user.profile.blocked
  });
});




app.post("/api/upload-chat-image", chatUpload.single("image"), async (req, res) => {

  if (!req.file) return res.status(400).json({ error: "No file" });

const safeName = req.file.originalname
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "") // bỏ dấu tiếng Việt
  .replace(/[^a-zA-Z0-9._-]/g, "_");


const key = `chat/images/${Date.now()}_${safeName}`;


  const url = await uploadToR2(
    req.file.buffer,
    key,
    req.file.mimetype
  );

  res.json({ url });
});

app.post("/api/upload-chat-video", chatUpload.single("video"), async (req, res) => {

  if (!req.file) return res.status(400).json({ error: "No file" });

const safeName = req.file.originalname
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "") // bỏ dấu tiếng Việt
  .replace(/[^a-zA-Z0-9._-]/g, "_");


const key = `chat/videos/${Date.now()}_${safeName}`;

  const url = await uploadToR2(
    req.file.buffer,
    key,
    req.file.mimetype
  );

  res.json({ url });
});

app.get("/", (_, res) => {
  res.redirect("/social.html");
});



app.post("/api/upload-avatar", avatarCoverUpload.single("avatar"), async (req, res) => {

    if (!req.file) return res.status(400).json({ error: "No file" });

    const safeName = req.file.originalname
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_");

    const uid = req.headers["x-uid"] || "guest";

    const key = `avatars/${uid}_${Date.now()}_${safeName}`;

    const url = await uploadToR2(
      req.file.buffer,
      key,
      req.file.mimetype
    );

    res.json({ url });
  }
);

app.post("/api/upload-cover", avatarCoverUpload.single("cover"), async (req, res) => {

    if (!req.file) return res.status(400).json({ error: "No file" });

    const safeName = req.file.originalname
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_");

    const uid = req.headers["x-uid"] || "guest";

    const key = `covers/${uid}_${Date.now()}_${safeName}`;

    const url = await uploadToR2(
      req.file.buffer,
      key,
      req.file.mimetype
    );

    res.json({ url });
  }
);

app.post("/api/upload-post-image",
  postMediaUpload.single("image"),
  async (req, res) => {

  if (!req.file) return res.status(400).json({ error: "No file" });

  const safeName = req.file.originalname
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");

  const key = `posts/images/${Date.now()}_${safeName}`;

  const url = await uploadToR2(
    req.file.buffer,
    key,
    req.file.mimetype
  );

  res.json({ url });
});

app.post("/api/upload-post-video",
  postMediaUpload.single("video"),
  async (req, res) => {

  if (!req.file) return res.status(400).json({ error: "No file" });

  const safeName = req.file.originalname
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");

  const key = `posts/videos/${Date.now()}_${safeName}`;

  const url = await uploadToR2(
    req.file.buffer,
    key,
    req.file.mimetype
  );

  res.json({ url });
});




/* ==========================================
   LIVESTREAM PRO - CONVERT DIAMONDS
   RECEIVED WALLET -> GAME WALLET
   25% CONVERSION FEE
========================================== */

const DIAMOND_CONVERT_RATE = 75;
const DIAMOND_CONVERT_MAX = 1000000000;

function diamondConvertResult(amount) {

  const received = Math.floor(
    amount * DIAMOND_CONVERT_RATE / 100
  );

  return {
    received,
    fee: amount - received
  };
}

function diamondConvertIsValidNumber(value) {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= DIAMOND_CONVERT_MAX
  );
}

/* ==========================================
   READ ACTUAL WALLET BALANCES
========================================== */

app.get(
  "/api/diamonds/convert/state",
  spiritAuth,
  (req, res) => {

    res.set("Cache-Control", "no-store");

    const db = loadUsers();
    const user = db[req.spiritUid];

    if (!user?.profile) {
      return res.status(404).json({
        ok: false,
        message: "Account not found."
      });
    }

    const walletDiamonds = Number(
      user.profile.coinReceived ?? 0
    );

    const gameDiamonds = Number(
      user.profile.coins ?? 0
    );

    if (
      !Number.isSafeInteger(walletDiamonds) ||
      !Number.isSafeInteger(gameDiamonds) ||
      walletDiamonds < 0 ||
      gameDiamonds < 0
    ) {
      return res.status(409).json({
        ok: false,
        message: "Invalid wallet balance."
      });
    }

    return res.json({
      ok: true,
      walletDiamonds,
      gameDiamonds,
      conversionRate: DIAMOND_CONVERT_RATE,
      feePercent: 25
    });
  }
);

/* ==========================================
   CONVERT WALLET DIAMONDS
========================================== */

app.post(
  "/api/diamonds/convert",
  spiritAuth,
  async (req, res) => {

    res.set("Cache-Control", "no-store");

    // Browser requests must originate from this site.
    const origin = req.get("origin");

    const publicUrl = String(
      process.env.LSP_PUBLIC_URL || ""
    ).replace(/\/$/, "");

    if (
      !publicUrl ||
      origin !== publicUrl
    ) {
      return res.status(403).json({
        ok: false,
        message: "Invalid request origin."
      });
    }

    const uid = req.spiritUid;

    const amount = req.body?.amount;
    const requestId = String(
      req.body?.requestId || ""
    );

    const securityCode = req.body?.securityCode;

    if (!diamondConvertIsValidNumber(amount)) {
      return res.status(400).json({
        ok: false,
        message: "Invalid conversion amount."
      });
    }

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        .test(requestId)
    ) {
      return res.status(400).json({
        ok: false,
        message: "Invalid transaction ID."
      });
    }

    if (
      typeof securityCode !== "string" ||
      !securityCode ||
      securityCode.length > 128
    ) {
      return res.status(400).json({
        ok: false,
        message: "Security code required."
      });
    }

    try {

      // Step 1: Read the current account.
      let db = loadUsers();
      let user = db[uid];

      if (!user?.profile) {
        return res.status(404).json({
          ok: false,
          message: "Account not found."
        });
      }

      if (typeof user.securityCode !== "string") {
        return res.status(403).json({
          ok: false,
          message: "Security code not configured."
        });
      }

      const originalHash = user.securityCode;

      // Step 2: Verify security code.
      const validSecurity = await bcrypt.compare(
        securityCode,
        originalHash
      );

      if (!validSecurity) {
        return res.status(403).json({
          ok: false,
          message: "Invalid security code."
        });
      }

      // Step 3: Reload data after bcrypt await.
      // This prevents using a stale balance.
      db = loadUsers();
      user = db[uid];

      if (
        !user?.profile ||
        user.profile.accountBlocked ||
        user.securityCode !== originalHash
      ) {
        return res.status(409).json({
          ok: false,
          message: "Account state changed."
        });
      }

      const profile = user.profile;

      const history = Array.isArray(
        profile.diamondConversionHistory
      )
        ? profile.diamondConversionHistory
        : [];

      // Step 4: Idempotency.
      const previous = history.find(
        item => item.id === requestId
      );

      if (previous) {

        if (previous.amount !== amount) {
          return res.status(409).json({
            ok: false,
            message: "Transaction ID already used."
          });
        }

        return res.json({
          ok: true,
          duplicate: true,
          received: previous.received,
          fee: previous.fee,
          walletDiamonds:
            Number(profile.coinReceived),
          gameDiamonds:
            Number(profile.coins)
        });
      }

      const walletDiamonds = Number(
        profile.coinReceived ?? 0
      );

      const gameDiamonds = Number(
        profile.coins ?? 0
      );

      if (
        !Number.isSafeInteger(walletDiamonds) ||
        !Number.isSafeInteger(gameDiamonds) ||
        walletDiamonds < 0 ||
        gameDiamonds < 0
      ) {
        return res.status(409).json({
          ok: false,
          message: "Invalid wallet data."
        });
      }

      if (walletDiamonds < amount) {
        return res.status(400).json({
          ok: false,
          message: "Insufficient wallet diamonds."
        });
      }

      const result = diamondConvertResult(amount);

      if (
        result.received < 1 ||
        !Number.isSafeInteger(
          gameDiamonds + result.received
        )
      ) {
        return res.status(400).json({
          ok: false,
          message: "Conversion amount not supported."
        });
      }

      // Step 5: Update both wallets together.
      profile.coinReceived =
        walletDiamonds - amount;

      profile.coins =
        gameDiamonds + result.received;

      profile.diamondConversionHistory = [
        {
          id: requestId,
          amount,
          fee: result.fee,
          received: result.received,
          createdAt: Date.now(),
          type: "wallet_to_game"
        },
        ...history
      ];

      // Step 6: Atomic file replacement.
      // Suitable as a single-process interim measure.
      const tempFile =
        USERS_FILE + ".convert." +
        process.pid + "." +
        crypto.randomBytes(6).toString("hex");

      try {
        fs.writeFileSync(
          tempFile,
          JSON.stringify(db, null, 2),
          { mode: 0o600 }
        );

        fs.renameSync(tempFile, USERS_FILE);

      } finally {
        try {
          if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
          }
        } catch (_) {}
      }

      // Step 7: Notify the user's clients.
      emitCoinUpdate(uid);

      return res.json({
        ok: true,
        received: result.received,
        fee: result.fee,
        walletDiamonds: profile.coinReceived,
        gameDiamonds: profile.coins
      });

    } catch (error) {

      console.error(
        "[DIAMOND CONVERSION]",
        error.message
      );

      return res.status(500).json({
        ok: false,
        message: "Conversion could not be confirmed."
      });
    }
  }
);


app.post("/api/withdraw-request", async (req, res) => {
  const uid = req.headers["x-uid"];
  const { amount, bank, securityCode } = req.body || {};


  if (!securityCode) {
  return res.status(400).json({
    error: "missing_security_code"
  });
}


if (!uid || !bank || amount == null) {
  return res.status(400).json({ error: "missing" });
}

const amt = Number(amount);
if (!Number.isFinite(amt) || amt <= 0) {
  return res.status(400).json({ error: "invalid_amount" });
}


  const db = loadUsers();


  const user = db[uid];

  if (!user || !user.profile) {
    return res.status(404).json({ error: "user_not_found" });
  }


  
// 🔐 KIỂM TRA MÃ BẢO MẬT
const okSec = await bcrypt.compare(
  String(securityCode),
  user.securityCode
);

if (!okSec) {
  return res.status(403).json({
    error: "invalid_security_code"
  });
}



  const canWithdraw = Number(user.profile.coinReceived || 0);

  if (amount > canWithdraw) {
    return res.status(400).json({ error: "not_enough_received" });
  }

  if (amount < 100) {
  return res.status(400).json({ error: "min_withdraw" });
}


  const list = loadWithdraws();



// ➖ TRỪ KIM CƯƠNG NGAY KHI GỬI
user.profile.coinReceived -= amt;


// 🧾 LOG (rất nên có)
user.profile.withdrawHold ||= [];
user.profile.withdrawHold.unshift({
  amount: amt,
  ts: Date.now(),
  status: "pending"
});

list.unshift({
  id: Date.now() + "_" + uid,
  uid,
  name: user.profile.name,
  amount: amt,
  bank,
  status: "pending",
  createdAt: Date.now()
});

saveUsers(db);          // 🔥 LƯU USER NGAY
saveWithdraws(list);
emitWithdrawUpdate();
emitCoinUpdate(uid);    // 🔁 realtime coin


  // 🔔 thông báo cho user
  const text = `Withdrawal request submitted for ${Number(amount).toLocaleString()} 💎`;

  if (!userInbox.has(uid)) userInbox.set(uid, []);
  userInbox.get(uid).unshift({
    type: "withdraw-request",
    text,
    time: Date.now(),
    read: false
  });
  saveInbox(Object.fromEntries(userInbox));

  res.json({ ok: true });
});




/* ==========================================
   ADMIN - DIAMOND TRANSFER APPROVAL
========================================== */



/* ==========================================
   DIAMOND TRANSFER - AUTO APPROVAL SETTINGS
========================================== */

const TRANSFER_AUTO_FILE = path.join(
  "/opt/render/project/data",
  "transfer_auto_settings.json"
);

const TRANSFER_AUTO_DELAY = 60 * 1000;

function loadTransferAutoSettings() {
  try {
    if (!fs.existsSync(TRANSFER_AUTO_FILE)) {
      return { enabled: false };
    }

    const data = JSON.parse(
      fs.readFileSync(TRANSFER_AUTO_FILE, "utf8")
    );

    return {
      enabled: data.enabled === true
    };
  } catch (err) {
    console.error("[TRANSFER AUTO LOAD]", err);
    return { enabled: false };
  }
}

let transferAutoSettings = loadTransferAutoSettings();

function saveTransferAutoSettings(settings) {
  const tempFile = TRANSFER_AUTO_FILE + ".tmp";

  fs.writeFileSync(
    tempFile,
    JSON.stringify(settings, null, 2)
  );

  fs.renameSync(tempFile, TRANSFER_AUTO_FILE);
}

/* ==========================================
   ADMIN - READ AUTO APPROVAL CONFIG
========================================== */

app.get("/api/admin/transfer-auto", (req, res) => {
  if (!req.lspAdminActorUid) {
    return res.status(403).json({
      ok: false,
      error: "NOT_ADMIN"
    });
  }

  res.set("Cache-Control", "no-store");

  res.json({
    ok: true,
    enabled: transferAutoSettings.enabled,
    delaySeconds: 60
  });
});

/* ==========================================
   ADMIN - UPDATE AUTO APPROVAL CONFIG
========================================== */

app.post("/api/admin/transfer-auto", (req, res) => {
  if (!req.lspAdminActorUid) {
    return res.status(403).json({
      ok: false,
      error: "NOT_ADMIN"
    });
  }

  const enabled = req.body?.enabled;

  if (typeof enabled !== "boolean") {
    return res.status(400).json({
      ok: false,
      error: "INVALID_SETTING"
    });
  }

  const nextSettings = { enabled };

  try {
    saveTransferAutoSettings(nextSettings);
  } catch (err) {
    console.error("[TRANSFER AUTO SAVE]", err);

    return res.status(500).json({
      ok: false,
      error: "SAVE_FAILED"
    });
  }

  transferAutoSettings = nextSettings;

  io.emit("diamond-transfer-auto-update", {
    enabled,
    delaySeconds: 60,
    ts: Date.now()
  });

  res.json({
    ok: true,
    enabled,
    delaySeconds: 60
  });
});



// Lấy danh sách yêu cầu chuyển
app.get("/api/admin/transfer-requests", (req, res) => {

  if (!req.lspAdminActorUid) {
    return res.status(403).json({
      ok: false,
      error: "NOT_ADMIN"
    });
  }

  const users = loadUsers();
  const list = [];

  for (const [uid, user] of Object.entries(users)) {
    if (!Array.isArray(user?.transferRequests)) continue;

    for (const item of user.transferRequests) {
      list.push({
        ...item,
        fromUid: uid
      });
    }
  }

  list.sort(
    (a, b) => Number(b.createdAt) - Number(a.createdAt)
  );

  res.json({
    ok: true,
    list
  });
});


// Shared handler: manual approval and automatic approval
function handleDiamondTransferAction(req, res) {

  const adminUid = req.lspAdminActorUid;

  if (!adminUid) {
    return res.status(403).json({
      ok: false,
      error: "NOT_ADMIN"
    });
  }

  const { id, action } = req.body || {};

  if (
    typeof id !== "string" ||
    !["approve", "reject"].includes(action)
  ) {
    return res.status(400).json({
      ok: false,
      error: "INVALID_REQUEST"
    });
  }

  const users = loadUsers();

  let request = null;
  let sender = null;

  // Tìm yêu cầu theo ID
  for (const user of Object.values(users)) {

    if (!Array.isArray(user?.transferRequests)) continue;

    const found = user.transferRequests.find(
      item => item.id === id
    );

    if (found) {
      request = found;
      sender = user;
      break;
    }
  }

  if (!request || !sender?.profile) {
    return res.status(404).json({
      ok: false,
      error: "REQUEST_NOT_FOUND"
    });
  }

  if (request.status !== "pending") {
    return res.status(409).json({
      ok: false,
      error: "ALREADY_PROCESSED"
    });
  }

  const recipient = users[request.toUid];
  const amount = Number(request.amount);

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return res.status(400).json({
      ok: false,
      error: "INVALID_AMOUNT"
    });
  }

  const now = Date.now();

  if (action === "approve") {

    if (
      !recipient?.profile ||
      recipient.profile.accountBlocked
    ) {
      return res.status(400).json({
        ok: false,
        error: "RECIPIENT_UNAVAILABLE"
      });
    }

    const current = Number(recipient.profile.coins || 0);

    if (
      !Number.isSafeInteger(current) ||
      !Number.isSafeInteger(current + amount)
    ) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_RECIPIENT_BALANCE"
      });
    }

    // Chỉ đến đây mới cộng kim cương
    recipient.profile.coins = current + amount;

    sender.profile.coinSent =
      Number(sender.profile.coinSent || 0) + amount;

    sender.transferHistory ||= [];
    recipient.transferHistory ||= [];

    sender.transferHistory.unshift({
      id,
      type: "send",
      uid: request.toUid,
      name: request.toName,
      avatar: recipient.profile.avatar || "",
      amount,
      status: "approved",
      time: now
    });

    recipient.transferHistory.unshift({
      id,
      type: "receive",
      uid: request.fromUid,
      name: request.fromName,
      avatar: sender.profile.avatar || "",
      amount,
      status: "approved",
      time: now
    });

    
const todayStart = getTodayStartTsVN();
const todayEnd = todayStart + 86400000;

sender.transferHistory =
  sender.transferHistory
    .filter(t => {
      const time = Number(t.time || t.createdAt || 0);

      return time >= todayStart && time < todayEnd;
    })
    .slice(0, 50);

recipient.transferHistory =
  recipient.transferHistory
    .filter(t => {
      const time = Number(t.time || t.createdAt || 0);

      return time >= todayStart && time < todayEnd;
    })
    .slice(0, 50);

    request.status = "approved";

  } else {

    // Từ chối - hoàn trả kim cương bị tạm giữ
    const current = Number(sender.profile.coins || 0);

    if (
      !Number.isSafeInteger(current) ||
      !Number.isSafeInteger(current + amount)
    ) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_SENDER_BALANCE"
      });
    }

    sender.profile.coins = current + amount;

    request.status = "rejected";
  }

  request.processedAt = now;
  request.processedBy = adminUid;

  try {
    saveUsers(users);
  } catch (err) {
    console.error("[TRANSFER APPROVAL SAVE]", err);

    return res.status(500).json({
      ok: false,
      error: "SAVE_FAILED"
    });
  }

  emitCoinUpdate(request.fromUid);

  if (action === "approve") {
    emitCoinUpdate(request.toUid);
  }

  // Cập nhật danh sách admin
  io.emit("diamond-transfer-update", {
    ts: now
  });

  // Thông báo tới người gửi
  emitToUser(request.fromUid, "notify", {
    type: action === "approve" ? "good" : "bad",
    message: action === "approve"
      ? "Your diamond transfer has been approved."
      : "Transfer rejected. Your diamonds have been refunded."
  });

  // Chỉ thông báo người nhận khi đã duyệt
  if (action === "approve") {
    emitToUser(request.toUid, "notify", {
      type: "good",
      message: `You received ${amount} diamonds from ${request.fromName}`
    });
  }

  return res.json({
    ok: true,
    status: request.status
  });
}

app.post(
  "/api/admin/transfer-action",
  handleDiamondTransferAction
);


/* ==========================================
   DIAMOND TRANSFER - AUTO APPROVAL ENGINE
========================================== */

let transferAutoProcessing = false;

function runTransferAutoApproval() {
  if (!transferAutoSettings.enabled) return;
  if (transferAutoProcessing) return;

  transferAutoProcessing = true;

  try {
    const users = loadUsers();
    const now = Date.now();
    const expired = [];

    // Find pending requests older than 60 seconds
    for (const user of Object.values(users)) {
      if (!Array.isArray(user?.transferRequests)) {
        continue;
      }

      for (const request of user.transferRequests) {
        if (request.status !== "pending") continue;

        const createdAt = Number(request.createdAt);

        if (
          !Number.isFinite(createdAt) ||
          createdAt <= 0 ||
          createdAt > now
        ) {
          continue;
        }

        if (
          now - createdAt >= TRANSFER_AUTO_DELAY &&
          typeof request.id === "string"
        ) {
          expired.push({
            id: request.id,
            createdAt
          });
        }
      }
    }

    // Process oldest requests first
    expired.sort(
      (a, b) => a.createdAt - b.createdAt
    );

    for (const item of expired) {
      if (!transferAutoSettings.enabled) break;

      let result = null;
      let statusCode = 200;

      const internalResponse = {
        status(code) {
          statusCode = code;
          return this;
        },

        json(data) {
          result = data;
          return this;
        }
      };

      try {
        handleDiamondTransferAction(
          {
            lspAdminActorUid: "SYSTEM_AUTO",
            body: {
              id: item.id,
              action: "approve"
            }
          },
          internalResponse
        );

        if (result?.ok && result.status === "approved") {
          console.log(
            "[TRANSFER AUTO APPROVED]",
            item.id
          );
        } else if (
          statusCode !== 409 &&
          statusCode !== 404
        ) {
          console.warn(
            "[TRANSFER AUTO FAILED]",
            item.id,
            result?.error || statusCode
          );
        }
      } catch (err) {
        console.error(
          "[TRANSFER AUTO ERROR]",
          item.id,
          err
        );
      }
    }
  } catch (err) {
    console.error("[TRANSFER AUTO SCAN]", err);
  } finally {
    transferAutoProcessing = false;
  }
}

// Check every 5 seconds.
// Each request becomes eligible after 60 seconds.
setInterval(runTransferAutoApproval, 5000);

// Recover overdue pending requests after restart.
setTimeout(runTransferAutoApproval, 5000);




app.get("/api/admin/withdraw-requests", (req, res) => {
  const adminUid = req.headers["x-uid"];
  if (!adminUid) return res.status(403).json({ error: "no_auth" });

  const db = loadUsers();
  const admin = db[adminUid];
  if (!admin || admin.role !== "admin") {
    return res.status(403).json({ error: "not_admin" });
  }

  const list = loadWithdraws();
  res.json({ ok: true, list });
});


/* ==========================================
   ADMIN WITHDRAWAL STATUS + NOTES
   Pending / Processing / Approved / Rejected
========================================== */

app.post("/api/admin/withdraw-action", (req, res) => {
  const adminUid = req.lspAdminActorUid;

  const { withdrawId, id, action, note } = req.body || {};
  const wid = String(withdrawId || id || "");

  const allowedActions = [
    "processing",
    "note",
    "approve",
    "reject"
  ];

  if (!wid || !allowedActions.includes(action)) {
    return res.status(400).json({
      ok: false,
      error: "invalid_request"
    });
  }

  // Xác thực Admin từ session phía server
  if (!adminUid) {
    return res.status(403).json({
      ok: false,
      error: "not_admin"
    });
  }

  if (typeof note !== "string" || note.length > 1000) {
    return res.status(400).json({
      ok: false,
      error: "invalid_note"
    });
  }

  const db = loadUsers();
  const list = loadWithdraws();

  const reqItem = list.find(
    x => String(x.id) === wid
  );

  if (!reqItem) {
    return res.status(404).json({
      ok: false,
      error: "withdraw_not_found"
    });
  }

  const status = reqItem.status || "pending";

  // Không cho thay đổi giao dịch đã kết thúc
  if (["approved", "rejected"].includes(status)) {
    return res.status(400).json({
      ok: false,
      error: "already_processed"
    });
  }

  const user = db[reqItem.uid];

  if (!user?.profile) {
    return res.status(404).json({
      ok: false,
      error: "user_not_found"
    });
  }

  const amount = Number(reqItem.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({
      ok: false,
      error: "invalid_withdraw_amount"
    });
  }

  const customNote = note.trim();

  const defaultNotes = {
    pending: "Your withdrawal request is awaiting review.",
    processing: "Your withdrawal is being processed.",
    approved: "Your withdrawal has been approved.",
    rejected: "Your withdrawal request was rejected."
  };

  const now = Date.now();

  // Chỉ cập nhật ghi chú, không thay đổi trạng thái
  if (action === "note") {
    reqItem.note = customNote || defaultNotes[status];
    reqItem.noteUpdatedAt = now;
    reqItem.noteUpdatedBy = adminUid;

    saveWithdraws(list);
    emitWithdrawUpdate();

    return res.json({
      ok: true,
      status: reqItem.status,
      note: reqItem.note
    });
  }

  // Chuyển sang đang xử lý
  if (action === "processing") {
    reqItem.status = "processing";
    reqItem.note = customNote || defaultNotes.processing;
    reqItem.processingAt ||= now;
    reqItem.noteUpdatedAt = now;
    reqItem.noteUpdatedBy = adminUid;

    saveWithdraws(list);
    emitWithdrawUpdate();

    return res.json({
      ok: true,
      status: "processing",
      note: reqItem.note
    });
  }

  // Từ chối: hoàn lại số kim cương đã giữ
  if (action === "reject") {
    reqItem.status = "rejected";
    reqItem.note = customNote || defaultNotes.rejected;
    reqItem.handledBy = adminUid;
    reqItem.handledAt = now;

    user.profile.coinReceived =
      Number(user.profile.coinReceived || 0) + amount;

    // Lưu dữ liệu người dùng và giao dịch
    saveUsers(db);
    saveWithdraws(list);

    emitCoinUpdate(reqItem.uid);
    emitWithdrawUpdate();

    return res.json({
      ok: true,
      status: "rejected",
      note: reqItem.note
    });
  }

  // Phê duyệt: không trừ kim cương thêm lần nữa
  if (action === "approve") {
    reqItem.status = "approved";
    reqItem.note = customNote || defaultNotes.approved;
    reqItem.handledBy = adminUid;
    reqItem.handledAt = now;

    saveWithdraws(list);
    emitWithdrawUpdate();

    return res.json({
      ok: true,
      status: "approved",
      note: reqItem.note
    });
  }
});



app.post("/api/profile/bank-default", (req, res) => {
  const uid = req.headers["x-uid"];
  const { name, account, owner } = req.body || {};

  if (!uid || !name || !account || !owner) {
    return res.status(400).json({ error: "missing" });
  }

  const db = loadUsers();
  const user = db[uid];
  if (!user || !user.profile) {
    return res.status(404).json({ error: "user_not_found" });
  }

  user.profile.bankDefault = {
    name,
    account,
    owner
  };

  saveUsers(db);
  res.json({ ok: true });
});

app.get("/api/profile/bank-default", (req, res) => {
  const uid = req.headers["x-uid"];
  if (!uid) return res.status(403).json({ error: "no_auth" });

  const db = loadUsers();
  const user = db[uid];
  if (!user || !user.profile) {
    return res.json({ ok: true, bank: null });
  }

  res.json({
    ok: true,
    bank: user.profile.bankDefault || null
  });
});


const rooms = new Map();


/* ==========================================
   SFU VOICE CHAT - SERVER STATE
========================================== */

const SFU_VOICE_MAX = 3;

const sfuVoiceRooms = new Map();

function getSfuVoiceRoom(roomId) {
  const id = normRoomId(roomId);

  if (!sfuVoiceRooms.has(id)) {
    sfuVoiceRooms.set(id, {
      pending: new Map(),
      speakers: new Map()
    });
  }

  return sfuVoiceRooms.get(id);
}

function sfuVoiceSummary(roomId) {
  const state = getSfuVoiceRoom(roomId);

  return {
    maxSpeakers: SFU_VOICE_MAX,
    pending: [...state.pending.values()],
    speakers: [...state.speakers.values()]
  };
}

function emitSfuVoiceState(roomId) {
  const id = normRoomId(roomId);
  const room = rooms.get(id);

  if (!room) return;

  const state = sfuVoiceSummary(id);

  // Chỉ host nhận danh sách yêu cầu đang chờ.
  if (room.broadcasterId) {
    io.to(room.broadcasterId).emit(
      "sfu:voice:host-state",
      state
    );
  }

  // Cả phòng nhận danh sách người đang nói.
  io.to(id).emit("sfu:voice:room-state", {
    speakers: state.speakers,
    maxSpeakers: state.maxSpeakers
  });
}

async function setSfuVoicePermission(
  roomId,
  uid,
  enabled
) {
  const service = pkRoomServiceClient();

  if (!service) {
    throw new Error("LIVEKIT_NOT_CONFIGURED");
  }

  await service.updateParticipant(
    `lsp_${normRoomId(roomId)}`,
    `viewer_${uid}`,
    undefined,
    {
      canPublish: Boolean(enabled),
      canSubscribe: true,
      canPublishData: false,

canPublishSources: enabled
  ? [TrackSource.MICROPHONE]
  : []

    }
  );
}

function clearSfuVoiceRoom(roomId) {
  const id = normRoomId(roomId);

  sfuVoiceRooms.delete(id);

  io.to(id).emit("sfu:voice:ended");
}



/* ==========================================
   LIVESTREAMPRO - PK BATTLE ENGINE
========================================== */

const PK_DURATION = 180000; // 3 minutes
const PK_INVITE_TTL = 60000;
const PK_REMATCH_TTL = 60000; // 60 seconds

const pkMatches = new Map();
const pkInvites = new Map();



/* ==========================================
   SFU PK - PRODUCTION HELPERS
========================================== */

// Create LiveKit server management client.
function pkRoomServiceClient() {
  if (!SFU_URL || !SFU_KEY || !SFU_SECRET) {
    return null;
  }

  const url = SFU_URL
    .replace(/^ws:/, "http:")
    .replace(/^wss:/, "https:");

  return new RoomServiceClient(
    url,
    SFU_KEY,
    SFU_SECRET
  );
}

// Remove expired or invalid invitations.
function pkPruneInvites() {
  const now = Date.now();

  for (const [id, invite] of pkInvites) {
    if (
      invite.expiresAt <= now ||
      !pkHost(invite.fromRoom, invite.fromSocket) ||
      !pkHost(invite.targetRoom, invite.targetSocket)
    ) {
      pkInvites.delete(id);
    }
  }
}

// Cancel invitations involving a room.
function pkClearInvitesFor(roomId) {
  for (const [id, invite] of pkInvites) {

    if (
      invite.fromRoom !== roomId &&
      invite.targetRoom !== roomId
    ) continue;

    pkInvites.delete(id);

    io.to(invite.fromSocket)
      .emit("sfu:pk:cancelled");

    io.to(invite.targetSocket)
      .emit("sfu:pk:cancelled");
  }
}

// Automatically expire invitations.
const pkInviteSweep = setInterval(() => {

  const expired = [...pkInvites.values()].filter(
    invite =>
      invite.expiresAt <= Date.now() ||
      !pkHost(invite.fromRoom, invite.fromSocket) ||
      !pkHost(invite.targetRoom, invite.targetSocket)
  );

  for (const invite of expired) {
    pkClearInvitesFor(invite.targetRoom);
  }

}, 5000);

pkInviteSweep.unref?.();

// Disconnect PK-only LiveKit viewers.
async function pkRevokePeerParticipants(match) {

  const client = pkRoomServiceClient();

  if (!client) return;

  const participants = [
    ...(match.peerParticipants?.values() || [])
  ];

  const tasks = participants.map(
    async ({ peerRoom, identity }) => {
      try {
        await client.removeParticipant(
          `lsp_${peerRoom}`,
          identity
        );
      } catch (error) {
        console.warn(
          "[PK REMOVE PARTICIPANT]",
          error.message
        );
      }
    }
  );

  await Promise.allSettled(tasks);
}





function pkHost(roomId, socketId) {
  const id = normRoomId(roomId);
  const room = rooms.get(id);
  const host = room?.broadcasterId
    ? io.sockets.sockets.get(room.broadcasterId)
    : null;

  if (
    !room?.liveStartTs ||
    !room.streamReady ||
    room.mediaMode !== "sfu" ||
    !host?.connected ||
    host.id !== socketId ||
    host.data.authenticated !== true ||
    String(host.data.uid) !== String(room.ownerUid) ||
    host.data.roomId !== id
  ) return null;

  return { id, room, host };
}


function pkPublicState(match) {
  return {
    id: match.id,

    rooms: [...match.rooms],
    names: [...match.names],
    scores: [...match.scores],

    endAt: match.endAt,

    // playing = đang đếm ngược
    // finished = hết giờ, vẫn giữ kết nối PK
    phase: match.phase,

    round: match.round,
    winnerRoom: match.winnerRoom
  };
}


function pkBroadcast(match, event, data) {
  for (const id of match.rooms) {
    io.to(id).emit(event, data);
  }
}



/* ==========================================
   PK - FINISH ROUND, KEEP CONNECTION
========================================== */

function pkCompleteRound(match) {

  if (!match) return;

  if (pkMatches.get(match.rooms[0]) !== match) {
    return;
  }

  // Prevent multiple round-end events.
  if (match.phase !== "playing") return;

  clearTimeout(match.timer);
  match.timer = null;

  match.phase = "finished";

  const [a, b] = match.scores;

  match.winnerRoom =
    a === b
      ? null
      : match.rooms[a > b ? 0 : 1];

  // Only the round finishes.
  // The PK connection and shared chat remain active.
  pkBroadcast(
    match,
    "sfu:pk:round-ended",
    pkPublicState(match)
  );
}


/* ==========================================
   PK - START NEXT ROUND
========================================== */

function pkStartNextRound(match) {

  if (!match) return false;

  if (pkMatches.get(match.rooms[0]) !== match) {
    return false;
  }

  if (match.phase !== "finished") {
    return false;
  }

  clearTimeout(match.timer);

  if (match.rematchInvite?.timer) {
    clearTimeout(match.rematchInvite.timer);
  }

  match.rematchInvite = null;

  match.round += 1;
  match.phase = "playing";

  // Reset only PK round points.
  // Never reset wallet or gift statistics.
  match.scores = [0, 0];

  match.winnerRoom = null;
  match.endAt = Date.now() + PK_DURATION;

  match.timer = setTimeout(() => {
    pkCompleteRound(match);
  }, PK_DURATION);

  // Both rooms enter the next round.
  pkBroadcast(
    match,
    "sfu:pk:rematch-started",
    pkPublicState(match)
  );

  return true;
}



function pkFinish(match, reason = "timeout") {
  if (!match || pkMatches.get(match.rooms[0]) !== match) {
    return;
  }

  clearTimeout(match.timer);

  // Cancel any pending rematch invitation.
if (match.rematchInvite?.timer) {
  clearTimeout(match.rematchInvite.timer);
}

match.rematchInvite = null;

// Remove outstanding PK invitations.
pkClearInvitesFor(match.rooms[0]);
pkClearInvitesFor(match.rooms[1]);

// Disconnect PK-only video subscribers.
// Normal livestream participants remain connected.
void pkRevokePeerParticipants(match);

  const [a, b] = match.scores;
  const winnerRoom =
    a === b ? null : match.rooms[a > b ? 0 : 1];

  const result = {
    ...pkPublicState(match),
    reason,
    winnerRoom
  };

  for (const id of match.rooms) {
    pkMatches.delete(id);
  }

  pkBroadcast(match, "sfu:pk:ended", result);
}


function pkRecordGift(roomId, amount) {

  const match = pkMatches.get(roomId);

  if (!match) return;

  // Round finished: stay connected but stop scoring.
  if (match.phase !== "playing") {
    return;
  }

  if (Date.now() >= match.endAt) {
    pkCompleteRound(match);
    return;
  }

  const index = match.rooms.indexOf(roomId);

  if (index < 0) return;

  if (
    !Number.isSafeInteger(amount) ||
    amount <= 0
  ) {
    return;
  }

  if (
    match.scores[index] >
    Number.MAX_SAFE_INTEGER - amount
  ) {
    return;
  }

  match.scores[index] += amount;

  pkBroadcast(
    match,
    "sfu:pk:score",
    pkPublicState(match)
  );
}




// ===== LIVESTREAM PRO SOCIAL =====
const lpPosts = loadSocial();



// 🔴🟢 EMIT REALTIME ONLINE / OFFLINE ĐẠI LÝ
function emitAgentStatus(uid, online) {
  if (!uid) return;

  const db = loadUsers();
  const acc = db[uid];
  if (!acc) return;

  const roles = acc.roles || [];
const role  = acc.role;

const isAgent =
  role === "agent" ||
  roles.includes("agent");

if (!isAgent) return;


  io.emit("agent-status", {
    uid,
    online,
    ts: Date.now()
  });
}



function getPost(id){
  return lpPosts.find(p=>p.id===id);
}



/* ==========================================
   LIVESTREAM PRO - SOCIAL POST PRIVACY
========================================== */

function canViewSocialPost(viewerUid, post, db) {
  if (!viewerUid || !post?.uid) return false;

  const viewerId = String(viewerUid);
  const ownerId = String(post.uid);

  const viewer = db[viewerId];
  const owner = db[ownerId];

  if (!viewer || !owner) return false;

  // Chủ bài luôn được xem
  if (viewerId === ownerId) return true;

  // Admin có quyền quản lý và xem tất cả
  if (viewer.role === "admin") return true;

  // Bài của Admin công khai cho mọi tài khoản
  if (owner.role === "admin") return true;

  const viewerFriends = Array.isArray(viewer.profile?.friends)
    ? viewer.profile.friends.map(String)
    : [];

  const ownerFriends = Array.isArray(owner.profile?.friends)
    ? owner.profile.friends.map(String)
    : [];

  // Bắt buộc kết bạn hai chiều
  return (
    viewerFriends.includes(ownerId) &&
    ownerFriends.includes(viewerId)
  );
}

function getVisibleSocialPosts(uid, db = loadUsers()) {
  return lpPosts
    .filter(post => canViewSocialPost(uid, post, db))
    .slice(0, 50);
}

function emitSocialPostToAllowedUsers(event, post, payload) {
  const db = loadUsers();

  for (const client of io.sockets.sockets.values()) {
    if (!client.data.uid) continue;

    if (canViewSocialPost(client.data.uid, post, db)) {
      client.emit(event, payload);
    }
  }
}

function refreshSocialFeedForUser(uid) {
  const db = loadUsers();

  for (const client of io.sockets.sockets.values()) {
    if (String(client.data.uid || "") === String(uid)) {
      client.emit("lp-init", getVisibleSocialPosts(uid, db));
    }
  }
}



/* ==========================================
   SOCIAL - CHECK INTERACTION PERMISSION
========================================== */

function canInteractSocialPost(socket, post) {
  const uid = String(socket.data.uid || "");

  if (!uid || !post) return false;

  const db = loadUsers();

  return canViewSocialPost(uid, post, db);
}

/* ==========================================
   SOCIAL - SEND PRIVATE REALTIME EVENTS
========================================== */

function emitPrivateSocialEvent(event, post, data) {
  if (!post) return;

  emitSocialPostToAllowedUsers(
    event,
    post,
    data
  );
}




function getActiveUserList(){
  const list = [];

for (const [uid, sockets] of activeUsers.entries()) {
  for (const socketId of sockets) {
    const s = io.sockets.sockets.get(socketId);
    if (!s) continue;


    
    if(!s) continue;

    const profile = s.data.profile || {};

    const displayName =
      profile.name ||
      profile.displayName ||
      "Player";

    list.push({
      socketId,
      uid,   
      name: displayName,  
         
avatar:
  normalizeAvatar(profile.avatar) ||
  "https://i.ibb.co/GvJWn19q/icon-192.png" +
  encodeURIComponent(displayName),


      level: Number(profile.level || 1),
      role: s.data.role || "user",
      roomId: s.data.roomId || null
    });
  }
}
  return list;
}




function emitActiveUsers(){
  io.emit("active-users", {
    users: getActiveUserList(),
    online: Array.from(activeUsers.keys()),
    ts: Date.now()
  });
}


function emitAllUsers(){
  const db = loadUsers();
  const list = [];

  for(const uid in db){
    const acc = db[uid];
    const p = acc.profile || {};

    list.push({
      uid,
      name: p.name || uid,
      avatar: normalizeAvatar(p.avatar) || "",
      cover: p.cover || "",
      level: p.level || 1,
      role: acc.role || "user" ,  // 🔥 QUAN TRỌNG
      roles: acc.roles || []   // 🔥 THÊM DÒNG NÀY
    });
  }

  io.emit("all-users", list);
}




function pushNotify(uid, payload){
  if(!uid) return;
  if(!userInbox.has(uid)) userInbox.set(uid, []);
  userInbox.get(uid).unshift({
    ...payload,
    ts: Date.now(),
    read:false
  });
}



const USERS_FILE = path.join("/opt/render/project/data", "users.json");





/* ==========================================
   LIVESTREAM PRO
   DAILY SOCIAL POST REWARD
   1 POST / DAY = 100 DIAMONDS
========================================== */

const DAILY_SOCIAL_REWARD = 100;

function getSocialMissionDay() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function rewardDailySocialPost(user, postId) {

  if (!user?.profile || !postId) {
    return {
      rewarded: false,
      reason: "INVALID_ACCOUNT"
    };
  }

  const profile = user.profile;
  const day = getSocialMissionDay();

  const existing =
    profile.dailyMissions?.socialPost;

  // Đã nhận thưởng hôm nay.
  if (existing?.day === day) {
    return {
      rewarded: false,
      reason: "ALREADY_COMPLETED"
    };
  }

  const balance = Number(profile.coins ?? 0);

  if (
    !Number.isSafeInteger(balance) ||
    balance < 0 ||
    !Number.isSafeInteger(
      balance + DAILY_SOCIAL_REWARD
    )
  ) {
    return {
      rewarded: false,
      reason: "INVALID_BALANCE"
    };
  }

  if (
    !profile.dailyMissions ||
    typeof profile.dailyMissions !== "object"
  ) {
    profile.dailyMissions = {};
  }

  // Cộng Diamonds vào ví hiện tại.
  profile.coins =
    balance + DAILY_SOCIAL_REWARD;

  // Ghi nhận đã hoàn thành trong ngày.
  profile.dailyMissions.socialPost = {
    day,
    postId: String(postId),
    reward: DAILY_SOCIAL_REWARD,
    completedAt: new Date().toISOString()
  };

  return {
    rewarded: true,
    amount: DAILY_SOCIAL_REWARD,
    balance: profile.coins,
    day
  };
}



function loadUsers(){
  if(!fs.existsSync(USERS_FILE)) return {};
  return JSON.parse(fs.readFileSync(USERS_FILE,"utf8"));
}




function saveUsers(db){
  fs.writeFileSync(USERS_FILE, JSON.stringify(db,null,2));
}


/* ==========================================
   DIAMOND TRANSFER - DAILY CLEANUP
   Reset at 00:00 Vietnam time
========================================== */

function cleanupDailyTransferHistory() {

  const todayStart = getTodayStartTsVN();
  const todayEnd = todayStart + 86400000;

  let removed = 0;
  let changed = false;

  try {

    const users = loadUsers();

    for (const user of Object.values(users)) {

      if (!user || typeof user !== "object") {
        continue;
      }


/* ==========================================
   TIME RACE - DAILY HISTORY CLEANUP
========================================== */

if (Array.isArray(user.timeRaceHistory)) {

  const before = user.timeRaceHistory.length;

  user.timeRaceHistory =
    filterTimeRaceHistoryToday(
      user.timeRaceHistory
    );

  const deleted =
    before - user.timeRaceHistory.length;

  if (deleted > 0) {
    removed += deleted;
    changed = true;
  }

}


/* ==========================================
   DTP - DAILY HISTORY CLEANUP
========================================== */

if (Array.isArray(user.dtpHistory)) {

  const before = user.dtpHistory.length;

  user.dtpHistory = user.dtpHistory.filter(r => {

    const ts = Number(r?.ts);

    return (
      Number.isFinite(ts) &&
      ts >= todayStart &&
      ts < todayEnd
    );

  }).slice(0, 30);

  const deleted =
    before - user.dtpHistory.length;

  if (deleted > 0) {

    removed += deleted;
    changed = true;

  }

}




/* ==========================================
   DEPOSIT HISTORY - DAILY CLEANUP
========================================== */

if (
  user.profile &&
  Array.isArray(user.profile.depositLogs)
) {

  const oldCount =
    user.profile.depositLogs.length;

  user.profile.depositLogs =
    user.profile.depositLogs.filter(item => {

      const ts = Number(item?.time);

      return (
        Number.isFinite(ts) &&
        ts >= todayStart &&
        ts < todayEnd
      );

    });

  const removedCount =
    oldCount - user.profile.depositLogs.length;

  if (removedCount > 0) {
    removed += removedCount;
    changed = true;
  }

}



      // 1. Clean completed transfer history
      if (Array.isArray(user.transferHistory)) {

        const before = user.transferHistory.length;

        user.transferHistory =
          user.transferHistory.filter(t => {

            const ts = Number(
              t.time || t.createdAt || 0
            );

            return (
              Number.isFinite(ts) &&
              ts >= todayStart &&
              ts < todayEnd
            );

          }).slice(0, 50);

        if (before !== user.transferHistory.length) {
          removed += before - user.transferHistory.length;
          changed = true;
        }
      }

      // 2. Clean processed requests only
      if (Array.isArray(user.transferRequests)) {

        const before = user.transferRequests.length;

        user.transferRequests =
          user.transferRequests.filter(r => {

            // NEVER delete pending transfers
            if (r.status === "pending") {
              return true;
            }

            // Preserve unknown states for safety
            if (
              r.status !== "approved" &&
              r.status !== "rejected"
            ) {
              return true;
            }

            const ts = Number(
              r.processedAt || r.createdAt || 0
            );

            return (
              Number.isFinite(ts) &&
              ts >= todayStart &&
              ts < todayEnd
            );

          });

        if (before !== user.transferRequests.length) {
          removed += before - user.transferRequests.length;
          changed = true;
        }
      }
    }

    // Avoid unnecessary disk writes
    if (changed) {
      saveUsers(users);
    }

    console.log(
      `[TRANSFER CLEANUP] Removed ${removed} old records`
    );

  } catch (error) {

    console.error(
      "[TRANSFER CLEANUP ERROR]",
      error
    );

  }
}

// Run when the server starts
cleanupDailyTransferHistory();

// Schedule cleanup for every Vietnam midnight
function scheduleTransferCleanup() {

  const nextMidnight =
    getTodayStartTsVN() + 86400000;

  const delay = Math.max(
    1000,
    nextMidnight - Date.now() + 1000
  );

  setTimeout(() => {

    cleanupDailyTransferHistory();
    scheduleTransferCleanup();

  }, delay);
}

scheduleTransferCleanup();



/* =========================================
   BỔ SUNG ĐẠI LÝ NẠP KIM CƯƠNG
   LIVESTREAM PRO
========================================= */

const NEW_TOPUP_AGENTS = [

  // ĐẠI LÝ THỨ 2
  {
    uid: "Agent_TopUp_1",
    bank: {
      name: "Vietcombank",
      account: "1017495554",
      owner: "Nguyễn Phương Vũ",
      qr: "/images/topup/qr-phuong-vu.png"
    }
  },

  // ĐẠI LÝ THỨ 3
  {
    uid: "Agent_TopUp_2",
    bank: {
      name: "Techcombank",
      account: "2888388888",
      owner: "Hoàng Kim Hiệp",
      qr: "/images/topup/qr-hoang-hiep.png"
    }
  },

  // ĐẠI LÝ THỨ 4
    {
    uid: "KimDogCat",
    bank: {
      name: "Techcombank",
      account: "9919891995",
      owner: "Nguyễn Vinh Luân",
      qr: "/images/topup/qr-kimdogcat.png"
    }
  },

    // ĐẠI LÝ THỨ 5
    {
    uid: "Thao9999",
    bank: {
      name: "BIDV",
      account: "8886770506",
      owner: "Phan Thị Thảo",
      qr: "/images/topup/qr-phanthithao.png"
    }
  }


];

/* ĐĂNG KÝ ĐẠI LÝ VÀO USERS.JSON */

function registerTopupAgents() {

  const db = loadUsers();
  let changed = false;

  for (const item of NEW_TOPUP_AGENTS) {

    const uid = String(item.uid || "").trim();
    const bank = item.bank || {};

    // Không dùng thông tin mẫu chưa được thay
    if (
      !uid ||
      uid.startsWith("UID_DAI_LY_") ||
      !bank.name ||
      bank.name.startsWith("TEN_NGAN_HANG_") ||
      !bank.account ||
      bank.account.startsWith("SO_TAI_KHOAN_") ||
      !bank.owner ||
      bank.owner.startsWith("TEN_CHU_TAI_KHOAN_")
    ) {
      console.warn("[TOPUP] Thông tin đại lý chưa hợp lệ:", uid);
      continue;
    }

    // Đại lý phải là tài khoản đã tồn tại
    const acc = db[uid];

    if (!acc || !acc.profile) {
      console.warn("[TOPUP] Không tìm thấy tài khoản:", uid);
      continue;
    }

    // Giữ nguyên quyền hiện tại, bổ sung quyền agent
    if (!Array.isArray(acc.roles)) {
      acc.roles = [];
    }

    if (!acc.roles.includes("agent")) {
      acc.roles.push("agent");
      changed = true;
    }

    // Giữ lại thông tin ngân hàng đã có
    if (!acc.profile.bank) {
      acc.profile.bank = {};
      changed = true;
    }


// Bổ sung thông tin ngân hàng còn thiếu
for (const key of ["name", "account", "owner"]) {
  const value = String(bank[key] || "").trim();

  if (!acc.profile.bank[key] && value) {
    acc.profile.bank[key] = value;
    changed = true;
  }
}

// Cập nhật đường dẫn QR theo cấu hình mới
const newQr = String(bank.qr || "").trim();

if (newQr && acc.profile.bank.qr !== newQr) {
  acc.profile.bank.qr = newQr;
  changed = true;
}
  }

  if (changed) {
    saveUsers(db);
  }
}

registerTopupAgents();



function emitWithdrawUpdate() {
  io.emit("withdraw-update", {
    ts: Date.now()
  });
}



function emitMarketUpdate(action, boothId){
  io.emit("market-update", {
    action,      // "lock" | "unlock" | "revoke" | "rent" | "extend"
    boothId,
    ts: Date.now()
  });
}




// 🔥 REALTIME COIN SYNC (ANTI FLOAT SAFE)
function emitCoinUpdate(uid) {
  if (!uid) return;

  const db = loadUsers();
  const user = db[uid];
  if (!user || !user.profile) return;

  // 🔒 ÉP SỐ NGUYÊN & CHỐNG NaN
  user.profile.coins = Math.floor(
    Number(user.profile.coins || 0)
  );

  user.profile.coinSent = Math.floor(
    Number(user.profile.coinSent || 0)
  );

  user.profile.coinReceived = Math.floor(
    Number(user.profile.coinReceived || 0)
  );

  user.profile.level = Math.floor(
    Number(user.profile.level || 1)
  );

  user.profile.exp = Math.floor(
    Number(user.profile.exp || 0)
  );

  // 🔒 Không cho coin âm
  if (user.profile.coins < 0) {
    user.profile.coins = 0;
  }

const payload = {
  coins: user.profile.coins,
  coinSent: user.profile.coinSent,
  coinReceived: user.profile.coinReceived,
  coinDeposit: user.profile.coinDeposit || 0,
  level: user.profile.level,
  exp: user.profile.exp
};

  const sockets = activeUsers.get(uid);
  if (!sockets) return;

  for (const sid of sockets) {
    io.to(sid).emit("coin-update", payload);
  }
}





webpush.setVapidDetails(
  "mailto:admin@livestream.pro",
  process.env.VAPID_PUBLIC,
  process.env.VAPID_PRIVATE
);

// uid -> Set<subscription>
const pushSubs = new Map();



// ===== ADMIN TOPUP COIN =====
app.post("/api/admin/topup", (req, res) => {
  const { adminUid, targetUid, amount, note } = req.body;

  if (!adminUid || !targetUid || !amount) {
    return res.status(400).json({ error: "missing" });
  }

  const db = loadUsers();
  const admin = db[adminUid];
  const user  = db[targetUid];

  // 🔐 check admin
  if (!admin || admin.role !== "admin") {
    return res.status(403).json({ error: "not_admin" });
  }

  if (!user || !user.profile) {
    return res.status(404).json({ error: "user_not_found" });
  }

  const add = Math.max(0, Number(amount) || 0);

  user.profile.coins = (user.profile.coins || 0) + add;

  // 💳 tổng kim cương đã nạp
  user.profile.coinDeposit =
  (user.profile.coinDeposit || 0) + add;


  

const depositTodayStart = getTodayStartTsVN();
const depositTodayEnd = depositTodayStart + 86400000;

user.profile.depositLogs = (
  Array.isArray(user.profile.depositLogs)
    ? user.profile.depositLogs
    : []
).filter(item => {
  const ts = Number(item?.time);

  return Number.isFinite(ts) &&
    ts >= depositTodayStart &&
    ts < depositTodayEnd;
});

user.profile.depositLogs.unshift({
  amount: add,
  time: Date.now(),
  by: adminUid,
  note: note || ""
});




  // 🧾 log (optional nhưng nên có)
  user.profile.adminLogs ||= [];
  user.profile.adminLogs.unshift({
    type: "topup",
    by: adminUid,
    amount: add,
    note: note || "",
    ts: Date.now()
  });

  saveUsers(db);

  // 🔁 realtime sync
  emitCoinUpdate(targetUid);


// 🔔 THÔNG BÁO USER KHI ĐƯỢC NẠP COIN
const notifyText =
  `You have received ${add.toLocaleString()} coins` +
  (note ? `\nNote: ${note}` : "");

// 1️⃣ LƯU INBOX (xem lại được)
if (!userInbox.has(targetUid)) userInbox.set(targetUid, []);
userInbox.get(targetUid).unshift({
  type: "topup",
  from: adminUid,
  text: notifyText,
  amount: add,
  time: Date.now(),
  read: false
});
saveInbox(Object.fromEntries(userInbox));

// 2️⃣ REALTIME NẾU USER ĐANG ONLINE
const sockets = activeUsers.get(targetUid);
if (sockets) {
  for (const sid of sockets) {
    io.to(sid).emit("system-notify", {
      type: "topup",
      text: notifyText,
      amount: add
    });
  }
}

// 3️⃣ PUSH NOTIFICATION (KHI OFFLINE)
sendPushToUser(targetUid, {
  title: "Coins added successfully",
  body: `You have received ${add.toLocaleString()} coins`,
  tag: "admin-topup"
});



  res.json({
    ok: true,
    uid: targetUid,
    coins: user.profile.coins
  });
});

// ===== ADMIN WITHDRAW COIN =====
app.post("/api/admin/withdraw", (req, res) => {
  const { adminUid, targetUid, amount, note } = req.body || {};

  if (!adminUid || !targetUid || !amount) {
    return res.status(400).json({ error: "missing" });
  }

  const db = loadUsers();
  const admin = db[adminUid];
  const user  = db[targetUid];

  // 🔐 chỉ admin
  if (!admin || admin.role !== "admin") {
    return res.status(403).json({ error: "not_admin" });
  }

  if (!user || !user.profile) {
    return res.status(404).json({ error: "user_not_found" });
  }

const sub = Math.max(0, Number(amount) || 0);
const cur = Number(user.profile.coins || 0);

if (sub <= 0) {
  return res.status(400).json({ error: "invalid_amount" });
}

if (cur < sub) {
  return res.status(400).json({ error: "not_enough_coin" });
}

// ➖ TRỪ COIN (không cho âm)
user.profile.coins = Math.max(0, cur - sub);

// 🧾 LOG ADMIN
user.profile.adminLogs ||= [];
user.profile.adminLogs.unshift({
  type: "withdraw",
  by: adminUid,
  amount: sub,
  note: note || "",
  before: cur,
  after: user.profile.coins,
  ts: Date.now()
});

  saveUsers(db);

  // 🔁 realtime sync
  emitCoinUpdate(targetUid);

const notifyText =
  `➖ ${sub.toLocaleString()} coins have been deducted` +
  (note ? `\nReason: ${note}` : "");

  // 1️⃣ inbox
  if (!userInbox.has(targetUid)) userInbox.set(targetUid, []);
  userInbox.get(targetUid).unshift({
    type: "withdraw",
    from: adminUid,
    text: notifyText,
    amount: sub,
    time: Date.now(),
    read: false
  });
  saveInbox(Object.fromEntries(userInbox));

  // 2️⃣ realtime nếu online
  const sockets = activeUsers.get(targetUid);
  if (sockets) {
    for (const sid of sockets) {
      io.to(sid).emit("system-notify", {
        type: "withdraw",
        text: notifyText,
        amount: sub
      });
    }
  }

  // 3️⃣ push offline
sendPushToUser(targetUid, {
  title: "➖ Coins deducted",
  body: `Your account has been charged ${sub.toLocaleString()} coins`,
  tag: "admin-withdraw"
});

  res.json({
    ok: true,
    uid: targetUid,
    coins: user.profile.coins
  });
});



app.post("/api/register", async (req,res)=>{

const { username, password, securityCode } = req.body;

if (!username || !password || !securityCode) {
  return res.json({ error: "missing" });
}

  const db = loadUsers();
  if(db[username]) return res.json({error:"exists"});

  const hash = await bcrypt.hash(password,10);
  const secHash = await bcrypt.hash(securityCode,10);

db[username] = {
  password: hash,
  securityCode: secHash,
  profile: {
      uid: username,
      name: "User",
      avatar: "https://i.ibb.co/GvJWn19q/icon-192.png",
      bio: "",  
      coins:0,
      coinDeposit:0,
      level:1,
      exp:0,
      coinSent:0,
      coinReceived:0,
      showTopName:false 
    }
  };

  saveUsers(db);
  res.json({ok:true});
});


app.post("/api/prelogin", async (req,res)=>{
  const { username, password } = req.body;
  const db = loadUsers();

  const acc = db[username];
  if(!acc) return res.json({ ok:false });

if (acc.profile?.accountBlocked) {
  return res.status(403).json({
    error: "blocked",
    message: "Your account has been locked"
  });
}


  const ok = await bcrypt.compare(String(password), acc.password);
  if(!ok) return res.json({ ok:false });

  // Đúng user + pass → cho phép nhập mã bảo mật
  res.json({ ok:true });
});





/* ==========================================
   MONSTER HUNTER - VERIFIED LOGIN SESSION
========================================== */

const MH_SESSION_SECRET =
  process.env.MH_SESSION_SECRET || "";

const MH_SESSION_COOKIE = "mh_session";

function mhSessionSign(value) {
  return crypto
    .createHmac("sha256", MH_SESSION_SECRET)
    .update(value)
    .digest("hex");
}

function mhIssueSession(res, uid) {
  if (MH_SESSION_SECRET.length < 32) return;

  const payload = Buffer.from(
    JSON.stringify({
      uid: String(uid),
      exp: Date.now() + 7 * 86400000
    })
  ).toString("base64url");

  const token = payload + "." + mhSessionSign(payload);

  res.cookie(MH_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 86400000
  });
}

function mhVerifiedUid(cookieHeader) {
  if (MH_SESSION_SECRET.length < 32) return null;

  try {
    const cookies = String(cookieHeader || "")
      .split(";")
      .map(x => x.trim());

    const entry = cookies.find(x =>
      x.startsWith(MH_SESSION_COOKIE + "=")
    );

    if (!entry) return null;

    const token = entry.slice(
      MH_SESSION_COOKIE.length + 1
    );

    const dot = token.lastIndexOf(".");
    if (dot < 0) return null;

    const payload = token.slice(0, dot);
    const signature = token.slice(dot + 1);
    const expected = mhSessionSign(payload);

    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(expected, "hex");

    if (a.length !== b.length ||
        !crypto.timingSafeEqual(a, b)) {
      return null;
    }

    const data = JSON.parse(
      Buffer.from(payload, "base64url")
        .toString("utf8")
    );

    if (!data.uid || Date.now() >= data.exp) {
      return null;
    }

    return String(data.uid);
  } catch {
    return null;
  }
}




app.post("/api/login", async (req,res)=>{
  const {
    username,
    password,
    securityCode,
    trustedToken
  } = req.body;

  const db = loadUsers();

  const acc = db[username];




  if(!acc) return res.json({ error:"invalid" });

    // 🚫 USER BỊ KHOÁ → KHÔNG CHO LOGIN
if (acc.profile?.accountBlocked) {

  return res.status(403).json({
    error: "blocked",
    message: "Your account has been locked"
  });
}



 const okPass = await bcrypt.compare(String(password), acc.password);


// ==========================================
// VERIFY SECURITY CODE OR TRUSTED DEVICE
// ==========================================

let okSec = false;

// 1. Verify the actual security code
if (
  typeof securityCode === "string" &&
  securityCode.length > 0 &&
  typeof acc.securityCode === "string"
) {
  okSec = await bcrypt.compare(
    securityCode,
    acc.securityCode
  );
}

// 2. Verify a previously trusted device
if (
  !okSec &&
  typeof trustedToken === "string" &&
  trustedToken.length >= 32 &&
  acc.trusted &&
  Object.prototype.hasOwnProperty.call(
    acc.trusted,
    trustedToken
  )
) {
  const expiresAt = Number(
    acc.trusted[trustedToken]
  );

  okSec =
    Number.isFinite(expiresAt) &&
    expiresAt > Date.now();
}



  if(!okPass || !okSec){
    return res.json({ error:"invalid" });
  }

  const trusted = crypto.randomBytes(24).toString("hex");

acc.trusted = acc.trusted || {};
acc.trusted[trusted] = Date.now() + 30*24*60*60*1000; // 30 ngày

saveUsers(db);



if (SPIRIT_SECRET && SPIRIT_SECRET.length >= 32) {
  const spiritSession = spiritCreateSession(username);

  res.setHeader("Set-Cookie",
    `lsp_spirit_sid=${spiritSession}; ` +
    "HttpOnly; Secure; SameSite=Lax; Path=/; " +
    "Max-Age=604800"
  );
}



res.json({
  ok:true,
  profile: {
    ...acc.profile,
    role: acc.role || "user" ,  // 🔥 THÊM
    roles: acc.roles || []     // 🔥 THÊM DÒNG NÀY
  },
  trustedToken: trusted
});


});

app.post("/api/check-trusted", (req,res)=>{
  const { username, trustedToken } = req.body;
  const db = loadUsers();
  const acc = db[username];



  if(!acc || !acc.trusted) return res.json({ ok:false });

  const exp = acc.trusted[trustedToken];
  if(!exp || exp < Date.now()){
    delete acc.trusted[trustedToken];
    saveUsers(db);
    return res.json({ ok:false });
  }

  res.json({ ok:true });
});



app.get("/api/me/:uid", (req, res) => {
  const targetUid = req.params.uid;
  const viewerUid = req.headers["x-uid"]; // uid người đang xem

  const db = loadUsers();
  const target = db[targetUid];
  if (!target || !target.profile) {
    return res.status(404).json({ error: "User not found" });
  }

  // 🚫 BLOCK CHECK (2 CHIỀU)
  if (viewerUid && db[viewerUid]) {
    const me = db[viewerUid].profile;
    const you = target.profile;

const blockedByMe =
  (me.blockedUsers || []).includes(targetUid);
const blockedByYou =
  (you.blockedUsers || []).includes(viewerUid);


    if (blockedByMe || blockedByYou) {
      return res.status(403).json({
        error: "blocked"
      });
    }
  }

  res.json({
    profile: target.profile
  });
});






/* ==========================================
   LIVESTREAM PRO - PAYMENT GATEWAY
========================================== */

const CARD_TOPUP_PACKAGES = Object.freeze([
  { id:"p1", amountVnd:10000, diamonds:20 },
  { id:"p2", amountVnd:20000, diamonds:50 },
  { id:"p3", amountVnd:50000, diamonds:130 },
  { id:"p4", amountVnd:100000, diamonds:250 },
  { id:"p5", amountVnd:200000, diamonds:500 },
  { id:"p6", amountVnd:500000, diamonds:1250 },
  { id:"p7", amountVnd:1000000, diamonds:2500 },
  { id:"p8", amountVnd:2000000, diamonds:5000 },
  { id:"p9", amountVnd:5000000, diamonds:12500 },
  { id:"p10", amountVnd:10000000, diamonds:25000 }
]);

const PG_MERCHANT_ID =
  process.env.SEPAY_PG_MERCHANT_ID || "";

const PG_SECRET_KEY =
  process.env.SEPAY_PG_SECRET_KEY || "";

const PG_IPN_SECRET =
  process.env.SEPAY_PG_IPN_SECRET || "";

const PG_MODE =
  process.env.SEPAY_PG_MODE === "production"
    ? "production"
    : "sandbox";

const PG_PUBLIC_URL = String(
  process.env.LSP_PUBLIC_URL || ""
).replace(/\/$/, "");

const PG_ORDERS_FILE = path.join(
  "/opt/render/project/data",
  "lsp_pg_orders.json"
);

function pgConfigured() {
  return Boolean(
    PG_MERCHANT_ID &&
    PG_SECRET_KEY &&
    PG_IPN_SECRET &&
    /^https:\/\/[^/?#]+$/i.test(PG_PUBLIC_URL)
  );
}

function pgLoadOrders() {
  if (!fs.existsSync(PG_ORDERS_FILE)) return {};

  const data = JSON.parse(
    fs.readFileSync(PG_ORDERS_FILE, "utf8")
  );

  if (!data || Array.isArray(data) ||
      typeof data !== "object") {
    throw new Error("Invalid payment ledger.");
  }

  return data;
}

function pgAtomicSave(filename, data) {
  const temp = filename + "." + process.pid + ".tmp";

  fs.writeFileSync(
    temp,
    JSON.stringify(data, null, 2),
    { mode: 0o600 }
  );

  fs.renameSync(temp, filename);
}

function pgVerifySecret(actual, expected) {

  const a = Buffer.from(String(actual || ""));
  const b = Buffer.from(String(expected || ""));

  return a.length > 0 &&
    a.length === b.length &&
    crypto.timingSafeEqual(a, b);
}

/* ==========================================
   PAYMENT PACKAGES
========================================== */

app.get("/api/card-topup/packages", (req, res) => {

  res.set("Cache-Control", "no-store");

  res.json({
    ok: true,
    enabled: pgConfigured(),
    packages: CARD_TOPUP_PACKAGES
  });

});

/* ==========================================
   CREATE PAYMENT
========================================== */

const pgCreateAttempts = new Map();

app.post(
  "/api/card-topup/create",
  spiritAuth,
  async (req, res) => {

    res.set("Cache-Control", "no-store");

    if (!pgConfigured()) {
      return res.status(503).json({
        ok: false,
        message: "Payment service unavailable."
      });
    }

    // Same-origin protection.
    const origin = req.headers.origin;

    if (origin && origin !== PG_PUBLIC_URL) {
      return res.status(403).json({
        ok: false,
        message: "Invalid request origin."
      });
    }

    const uid = String(req.spiritUid || "");

    const pkg = CARD_TOPUP_PACKAGES.find(
      x => x.id === req.body?.packageId
    );

    const method = String(
      req.body?.paymentMethod || ""
    );


if (
  !uid ||
  !pkg ||
  method !== "CARD"
) {
  return res.status(400).json({
    ok: false,
    message: "Only card payments are supported."
  });
}


    const now = Date.now();

    const attempts = (
      pgCreateAttempts.get(uid) || []
    ).filter(t => now - t < 60000);

    if (attempts.length >= 5) {
      return res.status(429).json({
        ok: false,
        message: "Too many payment attempts."
      });
    }

    attempts.push(now);
    pgCreateAttempts.set(uid, attempts);

    try {

      // Official SDK generates the signed checkout fields.
      const { SePayPgClient } =
        await import("sepay-pg-node");

      const client = new SePayPgClient({
        env: PG_MODE,
        merchant_id: PG_MERCHANT_ID,
        secret_key: PG_SECRET_KEY
      });

      const invoice =
        "LSP" +
        crypto.randomBytes(10)
          .toString("hex")
          .toUpperCase();

      const orders = pgLoadOrders();

      orders[invoice] = {
        uid,
        packageId: pkg.id,
        amountVnd: pkg.amountVnd,
        diamonds: pkg.diamonds,
        method,
        status: "pending",
        createdAt: now
      };

      pgAtomicSave(PG_ORDERS_FILE, orders);

      const returnUrl =
        PG_PUBLIC_URL + "/api/card-topup/return";

      const fields =
        client.checkout.initOneTimePaymentFields({
          operation: "PURCHASE",
          payment_method: method,
          order_invoice_number: invoice,
          order_amount: pkg.amountVnd,
          currency: "VND",
          order_description:
            "Livestream Pro Topup " + invoice,
          customer_id: uid,
          success_url:
            returnUrl + "?result=success&invoice=" + invoice,
          error_url:
            returnUrl + "?result=error&invoice=" + invoice,
          cancel_url:
            returnUrl + "?result=cancel&invoice=" + invoice
        });

      return res.json({
        ok: true,
        invoice,
        checkoutUrl: client.checkout.initCheckoutUrl(),
        fields
      });

    } catch (error) {

      console.error("[PAYMENT CREATE]", error.message);

      return res.status(500).json({
        ok: false,
        message: "Unable to create payment."
      });

    }
  }
);

/* ==========================================
   PAYMENT IPN - SEPAY
========================================== */

app.post("/api/card-topup/ipn", (req, res) => {

  res.set("Cache-Control", "no-store");

  if (!pgConfigured()) {
    return res.status(503).json({
      success: false
    });
  }

  if (!pgVerifySecret(
    req.headers["x-secret-key"],
    PG_IPN_SECRET
  )) {
    return res.status(401).json({
      success: false
    });
  }

  const payload = req.body || {};

  if (payload.notification_type !== "ORDER_PAID") {
    return res.json({ success: true });
  }

  const remoteOrder = payload.order || {};
  const txn = payload.transaction || {};

  const invoice = String(
    remoteOrder.order_invoice_number || ""
  );

  if (!/^LSP[A-F0-9]{20}$/.test(invoice)) {
    return res.status(400).json({
      success: false
    });
  }

  try {

    const orders = pgLoadOrders();
    const order = orders[invoice];

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Unknown order."
      });
    }

    const orderAmount = Number(
      remoteOrder.order_amount
    );

    const paidAmount = Number(
      txn.transaction_amount
    );

    const paymentValid =
      remoteOrder.order_status === "CAPTURED" &&
      remoteOrder.order_currency === "VND" &&
      txn.transaction_status === "APPROVED" &&
      txn.transaction_type === "PAYMENT" &&
      txn.transaction_currency === "VND" &&
      Number.isSafeInteger(orderAmount) &&
      Number.isSafeInteger(paidAmount) &&
      orderAmount === order.amountVnd &&
      paidAmount === order.amountVnd &&
      (!txn.payment_method ||
        txn.payment_method === order.method);

    if (!paymentValid) {
      return res.status(422).json({
        success: false,
        message: "Payment validation failed."
      });
    }

    // Sandbox must never credit real wallets.
    if (PG_MODE !== "production") {

      orders[invoice] = {
        ...order,
        status: "sandbox_confirmed",
        confirmedAt: Date.now()
      };

      pgAtomicSave(PG_ORDERS_FILE, orders);

      return res.json({ success: true });
    }

    const users = loadUsers();
    const user = users[order.uid];

    if (!user?.profile) {
      return res.status(409).json({
        success: false,
        message: "User unavailable."
      });
    }

    // A persistent marker prevents ordinary replay.
    user.profile.creditedPaymentInvoices ||= {};

    if (!user.profile.creditedPaymentInvoices[invoice]) {

      const balance = Number(user.profile.coins || 0);
      const deposit = Number(
        user.profile.coinDeposit || 0
      );

      if (
        !Number.isSafeInteger(balance) ||
        balance < 0 ||
        !Number.isSafeInteger(deposit) ||
        deposit < 0 ||
        !Number.isSafeInteger(balance + order.diamonds) ||
        !Number.isSafeInteger(deposit + order.diamonds)
      ) {
        return res.status(409).json({
          success: false,
          message: "Invalid wallet data."
        });
      }

      user.profile.coins = balance + order.diamonds;
      user.profile.coinDeposit =
        deposit + order.diamonds;

      user.profile.creditedPaymentInvoices[invoice] = {
        diamonds: order.diamonds,
        at: Date.now()
      };

      pgAtomicSave(USERS_FILE, users);
    }

    if (order.status !== "paid") {

      orders[invoice] = {
        ...order,
        status: "paid",
        paidAt: Date.now(),
        providerTransactionId: String(
          txn.transaction_id || txn.id || ""
        )
      };

      pgAtomicSave(PG_ORDERS_FILE, orders);
    }

    emitCoinUpdate(order.uid);

    return res.json({ success: true });

  } catch (error) {

    console.error("[PAYMENT IPN]", error.message);

    return res.status(500).json({
      success: false
    });
  }
});

/* ==========================================
   PAYMENT RETURN
========================================== */

app.get("/api/card-topup/return", (req, res) => {

  const result = [
    "success",
    "error",
    "cancel"
  ].includes(req.query.result)
    ? req.query.result
    : "unknown";

  const invoice = /^LSP[A-F0-9]{20}$/.test(
    String(req.query.invoice || "")
  )
    ? String(req.query.invoice)
    : "";

  // The return URL never credits diamonds.
  res.redirect(
    303,
    "/topup.html?payment=" +
      result +
      "&invoice=" +
      encodeURIComponent(invoice)
  );
});

/* ==========================================
   PAYMENT STATUS
========================================== */

app.get(
  "/api/card-topup/status/:id",
  spiritAuth,
  (req, res) => {

    res.set("Cache-Control", "no-store");

    try {

      const invoice = String(req.params.id);
      const order = pgLoadOrders()[invoice];

      if (
        !order ||
        order.uid !== String(req.spiritUid)
      ) {
        return res.status(404).json({
          ok: false,
          message: "Payment order not found."
        });
      }

      const users = loadUsers();

      const credited = Boolean(
        users[order.uid]?.profile
          ?.creditedPaymentInvoices?.[invoice]
      );

      return res.json({
        ok: true,
        invoice,
        status: credited ? "paid" : "pending",
        diamonds: order.diamonds,
        amountVnd: order.amountVnd
      });

    } catch (error) {

      return res.status(500).json({
        ok: false,
        message: "Unable to check payment status."
      });
    }
  }
);




// ===== API: DANH SÁCH ĐẠI LÝ NẠP COIN =====
app.get("/api/topup-agents", (req, res) => {
  const db = loadUsers();
  const list = [];

  for (const uid in db) {
    const acc = db[uid];

const roles = acc.roles || [];
const role  = acc.role;

if (
  !roles.includes("agent") &&
  role !== "agent"
) continue;



    const p = acc.profile || {};
    const bank = p.bank || {};

    list.push({
      uid,
      name: p.name || uid,
      avatar: normalizeAvatar(p.avatar) ||
        "https://i.ibb.co/GvJWn19q/icon-192.png" + uid,
      bank: bank.name || "",
      account: bank.account || "",
      owner: bank.owner || "",
      qr: bank.qr || "",
      online: activeUsers.has(uid)

    });
  }

  res.json({
    ok: true,
    agents: list
  });
});




app.get("/api/all-users", (req,res)=>{
  const db = loadUsers();
  const list = [];

  for(const uid in db){
    const p = db[uid].profile || {};
    list.push({
      uid,
      name: p.name || uid,
      avatar: p.avatar || "https://i.ibb.co/GvJWn19q/icon-192.png" + uid,
      cover: p.cover || "",
      bio: p.bio || "",
      level: p.level || 1,
      role: db[uid].role || "user",
      verified: !!p.verified   // ⭐ thêm
    });
  }

  res.json(list);
});



 // ===== RESET / CHANGE PASSWORD =====

app.post("/api/change-password", async (req,res)=>{
  const { username, securityCode, newPassword } = req.body;
  if(!username || !securityCode || !newPassword)
    return res.json({ error:"missing" });

  const db = loadUsers();

  const acc = db[username];
if(!acc) return res.json({ error:"notfound" });

const ok = await bcrypt.compare(String(securityCode), acc.securityCode);
if(!ok) return res.json({ error:"invalid" });

acc.password = await bcrypt.hash(String(newPassword), 10);

  saveUsers(db);

  res.json({ ok:true });
});


app.post("/api/push-subscribe", (req, res) => {
  const { uid, sub } = req.body;
  if (!uid || !sub) return res.sendStatus(400);

  if (!pushSubs.has(uid)) pushSubs.set(uid, []);
  const arr = pushSubs.get(uid);

  // tránh trùng endpoint
  if (!arr.find(s => s.endpoint === sub.endpoint)) {
    arr.push(sub);
  }

  res.json({ ok: true });
});




// ♻️ RESTORE LIVE ROOMS AFTER SERVER RESTART
const persisted = loadLiveState();

for (const roomId in persisted) {
  const data = persisted[roomId];

rooms.set(roomId, {
  broadcasterId: null,
  viewers: new Set(),
  viewerProfiles: new Map(),
  liveStartTs: null,
  pinnedNote: null,
  hostProfile: null,
  giftTotal: 0,
  giftByUser: new Map(),
  releaseTimer: null,
  pendingRelease: false,
  streamReady: false // ✅ THÊM
});


}

console.log("♻️ Restored live rooms:", Object.keys(persisted));






// ===== GIFT ENGINE (coins) =====
const GIFT_CATALOG = {
  heart:      { emoji: "❤️", cost: 50, title: "Heart" },
  flower:     { emoji: "🌸", cost: 100, title: "Flower" },
  rocket:     { emoji: "🚀", cost: 200, title: "Rocket" },
  coin:       { emoji: "💰", cost: 500, title: "Money Bag" },
  king:       { emoji: "👑", cost: 1000, title: "Crown" },
  galaxy:     { emoji: "🌌", cost: 2000, title: "Galaxy" },
  meteor:     { emoji: "☄️", cost: 5000, title: "Meteor" },
  dragon:     { emoji: "🐉", cost: 10000, title: "Dragon" },
  phoenix:    { emoji: "🦅", cost: 10000, title: "Phoenix" },
  dragonking: { emoji: "🐲", cost: 10000, title: "Dragon King" },
  supernova:  { emoji: "🌠", cost: 10000, title: "Supernova" }
};



const START_COINS = 0; // coin mặc định cho mỗi người (demo)
function clampInt(n, min, max){
  n = Number(n);
  if (!Number.isFinite(n)) n = 0;
  n = Math.floor(n);
  return Math.max(min, Math.min(max, n));
}
function safeName(name){
  return String(name || "Anonymous").trim().slice(0, 20);
}
function roomGiftTop(room, limit=5){
  const arr = [];
  try{

   for (const [k,v] of safeMap(room.giftByUser).entries()){
  arr.push({ name: k, coins: v });
}

    
  }catch{}
  arr.sort((a,b)=>b.coins-a.coins);
  return arr.slice(0, limit);
}
// ===== /GIFT ENGINE =====

function normRoomId(roomId) {
  return String(roomId || "").trim().toLowerCase();
}


function safeMap(m){ return m instanceof Map ? m : new Map(); }
function safeSet(s){ return s instanceof Set ? s : new Set(); }

function calcBitrate(viewerCount) {
  const count = Math.max(0, Number(viewerCount) || 0);

  if (count <= 2) return 1500;
  if (count <= 4) return 1200;

  return 900;
}


function getRoom(roomId) {
  roomId = normRoomId(roomId);
  if (!rooms.has(roomId)) {

 rooms.set(roomId, {
  broadcasterId: null,
  viewers: new Set(),
  viewerProfiles: new Map(),
  liveStartTs: null,
  pinnedNote: null,
  hostProfile: null,
  giftTotal: 0,
  giftByUser: new Map(),
  releaseTimer: null,
  pendingRelease: false,
 
});


  }
  return rooms.get(roomId);
}



/* ==========================================
   LIVESTREAM PRO - LIVEKIT SFU TOKEN
========================================== */

const SFU_URL = process.env.LIVEKIT_URL;
const SFU_KEY = process.env.LIVEKIT_API_KEY;
const SFU_SECRET = process.env.LIVEKIT_API_SECRET;

app.post("/api/sfu/token", async (req, res) => {
  res.set("Cache-Control", "no-store");

  try {
    const roomId = normRoomId(req.body?.roomId);
    const requestedRole = String(req.body?.role || "");

    if (
      !roomId ||
      roomId.length > 64 ||
      !/^[a-z0-9_.-]+$/.test(roomId)
    ) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_ROOM"
      });
    }

    if (!["host", "viewer"].includes(requestedRole)) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_ROLE"
      });
    }

    if (!SFU_URL || !SFU_KEY || !SFU_SECRET) {
      return res.status(503).json({
        ok: false,
        error: "SFU_NOT_CONFIGURED"
      });
    }

    const room = rooms.get(roomId);

    if (!room) {
      return res.status(404).json({
        ok: false,
        error: "ROOM_NOT_FOUND"
      });
    }

    // Identity from signed HTTP-only session.
    // Never accept uid from req.body.
    let uid = null;

    if (SPIRIT_SECRET && SPIRIT_SECRET.length >= 32) {
      try {
        const raw = String(req.headers.cookie || "")
          .split(";")
          .map(s => s.trim())
          .find(s => s.startsWith("lsp_spirit_sid="));

        if (raw) {
          const token = raw.slice("lsp_spirit_sid=".length);
          const [payload, signature] = token.split(".");
          const expected = spiritSign(payload);

          const a = Buffer.from(signature || "");
          const b = Buffer.from(expected);

          if (
            a.length === b.length &&
            crypto.timingSafeEqual(a, b)
          ) {
            const session = JSON.parse(
              Buffer.from(payload, "base64url")
                .toString("utf8")
            );

            if (
              session.exp > Date.now() &&
              session.uid
            ) {
              uid = String(session.uid);
            }
          }
        }
      } catch {
        uid = null;
      }
    }

    const db = loadUsers();
    const account = uid ? db[uid] : null;

    if (!account?.profile ||
        account.profile.accountBlocked) {
      uid = null;
    }

const sessionCookie = String(req.headers.cookie || "")
  .split(";")
  .map(s => s.trim())
  .find(s => s.startsWith("lsp_spirit_sid="));

const rawSession = sessionCookie
  ? sessionCookie.slice("lsp_spirit_sid=".length)
  : "";

const requestSessionId = rawSession
  ? crypto.createHash("sha256")
      .update(rawSession)
      .digest("hex")
  : null;

  


if (requestedRole === "host") {

  if (!uid) {
    return res.status(401).json({
      ok: false,
      error: "LOGIN_REQUIRED"
    });
  }

  const hostSocket = room.broadcasterId
    ? io.sockets.sockets.get(room.broadcasterId)
    : null;


if (
  room.ownerUid !== uid ||
  !hostSocket?.connected ||
  hostSocket.data.authenticated !== true ||
  hostSocket.data.uid !== uid ||
  !requestSessionId ||
  hostSocket.data.sessionId !== requestSessionId ||
  hostSocket.data.roomId !== roomId
) {
  return res.status(403).json({
    ok: false,
    error: "NOT_ROOM_OWNER"
  });
}


  room.mediaMode = "sfu";

} else {

  if (!uid) {
    return res.status(401).json({
      ok: false,
      error: "LOGIN_REQUIRED"
    });
  }

  if (
    room.mediaMode !== "sfu" ||
    !room.broadcasterId ||
    !room.streamReady
  ) {
    return res.status(409).json({
      ok: false,
      error: "STREAM_NOT_READY"
    });
  }

  const viewer = room.viewerProfiles?.get(uid);

  const viewerSocket = viewer?.socketId
    ? io.sockets.sockets.get(viewer.socketId)
    : null;


if (
  !viewerSocket?.connected ||
  viewerSocket.data.authenticated !== true ||
  viewerSocket.data.uid !== uid ||
  !requestSessionId ||
  viewerSocket.data.sessionId !== requestSessionId ||
  viewerSocket.data.roomId !== roomId ||
  !room.viewers.has(viewer.socketId)
) {
  return res.status(403).json({
    ok: false,
    error: "VIEWER_NOT_IN_ROOM"
  });
}



}


    const grant = new AccessToken(
      SFU_KEY,
      SFU_SECRET,
      {
        identity: requestedRole === "host"
          ? `host_${uid}`
          : `viewer_${uid}`,
        name: account.profile.name || "Member",
        ttl: "30m"
      }
    );

const approvedSpeaker =
  requestedRole === "viewer" &&
  getSfuVoiceRoom(roomId)
    .speakers.has(String(uid));

const canPublish =
  requestedRole === "host" ||
  approvedSpeaker;

grant.addGrant({
  roomJoin: true,
  room: `lsp_${roomId}`,

  canPublish,

  canPublishSources:
    requestedRole === "host"
      ? [
          TrackSource.CAMERA,
          TrackSource.MICROPHONE
        ]
      : approvedSpeaker
        ? [TrackSource.MICROPHONE]
        : [],

  canSubscribe: true,
  canPublishData: false
});

    return res.json({
      ok: true,
      url: SFU_URL,
      token: await grant.toJwt(),
      role: requestedRole,
      roomId
    });

  } catch (err) {
    console.error("[SFU TOKEN]", err);

    return res.status(500).json({
      ok: false,
      error: "SFU_TOKEN_FAILED"
    });
  }
});



/* ==========================================
   SFU PK - SECURE PEER VIDEO TOKEN
========================================== */

app.post("/api/sfu/pk-token", async (req, res) => {


  res.set("Cache-Control", "no-store");

  try {
    const id = normRoomId(req.body?.roomId);
    const socketId = String(req.body?.socketId || "");

if (!SFU_URL || !SFU_KEY || !SFU_SECRET) {
  return res.status(503).json({
    ok: false,
    error: "SFU_NOT_CONFIGURED"
  });
}

    const match = pkMatches.get(id);
    const client = io.sockets.sockets.get(socketId);
    const room = rooms.get(id);

    if (!match || !client?.connected || !room) {
      return res.status(403).json({
        ok: false,
        error: "PK_NOT_AVAILABLE"
      });
    }

    const peerId = match.rooms.find(x => x !== id);

    if (!peerId) {
      return res.status(403).json({
        ok: false,
        error: "PK_EXPIRED"
      });
    }

    const cookie = String(req.headers.cookie || "")
      .split(";")
      .map(x => x.trim())
      .find(x => x.startsWith("lsp_spirit_sid="));

    const raw = cookie
      ? cookie.slice("lsp_spirit_sid=".length)
      : "";

    const sessionId = raw
      ? crypto.createHash("sha256")
          .update(raw)
          .digest("hex")
      : "";

    const uid = String(client.data.uid || "");

    const isHost =
      room.broadcasterId === socketId &&
      String(room.ownerUid) === uid;

    const isViewer =
      room.viewerProfiles?.get(uid)?.socketId === socketId &&
      room.viewers?.has(socketId);

    if (
      !client.data.authenticated ||
      !uid ||
      !sessionId ||
      client.data.sessionId !== sessionId ||
      client.data.roomId !== id ||
      !client.rooms.has(id) ||
      (!isHost && !isViewer)
    ) {
      return res.status(403).json({
        ok: false,
        error: "PK_ACCESS_DENIED"
      });
    }

    const account = loadUsers()[uid];

    if (
      !account?.profile ||
      account.profile.accountBlocked
    ) {
      return res.status(403).json({
        ok: false,
        error: "ACCOUNT_UNAVAILABLE"
      });
    }

    const peer = rooms.get(peerId);
    const peerHost = peer?.broadcasterId
      ? io.sockets.sockets.get(peer.broadcasterId)
      : null;

    if (
      !peer?.liveStartTs ||
      !peer.streamReady ||
      !peerHost?.connected
    ) {
      return res.status(409).json({
        ok: false,
        error: "PEER_OFFLINE"
      });
    }

const identity = `pk_${match.id}_${socketId}`;

const grant = new AccessToken(
  SFU_KEY,
  SFU_SECRET,
  {
    identity,
    ttl: "30s"
  }
);

    grant.addGrant({
      roomJoin: true,
      room: `lsp_${peerId}`,
      canPublish: false,
      canSubscribe: true,
      canPublishData: false
    });

const token = await grant.toJwt();

// Track issued PK participant identities.
match.peerParticipants ||= new Map();

match.peerParticipants.set(identity, {
  peerRoom: peerId,
  identity
});

return res.json({
  ok: true,
  url: SFU_URL,
  token,
  peerRoomId: peerId
});

  } catch (error) {
    console.error("[SFU PK TOKEN]", error);

    return res.status(500).json({
      ok: false,
      error: "PK_TOKEN_FAILED"
    });
  }
});



/* ==========================================
   SFU - ACTIVE VIEWER DIRECTORY
========================================== */

function getSfuActiveViewers(room) {

  if (!room) return [];

  const viewers = [];

  for (const viewer of safeMap(
    room.viewerProfiles
  ).values()) {

    if (
      !viewer ||
      viewer.mini === true ||
      !viewer.socketId
    ) continue;

    const viewerSocket =
      io.sockets.sockets.get(viewer.socketId);

    if (
      !viewerSocket?.connected ||
      !room.viewers.has(viewer.socketId)
    ) continue;

    viewers.push({
      name: String(
        viewer.name || "Player"
      ).slice(0, 50),

      avatar: normalizeAvatar(
        String(viewer.avatar || "")
      )
    });
  }

  return viewers;
}



function emitViewerCount(roomId) {

  roomId = normRoomId(roomId);

  const room = rooms.get(roomId);
  if (!room) return;

  const profiles = [
    ...safeMap(room.viewerProfiles).values()
  ];


const activeViewers = getSfuActiveViewers(room);

io.to(roomId).emit("viewer-count", {
  roomId,
  count: activeViewers.length,
  viewers: activeViewers
});



  const bitrate = calcBitrate(profiles.length);

  if (!room.broadcasterId) {
    room.lastVideoBitrate = null;
    room.lastBitrateHostId = null;
    return;
  }

  const changed =
    room.lastVideoBitrate !== bitrate ||
    room.lastBitrateHostId !== room.broadcasterId;

  if (!changed) return;

  room.lastVideoBitrate = bitrate;
  room.lastBitrateHostId = room.broadcasterId;

  io.to(room.broadcasterId).emit("set-bitrate", {
    bitrate
  });
}



function getLobbyList() {
  const list = [];

  for (const [roomId, room] of rooms.entries()) {

    if (!room.broadcasterId || !room.liveStartTs) {
      continue;
    }

    // Verify that the host socket is connected.
    const hostSocket = io.sockets.sockets.get(
      room.broadcasterId
    );

    if (
      !hostSocket?.connected ||
      hostSocket.data.roomId !== roomId ||
      hostSocket.data.role !== "broadcaster"
    ) {
      continue;
    }

    list.push({
      roomId,
      viewers: safeSet(room.viewers).size,
      liveStartTs: room.liveStartTs,
      host: room.hostProfile || null,
      mediaMode: room.mediaMode || "p2p"
    });
  }

  list.sort((a, b) =>
    (b.viewers - a.viewers) ||
    (b.liveStartTs - a.liveStartTs)
  );

  return list;
}



function emitLobbyUpdate() {
  io.emit("lobby-update", { rooms: getLobbyList(), ts: Date.now() });
}


// ICE servers from Twilio (TURN). Client will filter invalid STUN urls if any.
app.get("/ice", async (_req, res) => {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      return res.status(500).json({ error: "Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN" });
    }

    const client = twilio(accountSid, authToken);
    const token = await client.tokens.create();

    return res.json({ iceServers: token.iceServers });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});


async function sendPushToUser(uid, payload) {
  const subs = pushSubs.get(uid);
  if (!subs || !subs.length) return;

  for (let i = subs.length - 1; i >= 0; i--) {
    try {
      await webpush.sendNotification(subs[i], JSON.stringify(payload));
    } catch (e) {
      if (e.statusCode === 410 || e.statusCode === 404) {
        subs.splice(i, 1); // xoá sub chết
      }
    }
  }
}





function closeRoom(roomId, reason = "host_left") {
  const room = rooms.get(roomId);   // 🔥 LẤY ROOM TRƯỚC
  if (!room) return;


// Cancel any pending room release.
if (room.releaseTimer) {
  clearTimeout(room.releaseTimer);
  room.releaseTimer = null;
}

room.pendingRelease = false;
room.streamReady = false;



clearSfuVoiceRoom(roomId);


  // 🔔 notify host
  if(room.hostProfile?.uid){
    pushNotify(room.hostProfile.uid,{
      type:"system",
      text:"Your livestream room has been closed"
    });
  }

  // 💾 xóa live_state
  const state = loadLiveState();
  delete state[roomId];
  saveLiveState(state);

  // 🚨 báo cho toàn bộ viewer + guest
  io.to(roomId).emit("room-closed", { reason });

  // clear state
  room.broadcasterId = null;
  room.liveStartTs = null;
  room.viewers.clear();
  safeMap(room.viewerProfiles).clear();


  room.giftTotal = 0;
  room.giftByUser = new Map();

  emitLobbyUpdate();


setTimeout(() => {

  // Do not delete a newly created room
  // that happens to use the same room ID.
  if (rooms.get(roomId) === room) {
    rooms.delete(roomId);
  }

}, 1000);

}





/* ==========================================
   TRANSFER SECURITY - ATTEMPT LIMITER
========================================== */

const TRANSFER_SECURITY_LIMIT = 5;
const TRANSFER_SECURITY_LOCK_MS = 15 * 60 * 1000;

const transferSecurityAttempts = new Map();

function isTransferSecurityLocked(uid) {

  const record = transferSecurityAttempts.get(uid);

  if (!record) return false;

  if (record.lockUntil > Date.now()) {
    return true;
  }

  if (record.lockUntil) {
    transferSecurityAttempts.delete(uid);
  }

  return false;
}

function recordTransferSecurityFailure(uid) {

  const now = Date.now();

  let record = transferSecurityAttempts.get(uid);

  if (
    !record ||
    now - record.startedAt > TRANSFER_SECURITY_LOCK_MS
  ) {
    record = {
      attempts: 0,
      startedAt: now,
      lockUntil: 0
    };
  }

  record.attempts++;

  if (record.attempts >= TRANSFER_SECURITY_LIMIT) {
    record.lockUntil = now + TRANSFER_SECURITY_LOCK_MS;
  }

  transferSecurityAttempts.set(uid, record);

  return record.lockUntil > now;
}



io.on("connection", (socket) => {







 // lấy deviceId từ client
  socket.data.deviceId = socket.handshake.auth?.deviceId;

/* ==========================================
   VERIFIED SOCKET REGISTRATION
========================================== */

socket.on("register-user", (uid) => {

  const verifiedUid = socket.data.uid;

  if (!bindSocketToUser(verifiedUid, socket)) {
    return;
  }

  console.log(
    "[SOCKET] USER REGISTER:",
    verifiedUid
  );
});


socket.on("register-admin", (uid) => {

  const verifiedUid = socket.data.uid;

  if (!bindSocketToUser(verifiedUid, socket)) {
    return;
  }

  // This event does not grant admin privileges
  console.log(
    "[SOCKET] VERIFIED REGISTER:",
    verifiedUid
  );
});


socket.on("auth", (data = {}) => {

  const verifiedUid = socket.data.uid;

  if (!bindSocketToUser(verifiedUid, socket)) {
    return;
  }

  // Device ID is not an authentication factor
  socket.data.deviceId =
    data?.deviceId ||
    socket.data.deviceId ||
    null;

});


socket.on("disconnect", () => {

  const uid = socket.data.uid;
  if (!uid) return;

  const set = activeUsers.get(uid);
  if (!set) return;

  set.delete(socket.id);

  if (set.size === 0) {

    activeUsers.delete(uid);

    // Agent offline only when no active socket remains
    emitAgentStatus(uid, false);

    emitActiveUsers();
  }


});



// ================================
// 💬 CHAT 1–1 (ADMIN BYPASS FRIEND)
// ================================
socket.on("private-message", async ({ to, text, msgId }) => {

  const fromUid = socket.data.uid
  const toUid = to

  if (!fromUid || !toUid) return

  const db = loadUsers()
  const fromAcc = db[fromUid]
  const toAcc   = db[toUid]

  if (!fromAcc || !toAcc) return


  // 🚫 BLOCK CHECK
  if (
    (fromAcc.profile?.blockedUsers || []).includes(toUid) ||
    (toAcc.profile?.blockedUsers || []).includes(fromUid)
  ){
    return
  }


// =========================
// 👑 ADMIN CHECK
// =========================
const senderIsAdmin =
  socket.data.role === "admin" ||
  fromAcc.role === "admin" ||
  fromAcc.profile?.role === "admin"

const receiverIsAdmin =
  toAcc.role === "admin" ||
  toAcc.profile?.role === "admin"


// =========================
// 👥 FRIEND CHECK
// =========================
const needFriendCheck =
  !senderIsAdmin && !receiverIsAdmin

if (needFriendCheck) {

  const friends = fromAcc.profile?.friends || []

  if (!friends.includes(toUid)) {

    socket.emit("msg-blocked",{
      reason:"not_friend"
    })

    return
  }

}


  const msg = {
    id: msgId || Date.now()+"_"+Math.random().toString(36).slice(2),
    from: fromUid,
    to: toUid,
    text: text || "",
    time: Date.now(),
    read:false
  }


  // 💾 SAVE INBOX
  ;[fromUid,toUid].forEach(uid=>{
    if(!userInbox.has(uid)) userInbox.set(uid,[])
    userInbox.get(uid).unshift(msg)
  })

  saveInbox(Object.fromEntries(userInbox))


  // 🔁 REALTIME
  const sockets = activeUsers.get(toUid)

  if(sockets){
    for(const sid of sockets){

      
io.to(sid).emit("private-message", {
  from: {
    uid: fromUid,
    name: fromAcc.profile.name,
    avatar: fromAcc.profile.avatar
  },
  text: msg.text,
  msgId: msg.id,
  time: msg.time
});
    }
  }


  // 🔔 PUSH OFFLINE
  await sendPushToUser(toUid,{
    title: senderIsAdmin
      ? "You have a new message."
      : "New message",

    body: text?.slice(0,80) || "You have a new message",

    url:`/messages.html?uid=${fromUid}`,
    tag:"chat-message"
  })

})


// ================================
// 🔔 USER ĐÃ CHUYỂN KHOẢN (TOPUP)
// ================================
socket.on("topup-transferred", async ({ fromUid, agentUid, time }) => {
  if (!fromUid || !agentUid) return;

  console.log("💸 TOPUP TRANSFER:", fromUid, "→", agentUid);

  const ts = time || Date.now();

  // =====================
  // 1️⃣ REALTIME cho đại lý (nếu online)
  // =====================
  const sockets = activeUsers.get(agentUid);
  if (sockets) {
    for (const sid of sockets) {
      io.to(sid).emit("topup-user-waiting", {
        fromUid,
        time: ts
      });
    }
  }

  // =====================
  // 2️⃣ LƯU INBOX cho đại lý (offline vẫn thấy)
  // =====================
  if (!userInbox.has(agentUid)) {
    userInbox.set(agentUid, []);
  }

  userInbox.get(agentUid).unshift({
    type: "topup-waiting",
    from: fromUid,
    text: `${fromUid} has sent a transfer — please check`,
    time: ts,
    read: false
  });

  saveInbox(Object.fromEntries(userInbox));

  // =====================
  // 3️⃣ PUSH NOTIFICATION cho đại lý (khi offline)
  // =====================
  await sendPushToUser(agentUid, {
    title: "Coin top-up request",
    body: `${fromUid} has sent a transfer`,
    url: "/lsp-admin-128995.html#topup",
    tag: "topup-waiting"
  });

  // =====================
  // 4️⃣ THÔNG BÁO CHO ADMIN (realtime)
  // =====================
  for (const [uid, sockets] of activeUsers.entries()) {
    const db = loadUsers();
    if (db[uid]?.role !== "admin") continue;

    for (const sid of sockets) {
      io.to(sid).emit("topup-admin-notify", {
        fromUid,
        agentUid,
        time: ts
      });
    }
  }

});




/* ==========================================
   VERIFIED SOCKET LOGIN
========================================== */

socket.on("socket-login", () => {

  const uid = socket.data.uid;

  if (!bindSocketToUser(uid, socket)) {
    return;
  }

  emitAgentStatus(uid, true);
});


socket.on("auth-login", () => {

  const uid = socket.data.uid;

  if (!bindSocketToUser(uid, socket)) {
    return;
  }

  emitAgentStatus(uid, true);
});



socket.on("lp-gift-post", async ({ postId, toUid, fromUid, giftId, coin }) => {

  // 🔒 CHẶN USER BỊ KHOÁ
  if (blockIfLocked(socket)) return;

  // 🚫 CHẶN GUEST
  if (String(socket.data.uid || "").startsWith("guest_")) {
    socket.emit("need-login", { feature: "gift" });
    return;
  }

  if (!postId || !toUid || !fromUid || !coin) return;

  const db = loadUsers();
  const from = db[fromUid];
  const to   = db[toUid];
  const post = getPost(postId);

  if (!from || !to || !post) return;


if (!socket.data.uid) return;

if (String(fromUid) !== String(socket.data.uid)) {
  return;
}

if (String(toUid) !== String(post.uid)) {
  return;
}

if (!canInteractSocialPost(socket, post)) {
  return;
}


  // 🚫 không cho tự tặng chính mình
  if (fromUid === toUid) return;

  const cost = Number(coin);
  if (!Number.isFinite(cost) || cost <= 0) return;

  // 🚫 không đủ kim cương
  if ((from.profile.coins || 0) < cost) {
    socket.emit("gift-failed", { reason: "not_enough_coin" });
    return;
  }

  // =========================
  // 💰 TRỪ / CỘNG COIN
  // =========================
  from.profile.coins -= cost;
  from.profile.coinSent = (from.profile.coinSent || 0) + cost;

  to.profile.coinReceived =
    (to.profile.coinReceived || 0) + cost;

  // =========================
  // ⭐ EXP + LEVEL (NGƯỜI NHẬN)
  // =========================
  let toLevelUp = false;

  to.profile.exp = (to.profile.exp || 0) + cost;

  while (to.profile.exp >= (to.profile.level || 1) * 100) {
    to.profile.exp -= (to.profile.level || 1) * 100;
    to.profile.level = (to.profile.level || 1) + 1;
    toLevelUp = true;
  }

  // =========================
  // ⭐ EXP + LEVEL (NGƯỜI TẶNG)
  // =========================
  let fromLevelUp = false;

  // tặng quà nhận ít exp hơn
  from.profile.exp =
    (from.profile.exp || 0) + Math.floor(cost * 0.5);

  while (from.profile.exp >= (from.profile.level || 1) * 100) {
    from.profile.exp -= (from.profile.level || 1) * 100;
    from.profile.level = (from.profile.level || 1) + 1;
    fromLevelUp = true;
  }

  // =========================
  // 🎁 LƯU GIFT VÀO POST
  // =========================
  post.gifts ||= { total: 0, byUser: {} };

  post.gifts.total += cost;

  post.gifts.byUser[fromUid] =
    (post.gifts.byUser[fromUid] || 0) + cost;

  saveUsers(db);
  saveSocial();

  // =========================
  // 🔄 REALTIME UPDATE
  // =========================

emitPrivateSocialEvent(
  "lp-gift-post",
  post,
  {
    postId,
    total: post.gifts.total,
    fromUid,
    amount: cost
  }
);


  emitCoinUpdate(fromUid);
  emitCoinUpdate(toUid);

  // =========================
  // 🔔 INBOX + PUSH
  // =========================
  const giftText =
    `🎁 ${from.profile.name} gifted you ${cost.toLocaleString()} 💎`;

  if (!userInbox.has(toUid)) userInbox.set(toUid, []);

  userInbox.get(toUid).unshift({
    type: "post-gift",
    from: fromUid,
    text: giftText,
    postId,
    amount: cost,
    time: Date.now(),
    read: false
  });

  saveInbox(Object.fromEntries(userInbox));

  await sendPushToUser(toUid, {
    title: "You received a gift",
    body: giftText,
    url: `/social.html#post-${postId}`,
    tag: "post-gift"
  });

});



/* ==========================================
   DIAMOND TRANSFER - ADMIN APPROVAL
   PLAYER REQUEST / HOLD BALANCE
========================================== */






socket.on("coin-transfer", async (payload = {}, ack) => {

  const respond = (data) => {
    if (typeof ack === "function") ack(data);
  };

  const fromUid = getVerifiedTransferUid(socket);

  if (!fromUid) {
    return respond({
      ok: false,
      message: "Authentication required."
    });
  }

  const target = String(payload.target || "").trim();
  const rawAmount = Number(payload.amount);

  if (
    !target ||
    !Number.isSafeInteger(rawAmount) ||
    rawAmount <= 0
  ) {
    return respond({
      ok: false,
      message: "Invalid recipient or diamond amount."
    });
  }

 

const amount = rawAmount;

const securityCode =
  typeof payload.securityCode === "string"
    ? payload.securityCode
    : "";

// Rate-limit before verifying the code
if (isTransferSecurityLocked(fromUid)) {
  return respond({
    ok: false,
    message:
      "Too many failed attempts. Please try again in 15 minutes."
  });
}

if (!securityCode || securityCode.length > 128) {
  return respond({
    ok: false,
    message: "Please enter a valid security code."
  });
}

let users = loadUsers();
let from = users[fromUid];

if (!from?.profile || from.profile.accountBlocked) {
  return respond({
    ok: false,
    message: "Sender account unavailable."
  });
}

if (typeof from.securityCode !== "string") {
  return respond({
    ok: false,
    message:
      "Security code unavailable. Please contact support."
  });
}

const securityHashAtVerification = from.securityCode;

// Verify the bcrypt hash stored on the server
let verified = false;

try {
  verified = await bcrypt.compare(
    securityCode,
    from.securityCode
  );
} catch (error) {
  console.error("[TRANSFER SECURITY]", error);

  return respond({
    ok: false,
    message: "Security verification is unavailable."
  });
}

if (!verified) {

  const locked = recordTransferSecurityFailure(fromUid);

  return respond({
    ok: false,
    message: locked
      ? "Too many failed attempts. Please try again in 15 minutes."
      : "Incorrect security code. Please try again."
  });
}

transferSecurityAttempts.delete(fromUid);

// Reload the latest account data after bcrypt verification.
// This prevents using the balance snapshot taken before await.
users = loadUsers();
from = users[fromUid];


if (from?.securityCode !== securityHashAtVerification) {
  return respond({
    ok: false,
    message: "Security credentials changed. Please try again."
  });
}


if (
  !from?.profile ||
  from.profile.accountBlocked ||
  from.securityCode === undefined
) {
  return respond({
    ok: false,
    message: "Sender account is unavailable."
  });
}



  let toUid = null;

  // Tìm bằng UID chính xác
  if (Object.hasOwn(users, target)) {
    toUid = target;
  }

  // Hoặc tìm bằng tên nhân vật
  if (!toUid) {
    const matches = Object.keys(users).filter(uid =>
      users[uid]?.profile?.name
        ?.toLowerCase() === target.toLowerCase()
    );

    // Không chuyển nhầm nếu nhiều người trùng tên
    if (matches.length === 1) {
      toUid = matches[0];
    }
  }

  const to = toUid ? users[toUid] : null;

  if (!to?.profile || to.profile.accountBlocked) {
    return respond({
      ok: false,
      message: "Recipient not found or unavailable."
    });
  }

  if (toUid === fromUid) {
    return respond({
      ok: false,
      message: "You cannot transfer to yourself."
    });
  }

  const balance = Number(from.profile.coins || 0);

  if (
    !Number.isSafeInteger(balance) ||
    balance < amount
  ) {
    return respond({
      ok: false,
      message: "Insufficient diamonds."
    });
  }

  // Tạo mã giao dịch duy nhất
  const id = crypto.randomUUID();
  const now = Date.now();

  // Trừ khỏi số dư khả dụng để giữ chỗ
  // Chưa cộng kim cương cho người nhận
  from.profile.coins = balance - amount;

  // Danh sách yêu cầu thuộc người gửi
  from.transferRequests ||= [];

  from.transferRequests.unshift({
    id,
    fromUid,
    toUid,
    fromName: String(from.profile.name || fromUid),
    toName: String(to.profile.name || toUid),
    amount,
    status: "pending",
    createdAt: now,
    processedAt: null,
    processedBy: null,
    note: ""
  });

  // Lưu yêu cầu và số dư trong cùng users.json
  try {
    saveUsers(users);
  } catch (err) {
    console.error("[TRANSFER REQUEST SAVE]", err);

    return respond({
      ok: false,
      message: "Unable to save transfer request."
    });
  }

  emitCoinUpdate(fromUid);

  respond({
    ok: true,
    id,
    status: "pending",
    message: "Transfer request submitted for admin approval."
  });

  // Gửi tín hiệu cập nhật tới admin dashboard
  io.emit("diamond-transfer-update", {
    ts: now
  });
});


socket.on("transfer-preview", ({target}) => {

  const users = loadUsers();

  let uid = null;

  if(users[target]){
    uid = target;
  }

  if(!uid){
    const key = Object.keys(users).find(u =>
      users[u]?.profile?.name?.toLowerCase() === target.toLowerCase()
    );
    if(key) uid = key;
  }

  if(!uid){
    return socket.emit("transfer-preview-result",{ok:false});
  }

  const u = users[uid];

  socket.emit("transfer-preview-result",{
    ok:true,
    uid,
    name: u.profile.name,
    avatar: u.profile.avatar,
    level: u.profile.level,
    coins: u.profile.coins
  });

});


/* ==========================================
   DIAMOND HISTORY WITH APPROVAL STATUS
========================================== */

socket.on("coin-transfer-history", () => {

  // Sử dụng hàm xác thực phiên server
  // đã bổ sung cho hệ thống chuyển kim cương
  const uid = getVerifiedTransferUid(socket);

  if (!uid) {
    return socket.emit("coin-transfer-history-result", {
      ok: false,
      history: [],
      error: "Authentication required"
    });
  }

  const users = loadUsers();
  const me = users[uid];

  if (!me) {
    return socket.emit("coin-transfer-history-result", {
      ok: false,
      history: [],
      error: "Account not found"
    });
  }


const todayStart = getTodayStartTsVN();
const todayEnd = todayStart + 86400000;

const history = Array.isArray(me.transferHistory)
  ? me.transferHistory.filter(t => {

      const ts = Number(
        t.time || t.createdAt || 0
      );

      return ts >= todayStart && ts < todayEnd;

    })
  : [];

const requests = Array.isArray(me.transferRequests)
  ? me.transferRequests.filter(r => {

      // Keep unresolved requests visible
      if (r.status === "pending") {
        return true;
      }

      const ts = Number(
        r.processedAt || r.createdAt || 0
      );

      return ts >= todayStart && ts < todayEnd;

    })
  : [];



  // Các bản ghi chuyển cũ có thể không có ID.
  // Mặc định approved vì đã được chuyển trước đây.
  const completed = history.map(t => ({
    ...t,
    status: ["pending", "approved", "rejected"]
      .includes(t.status)
        ? t.status
        : "approved",
    time: Number(t.time || t.createdAt || 0)
  }));

  // Hiển thị cả yêu cầu pending/rejected.
  // Yêu cầu approved đã có trong transferHistory,
  // nên không đưa vào lần thứ hai.
  const requestHistory = requests
    .filter(r =>
      ["pending", "rejected", "approved"]
        .includes(r.status)
    )
    .map(r => ({
      id: r.id,
      type: "send",
      uid: r.toUid,
      name: r.toName || r.toUid,
      avatar: users[r.toUid]?.profile?.avatar || "",
      amount: r.amount,
      status: r.status,
      time: Number(r.processedAt || r.createdAt || 0),
      processedAt: r.processedAt || null,
      note: r.note || ""
    }));

  const ids = new Set(
    completed.filter(t => t.id).map(t => t.id)
  );

  const merged = [
    ...completed,
    ...requestHistory.filter(t => !ids.has(t.id))
  ];

  merged.sort((a, b) => b.time - a.time);

  socket.emit("coin-transfer-history-result", {
    ok: true,
    history: merged
  });
});





socket.on("clear-my-messages", ({ peer }) => {
  const me = socket.data.uid;
  if(!me || !peer) return;

  console.log("🧹 Clear my messages:", me, "→", peer);

  // 1️⃣ XÓA OFFLINE INBOX (CẢ 2 USER)
  [me, peer].forEach(uid => {
    const inbox = userInbox.get(uid);
    if(!inbox) return;

    const filtered = inbox.filter(
      m => !(m.from === me && m.to === peer)
    );

    userInbox.set(uid, filtered);
  });

  saveInbox(Object.fromEntries(userInbox));

  // 2️⃣ REALTIME: báo B để xóa local
  const sockets = activeUsers.get(peer);
  if (sockets) {
    for (const sid of sockets) {
      io.to(sid).emit("peer-cleared-my-messages", {
        by: me
      });
    }
  }
});





  // 🚫 THU HỒI TIN NHẮN
socket.on("revoke-message", ({ msgId }) => {
  if (!msgId) return;

  const fromUid = socket.data.uid;
  if (!fromUid) return;

  // 1️⃣ CẬP NHẬT INBOX SERVER (offline messages)
  for (const [uid, inbox] of userInbox.entries()) {
    let changed = false;

    for (const m of inbox) {
      if (m.id === msgId && m.from === fromUid) {
        m.text = "__REVOKED__";
        m.revoked = true;
        changed = true;
      }
    }

    if (changed) {
      userInbox.set(uid, inbox);
    }
  }

  saveInbox(Object.fromEntries(userInbox));

  // 2️⃣ BẮN REALTIME CHO TẤT CẢ SOCKET KHÁC
  socket.broadcast.emit("revoke-message", { msgId });
});


socket.on("user-block", ({ uid }) => {
  const me = socket.data.uid;
  if (!me || !uid || me === uid) return;

  const db = loadUsers();
  const uMe = db[me];
  if (!uMe) return;

uMe.profile.blockedUsers ||= [];

  if (!uMe.profile.blockedUsers.includes(uid)) {
  uMe.profile.blockedUsers.push(uid);
  }

  // 🔥 BLOCK → TỰ HUỶ KẾT BẠN NẾU CÓ
  uMe.profile.friends = (uMe.profile.friends || []).filter(x => x !== uid);
  const uYou = db[uid];
  if (uYou) {
    uYou.profile.friends =
      (uYou.profile.friends || []).filter(x => x !== me);

    // xoá request 2 chiều nếu còn
    uYou.profile.friendRequests =
      (uYou.profile.friendRequests || []).filter(x => x !== me);
  }

  saveUsers(db);

/* =====================================
   REFRESH SOCIAL FEED AFTER BLOCK
===================================== */

refreshSocialFeedForUser(me);
refreshSocialFeedForUser(uid);


  // 🔔 REALTIME: BLOCK (BÁO CHO NGƯỜI BỊ BLOCK)
const sockets = activeUsers.get(uid);
if (sockets) {
  for (const sid of sockets) {
    io.to(sid).emit("user-blocked", {
      by: me
    });
  }
}


  socket.emit("user-blocked", { uid });
});




socket.on("user-unblock", ({ uid }) => {
  const me = socket.data.uid;
  if (!me || !uid) return;

  const db = loadUsers();
  const uMe = db[me];
  if (!uMe) return;

uMe.profile.blockedUsers =
  (uMe.profile.blockedUsers || []).filter(x => x !== uid);


  saveUsers(db);

  // 🔔 realtime cho chính mình
  socket.emit("user-unblocked", { uid });

  // 🔔 realtime cho người vừa được unblock
  const sockets = activeUsers.get(uid);
  if (sockets) {
    for (const sid of sockets) {
      io.to(sid).emit("user-unblocked-by", {
        by: me
      });
    }
  }
});




socket.on("friend-request", ({ to }) => {

  
  const from = socket.data.uid;
  if (!from || !to || from === to) return;

  const db = loadUsers();
  const uFrom = db[from];
  const uTo = db[to];
  if (!uFrom || !uTo) return;


// 🚫 BLOCK CHECK
if (
  (uFrom.profile.blockedUsers || []).includes(to) ||
  (uTo.profile.blockedUsers || []).includes(from)
) {
  return;
}

  uFrom.profile.friends ||= [];
  uTo.profile.friends ||= [];
  uTo.profile.friendRequests ||= [];

  // đã là bạn → bỏ qua
  if (uFrom.profile.friends.includes(to)) return;

  // đã gửi rồi → bỏ qua
  if (uTo.profile.friendRequests.includes(from)) return;

  uTo.profile.friendRequests.push(from);
  saveUsers(db);

  // realtime nếu online
  const sockets = activeUsers.get(to);
  if (sockets) {
    for (const sid of sockets) {
      io.to(sid).emit("friend-request", {
        from,
        name: uFrom.profile.name,
        avatar: uFrom.profile.avatar
      });
    }
  }
});

socket.on("friend-respond", ({ from, accept }) => {
  const to = socket.data.uid;
  if (!from || !to) return;

  const db = loadUsers();
  const uFrom = db[from];
  const uTo = db[to];
  if (!uFrom || !uTo) return;

  uFrom.profile.friends ||= [];
  uTo.profile.friends ||= [];
  uTo.profile.friendRequests ||= [];

  // xoá request
  uTo.profile.friendRequests =
    uTo.profile.friendRequests.filter(x => x !== from);

  if (accept) {
    if (!uFrom.profile.friends.includes(to))
      uFrom.profile.friends.push(to);

    if (!uTo.profile.friends.includes(from))
      uTo.profile.friends.push(from);
  }

  saveUsers(db);

  if (accept) {
  refreshSocialFeedForUser(from);
  refreshSocialFeedForUser(to);
}


  // báo realtime cho người gửi
  const sockets = activeUsers.get(from);
  if (sockets) {
    for (const sid of sockets) {
      io.to(sid).emit("friend-respond", {
        uid: to,
        accept
      });
    }
  }

// 🔔 REALTIME: ĐÃ LÀ BẠN (BẬT CHAT CHO CẢ 2)
if (accept) {
  const socketsA = activeUsers.get(from); // người gửi lời mời
  const socketsB = activeUsers.get(to);   // người accept

  [socketsA, socketsB].forEach(socks => {
    if (!socks) return;
    for (const sid of socks) {
      io.to(sid).emit("friend-accepted", {
        a: from,
        b: to
      });
    }
  });
}


});


socket.on("friend-cancel", ({ uid }) => {
  const meUid = socket.data.uid;
  if (!meUid || !uid) return;

  const db = loadUsers();
  const me = db[meUid];
  const other = db[uid];

  if (!me || !other) return;

  // me.sent = lời mời đã gửi
  me.friends ||= {};
  other.friends ||= {};

  me.friends.sent = (me.friends.sent || []).filter(u => u !== uid);
  other.friends.requests = (other.friends.requests || []).filter(u => u !== meUid);

  saveUsers(db);
});





socket.on("friend-remove", ({ uid }) => {
  const me = socket.data.uid;
  if (!me || !uid) return;

  const db = loadUsers();
  const uMe = db[me];
  const uYou = db[uid];
  if (!uMe || !uYou) return;

  uMe.profile.friends ||= [];
  uYou.profile.friends ||= [];

  // ❌ xoá 2 chiều
  uMe.profile.friends = uMe.profile.friends.filter(x => x !== uid);
  uYou.profile.friends = uYou.profile.friends.filter(x => x !== me);

  saveUsers(db);

  refreshSocialFeedForUser(me);
refreshSocialFeedForUser(uid);

  // 🔁 realtime nếu người kia online
  const sockets = activeUsers.get(uid);
  if (sockets) {
    for (const sid of sockets) {
      io.to(sid).emit("friend-removed", { uid: me });
    }
  }

  // báo lại cho người bấm
  socket.emit("friend-removed", { uid });
});

socket.on("lp-like-reply", async ({ postId, commentIndex, replyId, uid }) => {
  const post = getPost(postId);
  if (!post) return;


if (!socket.data.uid) return;
if (String(uid) !== String(socket.data.uid)) return;
if (!canInteractSocialPost(socket, post)) return;



  const c = post.comments?.[commentIndex];
  if (!c || !c.replies) return;

  const r = c.replies.find(x => x.id === replyId);
  if (!r) return;

  r.likes = r.likes || [];

  const i = r.likes.indexOf(uid);
  const liked = i === -1;

  if (liked) r.likes.push(uid);
  else r.likes.splice(i, 1);

  saveSocial();


emitPrivateSocialEvent(
  "lp-like-reply",
  post,
  {
    postId,
    commentIndex,
    replyId,
    likes: r.likes.length
  }
);


  // 🔔 PUSH cho chủ reply
  if (liked && r.uid && r.uid !== uid) {
    await sendPushToUser(r.uid, {
      	title: "❤️ Reply liked",
      body: `${socket.data.profile?.name || "Someone"} liked your reply`,
      url: `/social.html#post-${postId}`
    });
  }
});

socket.on("lp-reply-child", ({ postId, commentIndex, replyId, uid, name, avatar, text })=>{
  const post = getPost(postId);
  if(!post) return;


if (!socket.data.uid) return;
if (String(uid) !== String(socket.data.uid)) return;
if (!canInteractSocialPost(socket, post)) return;


  const c = post.comments?.[commentIndex];
  if(!c || !c.replies) return;

  const parent = c.replies.find(r => r.id === replyId);
  if(!parent) return;

  parent.replies = parent.replies || [];

  const child = {
    id: Date.now() + "_" + Math.random().toString(36).slice(2),
    uid, name, avatar,
    text: String(text).slice(0,200),
    time: Date.now(),
    likes: [],
    replies:[]
  };

  parent.replies.push(child);
  saveSocial();


emitPrivateSocialEvent(
  "lp-reply-child",
  post,
  {
    postId,
    commentIndex,
    replyId,
    child
  }
);

});

socket.on("lp-like-comment", async ({ postId, index, uid }) => {
  const post = getPost(postId);
  if (!post || !post.comments || !post.comments[index]) return;

  
if (!socket.data.uid) return;
if (String(uid) !== String(socket.data.uid)) return;
if (!canInteractSocialPost(socket, post)) return;


  const c = post.comments[index];
  c.likes = c.likes || [];

  const i = c.likes.indexOf(uid);
  const liked = i === -1;

  if (liked) c.likes.push(uid);
  else c.likes.splice(i, 1);

  saveSocial();


emitPrivateSocialEvent(
  "lp-like-comment",
  post,
  {
    postId,
    index,
    likes: c.likes.length
  }
);


  // 🔔 PUSH cho chủ comment
  if (liked && c.uid && c.uid !== uid) {
    await sendPushToUser(c.uid, {
      	title: "❤️ Comment liked",
     body: `${socket.data.profile?.name || "Someone"} liked your comment`,
      url: `/social.html#post-${postId}`
    });
  }
});


socket.on("lp-delete", ({ postId, uid }) => {
  const actorUid = socket.data.uid;

  if (!actorUid) return;
  if (String(uid) !== String(actorUid)) return;

  const idx = lpPosts.findIndex(
    p => String(p.id) === String(postId)
  );

  if (idx < 0) return;

  const post = lpPosts[idx];
  const db = loadUsers();

  const isOwner =
    String(post.uid) === String(actorUid);

  const isAdmin =
    db[actorUid]?.role === "admin";

  if (!isOwner && !isAdmin) return;

  // Gửi sự kiện trước khi xóa bài
  emitPrivateSocialEvent(
    "lp-delete",
    post,
    { postId }
  );

  lpPosts.splice(idx, 1);
  saveSocial();
});



  // ===== LIVESTREAM PRO SOCIAL =====


/* ==========================================
   LOAD SOCIAL FEED - FRIENDS ONLY
========================================== */

socket.on("lp-request-feed", () => {
  const uid = socket.data.uid;
  if (!uid) {
    socket.emit("lp-init", []);
    return;
  }

  const db = loadUsers();

  socket.emit(
    "lp-init",
    getVisibleSocialPosts(uid, db)
  );
});




socket.on("lp-edit-post", ({ postId, uid, text, images })=>{
  const post = getPost(postId);
  if(!post) return;

if (!socket.data.uid ||
    String(post.uid) !== String(socket.data.uid)) {
  return;
}

  post.text = String(text || "").slice(0,500);

  // 🔥 QUAN TRỌNG: cập nhật ảnh
  if (Array.isArray(images)) {
    post.images = images;
    delete post.image; // xoá legacy field nếu còn
  }

  post.edited = Date.now();

  saveSocial();

emitSocialPostToAllowedUsers(
  "lp-edit-post",
  post,
  {
    postId,
    text: post.text,
    images: post.images || []
  }
);
});





socket.on("lp-post", post => {
  const uid = socket.data.uid;

  const db = loadUsers();
  const user = db[uid];

  if (!uid || !user || !post) return;

  const text = String(post.text || "").trim();

  const images = Array.isArray(post.images)
    ? post.images.slice(0, 5)
    : [];

  const video = String(post.video || "");

  if (!text && !images.length && !video) return;

  const clean = {
    id: Date.now() + "_" +
      Math.random().toString(36).slice(2),

    uid: String(uid),

    name: String(
      user.profile?.name || "User"
    ).slice(0, 20),

    avatar: String(
      user.profile?.avatar || ""
    ),

    text: text.slice(0, 500),

    images,
    video,

    time: Date.now(),
    likes: [],
    comments: []
  };

  lpPosts.unshift(clean);

  if (lpPosts.length > 200) {
    lpPosts.length = 200;
  }



// Chỉ tiếp tục nếu bài viết đã được lưu.
if (!saveSocial()) {

  const index = lpPosts.findIndex(
    item => item.id === clean.id
  );

  if (index !== -1) {
    lpPosts.splice(index, 1);
  }

  socket.emit("lp-post-save-error", {
    message: "Unable to save your post."
  });

  return;
}


// Chỉ phát bài mới tới người có quyền xem.
emitSocialPostToAllowedUsers(
  "lp-post",
  clean,
  clean
);

/* =====================================
   DAILY SOCIAL POST REWARD
===================================== */

try {

  const reward = rewardDailySocialPost(
    user,
    clean.id
  );

  if (reward.rewarded) {

    // Lưu số dư và nhiệm vụ vào users.json.
    saveUsers(db);

    // Đồng bộ số dư tới các thiết bị.
    emitCoinUpdate(uid);

    // Chỉ thông báo tới người vừa đăng bài.
    socket.emit("daily-social-reward", {
      amount: reward.amount,
      balance: reward.balance,
      day: reward.day,

      message:
        "Daily mission completed! " +
        "+100 Diamonds have been added to your wallet."
    });

    console.log(
      "[DAILY SOCIAL REWARD]",
      uid,
      reward.day,
      reward.amount
    );

  }

} catch (error) {

  console.error(
    "[DAILY SOCIAL REWARD ERROR]",
    error
  );

}


});



socket.on("lp-like", async ({ postId, uid }) => {

const post = getPost(postId);
const actorUid = socket.data.uid;

if (!actorUid || !post) return;
if (String(uid) !== String(actorUid)) return;
if (!canInteractSocialPost(socket, post)) return;


  
  post.likes = post.likes || [];

  const i = post.likes.indexOf(uid);
  const liked = i < 0;

  if (liked) post.likes.push(uid);
  else post.likes.splice(i, 1);

  saveSocial();


emitPrivateSocialEvent(
  "lp-like",
  post,
  {
    postId,
    likes: post.likes.length
  }
);


  // 🔔 PUSH cho chủ bài (nếu like mới & không tự like)
  if (liked && post.uid !== uid) {
    await sendPushToUser(post.uid, {
      title: "❤️ Post liked",
      body: `${socket.data.profile?.name || "Someone"} liked your post`,
      url: `/social.html#post-${postId}`
    });
  }
});


socket.on("lp-comment", async ({ postId, uid, name, avatar, text }) => {
 
const post = getPost(postId);
const actorUid = socket.data.uid;

if (!post || !actorUid || !text) return;
if (String(uid) !== String(actorUid)) return;
if (!canInteractSocialPost(socket, post)) return;


  post.comments = post.comments || [];


const c = {
  id: crypto.randomUUID(),
  uid,
  name,
  avatar,
  text: String(text).slice(0, 200),
  time: Date.now(),
  likes: []
};


  post.comments.push(c);
  saveSocial();

 
emitPrivateSocialEvent(
  "lp-comment",
  post,
  {
    postId,
    postOwnerUid: post.uid,
    comment: c,
    count: post.comments.length
  }
);


  // 🔔 PUSH cho chủ bài
  if (post.uid !== uid) {
    await sendPushToUser(post.uid, {
      title: "💬 New comment",
      body: `${name}: ${text.slice(0,60)}`,
      url: `/social.html#post-${postId}`
    });
  }
});



socket.on("lp-reply", async ({ postId, commentIndex, uid, name, avatar, text }) => {

const post = getPost(postId);
const actorUid = socket.data.uid;

if (!post || !actorUid || !text) return;
if (String(uid) !== String(actorUid)) return;
if (!canInteractSocialPost(socket, post)) return;


  const c = post.comments?.[commentIndex];
  if (!c) return;

  c.replies = c.replies || [];

  const r = {
    id: Date.now()+"_"+Math.random().toString(36).slice(2),
    uid, name, avatar,
    text: text.slice(0,200),
    time: Date.now(),
    likes:[]
  };

  c.replies.push(r);
  saveSocial();


emitPrivateSocialEvent(
  "lp-reply",
  post,
  {
    postId,
    commentIndex,
    reply: r,
    count: c.replies.length
  }
);


  // 🔔 PUSH cho người bị reply
  if (c.uid && c.uid !== uid) {
    await sendPushToUser(c.uid, {
      title: "💬 Comment reply",
      body: `${name}: ${text.slice(0,60)}`,
      url: `/social.html#post-${postId}`
    });
  }
});



socket.on("lp-delete-comment", ({ postId, index, uid })=>{
  const post = getPost(postId);
  if(!post || !post.comments || !post.comments[index]) return;

  if (!socket.data.uid) return;
if (String(uid) !== String(socket.data.uid)) return;
if (!canInteractSocialPost(socket, post)) return;

  const c = post.comments[index];

  // 🔐 chỉ cho chủ comment hoặc chủ bài
  if(c.uid !== uid && post.uid !== uid) return;

  post.comments.splice(index,1);
  saveSocial();

  
emitPrivateSocialEvent(
  "lp-delete-comment",
  post,
  {
    postId,
    index
  }
);

});



socket.on("lp-delete-reply", ({ postId, commentIndex, replyId, uid })=>{
  const post = getPost(postId);
  if(!post) return;

  if (!socket.data.uid) return;
if (String(uid) !== String(socket.data.uid)) return;
if (!canInteractSocialPost(socket, post)) return;

  const c = post.comments?.[commentIndex];
  if(!c || !c.replies) return;

  const idx = c.replies.findIndex(r=>r.id===replyId);
  if(idx < 0) return;

  const r = c.replies[idx];

  // 🔐 chỉ chủ reply hoặc chủ bài
  if(r.uid !== uid && post.uid !== uid) return;

  c.replies.splice(idx,1);
  saveSocial();


emitPrivateSocialEvent(
  "lp-delete-reply",
  post,
  {
    postId,
    commentIndex,
    replyId
  }
);

});



socket.on("lp-delete-reply-child", ({ postId, commentIndex, replyId, childId, uid })=>{
  const post = getPost(postId);
  if(!post) return;

  if (!socket.data.uid) return;
if (String(uid) !== String(socket.data.uid)) return;
if (!canInteractSocialPost(socket, post)) return;

  const c = post.comments?.[commentIndex];
  if(!c || !c.replies) return;

  const parent = c.replies.find(r=>r.id===replyId);
  if(!parent || !parent.replies) return;

  const idx = parent.replies.findIndex(x=>x.id===childId);
  if(idx < 0) return;

  const child = parent.replies[idx];

  // 🔐 chỉ chủ reply-of-reply hoặc chủ bài
  if(child.uid !== uid && post.uid !== uid) return;

  parent.replies.splice(idx,1);
  saveSocial();


emitPrivateSocialEvent(
  "lp-delete-reply-child",
  post,
  {
    postId,
    commentIndex,
    replyId,
    childId
  }
);

});


socket.on("lp-like-reply-child", async ({ postId, commentIndex, replyId, childId, uid }) => {
  const post = getPost(postId);
  if (!post) return;


if (!socket.data.uid) return;
if (String(uid) !== String(socket.data.uid)) return;
if (!canInteractSocialPost(socket, post)) return;


  const c = post.comments?.[commentIndex];
  if (!c || !c.replies) return;

  const parent = c.replies.find(r => r.id === replyId);
  if (!parent || !parent.replies) return;

  const child = parent.replies.find(x => x.id === childId);
  if (!child) return;

  child.likes = child.likes || [];

  const i = child.likes.indexOf(uid);
  const liked = i === -1;

  if (liked) child.likes.push(uid);
  else child.likes.splice(i, 1);

  saveSocial();


emitPrivateSocialEvent(
  "lp-like-reply-child",
  post,
  {
    postId,
    commentIndex,
    replyId,
    childId,
    likes: child.likes.length
  }
);


  // 🔔 PUSH cho chủ reply-child
  if (liked && child.uid && child.uid !== uid) {
    await sendPushToUser(child.uid, {
      title: "❤️ Reply liked",
      body: `${socket.data.profile?.name || "Someone"} liked your reply`,
      url: `/social.html#post-${postId}`
    });
  }
});




socket.on("private-message", async ({ to, text, type, media, msgId }) => {


  if (blockIfLocked(socket)) return;


  const fromUid = socket.data.uid;
if (!fromUid || !to) return;





// 🔒 CHỈ CHO PHÉP NHẮN TIN VỚI BẠN BÈ
const db = loadUsers();
const me = db[fromUid];
const you = db[to];

if (!me || !you) return;

// 🚫 BLOCK CHECK (2 chiều)
me.profile.blockedUsers ||= [];
you.profile.blockedUsers ||= [];

const blockedMe = me.profile.blockedUsers.includes(to);
const blockedByYou = you.profile.blockedUsers.includes(fromUid);


if (blockedMe || blockedByYou) {
  socket.emit("msg-blocked", {
    reason: "blocked",
    to
  });
  return;
}

// 🔧 NORMALIZE FRIEND LIST (FIX BUG)
const myFriends = Array.isArray(me.profile.friends)
  ? me.profile.friends
  : [];

const yourFriends = Array.isArray(you.profile.friends)
  ? you.profile.friends
  : [];

const isAdmin = me.role === "admin";




// 🔒 USER THƯỜNG → BẮT BUỘC LÀ BẠN 2 CHIỀU
if (
  !isAdmin &&
  (!myFriends.includes(to) || !yourFriends.includes(fromUid))
) {
  socket.emit("msg-blocked", {
    reason: "not_friend",
    to
  });
  return;
}



// 🔥 CHUẨN HOÁ NỘI DUNG TIN NHẮN
let payloadText = text || "";

if (type === "image" && media) {
  payloadText = "/img " + media;
}

if (type === "video" && media) {
  payloadText = "/video " + media;
}



 const id = msgId || Date.now() + "_" + Math.random().toString(36).slice(2);


  const msg = {
    id,
    from: fromUid,
    to,
    text: payloadText,
    peer: fromUid, 
    time: Date.now(),
    seen: false,
    delivered: false
  };

  // 1️⃣ LƯU VÀO INBOX NGƯỜI NHẬN
  if (!userInbox.has(to)) userInbox.set(to, []);
  userInbox.get(to).push(msg);
  saveInbox(Object.fromEntries(userInbox));

  // 2️⃣ GỬI REALTIME NẾU ONLINE
  const sockets = activeUsers.get(to);

  if (sockets) {
    const db = loadUsers();
    const user = db[fromUid];

    const fromProfile = {
      ...(socket.data.profile || {}),
      uid: fromUid,
      verified: !!user?.profile?.verified
    };

    for (const sid of sockets) {

io.to(sid).emit("private-message", {
  from: fromProfile,
  text: payloadText,
  msgId: id,
  time: msg.time
});

      io.to(sid).emit("inbox-new");
    }

    msg.delivered = true;
  }

 // 3️⃣ 🔔 LUÔN GỬI PUSH (KỂ CẢ ONLINE)
const subs = pushSubs.get(to);

if (subs && subs.length) {
  const db = loadUsers();
  const fromUser = db[fromUid];

 const payload = JSON.stringify({
  title: `💬 ${fromUser.profile.name}`,
  body:
    type === "image" ? "📷 Hình ảnh"
  : type === "video" ? "🎥 Video"
  : payloadText,

  tag: "chat",

  // 🔥 DATA QUAN TRỌNG NHẤT
  data: {
    type: "chat",
    fromUid
  },

  // fallback nếu browser không support postMessage
  url: `/messages.html?openChat=${fromUid}`
});



  for (let i = subs.length - 1; i >= 0; i--) {
    try {
      await webpush.sendNotification(subs[i], payload);
    } catch (e) {
      if (e.statusCode === 410 || e.statusCode === 404) {
        subs.splice(i, 1); // 🧹 xoá sub chết
      } else {
        console.log("❌ Push failed:", e.message);
      }
    }
  }
}




  // 4️⃣ BÁO NGƯỜI GỬI TRẠNG THÁI
  socket.emit("msg-status", {
    msgId: id,
    status: sockets ? "delivered" : "stored"
  });
});




app.get("/api/friends/:uid", (req, res) => {
  const uid = req.params.uid;
  const db = loadUsers();
  const me = db[uid];
  if (!me) return res.json({ friends: [], requests: [] });

  const friends = (me.profile.friends || []).map(fid => {
    const u = db[fid];
    if (!u) return null;
    return {
      uid: fid,
      name: u.profile.name,
      avatar: normalizeAvatar(u.profile.avatar),
      level: u.profile.level || 1,
      verified: !!u.profile.verified
    };
  }).filter(Boolean);

  const requests = (me.profile.friendRequests || []).map(fid => {
    const u = db[fid];
    if (!u) return null;
    return {
      uid: fid,
      name: u.profile.name,
      avatar: u.profile.avatar,
      level: u.profile.level || 1
    };
  }).filter(Boolean);

  res.json({ friends, requests });
});


app.get("/api/blocked/:uid", (req, res) => {
  const uid = req.params.uid;
  const db = loadUsers();
  const me = db[uid];
  if (!me) return res.json({ blocked: [] });

const blocked = (me.profile.blockedUsers || []).map(bid => {

    const u = db[bid];
    if (!u) return null;
    return {
      uid: bid,
      name: u.profile.name,
      avatar: normalizeAvatar(u.profile.avatar),
      level: u.profile.level || 1,
      verified: !!u.profile.verified
    };
  }).filter(Boolean);

  res.json({ blocked });
});



socket.on("msg-seen", ({ to, msgId }) => {

const sockets = activeUsers.get(to);
if (sockets) {
  for (const sid of sockets) {
    io.to(sid).emit("msg-status", {
      msgId,
      status: "seen"
    });
  }
}


  // 🔥 update inbox
  const uid = socket.data.uid;
  
 const inbox = userInbox.get(uid);
if(inbox){
  for(const m of inbox){
    if(m.id === msgId){
      m.seen = true;
      break;
    }
  }

saveInbox(Object.fromEntries(userInbox));
  // nếu hết tin chưa đọc → tắt badge
  const unread = inbox.filter(m=>!m.seen).length;
  if(unread === 0){
    socket.emit("inbox-clear");
  }
}

});



function isGuest(socket) {
  return (
    socket.data.authenticated !== true ||
    !socket.data.uid
  );
}

function blockGuest(socket, feature){
  if(isGuest(socket)){
    socket.emit("need-login", { feature });
    return true;
  }
  return false;
}


function blockIfLocked(socket){
  const uid = socket.data.uid;
  if (!uid) return false;

  const db = loadUsers();
 if (db[uid]?.profile?.accountBlocked) {

    socket.emit("account-blocked", {
      message: "Your account has been locked"
    });
    return true;
  }
  return false;
}



if(socket.data.uid?.startsWith("guest_")){
  socket.data.role = "guest";
}


  socket.on("get-inbox", ()=>{
  const uid = socket.data.uid;
  if(!uid){
    socket.emit("inbox-data", []);
    return;
  }
  socket.emit("inbox-data", userInbox.get(uid) || []);
});


socket.on("msg-seen-all", ()=>{
  const uid = socket.data.uid;
  if(!uid) return;

  const inbox = userInbox.get(uid);
  if(!inbox) return;

  let changed = false;

  for(const m of inbox){
    if(!m.seen){
      m.seen = true;
      changed = true;
    }
  }

  if(changed){
    socket.emit("inbox-clear"); // 🔴 tắt badge
  }
});




socket.on("auth-ping", ({ uid }) => {
  const currentUid = socket.data.uid;

  if (!currentUid) return;
  if (String(uid) !== String(currentUid)) return;

  if (!activeUsers.has(currentUid)) {
    activeUsers.set(currentUid, new Set());
    emitActiveUsers();
  }

  activeUsers.get(currentUid).add(socket.id);
});




socket.on("auth-login", () => {

  const uid = socket.data.uid;

  if (!socket.data.authenticated || !uid) {
    return;
  }

  if (!bindSocketToUser(uid, socket)) {
    return;
  }
  

  const db = loadUsers();
  if (db[uid]) {
    socket.data.profile = {
      ...db[uid].profile,
      ...socket.data.profile
    };
  }

    // 🔥 GẮN ROLE CHUẨN VÀO SOCKET (FIX ADMIN CHAT)
  socket.data.role = db[uid]?.role || "user";


  // ✅ KHÔNG ĐÁ – CHỈ GHI ĐÈ SOCKET MỚI
 if (!activeUsers.has(uid)) {
  activeUsers.set(uid, new Set());
}
activeUsers.get(uid).add(socket.id);


 // 🔥 GỬI TIN OFFLINE – CHỈ 1 LẦN
const inbox = userInbox.get(uid);
if (inbox && inbox.length) {

  // 👉 CHỈ LẤY TIN CHƯA GỬI
  const toSend = inbox.filter(m => !m.delivered);

  if (toSend.length) {

    // gắn verified cho sender
    for (const m of toSend) {
      const u = db[m.from];
      m.verified = !!u?.profile?.verified;
    }

    socket.emit("offline-messages", toSend);

    // ✅ ĐÁNH DẤU ĐÃ GỬI
    for (const m of toSend) {
      m.delivered = true;
    }


    saveInbox(Object.fromEntries(userInbox)); // ✅ FIX QUAN TRỌNG

    // 🔴 badge chỉ khi còn tin CHƯA XEM
    const unread = inbox.filter(m => !m.seen).length;
    if (unread > 0) {
      socket.emit("inbox-new", { count: unread });
    }
  }

  }

// UID already verified and bound
emitActiveUsers();
emitCoinUpdate(uid);
emitAllUsers();
});






socket.on("host-reconnect", (data = {}, ack) => {

  const reply = (result) => {
    if (typeof ack === "function") {
      ack(result);
    }
  };

  const roomId = normRoomId(data?.roomId);
  const room = rooms.get(roomId);

  if (!room || !room.liveStartTs) {
    return reply({
      ok: false,
      code: "ROOM_ENDED",
      error: "Your livestream session has ended."
    });
  }

  const uid = socket.data.uid;

  if (
    !socket.data.authenticated ||
    !uid ||
    String(room.ownerUid) !== String(uid)
  ) {
    return reply({
      ok: false,
      code: "UNAUTHORIZED",
      error: "Host authorization failed."
    });
  }

  if (
    room.broadcasterId &&
    room.broadcasterId !== socket.id
  ) {
    const activeHost = io.sockets.sockets.get(
      room.broadcasterId
    );

    if (activeHost?.connected) {
      return reply({
        ok: false,
        code: "HOST_ACTIVE",
        error: "Another host connection is active."
      });
    }
  }

  room.broadcasterId = socket.id;
  room.pendingRelease = false;
  room.streamReady = false;

  if (room.releaseTimer) {
    clearTimeout(room.releaseTimer);
    room.releaseTimer = null;
  }

  socket.join(roomId);
  socket.data.roomId = roomId;
  socket.data.role = "broadcaster";

  socket.emit("host-resume", {
    liveStartTs: room.liveStartTs,
    viewers: Array.from(
      safeMap(room.viewerProfiles).values()
    )
  });

  reply({
    ok: true,
    roomId,
    liveStartTs: room.liveStartTs
  });

  io.to(roomId).emit("host-back-online");

  emitViewerCount(roomId);
  emitLobbyUpdate();
});


socket.on("host-profile-update", ({ roomId, level }) => {
  const room = getRoom(roomId);
  if (!room) return;
  if (room.broadcasterId !== socket.id) return;

  if (!room.hostProfile) room.hostProfile = {};

  room.hostProfile.level = Number(level) || room.hostProfile.level || 1;

  io.to(roomId).emit("host-profile-sync", room.hostProfile);
  emitLobbyUpdate();
});


socket.on("profile-update", ({ name, avatar, level, cover, bio }) => {


  // ===== 1. Cập nhật profile realtime cho lobby =====
  if (!socket.data.profile) socket.data.profile = {};
  if (name)   socket.data.profile.name   = safeName(name);
  if (avatar) socket.data.profile.avatar = avatar;
  if (level)  socket.data.profile.level  = Number(level) || socket.data.profile.level;
  if (cover) socket.data.profile.cover = cover;

  // ===== 2. Lưu vĩnh viễn vào users.json =====
  const uid = socket.data.uid;
  if (uid) {
    const db = loadUsers();
    for (const k in db) {
      if (db[k].profile?.uid === uid) {
        if (name)   db[k].profile.name   = safeName(name);
        if (avatar) db[k].profile.avatar = avatar;
        if (level)  db[k].profile.level  = Number(level) || db[k].profile.level;
        if (cover) db[k].profile.cover = cover;
        if (bio !== undefined) {db[k].profile.bio = String(bio).slice(0, 500);}

        saveUsers(db);
        break;
      }
    }
  }

    // ===== SYNC AVATAR VÀO TOÀN BỘ SOCIAL POSTS =====
  if (uid && avatar) {
    let changed = false;

    for (const p of lpPosts) {
      if (p.uid === uid) {
        p.avatar = avatar;
        changed = true;
      }

      if (p.comments) {
        for (const c of p.comments) {
          if (c.uid === uid) {
            c.avatar = avatar;
            changed = true;
          }

          if (c.replies) {
            for (const r of c.replies) {
              if (r.uid === uid) {
                r.avatar = avatar;
                changed = true;
              }

              if (r.replies) {
                for (const ch of r.replies) {
                  if (ch.uid === uid) {
                    ch.avatar = avatar;
                    changed = true;
                  }
                }
              }
            }
          }
        }
      }
    }

    if (changed) saveSocial();

    // 🔥 broadcast cho client update DOM
    io.emit("social-avatar-sync", { uid, avatar });
  }

  // ===== SYNC NAME VÀO TOÀN BỘ SOCIAL POSTS =====
if (uid && name) {
  let changed = false;

  for (const p of lpPosts) {
    if (p.uid === uid) {
      p.name = safeName(name);
      changed = true;
    }

    if (p.comments) {
      for (const c of p.comments) {
        if (c.uid === uid) {
          c.name = safeName(name);
          changed = true;
        }

        if (c.replies) {
          for (const r of c.replies) {
            if (r.uid === uid) {
              r.name = safeName(name);
              changed = true;
            }

            if (r.replies) {
              for (const ch of r.replies) {
                if (ch.uid === uid) {
                  ch.name = safeName(name);
                  changed = true;
                }
              }
            }
          }
        }
      }
    }
  }

  if (changed) saveSocial();

  // 🔥 broadcast cho client update DOM
  io.emit("social-name-sync", { uid, name: safeName(name) });
}


  // ===== 3. Nếu user đang ở trong room thì sync viewer list =====
  const roomId = socket.data.roomId;
  if (roomId) {
    const room = rooms.get(roomId);
    
  if (room) {
  for (const p of safeMap(room.viewerProfiles).values()) {
    if (p.socketId === socket.id) {
      if (name)   p.name   = safeName(name);
      if (avatar) p.avatar = avatar;
      if (level)  p.level  = Number(level) || p.level;
      break;
    }
  }


      const list = Array.from(safeMap(room.viewerProfiles).values());

      for (const v of list) {
        if (!v.mini) {
          io.to(v.socketId).emit("viewer-list", {
            viewers: list.filter(x => !x.mini)
          });
        }
      }
    }
  }

  // ===== 4. Luôn refresh Sảnh người chơi =====
  emitActiveUsers();
  emitAllUsers();   // 🔥 THÊM DÒNG NÀY
});





socket.on("viewer-join", ({ roomId, profile }) => {


const verifiedUid = socket.data.uid;

const db = loadUsers();
const verifiedAccount = verifiedUid
  ? db[verifiedUid]
  : null;

if (
  socket.data.authenticated &&
  verifiedAccount?.profile
) {
  profile = {
    ...verifiedAccount.profile,
    uid: verifiedUid
  };
} else {
  profile = {
    uid: `guest_${socket.id}`,
    name: "Guest",
    avatar: "/icons/icon-192.png",
    level: 1,
    coins: 0
  };
}

socket.data.profile = profile;




  roomId = normRoomId(roomId);
  if (!roomId) return;

  const room = getRoom(roomId);

if (!room.streamReady) {
  socket.emit("wait-host-stream");
  return;
}

  const vc = safeMap(room.viewerProfiles).size;
if(vc >= MAX_VIEWERS){
  socket.emit("room-full");
  return;
}

  if (!room) return;

  // ✅ BẮT BUỘC: join phòng + set data để disconnect cleanup chạy đúng
  socket.join(roomId);
  socket.data.roomId = roomId;
  // 🔥 KHÔNG GHI ĐÈ ROLE ADMIN
if (socket.data.role !== "admin") {
  socket.data.role = "viewer";
}


const uid = socket.data.authenticated
  ? String(socket.data.uid)
  : `guest_${socket.id}`;

  // 👻 CHỐNG MULTI-TAB: kick socket cũ
  const old = room.viewerProfiles.get(uid);
  if (old && old.socketId && old.socketId !== socket.id) {
    io.to(old.socketId).emit("force-disconnect", { reason: "multi_tab" });

    const oldSocket = io.sockets.sockets.get(old.socketId);
    if (oldSocket) oldSocket.disconnect(true);

    room.viewers.delete(old.socketId);
  }

  // add viewer
  room.viewers.add(socket.id);

  // upsert profile (giữ dữ liệu room cũ nếu có)
  room.viewerProfiles.set(uid, {
    uid,
    socketId: socket.id,
    name: safeName(profile?.name),
    avatar: profile?.avatar || "https://i.ibb.co/GvJWn19q/icon-192.png" ,
    level: Number(profile?.level) || 1,
    coins: Number(profile?.coins) || 0,
    coinSentRoom: old?.coinSentRoom || room.giftByUser.get(uid) || 0,
    coinReceivedRoom: old?.coinReceivedRoom || 0,
    mini: false   // 👈 thêm
  });

  emitViewerCount(roomId);

  // ✅ CHỈ emit 1 lần cho cả phòng (đỡ spam)
 const list = Array.from(safeMap(room.viewerProfiles).values());


for (const v of list) {
  if (v.mini) continue;   // ⛔ viewer thu nhỏ không nhận
  io.to(v.socketId).emit("viewer-list", {
    viewers: list.filter(x => !x.mini)
  });
}

  emitLobbyUpdate();
});


socket.on("viewer-mini-mode", ({ roomId, mini }) => {
  const room = getRoom(roomId);
  if (!room) return;

for (const v of safeMap(room.viewerProfiles).values()) {
  if (v.socketId === socket.id) {
    v.mini = mini === true;
    break;
  }
}


  emitViewerCount(roomId); // update số viewer active
});



socket.on("resume-viewers", ({ roomId }) => {
  if (!roomId) return;
  const room = rooms.get(roomId);
  if (!room) return;
  if (room.broadcasterId !== socket.id) return;

  // gửi danh sách viewer hiện tại cho host
 socket.emit("resume-viewers-list", {
  viewers: Array.from(safeSet(room.viewers))
});

});




socket.on("host-start-live", ({ roomId }) => {


  const room = getRoom(roomId);
  if (!room) return;
  if (room.broadcasterId !== socket.id) return;

  room.streamReady = false;

  if (!room.liveStartTs) {
    room.liveStartTs = Date.now();
  }

 // gửi cho toàn phòng (viewer)
io.to(roomId).emit("host-live", {
  liveStartTs: room.liveStartTs
});

// 🔥 gửi riêng cho host (chắc chắn nhận được)
io.to(socket.id).emit("host-live", {
  liveStartTs: room.liveStartTs
});

  emitLobbyUpdate();
});



socket.on("room-check", ({ roomId } = {}, cb) => {

  const rid = normRoomId(roomId);

  if (!/^[0-9]{1,15}$/.test(rid)) {
    return cb?.({
      ok: false,
      reason: "invalid_room_id"
    });
  }

  const room = rooms.get(rid);

  // CHỈ CHẶN khi phòng đang có host online (đang chiếm room)
  // -> host thoát/reload thì broadcasterId sẽ bị clear ở disconnect, nên tạo lại được.
  const taken = !!(room && room.broadcasterId);

  if (taken) return cb?.({ ok: false, reason: "taken", roomId: rid });

  return cb?.({ ok: true, roomId: rid });
});





  // Client (lobby.html) gọi để lấy danh sách phòng đang live
socket.on("lobby-get", () => {
  socket.emit("lobby-update", { rooms: getLobbyList(), ts: Date.now() });
});

  // ===== ICE RESTART RELAY =====
  // Any peer can ask another peer to perform ICE restart
  socket.on("request-ice-restart", ({ to, reason }) => {
    if (!to) return;
    io.to(to).emit("request-ice-restart", { from: socket.id, reason: String(reason || "") });
  });



// ===== LIVE TIMER (server-side source of truth) =====
// Host starts live => store start timestamp; late joiners will receive it.
socket.on("live-start", ({ roomId }) => {
  if (!roomId) return;

  const room = getRoom(roomId);
  if (!room) return;

if (
  !socket.data.authenticated ||
  !socket.data.uid ||
  !room.ownerUid ||
  room.ownerUid !== socket.data.uid ||
  room.broadcasterId !== socket.id
) {
  socket.emit("room-error", {
    message: "Unauthorized livestream operation."
  });
  return;
}

if (!room.liveStartTs) {
  room.liveStartTs = Date.now();
}



/* ==========================================
   SFU - OFFICIAL LIVESTREAM POLICY
   ONCE PER BROADCAST
========================================== */

if (!room.sfuPolicyMessageId) {

  const now = Date.now();


// Khởi tạo thống kê cho phiên LIVE mới.
room.giftTotal = 0;
room.giftByUser = new Map();

  // New livestream starts with a fresh chat.
  room.sfuComments = [];

  const policyMessage = {
    id: crypto.randomUUID(),
    roomId: normRoomId(roomId),

    system: true,
    uid: null,
    name: "LivestreamPro",
    avatar: "",
    verified: true,
    host: false,

    text:
      "Welcome to LivestreamPro! Please respect others, " +
      "protect personal information, and avoid spam, " +
      "harassment, hate speech, illegal or prohibited " +
      "content. Follow our community guidelines " +
      "and enjoy the livestream.",

    ts: now
  };

  room.sfuPolicyMessageId = policyMessage.id;

  // Save in the same history as user comments.
  room.sfuComments.push(policyMessage);

  // Send to Host and all current Viewers.
  io.to(normRoomId(roomId)).emit(
    "sfu:chat:new",
    policyMessage
  );
}



// Thông báo livestream đã bắt đầu
// tới Host và tất cả Viewer trong phòng.
io.to(roomId).emit("sfu:chat:live-state", {
  roomId,
  live: true
});

emitLobbyUpdate();


});



socket.on("live-stop", ({ roomId }) => {
  if (!roomId) return;
  const room = getRoom(roomId);
  if (room.broadcasterId !== socket.id) return;

const currentPk = pkMatches.get(normRoomId(roomId));

if (currentPk) {
  pkFinish(currentPk, "host_stopped");
}

pkClearInvitesFor(normRoomId(roomId));

// 📊 Thống kê buổi live
  const stats = {
    durationMs: room.liveStartTs ? Date.now() - room.liveStartTs : 0,
    viewers: safeSet(room.viewers).size,

    giftsCoins: room.giftTotal || 0,
    topDonors: roomGiftTop(room, 5),
  };

 // ⛔ dừng live
room.liveStartTs = null;

// Ẩn CHAT ngay trên tất cả thiết bị.
io.to(roomId).emit("sfu:chat:live-state", {
  roomId,
  live: false
});

  // 🔔 gửi cho riêng HOST
  socket.emit("live-ended-stats", stats);

  emitLobbyUpdate();

const state = loadLiveState();
delete state[roomId];
saveLiveState(state);

  closeRoom(roomId, "host_stop");
});



  // Join room with role: broadcaster | viewer | guest
socket.on("join-room", ({ roomId, role, profile }) => {

  if (blockIfLocked(socket)) return;


  roomId = normRoomId(roomId);

  if (
    !roomId ||
    !["broadcaster", "viewer"].includes(role)
  ) {
    return;
  }

  // Chặn tạo phòng mới bằng Room ID không phải số
  if (
    role === "broadcaster" &&
    !/^[0-9]{1,15}$/.test(roomId)
  ) {
    socket.emit("room-error", {
      reason: "invalid_room_id",
      message: "Room ID must contain only numbers."
    });
    return;
  }

  const room = getRoom(roomId);


  // Verify broadcaster BEFORE joining or modifying room
  if (role === "broadcaster") {

    const uid = socket.data.uid;


    if (!room.mediaMode) {
  room.mediaMode = "p2p";
}


    if (
      !socket.data.authenticated ||
      !uid
    ) {
      socket.emit("need-login", {
        feature: "join-as-host"
      });
      return;
    }

    const account = loadUsers()[uid];

    if (
      !account?.profile ||
      account.profile.accountBlocked
    ) {
      socket.emit("room-error", {
        message: "Account unavailable."
      });
      return;
    }

    if (
      room.ownerUid &&
      room.ownerUid !== uid
    ) {
      socket.emit("room-error", {
        message: "You are not the owner of this room."
      });
      return;
    }

    if (
      room.broadcasterId &&
      room.broadcasterId !== socket.id
    ) {
      const currentHost =
        io.sockets.sockets.get(room.broadcasterId);

      if (currentHost?.connected) {
        socket.emit("room-error", {
          message: "Host is already connected."
        });
        return;
      }
    }

    room.ownerUid = uid;
  }

  socket.join(roomId);

  socket.data.roomId = roomId;
  socket.data.role = role;
  socket.role = role;

    // store profile (name/coins) for Gift Engine
   socket.data.userName = safeName(
  profile?.name || (role === "broadcaster" ? "Host" : "Viewer")
);

const verifiedAccount = socket.data.uid
  ? loadUsers()[socket.data.uid]
  : null;

socket.data.coins = verifiedAccount?.profile
  ? clampInt(
      verifiedAccount.profile.coins,
      0,
      1_000_000_000
    )
  : 0;

    // sync wallet to this socket
    socket.emit("wallet-sync", { coins: socket.data.coins });



    

// 👑 GỬI PROFILE HOST CHO VIEWER VỪA JOIN
if (role === "viewer" && room.hostProfile) {
  socket.emit("host-profile-sync", room.hostProfile);
}



    if (role === "broadcaster") {



       if (room.releaseTimer) {
    clearTimeout(room.releaseTimer);
    room.releaseTimer = null;
  }
  room.pendingRelease = false;

  const old = room.broadcasterId;
  room.broadcasterId = socket.id;


// 🔄 AUTO RESUME LIVE NẾU ĐANG LIVE TRƯỚC ĐÓ
if (room.liveStartTs) {
  // gửi lại mốc thời gian cho host
  socket.emit("live-resume", {
    startTs: room.liveStartTs
  });

  // báo cho viewer biết host đã quay lại
  io.to(roomId).emit("host-back-online");
}


       // ✅ Lưu profile host
    const name = String(profile?.name || "").trim().slice(0, 20);
    const avatar = String(profile?.avatar || "").trim();

const hostUid = socket.data.uid;
const hostAccount = hostUid
  ? loadUsers()[hostUid]
  : null;

if (
  !socket.data.authenticated ||
  !hostAccount?.profile
) {
  socket.emit("need-login", {
    feature: "join-as-host"
  });
  return;
}

room.ownerUid = hostUid;

room.hostProfile = {
  uid: hostUid,
  name: safeName(hostAccount.profile.name || "Host"),
  avatar: hostAccount.profile.avatar || "",
  level: Number(hostAccount.profile.level) || 1,
  ts: Date.now()
};



      if (old && old !== socket.id) {
        io.to(roomId).emit("broadcaster-changed");
      }

      // Tell broadcaster current viewers list
      socket.emit("room-viewers", Array.from(room.viewers));
      socket.to(roomId).emit("broadcaster-online");
      emitViewerCount(roomId);
      emitLobbyUpdate();
    }

    if (role === "viewer") {
      room.viewers.add(socket.id);
      emitViewerCount(roomId);
      emitLobbyUpdate();

      io.to(roomId).emit("viewer-join", { id: socket.id, count: room.viewers.size });

      if (room.broadcasterId) {
        io.to(room.broadcasterId).emit("watcher", { viewerId: socket.id, roomId });
        socket.emit("broadcaster-online");
      } else {
        socket.emit("broadcaster-offline");
      }
    }

    // If room is already live, send start timestamp to this socket (late joiners)
    if (room.liveStartTs) {
      socket.emit("live-start", { startTs: room.liveStartTs });
    }

    // If has pinned note, send to late joiner
    if (room.pinnedNote) {
      socket.emit("pin-note-update", room.pinnedNote);
    }
  

    // Gift stats for late joiners
    try{
      socket.emit("gift-stats", {
        totalCoins: room.giftTotal || 0,
        topDonors: roomGiftTop(room, 5)
      });
    }catch{}

});

 socket.on("chat", ({ roomId, text }) => {

  if (blockIfLocked(socket)) return;

  if (!roomId || !text) return;

  const room = getRoom(roomId);


  
if (!room) return;

// Verify that the socket has actually joined this room
if (!socket.rooms.has(roomId)) {
  return;
}

// Only the verified broadcaster can send host chat
if (
  socket.data.role === "broadcaster" &&
  (
    !socket.data.authenticated ||
    room.ownerUid !== socket.data.uid ||
    room.broadcasterId !== socket.id
  )
) {
  socket.emit("room-error", {
    message: "Unauthorized livestream chat."
  });
  return;
}


  if (!room) return;

  const r = String(socket.data.role || "").toLowerCase();
  const role = (r === "broadcaster") ? "host" : "viewer";

  let profile = null;

  // 👑 HOST
  if (role === "host") {
    profile = room.hostProfile;
  }

  // 👀 VIEWER / GUEST → TÌM THEO socketId
  if (role !== "host") {
    for (const p of safeMap(room.viewerProfiles).values()) {
    if (p.socketId === socket.id) {
    profile = p;
    break;
  }
}
  }

  const msg = {
    role,
    name: profile?.name || "Anonymous",
    avatar: profile?.avatar,
    level: Number(profile?.level) || 1,
    text: String(text).slice(0, 300),
    ts: Date.now(),
  };

for (const v of safeMap(room.viewerProfiles).values()) {
  if (!v.mini) io.to(v.socketId).emit("chat", msg);
}

// host vẫn nhận
if (room.broadcasterId) io.to(room.broadcasterId).emit("chat", msg);

});




// ===== REACTIONS (emoji/hearts) =====
// client emits: { roomId, emoji, x, y }
socket.on("reaction", ({ roomId, emoji, x, y }) => {
  if(blockGuest(socket,"reaction")) return;   // 🔒



  if (!roomId) return;
  const em = String(emoji || "❤️").slice(0, 4);
  const msg = {
    emoji: em,
    x: typeof x === "number" ? x : Number(x),
    y: typeof y === "number" ? y : Number(y),
    ts: Date.now(),
  };

const room = getRoom(roomId);
if (!room) return;

for (const v of safeMap(room.viewerProfiles).values()) {
  if (!v.mini) io.to(v.socketId).emit("reaction", msg);
}

if (room.broadcasterId) io.to(room.broadcasterId).emit("reaction", msg);

});

  // ===== PIN NOTE (host creates custom pinned content + draggable position) =====
  function __clamp01(n){ n = Number(n); if (!isFinite(n)) return 0.5; return Math.max(0, Math.min(1, n)); }

  socket.on("pin-note-set", ({ roomId, text, x, y }) => {
if(blockGuest(socket,"pin")) return;


    if (!roomId) return;
    const room = getRoom(roomId);
    if (room.broadcasterId !== socket.id) return; // host only
    const t = String(text || "").trim().slice(0, 220);
    if (!t) return;
    const note = { text: t, x: __clamp01(x), y: __clamp01(y), ts: Date.now() };
    room.pinnedNote = note;

 for (const v of safeMap(room.viewerProfiles).values()) {
  if (!v.mini) io.to(v.socketId).emit("pin-note-update", note);
}

if (room.broadcasterId) io.to(room.broadcasterId).emit("pin-note-update", note);

  });

socket.on("pin-note-move", ({ roomId, x, y }) => {
  if(blockGuest(socket,"pin")) return;

  if (!roomId) return;
  const room = getRoom(roomId);
  if (!room || room.broadcasterId !== socket.id) return;
  if (!room.pinnedNote) return;

  room.pinnedNote.x = __clamp01(x);
  room.pinnedNote.y = __clamp01(y);
  room.pinnedNote.ts = Date.now();

  for (const v of safeMap(room.viewerProfiles).values()) {
  if (!v.mini) io.to(v.socketId).emit("pin-note-update", room.pinnedNote);
}


  if (room.broadcasterId) io.to(room.broadcasterId).emit("pin-note-update", room.pinnedNote);
});

 socket.on("pin-note-clear", ({ roomId }) => {
  if(blockGuest(socket,"pin")) return;

  if (!roomId) return;
  const room = getRoom(roomId);
  if (!room || room.broadcasterId !== socket.id) return;

  room.pinnedNote = null;

 for (const v of safeMap(room.viewerProfiles).values()) {
  if (!v.mini) io.to(v.socketId).emit("pin-note-update", null);
}



  if (room.broadcasterId) io.to(room.broadcasterId).emit("pin-note-update", null);
});

  // ===== /PIN NOTE =====


// ===== ANTI SPAM GIFT =====
const GIFT_COOLDOWN_MS = 1500; // 1.5s / lần gửi

const giftCooldown = new Map(); // key: socket.id

function canSendGift(socket) {
  const now = Date.now();
  const last = giftCooldown.get(socket.id) || 0;
  if (now - last < GIFT_COOLDOWN_MS) return false;
  giftCooldown.set(socket.id, now);
  return true;
}



// ===== GIFT ENGINE (paid gifts) =====
socket.on("send-gift", ({ roomId, gift, name }) => {

  if (blockIfLocked(socket)) return;   // 🚫 THÊM DÒNG NÀY

  if (blockGuest(socket, "gift")) return;

  roomId = normRoomId(roomId);
  if (!roomId || !gift) return;

  // 🚫 CHẶN SPAM
  if (!canSendGift(socket)) {
    socket.emit("gift-failed", {
      reason: "spam",
      	message: "You are sending gifts too quickly"
    });
    return;
  }

  const room = getRoom(roomId);
  if (!room?.broadcasterId || !room.liveStartTs) return;

  const type = String(gift.type || "").toLowerCase();
  const catalog = GIFT_CATALOG[type];
  if (!catalog) return;

  const qty = clampInt(gift.qty ?? 1, 1, 999);
  const cost = catalog.cost * qty;

  // ===== WALLET CHECK (PERSIST users.json) =====
  const senderUid = socket.data.uid;
  if (!senderUid) return;

  const db = loadUsers();
  const sender = db[senderUid];
  if (!sender?.profile) return;

  const curCoins = clampInt(sender.profile.coins ?? 0, 0, 1_000_000_000);
  if (curCoins < cost) {
    socket.emit("gift-failed", {
      reason: "no_coins",
      need: cost,
      coins: curCoins
    });
    return;
  }

  // 🔥 TRỪ COIN THẬT
  sender.profile.coins = curCoins - cost;
  sender.profile.coinSent =
    (sender.profile.coinSent || 0) + cost;

  const hostUid = room.hostProfile?.uid;
  if (hostUid && db[hostUid]?.profile) {
    db[hostUid].profile.coinReceived =
      (db[hostUid].profile.coinReceived || 0) + cost;
  }

  // ===== 🎯 CỘNG EXP + LEVEL CHO NGƯỜI NHẬN QUÀ =====
if (hostUid && db[hostUid]?.profile) {
  const hp = db[hostUid].profile;

  // + EXP (1 coin = 1 exp)
  hp.exp = (hp.exp || 0) + cost;

  // ⬆️ LEVEL UP (loop để tránh miss nhiều level)
  let leveledUp = false;
  while (hp.exp >= (hp.level || 1) * 100) {
    hp.exp -= (hp.level || 1) * 100;
    hp.level = (hp.level || 1) + 1;
    leveledUp = true;
  }

  // 🔔 realtime sync cho host
  emitCoinUpdate(hostUid);

  // (optional) notify level up
  if (leveledUp) {
    pushNotify(hostUid, {
      type: "level-up",
      text: `You have reached level ${hp.level}!`
    });
  }
}

// ===== 💎 CỘNG EXP x2 CHO NGƯỜI TẶNG =====
if (senderUid && db[senderUid]?.profile) {
  const sp = db[senderUid].profile;

  // 🎁 donor nhận EXP gấp đôi
  sp.exp = (sp.exp || 0) + cost * 1.5;

  // ⬆️ LEVEL UP donor
  while (sp.exp >= (sp.level || 1) * 100) {
    sp.exp -= (sp.level || 1) * 100;
    sp.level = (sp.level || 1) + 1;
  }

  // 🔔 realtime sync cho donor
  emitCoinUpdate(senderUid);
}


  saveUsers(db);

  // 🔔 REALTIME WALLET
  emitCoinUpdate(senderUid);
  if (hostUid) emitCoinUpdate(hostUid);

  socket.data.coins = sender.profile.coins;
  socket.emit("wallet-update", { coins: sender.profile.coins });


  // ===== TÌM DONOR PROFILE =====
  let donorProfile = null;
  for (const p of safeMap(room.viewerProfiles).values()) {
    if (p.socketId === socket.id) {
      donorProfile = p;
      break;
    }
  }


  // ✅ SYNC COIN VÀO VIEWER PROFILE (để viewer list/mini profile đúng)
if (donorProfile) {
  donorProfile.coins = sender.profile.coins;
  donorProfile.coinSentRoom = (donorProfile.coinSentRoom || 0) + cost;
}


  const donorName = safeName(
    name || donorProfile?.name || socket.data.userName || "Anonymous"
  );

  // 🔒 SYNC DONOR PROFILE (RẤT QUAN TRỌNG)
  if (donorProfile) {
    donorProfile.coins = sender.profile.coins;
    donorProfile.coinSentRoom =
      (donorProfile.coinSentRoom || 0) + cost;
  }

  // 🔔 Notify host
  if (hostUid) {
    pushNotify(hostUid, {
      type: "gift",
      text: `${donorName} gifted ${cost} coins`
    });

    const sockets = activeUsers.get(hostUid);
    if (sockets) {
      for (const sid of sockets) {
        io.to(sid).emit("inbox-new");
      }
    }
  }

  // ===== UPDATE ROOM STATS =====
  room.giftTotal = clampInt(
    (room.giftTotal || 0) + cost,
    0,
    1_000_000_000
  );

  if (donorProfile?.uid) {
    room.giftByUser.set(
      donorProfile.uid,
      (room.giftByUser.get(donorProfile.uid) || 0) + cost
    );
  }

  // ===== SYNC VIEWER LIST =====
  const list = Array.from(safeMap(room.viewerProfiles).values());
  for (const v of list) {
    if (!v.mini) {
      io.to(v.socketId).emit("viewer-list", {
        viewers: list.filter(x => !x.mini)
      });
    }
  }

  // ===== EMIT GIFT EVENT =====
  const payload = {
    gift: {
      type,
      emoji: catalog.emoji,
      cost: catalog.cost,
      qty,
      coins: cost
    },
    donor: donorName,
    uid: donorProfile?.uid || senderUid,
    totalCoins: room.giftTotal,
    ts: Date.now()
  };

  for (const v of list) {
    if (!v.mini) io.to(v.socketId).emit("gift", payload);
  }
  if (room.broadcasterId) {
    io.to(room.broadcasterId).emit("gift", payload);
  }

  // stats
  for (const v of list) {
    if (!v.mini) {
      io.to(v.socketId).emit("gift-stats", {
        totalCoins: room.giftTotal,
        topDonors: roomGiftTop(room, 5)
      });
    }
  }
  if (room.broadcasterId) {
    io.to(room.broadcasterId).emit("gift-stats", {
      totalCoins: room.giftTotal,
      topDonors: roomGiftTop(room, 5)
    });
  }

});



socket.on("host-stream-ready", (data = {}, ack) => {

  const roomId = normRoomId(data?.roomId);
  const room = rooms.get(roomId);

  const reply = result => {
    if (typeof ack === "function") {
      ack(result);
    }
  };

  if (!room) {
    return reply({
      ok: false,
      error: "Room not found."
    });
  }

  if (
    !socket.data.authenticated ||
    String(room.ownerUid) !== String(socket.data.uid) ||
    room.broadcasterId !== socket.id
  ) {
    return reply({
      ok: false,
      error: "Unauthorized host."
    });
  }

  room.streamReady = true;

  io.to(roomId).emit("host-stream-ready");

  reply({
    ok: true,
    roomId
  });
});


  // WebRTC signaling passthrough
  socket.on("offer", ({ to, description }) => {
    io.to(to).emit("offer", { from: socket.id, description });
  });

  socket.on("answer", ({ to, description }) => {
    io.to(to).emit("answer", { from: socket.id, description });
  });

  socket.on("candidate", ({ to, candidate }) => {
    io.to(to).emit("candidate", { from: socket.id, candidate });
  });

  socket.on("disconnect", () => {






  const roomId = socket.data.roomId;
  const role = socket.data.role;
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (!room) return;

  /* ========= VIEWER ========= */
  if (role === "viewer") {
    // xoá khỏi viewers set
    room.viewers.delete(socket.id);

    // xoá profile viewer
   for (const [uid, profile] of safeMap(room.viewerProfiles).entries()) {
  if (profile.socketId === socket.id) {
    room.viewerProfiles.delete(uid);
    break;
  }
}


    emitViewerCount(roomId);

const list = Array.from(safeMap(room.viewerProfiles).values());


for (const v of list) {
  if (v.mini) continue;   // ⛔ viewer thu nhỏ không nhận
  io.to(v.socketId).emit("viewer-list", {
    viewers: list.filter(x => !x.mini)
  });
}


    emitLobbyUpdate();
   

  }





/* ========= HOST ========= */
if (role === "broadcaster") {

  // Ignore disconnects from outdated host sockets.
  if (room.broadcasterId !== socket.id) {
    return;
  }

  // Mark the host as offline immediately.
  room.broadcasterId = null;
  room.streamReady = false;
  room.pendingRelease = true;

  // Prevent multiple release timers.
  if (room.releaseTimer) {
    clearTimeout(room.releaseTimer);
    room.releaseTimer = null;
  }

  // Remove the room from lobby immediately.
  emitLobbyUpdate();

  // Notify viewers about temporary interruption.
  io.to(roomId).emit("host-temp-offline");

  console.log(
    "[LIVE] Host disconnected:",
    roomId
  );

  // Keep the room temporarily for host reconnection.
  room.releaseTimer = setTimeout(() => {

    // The room may have been closed or replaced.
    if (rooms.get(roomId) !== room) {
      return;
    }

    room.releaseTimer = null;

    // Check whether the host has reconnected.
    if (
      !room.pendingRelease ||
      room.broadcasterId
    ) {
      return;
    }

    console.log(
      "[LIVE] Host timeout - closing room:",
      roomId
    );

    closeRoom(roomId, "host_timeout");

  }, ROOM_RELEASE_DELAY);
}




  

  /* ========= CLEAN ROOM ========= */
/*
 if (!room.broadcasterId && safeSet(room.viewers).size === 0) {
  rooms.delete(roomId);
}
*/
});



});





app.get("/lobby", (_, res) => {
  res.sendFile(path.join(__dirname, "public", "lobby.html"));
});




/* ==========================================
   WHEEL8 - SCREEN SHARE SERVER
   WebRTC + Socket.io
   ========================================== */

const wheel8ScreenShares = new Map();
const W8_SHARE_LIMIT = 8;


/* ==========================================
   WHEEL8 ACTIVE SCREEN SHARE DIRECTORY
========================================== */

const W8_SHARE_DIRECTORY_ROOM = "w8share:directory";


/* ==========================================
   MILITARY SCREEN SHARE - LIVEKIT SFU TOKEN
========================================== */

app.post("/api/w8share/sfu-token", async (req, res) => {
  res.set("Cache-Control", "no-store");

  try {
    const token = String(req.body?.token || "");
    const socketId = String(req.body?.socketId || "");
    const proof = String(req.body?.proof || "");
    const role = String(req.body?.role || "");

    if (
      !/^[a-f0-9]{36}$/.test(token) ||
      !["host", "viewer"].includes(role)
    ) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_REQUEST"
      });
    }

    if (!SFU_URL || !SFU_KEY || !SFU_SECRET) {
      return res.status(503).json({
        ok: false,
        error: "SFU_NOT_CONFIGURED"
      });
    }

    const session = wheel8ScreenShares.get(token);
    const client = io.sockets.sockets.get(socketId);

    if (
      !session ||
      session.mode !== "sfu" ||
      !client?.connected
    ) {
      return res.status(403).json({
        ok: false,
        error: "SESSION_NOT_AVAILABLE"
      });
    }

    const expected = client.data.w8SfuProof;

    if (
      !expected ||
      proof.length !== expected.length
    ) {
      return res.status(403).json({
        ok: false,
        error: "INVALID_SESSION"
      });
    }

    if (!crypto.timingSafeEqual(
      Buffer.from(proof),
      Buffer.from(expected)
    )) {
      return res.status(403).json({
        ok: false,
        error: "INVALID_SESSION"
      });
    }

    if (role === "host") {

      if (
        session.hostId !== socketId ||
        client.data.w8Hosting !== token ||
        !client.data.authenticated ||
        !client.data.uid ||
        String(client.data.uid) !==
          String(session.hostUid)
      ) {
        return res.status(403).json({
          ok: false,
          error: "HOST_NOT_AUTHORIZED"
        });
      }

    } else {

      if (
        !session.viewers.has(socketId) ||
        client.data.w8Watching !== token ||
        !session.hostId ||
        !io.sockets.sockets.has(session.hostId)
      ) {
        return res.status(403).json({
          ok: false,
          error: "VIEWER_NOT_AUTHORIZED"
        });
      }

    }

    const grant = new AccessToken(
      SFU_KEY,
      SFU_SECRET,
      {
        identity: `w8_${role}_${socketId}`,
        ttl: "30m"
      }
    );

    grant.addGrant({
      roomJoin: true,
      room: `w8_${token}`,
      canPublish: role === "host",
      canSubscribe: role === "viewer",
      canPublishData: false
    });

    return res.json({
      ok: true,
      url: SFU_URL,
      token: await grant.toJwt()
    });

  } catch (error) {
    console.error("[W8 SFU]", error);

    return res.status(500).json({
      ok: false,
      error: "SFU_TOKEN_ERROR"
    });
  }
});



function getW8ActiveShareList() {
  const users = loadUsers();
  const result = [];

  for (const [token, session] of wheel8ScreenShares) {

    // Chỉ công bố phiên có người phát đang kết nối
    if (
      !session.hostId ||
      !io.sockets.sockets.has(session.hostId)
    ) continue;

    const user = users[session.hostUid];
    if (!user?.profile) continue;

    result.push({
      token,
      uid: String(session.hostUid),
      name: String(
        user.profile.name || "Player"
      ).slice(0, 60),
      viewers: session.viewers.size
    });
  }

  return result;
}

function emitW8ShareDirectory() {

  io.to(W8_SHARE_DIRECTORY_ROOM).emit(
    "w8share:directory:update",
    getW8ActiveShareList()
  );

}



// Keep disconnected broadcasters' sessions for 5 minutes.
const W8_SHARE_GRACE_MS = 5 * 60 * 1000;

function closeWheel8ScreenShare(token) {
  const session = wheel8ScreenShares.get(token);
  if (!session) return;

  clearTimeout(session.releaseTimer);

  wheel8ScreenShares.delete(token);

  
  for (const viewerId of session.viewers) {
    const viewer = io.sockets.sockets.get(viewerId);

    if (viewer) viewer.data.w8Watching = null;

    io.to(viewerId).emit("w8share:ended");
  }

  const host = io.sockets.sockets.get(session.hostId);
  if (host) host.data.w8Hosting = null;

emitW8ShareDirectory();


}

io.on("connection", (socket) => {




socket.on("sfu:join-ack", (data, cb) => {

  if (typeof cb !== "function") return;

  const roomId = normRoomId(data?.roomId);
  const role = data?.role;

  const room = rooms.get(roomId);

  if (
    !room ||
    !socket.data.authenticated ||
    !socket.data.uid ||
    !socket.rooms.has(roomId) ||
    socket.data.roomId !== roomId
  ) {
    return cb({ ok: false });
  }

  const uid = String(socket.data.uid);


 // ==========================================
// SFU - VERIFIED HOST PROFILE
// ==========================================

const usersForHost = loadUsers();

const hostUid = String(room.ownerUid || "");
const hostAccount = usersForHost[hostUid];
const viewerAccount = usersForHost[uid];

const viewerFriends =
  viewerAccount?.profile?.friends || [];

const hostRequests =
  hostAccount?.profile?.friendRequests || [];

const sfuHostInfo = hostAccount?.profile
  ? {
      uid: hostUid,
      name: String(
        hostAccount.profile.name || "Live Host"
      ).slice(0, 50),
      avatar: normalizeAvatar(
        hostAccount.profile.avatar || ""
      ),
      isFriend: viewerFriends
        .map(String)
        .includes(hostUid),
      requested: hostRequests
        .map(String)
        .includes(uid)
    }
  : null; 


const currentViewers = getSfuActiveViewers(room);
const currentViewerCount = currentViewers.length;



  if (role === "host") {

    const authorized =
      room.ownerUid === uid &&
      room.broadcasterId === socket.id;


return cb({
  ok: authorized,
  ...(authorized
    ? {
viewerCount: currentViewerCount,
viewers: currentViewers,
host: sfuHostInfo
      }
    : {})
});

  }

  if (role === "viewer") {

    const viewer = room.viewerProfiles?.get(uid);

    const authorized =
      !!viewer &&
      viewer.socketId === socket.id &&
      room.viewers.has(socket.id);


return cb({
  ok: authorized,
  ...(authorized
    ? {
viewerCount: currentViewerCount,
viewers: currentViewers,
host: sfuHostInfo
      }
    : {})
});

  }

  return cb({ ok: false });
});



/* ==========================================
   SFU PK - SOCKET ACTIONS
========================================== */

socket.on("sfu:pk:invite", (data, ack) => {
  if (typeof ack !== "function") return;

  const from = pkHost(data?.roomId, socket.id);
  const targetId = normRoomId(data?.targetRoomId);

  if (!from) {
    return ack({ ok: false, error: "Start your live first." });
  }

  if (!targetId || targetId === from.id) {
    return ack({ ok: false, error: "Invalid target room." });
  }

  const targetRoom = rooms.get(targetId);
  const target = pkHost(
    targetId,
    targetRoom?.broadcasterId
  );

  if (!target) {
    return ack({
  ok: false,
  error: "HOST NOT FOUND",
  message: "This room does not exist or the host is not live."
});
  }

pkPruneInvites();

// Only one pending invitation per host.
const hasPendingInvite = [...pkInvites.values()].some(
  invite =>
    invite.fromRoom === from.id ||
    invite.targetRoom === from.id ||
    invite.fromRoom === targetId ||
    invite.targetRoom === targetId
);

if (
  pkMatches.has(from.id) ||
  pkMatches.has(targetId) ||
  hasPendingInvite
) {
  return ack({
    ok: false,
    error: "A PK invitation or battle is already active."
  });
}


  const invite = {
    id: crypto.randomUUID(),
    fromRoom: from.id,
    targetRoom: targetId,
    fromSocket: socket.id,
    targetSocket: target.host.id,
    expiresAt: Date.now() + PK_INVITE_TTL
  };

  pkInvites.set(targetId, invite);

  const users = loadUsers();
  const name = String(
    users[from.room.ownerUid]?.profile?.name || "Host"
  ).slice(0, 50);

  io.to(target.host.id).emit("sfu:pk:invite", {
    inviteId: invite.id,
    fromRoom: from.id,
    fromName: name
  });

  
ack({
  ok: true,
  status: "sent",
  inviteId: invite.id,
  targetRoomId: targetId,
  expiresAt: invite.expiresAt,
  message: "PK invitation sent successfully."
});

});



socket.on("sfu:pk:respond", (data, ack) => {
  if (typeof ack !== "function") return;

  const target = pkHost(data?.roomId, socket.id);

  if (!target) {
    return ack({ ok: false, error: "Host not authorized." });
  }

pkPruneInvites();

  const invite = pkInvites.get(target.id);

  if (
    !invite ||
    invite.id !== data?.inviteId ||
    invite.targetSocket !== socket.id ||
    invite.expiresAt <= Date.now()
  ) {
    pkInvites.delete(target.id);
    return ack({ ok: false, error: "Invitation expired." });
  }

  pkInvites.delete(target.id);

  const from = pkHost(
    invite.fromRoom,
    invite.fromSocket
  );

  if (!from) {
    return ack({ ok: false, error: "Other host went offline." });
  }

  if (data?.accept !== true) {
    io.to(from.host.id).emit("sfu:pk:declined");
    return ack({ ok: true });
  }

  if (
    pkMatches.has(from.id) ||
    pkMatches.has(target.id)
  ) {
    return ack({ ok: false, error: "PK already active." });
  }

  const users = loadUsers();

  const match = {
    id: crypto.randomUUID(),
    rooms: [from.id, target.id],

    names: [
      String(users[from.room.ownerUid]?.profile?.name || "Host A").slice(0, 50),
      String(users[target.room.ownerUid]?.profile?.name || "Host B").slice(0, 50)
    ],
    scores: [0, 0],

endAt: Date.now() + PK_DURATION,
timer: null,

phase: "playing",
round: 1,
winnerRoom: null,
rematchInvite: null,

peerParticipants: new Map(),
sharedComments: []

  };

  pkMatches.set(from.id, match);
  pkMatches.set(target.id, match);

match.timer = setTimeout(
  () => pkCompleteRound(match),
  PK_DURATION
);

  pkBroadcast(
    match,
    "sfu:pk:started",
    pkPublicState(match)
  );

  ack({ ok: true });
});



/* ==========================================
   PK - REQUEST REMATCH
========================================== */

socket.on("sfu:pk:rematch-invite", (data, ack) => {

  if (typeof ack !== "function") return;

  const host = pkHost(data?.roomId, socket.id);

  if (!host) {
    return ack({
      ok: false,
      error: "Host not authorized."
    });
  }

  const match = pkMatches.get(host.id);

  if (!match || match.phase !== "finished") {
    return ack({
      ok: false,
      error: "Finish the current round first."
    });
  }

  // Only one pending rematch invitation.
  if (match.rematchInvite) {
    return ack({
      ok: false,
      error: "A rematch invitation is already pending."
    });
  }

  const otherId = match.rooms.find(
    id => id !== host.id
  );

  const otherRoom = rooms.get(otherId);

  const other = pkHost(
    otherId,
    otherRoom?.broadcasterId
  );

  if (!other) {
    return ack({
      ok: false,
      error: "Opponent host is offline."
    });
  }

  const invite = {
    id: crypto.randomUUID(),

    fromRoom: host.id,
    targetRoom: otherId,

    fromSocket: socket.id,
    targetSocket: other.host.id,

    expiresAt: Date.now() + PK_REMATCH_TTL,
    timer: null
  };

  match.rematchInvite = invite;

  invite.timer = setTimeout(() => {

    if (match.rematchInvite !== invite) return;

    match.rematchInvite = null;

    io.to(invite.fromSocket).emit(
      "sfu:pk:rematch-expired"
    );

    io.to(invite.targetSocket).emit(
      "sfu:pk:rematch-expired"
    );

  }, PK_REMATCH_TTL);

  io.to(other.host.id).emit(
    "sfu:pk:rematch-invite",
    {
      inviteId: invite.id,
      matchId: match.id,
      round: match.round + 1,
      fromName: match.names[
        match.rooms.indexOf(host.id)
      ]
    }
  );

  ack({ ok: true });
});


/* ==========================================
   PK - ACCEPT / DECLINE REMATCH
========================================== */

socket.on("sfu:pk:rematch-respond", (data, ack) => {

  if (typeof ack !== "function") return;

  const host = pkHost(data?.roomId, socket.id);

  if (!host) {
    return ack({
      ok: false,
      error: "Host not authorized."
    });
  }

  const match = pkMatches.get(host.id);

  if (!match || match.phase !== "finished") {
    return ack({
      ok: false,
      error: "Rematch is unavailable."
    });
  }

  const invite = match.rematchInvite;

  if (
    !invite ||
    invite.id !== data?.inviteId ||
    invite.targetRoom !== host.id ||
    invite.targetSocket !== socket.id ||
    invite.expiresAt <= Date.now()
  ) {
    return ack({
      ok: false,
      error: "Rematch invitation expired."
    });
  }

  clearTimeout(invite.timer);
  match.rematchInvite = null;

  // Decline: keep PK connection open.
  if (data?.accept !== true) {

    io.to(invite.fromSocket).emit(
      "sfu:pk:rematch-declined"
    );

    return ack({ ok: true });
  }

  // Verify both hosts are still live.
  const inviter = pkHost(
    invite.fromRoom,
    invite.fromSocket
  );

  const receiver = pkHost(
    invite.targetRoom,
    invite.targetSocket
  );

  if (!inviter || !receiver) {
    return ack({
      ok: false,
      error: "A host is no longer available."
    });
  }

  const started = pkStartNextRound(match);

  if (!started) {
    return ack({
      ok: false,
      error: "Unable to start the next round."
    });
  }

  ack({
    ok: true,
    round: match.round
  });
});



socket.on("sfu:pk:state", (data, ack) => {
  if (typeof ack !== "function") return;

  const access = getAuthorizedSfuChatRoom(data?.roomId);

  if (!access) {
    return ack({ ok: false });
  }

  const match = pkMatches.get(access.id);

  ack({
    ok: true,
    match: match ? pkPublicState(match) : null
  });
});

socket.on("sfu:pk:stop", (data, ack) => {
  if (typeof ack !== "function") return;

  const host = pkHost(data?.roomId, socket.id);

  if (!host) {
    return ack({ ok: false });
  }

  const match = pkMatches.get(host.id);

  if (match) pkFinish(match, "host_stopped");
pkClearInvitesFor(host.id);

  ack({ ok: true });
});

// ==========================================
// PK - HOST DISCONNECT HANDLING
// ==========================================

socket.on("disconnect", () => {

  const roomId = socket.data.roomId;
  const room = rooms.get(roomId);

  // Viewer disconnect must not end the battle.
  if (!room || room.broadcasterId !== socket.id) {
    return;
  }

  const match = pkMatches.get(roomId);

  if (match) {
    pkFinish(match, "host_disconnected");
  }

  pkClearInvitesFor(roomId);
});



/* ==========================================
   SFU LIVESTREAM - REALTIME COMMENTS
========================================== */

// Kiểm tra thành viên thực tế của phòng.
function getAuthorizedSfuChatRoom(roomId) {
  const id = normRoomId(roomId);
  if (!id) return null;

  const room = rooms.get(id);
  const uid = socket.data.uid;

  if (
    !room ||
    !socket.data.authenticated ||
    !uid ||
    socket.data.roomId !== id ||
    !socket.rooms.has(id)
  ) {
    return null;
  }

  const isHost =
    String(room.ownerUid) === String(uid) &&
    room.broadcasterId === socket.id;

  const viewer = room.viewerProfiles?.get(String(uid));

  const isMember =
    isHost ||
    (
      viewer?.socketId === socket.id &&
      room.viewers.has(socket.id)
    );

  return isMember ? { room, id, uid, isHost } : null;
}




/* ==========================================
   SFU LIVE - SECURE ADD FRIEND
========================================== */

socket.on("sfu:friend:request", (data, ack) => {

  if (typeof ack !== "function") return;

  // Validate actual membership of this live room.
  const access = getAuthorizedSfuChatRoom(
    data?.roomId
  );

  if (!access) {
    return ack({
      ok: false,
      error: "Room access denied."
    });
  }

  if (access.isHost) {
    return ack({
      ok: false,
      error: "You cannot add yourself."
    });
  }

  const from = String(access.uid);
  const to = String(access.room.ownerUid || "");

  if (!to || from === to) {
    return ack({
      ok: false,
      error: "Invalid host account."
    });
  }

  const db = loadUsers();

  const sender = db[from];
  const receiver = db[to];

  if (
    !sender?.profile ||
    !receiver?.profile
  ) {
    return ack({
      ok: false,
      error: "Account not available."
    });
  }

  if (
    sender.profile.accountBlocked ||
    receiver.profile.accountBlocked
  ) {
    return ack({
      ok: false,
      error: "Account unavailable."
    });
  }

  const senderBlocked =
    (sender.profile.blockedUsers || [])
      .map(String);

  const receiverBlocked =
    (receiver.profile.blockedUsers || [])
      .map(String);

  if (
    senderBlocked.includes(to) ||
    receiverBlocked.includes(from)
  ) {
    return ack({
      ok: false,
      error: "Friend request unavailable."
    });
  }

  sender.profile.friends ||= [];
  receiver.profile.friends ||= [];
  receiver.profile.friendRequests ||= [];

  const alreadyFriends =
    sender.profile.friends.map(String).includes(to) ||
    receiver.profile.friends.map(String).includes(from);

  if (alreadyFriends) {
    return ack({
      ok: true,
      status: "friends"
    });
  }

  if (
    receiver.profile.friendRequests
      .map(String)
      .includes(from)
  ) {
    return ack({
      ok: true,
      status: "pending"
    });
  }

  receiver.profile.friendRequests.push(from);

  saveUsers(db);

  // Reuse the existing realtime friend notification.
  emitToUser(to, "friend-request", {
    from,
    name: sender.profile.name || "Player",
    avatar: normalizeAvatar(
      sender.profile.avatar || ""
    )
  });

  return ack({
    ok: true,
    status: "pending"
  });
});



/* ==========================================
   SFU VOICE REQUEST - SOCKET ACTIONS
========================================== */

socket.on("sfu:voice:state", (data, ack) => {
  if (typeof ack !== "function") return;

  const access = getAuthorizedSfuChatRoom(
    data?.roomId
  );

  if (!access) {
    return ack({
      ok: false,
      error: "ACCESS_DENIED"
    });
  }

  const state = sfuVoiceSummary(access.id);

  ack({
    ok: true,
    isHost: access.isHost,
    approved: state.speakers.some(
      x => x.uid === String(access.uid)
    ),
    pending: access.isHost
      ? state.pending
      : [],
    speakers: state.speakers,
    maxSpeakers: state.maxSpeakers
  });
});


socket.on("sfu:voice:request", (data, ack) => {
  if (typeof ack !== "function") return;

  const access = getAuthorizedSfuChatRoom(
    data?.roomId
  );

  if (!access || access.isHost) {
    return ack({
      ok: false,
      error: "ACCESS_DENIED"
    });
  }

  if (
    access.room.mediaMode !== "sfu" ||
    !access.room.liveStartTs
  ) {
    return ack({
      ok: false,
      error: "LIVE_NOT_ACTIVE"
    });
  }

  const state = getSfuVoiceRoom(access.id);
  const uid = String(access.uid);

  if (state.speakers.has(uid)) {
    return ack({
      ok: false,
      error: "ALREADY_APPROVED"
    });
  }

  if (state.pending.has(uid)) {
    return ack({
      ok: false,
      error: "REQUEST_PENDING"
    });
  }

  if (state.pending.size >= 20) {
    return ack({
      ok: false,
      error: "REQUEST_QUEUE_FULL"
    });
  }

  const db = loadUsers();

  const name = String(
    db[uid]?.profile?.name || "Viewer"
  ).slice(0, 50);

  state.pending.set(uid, {
    uid,
    name,
    requestedAt: Date.now()
  });

  emitSfuVoiceState(access.id);

  ack({ ok: true });
});


socket.on("sfu:voice:respond", async (data, ack) => {
  if (typeof ack !== "function") return;

  const access = getAuthorizedSfuChatRoom(
    data?.roomId
  );

  if (!access?.isHost) {
    return ack({
      ok: false,
      error: "HOST_ONLY"
    });
  }

  const uid = String(data?.uid || "");
  const approve = data?.approve === true;

  const state = getSfuVoiceRoom(access.id);
  const request = state.pending.get(uid);

  if (!request) {
    return ack({
      ok: false,
      error: "REQUEST_NOT_FOUND"
    });
  }

  if (
    approve &&
    state.speakers.size >= SFU_VOICE_MAX
  ) {
    return ack({
      ok: false,
      error: "VOICE_ROOM_FULL"
    });
  }

  if (!approve) {
    state.pending.delete(uid);

    const viewer =
      access.room.viewerProfiles?.get(uid);

    if (viewer?.socketId) {
      io.to(viewer.socketId).emit(
        "sfu:voice:declined"
      );
    }

    emitSfuVoiceState(access.id);

    return ack({ ok: true });
  }

  const viewer =
    access.room.viewerProfiles?.get(uid);

  const target = viewer?.socketId
    ? io.sockets.sockets.get(viewer.socketId)
    : null;

  if (
    !target?.connected ||
    target.data.authenticated !== true ||
    String(target.data.uid) !== uid ||
    target.data.roomId !== access.id ||
    !access.room.viewers.has(target.id)
  ) {
    state.pending.delete(uid);
    emitSfuVoiceState(access.id);

    return ack({
      ok: false,
      error: "VIEWER_OFFLINE"
    });
  }

  try {
    // Cấp quyền microphone tại LiveKit.
    await setSfuVoicePermission(
      access.id,
      uid,
      true
    );

    // Kiểm tra lại sau thao tác bất đồng bộ.
    const latest = getSfuVoiceRoom(access.id);
    const currentRoom = rooms.get(access.id);

    const currentViewer =
      currentRoom?.viewerProfiles?.get(uid);

    const stillAuthorized =
      currentRoom === access.room &&
      currentRoom.broadcasterId === socket.id &&
      currentViewer?.socketId === target.id &&
      target.connected &&
      currentRoom.viewers.has(target.id) &&
      latest.pending.has(uid) &&
      latest.speakers.size < SFU_VOICE_MAX;

    if (!stillAuthorized) {
      await setSfuVoicePermission(
        access.id,
        uid,
        false
      );

      return ack({
        ok: false,
        error: "REQUEST_EXPIRED"
      });
    }

    latest.pending.delete(uid);

    latest.speakers.set(uid, {
      uid,
      name: request.name,
      socketId: target.id
    });

    target.emit("sfu:voice:approved");

    emitSfuVoiceState(access.id);

    ack({ ok: true });

  } catch (error) {
    console.error("[SFU VOICE APPROVE]", error);

    ack({
      ok: false,
      error: "VOICE_PERMISSION_FAILED"
    });
  }
});


socket.on("sfu:voice:leave", async (data, ack) => {
  if (typeof ack !== "function") return;

  const access = getAuthorizedSfuChatRoom(
    data?.roomId
  );

  if (!access || access.isHost) {
    return ack({
      ok: false,
      error: "ACCESS_DENIED"
    });
  }

  const uid = String(access.uid);
  const state = getSfuVoiceRoom(access.id);

  if (!state.speakers.has(uid)) {
    state.pending.delete(uid);

    emitSfuVoiceState(access.id);

    return ack({ ok: true });
  }

  try {
    await setSfuVoicePermission(
      access.id,
      uid,
      false
    );

    state.speakers.delete(uid);

    socket.emit("sfu:voice:revoked");

    emitSfuVoiceState(access.id);

    ack({ ok: true });

  } catch (error) {
    console.error("[SFU VOICE LEAVE]", error);

    ack({
      ok: false,
      error: "VOICE_LEAVE_FAILED"
    });
  }
});


socket.on("sfu:voice:revoke", async (data, ack) => {
  if (typeof ack !== "function") return;

  const access = getAuthorizedSfuChatRoom(
    data?.roomId
  );

  if (!access?.isHost) {
    return ack({
      ok: false,
      error: "HOST_ONLY"
    });
  }

  const uid = String(data?.uid || "");
  const state = getSfuVoiceRoom(access.id);

  if (!state.speakers.has(uid)) {
    return ack({
      ok: false,
      error: "SPEAKER_NOT_FOUND"
    });
  }

  try {
    await setSfuVoicePermission(
      access.id,
      uid,
      false
    );

    state.speakers.delete(uid);

    const viewer =
      access.room.viewerProfiles?.get(uid);

    if (viewer?.socketId) {
      io.to(viewer.socketId).emit(
        "sfu:voice:revoked"
      );
    }

    emitSfuVoiceState(access.id);

    ack({ ok: true });

  } catch (error) {
    console.error("[SFU VOICE REVOKE]", error);

    ack({
      ok: false,
      error: "VOICE_REVOKE_FAILED"
    });
  }
});

socket.on("disconnect", () => {
  const roomId = normRoomId(
    socket.data.roomId
  );

  const uid = String(
    socket.data.uid || ""
  );

  if (!roomId || !uid) return;

  const state = sfuVoiceRooms.get(roomId);
  if (!state) return;

  let changed = false;

  if (state.pending.has(uid)) {
    state.pending.delete(uid);
    changed = true;
  }

  const speaker = state.speakers.get(uid);

  if (speaker?.socketId === socket.id) {
    state.speakers.delete(uid);
    changed = true;

    // Thu hồi quyền trên LiveKit.
    setSfuVoicePermission(
      roomId,
      uid,
      false
    ).catch(error => {
      console.error(
        "[SFU VOICE DISCONNECT]",
        error
      );
    });
  }

  if (changed) {
    emitSfuVoiceState(roomId);
  }
});




/* ==========================================
   SFU CHAT HISTORY - ROOM / PK SHARED
========================================== */

socket.on("sfu:chat:history", (data, ack) => {
  if (typeof ack !== "function") return;

  const access = getAuthorizedSfuChatRoom(
    data?.roomId
  );

  if (!access) {
    return ack({
      ok: false,
      error: "Room access denied."
    });
  }

  let match = pkMatches.get(access.id);

// The round may finish, but PK shared chat remains active.
if (
  match &&
  match.phase === "playing" &&
  Date.now() >= match.endAt
) {
  pkCompleteRound(match);
}

  const messages = match
    ? match.sharedComments
    : access.room.sfuComments;

  ack({
    ok: true,
    live: Boolean(access.room.liveStartTs),

    // Keep the original room's gift statistics.
    totalCoins: Number(access.room.giftTotal) || 0,

    // Allows the client to reject stale history responses.
    pkMatchId: match?.id || null,

    messages: Array.isArray(messages)
      ? messages.slice(-50)
      : []
  });
});


// Gửi bình luận.
socket.on("sfu:chat:send", (data, ack) => {

  if (typeof ack !== "function") return;

  const access = getAuthorizedSfuChatRoom(data?.roomId);

  if (!access) {
    return ack({
      ok: false,
      error: "You are not in this livestream."
    });
  }

  if (!access.room.liveStartTs) {
  return ack({
    ok: false,
    error: "Livestream is not active."
  });
}


  const now = Date.now();

  // Chống gửi liên tục.
  if (now - (socket.data.lastSfuCommentAt || 0) < 1500) {
    return ack({
      ok: false,
      error: "Please slow down."
    });
  }

  const content = String(data?.text || "").trim();

  if (
    !content ||
    content.length > 300 ||
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(content)
  ) {
    return ack({
      ok: false,
      error: "Comment must be 1–300 characters."
    });
  }

  const db = loadUsers();
  const account = db[access.uid];

  if (!account?.profile) {
    return ack({
      ok: false,
      error: "Account not available."
    });
  }

  socket.data.lastSfuCommentAt = now;


  // Get the active PK match from the authenticated room.
let chatPkMatch = pkMatches.get(access.id);

if (
  chatPkMatch &&
  chatPkMatch.phase === "playing" &&
  Date.now() >= chatPkMatch.endAt
) {
  pkCompleteRound(chatPkMatch);
}

const message = {
  id: crypto.randomUUID(),

roomId: access.id,

// Same ID for messages shared by both PK rooms.
pkMatchId: chatPkMatch?.id || null,

uid: String(access.uid),

  name: String(
    account.profile.name || "Player"
  ).slice(0, 50),

  // Avatar lấy trực tiếp từ tài khoản đã xác thực
  avatar: normalizeAvatar(
    account.profile.avatar || ""
  ),

  verified: !!account.profile.verified,
  host: access.isHost,

  text: content,
  ts: now
};




// ==========================================
// SAVE COMMENTS TO CORRECT CHAT SCOPE
// ==========================================

if (chatPkMatch) {

  // During PK, store comments in the shared battle history.
  chatPkMatch.sharedComments ||= [];

  chatPkMatch.sharedComments.push(message);

  if (chatPkMatch.sharedComments.length > 50) {
    chatPkMatch.sharedComments.splice(
      0,
      chatPkMatch.sharedComments.length - 50
    );
  }

  // Send once to each of the two participating rooms.
  for (const pkRoomId of chatPkMatch.rooms) {
    io.to(pkRoomId).emit(
      "sfu:chat:new",
      message
    );
  }

} else {

  // Outside PK, keep the original private room chat.
  if (!Array.isArray(access.room.sfuComments)) {
    access.room.sfuComments = [];
  }

  access.room.sfuComments.push(message);

  if (access.room.sfuComments.length > 50) {
    access.room.sfuComments.splice(
      0,
      access.room.sfuComments.length - 50
    );
  }

  io.to(access.id).emit(
    "sfu:chat:new",
    message
  );
}

ack({
  ok: true,
  id: message.id
});

});




/* ==========================================
   SFU LIVE GIFTS - SERVER WALLET ENGINE
   Uses real profile.coins
========================================== */


const SFU_LIVE_GIFTS = Object.freeze({

  rose: {
    name: "Rose", emoji: "🌹", cost: 10
  },

  heart: {
    name: "Heart", emoji: "❤️", cost: 50
  },

  flower: {
    name: "Flower", emoji: "🌸", cost: 100
  },

  cake: {
    name: "Cake", emoji: "🎂", cost: 150
  },

  rocket: {
    name: "Rocket", emoji: "🚀", cost: 200
  },

  diamond: {
    name: "Diamond", emoji: "💎", cost: 300
  },

  teddy: {
    name: "Teddy Bear", emoji: "🧸", cost: 500
  },

  champagne: {
    name: "Champagne", emoji: "🥂", cost: 800
  },

  king: {
    name: "Crown", emoji: "👑", cost: 1000
  },

  car: {
    name: "Luxury Car", emoji: "🏎️", cost: 2000
  },

  sword: {
    name: "Golden Sword", emoji: "⚔️", cost: 3000
  },

  pegasus: {
    name: "Pegasus", emoji: "🐎", cost: 5000
  },

  phoenix: {
    name: "Phoenix", emoji: "🔥", cost: 7000
  },

  dragon: {
    name: "Dragon", emoji: "🐉", cost: 10000
  },

  castle: {
    name: "Royal Castle", emoji: "🏰", cost: 15000
  },

  yacht: {
    name: "Royal Yacht", emoji: "🛥️", cost: 20000
  },

  supercar: {
    name: "Supercar", emoji: "🏎️", cost: 25000
  },

  palace: {
    name: "Golden Palace", emoji: "🏯", cost: 30000
  },

  celestialDragon: {
    name: "Celestial Dragon", emoji: "🐲", cost: 40000
  },

  universe: {
    name: "Royal Universe", emoji: "🌌", cost: 50000
  }

});


// Return authenticated viewer's real balance.
socket.on("sfu:gift:balance", (data, ack) => {
  if (typeof ack !== "function") return;

  const access = getAuthorizedSfuChatRoom(data?.roomId);

  if (!access || access.isHost) {
    return ack({ ok: false, error: "Viewer access required." });
  }

  const account = loadUsers()[access.uid];

  if (!account?.profile) {
    return ack({ ok: false, error: "Account unavailable." });
  }

  ack({
    ok: true,
    coins: Math.max(0, Math.floor(Number(account.profile.coins) || 0))
  });
});

socket.on("sfu:gift:send", (data, ack) => {

  if (typeof ack !== "function") return;

  const reply = (error) => ack({
    ok: false,
    error
  });

  // Must be a verified, active Viewer in this room.
  const access = getAuthorizedSfuChatRoom(data?.roomId);

  if (
    !access ||
    access.isHost ||
    socket.data.authenticated !== true
  ) {
    return reply("You must be a signed-in viewer.");
  }

  const room = access.room;

  if (!room.liveStartTs || !room.broadcasterId) {
    return reply("The livestream is not active.");
  }

  const hostSocket = io.sockets.sockets.get(
    room.broadcasterId
  );

  const hostUid = String(room.ownerUid || "");

  if (
    !hostSocket?.connected ||
    hostSocket.data.authenticated !== true ||
    String(hostSocket.data.uid || "") !== hostUid ||
    !hostUid ||
    hostUid === access.uid
  ) {
    return reply("Host is not available.");
  }


const giftId = String(data?.giftId || "");

if (
  !Object.hasOwn(SFU_LIVE_GIFTS, giftId)
) {
  return reply("Invalid gift.");
}

const gift = SFU_LIVE_GIFTS[giftId];

if (
  !gift ||
  !Number.isSafeInteger(gift.cost) ||
  gift.cost <= 0
) {
  return reply("Invalid gift configuration.");
}



/* ======================================
   SFU GIFT COMBO - SERVER VALIDATION
====================================== */

const quantity = Number(data?.quantity ?? 1);

if (![1, 5, 10, 20, 50].includes(quantity)) {
  return reply("Invalid gift quantity.");
}

const cost = gift.cost * quantity;

if (
  !Number.isSafeInteger(cost) ||
  cost <= 0
) {
  return reply("Invalid combo total.");
}



  const requestId = String(data?.requestId || "");

  if (!/^[a-f0-9-]{36}$/i.test(requestId)) {
    return reply("Invalid transaction ID.");
  }

  const db = loadUsers();

  const sender = db[access.uid];
  const receiver = db[hostUid];

  if (
    !sender?.profile ||
    !receiver?.profile ||
    sender.profile.accountBlocked ||
    receiver.profile.accountBlocked
  ) {
    return reply("Account unavailable.");
  }

  const senderProfile = sender.profile;
  const hostProfile = receiver.profile;

  const history = Array.isArray(senderProfile.liveGiftHistory)
    ? senderProfile.liveGiftHistory
    : [];

  // Idempotency: an acknowledged transaction cannot
  // be charged again if the same request is retried.
  const previous = history.find(
    tx => tx.id === requestId && tx.direction === "sent"
  );

  if (previous) {
    return ack({
      ok: true,
      duplicate: true,
      transactionId: requestId,
      coins: Math.floor(Number(senderProfile.coins) || 0)
    });
  }

  const now = Date.now();

  if (now - (socket.data.lastSfuGiftAt || 0) < 1000) {
    return reply("Please wait before sending another gift.");
  }

  
  const balance = Math.floor(Number(senderProfile.coins));

  if (!Number.isSafeInteger(balance) || balance < 0) {
    return reply("Invalid account balance.");
  }

  if (balance < cost) {
    return ack({
      ok: false,
      error: "Insufficient diamonds.",
      coins: balance
    });
  }


/* ======================================
   HOST RECEIVING WALLET VALIDATION
====================================== */

const hostWallet = Number(
  hostProfile.coinReceived ?? 0
);

if (
  !Number.isSafeInteger(hostWallet) ||
  hostWallet < 0 ||
  hostWallet > Number.MAX_SAFE_INTEGER - cost
) {
  return reply("Host receiving wallet is unavailable.");
}



  const senderName = String(
    senderProfile.name || "Viewer"
  ).slice(0, 50);

  const ts = Date.now();


/* ======================================
   SFU GIFT - CORRECT WALLET TRANSFER
====================================== */

// Viewer pays from usable diamonds.
senderProfile.coins = balance - cost;

// Track diamonds sent by Viewer.
senderProfile.coinSent =
  (Number(senderProfile.coinSent) || 0) + cost;

// Host receives gifts into receiving Wallet.
hostProfile.coinReceived = hostWallet + cost;

// IMPORTANT:
// Do NOT increase hostProfile.coins.
// Received gifts belong to the Wallet,
// not the usable diamond balance.


    

const transaction = {
  id: requestId,
  roomId: access.id,

  giftId,
  giftName: gift.name,

  quantity,
  unitCost: gift.cost,
  amount: cost,

  fromUid: access.uid,
  toUid: hostUid,
  ts
};

  // Maintain recent audit history on both accounts.
  senderProfile.liveGiftHistory = [
    ...history,
    { ...transaction, direction: "sent" }
  ].slice(-200);

  hostProfile.liveGiftHistory = [
    ...(Array.isArray(hostProfile.liveGiftHistory)
      ? hostProfile.liveGiftHistory
      : []),
    { ...transaction, direction: "received" }
  ].slice(-200);

  try {
    // Synchronous persistence before success is returned.
    saveUsers(db);
  } catch (error) {
    console.error("[SFU GIFT SAVE]", error);
    return reply("Unable to save gift transaction.");
  }

  socket.data.lastSfuGiftAt = now;

  // Update both real profile wallets.
  emitCoinUpdate(access.uid);
  emitCoinUpdate(hostUid);

  // Room gift statistics.
  room.giftTotal = (Number(room.giftTotal) || 0) + cost;

  room.giftByUser ||= new Map();
  room.giftByUser.set(
    access.uid,
    (Number(room.giftByUser.get(access.uid)) || 0) + cost
  );

// Count verified gift value toward the active PK battle.
pkRecordGift(access.id, cost);

const payload = {
  roomId: access.id,
  transactionId: requestId,

  donor: senderName,

  giftId,
  giftName: gift.name,
  emoji: gift.emoji,

  quantity,
  unitCost: gift.cost,
  cost,

  totalCoins: room.giftTotal,

  ts
};



  // Only this room sees the gift animation.
  io.to(access.id).emit("sfu:gift:new", payload);

  ack({
    ok: true,
    transactionId: requestId,
    coins: senderProfile.coins
  });

});





// ======================================
// ACTIVE SCREEN SHARE DIRECTORY
// ======================================

socket.on("w8share:directory:join", (ack) => {

  if (typeof ack !== "function") return;

  const uid = socket.data.uid;

  if (!uid || !loadUsers()[uid]?.profile) {
    return ack({
      ok: false,
      error: "Login required."
    });
  }

  socket.join(W8_SHARE_DIRECTORY_ROOM);

  ack({
    ok: true,
    shares: getW8ActiveShareList()
  });

});

socket.on("w8share:directory:leave", () => {
  socket.leave(W8_SHARE_DIRECTORY_ROOM);
});



  // Người chơi bắt đầu chia sẻ
  socket.on("w8share:start", (_data, ack) => {
    if (typeof ack !== "function") return;

    const uid = socket.data.uid;

    if (!uid || !loadUsers()[uid]?.profile) {
      return ack({
        ok: false,
        error: "You must log in to share your screen."
      });
    }

    if (socket.data.w8Hosting) {
      closeWheel8ScreenShare(socket.data.w8Hosting);
    }

    const token = crypto.randomBytes(18).toString("hex");


wheel8ScreenShares.set(token, {
  hostId: socket.id,
  hostUid: uid,
  viewers: new Set(),
  releaseTimer: null,
  mode: _data?.mode === "sfu" ? "sfu" : "mobile"
});

socket.data.w8SfuProof =
  crypto.randomBytes(24).toString("hex");

    socket.data.w8Hosting = token;

    
ack({
  ok: true,
  token,
  mode: wheel8ScreenShares.get(token).mode,
  proof: socket.data.w8SfuProof
});

emitW8ShareDirectory();

  });



// Restore an existing LIVE session after reconnecting.
socket.on("w8share:resume", (data, ack) => {

  if (typeof ack !== "function") return;

  const token = String(data?.token || "");
  const session = wheel8ScreenShares.get(token);
  const uid = socket.data.uid;

  if (!session) {
    return ack({
      ok: false,
      expired: true,
      error: "LIVE session has expired."
    });
  }

  // Only the authenticated owner can restore the session.
  if (
    !uid ||
    session.hostUid !== uid ||
    !loadUsers()[uid]?.profile
  ) {
    return ack({
      ok: false,
      error: "Not authorized to restore this LIVE session."
    });
  }

  if (
    session.hostId &&
    session.hostId !== socket.id &&
    io.sockets.sockets.has(session.hostId)
  ) {
    return ack({
      ok: false,
      error: "This LIVE session is active on another connection."
    });
  }

  clearTimeout(session.releaseTimer);
  session.releaseTimer = null;

/* ==========================================
   W8 SHARE - RESTORE HOST SESSION
========================================== */

session.hostId = socket.id;

socket.data.w8Hosting = token;

// Generate a new proof for the reconnected socket
socket.data.w8SfuProof =
  crypto.randomBytes(24).toString("hex");

emitW8ShareDirectory();

ack({
  ok: true,
  count: session.viewers.size,
  proof: socket.data.w8SfuProof
});

  // Tell existing viewers that the broadcaster is back.
  for (const viewerId of session.viewers) {

    const viewer = io.sockets.sockets.get(viewerId);

    if (
      !viewer ||
      viewer.data.w8Watching !== token
    ) continue;

    io.to(viewerId).emit("w8share:resumed");

    // Ask the broadcaster to establish WebRTC again.
    socket.emit("w8share:viewer", {
      viewerId,
      count: session.viewers.size
    });

  }

});



  // Viewer open link
  socket.on("w8share:join", (data, ack) => {
    if (typeof ack !== "function") return;

    const token = String(data?.token || "");

    if (!/^[a-f0-9]{36}$/.test(token)) {
      return ack({
        ok: false,
        error: "Invalid link."
      });
    }

    const session = wheel8ScreenShares.get(token);

if (!session) {
  return ack({
    ok: false,
    error: "This LIVE session has ended."
  });
}

    if (
      session.viewers.size >= W8_SHARE_LIMIT &&
      !session.viewers.has(socket.id)
    ) {
      return ack({
        ok: false,
        error: "The viewing room is full."
      });
    }

    // Rời phiên xem cũ nếu có
    const oldToken = socket.data.w8Watching;

    if (oldToken && oldToken !== token) {
      const old = wheel8ScreenShares.get(oldToken);

      if (old) {
        old.viewers.delete(socket.id);

        io.to(old.hostId).emit("w8share:left", {
          viewerId: socket.id,
          count: old.viewers.size
        });
      }
    }

session.viewers.add(socket.id);
socket.data.w8Watching = token;

socket.data.w8SfuProof =
  crypto.randomBytes(24).toString("hex");

const hostOnline = Boolean(
  session.hostId &&
  io.sockets.sockets.has(session.hostId)
);

ack({
  ok: true,
  paused: !hostOnline,
  mode: session.mode,
  proof: socket.data.w8SfuProof
});

if (hostOnline) {
  io.to(session.hostId).emit("w8share:viewer", {
    viewerId: socket.id,
    count: session.viewers.size
  });
}


  });


  
/* ==========================================
   WHEEL8 LIVE COMMENTS
   Viewer -> Host + Viewers
========================================== */

socket.on("w8share:comment", (data, callback) => {

  const reply =
    typeof callback === "function"
      ? callback
      : () => {};

  const token =
    typeof data?.token === "string"
      ? data.token
      : "";

  const session = wheel8ScreenShares.get(token);

  // Chỉ thành viên đang xem LIVE mới được bình luận
  if (
    !session ||
    !io.sockets.sockets.has(session.hostId) ||
    socket.data.w8Watching !== token ||
    !session.viewers.has(socket.id)
  ) {
    return reply({
      ok: false,
      error: "You have not joined the LIVE session."
    });
  }

  const now = Date.now();

  // Chống spam: mỗi 2 giây tối đa 1 bình luận
  if (now - (socket.data.w8LastComment || 0) < 2000) {
    return reply({
      ok: false,
      	error: "Please wait 2 seconds before posting another comment."
    });
  }

  // Làm sạch nội dung
  function cleanComment(value, maxLength) {

    if (typeof value !== "string") return "";

    return value
      .replace(/[\u0000-\u001F\u007F]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength);
  }

  const name =
    cleanComment(data?.name, 20) || "Viewer";

  const content = cleanComment(data?.text, 120);

  if (!content) {
    return reply({
      ok: false,
      error: "Please enter a comment."
    });
  }

  socket.data.w8LastComment = now;

  const message = {
    id: crypto.randomUUID(),
    token,
    name,
    text: content,
    time: now
  };

  // Gửi bình luận đến người đang phát
  io.to(session.hostId).emit(
    "w8share:comment",
    message
  );

  // Gửi đến toàn bộ người xem cùng phiên
  for (const viewerId of session.viewers) {

    io.to(viewerId).emit(
      "w8share:comment",
      message
    );

  }

  reply({ ok: true });

});



  
// =======================================
// MOBILE GAME FRAME RELAY
// =======================================

socket.on("w8share:frame", (data) => {

  const token = String(data?.token || "");
  const session = wheel8ScreenShares.get(token);

  if (!session) return;

  // Chỉ chủ phiên mới được gửi ảnh
  if (
    session.hostId !== socket.id ||
    socket.data.w8Hosting !== token
  ) return;

  if (session.viewers.size === 0) return;

  const image = data?.image;

  if (
    typeof image !== "string" ||
    !image.startsWith("data:image/jpeg;base64,") ||
    image.length > 180000
  ) return;

  // Giới hạn tốc độ gửi ảnh
  const now = Date.now();

  if (now - (session.lastFrameAt || 0) < 900) {
    return;
  }

  session.lastFrameAt = now;

  // Phát ảnh tới các người xem của phiên
  for (const viewerId of session.viewers) {

    io.to(viewerId).volatile.emit("w8share:frame", {
      image
    });

  }

});



  // Chuyển tín hiệu WebRTC
  socket.on("w8share:signal", (data) => {
    const token = String(data?.token || "");
    const session = wheel8ScreenShares.get(token);

    if (!session) return;

    const to = String(data?.to || "");
    const packet = data?.packet;

    if (
      !packet ||
      !["offer", "answer", "candidate"].includes(packet.type)
    ) return;

    if (JSON.stringify(packet).length > 30000) return;

    const isHost = session.hostId === socket.id;
    const isViewer = session.viewers.has(socket.id);

    const allowed =
      (isHost && session.viewers.has(to)) ||
      (isViewer && to === session.hostId);

    if (!allowed) return;

    io.to(to).emit("w8share:signal", {
      from: socket.id,
      packet
    });
  });

  // Người chơi chủ động dừng
  socket.on("w8share:stop", (data) => {
    const token = String(data?.token || "");

    if (socket.data.w8Hosting === token) {
      closeWheel8ScreenShare(token);
    }
  });


// Keep the session temporarily when the broadcaster disconnects.
socket.on("disconnect", () => {

  const token = socket.data.w8Hosting;

  if (token) {

    const session = wheel8ScreenShares.get(token);

    if (session && session.hostId === socket.id) {

      session.hostId = null;

emitW8ShareDirectory();

      clearTimeout(session.releaseTimer);

      // The sharing link remains valid during this period.
      session.releaseTimer = setTimeout(() => {

        if (
          wheel8ScreenShares.get(token) === session &&
          !session.hostId
        ) {
          closeWheel8ScreenShare(token);
        }

      }, W8_SHARE_GRACE_MS);

      // Tell viewers the broadcast is temporarily offline.
      for (const viewerId of session.viewers) {
        io.to(viewerId).emit("w8share:paused");
      }

    }

  }


    if (socket.data.w8Watching) {
      const session = wheel8ScreenShares.get(
        socket.data.w8Watching
      );

      if (session) {
        session.viewers.delete(socket.id);

        io.to(session.hostId).emit("w8share:left", {
          viewerId: socket.id,
          count: session.viewers.size
        });
      }
    }
  });

});




/* ==========================================
   SPIRIT BEAST V1 - SERVER ENGINE
========================================== */


/* ==========================================
   SPIRIT BEAST - HARD SURVIVAL V2
========================================== */

// Chu kỳ phát thưởng: 24 giờ
const SPIRIT_DAY = 8 * 60 * 60 * 1000;

// Phải cho ăn mỗi 6 giờ
const SPIRIT_FEED = 6 * 60 * 60 * 1000;

// Phải vệ sinh mỗi 6 giờ
const SPIRIT_CLEAN = 6 * 60 * 60 * 1000;

// Chết khi bỏ đói 7 giờ
const SPIRIT_DEATH = 7 * 60 * 60 * 1000;

const SPIRIT_MAX = 4;

// 3 lần/ngày x 30 ngày = 90 chu kỳ
const SPIRIT_MAX_REWARDS = 90;



/* ==========================================
   SPIRIT BEAST - REWARD V3
   TARGET NET PROFIT: 10% - 20%
   PERIOD: 30 DAYS
========================================== */



/* ==========================================
   SPIRIT REALM - 12 BEAST COLLECTION
   reward = TOTAL DAILY REWARD
   3 reward cycles per day
========================================== */

const SPIRIT_TYPES = Object.freeze({

  // ORIGINAL BEASTS - KEEP EXISTING VALUES

  dragon: {
    name: "Azure Dragon",
    price: 10000,
    reward: 390
  },

    tortoise: {
    name: "Celestial Tortoise",
    price: 20000,
    reward: 780
  },

  tiger: {
    name: "White Tiger",
    price: 35000,
    reward: 1365
  },


  fox: {
    name: "Nine-Tailed Fox",
    price: 50000,
    reward: 2010
  },


    wolf: {
    name: "Moon Wolf",
    price: 75000,
    reward: 2925
  },


  griffin: {
    name: "Storm Griffin",
    price: 100000,
    reward: 3900
  },


  phoenix: {
    name: "Fire Phoenix",
    price: 150000,
    reward: 6000
  },

  
  pegasus: {
    name: "Celestial Pegasus",
    price: 200000,
    reward: 7800
  },

  serpent: {
    name: "Frost Serpent",
    price: 300000,
    reward: 11700
  },



  qilin: {
    name: "Qilin",
    price: 500000,
    reward: 20400
  },


  hydra: {
    name: "Abyss Hydra",
    price: 750000,
    reward: 29250
  },

  leviathan: {
    name: "Leviathan",
    price: 1000000,
    reward: 39000
  }

});



// Đồng bộ chu kỳ thưởng và trạng thái tử vong.
// Trả thưởng tại các mốc 24 giờ nếu được
// cho ăn và vệ sinh đúng hạn.

function spiritTickUser(user, now) {
  if (!Array.isArray(user.spiritBeasts)) {
    user.spiritBeasts = [];
  }

  let changed = false;
  let earned = 0;

  for (const pet of user.spiritBeasts) {
    if (pet.dead) continue;

    const kind = SPIRIT_TYPES[pet.type];
    if (!kind) continue;

    const deathAt = pet.lastFedAt + SPIRIT_DEATH;

    // Không trả thưởng sau thời điểm lẽ ra đã chết.
    const maxTime = Math.min(now, deathAt);

    while (
      pet.rewardCycles < SPIRIT_MAX_REWARDS &&
      pet.nextRewardAt <= maxTime
    ) {
      const due = pet.nextRewardAt;

      // Phải cho ăn và vệ sinh trong 24 giờ
      // tính tới thời điểm trả thưởng.
const fed =
  pet.lastFedAt <= due &&
  due - pet.lastFedAt <= SPIRIT_FEED;

const clean =
  pet.lastCleanAt <= due &&
  due - pet.lastCleanAt <= SPIRIT_CLEAN;


/* ==========================================
   SPIRIT BEAST - REWARD EVERY 8 HOURS
   90 CYCLES / 30 DAYS
   KEEP ORIGINAL TOTAL REWARD
========================================== */

if (fed && clean) {

  // Tổng thưởng theo chính sách cũ:
  // 30 ngày x thưởng mỗi ngày
  const maxTotalReward = kind.reward * 30;

  const nextCycle = pet.rewardCycles + 1;

  // Phân bổ nguyên kim cương cho 90 chu kỳ
  const previousTarget = Math.floor(
    maxTotalReward * pet.rewardCycles /
    SPIRIT_MAX_REWARDS
  );

  const currentTarget = Math.floor(
    maxTotalReward * nextCycle /
    SPIRIT_MAX_REWARDS
  );

  const plannedReward =
    currentTarget - previousTarget;

  // Không cho vượt tổng thưởng đã quy định
  const alreadyEarned = Math.max(
    0,
    Number(pet.totalEarned || 0)
  );

  const remainingBudget = Math.max(
    0,
    maxTotalReward - alreadyEarned
  );

  const rewardAmount = Math.max(
    0,
    Math.min(plannedReward, remainingBudget)
  );

  if (rewardAmount > 0) {
    earned += rewardAmount;

    pet.totalEarned =
      alreadyEarned + rewardAmount;
  }
}


      pet.rewardCycles++;
      pet.nextRewardAt += SPIRIT_DAY;
      changed = true;
    }

    if (now >= deathAt) {
      pet.dead = true;
      pet.diedAt = deathAt;
      changed = true;
    }
  }


/* ==========================================
   SPIRIT BEAST - AUTO REMOVE DEAD BEASTS
   RELEASE HABITAT SLOTS
========================================== */

// Remove deceased beasts from the active habitat.
// Rewards earned before death remain unchanged.

const originalCount = user.spiritBeasts.length;

user.spiritBeasts = user.spiritBeasts.filter(
  pet => pet && pet.dead !== true
);

const removedCount =
  originalCount - user.spiritBeasts.length;

if (removedCount > 0) {
  changed = true;

  console.log(
    `[SPIRIT] Removed ${removedCount} deceased beast(s).`
  );
}

// Preserve all earned diamonds.
if (earned > 0) {
  user.profile.coins =
    Number(user.profile.coins || 0) + earned;
}

return {
  changed,
  earned,
  removedCount
};

}

function spiritPublicState(user) {
  return {
    balance: Math.floor(Number(user.profile.coins || 0)),
    pets: user.spiritBeasts || [],
    types: SPIRIT_TYPES,
    serverTime: Date.now()
  };
}

app.get("/api/spirit/state", spiritAuth, (req, res) => {
  try {
    const db = loadUsers();
    const user = db[req.spiritUid];

    const result = spiritTickUser(user, Date.now());

    if (result.changed) {
      saveUsers(db);
      if (result.earned) emitCoinUpdate(req.spiritUid);
    }

    res.json({
      ok: true,
      ...spiritPublicState(user)
    });

  } catch (error) {
    console.error("[SPIRIT STATE]", error);
    res.status(500).json({
      ok: false,
      message: "Unable to load spirit beasts."
    });
  }
});

app.post("/api/spirit/buy", spiritAuth, (req, res) => {
  try {
    const type = String(req.body?.type || "");
    const kind = SPIRIT_TYPES[type];

    if (!kind) {
      return res.status(400).json({
        ok: false, message: "Invalid beast type."
      });
    }

    const db = loadUsers();
    const user = db[req.spiritUid];

  
const now = Date.now();

// Update rewards and remove deceased beasts.
const tickResult = spiritTickUser(user, now);

// Persist changes even if the purchase is rejected later.
if (tickResult.changed) {
  saveUsers(db);

  if (tickResult.earned > 0) {
    emitCoinUpdate(req.spiritUid);
  }
}

// The habitat now contains only living beasts.
const pets = user.spiritBeasts;


    if (pets.length >= SPIRIT_MAX) {
      return res.status(400).json({
        ok: false, message: "Your habitat is full."
      });
    }

    const balance = Number(user.profile.coins || 0);

    if (!Number.isSafeInteger(balance) ||
        balance < kind.price) {
      return res.status(400).json({
        ok: false, message: "Not enough diamonds."
      });
    }

    user.profile.coins = balance - kind.price;

    pets.push({
      id: crypto.randomUUID(),
      type,
      name: kind.name,
      level: 1,
      createdAt: now,
      lastFedAt: now,
      lastCleanAt: now,
      lastRestAt: now,

// Lần chăm sóc đầu tiên không cần chờ
careActions: {
  feed: 0,
  clean: 0,
  rest: 0
},

      nextRewardAt: now + SPIRIT_DAY,
      rewardCycles: 0,
      totalEarned: 0,
      dead: false,
      diedAt: null
    });

    saveUsers(db);
    emitCoinUpdate(req.spiritUid);

    res.json({
      ok: true,
      message: "Beast purchased successfully.",
      ...spiritPublicState(user)
    });

  } catch (error) {
    console.error("[SPIRIT BUY]", error);
    res.status(500).json({
      ok: false, message: "Purchase failed."
    });
  }
});




/* ==========================================
   SPIRIT BEAST - RELEASE BEAST API
   REMOVE OWNED BEAST / FREE HABITAT SLOT
========================================== */

app.post("/api/spirit/release", spiritAuth, (req, res) => {

  try {

    // Beast ID supplied by the client
    const id = String(req.body?.id || "");

    if (!id || id.length > 128) {
      return res.status(400).json({
        ok: false,
        message: "Invalid beast ID."
      });
    }

    // Get authenticated user from server session
    const uid = req.spiritUid;

    const db = loadUsers();
    const user = db[uid];

    if (!user || !user.profile) {
      return res.status(404).json({
        ok: false,
        message: "Account not found."
      });
    }

    const now = Date.now();

    // Process pending rewards and remove dead beasts
    const tickResult = spiritTickUser(user, now);

    const pets = user.spiritBeasts;

    // Find beast owned by this user
    const index = pets.findIndex(
      pet => pet && pet.id === id
    );

    if (index === -1) {

      if (tickResult.changed) {
        saveUsers(db);

        if (tickResult.earned > 0) {
          emitCoinUpdate(uid);
        }
      }

      return res.status(404).json({
        ok: false,
        message: "Spirit beast not found."
      });
    }

    // Remove ONLY the selected beast
    const [releasedBeast] = pets.splice(index, 1);

    // Save updated user data
    saveUsers(db);

    // Notify balance change only if pending rewards were added
    if (tickResult.earned > 0) {
      emitCoinUpdate(uid);
    }

    console.log(
      "[SPIRIT RELEASE]",
      uid,
      releasedBeast.type,
      releasedBeast.id
    );

    // Return updated state to client
    return res.json({
      ok: true,
      message: "Spirit beast released successfully.",
      ...spiritPublicState(user)
    });

  } catch (error) {

    console.error("[SPIRIT RELEASE]", error);

    return res.status(500).json({
      ok: false,
      message: "Unable to release spirit beast."
    });

  }

});



app.post("/api/spirit/care", spiritAuth, (req, res) => {
  try {
    const id = String(req.body?.id || "");
    const action = String(req.body?.action || "");

    if (!["feed", "clean", "rest"].includes(action)) {
      return res.status(400).json({
        ok: false, message: "Invalid care action."
      });
    }

    const db = loadUsers();
    const user = db[req.spiritUid];
    const now = Date.now();

    const result = spiritTickUser(user, now);
    const pet = user.spiritBeasts.find(p => p.id === id);

    if (!pet) {
      if (result.changed) saveUsers(db);
      if (result.earned) emitCoinUpdate(req.spiritUid);
      return res.status(404).json({
        ok: false, message: "Beast not found."
      });
    }

    if (pet.dead) {
      if (result.changed) saveUsers(db);
      if (result.earned) emitCoinUpdate(req.spiritUid);
      return res.status(400).json({
        ok: false,
        message: "This spirit beast has died."
      });
    }

    const field = {
      feed: "lastFedAt",
      clean: "lastCleanAt",
      rest: "lastRestAt"
    }[action];

    

/* ==========================================
   SPIRIT BEAST - CARE COOLDOWN V2
   First care is immediately available
========================================== */

if (!pet.careActions ||
    typeof pet.careActions !== "object") {
  pet.careActions = {};
}

const lastActionAt = Number(
  pet.careActions[action] || 0
);

const CARE_COOLDOWN = 60 * 60 * 1000;

const remaining =
  CARE_COOLDOWN - (now - lastActionAt);

if (lastActionAt > 0 && remaining > 0) {

  if (result.changed) saveUsers(db);
  if (result.earned) emitCoinUpdate(req.spiritUid);

  return res.status(400).json({
    ok: false,
    code: "CARE_COOLDOWN",
    remainingMs: remaining,

message:
  "Please wait another " +
  Math.ceil(remaining / 60000) +
  " minute(s) before caring for your beast again."

  });
}

// Ghi nhận thời gian thực hiện hành động
pet.careActions[action] = now;

// Cập nhật trạng thái chăm sóc
pet[field] = now;


    saveUsers(db);
    if (result.earned) emitCoinUpdate(req.spiritUid);

    res.json({
      ok: true,
      message: "Care completed.",
      ...spiritPublicState(user)
    });

  } catch (error) {
    console.error("[SPIRIT CARE]", error);
    res.status(500).json({
      ok: false, message: "Care action failed."
    });
  }
});

// Server kiểm tra thú offline mỗi 60 giây.
// Khởi động lại server vẫn tính đúng theo timestamp.

setInterval(() => {
  try {
    const db = loadUsers();
    let changed = false;
    const credited = [];

    for (const [uid, user] of Object.entries(db)) {
      if (!user?.profile ||
          !Array.isArray(user.spiritBeasts)) continue;

      const result = spiritTickUser(user, Date.now());

      if (result.changed) changed = true;
      if (result.earned) credited.push(uid);
    }

    if (changed) {
      saveUsers(db);

      for (const uid of credited) {
        emitCoinUpdate(uid);
      }
    }

  } catch (error) {
    console.error("[SPIRIT ENGINE]", error);
  }
}, 60000);





/* ==========================================
   LIVESTREAM PRO - VIRTUAL LIVE SYSTEM
========================================== */

// 1. Danh sách phòng ảo


const VIRTUAL_LIVE_ROOMS = Object.freeze({

  Youtube1: {
    roomId: "Youtube1",
    title: "CỎ DẠI VÀ HOA DÀNH DÀNH",
    avatar: "/assets/live-avatar/Youtube.jpg",
    type: "youtube",
    videoId: "Zb6zrxrHv14"
  },

  Youtube2: {
    roomId: "Youtube2",
    title: "50 NĂM VỀ SAU",
    avatar: "/assets/live-avatar/Youtube.jpg",
    type: "youtube",
    videoId: "k7YJHCR9JBE"
  },

});


/* ==========================================
   VIRTUAL LIVE - SHARED PLAYBACK CLOCK
========================================== */

// Mốc bắt đầu chung theo từng phòng.
// Dùng cùng một mốc sau khi server khởi động.

const virtualLiveStartTimes = new Map();

for (const [roomId, room] of Object.entries(
  VIRTUAL_LIVE_ROOMS
)) {

  if (room.sync && room.type === "mp4") {

    virtualLiveStartTimes.set(
      roomId,
      Date.now()
    );

  }

}



// 2. Socket.IO room name

function virtualLiveChannel(roomId) {
  return "virtual-live:" + roomId;
}


// 3. Đếm số kết nối thực đang trong phòng

function virtualLiveCounts() {

  const result = {};

  for (const roomId of Object.keys(VIRTUAL_LIVE_ROOMS)) {

    const channel = virtualLiveChannel(roomId);

    result[roomId] =
      io.sockets.adapter.rooms.get(channel)?.size || 0;

  }

  return result;

}


// 4. Gửi số người xem tới tất cả client

function broadcastVirtualLiveCounts() {

  io.emit(
    "virtual-live:counts",
    virtualLiveCounts()
  );

}


// 5. API lấy thông tin video

app.get("/api/virtual-live/rooms/:roomId", (req, res) => {

  const roomId = String(req.params.roomId || "");

  if (!Object.prototype.hasOwnProperty.call(
    VIRTUAL_LIVE_ROOMS,
    roomId
  )) {

    return res.status(404).json({
      error: "Room not found"
    });

  }

  res.set("Cache-Control", "no-store");

  
const room = VIRTUAL_LIVE_ROOMS[roomId];

res.json({

  ...room,

  serverNow: Date.now(),

  startedAt:
    virtualLiveStartTimes.get(roomId) || null

});


});


// 6. Socket.IO handlers

io.on("connection", socket => {

  // Lobby yêu cầu số người xem

  socket.on("virtual-live:get-counts", () => {

    socket.emit(
      "virtual-live:counts",
      virtualLiveCounts()
    );

  });


  // Người xem vào phòng ảo

  socket.on("virtual-live:join", (data = {}, callback) => {

    const roomId = String(data?.roomId || "");

    if (!Object.prototype.hasOwnProperty.call(
      VIRTUAL_LIVE_ROOMS,
      roomId
    )) {

      if (typeof callback === "function") {
        callback({
          ok: false,
          error: "Room not found"
        });
      }

      return;
    }

    // Rời phòng ảo cũ, nếu có

    for (const joined of socket.rooms) {

      if (joined.startsWith("virtual-live:")) {
        socket.leave(joined);
      }

    }

    // Vào phòng mới

    socket.join(virtualLiveChannel(roomId));

    if (typeof callback === "function") {
      callback({ ok: true });
    }

    broadcastVirtualLiveCounts();

  });


  // Người xem rời phòng

  socket.on("virtual-live:leave", () => {

    for (const joined of socket.rooms) {

      if (joined.startsWith("virtual-live:")) {
        socket.leave(joined);
      }

    }

    broadcastVirtualLiveCounts();

  });


  // Ngắt kết nối

  socket.on("disconnect", () => {

    broadcastVirtualLiveCounts();

  });

});



const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));


// ⏱ kiểm tra gian hết hạn mỗi 60 giây
setInterval(()=>{
  try{
    cleanupExpiredBooths();
  }catch(e){
    console.error("cleanupExpiredBooths error", e);
  }
}, 60 * 1000);





