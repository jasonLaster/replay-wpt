const { chromium, firefox } = require("playwright");
const fs = require("node:fs");
const { getExecutablePath } = require("@replayio/playwright");
const replay = require("@replayio/replay");
const _ = require("lodash");

const tests = fs.readFileSync("tests.txt", "utf-8").split("\n").filter(Boolean);
const host = "https://wpt.live/";
const [currentStripe, totalStripes] = (process.env.STRIPE || "1/1").split('/').map(n => parseInt(n, 10));
const [,,pattern] = process.argv;

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

let counter = 1;
async function runTest(url) {
  if (!url) {
    return;
  }

  let start = new Date();

  let page, browser;
  try {
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
    console.log(
      `${counter++}. ${url} ${Math.round((new Date() - start) / 1000)}s`
    );
  } catch (e) {
    console.log(url, e);
  } finally {
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function uploadRecordings() {
  const recs = await replay.listAllRecordings();
  return Promise.all(
    recs.map(async (rec) => {
      if (rec.status == "onDisk") {
        await replay.addLocalRecordingMetadata(rec.id, {
          public: true,
        });

        await replay.uploadRecording(rec.id, {
          apiKey: process.env.REPLAY_API_KEY,
          verbose: true,
        });
      }
    })
  );
}

async function runTests(tests) {
  if (pattern) {
    tests = tests.filter(t => {
      return t.toLowerCase().includes(pattern.toLowerCase());
    });

    if (tests.length === 0) {
      console.error("No tests matched pattern");
      return;
    }
  }

  const testsPerStripe = Math.ceil(tests.length / totalStripes)
  const start = testsPerStripe * (currentStripe - 1);
  const testsToRun = tests.slice(start, Math.min(start + testsPerStripe, tests.length));
  try {
    await Promise.all(testsToRun.map(runTest));
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
    try {
      await runTests(tests);
    } catch (e) {
      console.log(e);
    }
  } else {
    await runTests(tests.slice(0, 3));
  }
})();
