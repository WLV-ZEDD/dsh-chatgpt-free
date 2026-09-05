# Contributing to dsh-chatgpt-free

Contributions to `dsh-chatgpt-free` are welcome! This plugin provides a zero-cost, browser-backed Pure Chat bridge connecting ChatGPT Web models directly into the DeepSeek Harness ecosystem.

## Guidelines

- Keep contributions small, focused, and well-tested.
- Isolated bug fixes, parser enhancements, and documentation improvements are preferred.
- Ensure all automated tests pass before submitting pull requests.

## Scope & Invariants

- **Pure Chat Focus**: The provider streams rich Markdown text, explanations, reasoning, and code blocks directly back to DeepSeek Harness without requiring or hallucinating external local tool schemas.
- **Privacy & Safety**: Never commit cookies, login states, browser user-data profiles, or raw session tokens.
- **Fail-Closed Behavior**: When ChatGPT DOM changes or connection drops occur, fail gracefully with descriptive error diagnostics rather than silent hanging.

## Development & Verification

1. Install dependencies:
   ```bash
   bun install
   ```
2. Run test suite:
   ```bash
   bun test
   ```
3. Verify TypeScript types:
   ```bash
   bun run typecheck
   ```
4. Build bundle:
   ```bash
   bun run build
   ```
