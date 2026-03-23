"use client";

import React from "react";
import {
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  File,
  Presentation,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FileCardProps {
  filename: string;
  filetype: string;
  size: number;
  onClick: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(filetype: string) {
  switch (filetype) {
    case "pdf":
    case "docx":
      return FileText;
    case "xlsx":
    case "csv":
      return FileSpreadsheet;
    case "pptx":
      return Presentation;
    case "png":
    case "jpg":
    case "jpeg":
    case "svg":
      return ImageIcon;
    default:
      return File;
  }
}

function getFiletypeColor(filetype: string): string {
  switch (filetype) {
    case "pdf":
      return "bg-red-500/15 text-red-400";
    case "xlsx":
    case "csv":
      return "bg-green-500/15 text-green-400";
    case "docx":
      return "bg-blue-500/15 text-blue-400";
    case "pptx":
      return "bg-orange-500/15 text-orange-400";
    case "png":
    case "jpg":
    case "jpeg":
    case "svg":
      return "bg-purple-500/15 text-purple-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function FileCard({ filename, filetype, size, onClick }: FileCardProps) {
  const Icon = getFileIcon(filetype);

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full max-w-xs px-3 py-2.5 rounded-lg",
        "bg-card border border-border",
        "hover:border-ring hover:bg-muted/50",
        "transition-all duration-150 cursor-pointer text-left"
      )}
    >
      <div className="shrink-0 p-2 rounded-md bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {filename}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">
            {formatSize(size)}
          </span>
          <span
            className={cn(
              "text-[10px] font-medium uppercase px-1.5 py-0.5 rounded",
              getFiletypeColor(filetype)
            )}
          >
            {filetype}
          </span>
        </div>
      </div>
    </button>
  );
}
