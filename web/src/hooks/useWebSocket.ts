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
  const conversationIdRef = useRef<string>(
    (typeof window !== "undefined" && localStorage.getItem("active_conversation_id")) || crypto.randomUUID()
  );
  // SDK session ID for resuming loaded conversations
  const resumeSessionIdRef = useRef<string | null>(
    (typeof window !== "undefined" && localStorage.getItem("resume_session_id")) || null
  );

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

      localStorage.setItem("active_conversation_id", conversationIdRef.current);
      wsRef.current.send(JSON.stringify({
        type: "chat",
        content,
        conversationId: conversationIdRef.current,
        resumeSessionId: resumeSessionIdRef.current || undefined,
      }));
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

  const loadConversation = useCallback(async (conversationId: string) => {
    // conversationId from /api/conversations IS the SDK session ID
    // Keep our own conversationIdRef but tell server to resume this SDK session
    resumeSessionIdRef.current = conversationId;
    localStorage.setItem("active_conversation_id", conversationId);
    localStorage.setItem("resume_session_id", conversationId);
    conversationIdRef.current = conversationId;
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3001";
    const authToken = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    try {
      const res = await fetch(`${API_BASE}/api/conversations/${conversationId}/messages`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Map server messages to ChatMessage format
      const loaded: ChatMessage[] = data.messages.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: new Date(m.timestamp),
        isStreaming: false,
        events: (m.events || []).map((e: any) => ({
          ...e,
          timestamp: new Date(e.timestamp),
        })),
      }));

      setMessages(loaded);
      setIsLoading(false);
      currentAssistantId.current = null;
    } catch (err) {
      console.error("Failed to load conversation:", err);
      // Clear all stale refs so next message starts fresh
      resumeSessionIdRef.current = null;
      localStorage.removeItem("resume_session_id");
      const freshId = crypto.randomUUID();
      conversationIdRef.current = freshId;
      localStorage.setItem("active_conversation_id", freshId);
    }
  }, []);

  const newConversation = useCallback(() => {
    setMessages([]);
    setActiveArtifact(null);
    currentAssistantId.current = null;
    // New conversation = new ID
    const newId = crypto.randomUUID();
    conversationIdRef.current = newId;
    resumeSessionIdRef.current = null;
    localStorage.setItem("active_conversation_id", newId);
    localStorage.removeItem("resume_session_id");
  }, []);

  const stopGeneration = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "stop" }));
    }
    // Mark current message as done, or remove if empty
    if (currentAssistantId.current) {
      const id = currentAssistantId.current;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== id) return m;
          // If message has no content/events, add a stopped indicator
          const hasContent = m.events.some((e) => e.type === "text" || e.type === "tool_use");
          // Add "stopped" results for any orphan tool_use without a following tool_result
          const patchedEvents = [...m.events];
          for (let i = 0; i < patchedEvents.length; i++) {
            if (patchedEvents[i].type === "tool_use") {
              const hasResult = i + 1 < patchedEvents.length && patchedEvents[i + 1].type === "tool_result";
              if (!hasResult) {
                patchedEvents.splice(i + 1, 0, {
                  id: crypto.randomUUID(),
                  type: "tool_result" as const,
                  content: "Zastaveno",
                  timestamp: new Date(),
                });
              }
            }
          }
          if (!hasContent) {
            return {
              ...m,
              isStreaming: false,
              events: [{ id: crypto.randomUUID(), type: "text" as const, content: "*Zastaveno.*", timestamp: new Date() }],
            };
          }
          return { ...m, isStreaming: false, events: patchedEvents };
        })
      );
    }
    setIsLoading(false);
    currentAssistantId.current = null;
  }, []);

  return {
    messages, isConnected, isLoading,
    activeArtifact, setActiveArtifact,
    connect, sendMessage, clearMessages,
    loadConversation, newConversation, stopGeneration,
  };
}
