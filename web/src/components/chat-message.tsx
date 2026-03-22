"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { cn } from "@/lib/utils";
import type { ChatMessage, StreamEvent } from "@/hooks/useWebSocket";
import {
  Bot,
  User,
  Terminal,
  FileText,
  Search,
  Globe,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
  Pencil,
  Eye,
} from "lucide-react";

const TOOL_META: Record<string, { icon: typeof Terminal; label: string; color: string }> = {
  Bash: { icon: Terminal, label: "Bash", color: "text-green-400" },
  Read: { icon: Eye, label: "Read", color: "text-blue-400" },
  Write: { icon: FileText, label: "Write", color: "text-purple-400" },
  Edit: { icon: Pencil, label: "Edit", color: "text-yellow-400" },
  Glob: { icon: Search, label: "Glob", color: "text-cyan-400" },
  Grep: { icon: Search, label: "Grep", color: "text-cyan-400" },
  WebSearch: { icon: Globe, label: "WebSearch", color: "text-orange-400" },
  WebFetch: { icon: Globe, label: "WebFetch", color: "text-orange-400" },
  Skill: { icon: FileText, label: "Skill", color: "text-pink-400" },
};

function getToolMeta(name?: string) {
  if (!name) return { icon: Terminal, label: "Tool", color: "text-muted-foreground" };
  return TOOL_META[name] || { icon: Terminal, label: name, color: "text-muted-foreground" };
}

function truncate(s: string, max: number) {
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}

/** Parse tool_use input JSON to get a one-line summary */
function toolSummary(toolName: string | undefined, input: string): string {
  try {
    const parsed = JSON.parse(input);
    if (toolName === "Bash" && parsed.command) return parsed.command;
    if (toolName === "Read" && parsed.file_path) return parsed.file_path;
    if (toolName === "Write" && parsed.file_path) return parsed.file_path;
    if (toolName === "Edit" && parsed.file_path) return parsed.file_path;
    if (toolName === "Glob" && parsed.pattern) return parsed.pattern;
    if (toolName === "Grep" && parsed.pattern) return parsed.pattern;
    if (toolName === "WebFetch" && parsed.url) return parsed.url;
    if (toolName === "WebSearch" && parsed.query) return parsed.query;
    return truncate(input, 80);
  } catch {
    return truncate(input, 80);
  }
}

function ToolCallBlock({ event, result }: { event: StreamEvent; result?: StreamEvent }) {
  const [expanded, setExpanded] = useState(false);
  const meta = getToolMeta(event.toolName);
  const Icon = meta.icon;
  const summary = toolSummary(event.toolName, event.content);
  const isRunning = !result;

  return (
    <div className="my-2 rounded-lg border border-border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors cursor-pointer"
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        )}
        <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", meta.color)} />
        <span className={cn("text-xs font-medium", meta.color)}>{meta.label}</span>
        <span className="text-xs text-muted-foreground font-mono truncate flex-1">
          {truncate(summary, 60)}
        </span>
        {isRunning && (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-accent flex-shrink-0" />
        )}
        {result && (
          <span className="text-[10px] text-muted-foreground flex-shrink-0">done</span>
        )}
      </button>

      {expanded && (
        <div className="border-t border-border">
          {/* Input */}
          <div className="px-3 py-2 bg-muted/30">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Input</div>
            <pre className="text-xs text-foreground/80 whitespace-pre-wrap break-all font-mono !bg-transparent !border-0 !p-0">
              {summary}
            </pre>
          </div>
          {/* Output */}
          {result && (
            <div className="px-3 py-2 border-t border-border">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Output</div>
              <pre className="text-xs text-foreground/60 whitespace-pre-wrap break-all font-mono max-h-48 overflow-auto !bg-transparent !border-0 !p-0">
                {truncate(result.content, 2000)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AssistantMessage({ message }: { message: ChatMessage }) {
  // Group events: pair tool_use with following tool_result
  const blocks: Array<
    | { kind: "text"; content: string }
    | { kind: "tool"; call: StreamEvent; result?: StreamEvent }
    | { kind: "error"; content: string }
  > = [];

  let textBuffer = "";
  const events = message.events;

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (ev.type === "text") {
      textBuffer += ev.content;
    } else {
      // Flush text buffer
      if (textBuffer) {
        blocks.push({ kind: "text", content: textBuffer });
        textBuffer = "";
      }
      if (ev.type === "tool_use") {
        // Look ahead for matching result
        const nextResult =
          i + 1 < events.length && events[i + 1].type === "tool_result"
            ? events[i + 1]
            : undefined;
        blocks.push({ kind: "tool", call: ev, result: nextResult });
        if (nextResult) i++; // skip the result event
      } else if (ev.type === "tool_result") {
        // Orphan result (shouldn't happen normally) — show as tool block
        blocks.push({ kind: "tool", call: ev });
      } else if (ev.type === "error") {
        blocks.push({ kind: "error", content: ev.content });
      }
    }
  }
  // Final flush
  if (textBuffer) {
    blocks.push({ kind: "text", content: textBuffer });
  }

  const hasContent = blocks.length > 0;

  return (
    <div className="py-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Bot className="w-3.5 h-3.5 text-accent" />
        <span className="text-xs font-medium text-muted-foreground">Pepa</span>
      </div>
      <div className="min-w-0">
        {!hasContent && message.isStreaming && (
          <div className="flex items-center gap-2 text-muted-foreground py-1">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Přemýšlím...</span>
          </div>
        )}

        {blocks.map((block, i) => {
          if (block.kind === "text") {
            return (
              <div
                key={i}
                className="prose prose-sm prose-invert max-w-none
                  prose-p:my-1.5 prose-p:leading-relaxed
                  prose-headings:my-3 prose-headings:text-foreground
                  prose-ul:my-1 prose-ol:my-1 prose-li:my-0
                  prose-pre:my-2.5 prose-pre:bg-card prose-pre:border prose-pre:border-border
                  prose-a:text-accent prose-a:no-underline hover:prose-a:underline
                  prose-strong:text-foreground prose-strong:font-semibold
                  prose-code:text-foreground/90"
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                >
                  {block.content}
                </ReactMarkdown>
              </div>
            );
          }
          if (block.kind === "tool") {
            return <ToolCallBlock key={i} event={block.call} result={block.result} />;
          }
          if (block.kind === "error") {
            return (
              <div key={i} className="flex items-center gap-2 text-destructive text-sm my-2">
                <AlertCircle className="w-4 h-4" />
                {block.content}
              </div>
            );
          }
          return null;
        })}

        {/* Streaming cursor */}
        {message.isStreaming && hasContent && (
          <span className="inline-block w-1.5 h-4 bg-accent animate-pulse ml-0.5 align-text-bottom rounded-sm" />
        )}
      </div>
    </div>
  );
}

export function ChatMessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="py-3 flex justify-end">
        <div className="max-w-[75%] rounded-2xl bg-[#1a1a1a] border border-border px-4 py-2.5">
          <p className="text-sm whitespace-pre-wrap text-foreground">{message.content}</p>
        </div>
      </div>
    );
  }

  return <AssistantMessage message={message} />;
}
