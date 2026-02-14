"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface LinkInputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (url: string) => void;
  canAddMoreLinks: boolean;
  canAddYouTube: boolean;
}

export function LinkInputDialog({
  open,
  onOpenChange,
  onAdd,
  canAddMoreLinks,
  canAddYouTube,
}: LinkInputDialogProps) {
  const [urlInput, setUrlInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAddMoreLinks) return;

    const trimmed = urlInput.trim();
    if (!trimmed) return;

    const isYt =
      /youtube\.com\/watch|youtu\.be\//.test(trimmed);
    if (isYt && !canAddYouTube) return;

    onAdd(trimmed);
    setUrlInput("");
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) setUrlInput("");
        onOpenChange(open);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Add URL</DialogTitle>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="url"
            placeholder="https://example.com or https://youtube.com/watch?v=..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            autoFocus
            disabled={!canAddMoreLinks}
          />
          {!canAddMoreLinks && (
            <p className="text-sm text-muted-foreground">
              Maximum 5 links allowed.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setUrlInput("");
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                !urlInput.trim() ||
                !canAddMoreLinks ||
                (/youtube\.com\/watch|youtu\.be\//.test(urlInput.trim()) &&
                  !canAddYouTube)
              }
            >
              Add
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
