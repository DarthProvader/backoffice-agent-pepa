"use client";

import { useCallback, useRef, useState } from "react";

/** A single event in the assistant's response stream — mirrors Claude Code output */
export interface StreamEvent {
  id: string;
  type: "text" | "tool_use" | "tool_result" | "thinking" | "error";
  content: string;
  toolName?: string;
  timestamp: Date;
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
}

export function useWebSocket({ url }: UseWebSocketOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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

    const ws = new WebSocket(url);

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
        case "done": {
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
  }, [url, appendEvent]);

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
  }, []);

  return { messages, isConnected, isLoading, connect, sendMessage, clearMessages };
}
