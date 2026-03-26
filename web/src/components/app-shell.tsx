"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bot,
  MessageSquare,
  Database,
  Clock,
  FolderOpen,
  LogOut,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";

const navItems = [
  { label: "Chat", path: "/", icon: MessageSquare },
  { label: "Data", path: "/dashboard", icon: Database },
  { label: "Úlohy", path: "/dashboard/tasks", icon: Clock },
  { label: "Soubory", path: "/dashboard/files", icon: FolderOpen },
];

interface Conversation {
  id: string;
  summary: string;
  createdAt: string | null;
}

interface AppShellProps {
  children: React.ReactNode;
  onLoadConversation?: (id: string) => void;
  onNewConversation?: () => void;
  activeConversationId?: string | null;
  refreshKey?: number;
}

export function AppShell({ children, onLoadConversation, onNewConversation, activeConversationId, refreshKey }: AppShellProps) {
  const [mounted, setMounted] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchConversations = useCallback(() => {
    apiFetch<Conversation[]>("/api/conversations")
      .then(setConversations)
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchConversations();
    if (refreshKey && refreshKey > 0) {
      const timer = setTimeout(fetchConversations, 3000);
      return () => clearTimeout(timer);
    }
  }, [fetchConversations, refreshKey]);

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    const cleanPath = path.split("?")[0];
    if (cleanPath === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(cleanPath);
  };

  const formatRelativeDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d`;
  };

  if (!mounted) return null;

  return (
    <div className="flex h-screen">
      <aside className="flex flex-col h-screen w-[258px] bg-card border-r border-border shrink-0">
        {/* Header */}
        <div className="flex items-center px-4 gap-2 py-3">
          <Bot size={18} className="text-accent shrink-0" />
          <span className="text-sm font-semibold text-foreground">Pepa</span>
          <button
            onClick={logout}
            className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
            title="Odhlásit se"
          >
            <LogOut size={16} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="py-2 flex flex-col gap-0.5">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "relative flex items-center px-4 gap-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-accent rounded-r" />
                )}
                <item.icon size={18} className="shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Conversation history */}
        {conversations.length > 0 && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="px-4 py-2 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Historie</span>
              <button
                onClick={() => onNewConversation ? onNewConversation() : router.push("/")}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Nový chat"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {conversations.map((conv) => {
                const isActiveConv = activeConversationId === conv.id;
                return (
                  <button
                    key={conv.id}
                    onClick={() => {
                      // Always save to localStorage first so restore effect picks up the right ID
                      localStorage.setItem("active_conversation_id", conv.id);
                      localStorage.setItem("resume_session_id", conv.id);
                      if (onLoadConversation) {
                        onLoadConversation(conv.id);
                      } else {
                        router.push("/");
                      }
                    }}
                    className={cn(
                      "relative w-full text-left text-xs py-1.5 px-4 flex items-center gap-2 transition-colors",
                      isActiveConv
                        ? "text-foreground bg-muted"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                    )}
                  >
                    {isActiveConv && (
                      <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-accent rounded-r" />
                    )}
                    <span className="truncate flex-1">{conv.summary}</span>
                    <span className="text-[10px] text-muted-foreground/60 shrink-0">
                      {formatRelativeDate(conv.createdAt)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Spacer when no conversations */}
        {conversations.length === 0 && <div className="flex-1" />}

      </aside>

      <main className="flex-1 h-screen overflow-hidden">{children}</main>
    </div>
  );
}
