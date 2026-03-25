"use client";

import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  FileSpreadsheet,
  FileText,
  Image,
  Presentation,
  File,
  Download,
  Trash2,
  FolderOpen,
} from "lucide-react";
import { apiFetch, getFileUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";

interface FileEntry {
  name: string;
  size: number;
  type: string;
  createdAt: string;
}

function getFileIcon(type: string): LucideIcon {
  switch (type) {
    case "xlsx":
    case "xls":
    case "csv":
      return FileSpreadsheet;
    case "pdf":
    case "docx":
    case "doc":
    case "txt":
      return FileText;
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "webp":
    case "svg":
      return Image;
    case "pptx":
    case "ppt":
      return Presentation;
    default:
      return File;
  }
}

function getTypeBadgeClasses(type: string): string {
  switch (type) {
    case "pdf":
      return "bg-red-500/15 text-red-400";
    case "xlsx":
    case "xls":
      return "bg-green-500/15 text-green-400";
    case "docx":
    case "doc":
      return "bg-blue-500/15 text-blue-400";
    case "pptx":
    case "ppt":
      return "bg-orange-500/15 text-orange-400";
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "webp":
    case "svg":
      return "bg-purple-500/15 text-purple-400";
    case "csv":
      return "bg-teal-500/15 text-teal-400";
    default:
      return "bg-[#222] text-[#888]";
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("cs-CZ", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function FileList() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FileEntry | null>(null);

  useEffect(() => {
    apiFetch<FileEntry[]>("/api/files")
      .then(setFiles)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleDownload = async (file: FileEntry) => {
    try {
      const token = localStorage.getItem("auth_token");
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3001";
      const res = await fetch(`${API_BASE}/api/files/${encodeURIComponent(file.name)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Could surface error to user via toast
    }
  };

  const confirmDeleteFile = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/api/files/${encodeURIComponent(deleteTarget.name)}`, {
        method: "DELETE",
      });
      setFiles((prev) => prev.filter((f) => f.name !== deleteTarget.name));
    } catch {
      // Could surface error to user via toast
    }
    setDeleteTarget(null);
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
        Nepodařilo se načíst soubory: {error}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[#888]">
        <FolderOpen className="mb-3 h-8 w-8" />
        <span className="text-sm">Žádné vygenerované soubory</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {files.map((file) => {
        const Icon = getFileIcon(file.type);

        return (
          <div
            key={file.name}
            className="flex items-center gap-3 rounded-lg border border-[#222] bg-[#0a0a0a] p-3"
          >
            {/* File icon */}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#111]">
              <Icon className="h-4 w-4 text-[#888]" />
            </div>

            {/* File info */}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-[#ededed]">
                {file.name}
              </div>
              <div className="flex gap-2 text-xs text-[#888]">
                <span>{formatSize(file.size)}</span>
                <span>\·</span>
                <span>{formatDate(file.createdAt)}</span>
              </div>
            </div>

            {/* Type badge */}
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium uppercase",
                getTypeBadgeClasses(file.type)
              )}
            >
              {file.type}
            </span>

            {/* Actions */}
            <div className="flex shrink-0 gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDownload(file)}
                title="Stáhnout"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteTarget(file)}
                title="Smazat"
                className="text-red-400 hover:text-red-300"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        );
      })}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Smazat soubor"
        message={`Opravdu chceš smazat "${deleteTarget?.name}"?`}
        confirmLabel="Smazat"
        cancelLabel="Zrušit"
        onConfirm={confirmDeleteFile}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
