import { Router, Request, Response } from "express";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { config } from "../utils/config.js";
import { loadTasks, saveTasks, getTaskResults } from "../scheduler.js";

const router = Router();

// Allowed tables + their searchable text columns
const TABLE_SEARCH_COLUMNS: Record<string, string[]> = {
  clients: ["name", "email", "phone", "source", "status", "notes"],
  properties: ["address", "city", "district", "type", "disposition", "status", "description"],
  leads: ["status", "source", "notes"],
  sales: ["notes"],
  viewings: ["status", "feedback"],
  listing_snapshots: ["source", "title", "url", "district"],
};

const CZECH_COLUMN_LABELS: Record<string, string> = {
  id: "ID", name: "Jméno", email: "E-mail", phone: "Telefon",
  source: "Zdroj", status: "Stav", notes: "Poznámky",
  created_at: "Vytvořeno", updated_at: "Aktualizováno",
  address: "Adresa", city: "Město", district: "Čtvrť",
  type: "Typ", disposition: "Dispozice", area_m2: "Plocha m²",
  price: "Cena", renovation_status: "Rekonstrukce",
  building_modifications: "Stavební úpravy", energy_rating: "Energ. štítek",
  description: "Popis", listed_at: "V nabídce od", sold_at: "Prodáno",
  owner_id: "Vlastník ID", client_id: "Klient ID", property_id: "Nemovitost ID",
  converted_at: "Konvertováno", buyer_id: "Kupující ID", seller_id: "Prodávající ID",
  commission: "Provize", scheduled_at: "Naplánováno", feedback: "Zpětná vazba",
  external_id: "Externí ID", url: "URL", title: "Název",
  first_seen: "Poprvé viděno", last_seen: "Naposledy viděno", is_new: "Nový",
};

// Allowed file extensions for the files endpoint
const ALLOWED_FILE_EXTS = new Set([".xlsx", ".pdf", ".pptx", ".docx", ".png", ".jpg", ".jpeg", ".svg", ".csv"]);

function getDb() {
  const dbPath = path.join(config.dataDir, "backoffice.db");
  return new Database(dbPath, { readonly: true });
}

// GET /api/dashboard/tables/:table
router.get("/dashboard/tables/:table", (req: Request, res: Response) => {
  const table = req.params.table;
  if (!TABLE_SEARCH_COLUMNS[table]) {
    res.status(400).json({ error: `Neplatná tabulka: ${table}` });
    return;
  }

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 50));
  const search = (req.query.search as string || "").trim();

  try {
    const db = getDb();

    // Build WHERE clause for search
    let where = "";
    const params: string[] = [];
    if (search) {
      const searchCols = TABLE_SEARCH_COLUMNS[table];
      const conditions = searchCols.map((col) => `${col} LIKE ?`);
      where = `WHERE ${conditions.join(" OR ")}`;
      for (let i = 0; i < searchCols.length; i++) {
        params.push(`%${search}%`);
      }
    }

    // Get columns
    const columns = db.pragma(`table_info(${table})`) as Array<{ name: string }>;
    const columnNames = columns.map((c) => c.name);
    const columnLabels = columnNames.map((c) => CZECH_COLUMN_LABELS[c] || c);

    // Get total count
    const countRow = db.prepare(`SELECT count(*) as total FROM ${table} ${where}`).get(...params) as { total: number };

    // Get rows
    const offset = (page - 1) * pageSize;
    const rows = db.prepare(`SELECT * FROM ${table} ${where} LIMIT ? OFFSET ?`).all(...params, pageSize, offset);

    db.close();

    res.json({
      rows,
      columns: columnNames,
      columnLabels,
      total: countRow.total,
      page,
      pageSize,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// GET /api/dashboard/stats
router.get("/dashboard/stats", (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const stats = {
      clients: (db.prepare("SELECT count(*) as c FROM clients").get() as { c: number }).c,
      properties: (db.prepare("SELECT count(*) as c FROM properties").get() as { c: number }).c,
      leads: (db.prepare("SELECT count(*) as c FROM leads").get() as { c: number }).c,
      sales: (db.prepare("SELECT count(*) as c FROM sales").get() as { c: number }).c,
      viewings: (db.prepare("SELECT count(*) as c FROM viewings").get() as { c: number }).c,
    };
    db.close();
    res.json(stats);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// PATCH /api/tasks/:id — toggle enabled
router.patch("/tasks/:id", (req: Request, res: Response) => {
  const tasks = loadTasks();
  const idx = tasks.findIndex((t) => t.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: "Task nenalezen" });
    return;
  }

  tasks[idx].enabled = !tasks[idx].enabled;
  saveTasks(tasks);
  res.json(tasks[idx]);
});

// DELETE /api/tasks/:id
router.delete("/tasks/:id", (req: Request, res: Response) => {
  const tasks = loadTasks();
  const filtered = tasks.filter((t) => t.id !== req.params.id);
  if (filtered.length === tasks.length) {
    res.status(404).json({ error: "Task nenalezen" });
    return;
  }

  saveTasks(filtered);
  res.json({ ok: true });
});

// GET /api/files — list output files
router.get("/files", (_req: Request, res: Response) => {
  const outputsDir = path.join(config.dataDir, "outputs");
  try {
    if (!fs.existsSync(outputsDir)) {
      res.json([]);
      return;
    }

    const files = fs.readdirSync(outputsDir)
      .filter((f) => ALLOWED_FILE_EXTS.has(path.extname(f).toLowerCase()))
      .map((f) => {
        const stat = fs.statSync(path.join(outputsDir, f));
        return {
          name: f,
          size: stat.size,
          type: path.extname(f).slice(1).toLowerCase(),
          createdAt: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json(files);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// DELETE /api/files/:name
router.delete("/files/:name", (req: Request, res: Response) => {
  const filename = req.params.name;
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    res.status(400).json({ error: "Neplatný název souboru" });
    return;
  }

  const filepath = path.join(config.dataDir, "outputs", filename);
  if (!fs.existsSync(filepath)) {
    res.status(404).json({ error: "Soubor nenalezen" });
    return;
  }

  fs.unlinkSync(filepath);
  res.json({ ok: true });
});

export default router;
