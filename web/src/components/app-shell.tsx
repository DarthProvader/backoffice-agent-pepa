"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Bot,
  PanelLeftClose,
  PanelLeftOpen,
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

const STORAGE_KEY = "sidebar_collapsed";

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
}

export function AppShell({ children, onLoadConversation, onNewConversation, activeConversationId }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const pathname = usePathname();
  const { logout } = useAuth();

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setCollapsed(stored === "true");
    }
    setMounted(true);
  }, []);

  // Fetch conversations
  const fetchConversations = useCallback(() => {
    apiFetch<Conversation[]>("/api/conversations")
      .then(setConversations)
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

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

  const isOnChatPage = pathname === "/";

  return (
    <div className="flex h-screen">
      <aside
        className={cn(
          "flex flex-col h-screen bg-card border-r border-border transition-all duration-200 shrink-0",
          collapsed ? "w-14" : "w-[206px]"
        )}
      >
        {/* Header */}
        <div className={cn(
          "flex items-center",
          collapsed ? "justify-center py-3" : "px-4 gap-2 py-3"
        )}>
          <button
            onClick={toggle}
            className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
            title={collapsed ? "Rozbalit" : "Sbalit"}
          >
            {collapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
          </button>
          {!collapsed && (
            <div className="flex items-center gap-2 overflow-hidden">
              <Bot size={18} className="text-accent shrink-0" />
              <span className="text-sm font-semibold text-foreground truncate">
                Pepa
              </span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="py-2 flex flex-col gap-0.5">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "relative flex items-center py-2 text-sm transition-colors",
                  collapsed ? "justify-center" : "px-4 gap-3",
                  active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-accent rounded-r" />
                )}
                <item.icon size={18} className="shrink-0" />
                {!collapsed && (
                  <span className="truncate">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Conversation history — only show on chat page */}
        {isOnChatPage && onLoadConversation && (
          <div className="flex-1 overflow-hidden flex flex-col">
            {!collapsed && (
              <div className="px-4 py-2 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Historie</span>
                {onNewConversation && (
                  <button
                    onClick={onNewConversation}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Nový chat"
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>
            )}
            {collapsed && onNewConversation && (
              <div className="flex justify-center py-2">
                <button
                  onClick={onNewConversation}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Nový chat"
                >
                  <Plus size={16} />
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto">
              {conversations.map((conv) => {
                const isActiveConv = activeConversationId === conv.id;
                return (
                  <button
                    key={conv.id}
                    onClick={() => onLoadConversation(conv.id)}
                    title={collapsed ? conv.summary : undefined}
                    className={cn(
                      "relative w-full text-left text-xs py-1.5 transition-colors",
                      collapsed ? "flex justify-center" : "px-4 flex items-center gap-2",
                      isActiveConv
                        ? "text-foreground bg-muted"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                    )}
                  >
                    {isActiveConv && (
                      <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-accent rounded-r" />
                    )}
                    {collapsed ? (
                      <MessageSquare size={14} className={isActiveConv ? "text-accent" : ""} />
                    ) : (
                      <>
                        <span className="truncate flex-1">{conv.summary}</span>
                        <span className="text-[10px] text-muted-foreground/60 shrink-0">
                          {formatRelativeDate(conv.createdAt)}
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Spacer when not on chat page */}
        {(!isOnChatPage || !onLoadConversation) && <div className="flex-1" />}

        {/* Footer */}
        <div className={cn(
          "mt-auto pb-7",
          collapsed ? "flex justify-center" : "px-4"
        )}>
          <button
            onClick={logout}
            title={collapsed ? "Odhlásit se" : undefined}
            className={cn(
              "flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors",
              collapsed ? "justify-center" : "gap-3 w-full"
            )}
          >
            <LogOut size={18} className="shrink-0" />
            {!collapsed && <span>Odhlásit se</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 h-screen overflow-hidden">{children}</main>
    </div>
  );
}
