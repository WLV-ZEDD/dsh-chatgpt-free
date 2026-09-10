# dsh-chatgpt-web

[English](./README.md) | [中文](./README.zh-CN.md)

[![npm version](https://img.shields.io/npm/v/@wlv-zedd/dsh-chatgpt-web.svg?style=flat&color=3b82f6)](https://www.npmjs.com/package/@wlv-zedd/dsh-chatgpt-web)
[![dsh-market](https://img.shields.io/badge/dsh--market-available-c0392b?style=flat)](https://dshmarket.com/p/WLV-ZEDD/dsh-chatgpt-web/)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/WLV-ZEDD/dsh-chatgpt-web/blob/main/LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-Cordis%20Plugin-0078d4)](https://github.com/deepseek-ai/deepseek-harness)
[![Mode](https://img.shields.io/badge/Mode-Pure%20Chat%20%26%20Markdown-success)](https://github.com/WLV-ZEDD/dsh-chatgpt-web)

> **基于免费 ChatGPT Web（GPT 5.6 Luna）驱动的 DeepSeek Harness 零成本对话 AI 模型提供者。**

<p align="center">
  <img src="https://raw.githubusercontent.com/WLV-ZEDD/dsh-chatgpt-web/main/assets/promo-dshmarket-official.png?v=1.0.2" alt="dsh-chatgpt-web DSH Market 官方海报" width="100%">
</p>

![dsh-chatgpt-web 交互演示](https://raw.githubusercontent.com/WLV-ZEDD/dsh-chatgpt-web/main/assets/demo.gif?v=1.0.0)

---

## 概述

**dsh-chatgpt-web** 将你本地的 ChatGPT 浏览器会话转变为 DeepSeek Harness (DSH) 内部无缝运行的 **$0.00 免 API 费用的对话模型提供者**。

它通过无头（Headless）或可视 Chrome 浏览器自动化连接至 `chatgpt.com`，将实时的 Markdown 回答、代码方案、解释以及推理过程直接流式传输回 DSH 对话中，无需消耗任何 API 额度。

### 为什么选择纯对话模式（Pure Chat）？
轻量级对话网页模型（如 GPT 5.6 Luna）非常擅长解释、对话、问答、头脑风暴、代码片段生成以及侧边助手任务。通过运行在 **纯对话模式** 下，该桥接器消除了提示词开销、工具幻觉以及自主多工具循环中的语法错误，提供快速、稳定且零成本的 LLM 提供者。

### 核心功能
- **100% 完全免费（$0.00 成本）：** 使用你现有的免费 ChatGPT 网页会话，无需 OpenAI API Key 或信用卡。
- **Cordis 插件优先生命周期：** 由 DSH 通过 `ctx.effect` 无缝管理。DeepSeek Harness 在启动时自动拉起后台 Sidecar 进程，并在退出时安全关闭。
- **动态模型自动检测：** 自动检测你的 ChatGPT 账户等级：
  - **免费账户：** 默认为 `chatgpt-web/luna` (`gpt-5-6-luna`)。
  - **Plus / Team 账户：** 自动检测并暴露可用的付费模型（如 `gpt-4o`, `o1`）。
- **完整流式 Markdown 与代码块：** 实时向 DSH Web UI 或 CLI 投递生成的内容。

---

## 快速上手

### 1. 安装插件

在你的 DeepSeek Harness 环境或配置文件中安装 `@wlv-zedd/dsh-chatgpt-web`：

```bash
pnpm add @wlv-zedd/dsh-chatgpt-web
```

### 2. 一次性浏览器登录

进行一次性的 ChatGPT 账号登录验证：

```bash
npx @wlv-zedd/dsh-chatgpt-web login
```

系统将打开专用的 Chrome 窗口。登录你的 OpenAI / ChatGPT 账号。一旦看到 ChatGPT 输入框，浏览器会话凭证将安全保存在本地的 `~/.dsh/storages/chatgpt-web/` 目录中。

### 3. 在 DeepSeek Harness 中启用

将提供者配置添加到你的 `~/.dsh/settings.yaml` 中：

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

并在 profile 的 `cordis.patch.yml`（或 `cordis.yml`）中添加 Sidecar 插件：

```yaml
- insert:
    - id: dsh-chatgpt-web
      name: '@wlv-zedd/dsh-chatgpt-web'
```

现在启动 DeepSeek Harness：

```bash
pnpm dsh web
```

DSH 将自动启动后台 Sidecar 进程，连接已登录的 ChatGPT 会话并开始处理提问！

---

## 诊断与健康检查

随时使用内置的诊断工具检查环境配置：

```bash
npx @wlv-zedd/dsh-chatgpt-web doctor
```

正常输出示例：
```text
✓ Configuration is valid (~/.dsh/storages/chatgpt-web/config.json)
✓ Chrome executable found: C:\Program Files\Google\Chrome\Application\chrome.exe
✓ ChatGPT login state has authenticated browser evidence
✓ Responses proxy is healthy on 127.0.0.1:17841
Doctor result: ready
```

---

## 注意事项与使用限制

1. **非官方桥接：** 通过本地 Playwright 自动化驱动 `chatgpt.com` 网页。与 OpenAI 官方无隶属或背书关系。
2. **单会话并发：** 运行在单个浏览器标签页中。顺序查询和正常的 DSH 智能体对话完全顺畅；请避免同时对同一标签页发起多个高并发子智能体任务。
3. **纯对话支持：** 该提供者专注于纯对话回复、解释、推理以及代码块生成。不支持执行本地文件系统、终端命令或自主工具循环。
4. **免费额度频率限制：** 遵循 OpenAI 官方网页免费版的小时级调用频次限制。

---

## 支持与社区福利

[![Sponsor via PayPal](https://img.shields.io/badge/Sponsor-PayPal-0070ba?style=flat&logo=paypal&logoColor=white)](https://paypal.me/wlvzedd) 如果你觉得本插件对你有帮助，欢迎赞助支持。

[![Free AI Credits on AgentRouter](https://img.shields.io/badge/Free%20AI%20Credits-%24200-ff6b35?style=flat&logoColor=white)](https://agentrouter.org/register?aff=bIJf) GitHub 注册 AgentRouter 即可领取最高 **$200 免费额度**。

[![Free AI Credits on Vyce AI](https://img.shields.io/badge/Free%20AI%20Credits-%2450-7c3aed?style=flat&logoColor=white)](https://vyceai.com/signup?ref=VYCE_BL6YAG) 注册 Vyce AI 即可领取 **$50 免费额度**。

---

## 开源协议

MIT License © 2026 [WLV-ZEDD](https://github.com/WLV-ZEDD)。DeepSeek Harness 是 DeepSeek AI 的开源项目。
