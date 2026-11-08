import "server-only";
import { existsSync } from "node:fs";
import type { Browser } from "puppeteer-core";

/** Local Chrome/Edge for development; Vercel uses @sparticuz/chromium. */
const LOCAL_BROWSERS = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean) as string[];

const g = globalThis as unknown as { __pdfBrowser?: Promise<Browser> };

async function launch(): Promise<Browser> {
  const puppeteer = await import("puppeteer-core");
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({
      executablePath: await chromium.executablePath(),
      args: chromium.args,
      headless: true,
    });
  }
  const executablePath = LOCAL_BROWSERS.find((p) => existsSync(p));
  if (!executablePath) {
    throw new Error(
      "No Chrome found for PDF export. Set CHROME_PATH to your Chrome or Edge executable.",
    );
  }
  return puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--font-render-hinting=none"],
  });
}

/** One browser per server instance, reused across exports; relaunched if it died. */
async function browser() {
  if (g.__pdfBrowser) {
    const b = await g.__pdfBrowser.catch(() => null);
    if (b?.connected) return b;
  }
  g.__pdfBrowser = launch();
  return g.__pdfBrowser;
}

export async function renderPdf(url: string): Promise<Uint8Array> {
  const b = await browser();
  const page = await b.newPage();
  try {
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: "load", timeout: 30_000 });
    await page.waitForSelector(".rz-page", { timeout: 20_000 });
    // Hide anything that isn't the resume (dev overlay, toasts, trial controls).
    await page.addStyleTag({
      content:
        "nextjs-portal, [data-sonner-toaster] { display: none !important; } html, body { background: #fff !important; }",
    });
    await page.evaluate(() => document.fonts.ready);
    return await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });
  } finally {
    await page.close().catch(() => {});
  }
}
