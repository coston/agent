'use client';

import { useCallback, useState } from 'react';
import type { FileUIPart } from 'ai';

/** How a picked file is referenced when sent as a chat `file` part. */
export interface ChatAttachment {
  /** A `data:` URL (default, inline) or a hosted URL (when `uploadFile` is used). */
  url: string;
  mediaType: string;
  filename?: string;
  /** Forwarded onto the `file` part (round-trips through persistence). */
  providerMetadata?: FileUIPart['providerMetadata'];
}

/**
 * Persist a picked file and return how to reference it (opt-in). When omitted,
 * attachments are inlined as `data:` URLs so images work with zero backend.
 */
export type UploadAttachment = (file: File) => Promise<ChatAttachment>;

export interface PendingAttachment {
  tempId: string;
  objectUrl: string;
  filename: string;
  mediaType: string;
  status: 'uploading' | 'ready' | 'error';
  ready?: ChatAttachment;
  error?: string;
}

export const DEFAULT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const DEFAULT_MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.readAsDataURL(file);
  });
}

export interface UseAttachmentsOptions {
  uploadFile?: UploadAttachment;
  acceptedTypes?: string[];
  maxBytes?: number;
  onError?: (message: string) => void;
}

/**
 * Manage the composer's pending image attachments: validate picks, resolve each
 * (upload via `uploadFile` or inline as a `data:` URL), and expose the ready
 * `ChatAttachment[]` to send. Object URLs are created for instant previews and
 * revoked on removal/clear.
 */
export function useAttachments({
  uploadFile,
  acceptedTypes = DEFAULT_IMAGE_TYPES,
  maxBytes = DEFAULT_MAX_ATTACHMENT_BYTES,
  onError,
}: UseAttachmentsOptions) {
  const [items, setItems] = useState<PendingAttachment[]>([]);

  const add = useCallback(
    async (files: File[]) => {
      const valid = files.filter(f => {
        if (!acceptedTypes.includes(f.type)) {
          onError?.('Only images can be attached (JPG, PNG, GIF, WebP).');
          return false;
        }
        if (f.size > maxBytes) {
          onError?.(`Images must be under ${Math.round(maxBytes / 1024 / 1024)} MB.`);
          return false;
        }
        return true;
      });
      if (valid.length === 0) return;

      const entries = valid.map(file => ({
        file,
        pending: {
          tempId: crypto.randomUUID(),
          objectUrl: URL.createObjectURL(file),
          filename: file.name,
          mediaType: file.type,
          status: 'uploading' as const,
        } satisfies PendingAttachment,
      }));
      setItems(prev => [...prev, ...entries.map(e => e.pending)]);

      await Promise.all(
        entries.map(async ({ file, pending }) => {
          try {
            const ready: ChatAttachment = uploadFile
              ? await uploadFile(file)
              : { url: await fileToDataUrl(file), mediaType: file.type, filename: file.name };
            setItems(prev =>
              prev.map(a => (a.tempId === pending.tempId ? { ...a, status: 'ready', ready } : a))
            );
          } catch (err) {
            setItems(prev =>
              prev.map(a =>
                a.tempId === pending.tempId
                  ? { ...a, status: 'error', error: err instanceof Error ? err.message : 'Upload failed' }
                  : a
              )
            );
          }
        })
      );
    },
    [uploadFile, acceptedTypes, maxBytes, onError]
  );

  const remove = useCallback((tempId: string) => {
    setItems(prev => {
      const entry = prev.find(a => a.tempId === tempId);
      if (entry) URL.revokeObjectURL(entry.objectUrl);
      return prev.filter(a => a.tempId !== tempId);
    });
  }, []);

  const clear = useCallback(() => {
    setItems(prev => {
      prev.forEach(a => URL.revokeObjectURL(a.objectUrl));
      return [];
    });
  }, []);

  const ready = items.filter(a => a.status === 'ready' && a.ready).map(a => a.ready!);
  const hasPending = items.some(a => a.status === 'uploading');

  return { items, add, remove, clear, ready, hasPending, acceptedTypes };
}
