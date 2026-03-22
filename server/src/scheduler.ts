import cron from "node-cron";
import fs from "fs";
import path from "path";
import { config } from "./utils/config.js";
import { handleMessage } from "./agent.js";

export interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  cronExpression: string;
  prompt: string;
  enabled: boolean;
  createdAt: string;
  lastRunAt?: string;
  lastRunStatus?: "success" | "error";
}

interface TaskResult {
  taskId: string;
  taskName: string;
  timestamp: string;
  status: "success" | "error";
  response: string;
}

const tasksFile = path.join(config.dataDir, "scheduled-tasks", "tasks.json");
const resultsDir = path.join(config.dataDir, "task-results");

// Active cron jobs keyed by task ID
const activeJobs = new Map<string, ReturnType<typeof cron.schedule>>();

// Callback for notifications (Telegram, etc.)
let onTaskComplete: ((result: TaskResult) => void) | null = null;

export function setTaskCompleteHandler(handler: (result: TaskResult) => void) {
  onTaskComplete = handler;
}

function ensureDirs() {
  fs.mkdirSync(path.dirname(tasksFile), { recursive: true });
  fs.mkdirSync(resultsDir, { recursive: true });
}

export function loadTasks(): ScheduledTask[] {
  ensureDirs();
  if (!fs.existsSync(tasksFile)) {
    fs.writeFileSync(tasksFile, "[]", "utf-8");
    return [];
  }
  return JSON.parse(fs.readFileSync(tasksFile, "utf-8"));
}

function saveTasks(tasks: ScheduledTask[]) {
  ensureDirs();
  fs.writeFileSync(tasksFile, JSON.stringify(tasks, null, 2), "utf-8");
}

function saveResult(result: TaskResult) {
  ensureDirs();
  const date = new Date().toISOString().slice(0, 10);
  const filename = `${result.taskId}_${date}.md`;
  const filepath = path.join(resultsDir, filename);

  const content = `# ${result.taskName}\n\n**Datum:** ${result.timestamp}\n**Status:** ${result.status}\n\n${result.response}\n`;
  fs.writeFileSync(filepath, content, "utf-8");
}

async function executeTask(task: ScheduledTask) {
  console.log(`[Scheduler] Running task: ${task.name} (${task.id})`);
  const startTime = new Date().toISOString();

  let response = "";
  let status: "success" | "error" = "success";

  try {
    response = await handleMessage(task.prompt, () => {
      // No streaming needed for scheduled tasks
    });
  } catch (error) {
    status = "error";
    response = error instanceof Error ? error.message : String(error);
  }

  // Update task metadata
  const tasks = loadTasks();
  const idx = tasks.findIndex((t) => t.id === task.id);
  if (idx !== -1) {
    tasks[idx].lastRunAt = startTime;
    tasks[idx].lastRunStatus = status;
    saveTasks(tasks);
  }

  const result: TaskResult = {
    taskId: task.id,
    taskName: task.name,
    timestamp: startTime,
    status,
    response,
  };

  saveResult(result);

  // Notify (Telegram, etc.)
  if (onTaskComplete) {
    onTaskComplete(result);
  }

  console.log(`[Scheduler] Task ${task.name} finished: ${status}`);
}

function scheduleTask(task: ScheduledTask) {
  if (activeJobs.has(task.id)) {
    activeJobs.get(task.id)!.stop();
  }

  if (!task.enabled) return;

  if (!cron.validate(task.cronExpression)) {
    console.error(`[Scheduler] Invalid cron expression for task ${task.name}: ${task.cronExpression}`);
    return;
  }

  const job = cron.schedule(task.cronExpression, () => {
    executeTask(task);
  });

  activeJobs.set(task.id, job);
  console.log(`[Scheduler] Scheduled: ${task.name} (${task.cronExpression})`);
}

export function startScheduler() {
  const tasks = loadTasks();
  console.log(`[Scheduler] Loading ${tasks.length} tasks`);

  for (const task of tasks) {
    scheduleTask(task);
  }

  // Watch tasks.json for changes (agent writes to it)
  fs.watchFile(tasksFile, { interval: 2000 }, () => {
    console.log("[Scheduler] tasks.json changed, reloading...");
    reloadTasks();
  });
}

function reloadTasks() {
  // Stop all existing jobs
  for (const job of activeJobs.values()) {
    job.stop();
  }
  activeJobs.clear();

  // Re-schedule
  const tasks = loadTasks();
  for (const task of tasks) {
    scheduleTask(task);
  }
}

export function getTaskResults(taskId?: string, limit = 10): TaskResult[] {
  ensureDirs();
  const files = fs.readdirSync(resultsDir)
    .filter((f) => f.endsWith(".md"))
    .filter((f) => !taskId || f.startsWith(taskId))
    .sort()
    .reverse()
    .slice(0, limit);

  return files.map((f) => {
    const content = fs.readFileSync(path.join(resultsDir, f), "utf-8");
    const [id] = f.replace(".md", "").split("_");
    return {
      taskId: id,
      taskName: content.match(/^# (.+)/m)?.[1] || "Unknown",
      timestamp: content.match(/\*\*Datum:\*\* (.+)/)?.[1] || "",
      status: (content.match(/\*\*Status:\*\* (.+)/)?.[1] || "error") as "success" | "error",
      response: content.replace(/^# .+\n\n\*\*Datum:\*\*.+\n\*\*Status:\*\*.+\n\n/, ""),
    };
  });
}

export function stopScheduler() {
  for (const job of activeJobs.values()) {
    job.stop();
  }
  activeJobs.clear();
  fs.unwatchFile(tasksFile);
  console.log("[Scheduler] Stopped");
}
