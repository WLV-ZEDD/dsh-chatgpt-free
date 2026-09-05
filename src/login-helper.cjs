const { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { dirname, join } = require("node:path");
const { chromium } = require("playwright-core");

const CHATGPT_TEMPORARY_CHAT_URL = "https://chatgpt.com/?temporary-chat=true";
const LOGIN_STORAGE_ROOT_DOMAINS = ["chatgpt.com", "openai.com"];

function allowedLoginStorageHost(rawHostname) {
  const hostname = rawHostname.toLowerCase();
  if (!/^[a-z0-9.-]+$/.test(hostname) || hostname.startsWith(".") || hostname.endsWith(".") || hostname.includes("..")) return false;
  return LOGIN_STORAGE_ROOT_DOMAINS.some(root => hostname === root || hostname.endsWith(`.${root}`));
}

function sanitizeBrowserLoginStorageState(storageState) {
  return {
    cookies: (storageState.cookies || [])
      .filter(cookie => !Object.prototype.hasOwnProperty.call(cookie, "partitionKey")
        && allowedLoginStorageHost((cookie.domain || "").replace(/^\.+/, "")))
      .map(cookie => ({ ...cookie })),
    origins: (storageState.origins || [])
      .filter(origin => origin.origin === "https://chatgpt.com")
      .map(origin => ({
        origin: origin.origin,
        localStorage: (origin.localStorage || []).map(item => ({ ...item })),
      })),
  };
}

async function isUserAuthenticated(context, page) {
  try {
    const cookies = await context.cookies();
    const hasAuthCookie = cookies.some(c =>
      c.name.includes("session-token") ||
      c.name.includes("__Secure-") ||
      (c.domain.includes("chatgpt.com") && c.name.includes("token"))
    );

    const hasLoginButton = await page.locator(
      'button:has-text("Log in"), a:has-text("Log in"), [data-testid="login-button"], button:has-text("Sign in")'
    ).first().isVisible().catch(() => false);

    const hasProfile = await page.locator(
      '[data-testid="profile-button"], [data-testid="accounts-profile-button"], [data-testid="user-menu"], button[aria-label*="Account"], button[aria-label*="profile" i]'
    ).first().isVisible().catch(() => false);

    const hasComposer = await page.locator(
      '[data-testid="prompt-textarea"], #prompt-textarea, [contenteditable="true"][data-lexical-editor="true"]'
    ).first().isVisible().catch(() => false);

    if ((hasAuthCookie || hasProfile) && !hasLoginButton && hasComposer) {
      return true;
    }
  } catch {}
  return false;
}

async function runLogin(config, options = {}) {
  if (!existsSync(config.chromeExecutablePath)) {
    throw new Error(`Google Chrome was not found at ${config.chromeExecutablePath}`);
  }
  const profileDir = mkdtempSync(join(tmpdir(), "dsh-login-profile-"));

  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath: config.chromeExecutablePath,
    headless: false,
    ignoreDefaultArgs: ["--enable-automation", "--password-store=basic", "--use-mock-keychain"],
    args: ["--disable-blink-features=AutomationControlled", "--no-first-run", "--no-default-browser-check"],
  });

  try {
    const page = context.pages()[0] || await context.newPage();
    try {
      await page.goto(CHATGPT_TEMPORARY_CHAT_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    } catch {
      // In case navigation redirects immediately (e.g. to login)
    }

    const deadline = Date.now() + (options.timeoutMs || 300000);
    let authenticatedPage;

    while (Date.now() < deadline) {
      for (const p of context.pages()) {
        if (await isUserAuthenticated(context, p)) {
          authenticatedPage = p;
          break;
        }
      }
      if (authenticatedPage) break;
      await new Promise(r => setTimeout(r, 1000));
    }

    if (!authenticatedPage) {
      throw new Error("ChatGPT login timed out after 5 minutes");
    }

    const rawState = await context.storageState();
    const sanitized = sanitizeBrowserLoginStorageState(rawState);

    const marker = {
      version: 1,
      authenticated: true,
      verifiedAt: new Date().toISOString(),
      solAvailable: false,
      proAvailable: false,
    };

    const markerPath = `${config.storageStatePath}.verified.json`;
    mkdirSync(dirname(config.storageStatePath), { recursive: true });
    writeFileSync(config.storageStatePath, `${JSON.stringify(sanitized, null, 2)}\n`, "utf8");
    writeFileSync(markerPath, `${JSON.stringify(marker, null, 2)}\n`, "utf8");

    return {
      storageStatePath: config.storageStatePath,
      accountSurfaceUrl: authenticatedPage.url(),
      solAvailable: false,
      proAvailable: false,
    };
  } finally {
    await context.close().catch(() => {});
    try {
      rmSync(profileDir, { recursive: true, force: true });
    } catch {}
  }
}

async function main() {
  const payloadRaw = process.argv[2];
  if (!payloadRaw) {
    throw new Error("Missing config payload");
  }
  const payload = JSON.parse(payloadRaw);
  const result = await runLogin(payload.config, payload.options);
  process.stdout.write(`__RESULT__:${JSON.stringify(result)}\n`);
}

main().catch(err => {
  process.stderr.write(`login-helper: ${err.message}\n`);
  process.exit(1);
});
