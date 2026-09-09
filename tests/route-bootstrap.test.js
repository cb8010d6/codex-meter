const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const run = (hash) => {
  const sandbox = {
    location: {
      origin: "https://chatgpt.com",
      pathname: "/",
      hash,
    },
    window: {},
  };
  vm.runInNewContext(
    fs.readFileSync(
      path.join(__dirname, "..", "codex-meter-extension", "route-bootstrap.js"),
      "utf8",
    ),
    sandbox,
  );
  return sandbox.window.__codexMeterInitialAnalyticsRoute;
};

assert.equal(run("#settings/Analytics"), true);
assert.equal(run("#settings/analytics/"), true);
assert.equal(run("#settings/DataControls"), false);
assert.equal(run("#settings"), false);

console.log("route bootstrap tests passed");
