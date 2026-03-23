"use client";

import React from "react";
import {
  X,
  Download,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  File,
  Presentation,
} from "lucide-react";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
const PdfViewer = dynamic(() => import("@/components/artifact-viewers/pdf-viewer").then(m => ({ default: m.PdfViewer })), { ssr: false });
const XlsxViewer = dynamic(() => import("@/components/artifact-viewers/xlsx-viewer").then(m => ({ default: m.XlsxViewer })), { ssr: false });
const DocxViewer = dynamic(() => import("@/components/artifact-viewers/docx-viewer").then(m => ({ default: m.DocxViewer })), { ssr: false });
const ImageViewer = dynamic(() => import("@/components/artifact-viewers/image-viewer").then(m => ({ default: m.ImageViewer })), { ssr: false });

interface ArtifactPanelProps {
  artifact: {
    filename: string;
    filetype: string;
    path: string;
    size: number;
  } | null;
  onClose: () => void;
  apiBase: string;
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

export function ArtifactPanel({
  artifact,
  onClose,
  apiBase,
}: ArtifactPanelProps) {
  if (!artifact) return null;

  const fileUrl = `${apiBase}/api/files/${artifact.filename}`;
  const Icon = getFileIcon(artifact.filetype);

  const handleDownload = async () => {
    try {
      const res = await fetch(fileUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = artifact.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: open in new tab
      window.open(fileUrl, "_blank");
    }
  };

  function renderViewer() {
    if (!artifact) return null;
    switch (artifact.filetype) {
      case "pdf":
        return <PdfViewer url={fileUrl} />;
      case "xlsx":
      case "csv":
        return <XlsxViewer url={fileUrl} />;
      case "docx":
        return <DocxViewer url={fileUrl} />;
      case "png":
      case "jpg":
      case "jpeg":
      case "svg":
        return <ImageViewer url={fileUrl} filename={artifact.filename} />;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
            <File className="h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              Náhled není dostupný pro tento typ souboru.
            </p>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              <Download className="h-4 w-4" />
              Stáhnout soubor
            </button>
          </div>
        );
    }
  }

  return (
    <div className="flex flex-col h-full border-l border-border bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {artifact.filename}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatSize(artifact.size)}
          </p>
        </div>
        <button
          onClick={handleDownload}
          className="p-1.5 rounded-md hover:bg-muted transition-colors"
          aria-label="Download file"
        >
          <Download className="h-4 w-4 text-muted-foreground" />
        </button>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-muted transition-colors"
          aria-label="Close panel"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden">{renderViewer()}</div>
    </div>
  );
}
