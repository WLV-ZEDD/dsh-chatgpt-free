import { randomUUID } from "node:crypto";

export interface ParsedToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface StreamParseChunk {
  text: string;
  thinking: string;
  toolCalls: ParsedToolCall[];
}

const THINKING_OPEN = "<thinking>";
const THINKING_CLOSE = "</thinking>";
const TOOL_OPEN_TAGS = ["<tool_call>", "<tool\\_call>", "<toolcall>", "<tool-call>"] as const;
const TOOL_CLOSE_TAGS = ["</tool_call>", "</tool\\_call>", "</toolcall>", "</tool-call>"] as const;

function findEarliestTag(str: string, tags: readonly string[]): { tag: string; index: number } | null {
  let earliestTag: string | null = null;
  let earliestIdx = -1;
  for (const tag of tags) {
    const idx = str.indexOf(tag);
    if (idx !== -1 && (earliestIdx === -1 || idx < earliestIdx)) {
      earliestIdx = idx;
      earliestTag = tag;
    }
  }
  return earliestTag !== null ? { tag: earliestTag, index: earliestIdx } : null;
}

function findPartialTagPrefix(str: string, tag: string): number {
  for (let len = tag.length - 1; len >= 1; len--) {
    if (str.endsWith(tag.slice(0, len))) {
      return len;
    }
  }
  return 0;
}

function findMaxPartialPrefix(str: string, tags: readonly string[]): number {
  let max = 0;
  for (const tag of tags) {
    const len = findPartialTagPrefix(str, tag);
    if (len > max) max = len;
  }
  return max;
}

function normalizeToolArguments(
  toolName: string,
  args: Record<string, unknown>,
  userContext?: string,
): Record<string, unknown> {
  const normalized = { ...args };
  if (toolName === "write" || toolName === "read" || toolName === "edit") {
    if (typeof normalized.file_path !== "string" || !normalized.file_path.trim()) {
      const candidates = [
        normalized.path,
        normalized.filePath,
        normalized.filepath,
        normalized.file,
        normalized.filename,
        normalized.fileName,
        normalized.target_file,
        normalized.targetFile,
        normalized.dest,
        normalized.destination,
      ];
      for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim().length > 0) {
          normalized.file_path = candidate.trim();
          break;
        }
      }
    }

    // Fallback: If file_path is still missing, extract filename from justification, description, or user prompt context
    if (typeof normalized.file_path !== "string" || !normalized.file_path.trim()) {
      const searchContext = [
        typeof normalized.justification === "string" ? normalized.justification : "",
        typeof normalized.description === "string" ? normalized.description : "",
        userContext || "",
      ].filter(Boolean).join(" ");

      if (searchContext) {
        const cleaned = searchContext
          .replace(/https?:\/\/[^\s]+/g, "")
          .replace(/\b(?:AGENTS|CLAUDE)\.md\b/gi, "");
        const match = cleaned.match(/\b([a-zA-Z0-9_.\-\\/]+\.[a-zA-Z0-9]{1,10})\b/);
        if (match && match[1]) {
          normalized.file_path = match[1];
        }
      }
    }
    if (typeof normalized.file_path === "string") {
      normalized.file_path = normalized.file_path.replace(/\\([_*[\]])/g, "$1").trim();
    }
  }

  if (toolName === "write") {
    if (typeof normalized.content !== "string") {
      const contentCandidates = [
        normalized.text,
        normalized.data,
        normalized.body,
      ];
      for (const candidate of contentCandidates) {
        if (typeof candidate === "string") {
          normalized.content = candidate;
          break;
        }
      }
    }
    if (typeof normalized.content === "string") {
      let content = normalized.content;
      if (content.includes("\\n") && !content.includes("\n")) {
        content = content.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n");
      }
      normalized.content = content.replace(/\*\*([a-zA-Z0-9_]+)\*\*/g, "__$1__");
    }
  }

  if (toolName === "edit") {
    if (typeof normalized.old_string !== "string") {
      const oldCandidates = [
        normalized.old_str,
        normalized.oldStr,
        normalized.old_text,
        normalized.oldText,
        normalized["old-string"],
        normalized["old-str"],
        normalized.old,
        normalized.search,
        normalized.target,
        normalized.original,
        normalized.from,
        normalized.find,
      ];
      for (const candidate of oldCandidates) {
        if (typeof candidate === "string" && candidate.trim()) {
          normalized.old_string = candidate;
          break;
        }
      }
    }
    if (typeof normalized.new_string !== "string") {
      const newCandidates = [
        normalized.new_str,
        normalized.newStr,
        normalized.new_text,
        normalized.newText,
        normalized["new-string"],
        normalized["new-str"],
        normalized.new,
        normalized.replace,
        normalized.replacement,
        normalized.update,
        normalized.to,
      ];
      for (const candidate of newCandidates) {
        if (typeof candidate === "string" && candidate.trim()) {
          normalized.new_string = candidate;
          break;
        }
      }
    }

    if (
      (typeof normalized.old_string !== "string" || !normalized.old_string.trim())
      || (typeof normalized.new_string !== "string" || !normalized.new_string.trim())
    ) {
      const searchContext = [
        typeof normalized.justification === "string" ? normalized.justification : "",
        typeof normalized.description === "string" ? normalized.description : "",
        userContext || "",
      ].filter(Boolean).join(" ");

      if (searchContext) {
        const englishRegex = /(?:replace|change)\s+['"‘“]?([a-zA-Z0-9_.-]+)['"’”]?\s+(?:with|to|into)\s+['"‘“]?([a-zA-Z0-9_.-]+)['"’”]?/i;
        const match = searchContext.match(englishRegex);
        if (match && match[1] && match[2]) {
          if (!normalized.old_string) normalized.old_string = match[1];
          if (!normalized.new_string) normalized.new_string = match[2];
        }
      }
    }
    const oldStr = normalized.old_string;
    if (typeof oldStr === "string") {
      normalized.old_string = oldStr.replace(/\\([_*[\]])/g, "$1").replace(/\*\*([a-zA-Z0-9_]+)\*\*/g, "__$1__");
      if (normalized.replace_all === undefined && oldStr.trim().length <= 2) {
        normalized.replace_all = true;
      }
    }
    if (typeof normalized.new_string === "string") {
      normalized.new_string = normalized.new_string.replace(/\\([_*[\]])/g, "$1").replace(/\*\*([a-zA-Z0-9_]+)\*\*/g, "__$1__");
    }
  }

  if (toolName === "pwsh" || toolName === "bash") {
    if (typeof normalized.command !== "string" || !normalized.command.trim()) {
      const cmdCandidates = [
        normalized.cmd,
        normalized.script,
        normalized.code,
        normalized.exec,
      ];
      for (const candidate of cmdCandidates) {
        if (typeof candidate === "string" && candidate.trim().length > 0) {
          normalized.command = candidate.trim();
          break;
        }
      }
    }
    if (typeof normalized.command === "string") {
      normalized.command = normalized.command.replace(/\\([_*[\]])/g, "$1").trim();
    }
    // Auto-supply description if missing so DSH schema validation never rejects it
    if (typeof normalized.description !== "string" || !normalized.description.trim()) {
      const descCandidates = [
        normalized.desc,
        normalized.justification,
        normalized.explanation,
        normalized.reason,
      ];
      for (const candidate of descCandidates) {
        if (typeof candidate === "string" && candidate.trim().length > 0) {
          normalized.description = candidate.trim();
          break;
        }
      }
      if (typeof normalized.description !== "string" || !normalized.description.trim()) {
        normalized.description = typeof normalized.command === "string" && normalized.command.trim()
          ? `Run: ${normalized.command.trim().replace(/\s+/g, " ").slice(0, 60)}`
          : `Execute ${toolName} command`;
      }
    }
  }

  if (toolName === "glob") {
    if (typeof normalized.pattern !== "string" || !normalized.pattern.trim()) {
      const patternCandidates = [
        normalized.glob,
        normalized.query,
        normalized.path,
        normalized.search,
        normalized.filter,
      ];
      for (const candidate of patternCandidates) {
        if (typeof candidate === "string" && candidate.trim().length > 0) {
          normalized.pattern = candidate.trim();
          break;
        }
      }
      if (!normalized.pattern) {
        normalized.pattern = "**/*";
      }
    }
    if (typeof normalized.pattern === "string") {
      normalized.pattern = normalized.pattern.replace(/\\([_*[\]])/g, "$1");
    }
  }

  if (toolName === "grep") {
    const patternCandidates = [
      normalized.pattern,
      normalized.query,
      normalized.search,
      normalized.regex,
      normalized.text,
      normalized.find,
    ];
    for (const candidate of patternCandidates) {
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        normalized.pattern = candidate.trim();
        normalized.query = candidate.trim();
        break;
      }
    }
    if (!normalized.pattern) {
      normalized.pattern = "";
      normalized.query = "";
    }
    if (typeof normalized.pattern === "string") {
      normalized.pattern = normalized.pattern.replace(/\\([_*[\]])/g, "$1");
      normalized.query = normalized.pattern;
    }
  }

  if (toolName === "web_search") {
    if (!Array.isArray(normalized.queries)) {
      const q = normalized.query || normalized.q || normalized.search;
      if (typeof q === "string" && q.trim()) {
        normalized.queries = [q.trim()];
      }
    }
  }

  if (toolName === "web_fetch") {
    if (typeof normalized.url !== "string" || !normalized.url.trim()) {
      const urlCandidates = [normalized.link, normalized.href, normalized.uri, normalized.target];
      for (const candidate of urlCandidates) {
        if (typeof candidate === "string" && candidate.trim()) {
          normalized.url = candidate.trim();
          break;
        }
      }
    }
  }

  return normalized;
}

export class ChatGptToolStreamParser {
  private buffer = "";
  private mode: "text" | "thinking" | "tool_call" = "text";
  private currentTagContent = "";

  constructor(private readonly userContext?: string) {}

  /**
   * Process a text delta chunk from the browser Markdown feed.
   */
  feed(delta: string): StreamParseChunk {
    this.buffer += delta;
    let outputText = "";
    let outputThinking = "";
    const toolCalls: ParsedToolCall[] = [];

    while (this.buffer.length > 0) {
      if (this.mode === "text") {
        const thinkingIdx = this.buffer.indexOf(THINKING_OPEN);
        const toolTag = findEarliestTag(this.buffer, TOOL_OPEN_TAGS);

        let nextTag: string | null = null;
        let nextIdx = -1;
        let isThinking = false;

        if (thinkingIdx !== -1 && toolTag !== null) {
          if (thinkingIdx < toolTag.index) {
            nextTag = THINKING_OPEN;
            nextIdx = thinkingIdx;
            isThinking = true;
          } else {
            nextTag = toolTag.tag;
            nextIdx = toolTag.index;
          }
        } else if (thinkingIdx !== -1) {
          nextTag = THINKING_OPEN;
          nextIdx = thinkingIdx;
          isThinking = true;
        } else if (toolTag !== null) {
          nextTag = toolTag.tag;
          nextIdx = toolTag.index;
        }

        if (nextTag === null) {
          // Check for partial tag prefixes
          const partialThinking = findPartialTagPrefix(this.buffer, THINKING_OPEN);
          const partialTool = findMaxPartialPrefix(this.buffer, TOOL_OPEN_TAGS);
          const partialLen = Math.max(partialThinking, partialTool);

          if (partialLen > 0) {
            outputText += this.buffer.slice(0, this.buffer.length - partialLen);
            this.buffer = this.buffer.slice(this.buffer.length - partialLen);
            break;
          }

          outputText += this.buffer;
          this.buffer = "";
          break;
        } else {
          // Output text before the tag
          outputText += this.buffer.slice(0, nextIdx);
          this.buffer = this.buffer.slice(nextIdx + nextTag.length);
          this.mode = isThinking ? "thinking" : "tool_call";
          this.currentTagContent = "";
        }
      } else if (this.mode === "thinking") {
        const endIdx = this.buffer.indexOf(THINKING_CLOSE);
        if (endIdx === -1) {
          const partialEnd = findPartialTagPrefix(this.buffer, THINKING_CLOSE);
          if (partialEnd > 0) {
            outputThinking += this.buffer.slice(0, this.buffer.length - partialEnd);
            this.currentTagContent += this.buffer.slice(0, this.buffer.length - partialEnd);
            this.buffer = this.buffer.slice(this.buffer.length - partialEnd);
            break;
          }
          outputThinking += this.buffer;
          this.currentTagContent += this.buffer;
          this.buffer = "";
          break;
        } else {
          outputThinking += this.buffer.slice(0, endIdx);
          this.buffer = this.buffer.slice(endIdx + THINKING_CLOSE.length);
          this.mode = "text";
          this.currentTagContent = "";
        }
      } else if (this.mode === "tool_call") {
        const endTag = findEarliestTag(this.buffer, TOOL_CLOSE_TAGS);
        if (endTag === null) {
          const partialEnd = findMaxPartialPrefix(this.buffer, TOOL_CLOSE_TAGS);
          if (partialEnd > 0) {
            this.currentTagContent += this.buffer.slice(0, this.buffer.length - partialEnd);
            this.buffer = this.buffer.slice(this.buffer.length - partialEnd);
            break;
          }
          this.currentTagContent += this.buffer;
          this.buffer = "";
          break;
        } else {
          this.currentTagContent += this.buffer.slice(0, endTag.index);
          this.buffer = this.buffer.slice(endTag.index + endTag.tag.length);
          this.mode = "text";

          const parsedCall = this.parseToolCallJson(this.currentTagContent);
          if (parsedCall) {
            toolCalls.push(parsedCall);
          } else {
            outputText += `<tool_call>${this.currentTagContent}</tool_call>`;
          }
          this.currentTagContent = "";
        }
      }
    }

    return { text: outputText, thinking: outputThinking, toolCalls };
  }

  /**
   * Flush any remaining buffered content at end of stream.
   */
  flush(): StreamParseChunk {
    const remaining = this.buffer;
    this.buffer = "";
    let outputText = "";
    let outputThinking = "";
    const toolCalls: ParsedToolCall[] = [];

    if (this.mode === "thinking") {
      outputThinking = remaining;
      this.mode = "text";
    } else if (this.mode === "tool_call") {
      this.currentTagContent += remaining;
      const parsedCall = this.parseToolCallJson(this.currentTagContent);
      if (parsedCall) {
        toolCalls.push(parsedCall);
      } else {
        outputText = `<tool_call>${this.currentTagContent}`;
      }
      this.mode = "text";
      this.currentTagContent = "";
    } else {
      outputText = remaining;
    }

    return { text: outputText, thinking: outputThinking, toolCalls };
  }

  private parseToolCallJson(rawContent: string): ParsedToolCall | null {
    const raw = rawContent.trim();
    let cleaned = raw.replace(/^```(?:json|xml)?\s*/i, "").replace(/\s*```$/, "").trim();
    // Unescape markdown-escaped characters (e.g. math\_test.py -> math_test.py, \*.py -> *.py)
    cleaned = cleaned.replace(/\\([_*[\]])/g, "$1");
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed && typeof parsed === "object" && typeof parsed.name === "string") {
        const id = typeof parsed.id === "string" && parsed.id.trim()
          ? parsed.id.trim()
          : `call_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
        let args: Record<string, unknown> = {};
        if (parsed.arguments && typeof parsed.arguments === "object" && !Array.isArray(parsed.arguments)) {
          args = parsed.arguments as Record<string, unknown>;
        } else if (typeof parsed.parameters === "object" && parsed.parameters !== null && !Array.isArray(parsed.parameters)) {
          args = parsed.parameters as Record<string, unknown>;
        } else {
          args = { ...(parsed as Record<string, unknown>) };
          delete args.id;
          delete args.name;
        }
        const name = parsed.name.trim();
        const normalized = normalizeToolArguments(name, args, this.userContext);
        console.info(`[chatgpt-web] parseToolCallJson parsed tool=${name}, id=${id}, args=${JSON.stringify(normalized)}`);
        return {
          id,
          name,
          arguments: normalized,
        };
      }
    } catch {
      // Fallback to resilient regex parsing for unescaped quotes or invalid escapes
    }

    // Resilient fallback for unescaped quotes, Windows backslashes, etc.
    const nameMatch = cleaned.match(/"name"\s*:\s*"([^"]+)"/);
    if (nameMatch) {
      const name = nameMatch[1]!.trim();
      const idMatch = cleaned.match(/"id"\s*:\s*"([^"]+)"/);
      const id = idMatch && idMatch[1]!.trim()
        ? idMatch[1]!.trim()
        : `call_${randomUUID().replace(/-/g, "").slice(0, 16)}`;

      const argsMatch = cleaned.match(/"(?:arguments|parameters)"\s*:\s*\{([\s\S]*)\}\s*\}?$/);
      let args: Record<string, unknown> = {};
      if (argsMatch && argsMatch[1]) {
        args = this.extractRobustArguments(argsMatch[1]);
      } else {
        args = this.extractRobustArguments(cleaned);
        delete args.name;
        delete args.id;
      }
      const normalized = normalizeToolArguments(name, args, this.userContext);
      return { id, name, arguments: normalized };
    }

    // XML Tag format support (e.g. <name>write</name><file_path>hello.txt</file_path><content>...</content> or <invoke name="write">)
    const xmlNameMatch = cleaned.match(/<name>([\s\S]*?)<\/name>/i)
      || cleaned.match(/<tool_name>([\s\S]*?)<\/tool_name>/i)
      || cleaned.match(/<invoke\s+name=["']([^"']+)["']/i);
    if (xmlNameMatch) {
      const name = (xmlNameMatch[1] || "").trim();
      const id = `call_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
      const args: Record<string, unknown> = {};

      const tagRegex = /<([a-zA-Z0-9_-]+)>([\s\S]*?)<\/\1>/g;
      let tm: RegExpExecArray | null;
      while ((tm = tagRegex.exec(cleaned)) !== null) {
        const key = tm[1]!;
        if (key !== "name" && key !== "tool_name" && key !== "id") {
          args[key] = tm[2]!.trim();
        }
      }

      const paramRegex = /<parameter\s+name=["']([a-zA-Z0-9_-]+)["']>([\s\S]*?)<\/parameter>/gi;
      let pm: RegExpExecArray | null;
      while ((pm = paramRegex.exec(cleaned)) !== null) {
        args[pm[1]!] = pm[2]!.trim();
      }

      if (name) {
        const normalized = normalizeToolArguments(name, args, this.userContext);
        console.info(`[chatgpt-web] parseToolCallJson (xml) parsed tool=${name}, id=${id}, args=${JSON.stringify(normalized)}`);
        return { id, name, arguments: normalized };
      }
    }

    return null;
  }

  private extractRobustArguments(innerArgs: string): Record<string, unknown> {
    const trimmed = innerArgs.replace(/\}\s*$/, "").trim();
    const args: Record<string, unknown> = {};

    const keyRegex = /(?:^|,)\s*(?:"([a-zA-Z0-9_]+)"|([a-zA-Z0-9_]+))\s*:\s*/g;
    const matches: Array<{ key: string; valueStart: number; keyStart: number }> = [];
    let m: RegExpExecArray | null;
    while ((m = keyRegex.exec(trimmed)) !== null) {
      const key = m[1] || m[2];
      if (key) {
        matches.push({
          key,
          keyStart: m.index,
          valueStart: m.index + m[0].length,
        });
      }
    }

    if (matches.length === 0) return args;

    for (let i = 0; i < matches.length; i++) {
      const current = matches[i]!;
      const next = matches[i + 1];
      let rawValue = next
        ? trimmed.slice(current.valueStart, next.keyStart).trim()
        : trimmed.slice(current.valueStart).trim();

      rawValue = rawValue.replace(/,\s*$/, "").trim();

      if ((rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith("'") && rawValue.endsWith("'"))) {
        args[current.key] = rawValue.slice(1, -1);
      } else if (rawValue === "true") {
        args[current.key] = true;
      } else if (rawValue === "false") {
        args[current.key] = false;
      } else if (rawValue === "null") {
        args[current.key] = null;
      } else if (!Number.isNaN(Number(rawValue)) && rawValue !== "") {
        args[current.key] = Number(rawValue);
      } else {
        try {
          args[current.key] = JSON.parse(rawValue);
        } catch {
          args[current.key] = rawValue;
        }
      }
    }

    return args;
  }
}
