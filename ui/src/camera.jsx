import { useEffect, useRef, useState } from 'react';
import { usePref } from './prefs.js';
import { Icon } from './icons.jsx';

/** All cameras the laptop can see (built-in webcam, USB cameras, capture sticks). */
export function useCameras() {
  const [cameras, setCameras] = useState([]);
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        // Labels are only visible after access was granted once.
        const probe = await navigator.mediaDevices.getUserMedia({ video: true }).catch(() => null);
        probe?.getTracks().forEach((t) => t.stop());
        const list = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
        if (alive) setCameras(list.map((d, i) => ({ id: d.deviceId, label: d.label || `Camera ${i + 1}` })));
      } catch {
        if (alive) setCameras([]);
      }
    };
    refresh();
    navigator.mediaDevices?.addEventListener?.('devicechange', refresh);
    return () => {
      alive = false;
      navigator.mediaDevices?.removeEventListener?.('devicechange', refresh);
    };
  }, []);
  return cameras;
}

/** Live picture from the camera chosen in Settings → Camera. */
export function CameraView({ mirror: mirrorProp, guides = true, className = '' }) {
  const videoRef = useRef(null);
  const [deviceId] = usePref('camera.device', '');
  const [mirrorPref] = usePref('camera.mirror', false);
  const [status, setStatus] = useState('starting');
  const mirror = mirrorProp ?? mirrorPref;

  useEffect(() => {
    let stream = null;
    let alive = true;
    setStatus('starting');
    const constraints = { video: deviceId ? { deviceId: { exact: deviceId } } : true, audio: false };
    navigator.mediaDevices
      ?.getUserMedia(constraints)
      .then((s) => {
        if (!alive) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
        setStatus('live');
      })
      .catch(() => alive && setStatus('none'));
    return () => {
      alive = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [deviceId]);

  return (
    <div className={`camera-view ${className}`}>
      <video ref={videoRef} autoPlay muted playsInline style={{ transform: mirror ? 'scaleX(-1)' : undefined, opacity: status === 'live' ? 1 : 0 }} />
      {status === 'live' && guides && (
        <svg className="camera-guides" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M22 100 L34 55" className="guide-far" />
          <path d="M78 100 L66 55" className="guide-far" />
          <path d="M25 88 L75 88" className="guide-near" />
          <path d="M29 74 L71 74" className="guide-mid" />
          <path d="M32 62 L68 62" className="guide-far" />
        </svg>
      )}
      {status !== 'live' && (
        <div className="camera-empty">
          <Icon name="camera" size={40} />
          <p>{status === 'starting' ? 'Starting camera…' : 'No camera found'}</p>
          {status === 'none' && <small>Connect a USB camera and choose it in Settings → Camera</small>}
        </div>
      )}
    </div>
  );
}
