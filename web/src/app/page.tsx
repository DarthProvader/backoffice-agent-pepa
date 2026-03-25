"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/app-shell";
import { ChatMessageBubble } from "@/components/chat-message";
import { ChatInput } from "@/components/chat-input";
import { ArtifactPanel } from "@/components/artifact-panel";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Bot, Trash2, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001/ws";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3001";

const SUGGESTIONS = [
  "Jaké nové klienty máme za 1. kvartál? Odkud přišli? Můžeš to znázornit graficky?",
  "Vytvoř graf vývoje počtu leadů a prodaných nemovitostí za posledních 6 měsíců.",
  "Napiš e-mail pro zájemce o nemovitost a doporuč mu termín prohlídky na základě mé dostupnosti v kalendáři.",
  "Najdi nemovitosti, u kterých nám chybí data o rekonstrukci a připrav jejich seznam k doplnění.",
  "Shrň výsledky minulého týdne do krátkého reportu pro vedení a připrav k tomu prezentaci se třemi slidy.",
  "Sleduj všechny hlavní realitní servery a každé ráno mě informuj o nových nabídkách v lokalitě Praha Holešovice.",
];

function ChatContent({
  messages,
  isConnected,
  isLoading,
  sendMessage,
  clearMessages,
  stopGeneration,
  scrollRef,
  onArtifactClick,
}: {
  messages: ReturnType<typeof useWebSocket>["messages"];
  isConnected: boolean;
  isLoading: boolean;
  sendMessage: (s: string) => void;
  clearMessages: () => void;
  stopGeneration: () => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onArtifactClick: ReturnType<typeof useWebSocket>["setActiveArtifact"];
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Mini header — connection status + clear, matches sidebar header h-[41px] */}
      <div className="flex items-center justify-end px-4 h-[41px] border-b border-border gap-2">
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
              Jsem tvůj back office asistent. Zeptej se mě na klienty,
              nemovitosti, leady, reporty nebo cokoliv dalšího.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 w-full max-w-3xl">
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
          <div className="py-2 max-w-4xl mx-auto">
            {messages.map((msg) => (
              <ChatMessageBubble
                key={msg.id}
                message={msg}
                onArtifactClick={onArtifactClick}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <ChatInput onSend={sendMessage} onStop={stopGeneration} disabled={!isConnected} isLoading={isLoading} />
    </div>
  );
}

export default function Home() {
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const {
    messages,
    isConnected,
    isLoading,
    activeArtifact,
    setActiveArtifact,
    connect,
    sendMessage,
    clearMessages,
    loadConversation,
    newConversation,
    stopGeneration,
  } = useWebSocket({ url: WS_URL, token });
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (token) connect();
  }, [token, connect]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleLoadConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    setActiveArtifact(null);
    loadConversation(id);
  }, [loadConversation, setActiveArtifact]);

  const handleNewConversation = useCallback(() => {
    setActiveConversationId(null);
    setActiveArtifact(null);
    newConversation();
  }, [newConversation, setActiveArtifact]);

  if (authLoading) {
    return <div className="h-screen flex items-center justify-center" />;
  }

  const chatProps = {
    messages,
    isConnected,
    isLoading,
    sendMessage,
    clearMessages,
    stopGeneration,
    scrollRef,
    onArtifactClick: setActiveArtifact,
  };

  const shellProps = {
    onLoadConversation: handleLoadConversation,
    onNewConversation: handleNewConversation,
    activeConversationId,
    refreshKey: messages.length,
  };

  // Without artifact: normal layout
  if (!activeArtifact) {
    return (
      <AppShell {...shellProps}>
        <ChatContent {...chatProps} />
      </AppShell>
    );
  }

  // With artifact: split layout
  return (
    <AppShell {...shellProps}>
      <ResizablePanelGroup orientation="horizontal" className="h-full">
        <ResizablePanel defaultSize={50} minSize={30}>
          <ChatContent {...chatProps} />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={50} minSize={25}>
          <ArtifactPanel
            key={activeArtifact.version}
            artifact={activeArtifact}
            onClose={() => setActiveArtifact(null)}
            apiBase={API_BASE}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </AppShell>
  );
}
