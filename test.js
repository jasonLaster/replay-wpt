const { chromium, firefox } = require("playwright");
const fs = require("node:fs");
const { getExecutablePath } = require("@replayio/playwright");
const replay = require("@replayio/replay");
const _ = require("lodash");

const tests = fs.readFileSync("tests.txt", "utf-8").split("\n");
const host = "https://wpt.live/";

const env = process.env.CI
  ? {
      browser: chromium,
      executablePath: getExecutablePath("chromium"),
    }
  : {
      browser: firefox,
      executablePath: getExecutablePath("firefox"),
    };

console.log(`Executing`, env.executablePath);

async function runTest(url) {
  if (!url) {
    return;
  }

  let page, browser;
  try {
    console.log(`Running ${url}...`);
    browser = await env.browser
      .launch({
        headless: true,
        executablePath: env.executablePath,
        env: {
          ...process.env,
          RECORD_ALL_CONTENT: 1,
          RECORD_REPLAY_METADATA: JSON.stringify({
            title: url,
          }),
        },
      })
      .catch(() => {});
    page = await browser.newPage();
    await page.goto(`${host}${url}`).catch(() => {});
    await page
      .waitForSelector(".pass,.fail", { timeout: 10_000 })
      .catch(() => {});
  } catch (e) {
    console.log(url, e);
  } finally {
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function uploadRecordings() {
  const recs = await replay.listAllRecordings();
  for (const rec of recs) {
    if (rec.status == "onDisk") {
      await replay.addLocalRecordingMetadata(rec.id, {
        public: true,
      });
    }
  }

  await replay.uploadAllRecordings({
    apiKey: process.env.REPLAY_API_KEY,
    verbose: true,
    public: true,
  });
}

async function runTests(tests) {
  for (const url of tests) {
    try {
      await runTest(url);
    } catch (e) {
      console.log(e);
    }
  }

  try {
    await uploadRecordings();
  } catch (e) {
    console.log(e);
  }
}

process.on("uncaughtException", (error) => {
  // Handle the error here
  console.error("uncaught", error);
});

process.on("unhandledRejection", (reason, promise) => {
  // Handle the rejection here
  console.error("Unhandled rejection:", reason);
});

(async () => {
  if (process.env.CI) {
    for (const urls of _.chunk(tests, 10)) {
      try {
        await runTests(urls);
      } catch (e) {
        console.log(e);
      }
    }
  } else {
    await runTests(tests.slice(0, 3));
  }
})();
