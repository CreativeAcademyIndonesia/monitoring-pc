const { metricsService } = require('../services/metrics.service.js');
const { historyService } = require('../services/history.service.js');
const { sendJson, sendError } = require('../utils/response.js');

function handleCurrentMetrics(req, res) {
  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method Not Allowed');
  }

  const result = metricsService.getCurrentMetrics();
  
  if (result.error) {
    return sendError(res, result.status, result.error);
  }

  sendJson(res, 200, { data: result.data });
}

function handleHistoricalMetrics(req, res) {
  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method Not Allowed');
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const timeframe = url.searchParams.get('timeframe') || 'hour';

  const history = historyService.getHistory(timeframe);

  sendJson(res, 200, { data: history });
}

module.exports = { handleCurrentMetrics, handleHistoricalMetrics };
