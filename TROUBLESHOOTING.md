# Troubleshooting dsh-chatgpt-free

This guide covers common issues and resolutions when running `@wlv-zedd/dsh-chatgpt-free` in DeepSeek Harness.

## Quick Diagnostics

Before modifying configuration, run the built-in diagnostic doctor:

```bash
dsh-chatgpt-free doctor
```

This inspects:
- Chrome / Chromium executable availability
- ChatGPT web session authentication status
- Local sidecar background daemon health (`http://127.0.0.1:17841/healthz`)

---

## Common Issues & Solutions

### 1. `ChatGPT login state is missing or unverified`
**Cause:** No active ChatGPT session is saved in the local storage profile.
**Solution:**
Run the interactive browser login:
```bash
dsh-chatgpt-free login
```
A browser window will open. Log into your OpenAI / ChatGPT account (Free or Plus/Team). Once the ChatGPT composer loads, the session cookies are safely saved to `~/.dsh/storages/chatgpt-free/`.

---

### 2. `Port 17841 is already in use`
**Cause:** An existing instance of the daemon or another background task is occupying port 17841.
**Solution:**
Identify and terminate any lingering instance, or run `doctor` to see if the running service is already healthy. If you need a custom port, configure it via:
```bash
dsh-chatgpt-free serve --port 17842
```
or in `cordis.yml`:
```yaml
plugins:
  "@wlv-zedd/dsh-chatgpt-free":
    port: 17842
```

---

### 3. `Chrome executable is missing`
**Cause:** Google Chrome or Chromium could not be automatically located on the default system path.
**Solution:**
Specify your browser executable path explicitly:
```bash
dsh-chatgpt-free setup --browser-executable "C:\Program Files\Google\Chrome\Application\chrome.exe"
```

---

### 4. Temporary Rate Limits or Cloudflare Verification
**Cause:** High frequency of requests in a short time frame or ChatGPT anti-bot challenge.
**Solution:**
- Wait a couple of minutes for Cloudflare challenges to settle.
- Run `dsh-chatgpt-free login` to solve any visual verification prompt directly in the visible browser if required.

### 5. Stream Disconnected or Browser Response Interrupted
**Cause:** ChatGPT web page refreshed, network connection dropped, or the Chrome browser process was closed.
**Solution:**
- Check that your internet connection is active and `chatgpt.com` is accessible.
- Verify that Chrome is open and logged in.
- Run `npx @wlv-zedd/dsh-chatgpt-free doctor` to check proxy and session status.
- Restart the daemon if needed: `npx @wlv-zedd/dsh-chatgpt-free serve`.

### 6. ChatGPT Rate Limits (HTTP 429)
**Cause:** Hourly prompt limit reached on the ChatGPT Free tier.
**Solution:**
- OpenAI Free accounts have hourly message limits for GPT 5.6 Luna.
- Wait for the rate-limit window to reset (typically 1–2 hours).
- Avoid spawning parallel multi-subagent requests against a single ChatGPT browser tab.

## Update and Uninstall

To update `dsh-chatgpt-free`, pull the latest changes and rebuild:
```bash
bun install
bun run build
```

To remove or disable `dsh-chatgpt-free` in DeepSeek Harness:
1. Remove `@wlv-zedd/dsh-chatgpt-free` from your profile's `cordis.patch.yml` or `cordis.yml`.
2. Delete saved browser session data if desired:
   - On Windows: `%USERPROFILE%\.dsh\storages\chatgpt-free\`
   - On macOS/Linux: `~/.dsh/storages/chatgpt-free/`

## Submitting Bug Reports

When opening an issue or bug report on GitHub:
- Specify your OS and architecture (e.g., Windows 11 x64, macOS arm64, Linux x64).
- ChatGPT account tier (Free Tier Luna or Plus/Team).
- Node.js and Bun versions.
- Output from `npx @wlv-zedd/dsh-chatgpt-free doctor`.
- Clear reproduction steps and console error traces.

Before sharing logs or screenshots, ensure all personal session cookies, authentication tokens, and private prompts are redacted.

