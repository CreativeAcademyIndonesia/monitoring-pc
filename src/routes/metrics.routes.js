import { metricsService } from "../services/metrics.service.js";
import { historyService } from "../services/history.service.js";
import { sendJson, sendError } from "../utils/response.js";

export function handleCurrentMetrics(req, res) {
  if (req.method !== "GET") {
    return sendError(res, 405, "Method Not Allowed");
  }

  const result = metricsService.getCurrentMetrics();
  
  if (result.error) {
    return sendError(res, result.status, result.error);
  }

  sendJson(res, 200, { data: result.data });
}

export function handleHistoricalMetrics(req, res) {
  if (req.method !== "GET") {
    return sendError(res, 405, "Method Not Allowed");
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const timeframe = url.searchParams.get("timeframe") || "hour";

  const history = historyService.getHistory(timeframe);

  sendJson(res, 200, { data: history });
}
