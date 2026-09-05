import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface CordisContext {
  effect?: (cb: () => void | Promise<void> | (() => void) | (() => Promise<void>)) => void;
  logger?: (name: string) => {
    info(msg: string): void;
    warn(msg: string): void;
    error(msg: string): void;
    debug(msg: string): void;
  };
}

export const name = "dsh-chatgpt-free";
export const inject = [];

export interface ChatGPTWebPluginConfig {
  /** Host to bind or check for health (default: 127.0.0.1). */
  host?: string;
  /** Port the sidecar listens on (default: 17841). */
  port?: number;
  /** Automatically start the sidecar daemon if not running (default: true). */
  autoStart?: boolean;
  /** Maximum milliseconds to wait for the sidecar to report ready (default: 30000). */
  readyTimeoutMs?: number;
  /** Explicit path to the bun executable (optional). */
  bunPath?: string;
}

import { pathToFileURL } from "node:url";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function resolveLauncher(customBunPath?: string): { cmd: string; args: string[] } {
  const libCliPath = resolve(ROOT_DIR, "lib", "cli.js");
  if (existsSync(libCliPath)) {
    return {
      cmd: process.execPath,
      args: [libCliPath, "serve"],
    };
  }

  // Development fallback: check for bun or tsx
  if (customBunPath && existsSync(customBunPath)) {
    return { cmd: customBunPath, args: ["run", "src/cli.ts", "serve"] };
  }

  const winBun = join(homedir(), ".bun", "bin", "bun.exe");
  if (existsSync(winBun)) {
    return { cmd: winBun, args: ["run", "src/cli.ts", "serve"] };
  }

  const tsxPath = resolve(ROOT_DIR, "../deepseek-harness/node_modules/tsx/dist/esm/index.mjs");
  if (existsSync(tsxPath)) {
    return {
      cmd: process.execPath,
      args: ["--import", pathToFileURL(tsxPath).href, "src/cli.ts", "serve"],
    };
  }

  return { cmd: process.execPath, args: ["src/cli.ts", "serve"] };
}

async function isSidecarHealthy(host: string, port: number): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`http://${host}:${port}/healthz`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return false;
    const body = (await res.json()) as { status?: string };
    return body.status === "ok";
  } catch {
    return false;
  }
}

export function apply(ctx: CordisContext, config: ChatGPTWebPluginConfig = {}): void {
  const host = config.host || "127.0.0.1";
  const port = config.port || 17841;
  const autoStart = config.autoStart !== false;
  const readyTimeoutMs = config.readyTimeoutMs || 30_000;
  const logger = typeof ctx.logger === "function" ? ctx.logger("chatgpt-web") : console;

  let spawnedProcess: ChildProcess | undefined;

  const startDaemon = async () => {
    const alreadyHealthy = await isSidecarHealthy(host, port);
    if (alreadyHealthy) {
      logger.info(`[dsh-chatgpt-free] Sidecar already running and healthy at http://${host}:${port}/v1`);
      return;
    }

    if (!autoStart) {
      logger.warn(`[dsh-chatgpt-free] Sidecar is offline and autoStart is false. Start it manually with 'bun run src/cli.ts serve'`);
      return;
    }

    const launcher = resolveLauncher(config.bunPath);
    logger.info(`[dsh-chatgpt-free] Starting dsh-chatgpt-free daemon via ${launcher.cmd} at http://${host}:${port}/v1...`);

    const child = spawn(launcher.cmd, launcher.args, {
      cwd: ROOT_DIR,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      env: {
        ...process.env,
      },
    });

    spawnedProcess = child;

    child.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (text && typeof logger.debug === "function") logger.debug(`[sidecar] ${text}`);
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (text && typeof logger.debug === "function") logger.debug(`[sidecar:err] ${text}`);
    });

    child.on("error", (err) => {
      logger.error(`[dsh-chatgpt-free] Failed to launch sidecar process: ${err.message}`);
    });

    child.on("exit", (code, signal) => {
      if (code !== 0 && code !== null) {
        logger.warn(`[dsh-chatgpt-free] Sidecar process exited with code ${code} (signal: ${signal})`);
      }
      spawnedProcess = undefined;
    });

    // Wait for healthcheck
    const deadline = Date.now() + readyTimeoutMs;
    while (Date.now() < deadline) {
      if (await isSidecarHealthy(host, port)) {
        logger.info(`[dsh-chatgpt-free] Sidecar ready and accepting turns at http://${host}:${port}/v1`);
        return;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    logger.error(`[dsh-chatgpt-free] Sidecar did not become healthy within ${readyTimeoutMs}ms`);
  };

  const stopDaemon = async () => {
    if (!spawnedProcess) return;

    logger.info("[dsh-chatgpt-free] Stopping sidecar daemon...");
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      await fetch(`http://${host}:${port}/admin/shutdown`, {
        method: "POST",
        signal: controller.signal,
      }).catch(() => {});
      clearTimeout(timer);
    } catch {
      // ignore
    }

    if (spawnedProcess && !spawnedProcess.killed) {
      spawnedProcess.kill("SIGTERM");
    }
    spawnedProcess = undefined;
  };

  if (typeof ctx.effect === "function") {
    ctx.effect(() => {
      void startDaemon();
      return () => {
        void stopDaemon();
      };
    });
  } else {
    void startDaemon();
    process.once("beforeExit", () => void stopDaemon());
  }
}

export default {
  name,
  inject,
  apply,
};
