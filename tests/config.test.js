const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const sandbox = {
  window: {
    location: {
      origin: "https://chatgpt.com",
      pathname: "/",
      hash: "",
    },
  },
};
vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, "..", "codex-meter-extension", "shared", "config.js"), "utf8"),
  sandbox,
);

const { isAnalyticsRoute } = sandbox.window.CodexMeterConfig;

assert.equal(
  isAnalyticsRoute({ origin: "https://chatgpt.com", pathname: "/codex/cloud/settings/analytics", hash: "" }),
  true,
);
assert.equal(
  isAnalyticsRoute({ origin: "https://chatgpt.com", pathname: "/", hash: "#settings/Analytics" }),
  true,
);
assert.equal(
  isAnalyticsRoute({ origin: "https://chatgpt.com", pathname: "/", hash: "#settings/analytics" }),
  true,
);
assert.equal(
  isAnalyticsRoute({ origin: "https://example.com", pathname: "/", hash: "#settings/Analytics" }),
  false,
);
assert.equal(
  isAnalyticsRoute({ origin: "https://chatgpt.com", pathname: "/", hash: "#settings/DataControls" }),
  false,
);

console.log("config tests passed");
