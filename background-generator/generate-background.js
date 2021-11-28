const fs = require("fs");
const path = require("path");
const luxon = require("luxon");
const express = require("express");
const puppeteer = require("puppeteer-core");
const child_process = require("child_process");

(async function generateBackground() {
  /** Set the script to crash on unhandled promise rejections. */
  process.on("unhandledRejection", (error) => {
    throw error;
  });

  /** Kill the process if it is still active after approximately one minute. */
  const timeout = setTimeout(function () {
    throw new Error("Process timed out after one minute.");
  }, 60_000);

  /** Set constants. */
  const events = fs.existsSync(__dirname + "/events/events.js")
    ? require("./events/events.js")
    : require("./events/events.example.js");

  const bgPath = path.resolve(__dirname, "./generated-images/background.png");

  /** Create server Puppeteer will navigate to for the screenshot. */
  const app = express();

  app.set("view engine", "ejs");
  app.set("views", path.resolve(__dirname, "./views/"));
  app.use(express.static(path.resolve(__dirname, "./static/")));

  /** Create endpoint that will generate data and render the markup. */
  app.get("/", function (req, res) {
    const now = luxon.DateTime.now();

    const eventsWithDiff = events.map((event) => ({
      ...event,
      daysRemaining: ((daysDiff) => (daysDiff > 0 ? daysDiff : 0))(
        Math.ceil(luxon.DateTime.fromISO(event.date).diff(now).as("days"))
      ),
    }));

    res.render("template", { events: eventsWithDiff });
  });

  /** Wait for the server to start on a random available port. */
  const server = await new Promise(function (resolve) {
    const server = app.listen(0, function () {
      console.log(`Listening on http://localhost:${server.address().port}`);
      resolve(server);
    });
  });

  /** Set up Puppeteer, navigate to the server and generate a screenshot. */
  console.log("Launching Puppeteer");
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });

  console.log("Generating screenshot");
  const page = await browser.newPage();
  await page.goto(`http://localhost:${server.address().port}`);
  await page.setViewport({ width: 1920, height: 1080 });
  await page.screenshot({ path: bgPath, fullPage: true });
  await browser.close();

  /** Close the server. */
  console.log("Shutting down server");
  await new Promise(function (resolve) {
    server.close(() => resolve());
  });

  /** Clear the timeout to prevent Node from hanging. */
  clearTimeout(timeout);

  /** Exit the app. */
  process.exit(0);
})();
