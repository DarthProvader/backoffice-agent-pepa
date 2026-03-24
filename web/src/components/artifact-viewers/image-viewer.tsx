"use client";

import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface ImageViewerProps {
  url: string;
  filename: string;
}

export function ImageViewer({ url, filename }: ImageViewerProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => res.blob())
      .then((blob) => setBlobUrl(URL.createObjectURL(blob)))
      .catch(() => {});
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [url]);

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 gap-3">
      {!blobUrl ? (
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={blobUrl}
            alt={filename}
            className="max-w-full max-h-[calc(100%-2rem)] object-contain rounded-lg"
          />
          <span className="text-xs text-muted-foreground">{filename}</span>
        </>
      )}
    </div>
  );
}
