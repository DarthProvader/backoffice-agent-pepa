"use client";

import { useEffect, useState } from "react";
import { Users, Building2, Target, HandCoins, Eye } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface DashboardStats {
  clients: number;
  properties: number;
  leads: number;
  sales: number;
  viewings: number;
}

interface StatCard {
  key: keyof DashboardStats;
  label: string;
  icon: LucideIcon;
}

const STAT_CARDS: StatCard[] = [
  { key: "clients", label: "Klienti", icon: Users },
  { key: "properties", label: "Nemovitosti", icon: Building2 },
  { key: "leads", label: "Leady", icon: Target },
  { key: "sales", label: "Prodeje", icon: HandCoins },
  { key: "viewings", label: "Prohl\ídky", icon: Eye },
];

export function StatsBar() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<DashboardStats>("/api/dashboard/stats")
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-1">
        {STAT_CARDS.map((card) => (
          <div
            key={card.key}
            className="min-w-[140px] rounded-lg border border-[#222] bg-[#0a0a0a] p-4 animate-pulse"
          >
            <div className="h-4 w-4 rounded bg-[#222] mb-2" />
            <div className="h-7 w-16 rounded bg-[#222] mb-1" />
            <div className="h-3 w-20 rounded bg-[#222]" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
        Nepoda\řilo se na\č\íst statistiky: {error}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-5 gap-4">
      {STAT_CARDS.map((card) => {
        const Icon = card.icon;
        const value = stats?.[card.key] ?? 0;

        return (
          <div
            key={card.key}
            className="rounded-lg border border-[#222] bg-[#0a0a0a] p-4"
          >
            <Icon className="mb-2 h-4 w-4 text-[#888]" />
            <div className="text-2xl font-bold text-[#ededed]">{value}</div>
            <div className="text-xs text-[#888]">{card.label}</div>
          </div>
        );
      })}
    </div>
  );
}
