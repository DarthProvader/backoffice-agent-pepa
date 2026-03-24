"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/app-shell";
import { TaskList } from "@/components/dashboard/task-list";

export default function TasksPage() {
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
        <div className="px-6 pt-6 pb-2">
          <h1 className="text-lg font-semibold text-foreground">Naplánované úlohy</h1>
          <p className="text-sm text-muted-foreground">Správa opakovaných úloh a připomínek</p>
        </div>
        <div className="flex-1 overflow-auto px-6 py-4">
          <TaskList />
        </div>
      </div>
    </AppShell>
  );
}
