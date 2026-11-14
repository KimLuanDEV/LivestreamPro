const fs = require("fs");
const http = require("http");
const path = require("path");

const DATA_DIR = "/opt/render/project/data";
const USERS_FILE = path.join(DATA_DIR, "users.json");
const PORT = Number(process.env.PORT || 10000);

let recoveryError = null;

try {
  if (!fs.existsSync(USERS_FILE)) {
    throw new Error("users.json NOT FOUND");
  }

  const raw = fs.readFileSync(USERS_FILE, "utf8");

  JSON.parse(raw);

  console.log("[RECOVERY] JSON VALID");

} catch (err) {
  recoveryError = err;

  console.error("[RECOVERY] USER DATA ERROR:", err.message);
  console.error("[RECOVERY] DATA NOT MODIFIED");
}

if (!recoveryError) {
  require("./server.js");
} else {
  const maintenanceServer = http.createServer((req, res) => {
    const healthy = req.url === "/healthz";

    res.writeHead(healthy ? 200 : 503, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store"
    });

    res.end(
      healthy
        ? "Recovery service running"
        : "Maintenance mode"
    );
  });

  maintenanceServer.listen(PORT, "0.0.0.0", () => {
    console.log("[RECOVERY] Maintenance server started");
    console.log("[RECOVERY] Listening on port", PORT);
  });
}