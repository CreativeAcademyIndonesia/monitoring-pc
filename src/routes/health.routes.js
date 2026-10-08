import { sendJson } from "../utils/response.js";

export function handleHealthRoute(req, res) {
  if (req.method !== "GET") {
    res.writeHead(405, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Method Not Allowed" }));
  }

  sendJson(res, 200, {
    status: "ok",
    service: "windows-monitor-agent"
  });
}
