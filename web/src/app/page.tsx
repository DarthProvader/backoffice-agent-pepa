"use client";

import { useEffect, useRef } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { ChatMessageBubble } from "@/components/chat-message";
import { ChatInput } from "@/components/chat-input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Wifi, WifiOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001/ws";

const SUGGESTIONS = [
  "Jaké nové klienty máme za 1. kvartál?",
  "Vytvoř graf vývoje leadů za posledních 6 měsíců",
  "Které nemovitosti mají chybějící data o rekonstrukci?",
  "Shrň výsledky za poslední týden",
];

export default function Home() {
  const { messages, isConnected, isLoading, connect, sendMessage, clearMessages } =
    useWebSocket({ url: WS_URL });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    connect();
  }, [connect]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-accent/15 flex items-center justify-center">
            <Bot className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground">Pepa</h1>
            <p className="text-[11px] text-muted-foreground">
              Back Office Agent
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearMessages}
              className="text-muted-foreground hover:text-foreground h-7 px-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {isConnected ? (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Připojeno
              </>
            ) : (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-destructive" />
                Odpojeno
              </>
            )}
          </div>
        </div>
      </header>

      {/* Messages area */}
      <ScrollArea ref={scrollRef} className="flex-1 px-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-20">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-6">
              <Bot className="w-6 h-6 text-accent" />
            </div>
            <h2 className="text-lg font-semibold mb-1 text-foreground">
              Ahoj, jak ti mohu pomoci?
            </h2>
            <p className="text-sm text-muted-foreground mb-8 text-center max-w-md">
              Jsem tvůj back office asistent. Zeptej se mě na klienty, nemovitosti,
              leady, reporty nebo cokoliv dalšího.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  disabled={isLoading || !isConnected}
                  className="text-left text-sm px-4 py-3 rounded-lg border border-border
                    bg-card hover:bg-muted transition-colors disabled:opacity-50
                    cursor-pointer text-muted-foreground hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-2">
            {messages.map((msg) => (
              <ChatMessageBubble key={msg.id} message={msg} />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <ChatInput onSend={sendMessage} disabled={isLoading || !isConnected} />
    </div>
  );
}
