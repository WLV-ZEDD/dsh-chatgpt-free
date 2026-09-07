# dsh-chatgpt-free

[English](https://github.com/WLV-ZEDD/dsh-chatgpt-free#readme) | [中文](https://github.com/WLV-ZEDD/dsh-chatgpt-free/blob/main/docs/README.zh-CN.md)

[![npm version](https://img.shields.io/npm/v/@wlv-zedd/dsh-chatgpt-free.svg?style=flat&color=3b82f6)](https://www.npmjs.com/package/@wlv-zedd/dsh-chatgpt-free)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/WLV-ZEDD/dsh-chatgpt-free/blob/main/LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-Cordis%20Plugin-0078d4)](https://github.com/deepseek-ai/deepseek-harness)
[![Mode](https://img.shields.io/badge/Mode-Pure%20Chat%20%26%20Markdown-success)](https://github.com/WLV-ZEDD/dsh-chatgpt-free)

> **Zero-cost conversational AI model provider for DeepSeek Harness powered by free ChatGPT Web (GPT 5.6 Luna).**

![dsh-chatgpt-free Interactive Demo](https://raw.githubusercontent.com/WLV-ZEDD/dsh-chatgpt-free/main/assets/demo.gif?v=1.0.2)

---

## Overview

**dsh-chatgpt-free** turns your local browser session of ChatGPT into a seamless, **$0.00 API-free conversational model provider** directly inside DeepSeek Harness (DSH).

It connects via headless or visible Chrome browser automation to `chatgpt.com`, streaming real-time Markdown responses, code solutions, explanations, and reasoning back to your DSH chats without consuming API credits.

### Why Pure Chat?
Small conversational web models (like GPT 5.6 Luna) excel at explanations, dialogue, Q&A, brainstorming, code snippet generation, and side-assistant tasks. By running in **Pure Chat Mode**, the bridge eliminates prompt overhead, tool hallucinations, and syntax errors of autonomous multi-tool execution loops, providing a fast, rock-solid, zero-cost LLM provider.

### Key Features
- **100% Free ($0.00 Cost):** Uses your existing free ChatGPT Web session. No OpenAI API keys or credit cards needed.
- **Cordis Plugin-First Lifecycle:** Seamlessly managed by DSH via `ctx.effect`. DeepSeek Harness starts the background sidecar automatically on launch and shuts it down on exit.
- **Dynamic Model Auto-Detection:** Automatically detects your ChatGPT tier:
  - **Free Accounts:** Defaults to `chatgpt-web/luna` (`gpt-5-6-luna`).
  - **Plus / Team Accounts:** Automatically detects and exposes available paid models (such as `gpt-4o`, `o1`).
- **Full Streaming Markdown & Code Blocks:** Delivers tokens in real time directly to the DSH Web UI or CLI.

---

## Quick Start

### 1. Installation

Install `@wlv-zedd/dsh-chatgpt-free` in your DeepSeek Harness environment or profile:

```bash
pnpm add @wlv-zedd/dsh-chatgpt-free
```

### 2. One-Time Browser Sign-In

Authenticate your ChatGPT account once:

```bash
npx @wlv-zedd/dsh-chatgpt-free login
```

A dedicated Chrome window will open. Log into your OpenAI / ChatGPT account. Once the ChatGPT composer is visible, the browser session is safely and securely saved locally to `~/.dsh/storages/chatgpt-free/`.

### 3. Enable in DeepSeek Harness

Add the provider to your `~/.dsh/settings.yaml`:

```yaml
providers:
  chatgpt-web:
    displayName: "ChatGPT Web (Free)"
    api: openai-responses
    baseURL: http://127.0.0.1:17841/v1
    headers:
      Authorization: "Bearer chatgpt-web-free"
    streamIdleTimeoutMs: 300000
    models:
      - id: chatgpt-web/luna
        name: "ChatGPT Web — Luna (Free)"
        contextWindow: 1050000
        maxTokens: 32768
        input:
          - text
          - image

agent-default-model:
  provider: chatgpt-web
  model: chatgpt-web/luna
```

And add the sidecar plugin to your profile's `cordis.patch.yml` (or `cordis.yml`):

```yaml
- insert:
    - id: dsh-chatgpt-free
      name: '@wlv-zedd/dsh-chatgpt-free'
```

Now start DeepSeek Harness:

```bash
pnpm dsh web
```

DSH will automatically start the background sidecar process, connect to your authenticated ChatGPT session, and accept prompts!

---

## Diagnostics & Health Check

Verify your setup at any time with the built-in diagnostic doctor:

```bash
npx @wlv-zedd/dsh-chatgpt-free doctor
```

Example healthy output:
```text
✓ Configuration is valid (~/.dsh/storages/chatgpt-free/config.json)
✓ Chrome executable found: C:\Program Files\Google\Chrome\Application\chrome.exe
✓ ChatGPT login state has authenticated browser evidence
✓ Responses proxy is healthy on 127.0.0.1:17841
Doctor result: ready
```

---

## Notes & Limitations

1. **Unofficial Bridge:** Operates via local Playwright browser automation on `chatgpt.com`. Not affiliated with or endorsed by OpenAI.
2. **Single-Session Concurrency:** Runs within a single browser tab. Sequential queries and normal DSH agent chats work seamlessly; avoid launching parallel multi-subagent swarms against the same tab simultaneously.
3. **Pure Chat Only:** This provider generates pure conversational responses, explanations, reasoning, and code blocks. It does not execute local filesystem, terminal, or autonomous tool loops.
4. **Standard Free Tier Rate Limits:** Subject to standard OpenAI free-tier hourly usage limits.

---

## Support & Community Perks

[![Sponsor via PayPal](https://img.shields.io/badge/Sponsor-PayPal-0070ba?style=flat&logo=paypal&logoColor=white)](https://paypal.me/wlvzedd) If you find this plugin helpful, consider sponsoring.

[![Free AI Credits on AgentRouter](https://img.shields.io/badge/Free%20AI%20Credits-%24200-ff6b35?style=flat&logoColor=white)](https://agentrouter.org/register?aff=bIJf) Claim up to **$200 free API credits** on AgentRouter via GitHub.

[![Free AI Credits on Vyce AI](https://img.shields.io/badge/Free%20AI%20Credits-%2450-7c3aed?style=flat&logoColor=white)](https://vyceai.com/signup?ref=VYCE_BL6YAG) Claim **$50 free API credits** on Vyce AI for fast LLM inference.

---

## License

MIT License © 2026 [WLV-ZEDD](https://github.com/WLV-ZEDD). DeepSeek Harness is an open-source project by DeepSeek AI.
