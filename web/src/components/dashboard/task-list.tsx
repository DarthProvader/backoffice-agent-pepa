"use client";

import { useEffect, useState, useCallback } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Play,
  Pause,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  CalendarClock,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  cronExpression: string;
  prompt: string;
  enabled: boolean;
  createdAt: string;
  lastRunAt?: string | null;
  lastRunStatus?: "success" | "error" | null;
}

interface TaskResult {
  taskId: string;
  taskName: string;
  timestamp: string;
  status: string;
  response: string;
}

interface TasksResponse {
  tasks: ScheduledTask[];
  recentResults: TaskResult[];
}

function cronToHuman(expr: string): string {
  const parts = expr.split(" ");
  if (parts.length !== 5) return expr;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  const timeStr = `${hour}:${minute.padStart(2, "0")}`;

  const monthNames: Record<string, string> = {
    "1": "ledna", "2": "února", "3": "března", "4": "dubna",
    "5": "května", "6": "června", "7": "července", "8": "srpna",
    "9": "září", "10": "října", "11": "listopadu", "12": "prosince",
  };

  const dayNames: Record<string, string> = {
    "0": "neděli", "1": "pondělí", "2": "úterý", "3": "středu",
    "4": "čtvrtek", "5": "pátek", "6": "sobotu", "7": "neděli",
  };

  // Every N minutes: */30 * * * *
  if (minute.startsWith("*/") && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return `Každých ${minute.slice(2)} minut`;
  }

  // Every N hours: 0 */6 * * *
  if (minute !== "*" && hour.startsWith("*/") && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return `Každé ${hour.slice(2)} hodiny v :${minute.padStart(2, "0")}`;
  }

  // Specific day + month: 0 8 25 3 * → "25. března v 8:00"
  if (dayOfMonth !== "*" && month !== "*" && dayOfWeek === "*") {
    const mName = monthNames[month] || `${month}.`;
    return `${dayOfMonth}. ${mName} v ${timeStr}`;
  }

  // Specific day of month, any month: 0 9 1 * * → "1. den v měsíci v 9:00"
  if (dayOfMonth !== "*" && month === "*" && dayOfWeek === "*") {
    return `${dayOfMonth}. den v měsíci v ${timeStr}`;
  }

  // Daily: 0 7 * * *
  if (dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return `Denně v ${timeStr}`;
  }

  // Weekdays: 0 9 * * 1-5
  if (dayOfMonth === "*" && month === "*" && dayOfWeek === "1-5") {
    return `Pracovní dny v ${timeStr}`;
  }

  // Specific day of week: 0 9 * * 1
  if (dayOfMonth === "*" && month === "*" && dayNames[dayOfWeek]) {
    return `Každé ${dayNames[dayOfWeek]} v ${timeStr}`;
  }

  return expr;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("cs-CZ", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export function TaskList() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [results, setResults] = useState<TaskResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScheduledTask | null>(null);

  const fetchTasks = useCallback(() => {
    apiFetch<TasksResponse>("/api/tasks")
      .then((data) => {
        setTasks(data.tasks);
        setResults(data.recentResults);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const toggleTask = async (task: ScheduledTask) => {
    try {
      await apiFetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !task.enabled }),
      });
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, enabled: !t.enabled } : t))
      );
    } catch (err) {
      // Silently fail - could add toast notification
    }
  };

  const confirmDeleteTask = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/api/tasks/${deleteTarget.id}`, { method: "DELETE" });
      setTasks((prev) => prev.filter((t) => t.id !== deleteTarget.id));
    } catch (err) {
      // Silently fail
    }
    setDeleteTarget(null);
  };

  const getLastResult = (taskId: string): TaskResult | undefined => {
    return results.find((r) => r.taskId === taskId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-[#888]">
        Načítání...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
        Nepodařilo se načíst úlohy: {error}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[#888]">
        <CalendarClock className="mb-3 h-8 w-8" />
        <span className="text-sm">Žádné naplánované úlohy</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => {
        const lastResult = getLastResult(task.id);

        return (
          <div
            key={task.id}
            className="rounded-lg border border-[#222] bg-[#0a0a0a] p-4"
          >
            {/* Top row: name + status badge */}
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="font-medium text-[#ededed]">{task.name}</span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
                  task.enabled
                    ? "bg-green-500/15 text-green-400"
                    : "bg-[#222] text-[#888]"
                )}
              >
                {task.enabled ? "Aktivní" : "Pozastaveno"}
              </span>
            </div>

            {/* Description */}
            {task.description && (
              <p className="mb-2 text-sm text-[#888]">{task.description}</p>
            )}

            {/* Cron + Last run */}
            <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#888]">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                {cronToHuman(task.cronExpression)}
              </span>
              <span className="flex items-center gap-1.5">
                {task.lastRunAt ? (
                  <>
                    {task.lastRunStatus === "success" ? (
                      <CheckCircle2 className="h-3 w-3 text-green-400" />
                    ) : task.lastRunStatus === "error" ? (
                      <XCircle className="h-3 w-3 text-red-400" />
                    ) : (
                      <Clock className="h-3 w-3" />
                    )}
                    {formatDate(task.lastRunAt)}
                  </>
                ) : (
                  "Zatím nespuštěno"
                )}
              </span>
            </div>

            {/* Last result preview */}
            {lastResult?.response && (
              <div className="mb-3 rounded-md bg-[#111] px-3 py-2 text-xs text-[#888]">
                {lastResult.response.length > 200
                  ? lastResult.response.slice(0, 200) + "\…"
                  : lastResult.response}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleTask(task)}
                title={task.enabled ? "Pozastavit" : "Spustit"}
              >
                {task.enabled ? (
                  <Pause className="h-3.5 w-3.5" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteTarget(task)}
                title="Smazat"
                className="text-red-400 hover:text-red-300 hover:border-red-500/30"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        );
      })}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Smazat úlohu"
        message={`Opravdu chceš smazat úlohu "${deleteTarget?.name}"?`}
        confirmLabel="Smazat"
        cancelLabel="Zrušit"
        onConfirm={confirmDeleteTask}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
