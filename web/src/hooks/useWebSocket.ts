"use client";

import { useCallback, useRef, useState } from "react";

/** A single event in the assistant's response stream — mirrors Claude Code output */
export interface StreamEvent {
  id: string;
  type: "text" | "tool_use" | "tool_result" | "thinking" | "error" | "artifact";
  content: string;
  toolName?: string;
  timestamp: Date;
}

export interface Artifact {
  filename: string;
  filetype: string;
  path: string;
  size: number;
  version: number; // timestamp — forces re-render when same file is updated
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  /** For user messages: the full text. For assistant: assembled from text events. */
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  /** Full event stream — tool calls, results, text chunks, etc. */
  events: StreamEvent[];
}

interface UseWebSocketOptions {
  url: string;
  token: string | null;
}

export function useWebSocket({ url, token }: UseWebSocketOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const currentAssistantId = useRef<string | null>(null);

  const appendEvent = useCallback(
    (event: StreamEvent, alsoAppendText?: boolean) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== currentAssistantId.current) return m;
          return {
            ...m,
            events: [...m.events, event],
            content: alsoAppendText ? m.content + event.content : m.content,
          };
        })
      );
    },
    []
  );

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (!token) return; // Don't connect without auth

    const wsUrl = `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => {
      setIsConnected(false);
      setTimeout(connect, 2000);
    };
    ws.onerror = () => ws.close();

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const now = new Date();

      switch (data.type) {
        case "text": {
          appendEvent(
            { id: crypto.randomUUID(), type: "text", content: data.content, timestamp: now },
            true
          );
          break;
        }
        case "tool_use": {
          appendEvent({
            id: crypto.randomUUID(),
            type: "tool_use",
            content: data.content,
            toolName: data.toolName,
            timestamp: now,
          });
          break;
        }
        case "tool_result": {
          appendEvent({
            id: crypto.randomUUID(),
            type: "tool_result",
            content: data.content,
            timestamp: now,
          });
          break;
        }
        case "thinking": {
          appendEvent({
            id: crypto.randomUUID(),
            type: "thinking",
            content: data.content,
            timestamp: now,
          });
          break;
        }
        case "artifact": {
          const artifact: Artifact = {
            filename: data.filename,
            filetype: data.filetype,
            path: data.path,
            size: data.size,
            version: Date.now(),
          };
          setActiveArtifact(artifact);
          appendEvent({
            id: crypto.randomUUID(),
            type: "artifact",
            content: JSON.stringify(artifact),
            timestamp: now,
          });
          break;
        }
        case "done": {
          // Mark ALL streaming messages as done (defensive)
          setMessages((prev) =>
            prev.map((m) =>
              m.isStreaming ? { ...m, isStreaming: false } : m
            )
          );
          setIsLoading(false);
          currentAssistantId.current = null;
          break;
        }
        case "error": {
          appendEvent(
            { id: crypto.randomUUID(), type: "error", content: data.content, timestamp: now },
            true
          );
          setMessages((prev) =>
            prev.map((m) =>
              m.id === currentAssistantId.current
                ? { ...m, isStreaming: false }
                : m
            )
          );
          setIsLoading(false);
          currentAssistantId.current = null;
          break;
        }
      }
    };

    wsRef.current = ws;
  }, [url, token, appendEvent]);

  const sendMessage = useCallback(
    (content: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: new Date(),
        events: [],
      };

      const assistantId = crypto.randomUUID();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
        events: [],
      };

      currentAssistantId.current = assistantId;
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsLoading(true);

      wsRef.current.send(JSON.stringify({ type: "chat", content }));
    },
    []
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    // Tell server to clear the session too
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "clear" }));
    }
  }, []);

  return { messages, isConnected, isLoading, activeArtifact, setActiveArtifact, connect, sendMessage, clearMessages };
}
