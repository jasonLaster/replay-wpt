const { chromium, firefox } = require("playwright");
const fs = require("node:fs");
const { getExecutablePath } = require("@replayio/playwright");

const tests = fs.readFileSync("tests.txt", "utf-8").split("\n");
const host = "https://wpt.live/";
const apiKey = "rwk_itTwNSTgH7LCdRJBiL76KLkSHN7nh0Y5mHvZQfVYxkk";

(async () => {
  for (const url of tests.slice(0, 10)) {
    const browser = await firefox.launch({
      headless: false,
      executablePath: getExecutablePath("firefox"),
      env: {
        ...process.env,
        RECORD_REPLAY_API_KEY: apiKey,
        RECORD_ALL_CONTENT: 1,
        RECORD_REPLAY_METADATA: JSON.stringify({
          title: url,
        }),
      },
    });
    try {
      const page = await browser.newPage();
      await page.goto(`${host}${url}`);

      await page.waitForSelector(".pass,.fail", { timeout: 10_000 });
    } catch (e) {
      console.log(url, e);
    } finally {
      await page.close();
      await browser.close();
    }
  }
})();
