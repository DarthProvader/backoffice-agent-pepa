"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUp, Square } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
}

export function ChatInput({ onSend, onStop, disabled, isLoading }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  };

  return (
    <div className="p-4 border-t border-border">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="Napiš zprávu..."
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-lg border border-border bg-card px-4 py-3
            text-sm text-foreground placeholder:text-muted-foreground
            focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring
            disabled:opacity-50"
        />
        {isLoading ? (
          <Button
            onClick={onStop}
            variant="destructive"
            size="icon"
            className="rounded-lg h-[46px] w-[46px] shrink-0"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={disabled || !value.trim()}
            size="icon"
            className="rounded-lg h-[46px] w-[46px] shrink-0 bg-foreground text-background
              hover:bg-foreground/90 disabled:opacity-30"
          >
            <ArrowUp className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
