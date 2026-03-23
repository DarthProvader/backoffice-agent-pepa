"use client";

import React from "react";

interface ImageViewerProps {
  url: string;
  filename: string;
}

export function ImageViewer({ url, filename }: ImageViewerProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={filename}
        className="max-w-full max-h-[calc(100%-2rem)] object-contain rounded-lg"
      />
      <span className="text-xs text-muted-foreground">{filename}</span>
    </div>
  );
}
