"use client";

import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface XlsxViewerProps {
  url: string;
}

interface SheetData {
  name: string;
  rows: string[][];
}

export function XlsxViewer({ url }: XlsxViewerProps) {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        // Fetch parsed JSON from server endpoint
        const jsonUrl = url.replace("/api/files/", "/api/files/preview/");
        const token = localStorage.getItem("auth_token");
        const response = await fetch(jsonUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) throw new Error("Failed to fetch preview");

        const data = await response.json();
        if (cancelled) return;

        setSheets(data.sheets || []);
        setActiveSheet(0);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load file");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [url]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-destructive text-sm">
        {error}
      </div>
    );
  }

  const current = sheets[activeSheet];
  if (!current) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Sheet tabs */}
      {sheets.length > 1 && (
        <div className="flex gap-0 border-b border-border shrink-0 overflow-x-auto">
          {sheets.map((sheet, i) => (
            <button
              key={sheet.name}
              onClick={() => setActiveSheet(i)}
              className={cn(
                "px-4 py-2 text-xs font-medium whitespace-nowrap transition-colors border-b-2",
                i === activeSheet
                  ? "border-accent text-foreground bg-muted"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs">
          {current.rows.length > 0 && (
            <thead className="sticky top-0 z-10">
              <tr>
                {current.rows[0].map((cell, ci) => (
                  <th
                    key={ci}
                    className="px-3 py-2 text-left font-medium text-foreground bg-muted border border-border whitespace-nowrap"
                  >
                    {String(cell)}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {current.rows.slice(1).map((row, ri) => (
              <tr key={ri} className="hover:bg-muted/30 transition-colors">
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className="px-3 py-1.5 text-muted-foreground border border-border whitespace-nowrap"
                  >
                    {String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
