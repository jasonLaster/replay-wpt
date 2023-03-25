const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const replay = require("@replayio/replay");

const tests = fs.readFileSync("tests.txt", "utf-8").split("\n");
const host = "https://wpt.live/";

function runTest(url) {
  return test(url, async ({ page }) => {
    await page.goto(`${host}${url}`);
    await page.waitForSelector(".pass,.fail", { timeout: 10_000 });
  });
}

// (async () => {
//   for (const url of tests.slice(0, 3)) {
//     try {
//       await runTest(url);
//     } catch (e) {
//       console.error(e);
//     }
//   }
// })();

for (const url of tests.slice(0, 3)) {
  test(url, async ({ page }) => {
    await page.goto(`${host}${url}`);
    await page.waitForSelector(".pass,.fail", { timeout: 10_000 });
    // await replay.uploadAllRecordings({
    //   apiKey: process.env.REPLAY_API_KEY,
    //   verbose: true,
    // });
  });
}
