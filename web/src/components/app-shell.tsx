"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_KEY = "sidebar_collapsed";

const navItems = [
  { label: "Chat", path: "/", icon: MessageSquare },
  { label: "Data", path: "/dashboard", icon: Database },
  { label: "Úlohy", path: "/dashboard/tasks", icon: Clock },
  { label: "Soubory", path: "/dashboard/files", icon: FolderOpen },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const { logout } = useAuth();

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setCollapsed(stored === "true");
    }
    setMounted(true);
  }, []);

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
    // Exact match for /dashboard (don't match /dashboard/tasks etc.)
    if (cleanPath === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(cleanPath);
  };

  if (!mounted) return null;

  return (
    <div className="flex h-screen">
      <aside
        className={cn(
          "flex flex-col h-screen bg-card border-r border-border transition-all duration-200",
          collapsed ? "w-14" : "w-55"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <button
            onClick={toggle}
            className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
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
        <nav className="flex-1 py-2 flex flex-col gap-0.5">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-muted border-l-2 border-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <item.icon size={18} className="shrink-0" />
                {!collapsed && (
                  <span className="truncate">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-border p-2">
          <button
            onClick={logout}
            title={collapsed ? "Odhlásit se" : undefined}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
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
