import { toast } from "sonner";

/**
 * Uploads a file to Supabase storage via API route and returns the public URL.
 * This function is used by BlockNote editor for file/image uploads.
 * Uses server-side API route for proper Better Auth authentication.
 * 
 * @param file - The file to upload
 * @param showToast - Whether to show toast notifications (default: true)
 * @param workspaceId - Optional workspace ID (reserved for future use)
 * @param cardName - Optional card name (reserved for future use)
 * @returns Promise resolving to the public URL of the uploaded file
 * @throws Error if upload fails
 */
export async function uploadFile(
  file: File,
  showToast: boolean = true,
  workspaceId: string | null = null,
  cardName: string | undefined = undefined
): Promise<string> {
  // Show loading toast if not already shown (for paste handler)
  const toastId = showToast ? toast.loading('Uploading image...') : undefined;

  // Create FormData to send file
  const formData = new FormData();
  formData.append('file', file);

  try {
    // Upload via API route (uses Better Auth server-side)
    const response = await fetch('/api/upload-file', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      const errorMessage = errorData.error || `Failed to upload file: ${response.statusText}`;

      console.error('Error uploading file:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData.error,
      });

      // Show error toast
      if (showToast && toastId) {
        toast.error(errorMessage, { id: toastId });
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();

    if (!data.success || !data.url) {
      const errorMessage = data.error || 'Failed to get upload URL';

      // Show error toast
      if (showToast && toastId) {
        toast.error(errorMessage, { id: toastId });
      }

      throw new Error(errorMessage);
    }

    // Show success toast
    if (showToast && toastId) {
      toast.success('Image uploaded successfully!', { id: toastId });
    }

    return data.url;
  } catch (error) {
    // Re-throw error if it's already been handled
    if (error instanceof Error) {
      throw error;
    }
    // Handle unexpected errors
    const errorMessage = 'Failed to upload image';
    if (showToast && toastId) {
      toast.error(errorMessage, { id: toastId });
    }
    throw new Error(errorMessage);
  }
}
