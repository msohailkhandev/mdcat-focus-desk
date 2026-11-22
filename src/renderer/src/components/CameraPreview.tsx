import { useEffect, useRef, type ReactNode } from 'react';

interface CameraPreviewProps {
  readonly stream: MediaStream | null;
  readonly validationOk: boolean;
  readonly hint: string;
  readonly compact?: boolean;
}

/**
 * Live camera preview with the SDK's positioning hint overlaid.
 *
 * The preview is shown so the student always knows the camera is on, there
 * is no mode in this app where the camera runs without a visible preview.
 */
export function CameraPreview({
  stream,
  validationOk,
  hint,
  compact = false,
}: CameraPreviewProps): ReactNode {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    video.srcObject = stream;
    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  return (
    <div className={`camera-preview${compact ? ' camera-preview--compact' : ''}`}>
      <video ref={videoRef} autoPlay muted playsInline />
      <div className={`camera-preview__badge ${validationOk ? 'is-ok' : 'is-adjusting'}`}>
        <span className="dot" />
        {validationOk ? 'Signal good' : hint || 'Adjusting…'}
      </div>
    </div>
  );
}
