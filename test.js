const { program } = require("commander");
const playwright = require("playwright");
const fs = require("node:fs");
const { getExecutablePath } = require("@replayio/playwright");
const _ = require("lodash");

const tests = fs.readFileSync("tests.txt", "utf-8").split("\n").filter(Boolean);
const host = "https://wpt.live/";
const [currentStripe, totalStripes] = (process.env.STRIPE || "1/1")
  .split("/")
  .map((n) => parseInt(n, 10));

program
  .option("-b, --browser [browser]", "Browser type", "chromium")
  .option(
    "-e, --executable-path [executablePath]",
    "Path to browser executable"
  )
  .argument("[pattern]")
  .action(async (pattern, opts) => {
    try {
      if (!opts.browser) {
        if (!opts.executablePath) {
          throw new Error("Either brower or executable path is required.");
        } else {
          opts.browser =
            opts.executablePath.includes("chrome") ||
            opts.executablePath.includes("chromium")
              ? "chromium"
              : "firefox";
        }
      } else {
        opts.executablePath =
          opts.executablePath || getExecutablePath(opts.browser);
      }

      console.log(`Executing`, opts.executablePath);

      await runTests(tests, { ...opts, pattern });
    } catch (e) {
      console.log(e);
    }
  });

program.parse(process.argv);

let counter = 1;
async function runTest(
  url,
  { browser: browserName = "chromium", executablePath } = {}
) {
  if (!url) {
    return;
  }

  console.log("Running", url, "with", browserName);
  let start = new Date();

  let page, browser;
  try {
    browser = await playwright[browserName]
      .launch({
        headless: true,
        executablePath,
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
    console.error("Error:", url, e);
  } finally {
    await page?.close().catch(() => {});
    await browser?.close().catch(() => {});
  }
}

async function runTests(tests, opts) {
  if (opts.pattern) {
    tests = tests.filter((t) => {
      return t.toLowerCase().includes(opts.pattern.toLowerCase());
    });

    if (tests.length === 0) {
      console.error("No tests matched pattern");
      return;
    }
  }

  const testsPerStripe = Math.ceil(tests.length / totalStripes);
  const start = testsPerStripe * (currentStripe - 1);
  const testsToRun = tests.slice(
    start,
    Math.min(start + testsPerStripe, tests.length)
  );
  try {
    console.log("Running", testsToRun.length, "tests");
    // console.log(testsToRun.map((t) => "  " + t).join("\n"));

    for (let i = 0; i < testsToRun.length; i++) {
      await runTest(testsToRun[i], opts);
    }
  } catch (e) {
    console.log(e);
  }
}

process.setMaxListeners(0);
process.on("uncaughtException", (error) => {
  // Handle the error here
  console.error("uncaught", error);
});

process.on("unhandledRejection", (reason, promise) => {
  // Handle the rejection here
  console.error("Unhandled rejection:", reason);
});
