"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/app-shell";
import { StatsBar } from "@/components/dashboard/stats-bar";
import { DataTable } from "@/components/dashboard/data-table";

export default function DashboardDataPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
  }, [authLoading, isAuthenticated, router]);

  if (authLoading) {
    return <div className="h-screen flex items-center justify-center" />;
  }

  return (
    <AppShell>
      <div className="flex flex-col h-full overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          <StatsBar />
        </div>
        <div className="flex-1 overflow-auto px-6 pb-6">
          <DataTable />
        </div>
      </div>
    </AppShell>
  );
}
