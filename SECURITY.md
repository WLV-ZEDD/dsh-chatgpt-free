# Security policy

Do not open public issues containing ChatGPT cookies, browser storage, tunnel IDs, API keys,
DeepSeek Harness prompts, tool results, or local filesystem paths. Redact diagnostic bundles before sharing.

The daemon binds only to loopback. If another local user can access your account or application
home, treat the browser session and storage as compromised and rotate them.

The stable MCP v1 SDK currently declares the vulnerable `@hono/node-server` 1.x range even though
this project uses only its stdio transport. The lockfile explicitly resolves that unused HTTP
adapter to patched 2.0.12. `bun audit`, the MCP protocol test, and the compiled-binary smoke test are
release gates; remove the override when the stable SDK itself moves to the patched major.

Once the GitHub repository is public, use its private Security Advisory reporting flow. Until that
is enabled, do not publish a proof of concept that exposes credentials or arbitrary local tool
execution; contact the maintainer privately through the GitHub account listed by the repository.
