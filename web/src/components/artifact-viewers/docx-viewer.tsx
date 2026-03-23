"use client";

import React, { useState, useEffect } from "react";
import mammoth from "mammoth";
import { Loader2 } from "lucide-react";

interface DocxViewerProps {
  url: string;
}

export function DocxViewer({ url }: DocxViewerProps) {
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch file");

        const buffer = await response.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer: buffer });

        if (!cancelled) {
          setHtml(result.value);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load file");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
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

  return (
    <div className="h-full overflow-auto p-6">
      <div
        className="docx-content prose prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: html }}
        style={{
          color: "var(--color-foreground)",
          lineHeight: 1.7,
        }}
      />
      <style jsx>{`
        .docx-content h1,
        .docx-content h2,
        .docx-content h3,
        .docx-content h4 {
          color: var(--color-foreground);
          margin-top: 1.5em;
          margin-bottom: 0.5em;
        }
        .docx-content h1 {
          font-size: 1.5rem;
          font-weight: 600;
        }
        .docx-content h2 {
          font-size: 1.25rem;
          font-weight: 600;
        }
        .docx-content h3 {
          font-size: 1.1rem;
          font-weight: 500;
        }
        .docx-content p {
          margin-bottom: 0.75em;
          color: var(--color-muted-foreground);
        }
        .docx-content table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
        }
        .docx-content th,
        .docx-content td {
          border: 1px solid var(--color-border);
          padding: 0.5rem 0.75rem;
          text-align: left;
        }
        .docx-content th {
          background: var(--color-muted);
          color: var(--color-foreground);
          font-weight: 500;
        }
        .docx-content td {
          color: var(--color-muted-foreground);
        }
        .docx-content ul,
        .docx-content ol {
          padding-left: 1.5em;
          margin-bottom: 0.75em;
          color: var(--color-muted-foreground);
        }
        .docx-content a {
          color: var(--color-accent);
          text-decoration: underline;
        }
        .docx-content img {
          max-width: 100%;
          border-radius: 0.5rem;
        }
      `}</style>
    </div>
  );
}
