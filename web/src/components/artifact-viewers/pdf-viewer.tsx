"use client";

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  url: string;
}

export function PdfViewer({ url }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [pdfReady, setPdfReady] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const pdfFileRef = useRef<{ data: Uint8Array } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(600);

  // Fetch PDF with auth header — store stable ref to avoid react-pdf re-render warning
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((buf) => {
        pdfFileRef.current = { data: new Uint8Array(buf) };
        setPdfReady(true);
      })
      .catch((err) => setFetchError(err.message));
  }, [url]);

  const onDocumentLoadSuccess = useCallback(
    ({ numPages: total }: { numPages: number }) => {
      setNumPages(total);
      setLoading(false);
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth - 32);
      }
    },
    []
  );

  const goToPrev = () => setPageNumber((p) => Math.max(1, p - 1));
  const goToNext = () => setPageNumber((p) => Math.min(numPages, p + 1));

  return (
    <div className="flex flex-col h-full" ref={containerRef}>
      {/* Navigation bar */}
      {numPages > 1 && (
        <div className="flex items-center justify-center gap-3 py-2 px-4 border-b border-border bg-card shrink-0">
          <button
            onClick={goToPrev}
            disabled={pageNumber <= 1}
            className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4 text-foreground" />
          </button>
          <span className="text-sm text-muted-foreground tabular-nums">
            {pageNumber} / {numPages}
          </span>
          <button
            onClick={goToNext}
            disabled={pageNumber >= numPages}
            className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4 text-foreground" />
          </button>
        </div>
      )}

      {/* PDF content */}
      <div className="flex-1 overflow-auto flex justify-center p-4 bg-background">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {fetchError && (
          <div className="text-sm text-red-400">Nepodařilo se načíst PDF: {fetchError}</div>
        )}
        {pdfReady && pdfFileRef.current && (
        <Document
          file={pdfFileRef.current}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={(error) => console.error("PDF load error:", error)}
          loading={null}
          className={cn(loading && "hidden")}
        >
          <Page
            pageNumber={pageNumber}
            width={containerWidth}
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
        )}
      </div>
    </div>
  );
}
