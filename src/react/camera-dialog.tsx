'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@coston/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@coston/ui/dialog';
import { Camera } from 'lucide-react';

export interface CameraDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Receives the captured frame as a JPEG `File`. */
  onCapture: (file: File) => void;
}

/**
 * A minimal rear-camera capture dialog. Opens the device camera via
 * `getUserMedia`, draws the current frame to a canvas on capture, and hands back
 * a JPEG `File`. The stream is always torn down on close/unmount.
 */
export function CameraDialog({ open, onOpenChange, onCapture }: CameraDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera is not available in this browser.');
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setError('Could not access the camera. Check browser permissions.'));
    return () => {
      cancelled = true;
      stop();
    };
  }, [open, stop]);

  useEffect(() => () => stop(), [stop]);

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob(
      blob => {
        if (!blob) return;
        onCapture(new File([blob], `photo-${canvas.width}x${canvas.height}.jpg`, { type: 'image/jpeg' }));
        onOpenChange(false);
      },
      'image/jpeg',
      0.92
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="sr-only">
          <DialogTitle>Take a photo</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col">
          <div className="flex min-h-64 items-center justify-center bg-black">
            {error ? (
              <p className="px-6 text-center text-sm text-white/70">{error}</p>
            ) : (
              <video ref={videoRef} autoPlay playsInline className="max-h-[60vh] max-w-full object-contain" />
            )}
          </div>
          <div className="flex justify-center gap-3 px-4 py-3">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={capture} disabled={!!error}>
              <Camera className="mr-1 size-3.5" />
              Capture
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
