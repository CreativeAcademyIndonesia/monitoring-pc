import { config } from "../config/index.js";
import { sendError } from "../utils/response.js";
import crypto from "node:crypto";

export function authMiddleware(req, res, next) {
  const authHeader = req.headers["api-key"] || req.headers["x-api-key"];
  if (!authHeader) {
    return sendError(res, 401, "Missing api-key header");
  }

  const token = authHeader;
  
  if (!config.monitorToken) {
    return sendError(res, 500, "Server configuration error: Token not set");
  }

  // Use timing-safe equal to prevent timing attacks
  const expectedToken = Buffer.from(config.monitorToken);
  const providedToken = Buffer.from(token);

  if (expectedToken.length !== providedToken.length || !crypto.timingSafeEqual(expectedToken, providedToken)) {
    return sendError(res, 401, "Invalid token");
  }

  next();
}
