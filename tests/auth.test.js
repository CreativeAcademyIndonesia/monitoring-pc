const test = require("node:test");
const assert = require("node:assert");
const { authMiddleware } = require("../src/middleware/auth.js");
const { config } = require("../src/config/index.js");

test("Authentication Middleware", async (t) => {
  // Set a test token
  config.monitorToken = "monitoring-token-332100185";

  await t.test("rejects missing authorization header", (t) => {
    let statusCode = 0;
    let responseData = "";
    const req = { headers: {} };
    const res = {
      writeHead: (code, headers) => { statusCode = code; },
      end: (data) => { responseData = data; }
    };
    
    authMiddleware(req, res, () => {
      assert.fail("Should not call next()");
    });

    assert.strictEqual(statusCode, 401);
    assert.match(responseData, /Missing api-key/);
  });

  await t.test("rejects invalid token", (t) => {
    let statusCode = 0;
    let responseData = "";
    const req = { headers: { "api-key": "wrong-token" } };
    const res = {
      writeHead: (code, headers) => { statusCode = code; },
      end: (data) => { responseData = data; }
    };
    
    authMiddleware(req, res, () => {
      assert.fail("Should not call next()");
    });

    assert.strictEqual(statusCode, 401);
    assert.match(responseData, /Invalid token/);
  });

  await t.test("accepts valid token", (t) => {
    let calledNext = false;
    const req = { headers: { "api-key": "monitoring-token-332100185" } };
    const res = {};
    
    authMiddleware(req, res, () => {
      calledNext = true;
    });

    assert.strictEqual(calledNext, true);
  });
});
