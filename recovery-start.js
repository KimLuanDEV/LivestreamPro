const fs = require("fs");
const http = require("http");

const FILE = "/opt/render/project/data/users.json";
const PORT = Number(process.env.PORT || 10000);

try {
  if (!fs.existsSync(FILE)) {
    throw new Error("users.json is missing");
  }

  const raw = fs.readFileSync(FILE, "utf8");
  JSON.parse(raw);

  console.log("[RECOVERY] JSON VALID");
  require("./server.js");

} catch (err) {
  console.error("[RECOVERY] USER DATA ERROR:", err.message);
  console.error("[RECOVERY] DATA NOT MODIFIED");

  http.createServer((req, res) => {
    res.writeHead(503, {
      "Content-Type": "text/plain; charset=utf-8"
    });

    res.end("Maintenance mode: user data requires repair.");
  }).listen(PORT, "0.0.0.0", () => {
    console.log("[RECOVERY] Maintenance server started");
  });
}