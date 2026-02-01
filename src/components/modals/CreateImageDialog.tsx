"use client";

import { useState, useCallback, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ImageIcon, Loader2 } from "lucide-react";

interface CreateImageDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreate: (url: string, name: string) => void;
}

export function CreateImageDialog({
    open,
    onOpenChange,
    onCreate,
}: CreateImageDialogProps) {
    const [url, setUrl] = useState("");
    const [name, setName] = useState("");
    const [isValid, setIsValid] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // Basic validation that it looks like a URL
    useEffect(() => {
        try {
            if (!url.trim()) {
                setIsValid(false);
                return;
            }
            new URL(url);
            setIsValid(true);
        } catch {
            setIsValid(false);
        }
    }, [url]);

    const handleSubmit = useCallback(() => {
        if (!isValid || !url.trim()) {
            toast.error("Please enter a valid Image URL");
            return;
        }

        const cardName = name.trim() || "Image";
        onCreate(url.trim(), cardName);

        // Reset form
        setUrl("");
        setName("");
        onOpenChange(false);
    }, [url, name, isValid, onCreate, onOpenChange]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && isValid) {
            e.preventDefault();
            handleSubmit();
        } else if (e.key === 'Escape') {
            onOpenChange(false);
        }
    }, [isValid, handleSubmit, onOpenChange]);

    // Reset form when dialog opens
    useEffect(() => {
        if (open) {
            setUrl("");
            setName("");
            setIsValid(false);
        }
    }, [open]);

    // Handle paste event to capture image data
    const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        let imageFile: File | null = null;

        // Find image file in clipboard items
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                imageFile = items[i].getAsFile();
                break;
            }
        }

        if (!imageFile) return;

        // If we found an image, upload it
        e.preventDefault(); // Prevent pasting the "file name" text if any
        setIsUploading(true);
        const toastId = toast.loading("Uploading pasted image...");

        try {
            const formData = new FormData();
            formData.append('file', imageFile);

            const response = await fetch('/api/upload-file', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Failed to upload image');
            }

            const data = await response.json();

            setUrl(data.url);
            // Optionally auto-set name if empty
            if (!name) {
                // Determine a nice name, e.g. "Pasted Image" or filename if available
                setName("Pasted Image");
            }

            toast.success("Image uploaded successfully");
        } catch (error) {
            console.error("Paste upload failed:", error);
            toast.error("Failed to upload pasted image");
        } finally {
            setIsUploading(false);
            toast.dismiss(toastId);
        }
    }, [name]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent onKeyDown={handleKeyDown}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ImageIcon className="size-5" />
                        Add Image
                    </DialogTitle>
                    <DialogDescription>
                        Enter an image URL to add it to your workspace.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="image-url">Image URL</Label>
                        <Input
                            id="image-url"
                            type="url"
                            placeholder="https://example.com/image.jpg"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            onPaste={handlePaste}
                            autoFocus
                            disabled={isUploading}
                        />
                        {isUploading && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 animate-pulse mt-1">
                                <Loader2 className="size-3 animate-spin" />
                                Uploading image from clipboard...
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="image-name">Card Name</Label>
                        <Input
                            id="image-name"
                            type="text"
                            placeholder="Image Title (Optional)"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            Leave empty to use "Image"
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!isValid || isUploading}
                    >
                        {isUploading ? "Uploading..." : "Add Image"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
