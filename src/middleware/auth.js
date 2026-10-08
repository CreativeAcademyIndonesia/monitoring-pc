const { config } = require('../config/index.js');
const { sendError } = require('../utils/response.js');
const crypto = require('crypto');

function authMiddleware(req, res, next) {
  const authHeader = req.headers['api-key'] || req.headers['x-api-key'];
  if (!authHeader) {
    return sendError(res, 401, 'Missing api-key header');
  }

  const token = authHeader;
  
  if (!config.monitorToken) {
    return sendError(res, 500, 'Server configuration error: Token not set');
  }

  const expectedToken = Buffer.from(config.monitorToken);
  const providedToken = Buffer.from(token);

  if (expectedToken.length !== providedToken.length || !crypto.timingSafeEqual(expectedToken, providedToken)) {
    return sendError(res, 401, 'Invalid token');
  }

  next();
}

module.exports = { authMiddleware };
